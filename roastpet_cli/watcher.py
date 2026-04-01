from watchdog.events import FileSystemEventHandler
import time
import os
import re
from ai_client import analyze_code
from audio import play_sound
from fixer import prompt_fix
from rpg_engine import add_xp
import threading

# Trigger pattern: if the user writes a comment like // @roastpet or /* /buddy */
BUDDY_TRIGGER_RE = re.compile(r'(?://|#)\s*@roastpet\b|/\*\s*/buddy\s*\*/|#\s*/buddy\b', re.IGNORECASE)

class FileChangeHandler(FileSystemEventHandler):
    def __init__(self, token: str, ui):
        super().__init__()
        self.token = token
        self.ui = ui
        self.last_modified = {}
        self.debounce_seconds = 2.0
    
    def on_modified(self, event):
        if event.is_directory:
            return
            
        filepath = event.src_path
        
        # Only watch actual code files
        valid_exts = {".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".cpp", ".java", ".go", ".rs"}
        ext = os.path.splitext(filepath)[1]
        
        if ext not in valid_exts:
            return
            
        current_time = time.time()
        last_time = self.last_modified.get(filepath, 0)
        
        if current_time - last_time < self.debounce_seconds:
            return
            
        self.last_modified[filepath] = current_time
        
        # Run analysis in background thread so watchdog doesn't block
        threading.Thread(target=self._analyze_and_react, args=(filepath,), daemon=True).start()

    def _check_buddy_trigger(self, content: str) -> bool:
        """Check if the code contains a /buddy or @roastpet summon trigger."""
        return bool(BUDDY_TRIGGER_RE.search(content))

    def _analyze_and_react(self, filepath: str):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Avoid sending empty or tiny files
            if len(content.strip()) < 10:
                return

            # Check for buddy trigger — special "summon" easteregg
            if self._check_buddy_trigger(content):
                self.ui.set_roast("✨ You summoned me! I sense great potential in this file... or maybe not. Let me take a closer look!")
                self.ui.set_state("roasting")
                play_sound("emotional")
                # Still analyze, but the user gets a warm welcome first
                time.sleep(2)
                
            self.ui.set_state("thinking")
            
            # Call backend
            result = analyze_code(content, self.token)
            
            # Show roast
            roast_text = result.get("roast", "I have no words for this code.")
            xp = result.get("xp_awarded", 0)
            quality = result.get("code_quality_score", 50)
            
            # Append XP info to the roast
            if xp > 0:
                roast_text += f"\n\n[green]▲ +{xp} XP earned![/green] (Quality: {quality}/100)"
            elif xp < 0:
                roast_text += f"\n\n[red]▼ {xp} XP lost![/red] (Quality: {quality}/100)"
            else:
                roast_text += f"\n\n[dim]~ No XP change.[/dim] (Quality: {quality}/100)"

            self.ui.set_roast(roast_text)
            self.ui.set_state("roasting")
            
            # Play sound
            sound = result.get("memeSound")
            if sound and sound != "none":
                # play_sound(sound)  # Disabled due to corrupted MP3 files

            # Apply XP to persistent soul
            updated_soul = add_xp(self.token, xp)
            if updated_soul:
                self.ui.update_soul(updated_soul)
                
            # Offer fix
            corrected = result.get("corrected_code")
            if corrected and corrected.strip() != content.strip():
                self.ui.queue_fix_prompt(filepath, corrected)
                
        except Exception as e:
            self.ui.set_roast(f"Roast engine failure: {e}")
            self.ui.set_state("idle")
