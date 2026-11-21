"""HTTP facade for isolated, short-lived Python tooling processes."""

import asyncio
import json
import os
from pathlib import Path
import signal
import tempfile
import sys
from uuid import UUID

from aiohttp import web

import suites
from canonical_algorithms import CANONICAL_INPUTS as ALGORITHM_INPUTS
from canonical_patterns import CANONICAL_INPUTS as PATTERN_INPUTS

assert not ALGORITHM_INPUTS.keys() & PATTERN_INPUTS.keys()
CANONICAL_INPUTS = {**ALGORITHM_INPUTS, **PATTERN_INPUTS}
assert CANONICAL_INPUTS.keys() == suites.SUITES.keys()
assert all(len(CANONICAL_INPUTS[question_id]) == len(suite["tests"])
           and all(type(value) is dict for value in CANONICAL_INPUTS[question_id])
           for question_id, suite in suites.SUITES.items())


def canonical_input(question_id, index):
    return json.dumps(CANONICAL_INPUTS[question_id][index], ensure_ascii=True, allow_nan=False)


MAX_BODY = 256 * 1024
MAX_SOURCE = 200 * 1024
MAX_FRAME = 8 * 1024 * 1024
MAX_CONCURRENT = 4
REQUEST_TIMEOUT = 15
MAX_CUSTOM_CASES = 10
MAX_CUSTOM_VALUE = 8 * 1024
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


async def suite_metadata(request):
    return web.json_response([
        {"id": question_id, "starterCode": suite["starterCode"],
         "testInstructions": suite["testInstructions"]}
        for question_id, suite in suites.SUITES.items()
    ])

async def testcase_metadata(request):
    question_id = request.match_info["id"]
    suite = suites.SUITES.get(question_id)
    fixture = suites.CUSTOM_CASES.get(question_id)
    if suite is None or fixture is None:
        raise web.HTTPNotFound(text="Unknown coding question")
    return web.json_response({
        "cases": [{"id": test["id"], "input": canonical_input(question_id, index), "sample": test["run"]}
                  for index, test in enumerate(suite["tests"])],
        "customTemplate": {"description": fixture["description"], "input": fixture["input"]},
    })


async def execute(request):
    try:
        async with asyncio.timeout(25):
            return await execute_inner(request)
    except TimeoutError:
        raise web.HTTPServiceUnavailable(text="Python execution capacity timed out")


async def read_diagnostics(stream):
    """Drain even hostile output while retaining only bounded diagnostic records."""
    buffer = b""
    latest = None
    records = 0
    discarding = False
    while chunk := await stream.read(4096):
        for part in chunk.splitlines(keepends=True):
            complete = part.endswith(b"\n")
            if not discarding:
                buffer += part
                if len(buffer) > 4096:
                    buffer = b""
                    discarding = True
                elif complete and records < 200:
                    records += 1
                    try:
                        record = json.loads(buffer)
                        if (isinstance(record, dict) and
                                isinstance(record.get("expected"), str) and
                                isinstance(record.get("actual"), str)):
                            latest = {"expected": record["expected"][:1000],
                                      "actual": record["actual"][:2000]}
                    except (ValueError, UnicodeDecodeError):
                        pass
            if complete:
                buffer = b""
                discarding = False
    return latest

def validate_custom_cases(value):
    if not isinstance(value, list) or len(value) > MAX_CUSTOM_CASES:
        raise web.HTTPBadRequest(text="customCases must be an array of at most 10 cases")
    seen = set()
    for case in value:
        if not isinstance(case, dict):
            raise web.HTTPBadRequest(text="Each custom case must be an object")
        case_id = case.get("id")
        try:
            if not isinstance(case_id, str):
                raise ValueError
            normalized = UUID(case_id)
            if str(normalized) != case_id.lower() or normalized in seen:
                raise ValueError
            seen.add(normalized)
        except ValueError:
            raise web.HTTPBadRequest(text="Custom case IDs must be unique UUIDs")
        for field in ("input", "expected"):
            item = case.get(field)
            if field == "expected" and item is None:
                continue
            if not isinstance(item, str):
                raise web.HTTPBadRequest(text=f"Custom case {field} must be a string")
            try:
                size = len(item.encode("utf-8"))
            except UnicodeEncodeError:
                raise web.HTTPBadRequest(text=f"Custom case {field} must contain valid Unicode")
            if size > MAX_CUSTOM_VALUE:
                raise web.HTTPBadRequest(text=f"Custom case {field} is too large")
    return value


async def read_custom_result(stream):
    # Drain all output even if the process emits malformed or excessive data.
    data = bytearray()
    while chunk := await stream.read(4096):
        if len(data) < 8192:
            data.extend(chunk[:8192 - len(data)])
    try:
        result = json.loads(data)
        if (isinstance(result, dict) and isinstance(result.get("actual"), str)
                and (result.get("passed") is None or type(result["passed"]) is bool)
                and (result.get("error") is None or isinstance(result["error"], str))):
            return {"actual": result["actual"][:2000], "passed": result["passed"],
                    "error": result["error"][:1000] if result["error"] else None}
    except (ValueError, UnicodeDecodeError, KeyError):
        pass
    return None


async def execute_inner(request):
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
    question_id = payload.get("questionId")
    mode = payload.get("mode")
    if not isinstance(question_id, str) or question_id not in suites.SUITES:
        raise web.HTTPNotFound(text="Unknown coding question")
    if mode not in ("run", "submit"):
        raise web.HTTPBadRequest(text="mode must be run or submit")
    custom_cases = validate_custom_cases(payload.get("customCases", [])) if mode == "run" else []
    if custom_cases and question_id not in suites.CUSTOM_CASES:
        raise web.HTTPServiceUnavailable(text="No custom case harness configured")
    tests = [(index, test) for index, test in enumerate(suites.SUITES[question_id]["tests"])
             if mode == "submit" or test["run"]]
    if not tests:
        raise web.HTTPServiceUnavailable(text="No tests configured")

    failures = []
    error = None
    custom_results = []
    async with request.app["slots"]:
        deadline = asyncio.get_running_loop().time() + 20
        for index, test in tests:
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                failures.append({"id": test["id"], "input": canonical_input(question_id, index),
                                 "expected": suites.SUITES[question_id]["testInstructions"][:1000]
                                             or "All assertions in the test pass",
                                 "actual": "Not executed: execution deadline exceeded"})
                error = "Execution timed out"
                continue
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-I", str(Path(__file__).with_name("executor.py")),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL, cwd="/", env=PROCESS_ENV,
                start_new_session=True,
            )
            reader = asyncio.create_task(read_diagnostics(process.stdout))
            timed_out = False
            try:
                data = json.dumps({"code": code, "test": test["code"],
                                   "expected": suites.SUITES[question_id]["testInstructions"]
                                               or "All assertions in the test pass"}).encode("utf-8")
                process.stdin.write(data)
                await process.stdin.drain()
                process.stdin.close()
                try:
                    await asyncio.wait_for(process.wait(), timeout=min(3, remaining))
                except TimeoutError:
                    timed_out = True
                    error = "Execution timed out"
            finally:
                await stop_process(process)
                diagnostic = await reader
            if process.returncode == 125:
                raise web.HTTPServiceUnavailable(text="Python sandbox unavailable")
            if timed_out or process.returncode != 42:
                actual = diagnostic["actual"] if diagnostic else "No diagnostic output was produced"
                if timed_out:
                    actual = "Execution timed out. " + actual
                elif process.returncode < 0:
                    actual = f"Execution terminated by signal {-process.returncode}. " + actual
                failures.append({"id": test["id"], "input": canonical_input(question_id, index),
                                 "expected": diagnostic["expected"] if diagnostic else
                                             suites.SUITES[question_id]["testInstructions"][:1000]
                                             or "All assertions in the test pass",
                                 "actual": actual})
        for case in custom_cases:
            entry = {"id": case["id"], "input": case["input"], "expected": case.get("expected")}
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                entry.update(actual="", passed=False, error="Execution deadline exceeded")
                custom_results.append(entry)
                continue
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-I", str(Path(__file__).with_name("executor.py")),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL, cwd="/", env=PROCESS_ENV,
                start_new_session=True,
            )
            reader = asyncio.create_task(read_custom_result(process.stdout))
            timed_out = False
            try:
                data = json.dumps({"code": code, "custom": case,
                                   "harness": suites.CUSTOM_CASES[question_id]["code"]}).encode("utf-8")
                process.stdin.write(data)
                await process.stdin.drain()
                process.stdin.close()
                try:
                    await asyncio.wait_for(process.wait(), timeout=min(3, remaining))
                except TimeoutError:
                    timed_out = True
            finally:
                await stop_process(process)
                custom_result = await reader
            if process.returncode == 125:
                raise web.HTTPServiceUnavailable(text="Python sandbox unavailable")
            if timed_out:
                custom_result = {"actual": "", "passed": False, "error": "Execution timed out"}
            elif process.returncode != 42 or custom_result is None:
                message = (f"Execution terminated by signal {-process.returncode}"
                           if process.returncode < 0 else "Execution failed without a result")
                custom_result = {"actual": "", "passed": False, "error": message}
            entry.update(custom_result)
            custom_results.append(entry)
    result = {"passed": not failures, "total": len(tests),
              "failedTestIds": [failure["id"] for failure in failures], "failures": failures}
    if mode == "run":
        result["customResults"] = custom_results
    if error:
        result["error"] = error
    return web.json_response(result)



def create_app():
    app = web.Application(client_max_size=MAX_BODY)
    app["slots"] = asyncio.Semaphore(MAX_CONCURRENT)
    app.router.add_post("/python/{method:format|diagnostics|completion}", handle)
    app.router.add_get("/python/suites", suite_metadata)
    app.router.add_get("/python/testcases/{id}", testcase_metadata)
    app.router.add_post("/python/execute", execute)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=8080)
