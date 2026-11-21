"""Run one test in a fail-closed Linux Landlock and seccomp sandbox.

The parent supplies JSON on stdin. No submitted code runs until both kernel
restrictions are installed. Exit 42 means the test passed; 1 means it failed;
125 means isolation could not be established.
"""
import ast
import ctypes
import json
import os
import resource
import sys


class RulesetAttr(ctypes.Structure):
    _fields_ = [("handled_access_fs", ctypes.c_uint64)]


class PathBeneathAttr(ctypes.Structure):
    _pack_ = 1
    _fields_ = [("allowed_access", ctypes.c_uint64), ("parent_fd", ctypes.c_int32)]


def isolate():
    # Landlock syscalls have the same numbers on x86-64 and arm64. A kernel or
    # container policy that does not support them must fail closed.
    if os.uname().machine not in ("x86_64", "aarch64"):
        raise RuntimeError("unsupported sandbox architecture")
    libc = ctypes.CDLL(None, use_errno=True)
    seccomp = ctypes.CDLL("libseccomp.so.2", use_errno=True)
    libc.syscall.restype = ctypes.c_long
    seccomp.seccomp_init.argtypes = [ctypes.c_uint32]
    seccomp.seccomp_init.restype = ctypes.c_void_p
    seccomp.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    seccomp.seccomp_syscall_resolve_name.restype = ctypes.c_int
    seccomp.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    seccomp.seccomp_load.argtypes = [ctypes.c_void_p]
    seccomp.seccomp_release.argtypes = [ctypes.c_void_p]

    abi = libc.syscall(444, 0, 0, 1)
    if abi < 1:
        raise RuntimeError("Landlock unavailable")
    # Handle every filesystem right known to the running kernel, but grant
    # only read access to the standard-library tree (never /app, /proc, /tmp,
    # home directories, or credentials).
    handled = (1 << 13) - 1
    if abi >= 2:
        handled |= 1 << 13  # REFER
    if abi >= 3:
        handled |= 1 << 14  # TRUNCATE
    if abi >= 5:
        handled |= 1 << 15  # IOCTL_DEV
    attr = RulesetAttr(handled)
    ruleset = libc.syscall(444, ctypes.byref(attr), ctypes.sizeof(attr), 0)
    if ruleset < 0:
        raise RuntimeError("cannot create Landlock ruleset")
    try:
        for path in (f"{sys.base_prefix}/lib/python{sys.version_info.major}.{sys.version_info.minor}",):
            fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
            try:
                rule = PathBeneathAttr((1 << 2) | (1 << 3), fd)  # READ_FILE, READ_DIR
                if libc.syscall(445, ruleset, 1, ctypes.byref(rule), 0) != 0:
                    raise RuntimeError("cannot add Landlock rule")
            finally:
                os.close(fd)
        if libc.prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
            raise RuntimeError("cannot set no_new_privs")
        if libc.syscall(446, ruleset, 0) != 0:
            raise RuntimeError("cannot enforce Landlock")
    finally:
        os.close(ruleset)

    # Default-deny all syscalls: in particular no network, process creation,
    # signals, ptrace, cross-process memory operations, io_uring, or exec.
    allowed = """read write close fstat newfstatat lseek mmap mprotect munmap brk
        rt_sigaction rt_sigprocmask rt_sigreturn pread64 readv writev access
        sched_yield mremap madvise nanosleep getpid gettid clock_gettime
        clock_nanosleep getrandom uname sysinfo getcwd openat getdents64
        readlink readlinkat statx futex arch_prctl exit exit_group getuid geteuid
        getgid getegid getgroups fcntl dup dup2 dup3 getdents restart_syscall""".split()
    ctx = seccomp.seccomp_init(0x00050001)  # SCMP_ACT_ERRNO(EPERM)
    if not ctx:
        raise RuntimeError("cannot create seccomp filter")
    try:
        for name in allowed:
            number = seccomp.seccomp_syscall_resolve_name(name.encode("ascii"))
            if number >= 0 and seccomp.seccomp_rule_add(ctx, 0x7fff0000, number, 0) != 0:
                raise RuntimeError("cannot add seccomp rule")
        if seccomp.seccomp_load(ctx) != 0:
            raise RuntimeError("cannot enforce seccomp")
    finally:
        seccomp.seccomp_release(ctx)


def instrument(source):
    """Record already-evaluated values without calling user-defined repr methods."""
    class Recorder(ast.NodeTransformer):
        def visit_Assert(self, node):
            expression = ast.get_source_segment(source, node.test) or "assertion"
            node = self.generic_visit(node)
            marker = ast.Expr(ast.Call(ast.Name("__diagnostic_assert__", ast.Load()),
                                       [ast.Constant(expression)], []))
            return [ast.copy_location(marker, node), node]

        def visit_Call(self, node):
            text = ast.get_source_segment(source, node) or "call"
            node = self.generic_visit(node)
            return ast.copy_location(ast.Call(ast.Name("__diagnostic_value__", ast.Load()),
                                              [ast.Constant(text), node], []), node)

        def visit_Name(self, node):
            if not isinstance(node.ctx, ast.Load):
                return node
            return ast.copy_location(ast.Call(ast.Name("__diagnostic_value__", ast.Load()),
                                              [ast.Constant(node.id), node], []), node)

    return compile(ast.fix_missing_locations(Recorder().visit(ast.parse(source, "<test>"))),
                   "<test>", "exec")


def safe_value(value, depth=0):
    """Format only exact builtins, with bounded traversal and no user callbacks."""
    kind = type(value)
    if kind is str:
        return repr(value[:300]) + ("…" if len(value) > 300 else "")
    if kind is bytes:
        return repr(value[:150]) + ("…" if len(value) > 150 else "")
    if kind in (int, float, bool, type(None)):
        try:
            return repr(value)[:300]
        except ValueError:
            return "<integer too large to display>"
    if depth < 2 and kind in (list, tuple, dict, set, frozenset):
        items = []
        if kind is dict:
            for index, (key, item) in enumerate(value.items()):
                if index == 8:
                    break
                items.append(safe_value(key, depth + 1) + ": " + safe_value(item, depth + 1))
            return "{" + ", ".join(items) + (", …" if len(value) > 8 else "") + "}"
        for index, item in enumerate(value):
            if index == 8:
                break
            items.append(safe_value(item, depth + 1))
        return kind.__name__ + "([" + ", ".join(items) + (", …" if len(value) > 8 else "") + "])"
    return "<non-primitive value>"


def json_value(value, depth=0, budget=None):
    """Copy JSON-compatible exact builtins without invoking submitted methods."""
    if budget is None:
        budget = [10000]
    budget[0] -= 1
    if budget[0] < 0 or depth > 100:
        raise ValueError("Return value is too large or deeply nested")
    kind = type(value)
    if kind in (str, int, float, bool, type(None)):
        return value
    if kind in (list, tuple):
        return [json_value(item, depth + 1, budget) for item in value]
    if kind is dict:
        if any(type(key) is not str for key in value):
            raise TypeError("Return object keys must be strings")
        return {key: json_value(item, depth + 1, budget) for key, item in value.items()}
    raise TypeError("Return value is not JSON-compatible")


def json_equal(actual, expected):
    """Compare JSON values without treating booleans as numbers."""
    if type(actual) is bool or type(expected) is bool:
        return type(actual) is bool and type(expected) is bool and actual == expected
    if type(actual) is list and type(expected) is list:
        return len(actual) == len(expected) and all(json_equal(a, b) for a, b in zip(actual, expected))
    if type(actual) is dict and type(expected) is dict:
        return actual.keys() == expected.keys() and all(json_equal(actual[k], expected[k]) for k in actual)
    return actual == expected


def reject_json_constant(value):
    raise ValueError("Invalid JSON constant: " + value)


def diagnostics(fd, initial_expected):
    history = []
    expected = initial_expected
    count = 0

    def emit(actual):
        nonlocal count
        if count >= 100:
            return
        count += 1
        message = json.dumps({"expected": expected[:400], "actual": actual[:500]},
                             ensure_ascii=False).encode("utf-8", "backslashreplace") + b"\n"
        try:
            os.write(fd, message)
        except OSError:
            pass

    def assertion(expression):
        nonlocal expected
        expected = expression
        emit("Evaluating assertion. Observed: " + "; ".join(history[-2:]))

    def value(expression, result):
        history.append(expression[:60] + " = " + safe_value(result)[:120])
        del history[:-8]
        return result

    def failure(exc):
        kind = type(exc)
        name = type.__getattribute__(kind, "__name__")
        detail = safe_value(BaseException.args.__get__(exc))
        emit("Raised " + name + (" " + detail if detail else "") +
             ". Observed: " + "; ".join(history[-2:]))

    return assertion, value, failure


def main():
    payload = json.load(sys.stdin)
    diagnostic_fd = os.dup(1)
    os.set_blocking(diagnostic_fd, False)
    null_fd = os.open(os.devnull, os.O_WRONLY)
    os.dup2(null_fd, 1)
    os.close(null_fd)
    custom = payload.get("custom")
    test_code = None if custom is not None else instrument(payload["test"])
    assertion, value, failure = diagnostics(diagnostic_fd, payload.get("expected") or "")
    # User stdout/stderr are /dev/null and stdin is exhausted before isolation.
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_NOFILE, (16, 16))
    try:
        isolate()
    except Exception:
        os._exit(125)
    if custom is not None:
        try:
            custom_input = json.loads(custom["input"], parse_constant=reject_json_constant)
            if type(custom_input) is not dict:
                raise ValueError("Custom input must be a JSON object")
            expected_text = custom.get("expected")
            expected = (json.loads(expected_text, parse_constant=reject_json_constant)
                        if expected_text is not None else None)
            scenarios = custom_input.get("scenarios")
            if "scenarios" in custom_input:
                if (type(scenarios) is not list
                        or any(type(scenario) is not dict for scenario in scenarios)):
                    raise ValueError("scenarios must be an array of JSON objects")
            else:
                scenarios = [custom_input]
            solution = compile(payload["code"], "<solution>", "exec")
            harness = compile(payload["harness"], "<custom harness>", "exec")
            results = []
            for scenario in scenarios:
                namespace = {"__name__": "__main__"}
                exec(solution, namespace)
                namespace["custom_input"] = scenario
                exec(harness, namespace)
                results.append(json_value(namespace["custom_actual"]))
            actual = results if "scenarios" in custom_input else results[0]
            displayed = json.dumps(actual, ensure_ascii=True, allow_nan=False)
            if len(displayed) > 2000:
                raise ValueError("Return value is too large to display")
            passed = json_equal(actual, expected) if expected_text is not None else None
            result = {"actual": displayed, "passed": passed, "error": None}
        except BaseException as exc:
            name = type.__getattribute__(type(exc), "__name__")
            detail = safe_value(BaseException.args.__get__(exc))
            result = {"actual": "", "passed": False,
                      "error": (name + (": " + detail if detail else ""))[:400]}
        try:
            os.write(diagnostic_fd, json.dumps(result, ensure_ascii=False).encode("utf-8", "backslashreplace"))
        except OSError:
            pass
        os._exit(42)
    try:
        namespace = {"__name__": "__main__", "__diagnostic_assert__": assertion,
                     "__diagnostic_value__": value}
        exec(compile(payload["code"], "<solution>", "exec"), namespace)
        exec(test_code, namespace)
    except BaseException as exc:
        failure(exc)
        os._exit(1)
    os._exit(42)


if __name__ == "__main__":
    main()
