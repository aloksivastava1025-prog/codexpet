import os
import random
import subprocess
import threading
import time

from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from audio import speak_text
from companion_memory import add_bond, get_session_memory, record_checkin, should_emit_line, should_surface_speak
from fixer import prompt_fix
from notifications import send_desktop_nudge
from pet_voice import get_boredom_breaker, get_focus_nudge, get_idle_line, get_intro_line
from sprites import BODIES, HAT_LINES

RARITY_STYLES = {
    "common": "dim white",
    "uncommon": "green",
    "rare": "cyan",
    "epic": "magenta",
    "legendary": "bold yellow",
}

RARITY_STARS = {
    "common": "*",
    "uncommon": "**",
    "rare": "***",
    "epic": "****",
    "legendary": "*****",
}


class PetRenderer:
    def __init__(self, species="duck", hat="none", eye="o", soul=None, token=None, backend_url="http://localhost:3000"):
        self.console = Console()
        self.species = species if species in BODIES else "duck"
        self.hat = hat if hat in HAT_LINES else "none"
        self.eye = eye
        self.frames = BODIES[self.species]
        self.soul = soul or {}
        self.token = token
        self.backend_url = backend_url

        self.frame_idx = 0
        self.state = "idle"
        self.roast_text = ""
        self.ambient_text = "Your pet is awake and looking for something dramatic to do."
        self.running = False
        self.fix_queue = []
        self.last_spoken_at = 0.0
        self.chatter_thread = None
        self.companion_thread = None
        self.stdin_available = True
        self.last_plain_snapshot = ""

    def set_state(self, state: str):
        self.state = state

    def set_roast(self, text: str):
        self.roast_text = text

    def set_ambient(self, text: str, speak: bool = False):
        self.ambient_text = text
        if speak:
            self.say_text(text)

    def notify(self, text: str):
        send_desktop_nudge(f"RoastPet ({self.species.capitalize()})", text[:180])

    def say_text(self, text: str):
        now = time.time()
        if now - self.last_spoken_at < 4:
            return
        if not should_surface_speak("terminal"):
            return
        if not should_emit_line(self.token or "", text, "terminal"):
            return
        self.last_spoken_at = now
        speak_text(text, species=self.species, token=self.token, backend_url=self.backend_url)

    def queue_fix_prompt(self, filepath: str, code: str):
        self.fix_queue.append((filepath, code))

    def update_soul(self, soul: dict):
        self.soul = soul

    def _git_dirty_count(self):
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True,
                text=True,
                cwd=os.getcwd(),
                timeout=4,
            )
            if result.returncode != 0:
                return 0
            return len([line for line in result.stdout.splitlines() if line.strip()])
        except Exception:
            return 0

    def _render_current_sprite(self):
        frame_lines = self.frames[self.frame_idx % len(self.frames)]
        body = [line.replace("{E}", self.eye) for line in frame_lines]

        if self.hat != "none" and not body[0].strip():
            body[0] = HAT_LINES[self.hat]

        if not body[0].strip() and all(not f[0].strip() for f in self.frames):
            body = body[1:]

        return "\n".join(body)

    def _build_xp_bar(self):
        xp = self.soul.get("xp", 0)
        level = self.soul.get("level", 1)
        filled = int(xp / 100 * 20)
        empty = 20 - filled
        bar = f"[green]{'#' * filled}[/green][dim]{'-' * empty}[/dim]"
        return f"Lv.{level}  {bar}  {xp}/100 XP"

    def _build_stats_table(self):
        stats = self.soul.get("stats", {})
        if not stats:
            return Text("No stats yet...", style="dim")

        table = Table(show_header=False, box=None, padding=(0, 1))
        table.add_column("Stat", style="bold cyan", width=12)
        table.add_column("Value", width=6)
        table.add_column("Bar", width=16)

        for name, value in stats.items():
            bar_filled = int(value / 100 * 12)
            bar_empty = 12 - bar_filled
            bar_str = f"[cyan]{'=' * bar_filled}[/cyan][dim]{'.' * bar_empty}[/dim]"
            table.add_row(name, str(value), bar_str)

        return table

    def _build_id_card(self):
        rarity = self.soul.get("rarity", "common")
        shiny = self.soul.get("shiny", False)
        style = RARITY_STYLES.get(rarity, "white")
        stars = RARITY_STARS.get(rarity, "*")
        trainer_rank = self.soul.get("trainer_rank", "Rookie Trainer")

        content = Text()
        content.append(f"{stars}\n", style=style)
        content.append("Rank: ", style="dim")
        content.append(f"{trainer_rank}\n", style="bold yellow")
        content.append("Rarity: ", style="dim")
        content.append(f"{rarity.upper()}\n", style=style)
        content.append(f"{self._build_xp_bar()}\n")

        return Panel(
            content,
            title=f"{'SHINY ' if shiny else ''}{self.species.upper()}",
            border_style="bold yellow" if shiny else style,
            width=40,
        )

    def _build_message_panel(self):
        if self.state == "thinking":
            body = "Scanning the code realm for sins, shortcuts, and suspicious little goblins..."
            style = "cyan"
            title = "Thinking"
        elif self.state == "roasting":
            body = self.roast_text or "Roast chamber warming up."
            style = "red"
            title = "Roast"
        else:
            body = self.ambient_text
            style = "green"
            title = "Companion Chatter"

        text = Text.from_markup(body) if "[" in body else Text(body)
        return Panel(text, title=title, border_style=style, padding=(1, 2))

    def _generate_layout(self):
        if self.state == "thinking":
            self.frame_idx = (self.frame_idx + 1) % len(self.frames)
        elif self.state == "roasting":
            self.frame_idx = 0
        else:
            self.frame_idx = (self.frame_idx + 1) % len(self.frames)

        shiny = self.soul.get("shiny", False)
        sprite_style = "bold yellow" if shiny else "bold cyan"
        title = f"RoastPet ({self.species.capitalize()})"
        if self.hat != "none":
            title += f" + {self.hat.capitalize()}"

        pet_panel = Panel(
            Text(self._render_current_sprite(), style=sprite_style, justify="center"),
            title=title,
            border_style="bold yellow" if shiny else "cyan",
        )

        left = Layout()
        left.split_column(
            Layout(pet_panel, name="sprite", ratio=2),
            Layout(self._build_id_card(), name="card", ratio=2),
        )

        right = Layout()
        right.split_column(
            Layout(self._build_message_panel(), name="speech", ratio=2),
            Layout(Panel(self._build_stats_table(), title="Battle Stats", border_style="cyan"), name="stats", ratio=2),
        )

        main = Layout()
        main.split_row(Layout(left, ratio=1), Layout(right, ratio=2))
        return main

    def _chatter_loop(self):
        self.set_ambient(get_intro_line(self.species), speak=True)
        while self.running:
            time.sleep(random.randint(24, 45))
            if not self.running:
                break
            if self.state != "idle" or self.fix_queue:
                continue
            line = get_idle_line(self.species, self.soul.get("level", 1))
            self.set_ambient(line, speak=True)

    def _companion_loop(self):
        while self.running:
            time.sleep(random.randint(55, 90))
            if not self.running:
                break
            if self.state != "idle" or self.fix_queue:
                continue
            dirty = self._git_dirty_count()
            session = get_session_memory(self.token or "")
            bond = int(session.get("bond", 0))
            message = get_focus_nudge(self.species, dirty) if dirty else get_boredom_breaker(self.species, bond)
            self.set_ambient(message, speak=True)
            self.notify(message)
            record_checkin(self.token or "", message)

    def start_idle_animation(self):
        self.running = True
        if self.chatter_thread is None:
            self.chatter_thread = threading.Thread(target=self._chatter_loop, daemon=True)
            self.chatter_thread.start()
        if self.companion_thread is None:
            self.companion_thread = threading.Thread(target=self._companion_loop, daemon=True)
            self.companion_thread.start()

    def render_loop(self):
        with Live(self._generate_layout(), refresh_per_second=4, screen=False) as live:
            while self.running:
                live.update(self._generate_layout())
                time.sleep(0.25)

                if self.fix_queue:
                    filepath, code = self.fix_queue.pop(0)
                    try:
                        live.stop()
                    except OSError:
                        pass

                    self.console.print(
                        f"\n[bold yellow]RoastPet ({self.species.capitalize()}) found an auto-fix for {os.path.basename(filepath)}.[/bold yellow]"
                    )
                    self.console.print("[dim]Apply the corrected code? (y/N)[/dim]")
                    self.say_text("Trainer, I have a fix ready. Please choose yes or no.")

                    if not self.stdin_available:
                        ans = "n"
                    else:
                        try:
                            ans = input(">> ").strip().lower()
                        except EOFError:
                            self.stdin_available = False
                            ans = "n"
                    if ans == "y":
                        prompt_fix(filepath, code)
                        self.console.print("[bold green]Fixed. Your pet looks smug about it.[/bold green]")
                        self.set_ambient("Victory. We patched the code and preserved the timeline.", speak=True)
                        add_bond(self.token or "", 2)
                    else:
                        self.console.print("[dim]Ignored. The pet will remember this.[/dim]")
                        self.set_ambient("Very well. We keep the chaos for now.", speak=True)

                    self.state = "idle"
                    self.roast_text = ""
                    try:
                        live.start()
                    except OSError:
                        pass

    def render_plain_loop(self):
        self.console.print("[bold cyan]Plain terminal mode enabled so you can actually watch the pet here.[/bold cyan]")
        while self.running:
            snapshot = self._build_plain_snapshot()
            if snapshot != self.last_plain_snapshot:
                self.console.clear()
                self.console.print(snapshot)
                self.last_plain_snapshot = snapshot
            time.sleep(1.0)

            if self.fix_queue:
                filepath, code = self.fix_queue.pop(0)
                self.console.print(f"\n[bold yellow]Fix ready for {os.path.basename(filepath)}[/bold yellow]")
                self.console.print("[dim]Apply the corrected code? (y/N)[/dim]")
                self.say_text("Trainer, I have a fix ready. Please choose yes or no.")
                if not self.stdin_available:
                    ans = "n"
                else:
                    try:
                        ans = input(">> ").strip().lower()
                    except EOFError:
                        self.stdin_available = False
                        ans = "n"
                if ans == "y":
                    prompt_fix(filepath, code)
                    self.console.print("[bold green]Fixed. Your pet looks smug about it.[/bold green]")
                    self.set_ambient("Victory. We patched the code and preserved the timeline.", speak=True)
                    add_bond(self.token or "", 2)
                else:
                    self.console.print("[dim]Ignored. The pet will remember this.[/dim]")
                    self.set_ambient("Very well. We keep the chaos for now.", speak=True)
                self.state = "idle"
                self.roast_text = ""

    def _build_plain_snapshot(self):
        rarity = self.soul.get("rarity", "common").upper()
        rank = self.soul.get("trainer_rank", "Rookie Trainer")
        header = [
            f"RoastPet | {self.species.capitalize()} + {self.hat.capitalize()}",
            f"State: {self.state}",
            f"Rank: {rank}",
            f"Rarity: {rarity}",
            self._build_xp_bar(),
            "",
            self._render_current_sprite(),
            "",
            f"Ambient: {self.ambient_text}",
        ]
        if self.state == "roasting" and self.roast_text:
            roast_line = " ".join(self.roast_text.split())
            header.extend(["", f"Roast: {roast_line[:240]}"])
        return "\n".join(header)

    def stop(self):
        self.running = False
