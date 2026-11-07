
import random

# Third-person singular, present-tense, intransitive verbs
VERBS = [
    "sleeps",
    "dances",
    "arrives",
    "laughs",
    "dreams",
    "runs",
    "falls",
    "smiles",
    "disappears",
    "wanders",
    "jumps",
    "swims",
    "crawls",
    "shines",
    "glows",
    "sparkles",
    "floats",
    "flies",
    "grows",
    "waits",
    "sings",
    "cries",
    "sneezes",
    "yawns",
    "awakens",
    "rests",
    "sits",
    "stands",
    "travels",
    "explores",
    "giggles",
    "trembles",
    "shivers",
    "stumbles",
    "spins",
    "dreams",
    "blooms",
    "fades",
    "echoes",
    "sparkles",
]

def get_random_verb(number):
    """Return the requested number of random intransitive verbs."""
    if number < 0:
        raise ValueError("Number cannot be negative")

    return random.choices(VERBS, k=number)