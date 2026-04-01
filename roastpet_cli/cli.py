# -*- coding: utf-8 -*-
import argparse
import sys
import os
from watchdog.observers import Observer
from watcher import FileChangeHandler
from pet_ui import PetRenderer
from rpg_engine import load_or_hatch_soul
from companion_memory import touch_session
from instance_guard import claim_single_instance, release_instance
from pet_voice import get_intro_line
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

RARITY_STYLES = {
    "common": "dim white",
    "uncommon": "green",
    "rare": "cyan",
    "epic": "magenta",
    "legendary": "bold yellow",
}


def prepare_env():
    load_dotenv()


def print_hatch_screen(soul):
    """Display a beautiful hatching screen when a pet is first generated."""
    rarity = soul.get("rarity", "common")
    species = soul.get("species", "unknown")
    shiny = soul.get("shiny", False)
    hat = soul.get("hat", "none")
    eye_char = soul.get("eye", "o")
    style = RARITY_STYLES.get(rarity, "white")

    console.print()

    # Build markup lines individually to avoid backslash-in-fstring issues
    lines = []
    if shiny:
        lines.append("[bold yellow]SHINY VARIANT[/bold yellow]")
        lines.append("")
    lines.append("[{s}]A wild [bold]{sp}[/bold] has appeared![/{s}]".format(s=style, sp=species.upper()))
    lines.append("")
    lines.append("Rarity: [{s}]{r}[/{s}]".format(s=style, r=rarity.upper()))
    lines.append("Hat: [cyan]{h}[/cyan]".format(h=hat.capitalize()))
    lines.append("Eye: [cyan]{e}[/cyan]".format(e=eye_char))
    lines.append("")
    lines.append("[dim]Stats rolled from your unique token seed.[/dim]")
    lines.append("[dim]Your pet is saved to ~/.roastpet_souls.json[/dim]")

    markup_str = "\n".join(lines)

    console.print(Panel(
        Text.from_markup(markup_str),
        title="Hatching Your RoastPet...",
        border_style="bold yellow" if shiny else style,
        padding=(1, 3),
    ))

    # Print stats
    stats = soul.get("stats", {})
    if stats:
        stat_lines = []
        for name, value in stats.items():
            bar_filled = int(value / 100 * 20)
            bar_empty = 20 - bar_filled
            bar = "{f}{e}".format(f=">" * bar_filled, e="." * bar_empty)
            stat_lines.append("  {n:12s} {v:3d}  {b}".format(n=name, v=value, b=bar))

        console.print(Panel(
            "\n".join(stat_lines),
            title="Base Stats",
            border_style="cyan",
        ))
    console.print()


def main():
    parser = argparse.ArgumentParser(description="RoastPet CLI: Your connected AI coding buddy with RPG leveling.")
    parser.add_argument("--token", type=str, help="Your unique sync token from the web dashboard", required=True)
    parser.add_argument("--dir", type=str, default=".", help="Directory to watch for code changes")
    parser.add_argument("--backend-url", type=str, default="http://localhost:3000", help="Backend URL for RoastPet APIs")
    parser.add_argument("--plain", action="store_true", help="Use plain terminal mode instead of Rich live UI")

    args = parser.parse_args()

    console.print()
    console.print("[bold cyan]Connecting RoastPet using token [yellow]{t}[/yellow]...[/bold cyan]".format(t=args.token))
    console.print("[dim]Watching: {d}[/dim]".format(d=os.path.abspath(args.dir)))
    console.print()

    lock_path = claim_single_instance("cli", args.token)

    # Load or hatch the persistent soul
    soul = load_or_hatch_soul(args.token, backend_url=args.backend_url)
    touch_session(args.token, soul["species"])

    # Check if this is first hatch (level 1, xp 0)
    if soul.get("level", 1) == 1 and soul.get("xp", 0) == 0:
        print_hatch_screen(soul)
    else:
        rarity = soul.get("rarity", "common")
        style = RARITY_STYLES.get(rarity, "white")
        sp = soul["species"].capitalize()
        lv = soul["level"]
        xp = soul["xp"]
        console.print("[{s}]Welcome back, {sp}! (Lv.{lv}, {xp}/100 XP)[/{s}]".format(s=style, sp=sp, lv=lv, xp=xp))
        console.print()
    console.print("[bold magenta]{msg}[/bold magenta]".format(msg=get_intro_line(soul["species"])))
    console.print("[dim]Trainer rank: {rank}[/dim]".format(rank=soul.get("trainer_rank", "Rookie Trainer")))
    console.print()

    # Create the renderer with the soul data
    ui = PetRenderer(
        species=soul["species"],
        hat=soul["hat"],
        eye=soul["eye"],
        soul=soul,
        token=args.token,
        backend_url=args.backend_url,
    )
    ui.start_idle_animation()

    # Initialize Watchdog
    event_handler = FileChangeHandler(token=args.token, ui=ui)
    observer = Observer()
    observer.schedule(event_handler, path=os.path.abspath(args.dir), recursive=True)
    observer.start()

    console.print("[dim]RoastPet is now watching your code, talking to you, and trying very hard to keep boredom away. Save a file to get roasted! Press Ctrl+C to quit.[/dim]")
    console.print()

    use_plain = args.plain or (not sys.stdout.isatty())

    try:
        if use_plain:
            ui.render_plain_loop()
        else:
            ui.render_loop()
    except KeyboardInterrupt:
        console.print()
        console.print("[bold red]RoastPet has been put to sleep. See you next time![/bold red]")
        observer.stop()
        ui.stop()
    finally:
        release_instance(lock_path)
    observer.join()


if __name__ == "__main__":
    prepare_env()
    main()
