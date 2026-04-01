import time
import os
import random
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.layout import Layout
from rich.text import Text
from rich.table import Table
from rich.progress_bar import ProgressBar
from rich.columns import Columns
from sprites import BODIES, HAT_LINES, EYE_OPTIONS
from fixer import prompt_fix

RARITY_STYLES = {
    "common": "dim white",
    "uncommon": "green",
    "rare": "cyan",
    "epic": "magenta",
    "legendary": "bold yellow",
}

RARITY_STARS = {
    "common": "★",
    "uncommon": "★★",
    "rare": "★★★",
    "epic": "★★★★",
    "legendary": "★★★★★",
}

class PetRenderer:
    def __init__(self, species="duck", hat="none", eye="o", soul=None):
        self.console = Console()
        self.species = species if species in BODIES else "duck"
        self.hat = hat if hat in HAT_LINES else "none"
        self.eye = eye
        self.frames = BODIES[self.species]
        self.soul = soul or {}
        
        self.frame_idx = 0
        self.state = "idle"  # idle, thinking, roasting
        self.roast_text = ""
        self.running = False
        
        self.fix_queue = []  # Queue of tuples: (filepath, corrected_code)
        self.layout = Layout()

    def set_state(self, state: str):
        self.state = state

    def set_roast(self, text: str):
        self.roast_text = text

    def queue_fix_prompt(self, filepath: str, code: str):
        self.fix_queue.append((filepath, code))

    def update_soul(self, soul: dict):
        self.soul = soul

    def _render_current_sprite(self):
        frame_lines = self.frames[self.frame_idx % len(self.frames)]
        
        # Replace {E} with eyes
        body = [line.replace('{E}', self.eye) for line in frame_lines]
        
        # Handle hat slot on line 0
        if self.hat != 'none' and not body[0].strip():
            body[0] = HAT_LINES[self.hat]
            
        # Shift out blank hat slot (if line 0 is blank on ALL frames)
        if not body[0].strip() and all(not f[0].strip() for f in self.frames):
            body = body[1:]
            
        return "\n".join(body)

    def _build_xp_bar(self):
        """Build a visual XP progress bar string."""
        xp = self.soul.get("xp", 0)
        level = self.soul.get("level", 1)
        filled = int(xp / 100 * 20)
        empty = 20 - filled
        bar = f"[green]{'█' * filled}[/green][dim]{'░' * empty}[/dim]"
        return f"Lv.{level}  {bar}  {xp}/100 XP"

    def _build_stats_table(self):
        """Build a Rich table showing the pet's RPG stats."""
        stats = self.soul.get("stats", {})
        if not stats:
            return Text("No stats yet...", style="dim")
        
        table = Table(show_header=False, box=None, padding=(0, 1))
        table.add_column("Stat", style="bold cyan", width=12)
        table.add_column("Value", width=6)
        table.add_column("Bar", width=20)
        
        for name, value in stats.items():
            bar_filled = int(value / 100 * 15)
            bar_empty = 15 - bar_filled
            bar_str = f"[cyan]{'▓' * bar_filled}[/cyan][dim]{'░' * bar_empty}[/dim]"
            table.add_row(name, str(value), bar_str)
        
        return table

    def _build_id_card(self):
        """Build the Buddy ID Card panel."""
        rarity = self.soul.get("rarity", "common")
        shiny = self.soul.get("shiny", False)
        style = RARITY_STYLES.get(rarity, "white")
        stars = RARITY_STARS.get(rarity, "★")
        
        title_text = f"{'✦ SHINY ✦ ' if shiny else ''}{self.species.upper()}"
        
        card_content = Text()
        card_content.append(f"{stars}\n", style=style)
        card_content.append(f"Rarity: ", style="dim")
        card_content.append(f"{rarity.upper()}\n", style=style)
        card_content.append(f"{self._build_xp_bar()}\n\n")

        border_style = "bold yellow" if shiny else style
        
        card_panel = Panel(
            card_content,
            title=title_text,
            border_style=border_style,
            width=40,
        )
        return card_panel

    def _generate_layout(self):
        # State timing offsets for animation
        if self.state == "thinking":
            self.frame_idx = (self.frame_idx + 1) % len(self.frames)
        elif self.state == "roasting":
            self.frame_idx = 0  # Look directly at the user
        else:
            if int(time.time() * 2) % 2 == 0:
                self.frame_idx = 0
            else:
                self.frame_idx = (self.frame_idx + 1) % len(self.frames)

        sprite_str = self._render_current_sprite()
        
        # Shiny pets get rainbow styling
        shiny = self.soul.get("shiny", False)
        sprite_style = "bold yellow on black" if shiny else "bold cyan"
        
        # Pet title
        title = f"RoastPet ({self.species.capitalize()})"
        if self.hat != 'none':
            title += f" w/ {self.hat.capitalize()}"

        pet_panel = Panel(
            Text(sprite_str, style=sprite_style, justify="center"),
            title=title,
            border_style="bold yellow" if shiny else "cyan",
        )

        # Build the main layout
        main = Layout()
        
        # Left column: Pet sprite + ID card
        left_col = Layout()
        left_col.split_column(
            Layout(pet_panel, name="sprite", ratio=2),
            Layout(self._build_id_card(), name="card", ratio=2),
        )
        
        if self.state in ["roasting", "thinking"]:
            bubble_text = "Hmm... analyzing that garbage code..." if self.state == "thinking" else self.roast_text
            msg_panel = Panel(
                Text.from_markup(bubble_text) if "[" in bubble_text else Text(bubble_text, style="bold red"),
                title="💬 Says:",
                border_style="red",
                padding=(1, 2),
            )
            
            # Right column: Message + Stats
            right_col = Layout()
            right_col.split_column(
                Layout(msg_panel, name="speech", ratio=2),
                Layout(Panel(self._build_stats_table(), title="⚔️ Stats", border_style="cyan"), name="stats", ratio=2),
            )
            
            main.split_row(
                Layout(left_col, ratio=1),
                Layout(right_col, ratio=2),
            )
            return main
        
        # Idle: pet + stats side by side
        main.split_row(
            Layout(left_col, ratio=1),
            Layout(Panel(self._build_stats_table(), title="⚔️ Stats", border_style="cyan"), ratio=1),
        )
        return main

    def start_idle_animation(self):
        self.running = True

    def render_loop(self):
        with Live(self._generate_layout(), refresh_per_second=4, screen=False) as live:
            while self.running:
                live.update(self._generate_layout())
                time.sleep(0.25)
                
                if self.fix_queue:
                    filepath, code = self.fix_queue.pop(0)
                    
                    # Pause Live context to interact safely
                    live.stop()
                    
                    self.console.print(f"\n[bold yellow]🔧 RoastPet ({self.species.capitalize()}) offers an auto-fix for {os.path.basename(filepath)}![/bold yellow]")
                    self.console.print("[dim]Do you want to apply the corrected code? (y/N)[/dim]")
                    
                    ans = input(">> ").strip().lower()
                    if ans == 'y':
                        prompt_fix(filepath, code)
                        self.console.print("[bold green]✅ Fixed! Don't mess up again.[/bold green]")
                    else:
                        self.console.print("[dim]Ignoring fix... Your funeral. 💀[/dim]")
                        
                    self.state = "idle"
                    self.roast_text = ""
                    
                    # Restart Live context
                    live.start()

    def stop(self):
        self.running = False
