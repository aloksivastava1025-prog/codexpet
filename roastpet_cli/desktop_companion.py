import argparse
from collections import deque
import math
import os
import random
import re
import subprocess
import tempfile
import threading
import time
import tkinter as tk
import wave

from audio import play_sound, play_species_signature, speak_text
from backend_client import (
    fetch_companion_reply,
    fetch_pet_config,
    fetch_proactive_nudge,
    plan_remote_command,
    poll_remote_command,
    update_pet_config,
    update_pet_presence,
    update_remote_command_status,
)
from code_scout import analyze_file, changed_files_since
from companion_memory import (
    add_bond,
    append_conversation,
    get_session_memory,
    get_settings,
    get_recent_conversation,
    record_checkin,
    should_emit_line,
    should_surface_speak,
    touch_session,
    update_settings,
)
from instance_guard import claim_single_instance, release_instance, stop_token_pets
from notifications import send_desktop_nudge
from pet_voice import get_boredom_breaker, get_focus_nudge, get_intro_line
from rpg_engine import load_or_hatch_soul
from sprites import BODIES, HAT_LINES

try:
    import numpy as np
    import sounddevice as sd
    import speech_recognition as sr
except Exception:
    np = None
    sd = None
    sr = None

TRANSPARENT_COLOR = "#ff00ff"
GOJO_BLUE = "#66c7ff"
GOJO_BLUE_DARK = "#0f2036"
GOJO_BLUE_BORDER = "#1f4d70"
FLYING_SPECIES = {"dragon", "ghost", "owl", "axolotl"}
SCOUT_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md"}
IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".idea",
    ".vscode",
}
DANGEROUS_COMMAND_SNIPPETS = [
    "remove-item",
    "del ",
    "rm ",
    "rmdir",
    "git reset",
    "git checkout --",
    "shutdown",
    "format ",
]


class DesktopCompanionApp:
    def __init__(self, token: str, backend_url: str, watch_dir: str):
        self.token = token
        self.backend_url = backend_url
        self.watch_dir = watch_dir
        self.lock_path = claim_single_instance("desktop", token)
        self.soul = load_or_hatch_soul(token, backend_url=backend_url)
        self.config = fetch_pet_config(token, backend_url=backend_url) or {}
        touch_session(token, self.soul["species"])

        self.running = True
        self.frame_idx = 0
        self.walking = True
        self.direction = 1
        self.speed = 5
        self.ground_y = 0
        self.float_phase = 0
        self.drag_start = None
        self.drag_pause_until = 0.0
        self.bubble_after_id = None
        self.is_flying = self.soul["species"] in FLYING_SPECIES
        self.cli_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "cli.py"))
        self.known_mtimes = {}
        self.last_analysis_at = 0.0
        self.last_proactive_at = 0.0
        self.ears_enabled = bool(np is not None and sd is not None and sr is not None)
        self.ear_pause_until = 0.0
        self.ear_status = "on" if self.ears_enabled else "off"
        self.ear_status_text = "Listening..." if self.ears_enabled else "Ears off"
        self.conversation_open_until = 0.0
        self.conversation_history = deque(get_recent_conversation(token, limit=8), maxlen=8)
        self.slap_enabled = bool(np is not None and sd is not None)
        self.last_slap_at = 0.0
        self.slap_stream = None
        self.last_knock_feedback_at = 0.0

        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg=TRANSPARENT_COLOR)
        try:
            self.root.wm_attributes("-transparentcolor", TRANSPARENT_COLOR)
        except tk.TclError:
            pass

        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()
        self.root.geometry(f"320x270+{self.screen_w - 380}+{self.screen_h - 380}")

        self.message_frame = tk.Frame(
            self.root,
            bg=GOJO_BLUE_DARK,
            highlightbackground=GOJO_BLUE_BORDER,
            highlightthickness=1,
            bd=0,
        )
        self.message_frame.place(x=16, y=8, width=288, height=72)

        self.message_label = tk.Label(
            self.message_frame,
            text="",
            justify="center",
            wraplength=260,
            fg="#dff6ff",
            bg=GOJO_BLUE_DARK,
            font=("Segoe UI", 9, "italic"),
            padx=10,
            pady=8,
        )
        self.message_label.pack(fill="both", expand=True)

        self.ear_button = tk.Button(
            self.root,
            text="Ears Off",
            command=self.toggle_ears,
            fg=GOJO_BLUE,
            bg=GOJO_BLUE_DARK,
            activebackground="#17375a",
            activeforeground="#eefaff",
            relief="flat",
            bd=1,
            highlightthickness=1,
            highlightbackground=GOJO_BLUE_BORDER,
            font=("Segoe UI", 8, "bold"),
            padx=8,
            pady=2,
            cursor="hand2",
        )
        self.ear_button.place(x=218, y=84, width=86, height=28)

        self.shadow_label = tk.Label(
            self.root,
            text="",
            justify="center",
            fg="#0a1830",
            bg=TRANSPARENT_COLOR,
            font=("Courier New", 18, "bold"),
            bd=0,
            padx=14,
            pady=10,
        )
        self.shadow_label.place(x=36, y=98)

        self.pet_label = tk.Label(
            self.root,
            text="",
            justify="center",
            fg=GOJO_BLUE,
            bg=TRANSPARENT_COLOR,
            font=("Courier New", 18, "bold"),
            bd=0,
            padx=14,
            pady=10,
        )
        self.pet_label.place(x=30, y=92)

        self.menu = tk.Menu(self.root, tearoff=0, bg=GOJO_BLUE_DARK, fg="#dff6ff", activebackground="#17375a", activeforeground=GOJO_BLUE)
        self.menu.add_command(label="Pet", command=self.pet)
        self.menu.add_command(label="Ask", command=self.ask)
        self.menu.add_command(label="Ears On", command=self.toggle_ears)
        self.menu.add_command(label="Scout Repo", command=self.scout_repo)
        self.menu.add_command(label="Meme", command=self.meme)
        self.menu.add_command(label="Slap Sound On", command=self.toggle_slap)
        self.menu.add_command(label="Open Terminal", command=self.launch_terminal)
        self.voice_menu = tk.Menu(self.menu, tearoff=0, bg="#141414", fg="#e8e4d8", activebackground="#2a1f0a", activeforeground="#f0a035")
        self.voice_menu.add_command(label="Mute", command=lambda: self.set_voice_mode("mute"))
        self.voice_menu.add_command(label="Funny Beeps", command=lambda: self.set_voice_mode("beep"))
        self.voice_menu.add_command(label="System Voice", command=lambda: self.set_voice_mode("system"))
        self.voice_menu.add_command(label="AI Voice", command=lambda: self.set_voice_mode("ai"))
        self.menu.add_cascade(label="Voice Mode", menu=self.voice_menu)
        self.speaker_menu = tk.Menu(self.menu, tearoff=0, bg="#141414", fg="#e8e4d8", activebackground="#2a1f0a", activeforeground="#f0a035")
        self.speaker_menu.add_command(label="Desktop Speaks", command=lambda: self.set_speaker_surface("desktop"))
        self.speaker_menu.add_command(label="Terminal Speaks", command=lambda: self.set_speaker_surface("terminal"))
        self.speaker_menu.add_command(label="Both Speak", command=lambda: self.set_speaker_surface("both"))
        self.menu.add_cascade(label="Speaker Surface", menu=self.speaker_menu)
        self.menu.add_command(label="Stop My Pets", command=self.stop_all_pets)
        self.menu.add_separator()
        self.menu.add_command(label="Quit", command=self.close)

        self.pet_label.bind("<ButtonPress-1>", self.start_drag)
        self.pet_label.bind("<B1-Motion>", self.on_drag)
        self.pet_label.bind("<ButtonRelease-1>", self.stop_drag)
        self.pet_label.bind("<Button-3>", self.open_menu)
        self.pet_label.bind("<Double-Button-1>", lambda _: self.launch_terminal())

        self.update_sprite()
        self.root.after(500, self.animate)
        self.root.after(1600, self.first_presence_ping)
        self.root.after(1200, self._start_slap_detector)

        self.chatter_thread = threading.Thread(target=self._chatter_loop, daemon=True)
        self.chatter_thread.start()
        self.analysis_thread = threading.Thread(target=self._analysis_loop, daemon=True)
        self.analysis_thread.start()
        self.remote_thread = threading.Thread(target=self._remote_command_loop, daemon=True)
        self.remote_thread.start()
        self.presence_thread = threading.Thread(target=self._presence_loop, daemon=True)
        self.presence_thread.start()
        self.ears_thread = threading.Thread(target=self._ears_loop, daemon=True)
        self.ears_thread.start()

    def _render_sprite(self):
        frames = BODIES[self.soul["species"]]
        frame = frames[self.frame_idx % len(frames)]
        body = [line.replace("{E}", self.soul["eye"]) for line in frame]
        if self.soul["hat"] != "none" and not body[0].strip():
            body[0] = HAT_LINES[self.soul["hat"]]
        if not body[0].strip() and all(not fr[0].strip() for fr in frames):
            body = body[1:]
        return "\n".join(body)

    def _show_bubble(self, text: str):
        self.message_label.config(text=text)
        self.message_frame.lift()
        if self.bubble_after_id:
            self.root.after_cancel(self.bubble_after_id)
        self.bubble_after_id = self.root.after(9000, lambda: self.message_label.config(text=""))

    def set_bubble(self, text: str, speak: bool = False, notify: bool = False):
        self._show_bubble(text)
        record_checkin(self.token, text)
        if speak and should_surface_speak("desktop") and should_emit_line(self.token, text, "desktop"):
            self.ear_pause_until = time.time() + max(2.5, min(8.0, len(text) / 16))
            speak_text(text, species=self.soul["species"], token=self.token, backend_url=self.backend_url, mode="ambient")
        if notify:
            send_desktop_nudge(f"RoastPet ({self.soul['species'].capitalize()})", text[:180])

    def _set_ear_status(self, text: str):
        self.ear_status_text = text
        self._refresh_ear_ui()

    def toggle_ears(self):
        if not self._ears_supported():
            self.set_bubble("Desktop ears need microphone packages first. I can add them, then I will listen anywhere.", speak=False, notify=True)
            return
        self.ears_enabled = not self.ears_enabled
        self.ear_status = "on" if self.ears_enabled else "off"
        label = "Ears Off" if self.ears_enabled else "Ears On"
        try:
            self.menu.entryconfig(2, label=label)
        except Exception:
            pass
        if self.ears_enabled:
            self.set_bubble("Ears on. Just say Buddy first, Master.", speak=True, notify=True)
            self.ear_pause_until = time.time() + 1.5
            self._set_ear_status("Listening...")
        else:
            self.set_bubble("Ears off. I will wait quietly till you call me again.", speak=False, notify=True)
            self._set_ear_status("Ears off")
        self._refresh_ear_ui()

    def toggle_slap(self):
        self.slap_enabled = not self.slap_enabled
        try:
            self.menu.entryconfig(5, label="Slap Sound Off" if self.slap_enabled else "Slap Sound On")
        except Exception:
            pass
        state = "on" if self.slap_enabled else "off"
        self.set_bubble(f"Slap mode {state}. Touchpad ke paas tap karke test kar sakte ho.", speak=False, notify=True)

    def _start_slap_detector(self):
        if not self.running or not self.slap_enabled or np is None or sd is None:
            return
        try:
            self.slap_stream = sd.InputStream(
                samplerate=16000,
                channels=1,
                dtype="int16",
                blocksize=1024,
                device=1,
                callback=self._slap_audio_callback,
            )
            self.slap_stream.start()
            self.set_bubble("Slap detector ready. Touchpad ke paas thoda sharp tap karke dekho.", speak=False, notify=False)
        except Exception:
            self.slap_stream = None

    def _slap_audio_callback(self, indata, frames, callback_time, status):
        if not self.running or not self.slap_enabled or np is None:
            return
        try:
            peak = int(np.abs(indata).max())
        except Exception:
            return
        now = time.time()
        if peak > 2200 and (now - self.last_knock_feedback_at) > 1.0:
            self.last_knock_feedback_at = now
            self.root.after(0, lambda p=peak: self._show_knock_feedback(p))
        if peak > 3600 and (now - self.last_slap_at) > 1.2:
            self.last_slap_at = now
            self.root.after(0, self._on_slap_detected)

    def _show_knock_feedback(self, peak: int):
        self.set_bubble(f"Knock suna... level {peak}. Thoda aur zor se tap karo.", speak=False, notify=False)

    def _on_slap_detected(self):
        play_sound("slap", species=self.soul["species"], token=self.token, backend_url=self.backend_url)
        self.set_bubble("Oye. Laptop pe itna violence? Dramatic tha, maan gaya.", speak=False, notify=False)

    def _refresh_ear_ui(self):
        label = self.ear_status_text if self.ears_enabled else "Ears off"
        bg = "#17375a" if self.ears_enabled else GOJO_BLUE_DARK
        fg = "#eefaff" if self.ears_enabled else GOJO_BLUE
        try:
            self.ear_button.config(text=label, bg=bg, fg=fg)
        except Exception:
            pass

    def _ears_supported(self):
        return bool(np is not None and sd is not None and sr is not None)

    def _recognition_language(self):
        language = str(self.config.get("conversationLanguage") or "hinglish").lower()
        if language == "hindi":
            return "hi-IN"
        if language == "english":
            return "en-US"
        return "hi-IN"

    def _recognition_languages(self):
        primary = self._recognition_language()
        fallbacks = ["hi-IN", "en-US"]
        ordered = [primary]
        for item in fallbacks:
            if item not in ordered:
                ordered.append(item)
        return ordered

    def _wake_words(self):
        species_name = str(self.soul.get("species") or "").lower()
        return {"buddy", "gojo", species_name}

    def _capture_transcript(self, seconds: float = 4.6):
        if not self._ears_supported():
            return ""
        sample_rate = 16000
        try:
            recording = sd.rec(int(seconds * sample_rate), samplerate=sample_rate, channels=1, dtype="int16")
            sd.wait()
        except Exception:
            return ""

        try:
            level = float(np.abs(recording).mean()) if np is not None else 0.0
            if level < 140:
                return ""
        except Exception:
            pass

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                temp_path = tmp.name
            with wave.open(temp_path, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(recording.tobytes())

            recognizer = sr.Recognizer()
            recognizer.dynamic_energy_threshold = True
            with sr.AudioFile(temp_path) as source:
                audio = recognizer.record(source)
            attempts = []
            for language in self._recognition_languages():
                try:
                    transcript = recognizer.recognize_google(audio, language=language)
                    cleaned = " ".join((transcript or "").split()).strip()
                    if cleaned:
                        attempts.append(cleaned)
                except sr.UnknownValueError:
                    continue
            if attempts:
                attempts.sort(key=len, reverse=True)
                return attempts[0]
            return ""
        except sr.UnknownValueError:
            return ""
        except sr.RequestError:
            self.root.after(0, lambda: self._set_ear_status("Net issue"))
            return ""
        except Exception:
            return ""
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

    def _extract_buddy_message(self, transcript: str):
        cleaned = " ".join((transcript or "").split()).strip()
        if not cleaned:
            return None
        lowered = cleaned.lower()
        for wake in self._wake_words():
            if lowered == wake:
                self.conversation_open_until = time.time() + 35
                return ""
            if lowered.startswith(f"{wake} "):
                self.conversation_open_until = time.time() + 35
                return cleaned[len(wake):].strip(" ,.-:!?")
            marker = f"{wake},"
            if lowered.startswith(marker):
                self.conversation_open_until = time.time() + 35
                return cleaned[len(wake) + 1:].strip(" ,.-:!?")
        for wake in self._wake_words():
            idx = lowered.find(f" {wake} ")
            if idx != -1:
                self.conversation_open_until = time.time() + 35
                return cleaned[idx + len(wake) + 1:].strip(" ,.-:!?")
        if time.time() < self.conversation_open_until and len(cleaned.split()) >= 2:
            return cleaned
        if len(cleaned.split()) >= 4:
            self.conversation_open_until = time.time() + 25
            return cleaned
        return None

    def _apply_local_voice_command(self, message: str):
        lowered = " ".join((message or "").split()).strip().lower()
        if not lowered:
            return False
        target_language = None
        if any(phrase in lowered for phrase in ["speak in english", "english me bolo", "english mein bolo", "switch to english", "language english"]):
            target_language = "english"
        elif any(phrase in lowered for phrase in ["speak in hindi", "hindi me bolo", "hindi mein bolo", "switch to hindi", "language hindi"]):
            target_language = "hindi"
        elif any(phrase in lowered for phrase in ["speak in hinglish", "hinglish me bolo", "hinglish mein bolo", "switch to hinglish", "language hinglish"]):
            target_language = "hinglish"

        if not target_language:
            return False

        result = update_pet_config(
            self.token,
            {"conversationLanguage": target_language},
            backend_url=self.backend_url,
        )
        self.config["conversationLanguage"] = (result or {}).get("conversationLanguage", target_language)
        reply_map = {
            "english": "Okay, I will talk in English now.",
            "hindi": "Theek hai, ab main Hindi mein baat karunga.",
            "hinglish": "Theek hai, ab Hinglish pe aa gaya hoon.",
        }
        reply_text = reply_map[target_language]
        self._append_conversation("master", message)
        self._append_conversation("buddy", reply_text)
        self.root.after(0, lambda text=reply_text: self.set_bubble(text, speak=True, notify=False))
        return True

    def _append_conversation(self, role: str, text: str):
        updated = append_conversation(self.token, role, text, limit=8)
        self.conversation_history = deque(updated, maxlen=8)

    def _history_payload(self):
        return [{"role": item.get("role", "master"), "text": item.get("text", "")} for item in list(self.conversation_history)[-6:]]

    def _ears_loop(self):
        while self.running:
            time.sleep(0.25)
            if not self.running or not self.ears_enabled:
                continue
            if time.time() < self.ear_pause_until:
                continue
            self.root.after(0, lambda: self._set_ear_status("Listening..."))
            transcript = self._capture_transcript()
            if transcript:
                self.root.after(0, lambda heard=transcript[:32]: self._set_ear_status(f"Heard: {heard}"))
            message = self._extract_buddy_message(transcript)
            if message is None:
                continue
            if not message:
                reply_text = "Haan?"
                self._append_conversation("master", "Buddy")
                self._append_conversation("buddy", reply_text)
                self.root.after(0, lambda text=reply_text: self.set_bubble(text, speak=True, notify=False))
                continue
            if self._apply_local_voice_command(message):
                self.root.after(0, lambda: self._set_ear_status("Listening..."))
                continue
            self._append_conversation("master", message)
            context = self._build_command_context(message)
            self.root.after(0, lambda: self._set_ear_status("Thinking..."))
            reply = fetch_companion_reply(
                self.token,
                message,
                context=context,
                history=self._history_payload(),
                backend_url=self.backend_url,
            )
            reply_text = (reply or {}).get("reply") or "Sun raha hoon, Master. Thoda aur clearly bolo."
            self._append_conversation("buddy", reply_text)
            self.root.after(0, lambda text=reply_text: self.set_bubble(text, speak=True, notify=False))
            self.root.after(0, lambda: self._set_ear_status("Listening..."))

    def set_voice_mode(self, voice_mode: str):
        update_settings(voice_mode=voice_mode)
        self.set_bubble(f"Voice mode set to {voice_mode}.", speak=False, notify=True)
        play_species_signature(self.soul["species"])

    def set_speaker_surface(self, surface: str):
        update_settings(speaker_surface=surface)
        self.set_bubble(f"Speaker surface set to {surface}.", speak=False, notify=True)
        play_species_signature(self.soul["species"])

    def update_sprite(self):
        sprite = self._render_sprite()
        self.pet_label.config(text=sprite)
        self.shadow_label.config(text=sprite)

    def animate(self):
        if not self.running:
            return
        self.frame_idx = (self.frame_idx + 1) % len(BODIES[self.soul["species"]])
        self.update_sprite()
        self._walk_step()
        self.root.after(220, self.animate)

    def _walk_step(self):
        if not self.walking or time.time() < self.drag_pause_until:
            return
        width = self.root.winfo_width() or 250
        height = self.root.winfo_height() or 190
        x = self.root.winfo_x()
        y_now = self.root.winfo_y()
        if self.ground_y == 0:
            self.ground_y = self.screen_h - height - 70
        if x < -40 or x > self.screen_w - 40 or y_now < -40 or y_now > self.screen_h - 40:
            self._reset_to_visible_position()
            x = self.root.winfo_x()
        self.float_phase += 1
        if self.is_flying:
            base_y = max(80, self.ground_y - 110)
            y = base_y + int(14 * math.sin(self.float_phase / 3.5))
        else:
            y = self.ground_y + int(4 * abs(((self.frame_idx % 4) - 1.5)))
        next_x = x + (self.speed * self.direction)
        if next_x <= 0:
            next_x = 0
            self.direction = 1
        if next_x >= self.screen_w - width:
            next_x = self.screen_w - width
            self.direction = -1
        self.root.geometry(f"+{int(next_x)}+{int(y)}")
        if self.message_label.cget("text"):
            self._show_bubble(self.message_label.cget("text"))

    def _reset_to_visible_position(self):
        x = max(20, self.screen_w - 340)
        y = max(100, self.screen_h - 320)
        self.root.geometry(f"+{x}+{y}")
        self.ground_y = y

    def start_drag(self, event):
        self.drag_start = (event.x_root, event.y_root, self.root.winfo_x(), self.root.winfo_y())
        self.drag_pause_until = time.time() + 20

    def on_drag(self, event):
        if not self.drag_start:
            return
        sx, sy, wx, wy = self.drag_start
        dx = event.x_root - sx
        dy = event.y_root - sy
        self.root.geometry(f"+{wx + dx}+{wy + dy}")
        self.ground_y = wy + dy
        if self.message_label.cget("text"):
            self._show_bubble(self.message_label.cget("text"))

    def stop_drag(self, _event):
        self.drag_start = None

    def open_menu(self, event):
        self.menu.tk_popup(event.x_root, event.y_root)

    def first_presence_ping(self):
        if not self.running:
            return
        mode = "fly" if self.is_flying else "walk"
        line = f"{self.soul['species'].capitalize()} arrived. I {mode}, I judge, I keep boredom away."
        self.set_bubble(line, speak=True, notify=True)
        play_species_signature(self.soul["species"])

    def pet(self):
        add_bond(self.token, 1)
        line = random.choice([
            "Pat pat accepted. Friendship combo increased.",
            "Morale buff applied. We are adorable and dangerous.",
            "Bond level rising. I will now judge bugs more personally.",
        ])
        self.set_bubble(line, speak=True)
        play_species_signature(self.soul["species"])

    def ask(self):
        self.set_bubble("Master, let me think for a second...", speak=False)
        threading.Thread(target=self._ask_from_brain, daemon=True).start()

    def scout_repo(self):
        summary = self._repo_summary()
        self.set_bubble(summary, speak=True, notify=True)
        play_species_signature(self.soul["species"])

    def meme(self):
        sound = random.choice(["bruh", "womp", "emotional"])
        play_sound(sound, species=self.soul["species"], token=self.token, backend_url=self.backend_url)
        self.set_bubble(f"{self.soul['species'].capitalize()} triggered a {sound} meme reaction.", notify=True)

    def launch_terminal(self):
        command = (
            f"Set-Location '{self.watch_dir}'; "
            f"py -3.12 '{self.cli_path}' --token {self.token} --backend-url {self.backend_url} --dir '{self.watch_dir}'"
        )
        subprocess.Popen(["powershell", "-NoExit", "-Command", command])
        self.set_bubble("Terminal runtime launched. Now I can roam here and work there.", notify=True)
        play_species_signature(self.soul["species"])

    def stop_all_pets(self):
        self.set_bubble("Closing every pet linked to this token. One companion at a time is enough chaos.")
        self.root.after(350, self._finish_stop_all)

    def _finish_stop_all(self):
        stop_token_pets(self.token)
        self.close()

    def _chatter_loop(self):
        intro = get_intro_line(self.soul["species"])
        self.root.after(0, lambda: self.set_bubble(intro, speak=True))
        while self.running:
            time.sleep(random.randint(35, 70))
            if not self.running:
                break
            line = self._generate_autonomous_line()
            self.root.after(0, lambda text=line: self.set_bubble(text, speak=True, notify=True))

    def _generate_autonomous_line(self):
        bond = int(get_session_memory(self.token).get("bond", 0))
        fallback = get_boredom_breaker(self.soul["species"], bond)
        if random.random() < 0.35:
            fallback = get_focus_nudge(self.soul["species"], len(self._git_dirty_files()))
        if random.random() < 0.22:
            fallback = self._repo_summary()

        config = fetch_pet_config(self.token, backend_url=self.backend_url) or self.config
        self.config = config
        if not config.get("autonomousMode", True):
            return fallback
        if time.time() - self.last_proactive_at < 35:
            return fallback
        context = self._build_command_context("autonomous check-in")
        recent = self._history_payload()
        response = fetch_proactive_nudge(
            self.token,
            context=context,
            recent_conversation=recent,
            backend_url=self.backend_url,
        )
        line = (response or {}).get("nudge", "").strip()
        if line:
            self.last_proactive_at = time.time()
            self._append_conversation("buddy", line)
            return line
        return fallback

    def _analysis_loop(self):
        while self.running:
            time.sleep(3)
            if not self.running:
                break
            if time.time() - self.last_analysis_at < 5:
                continue
            changed = changed_files_since(self.watch_dir, self.known_mtimes, limit=3)
            if not changed:
                continue
            target = changed[-1]
            analysis = analyze_file(target)
            if not analysis:
                continue
            self.last_analysis_at = time.time()
            summary = analysis["summary"]
            self.root.after(0, lambda text=summary: self.set_bubble(text, speak=True, notify=False))

    def _ask_from_brain(self):
        bond = int(get_session_memory(self.token).get("bond", 0))
        prompt = get_boredom_breaker(self.soul["species"], bond)
        context = self._build_command_context("conversational repo help")
        self._append_conversation("master", prompt)
        reply = fetch_companion_reply(
            self.token,
            prompt,
            context=context,
            history=self._history_payload(),
            backend_url=self.backend_url,
        )
        line = (reply or {}).get("reply") or prompt
        self._append_conversation("buddy", line)
        self.root.after(0, lambda text=line: self.set_bubble(text, speak=True, notify=False))

    def _presence_loop(self):
        while self.running:
            latest_config = fetch_pet_config(self.token, backend_url=self.backend_url)
            if latest_config:
                self.config = latest_config
            update_pet_presence(
                self.token,
                self.soul["species"],
                "desktop",
                f"{self.soul['species']} visible on screen | ears {'on' if self.ears_enabled else 'off'}",
                backend_url=self.backend_url,
            )
            time.sleep(5)

    def _remote_command_loop(self):
        while self.running:
            time.sleep(4)
            if not self.running:
                break
            command = poll_remote_command(self.token, backend_url=self.backend_url)
            if not command:
                continue
            command_id = str(command.get("id") or "")
            text = (command.get("text") or "").strip()
            if not text:
                continue
            if command_id:
                update_remote_command_status(command_id, "working", "Pet is planning the command.", backend_url=self.backend_url)
            self.root.after(0, lambda incoming=text: self.set_bubble(f"Remote command heard: {incoming}", speak=True, notify=True))
            context = self._build_command_context(text)
            plan = plan_remote_command(self.token, text, context=context, backend_url=self.backend_url)
            if command_id:
                update_remote_command_status(command_id, "working", "Pet is executing the command.", backend_url=self.backend_url)
            result, success = self._execute_remote_plan(plan, text)
            if command_id:
                update_remote_command_status(
                    command_id,
                    "done" if success else "failed",
                    result,
                    backend_url=self.backend_url,
                )
            self.root.after(0, lambda outgoing=result: self.set_bubble(outgoing, speak=True, notify=True))

    def _execute_remote_plan(self, plan: dict, original_text: str):
        if not isinstance(plan, dict):
            return "Remote command aaya tha, but planner ne kuch samajhne layak nahi diya.", False
        if plan.get("error"):
            return f"Planner hiccup: {plan['error']}", False

        action = str(plan.get("action") or "noop")
        path = str(plan.get("path") or "").strip()
        content = str(plan.get("content") or "")
        command = str(plan.get("command") or "").strip()
        summary = str(plan.get("summary") or "Remote command complete.")

        if action in {"analyze_repo", "suggest"}:
            return self._repo_summary(), True

        if action in {"create_file", "write_file", "edit_file"}:
            full_path = self._safe_project_path(path or self._guess_path_from_text(original_text))
            if not full_path:
                return "I heard the remote command, but the file path looked unsafe or missing.", False
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            final_content = content or self._fallback_content(full_path, original_text)
            with open(full_path, "w", encoding="utf-8") as handle:
                handle.write(final_content)
            verb = "Updated" if action == "edit_file" else "Created"
            return f"{summary} {verb} {os.path.relpath(full_path, self.watch_dir)}.", True

        if action == "shell_command":
            if not self._is_safe_shell_command(command):
                return "I refused that shell command because it looked risky for the project.", False
            try:
                completed = subprocess.run(
                    ["powershell", "-NoProfile", "-Command", command],
                    cwd=self.watch_dir,
                    capture_output=True,
                    text=True,
                    timeout=90,
                )
            except Exception as exc:
                return f"Shell command failed to start: {exc}", False
            if completed.returncode != 0:
                stderr = " ".join((completed.stderr or "").split())[:180]
                return f"Shell command failed. {stderr or 'The command returned a non-zero exit code.'}", False
            stdout = " ".join((completed.stdout or "").split())[:180]
            return f"{summary} Shell command completed. {stdout}".strip(), True

        return summary, True

    def _is_safe_shell_command(self, command: str):
        lowered = (command or "").lower()
        if not lowered.strip():
            return False
        if any(snippet in lowered for snippet in DANGEROUS_COMMAND_SNIPPETS):
            return False
        return True

    def _build_command_context(self, text: str):
        files = self._select_relevant_files(text)
        chunks = [f"Project root: {self.watch_dir}"]
        dirty = self._git_dirty_files()
        if dirty:
            chunks.append("Dirty files: " + ", ".join(os.path.relpath(path, self.watch_dir) for path in dirty[:6]))
        if files:
            chunks.append("Relevant files:")
        for path in files[:3]:
            rel = os.path.relpath(path, self.watch_dir)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                    content = handle.read(5000)
            except OSError:
                continue
            chunks.append(f"\nFILE: {rel}\n{content}\n")
        return "\n".join(chunks)

    def _select_relevant_files(self, text: str):
        lowered = (text or "").lower()
        explicit = self._guess_path_from_text(text)
        matches = []
        if explicit:
            full = self._safe_project_path(explicit)
            if full and os.path.exists(full):
                matches.append(full)
        keywords = [part for part in re.split(r"[^a-zA-Z0-9_.-]+", lowered) if len(part) > 2]
        for path in self._collect_code_files(limit=80):
            rel = os.path.relpath(path, self.watch_dir).lower()
            name = os.path.basename(path).lower()
            if any(key in rel or key in name for key in keywords):
                matches.append(path)
            if len(matches) >= 5:
                break
        if not matches:
            matches = self._git_dirty_files()[:3] or self._collect_code_files(limit=3)
        deduped = []
        seen = set()
        for path in matches:
            if path not in seen:
                deduped.append(path)
                seen.add(path)
        return deduped

    def _safe_project_path(self, relative_path: str):
        if not relative_path:
            return None
        candidate = os.path.abspath(os.path.join(self.watch_dir, relative_path))
        root = os.path.abspath(self.watch_dir)
        if candidate == root or not candidate.startswith(root):
            return None
        return candidate

    def _guess_path_from_text(self, text: str):
        lowered = text.lower()
        for marker in ["create file", "new file", "file named", "file called", "write file"]:
            if marker in lowered:
                tail = text[lowered.index(marker) + len(marker):].strip(" :.-")
                first = tail.split()[0] if tail else ""
                if "." in first or "/" in first or "\\" in first:
                    return first.strip("\"'")
        if "website" in lowered or "landing page" in lowered:
            return "index.html"
        return ""

    def _fallback_content(self, path: str, text: str):
        ext = os.path.splitext(path)[1].lower()
        if ext == ".html":
            title = "RoastPet Build"
            return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
    body {{ font-family: Arial, sans-serif; background:#111; color:#f4ead2; display:grid; place-items:center; min-height:100vh; margin:0; }}
    main {{ max-width:720px; padding:48px; border:1px solid #333; border-radius:16px; background:#171717; }}
    h1 {{ color:#f0a035; }}
  </style>
</head>
<body>
  <main>
    <h1>{title}</h1>
    <p>Generated by your desktop pet from this remote request:</p>
    <p>{text}</p>
  </main>
</body>
</html>
"""
        if ext in {".js", ".ts"}:
            return f"// Generated by RoastPet from remote command.\nconsole.log({text!r});\n"
        if ext in {".py"}:
            return f"# Generated by RoastPet from remote command.\nprint({text!r})\n"
        return f"Generated by RoastPet from remote command:\n{text}\n"

    def _repo_summary(self):
        dirty = self._git_dirty_files()
        code_files = self._collect_code_files(limit=60)

        if dirty:
            filenames = ", ".join(os.path.basename(path) for path in dirty[:3])
            advice = self._inspect_files(dirty[:3])
            return f"I spotted {len(dirty)} changed files: {filenames}. {advice}"
        if code_files:
            advice = self._inspect_files(code_files[:4])
            focus = os.path.basename(code_files[0])
            return f"I can see the whole repo. {focus} is a good next poke. {advice}"
        return "I can scout the repo, but I need a readable project folder to whisper useful chaos."

    def _git_dirty_files(self):
        try:
            git = subprocess.run(
                ["git", "status", "--short"],
                cwd=self.watch_dir,
                capture_output=True,
                text=True,
                timeout=4,
            )
            if git.returncode != 0:
                return []
            files = []
            for raw_line in git.stdout.splitlines():
                line = raw_line.strip()
                if not line:
                    continue
                candidate = line[3:].strip()
                if "->" in candidate:
                    candidate = candidate.split("->", 1)[1].strip()
                full_path = os.path.join(self.watch_dir, candidate)
                if os.path.isfile(full_path):
                    files.append(full_path)
            return files
        except Exception:
            return []

    def _collect_code_files(self, limit=40):
        collected = []
        for root, dirs, files in os.walk(self.watch_dir):
            dirs[:] = [name for name in dirs if name not in IGNORED_DIRS]
            for name in files:
                if len(collected) >= limit:
                    return collected
                path = os.path.join(root, name)
                if os.path.splitext(name)[1].lower() in SCOUT_EXTENSIONS:
                    collected.append(path)
        return collected

    def _inspect_files(self, file_paths):
        suggestions = []
        for path in file_paths:
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                    text = handle.read(6000)
            except OSError:
                continue

            lines = [line for line in text.splitlines() if line.strip()]
            basename = os.path.basename(path)

            if any(tag in text for tag in ["TODO", "FIXME", "HACK"]):
                suggestions.append(f"{basename} still has TODO energy.")
            if "console.log(" in text or "debugger" in text or "print(" in text:
                suggestions.append(f"{basename} is leaking debug chatter.")
            if len(lines) > 140:
                suggestions.append(f"{basename} is getting chunky enough for a split.")
            if basename.lower().startswith("test") or ".test." in basename or ".spec." in basename:
                suggestions.append(f"{basename} looks like test coverage territory.")

            if len(suggestions) >= 2:
                break

        if suggestions:
            return " ".join(suggestions[:2])
        if file_paths:
            sample = os.path.basename(file_paths[0])
            return f"{sample} looks readable. I can keep scouting and nudge you toward cleanup or tests."
        return "I can read files, but this folder is being mysteriously quiet."

    def close(self):
        self.running = False
        try:
            if self.slap_stream is not None:
                self.slap_stream.stop()
                self.slap_stream.close()
        except Exception:
            pass
        update_pet_presence(self.token, self.soul["species"], "desktop", "offline", backend_url=self.backend_url)
        release_instance(self.lock_path)
        try:
            self.message_frame.destroy()
        except Exception:
            pass
        self.root.destroy()

    def run(self):
        self._prime_file_index()
        self.root.mainloop()

    def _prime_file_index(self):
        changed_files_since(self.watch_dir, self.known_mtimes, limit=1)


def main():
    parser = argparse.ArgumentParser(description="RoastPet Desktop Companion")
    parser.add_argument("--token", required=True)
    parser.add_argument("--backend-url", default="http://127.0.0.1:3000")
    parser.add_argument("--dir", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    args = parser.parse_args()

    DesktopCompanionApp(args.token, args.backend_url, args.dir).run()


if __name__ == "__main__":
    main()
