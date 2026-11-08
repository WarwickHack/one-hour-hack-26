
import random

ADJECTIVES = [
    # Bedtime and magical
    "sleepy", "dreamy", "magical", "mysterious",
    "sparkly", "glowing", "peaceful", "enchanted",
    "cosmic", "twinkling",

    # Funny and chaotic
    "chaotic", "confused", "ridiculous", "wobbly",
    "fluffy", "grumpy", "silly", "tiny",
    "enormous", "dramatic",

    # Hackathon-inspired
    "buggy", "broken", "legendary", "unstable",
    "unexpected", "digital", "virtual", "glitchy",
    "overloaded", "sleep-deprived",

    # Atmospheric
    "lonely", "curious", "gentle", "ancient",
    "secret", "invisible", "distant", "shimmering",
    "whispering", "mysterious"
]


def get_random_adjective(number=1):
    """Generate random adjectives."""

    if number < 0:
        raise ValueError("Number cannot be negative")

    if number == 1:
        return random.choice(ADJECTIVES)

    return random.choices(ADJECTIVES, k=number)
