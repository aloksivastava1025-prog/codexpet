import json
import os
import time


def get_memory_path():
    return os.path.expanduser("~/.roastpet_memory.json")


def load_memory():
    path = get_memory_path()
    if not os.path.exists(path):
        return {"sessions": {}, "last_global_checkin": 0, "settings": {"voice_mode": "system", "speaker_surface": "desktop"}}
    try:
        with open(path, "r", encoding="utf-8") as f:
            memory = json.load(f)
            memory.setdefault("sessions", {})
            memory.setdefault("last_global_checkin", 0)
            settings = memory.setdefault("settings", {})
            settings.setdefault("voice_mode", "system")
            settings.setdefault("speaker_surface", "desktop")
            return memory
    except Exception:
        return {"sessions": {}, "last_global_checkin": 0, "settings": {"voice_mode": "system", "speaker_surface": "desktop"}}


def save_memory(memory: dict):
    with open(get_memory_path(), "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2)


def touch_session(token: str, species: str):
    memory = load_memory()
    sessions = memory.setdefault("sessions", {})
    session = sessions.setdefault(token, {})
    session["species"] = species
    session["last_seen_at"] = time.time()
    session["session_count"] = int(session.get("session_count", 0)) + 1
    session.setdefault("bond", 0)
    save_memory(memory)
    return session


def record_checkin(token: str, note: str):
    memory = load_memory()
    sessions = memory.setdefault("sessions", {})
    session = sessions.setdefault(token, {})
    session["last_checkin_at"] = time.time()
    session["last_note"] = note
    save_memory(memory)


def add_bond(token: str, amount: int = 1):
    memory = load_memory()
    sessions = memory.setdefault("sessions", {})
    session = sessions.setdefault(token, {})
    session["bond"] = int(session.get("bond", 0)) + amount
    save_memory(memory)
    return session["bond"]


def get_session_memory(token: str):
    memory = load_memory()
    return memory.get("sessions", {}).get(token, {})


def get_settings():
    memory = load_memory()
    return memory.get("settings", {})


def update_settings(**updates):
    memory = load_memory()
    settings = memory.setdefault("settings", {})
    settings.update(updates)
    save_memory(memory)
    return settings


def should_surface_speak(surface: str):
    settings = get_settings()
    speaker_surface = settings.get("speaker_surface", "desktop")
    return speaker_surface == "both" or speaker_surface == surface


def should_emit_line(token: str, text: str, surface: str, cooldown: int = 18):
    normalized = " ".join((text or "").split()).strip().lower()
    if not normalized:
        return False

    memory = load_memory()
    sessions = memory.setdefault("sessions", {})
    session = sessions.setdefault(token, {})
    last_text = session.get("last_spoken_text", "")
    last_surface = session.get("last_spoken_surface", "")
    last_at = float(session.get("last_spoken_at", 0))
    now = time.time()

    if normalized == last_text and last_surface == surface and (now - last_at) < cooldown:
        return False

    session["last_spoken_text"] = normalized
    session["last_spoken_surface"] = surface
    session["last_spoken_at"] = now
    save_memory(memory)
    return True
