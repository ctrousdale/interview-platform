"""HTTP facade for isolated, short-lived Python tooling processes."""

import asyncio
import json
import os
from pathlib import Path
import signal
import tempfile

from aiohttp import web

MAX_BODY = 256 * 1024
MAX_SOURCE = 200 * 1024
MAX_FRAME = 8 * 1024 * 1024
MAX_CONCURRENT = 4
REQUEST_TIMEOUT = 15
PROCESS_ENV = {
    "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
    "HOME": "/tmp",
    "TMPDIR": "/tmp",
    "LANG": "C.UTF-8",
    "PYTHONNOUSERSITE": "1",
    "PYTHONDONTWRITEBYTECODE": "1",
}


class ToolError(Exception):
    pass


async def stop_process(process):
    # The language server can start helper processes; kill the whole session even
    # if the original server has already exited.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    await process.wait()


async def start_process(*args, cwd):
    return await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        cwd=cwd,
        env=PROCESS_ENV,
        start_new_session=True,
    )


async def send_message(process, message):
    body = json.dumps(message, ensure_ascii=True).encode("utf-8")
    process.stdin.write(f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body)
    await process.stdin.drain()


async def read_message(process):
    headers = {}
    while True:
        line = await process.stdout.readline()
        if not line:
            raise ToolError("Python language server exited unexpectedly")
        if line == b"\r\n":
            break
        if len(line) > 8192 or b":" not in line:
            raise ToolError("Invalid language server response")
        name, value = line.split(b":", 1)
        headers[name.strip().lower()] = value.strip()
    try:
        length = int(headers[b"content-length"])
        if length < 0 or length > MAX_FRAME:
            raise ValueError
        message = json.loads(await process.stdout.readexactly(length))
    except (KeyError, ValueError, json.JSONDecodeError, asyncio.IncompleteReadError) as exc:
        raise ToolError("Invalid language server response") from exc
    if not isinstance(message, dict):
        raise ToolError("Invalid language server response")
    return message


async def wait_for_response(process, request_id):
    while True:
        message = await read_message(process)
        if message.get("id") == request_id and "method" not in message:
            if "error" in message:
                raise ToolError("Python language server could not handle the request")
            return message.get("result")
        # pylsp does not normally issue requests for the capabilities advertised
        # here, but reply rather than leaving it blocked if it does.
        if "method" in message and "id" in message:
            await send_message(process, {"jsonrpc": "2.0", "id": message["id"],
                                         "error": {"code": -32601, "message": "Method not supported"}})


async def format_code(code):
    with tempfile.TemporaryDirectory(prefix="python-tools-", dir="/tmp") as workspace:
        process = await start_process("black", "--quiet", "-", cwd=workspace)
        try:
            stdout, _ = await process.communicate(code.encode("utf-8"))
            if process.returncode:
                raise ToolError("Python formatter could not format the submitted code")
            return {"code": stdout.decode("utf-8")}
        finally:
            await stop_process(process)


async def language_request(code, method, line=None, character=None):
    with tempfile.TemporaryDirectory(prefix="python-tools-", dir="/tmp") as workspace:
        uri = (Path(workspace) / "answer.py").as_uri()
        process = await start_process("pylsp", cwd=workspace)
        try:
            await send_message(process, {
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"processId": os.getpid(), "rootUri": Path(workspace).as_uri(),
                           "capabilities": {}},
            })
            await wait_for_response(process, 1)
            await send_message(process, {"jsonrpc": "2.0", "method": "initialized", "params": {}})
            await send_message(process, {
                "jsonrpc": "2.0", "method": "textDocument/didOpen",
                "params": {"textDocument": {"uri": uri, "languageId": "python",
                                            "version": 1, "text": code}},
            })
            if method == "diagnostics":
                while True:
                    message = await read_message(process)
                    params = message.get("params", {})
                    if (message.get("method") == "textDocument/publishDiagnostics"
                            and isinstance(params, dict) and params.get("uri") == uri):
                        return {"diagnostics": params.get("diagnostics", [])}
                    if "method" in message and "id" in message:
                        await send_message(process, {"jsonrpc": "2.0", "id": message["id"],
                                                     "error": {"code": -32601, "message": "Method not supported"}})
            await send_message(process, {
                "jsonrpc": "2.0", "id": 2, "method": "textDocument/completion",
                "params": {"textDocument": {"uri": uri},
                           "position": {"line": line, "character": character}},
            })
            result = await wait_for_response(process, 2)
            items = result.get("items", []) if isinstance(result, dict) else result
            if items is None:
                items = []
            if not isinstance(items, list):
                raise ToolError("Invalid language server response")
            completions = []
            for item in items:
                if not isinstance(item, dict) or not isinstance(item.get("label"), str):
                    continue
                completion = {"label": item["label"]}
                # A text edit is often the server's intended insertion text.
                edit = item.get("textEdit")
                insert = edit.get("newText") if isinstance(edit, dict) else item.get("insertText")
                if isinstance(insert, str):
                    completion["insertText"] = insert
                if isinstance(item.get("detail"), str):
                    completion["detail"] = item["detail"]
                completions.append(completion)
            return {"items": completions}
        finally:
            await stop_process(process)


def validate_position(code, line, character):
    if type(line) is not int or type(character) is not int or line < 0 or character < 0:
        raise web.HTTPBadRequest(text="line and character must be non-negative integers")
    lines = code.split("\n")
    if line >= len(lines):
        raise web.HTTPBadRequest(text="line is outside the submitted code")
    text = lines[line].removesuffix("\r")
    positions = {0}
    units = 0
    for char in text:
        units += 2 if ord(char) > 0xffff else 1
        positions.add(units)
    if character not in positions:
        raise web.HTTPBadRequest(text="character is not a valid UTF-16 position")


async def handle(request):
    try:
        async with asyncio.timeout(REQUEST_TIMEOUT):
            try:
                payload = await request.json()
            except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
                raise web.HTTPBadRequest(text="Expected a JSON object")
            if not isinstance(payload, dict) or not isinstance(payload.get("code"), str):
                raise web.HTTPBadRequest(text="code must be a string")
            code = payload["code"]
            try:
                size = len(code.encode("utf-8"))
            except UnicodeEncodeError:
                raise web.HTTPBadRequest(text="code must contain valid Unicode")
            if size > MAX_SOURCE:
                raise web.HTTPRequestEntityTooLarge(max_size=MAX_SOURCE, actual_size=size)
            method = request.match_info["method"]
            if method == "completion":
                line, character = payload.get("line"), payload.get("character")
                validate_position(code, line, character)
            async with request.app["slots"]:
                if method == "format":
                    result = await format_code(code)
                elif method == "diagnostics":
                    result = await language_request(code, method)
                else:
                    result = await language_request(code, method, line, character)
            return web.json_response(result)
    except TimeoutError:
        raise web.HTTPGatewayTimeout(text="Python tooling request timed out")
    except (ToolError, OSError, BrokenPipeError) as exc:
        raise web.HTTPBadGateway(text=str(exc) if isinstance(exc, ToolError) else "Python tooling failed")


def create_app():
    app = web.Application(client_max_size=MAX_BODY)
    app["slots"] = asyncio.Semaphore(MAX_CONCURRENT)
    app.router.add_post("/python/{method:format|diagnostics|completion}", handle)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=8080)
