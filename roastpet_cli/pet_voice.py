import random

VOICE_PROFILES = {
    "duck": {
        "rate": 2,
        "intro": "quack-powered chaos gremlin",
        "idle": [
            "Quack report. We should touch grass, but linting first.",
            "I am emotionally available for one bug and three snacks.",
            "Trainer, open a file. I crave dramatic code review.",
        ],
    },
    "rabbit": {
        "rate": 3,
        "intro": "speedy panic wizard",
        "idle": [
            "Hop to it, boss. Momentum beats overthinking.",
            "I can feel a side quest forming in this codebase.",
            "Tiny paws. Massive ambition. Let's ship something.",
        ],
    },
    "snail": {
        "rate": -2,
        "intro": "slow-motion philosopher",
        "idle": [
            "We move carefully. That is called strategy, not laziness.",
            "A deliberate refactor is still a refactor, champion.",
            "I brought patience and one unit of emotional support slime.",
        ],
    },
    "blob": {
        "rate": 0,
        "intro": "squishy hype orb",
        "idle": [
            "I contain multitudes and at least one suspicious workaround.",
            "Blob wisdom says small commits, big victories.",
            "I am jiggling with confidence on your behalf.",
        ],
    },
    "cat": {
        "rate": 1,
        "intro": "judgmental debugger",
        "idle": [
            "I knocked your fragile assumptions off the table.",
            "This code smells fixable. I respect that.",
            "Purr if stable. Hiss if race condition.",
        ],
    },
    "penguin": {
        "rate": -1,
        "intro": "cool-headed waddler",
        "idle": [
            "Slide into the next task. Gracefully. Or at speed.",
            "Your repo is chilly, but our confidence is warm.",
            "I waddle so your roadmap may soar.",
        ],
    },
    "ghost": {
        "rate": -3,
        "intro": "haunted code reviewer",
        "idle": [
            "Boo. I sensed an unhandled edge case in the walls.",
            "Your backlog is haunted. Lucky for you, so am I.",
            "I drift, I judge, I keep morale alive.",
        ],
    },
    "mushroom": {
        "rate": 1,
        "intro": "forest support mage",
        "idle": [
            "A calm commit a day keeps the merge monster away.",
            "I am here to keep the vibes fertile and the bugs afraid.",
            "Let's grow one clean feature before the next chaos storm.",
        ],
    },
    "owl": {
        "rate": -1,
        "intro": "midnight tactician",
        "idle": [
            "Observe, plan, commit. We are nocturnal professionals.",
            "Your architecture has secrets. I enjoy secrets.",
            "Wise move. Another. I can wait.",
        ],
    },
    "turtle": {
        "rate": -2,
        "intro": "tanky maintainer",
        "idle": [
            "Slow and stable is still elite if prod survives.",
            "Your shell is documentation. Strengthen it.",
            "Let's make the next change boring in the best way.",
        ],
    },
    "axolotl": {
        "rate": 1,
        "intro": "regen cutie with menace",
        "idle": [
            "We recover from mistakes adorably and repeatedly.",
            "If the sprint hurt you, I prescribe one silly win.",
            "Regenerate confidence. Then refactor.",
        ],
    },
    "robot": {
        "rate": -1,
        "intro": "battle compiler",
        "idle": [
            "System notice. Your potential remains above recommended levels.",
            "Beep. I detected undercelebrated progress.",
            "Prepare next maneuver. Confidence protocol enabled.",
        ],
    },
    "dragon": {
        "rate": -3,
        "intro": "final-evolution menace",
        "idle": [
            "I smell technical debt and lightly toasted courage.",
            "Another bug dares enter our territory. Adorable.",
            "Raise your chin, trainer. We breathe fire at flaky code.",
        ],
    },
    "octopus": {
        "rate": 2,
        "intro": "multitask trickster",
        "idle": [
            "Eight arms, zero excuses. Let's juggle another feature.",
            "I can hold scope, snacks, and optimism at the same time.",
            "Tentacle memo. The next commit should sparkle.",
        ],
    },
    "capybara": {
        "rate": -2,
        "intro": "chill boss creature",
        "idle": [
            "Remain unbothered. Ship beautifully anyway.",
            "You, me, and a suspiciously peaceful deploy window.",
            "No panic. Only vibes and incremental improvement.",
        ],
    },
    "chonk": {
        "rate": 0,
        "intro": "unstoppable cuddle tank",
        "idle": [
            "I am large with confidence and impossible to ignore.",
            "Let's body-check boredom with one mighty commit.",
            "Soft exterior. Ruthless code standards.",
        ],
    },
}

MEME_SPEECH = {
    "bruh": "Bruh moment detected.",
    "womp": "Womp womp. That code took fall damage.",
    "emotional": "Emotional damage. But we recover.",
    "none": "No meme. Pure excellence.",
}


def get_voice_profile(species: str) -> dict:
    return VOICE_PROFILES.get(species, {
        "rate": 0,
        "intro": "friendly gremlin",
        "idle": [
            "I am here, awake, and ready to keep this session lively.",
            "We should do something brave and slightly responsible.",
        ],
    })


def get_idle_line(species: str, level: int = 1) -> str:
    profile = get_voice_profile(species)
    line = random.choice(profile["idle"])
    if level >= 5:
        return f"{line} Level {level} energy feels correct."
    return line


def get_intro_line(species: str) -> str:
    profile = get_voice_profile(species)
    return f"{species.capitalize()} online. Voice profile: {profile['intro']}."


def get_meme_line(sound_name: str, species: str) -> str:
    meme = MEME_SPEECH.get(sound_name, "Maximum silliness engaged.")
    return f"{species.capitalize()} says: {meme}"


def get_boredom_breaker(species: str, bond: int = 0) -> str:
    lines = [
        "Pick a tiny mission. We only need one clean win.",
        "You look under-stimulated. Want me to bully one TODO into submission?",
        "Let's do a two-minute cleanup quest before the boredom monster evolves.",
        "Trainer, choose one file. I will provide emotional backup and menace.",
    ]
    if bond >= 5:
        lines.append("We've done this enough times that I can say it clearly: you always recover momentum.")
    return random.choice(lines)


def get_focus_nudge(species: str, dirty_files: int = 0) -> str:
    if dirty_files > 0:
        return f"{species.capitalize()} noticed {dirty_files} uncommitted changes. Tiny checkpoint time?"
    return f"{species.capitalize()} is bored. Maybe inspect one flaky file before chaos wins."
