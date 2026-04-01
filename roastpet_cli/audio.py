import os
import subprocess
import tempfile
import time
import winsound

import pygame

from backend_client import fetch_voice_audio
from companion_memory import get_settings
from pet_voice import get_meme_line

PET_SOUND_STYLES = {
    "duck": "boing",
    "rabbit": "sparkle",
    "snail": "idle",
    "blob": "boing",
    "cat": "idle",
    "penguin": "sparkle",
    "ghost": "oops",
    "mushroom": "idle",
    "owl": "idle",
    "turtle": "idle",
    "axolotl": "sparkle",
    "robot": "victory",
    "dragon": "victory",
    "octopus": "boing",
    "capybara": "idle",
    "chonk": "boing",
}

PET_VOICE_RATES = {
    "duck": 1,
    "rabbit": 3,
    "snail": -2,
    "blob": -1,
    "cat": 0,
    "penguin": 2,
    "ghost": -3,
    "mushroom": -2,
    "owl": -1,
    "turtle": -3,
    "axolotl": 2,
    "robot": -4,
    "dragon": -2,
    "octopus": 1,
    "capybara": -2,
    "chonk": -3,
}


def init_audio():
    if not pygame.mixer.get_init():
        pygame.mixer.init()


def _play_audio_bytes(audio_bytes: bytes, suffix: str):
    init_audio()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        pygame.mixer.music.load(tmp_path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
    finally:
        try:
            pygame.mixer.music.unload()
        except Exception:
            pass
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def speak_text(
    text: str,
    species: str = "duck",
    token: str | None = None,
    backend_url="http://localhost:3000",
    mode: str = "ambient",
    voice_mode: str | None = None,
):
    trimmed = (text or "").strip()
    if not trimmed:
        return False

    selected_mode = voice_mode or get_settings().get("voice_mode", "system")
    if selected_mode == "mute":
        return False
    if selected_mode == "beep":
        play_funny_sound(PET_SOUND_STYLES.get(species, "boing"))
        return True

    if selected_mode != "ai" or not token:
        return _speak_with_windows_voice(trimmed, species)

    voice_payload = fetch_voice_audio(
        token=token,
        text=trimmed[:240],
        species=species,
        mode=mode,
        backend_url=backend_url,
    )
    if not voice_payload:
        return _speak_with_windows_voice(trimmed, species)

    content_type = voice_payload.get("content_type", "")
    suffix = ".wav" if "wav" in content_type else ".mp3"

    try:
        _play_audio_bytes(voice_payload["audio"], suffix=suffix)
        return True
    except Exception as e:
        print(f"[*] AI voice playback error: {e}")
        return _speak_with_windows_voice(trimmed, species)


def _speak_with_windows_voice(text: str, species: str = "duck"):
    safe_text = (text or "").strip().replace("'", "''")
    if not safe_text:
        return False
    rate = PET_VOICE_RATES.get(species, 0)
    command = (
        "Add-Type -AssemblyName System.Speech; "
        "$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"$speak.Rate = {rate}; "
        f"$speak.Speak('{safe_text}')"
    )
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=20,
        )
        return True
    except Exception:
        play_funny_sound(PET_SOUND_STYLES.get(species, "boing"))
        return True


def play_funny_sound(style: str = "boing"):
    patterns = {
        "boing": [(660, 90), (880, 80), (740, 120)],
        "sparkle": [(880, 50), (988, 50), (1174, 90)],
        "oops": [(520, 80), (420, 110), (320, 130)],
        "victory": [(784, 70), (988, 70), (1174, 120)],
        "idle": [(523, 40), (659, 40)],
    }
    for freq, duration in patterns.get(style, patterns["boing"]):
        try:
            winsound.Beep(freq, duration)
        except RuntimeError:
            continue


def play_species_signature(species: str):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    custom_path = os.path.join(base_dir, "audio", f"{species}.mp3")
    if os.path.exists(custom_path):
        try:
            init_audio()
            pygame.mixer.music.load(custom_path)
            pygame.mixer.music.play()
            return
        except Exception:
            pass
    play_funny_sound(PET_SOUND_STYLES.get(species, "boing"))


def play_sound(
    sound_name: str,
    species: str = "duck",
    token: str | None = None,
    backend_url="http://localhost:3000",
):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    custom_path = os.path.join(base_dir, "audio", f"{sound_name}.mp3")
    if os.path.exists(custom_path):
        try:
            init_audio()
            pygame.mixer.music.load(custom_path)
            pygame.mixer.music.play()
            return True
        except Exception:
            pass
    meme_line = get_meme_line(sound_name, species)
    spoken = speak_text(
        meme_line,
        species=species,
        token=token,
        backend_url=backend_url,
        mode="meme",
    )
    if spoken:
        return True
    style = {
        "bruh": "oops",
        "womp": "oops",
        "emotional": "boing",
        "none": "idle",
    }.get(sound_name, "sparkle")
    play_funny_sound(style)
    return True
