import os


VALID_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".md"}


def analyze_file(path: str):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            text = handle.read(8000)
    except OSError:
        return None

    lines = text.splitlines()
    non_empty = [line for line in lines if line.strip()]
    basename = os.path.basename(path)
    findings = []

    if any(tag in text for tag in ["TODO", "FIXME", "HACK"]):
        findings.append("still has TODO/FIXME markers")
    if "console.log(" in text or "debugger" in text or "print(" in text:
        findings.append("is leaking debug output")
    if len(non_empty) > 180:
        findings.append("is big enough to split into smaller pieces")
    if "any" in text and path.endswith((".ts", ".tsx")):
        findings.append("leans on `any`, so type safety is getting slippery")
    if "except Exception" in text or "catch (e)" in text or "catch(error)" in text:
        findings.append("has broad error handling that may hide the real issue")
    if "setTimeout(" in text and path.endswith((".js", ".ts", ".tsx")):
        findings.append("uses timer-driven flow, so cleanup and cancellation deserve a look")
    if "useEffect(" in text and "[]" not in text and path.endswith((".tsx", ".jsx")):
        findings.append("has a useEffect worth checking for dependency drift")

    if not findings:
        if basename.lower().startswith("test") or ".test." in basename or ".spec." in basename:
            summary = f"{basename} changed. Good test energy. Make sure it covers the newest edge case."
        else:
            summary = f"{basename} changed. It looks readable so far. I can keep watching for deeper smells."
    else:
        summary = f"{basename} changed. It " + ". ".join(findings[:2]) + "."

    return {
        "file": path,
        "summary": summary,
    }


def changed_files_since(root_dir: str, known_mtimes: dict, limit: int = 5):
    changed = []
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [name for name in dirs if name not in {".git", "node_modules", ".next", "__pycache__", ".venv", "venv", "dist", "build"}]
        for name in files:
            path = os.path.join(root, name)
            if os.path.splitext(name)[1].lower() not in VALID_EXTENSIONS:
                continue
            try:
                mtime = os.path.getmtime(path)
            except OSError:
                continue
            previous = known_mtimes.get(path, 0)
            known_mtimes[path] = mtime
            if previous and mtime > previous:
                changed.append(path)
                if len(changed) >= limit:
                    return changed
    return changed
