import asyncio
import json
import unittest
from unittest.mock import patch

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

import server


class PositionTests(unittest.TestCase):
    def test_utf16_positions_reject_split_surrogate_and_out_of_range(self):
        server.validate_position("a😀b\n", 0, 3)
        server.validate_position("a😀b\n", 1, 0)
        for line, character in [(0, 2), (0, 5), (2, 0), (False, 0)]:
            with self.subTest(line=line, character=character):
                with self.assertRaises(web.HTTPBadRequest):
                    server.validate_position("a😀b\n", line, character)


class ProtocolTests(unittest.IsolatedAsyncioTestCase):
    async def test_reports_python_syntax_errors(self):
        result = await server.language_request("def broken(:\n    pass\n", "diagnostics")
        self.assertTrue(result["diagnostics"])
        self.assertIn("syntax", result["diagnostics"][0]["message"].lower())

    async def test_read_framed_message_and_reject_oversized_frame(self):
        class Process:
            stdout = asyncio.StreamReader()

        process = Process()
        body = json.dumps({"result": "😀"}).encode()
        process.stdout.feed_data(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
        self.assertEqual(await server.read_message(process), {"result": "😀"})
        process.stdout.feed_data(f"Content-Length: {server.MAX_FRAME + 1}\r\n\r\n".encode())
        with self.assertRaises(server.ToolError):
            await server.read_message(process)

    async def test_rejects_invalid_input_and_dispatches_valid_completion(self):
        client = TestClient(TestServer(server.create_app()))
        await client.start_server()
        self.addAsyncCleanup(client.close)
        response = await client.post("/python/completion", json={"code": "😀", "line": 0, "character": 1})
        self.assertEqual(response.status, 400)
        with patch.object(server, "language_request", return_value={"items": []}) as language_request:
            response = await client.post("/python/completion", json={"code": "😀", "line": 0, "character": 2})
            self.assertEqual(response.status, 200)
            self.assertEqual(await response.json(), {"items": []})
            language_request.assert_awaited_once_with("😀", "completion", 0, 2)

    async def test_request_size_is_bounded(self):
        client = TestClient(TestServer(server.create_app()))
        await client.start_server()
        self.addAsyncCleanup(client.close)
        response = await client.post("/python/format", json={"code": "x" * (server.MAX_SOURCE + 1)})
        self.assertEqual(response.status, 413)
