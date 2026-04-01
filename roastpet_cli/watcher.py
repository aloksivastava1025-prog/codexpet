from watchdog.events import FileSystemEventHandler
import os
import re
import threading
import time

from ai_client import analyze_code
from audio import play_sound, speak_text
from companion_memory import should_emit_line, should_surface_speak
from rpg_engine import add_xp

BUDDY_TRIGGER_RE = re.compile(r"(?://|#)\s*@roastpet\b|/\*\s*/buddy\s*\*/|#\s*/buddy\b", re.IGNORECASE)


def _shorten_for_voice(text: str, limit: int = 180):
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return compact[:limit].rsplit(" ", 1)[0] + "..."


class FileChangeHandler(FileSystemEventHandler):
    def __init__(self, token: str, ui):
        super().__init__()
        self.token = token
        self.ui = ui
        self.last_modified = {}
        self.debounce_seconds = 2.0
        self.cooldown_until = 0.0
        self.ignored_parts = {
            ".git",
            "node_modules",
            ".next",
            "__pycache__",
            ".venv",
            "venv",
            "dist",
            "build",
        }

    def on_modified(self, event):
        if event.is_directory:
            return

        filepath = event.src_path
        if any(part in filepath for part in self.ignored_parts):
            return
        valid_exts = {".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".cpp", ".java", ".go", ".rs"}
        ext = os.path.splitext(filepath)[1]
        if ext not in valid_exts:
            return

        if time.time() < self.cooldown_until:
            return

        current_time = time.time()
        last_time = self.last_modified.get(filepath, 0)
        if current_time - last_time < self.debounce_seconds:
            return

        self.last_modified[filepath] = current_time
        threading.Thread(target=self._analyze_and_react, args=(filepath,), daemon=True).start()

    def _check_buddy_trigger(self, content: str) -> bool:
        return bool(BUDDY_TRIGGER_RE.search(content))

    def _analyze_and_react(self, filepath: str):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            if len(content.strip()) < 10:
                return

            if self._check_buddy_trigger(content):
                summon = "You summoned me, trainer. I am arriving with jokes and concern."
                self.ui.set_ambient(summon, speak=True)
                self.ui.set_state("roasting")
                play_sound("emotional", species=self.ui.species, token=self.token, backend_url=self.ui.backend_url)
                time.sleep(1.5)

            self.ui.set_state("thinking")
            self.ui.set_ambient(f"Studying {os.path.basename(filepath)} like it owes us XP.")

            result = analyze_code(content, self.token)
            if isinstance(result, dict) and "error" in result and "Too many" in str(result.get("error")):
                self.cooldown_until = time.time() + 20
                self.ui.set_state("idle")
                self.ui.set_ambient("Too many roast requests at once. I am taking a short cooldown so we do not melt the mothership.", speak=True)
                play_sound("womp", species=self.ui.species, token=self.token, backend_url=self.ui.backend_url)
                self.ui.notify("Cooldown mode for 20s. Too many roast requests fired at once.")
                return
            roast_text = result.get("roast", "I have no words for this code.")
            xp = result.get("xp_awarded", 0)
            quality = result.get("code_quality_score", 50)

            if xp > 0:
                roast_text += f"\n\n[green]+{xp} XP earned![/green] Quality: {quality}/100"
            elif xp < 0:
                roast_text += f"\n\n[red]{xp} XP lost.[/red] Quality: {quality}/100"
            else:
                roast_text += f"\n\n[dim]No XP change.[/dim] Quality: {quality}/100"

            self.ui.set_roast(roast_text)
            self.ui.set_state("roasting")

            sound = result.get("memeSound", "none")
            if sound and sound != "none":
                play_sound(sound, species=self.ui.species, token=self.token, backend_url=self.ui.backend_url)

            spoken_summary = _shorten_for_voice(result.get("roast", ""))
            if spoken_summary and should_surface_speak("terminal") and should_emit_line(self.token, spoken_summary, "terminal", cooldown=25):
                speak_text(
                    spoken_summary,
                    species=self.ui.species,
                    token=self.token,
                    backend_url=self.ui.backend_url,
                    mode="roast",
                )

            updated_soul = add_xp(self.token, xp)
            if updated_soul:
                self.ui.update_soul(updated_soul)

            corrected = result.get("corrected_code")
            if corrected and corrected.strip() != content.strip():
                self.ui.queue_fix_prompt(filepath, corrected)
            else:
                self.ui.set_ambient("Roast complete. Your move, trainer.")

        except Exception as e:
            self.ui.set_roast(f"Roast engine failure: {e}")
            self.ui.set_state("idle")
            play_sound("womp", species=self.ui.species, token=self.token, backend_url=self.ui.backend_url)
            self.ui.set_ambient("That was a certified silly mistake moment. I played the emergency clown sound.", speak=True)
