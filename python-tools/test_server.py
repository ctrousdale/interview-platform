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


class ExecutionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = TestClient(TestServer(server.create_app()))
        await self.client.start_server()
        self.addAsyncCleanup(self.client.close)

    async def test_metadata_and_execution_validation(self):
        registry = {"question": {"starterCode": "pass", "testInstructions": "test",
                                 "tests": [{"id": "one", "code": "assert True", "run": True}]}}
        with patch.object(server.suites, "SUITES", registry):
            response = await self.client.get("/python/suites")
            self.assertEqual(await response.json(), [{"id": "question", "starterCode": "pass",
                                                      "testInstructions": "test"}])
            response = await self.client.post("/python/execute", json={
                "questionId": "question", "mode": "bad", "code": "pass"})
            self.assertEqual(response.status, 400)

    async def test_sandbox_blocks_network_filesystem_and_signals(self):
        registry = {"question": {"starterCode": "", "testInstructions": "",
                                 "tests": [{"id": "one", "code": "check()", "run": True}]}}
        code = '''
def check():
    import os, socket
    for action in (lambda: open("/proc/self/environ").read(),
                   lambda: socket.socket(),
                   lambda: os.kill(os.getppid(), 0),
                   lambda: open("/tmp/escape", "w")):
        try:
            action()
        except OSError:
            continue
        raise AssertionError("sandbox allowed forbidden operation")
'''
        with patch.object(server.suites, "SUITES", registry):
            response = await self.client.post("/python/execute", json={
                "questionId": "question", "mode": "submit", "code": code})
            if response.status == 503:
                self.skipTest("kernel sandbox unavailable")
            self.assertEqual(response.status, 200)
            self.assertEqual(await response.json(),
                             {"passed": True, "total": 1, "failedTestIds": [], "failures": []})

    async def execute_case(self, test, code):
        registry = {"question": {"starterCode": "", "testInstructions": "",
                                 "tests": [{"id": "stable-id", "code": test, "run": True}]}}
        with patch.object(server.suites, "SUITES", registry), \
                patch.object(server, "CANONICAL_INPUTS", {"question": [{"operations": [["next"], ["next"], ["next"]]}]}):
            response = await self.client.post("/python/execute", json={
                "questionId": "question", "mode": "submit", "code": code})
            if response.status == 503:
                self.skipTest("kernel sandbox unavailable")
            self.assertEqual(response.status, 200)
            return await response.json()

    async def test_first_failure_reports_stateful_input_expected_and_actual(self):
        result = await self.execute_case(
            "c = Counter()\nassert c.next() == 1\nassert c.next() == 3\nassert c.next() == 99",
            "class Counter:\n"
            "    def __init__(self): self.n = 0\n"
            "    def next(self):\n"
            "        self.n += 1\n"
            "        return self.n\n")
        self.assertEqual(result["failedTestIds"], ["stable-id"])
        failure = result["failures"][0]
        self.assertEqual(failure["id"], "stable-id")
        self.assertEqual(json.loads(failure["input"]), {"operations": [["next"], ["next"], ["next"]]})
        self.assertEqual(failure["expected"], "c.next() == 3")
        self.assertIn("c.next() = 2", failure["actual"])
        self.assertNotIn("99", failure["expected"])

    async def test_predicate_and_exception_diagnostics(self):
        result = await self.execute_case(
            "r = choose([1, 2])\nassert r in ([1], [2])",
            "def choose(values): return [3]\n")
        self.assertIn("r in ([1], [2])", result["failures"][0]["expected"])
        self.assertIn("3", result["failures"][0]["actual"])
        result = await self.execute_case(
            "assert solve(4) == 5",
            "def solve(value): raise ValueError('wrong')\n")
        self.assertIn("ValueError", result["failures"][0]["actual"])
        self.assertIn("wrong", result["failures"][0]["actual"])

    async def test_diagnostics_do_not_call_user_repr(self):
        result = await self.execute_case(
            "r = solve()\nassert r == 1",
            "class Result:\n"
            "    def __repr__(self): raise RuntimeError('repr was called')\n"
            "def solve(): return Result()\n")
        self.assertIn("AssertionError", result["failures"][0]["actual"])
        self.assertNotIn("repr was called", result["failures"][0]["actual"])

    async def test_unbounded_printing_is_not_collected(self):
        result = await self.execute_case(
            "assert solve() == 1",
            "def solve():\n"
            "    print('x' * 1000000)\n"
            "    return 2\n")
        self.assertIn("solve() = 2", result["failures"][0]["actual"])

    async def test_timeout_has_failure_details(self):
        result = await self.execute_case(
            "assert solve(7) == 8",
            "def solve(value):\n    while True: pass\n")
        failure = result["failures"][0]
        self.assertEqual(failure["id"], "stable-id")
        self.assertIsInstance(json.loads(failure["input"]), dict)
        self.assertIn("solve(7) == 8", failure["expected"])
        self.assertTrue("timed out" in failure["actual"] or
                        "signal" in failure["actual"])

    async def test_custom_metadata_and_validation(self):
        registry = {"question": {"starterCode": "", "testInstructions": "",
                                 "tests": [{"id": "one", "code": "assert True", "run": True},
                                           {"id": "two", "code": "assert False", "run": False}]}}
        fixtures = {"question": {"description": "One value", "input": '{"value": 1}',
                                 "code": "custom_actual = solve(custom_input['value'])"}}
        with patch.object(server.suites, "SUITES", registry), \
                patch.object(server.suites, "CUSTOM_CASES", fixtures), \
                patch.object(server, "CANONICAL_INPUTS", {"question": [{"value": 1}, {"value": 2}]}):
            response = await self.client.get("/python/testcases/question")
            self.assertEqual(await response.json(), {
                "cases": [{"id": "one", "input": '{"value": 1}', "sample": True},
                          {"id": "two", "input": '{"value": 2}', "sample": False}],
                "customTemplate": {"description": "One value", "input": '{"value": 1}'},
            })
            self.assertEqual((await self.client.get("/python/testcases/missing")).status, 404)
            case = {"id": "e6556176-2b70-4f5d-a4df-5f39e977d413", "input": "1", "expected": None}
            for cases in ([case, case], [{**case, "id": "bad"}],
                          [{**case, "input": "x" * (server.MAX_CUSTOM_VALUE + 1)}],
                          [case] * (server.MAX_CUSTOM_CASES + 1), "bad"):
                response = await self.client.post("/python/execute", json={
                    "questionId": "question", "mode": "run", "code": "pass", "customCases": cases})
                self.assertEqual(response.status, 400)

    async def test_custom_json_errors_and_submit_isolation(self):
        registry = {"question": {"starterCode": "", "testInstructions": "",
                                 "tests": [{"id": "one", "code": "assert True", "run": True}]}}
        fixtures = {"question": {"description": "value", "input": '{"value": 1}',
                                 "code": "custom_actual = solve(custom_input['value'])"}}
        inputs = [
            ('{"value": [1, [2, 3]]}', '[1, [2, 3]]'),
            ('{"value": 1}', None),
            ('{"value": 1}', "2"),
            ("__import__('os').getcwd()", None),
            ("[", None),
            ('{"value": 1}', "["),
            ("[1, 2]", None),
            ('{"value": NaN}', None),
            ('{"value": true}', "1"),
        ]
        cases = [{"id": f"00000000-0000-4000-8000-{index:012d}",
                  "input": value, "expected": expected}
                 for index, (value, expected) in enumerate(inputs)]
        with patch.object(server.suites, "SUITES", registry), \
                patch.object(server.suites, "CUSTOM_CASES", fixtures):
            response = await self.client.post("/python/execute", json={
                "questionId": "question", "mode": "run",
                "code": "def solve(value): return (value[0], tuple(value[1])) if isinstance(value, list) else value", "customCases": cases})
            if response.status == 503:
                self.skipTest("kernel sandbox unavailable")
            self.assertEqual(response.status, 200)
            result = await response.json()
            self.assertTrue(result["passed"])
            self.assertEqual(result["failedTestIds"], [])
            actual = result["customResults"]
            self.assertEqual([item["passed"] for item in actual],
                             [True, None, False, False, False, False, False, False, False])
            self.assertEqual([item["id"] for item in actual], [case["id"] for case in cases])
            self.assertTrue(all(item["error"] for item in actual[3:8]))
            self.assertIsNone(actual[8]["error"])
            response = await self.client.post("/python/execute", json={
                "questionId": "question", "mode": "submit", "code": "pass",
                "customCases": "ignored"})
            self.assertEqual(response.status, 200)
            self.assertNotIn("customResults", await response.json())

    async def test_custom_timeout_and_untrusted_repr(self):
        registry = {"question": {"starterCode": "", "testInstructions": "",
                                 "tests": [{"id": "one", "code": "assert True", "run": True}]}}
        fixtures = {"question": {"description": "value", "input": '{"value": 1}',
                                 "code": "custom_actual = solve(custom_input['value'])"}}
        case = {"id": "00000000-0000-4000-8000-000000000001", "input": '{"value": 1}', "expected": None}
        with patch.object(server.suites, "SUITES", registry), \
                patch.object(server.suites, "CUSTOM_CASES", fixtures):
            async def run(code):
                response = await self.client.post("/python/execute", json={
                    "questionId": "question", "mode": "run", "code": code,
                    "customCases": [case]})
                if response.status == 503:
                    self.skipTest("kernel sandbox unavailable")
                self.assertEqual(response.status, 200)
                return (await response.json())["customResults"][0]
            result = await run("class R:\n def __repr__(self): raise ValueError('called')\n"
                               "def solve(value): return R()")
            self.assertTrue(result["error"])
            self.assertNotIn("called", result["error"])
            result = await run(
                "def solve(value):\n"
                " import os, socket\n"
                " for action in (lambda: open('/proc/self/environ').read(),\n"
                "                lambda: socket.socket(), lambda: os.kill(os.getppid(), 0)):\n"
                "  try: action()\n"
                "  except OSError: continue\n"
                "  raise AssertionError('sandbox escape')\n"
                " return value\n")
            self.assertIsNone(result["error"])
            self.assertEqual(result["actual"], "1")
            result = await run("def solve(value):\n while True: pass")
            self.assertFalse(result["passed"])
            self.assertTrue(result["error"])

    async def test_numeric_graph_ids_in_custom_fixture(self):
        question = "google-top-k-similar"
        registry = {question: {"starterCode": "", "testInstructions": "",
                               "tests": [{"id": "one", "code": "assert True", "run": True}]}}
        case = {"id": "00000000-0000-4000-8000-000000000001",
                "input": json.dumps({"graph": [[1, [2]], [2, [1]]],
                                     "scores": [[1, 0], [2, 9]], "start": 1, "k": 1}),
                "expected": "[2]"}
        code = ("def top_similar(graph, scores, start, k):\n"
                " assert type(start) is int and all(type(key) is int for key in graph)\n"
                " assert all(type(key) is int for key in scores)\n"
                " return (graph[start][0],)\n")
        with patch.object(server.suites, "SUITES", registry):
            response = await self.client.post("/python/execute", json={
                "questionId": question, "mode": "run", "code": code, "customCases": [case]})
            if response.status == 503:
                self.skipTest("kernel sandbox unavailable")
            self.assertEqual(response.status, 200)
            result = (await response.json())["customResults"][0]
            self.assertTrue(result["passed"])
            self.assertEqual(json.loads(result["actual"]), [2])

    async def test_custom_stateful_operations_and_grouped_scenarios(self):
        question = "algorithms-cache"
        registry = {question: {"starterCode": "", "testInstructions": "",
                               "tests": [{"id": "one", "code": "assert True", "run": True}]}}
        scenarios = [{"capacity": 2, "operations": [
            {"op": "put", "key": 1, "value": 7}, {"op": "get", "key": 1}]},
            {"capacity": 1, "operations": [{"op": "get", "key": 1}]}]
        case = {"id": "00000000-0000-4000-8000-000000000001",
                "input": json.dumps({"scenarios": scenarios}),
                "expected": "[[null, 7], [-1]]"}
        code = ("class LRUCache:\n"
                " def __init__(self, capacity): self.values = {}\n"
                " def put(self, key, value): self.values[key] = value\n"
                " def get(self, key): return self.values.get(key, -1)\n")
        with patch.object(server.suites, "SUITES", registry):
            response = await self.client.post("/python/execute", json={
                "questionId": question, "mode": "run", "code": code, "customCases": [case]})
            if response.status == 503:
                self.skipTest("kernel sandbox unavailable")
            self.assertEqual(response.status, 200)
            result = (await response.json())["customResults"][0]
            self.assertTrue(result["passed"])
            self.assertEqual(json.loads(result["actual"]), [[None, 7], [-1]])
