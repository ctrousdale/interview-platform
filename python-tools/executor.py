"""Run one test in a fail-closed Linux Landlock and seccomp sandbox.

The parent supplies JSON on stdin. No submitted code runs until both kernel
restrictions are installed. Exit 42 means the test passed; 1 means it failed;
125 means isolation could not be established.
"""
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


def main():
    payload = json.load(sys.stdin)
    # stdout/stderr are /dev/null and stdin is exhausted before isolation.
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_NOFILE, (16, 16))
    try:
        isolate()
    except Exception:
        os._exit(125)
    try:
        namespace = {"__name__": "__main__"}
        exec(compile(payload["code"], "<solution>", "exec"), namespace)
        exec(compile(payload["test"], "<test>", "exec"), namespace)
    except BaseException:
        os._exit(1)
    os._exit(42)


if __name__ == "__main__":
    main()
