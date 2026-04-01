import json
import os
import re
import subprocess
import tempfile


def _safe_token(token: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", token or "default")


def _lock_path(kind: str, token: str) -> str:
    return os.path.join(tempfile.gettempdir(), f"roastpet_{kind}_{_safe_token(token)}.json")


def _pid_alive(pid: int) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            timeout=6,
        )
        return str(pid) in result.stdout
    except Exception:
        return False


def _terminate_pid(pid: int):
    if not _pid_alive(pid):
        return
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        capture_output=True,
        text=True,
        timeout=8,
    )


def claim_single_instance(kind: str, token: str):
    path = _lock_path(kind, token)
    old_pid = None
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            old_pid = int(payload.get("pid", 0))
    except Exception:
        old_pid = None

    if old_pid and old_pid != os.getpid():
        _terminate_pid(old_pid)

    with open(path, "w", encoding="utf-8") as handle:
        json.dump({"pid": os.getpid(), "kind": kind, "token": token}, handle)

    return path


def release_instance(lock_path: str):
    try:
        if os.path.exists(lock_path):
            with open(lock_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            if int(payload.get("pid", 0)) == os.getpid():
                os.remove(lock_path)
    except Exception:
        pass


def stop_token_pets(token: str):
    for kind in ("desktop", "cli"):
        path = _lock_path(kind, token)
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
                pid = int(payload.get("pid", 0))
                if pid and pid != os.getpid():
                    _terminate_pid(pid)
                try:
                    os.remove(path)
                except OSError:
                    pass
        except Exception:
            continue
