import os
import json
import random
import hashlib
from sprites import BODIES, HAT_LINES, EYE_OPTIONS

STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK']
RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
RARITY_WEIGHTS = {'common': 60, 'uncommon': 25, 'rare': 10, 'epic': 4, 'legendary': 1}
RARITY_FLOOR = {'common': 5, 'uncommon': 15, 'rare': 25, 'epic': 35, 'legendary': 50}

def get_souls_path():
    return os.path.expanduser("~/.roastpet_souls.json")

def _roll_rarity(rng):
    total = sum(RARITY_WEIGHTS.values())
    roll = rng.random() * total
    for rarity in RARITIES:
        roll -= RARITY_WEIGHTS[rarity]
        if roll < 0:
            return rarity
    return 'common'

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

def generate_soul(token: str):
    # Seed precisely using the token so they get a deterministic pet based on their web session
    seed_str = token + "friend-2026"
    seed_int = int(hashlib.sha256(seed_str.encode('utf-8')).hexdigest(), 16)
    rng = random.Random(seed_int)
    
    rarity = _roll_rarity(rng)
    species = rng.choice(list(BODIES.keys()))
    eye = rng.choice(EYE_OPTIONS)
    
    # Common pets do not get hats
    available_hats = list(HAT_LINES.keys())
    hat = 'none' if rarity == 'common' else rng.choice(available_hats)
    
    shiny = rng.random() < 0.01
    stats = _roll_stats(rng, rarity)
    
    return {
        "token": token,
        "rarity": rarity,
        "species": species,
        "eye": eye,
        "hat": hat,
        "shiny": shiny,
        "stats": stats,
        "level": 1,
        "xp": 0
    }

def load_or_hatch_soul(token: str):
    path = get_souls_path()
    souls = {}
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                souls = json.load(f)
        except Exception:
            pass
            
    if token not in souls:
        # Hatch a new soul!
        souls[token] = generate_soul(token)
        save_souls(souls)
        
    return souls[token]

def save_souls(souls: dict):
    path = get_souls_path()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(souls, f, indent=2)

def add_xp(token: str, amount: int):
    souls = {}
    path = get_souls_path()
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            souls = json.load(f)
            
    if token not in souls: return None
    
    soul = souls[token]
    soul['xp'] += amount
    
    # Level up logic: 100 XP per level
    while soul['xp'] >= 100:
        soul['level'] += 1
        soul['xp'] -= 100
        
    # Can't drop below level 1, 0 XP
    if soul['xp'] < 0:
        if soul['level'] > 1:
            soul['level'] -= 1
            soul['xp'] = 100 + soul['xp']
        else:
            soul['xp'] = 0
            
    souls[token] = soul
    save_souls(souls)
    return soul
