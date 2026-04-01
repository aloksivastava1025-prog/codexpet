import os
import json
import random
import hashlib

from backend_client import fetch_pet_config
from sprites import BODIES, HAT_LINES, EYE_OPTIONS

STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"]
RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]
RARITY_WEIGHTS = {"common": 60, "uncommon": 25, "rare": 10, "epic": 4, "legendary": 1}
RARITY_FLOOR = {"common": 5, "uncommon": 15, "rare": 25, "epic": 35, "legendary": 50}


def get_souls_path():
    return os.path.expanduser("~/.roastpet_souls.json")


def _roll_rarity(rng):
    total = sum(RARITY_WEIGHTS.values())
    roll = rng.random() * total
    for rarity in RARITIES:
        roll -= RARITY_WEIGHTS[rarity]
        if roll < 0:
            return rarity
    return "common"


def _roll_stats(rng, rarity):
    floor = RARITY_FLOOR[rarity]
    peak = rng.choice(STAT_NAMES)
    dump = rng.choice(STAT_NAMES)
    while dump == peak:
        dump = rng.choice(STAT_NAMES)

    stats = {}
    for name in STAT_NAMES:
        if name == peak:
            stats[name] = min(100, floor + 50 + int(rng.random() * 30))
        elif name == dump:
            stats[name] = max(1, floor - 10 + int(rng.random() * 15))
        else:
            stats[name] = floor + int(rng.random() * 40)
    return stats


def _rank_from_rarity(rarity):
    return {
        "common": "Rookie Trainer",
        "uncommon": "Builder Class",
        "rare": "Maintainer Ace",
        "epic": "Elite Circuit",
        "legendary": "Champion Myth",
    }.get(rarity, "Rookie Trainer")


def _apply_remote_config(soul: dict, config: dict | None):
    if not config:
        soul.setdefault("trainer_rank", _rank_from_rarity(soul.get("rarity", "common")))
        return soul

    soul["species"] = config.get("species", soul["species"])
    soul["hat"] = config.get("hat", soul["hat"])
    soul["eye"] = config.get("eye", soul["eye"])
    soul.setdefault("trainer_rank", _rank_from_rarity(soul.get("rarity", "common")))
    return soul


def generate_soul(token: str, config: dict | None = None):
    seed_str = token + "friend-2026"
    seed_int = int(hashlib.sha256(seed_str.encode("utf-8")).hexdigest(), 16)
    rng = random.Random(seed_int)

    rarity = _roll_rarity(rng)
    species = rng.choice(list(BODIES.keys()))
    eye = rng.choice(EYE_OPTIONS)

    available_hats = list(HAT_LINES.keys())
    hat = "none" if rarity == "common" else rng.choice(available_hats)
    shiny = rng.random() < 0.01
    stats = _roll_stats(rng, rarity)

    soul = {
        "token": token,
        "rarity": rarity,
        "species": species,
        "eye": eye,
        "hat": hat,
        "shiny": shiny,
        "stats": stats,
        "level": 1,
        "xp": 0,
        "trainer_rank": _rank_from_rarity(rarity),
    }
    return _apply_remote_config(soul, config)


def load_or_hatch_soul(token: str, backend_url="http://localhost:3000"):
    path = get_souls_path()
    souls = {}
    config = fetch_pet_config(token, backend_url=backend_url)

    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                souls = json.load(f)
        except Exception:
            pass

    if token not in souls:
        souls[token] = generate_soul(token, config=config)
        save_souls(souls)
    else:
        souls[token] = _apply_remote_config(souls[token], config)
        save_souls(souls)

    return souls[token]


def save_souls(souls: dict):
    path = get_souls_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(souls, f, indent=2)


def add_xp(token: str, amount: int):
    souls = {}
    path = get_souls_path()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            souls = json.load(f)

    if token not in souls:
        return None

    soul = souls[token]
    soul["xp"] += amount

    while soul["xp"] >= 100:
        soul["level"] += 1
        soul["xp"] -= 100

    if soul["xp"] < 0:
        if soul["level"] > 1:
            soul["level"] -= 1
            soul["xp"] = 100 + soul["xp"]
        else:
            soul["xp"] = 0

    souls[token] = soul
    save_souls(souls)
    return soul
