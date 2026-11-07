"""MC WHACK: every call to whack() becomes a rap verse, and then a live performance.

    python3 spit.py            # one verse, printed + verse.html player

What whack() controls:
  * how many words it returns  -> how many bars you get and the BPM
  * the order of the words     -> which words land on the end of each line (the rhymes)
  * the `whack` file it writes -> the most-repeated word in it becomes the HOOK
  * sponsor vs suffering words -> the mood (FLEXING or CRYING AT 3AM)
"""
import json
import re
import random
from collections import Counter
from pathlib import Path

from whack import WORDS, whack

# Every one of the 42 words belongs to a rhyme family, with some everyday rhymes to fall back on.
FAMILIES = {
    "ack": (["whack", "hack", "quack", "stack"], ["back", "track", "attack", "jack"]),
    "uck": (["duck"], ["stuck", "luck", "truck", "pluck"]),
    "oose": (["goose"], ["loose", "juice", "produce", "use"]),
    "onk": (["honk"], ["bonk", "plonk", "conk"]),
    "ug": (["bug"], ["plug", "shrug", "mug", "hug"]),
    "eature": (["feature"], ["creature", "teacher", "preacher"]),
    "ick": (["warwick"], ["quick", "slick", "trick", "brick"]),
    "iculous": (["oculus"], ["ridiculous", "meticulous"]),
    "ock": (["compsoc"], ["clock", "rock", "lock", "block"]),
    "artial": (["marshall"], ["partial", "martial"]),
    "ace": (["wace"], ["race", "face", "space", "place"]),
    "even": (["brevan"], ["seven", "heaven", "eleven"]),
    "oward": (["howard"], ["coward", "powered", "showered"]),
    "apital": (["capital"], ["hospital", "tropical", "habitual"]),
    "un": (["one"], ["done", "run", "fun", "won"]),
    "erg": (["bloomberg"], ["iceberg", "Nuremberg"]),
    "aft": (["netcraft"], ["daft", "laughed", "draft", "graft"]),
    "ident": (["incident"], ["confident", "accident", "president"]),
    "o": (["io", "overflow", "demo"], ["flow", "go", "show", "slow"]),
    "eeza": (["pizza"], ["Ibiza", "Mona Lisa", "visa"]),
    "offee": (["coffee"], ["toffee", "trophy"]),
    "eep": (["sleep"], ["deep", "keep", "cheap", "sheep"]),
    "oy": (["deploy"], ["destroy", "joy", "boy", "toy"]),
    "erge": (["merge"], ["urge", "surge", "verge", "purge"]),
    "ict": (["conflict"], ["convict", "strict", "predict"]),
    "it": (["commit"], ["quit", "lit", "split", "spit"]),
    "ush": (["push"], ["rush", "hush", "crush", "blush"]),
    "od": (["prod"], ["god", "nod", "odd", "squad"]),
    "ault": (["segfault"], ["default", "assault", "halt", "salt"]),
    "ull": (["null"], ["dull", "skull", "full", "pull"]),
    "ointer": (["pointer"], ["anointer", "disappointer"]),
    "olon": (["semicolon"], ["swollen", "stolen", "rollin'"]),
    "ubber": (["rubber"], ["lover", "cover", "brother"]),
    "itch": (["pitch"], ["glitch", "switch", "rich", "snitch"]),
    "ize": (["prize"], ["eyes", "rise", "size", "lies"]),
    "ight": (["midnight"], ["tonight", "fight", "light", "right"]),
    "ifi": (["wifi"], ["hi-fi", "sci-fi"]),
}
FAMILY_OF = {w: fam for fam, (members, _) in FAMILIES.items() for w in members}

SPONSORS = {"warwick", "oculus", "compsoc", "marshall", "wace", "brevan", "howard",
            "capital", "one", "bloomberg", "netcraft", "incident", "io", "prize"}
SUFFERING = {"bug", "sleep", "coffee", "conflict", "segfault", "null", "pointer", "stack",
             "overflow", "semicolon", "midnight", "wifi", "prod", "merge", "deploy"}

# Every line is exactly 12 syllables, one per 16th note, with the last one landing on the snare.
SYLLABLES_PER_BAR = 12
FLOW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]  # 16th note each syllable lands on

# How each whack() word reads as a noun phrase, so openers stay grammatical.
NOUN = {
    "whack": "a whack", "hack": "a hack", "duck": "a duck", "quack": "a quack",
    "goose": "a goose", "honk": "a honk", "bug": "a bug", "feature": "a feature",
    "warwick": "Warwick", "oculus": "Oculus", "compsoc": "CompSoc", "marshall": "Marshall",
    "wace": "Wace", "brevan": "Brevan", "howard": "Howard", "capital": "Capital",
    "one": "Capital One", "bloomberg": "Bloomberg", "netcraft": "Netcraft",
    "incident": "an incident", "io": "IO", "pizza": "cold pizza", "coffee": "coffee",
    "sleep": "no sleep", "deploy": "a deploy", "merge": "a merge", "conflict": "a conflict",
    "commit": "a commit", "push": "a push", "prod": "prod", "segfault": "a segfault",
    "null": "a null", "pointer": "a pointer", "stack": "the stack", "overflow": "an overflow",
    "semicolon": "a semicolon", "rubber": "rubber", "demo": "the demo", "pitch": "the pitch",
    "prize": "the prize", "midnight": "midnight", "wifi": "the wifi",
}

# First half of a bar: {n} is a whack() word as a noun phrase.
OPENERS = {
    "FLEXING": ["Shout out to {n},", "Rolling with {n},", "Big up {n},", "Flexing on {n},",
                "Pull up with {n},", "Bow down to {n},", "Got {n} on my chain,"],
    "CRYING AT 3AM": ["Blame it on {n},", "Woke up to {n},", "Crying over {n},",
                      "Nothing but {n},", "Got {n} on my mind,", "Haunted by {n},",
                      "Lost it to {n},"],
}

# Second half of a bar: hand-written, always ends on a rhyme. Keyed by rhyme family.
CLOSERS = {
    "ack": ["my code is out of whack", "I'm the king of the hack", "the duck just said quack",
            "it's overflowing the stack", "and I'm never looking back", "I'm back on track"],
    "uck": ["I'm talking to a rubber duck", "my build is stuck", "I'm out of luck"],
    "oose": ["I'm chased by a goose", "my code is running loose", "I'm running on juice"],
    "onk": ["the goose just went honk", "the server went bonk", "my laptop went plonk"],
    "ug": ["it's not a feature, it's a bug", "I just pulled the plug",
           "the judges gave a shrug", "more coffee in my mug"],
    "eature": ["that bug is a feature", "I'm a sleepless creature", "don't tell the teacher"],
    "ick": ["I'm coding at Warwick", "my code is looking slick", "I've got a new trick"],
    "iculous": ["they're watching through Oculus", "this bug is ridiculous",
                "my code is meticulous"],
    "ock": ["I'm hanging with CompSoc", "I'm racing the clock", "my code is solid rock"],
    "artial": ["the judges look at Marshall", "my tests only pass partial"],
    "ace": ["I'm sponsored by Wace", "I'm winning the race", "a smile on my face",
            "I'm lost in space"],
    "even": ["I'm hanging with Brevan", "it's quarter past seven", "this pizza is heaven"],
    "oward": ["shout out to Howard", "I'm caffeine powered", "I haven't showered"],
    "apital": ["I'm sponsored by Capital", "my all-nighters are habitual",
               "I'm headed to the hospital"],
    "un": ["shout out to Capital One", "I'm not having fun", "my code is never done",
           "the battle is won"],
    "erg": ["I'm trading at Bloomberg", "my code just hit an iceberg"],
    "aft": ["I'm scanning with Netcraft", "I'm shipping a first draft", "the judges just laughed"],
    "ident": ["I'm raising an incident", "I'm feeling so confident", "it wasn't an accident"],
    "o": ["it's logged on incident IO", "my stack's about to overflow", "I'm ready to demo",
          "the wifi is slow", "I'm ready to go"],
    "eeza": ["I'm eating cold pizza", "I'm flying to Ibiza"],
    "offee": ["I'm running on coffee", "I'm chewing on toffee", "we're taking the trophy"],
    "eep": ["I haven't had sleep", "the bugs run deep", "the pizza was cheap"],
    "oy": ["I'm ready to deploy", "it's bugs I destroy", "this hackathon's a joy"],
    "erge": ["I'm scared to merge", "I'm feeling the urge", "my code's on the verge"],
    "ict": ["I've got a merge conflict", "the linter is strict", "it's just what they predict"],
    "it": ["I'm making a commit", "I'm never gonna quit", "this demo is lit"],
    "ush": ["I'm ready to push", "I'm hiding in a bush", "the deadline's an ambush"],
    "od": ["I'm testing in prod", "the judges just nod", "I'm rolling with my squad",
           "I'm coding like a god"],
    "ault": ["I just hit a segfault", "and it's all my fault", "my code came to a halt"],
    "ull": ["the pointer is null", "my brain feels so dull", "the pizza box is full"],
    "ointer": ["I dereferenced a pointer", "I'm waving a laser pointer"],
    "olon": ["I forgot a semicolon", "my eyes are all swollen", "the bugs keep on rollin'"],
    "ubber": ["my duck is made of rubber", "debugging with my brother"],
    "itch": ["I'm practising my pitch", "I've hit another glitch", "I'm gonna get rich"],
    "ize": ["we're winning the prize", "bags under my eyes", "my code is full of lies"],
    "ight": ["I'm coding past midnight", "I'm up all night", "my screen is too bright"],
    "ifi": ["there's no wifi", "I'm lagging on the wifi", "I'm living in sci-fi"],
}
for _fam, _lines in CLOSERS.items():  # closers can end on words the family list didn't have
    _members, _fillers = FAMILIES[_fam]
    for _line in _lines:
        _last = _line.split()[-1].lower()
        if _last not in _members and _last not in _fillers:
            _fillers.append(_last)
RHYMES_OF = {fam: set(m) | set(f) for fam, (m, f) in FAMILIES.items()}
ADLIBS = ["yo,", "uh,", "yeah,", "skrrt,", "huh,", "ayy,"]
# Openers that use no list words, for when the budget runs dry.
PLAIN_OPENERS = ["Listen up,", "Here we go,", "Check it out,", "Yeah, you know,", "Turn it up,"]

SYL_OVERRIDES = {
    "io": 2, "oculus": 3, "warwick": 2, "wace": 1, "capital": 3, "bloomberg": 2,
    "incident": 3, "deploy": 2, "overflow": 3, "semicolon": 4, "demo": 2, "wifi": 2,
    "feature": 2, "creature": 2, "teacher": 2, "preacher": 2, "ridiculous": 4,
    "meticulous": 4, "ibiza": 3, "habitual": 4, "anointer": 3, "disappointer": 4,
    "nuremberg": 3, "iceberg": 2, "produce": 2, "eleven": 3, "heaven": 2, "seven": 2,
    "president": 3, "confident": 3, "accident": 3, "trophy": 2, "toffee": 2,
    "every": 2, "everybody": 4, "diamonds": 2, "mc": 2, "am": 2, "they": 1, "ya'll": 1,
    "y'all": 1, "rollin'": 2, "pointer": 2, "conflict": 2, "commit": 2, "marshall": 2,
    "brevan": 2, "howard": 2, "segfault": 2, "default": 2, "assault": 2, "skrrt": 1,
    "chasing": 2, "sponsored": 2, "flexing": 2, "mona": 2, "lisa": 2, "quack": 1,
    "fire": 1, "crying": 2, "flying": 2, "trading": 2, "io": 2, "ibiza": 3, "o'clock": 2, "hospital": 3, "all-nighters": 3, "caffeine": 2, "sleepless": 2, "deadline's": 2, "hackathon's": 3, "dereferenced": 4, "practising": 3, "compsoc": 2, "capital": 3, "life": 1, "time": 1, "cold": 1, "made": 1, "one": 1, "whack": 1,
}


def syl(text):
    """Syllables in a word or phrase (a small hand-tuned counter)."""
    total = 0
    for w in re.findall(r"[a-z']+", text.lower().replace("-", " ")):
        if w in SYL_OVERRIDES:
            total += SYL_OVERRIDES[w]
            continue
        n = len(re.findall(r"[aeiouy]+", w))
        if w.endswith("e") and not w.endswith(("le", "ee")) and n > 1:
            n -= 1
        total += max(1, n)
    return total


def tok(text, kind, fam=None):
    return {"t": text, "syl": syl(text), "kind": kind, "fam": fam}


def line_tokens(words, fam):
    """One token per word, tagged as end rhyme, internal rhyme, ad-lib or plain."""
    toks = []
    for i, w in enumerate(words):
        bare = re.sub(r"[^a-z'-]", "", w.lower())
        if w in ADLIBS:
            kind = "adlib"
        elif i == len(words) - 1:
            kind = "end"
        elif bare in RHYMES_OF[fam]:
            kind = "rhyme"
        else:
            kind = "word"
        toks.append({"t": w + " ", "syl": syl(w), "kind": kind, "fam": fam})
    toks[-1]["t"] = toks[-1]["t"].strip()
    return toks


LIST_WORDS = set(WORDS)


def list_words_in(text):
    """Which of the 42 whack() words a piece of text uses (e.g. 'Capital One' -> capital, one)."""
    found = Counter()
    for w in re.findall(r"[a-z']+", text.lower()):
        w = w[:-2] if w.endswith("'s") else w
        if w in LIST_WORDS:
            found[w] += 1
    return found


def fits(need, budget):
    return all(budget[w] >= k for w, k in need.items())


def build_line(mood, fam, budget, used):
    """An opener built on a whack() word + a hand-written closer, padded to exactly 12 syllables.
    Each whack() word can only be used as many times as whack() returned it."""
    best = None
    nouns = [w for w in budget if budget[w] > 0] + [None]
    for closer in CLOSERS[fam]:
        if closer in used:
            continue
        end = closer.split()[-1].lower()
        for opener in OPENERS[mood] + PLAIN_OPENERS:
            plain = opener in PLAIN_OPENERS
            for w in ([None] if plain else nouns[:-1]):
                text = (opener if plain else opener.format(n=NOUN[w])) + " " + closer
                need = list_words_in(text)
                if not fits(need, budget):
                    continue
                gap = SYLLABLES_PER_BAR - syl(text)
                if gap < 0:
                    continue
                rhymes = (w in RHYMES_OF[fam] and w != end) + (end in need)
                key = (gap - 4 * rhymes - 2 * sum(need.values()) + 3 * used[opener]
                       + 6 * plain, random.random())
                if best is None or key < best[0]:
                    best = (key, text, closer, opener, w, gap, need)
    if best is None:
        return None
    _, text, closer, opener, w, gap, need = best
    used[closer] += 1
    used[opener] += 1
    budget.subtract(need)
    out = text.split()
    if gap:
        if out[0] not in ("I", "I'm") and not out[0][1:2].isupper():
            out[0] = out[0][0].lower() + out[0][1:]
        out = [random.choice(ADLIBS) for _ in range(gap)] + out
        out[0] = out[0].capitalize()
    end = closer.split()[-1].lower()
    return {"tokens": line_tokens(out, fam), "end": end, "family": fam, "need": need,
            "whack": end in need, "whack_rhymes": int(bool(w) and w in RHYMES_OF[fam] and w != end)}


def hook_lines(hook_word, count):
    """The hook spends every copy of the most-repeated word, and nothing else from the list."""
    word = hook_word.upper() + "!"
    lines, toks, left = [], [tok("Everybody ", "text"), tok("say ", "text")], count
    while True:
        while left and sum(t["syl"] for t in toks) + syl(word) <= SYLLABLES_PER_BAR:
            toks.append(tok(word + " ", "end", "hook"))
            left -= 1
        gap = SYLLABLES_PER_BAR - sum(t["syl"] for t in toks)
        toks += [tok(random.choice(["yeah! ", "ho! ", "hey! "]), "adlib") for _ in range(gap)]
        toks[-1]["t"] = toks[-1]["t"].strip()
        lines.append({"tokens": toks, "end": hook_word, "family": "hook", "whack": True,
                      "whack_rhymes": 0, "need": Counter()})
        if not left:
            return lines
        toks = [tok("Run ", "text"), tok("it ", "text"), tok("back: ", "text")]


def build_verse(words, file_words):
    """Turns one whack() result into a verse. Everything comes from whack()."""
    n = len(words)
    target = max(4, min(16, 2 * ((n + 6) // 12) + 2))
    bpm = 70 + n  # 71..170
    sponsor = sum(w in SPONSORS for w in words)
    pain = sum(w in SUFFERING for w in words)
    mood = "FLEXING" if sponsor > pain else "CRYING AT 3AM"
    hook_word, hook_count = Counter(file_words).most_common(1)[0]

    budget = Counter(words)  # each word as many times as whack() gave it, and no more
    budget[hook_word] = 0    # the hook gets every copy of its word
    lines, used = [], Counter()
    fams = list(dict.fromkeys(FAMILY_OF[w] for w in words))  # rhyme families, in whack() order
    spare = [f for f in CLOSERS if f not in fams]
    random.shuffle(spare)
    for fam in fams + spare:  # families whack() gave come first, then any others
        if len(lines) >= target:
            break
        saved_budget, saved_used = budget.copy(), used.copy()
        pair = [build_line(mood, fam, budget, used) for _ in range(2)]
        if all(pair):
            lines += pair
        else:
            budget, used = saved_budget, saved_used

    hook = hook_lines(hook_word, hook_count)
    for l in lines + hook:  # tag every token that spends one of the whack() words
        for t in l["tokens"]:
            found = list_words_in(t["t"]) if t["kind"] != "adlib" else {}
            t["list"] = next(iter(found), None)
    whack_rhymes = sum(l["whack_rhymes"] + l["whack"] for l in lines)
    for l in lines + hook:
        l.pop("need")
    return {
        "words": words, "count": n, "bars": len(lines), "bpm": bpm, "mood": mood,
        "hook": hook_word, "hook_count": hook_count, "lines": lines + hook,
        "flow": FLOW, "true_rhymes": whack_rhymes,
    }


def spit(mc_name):
    words = whack()
    file_words = Path("whack").read_text(encoding="utf-8").split()
    verse = build_verse(words, file_words)
    verse["mc"] = mc_name
    return verse


COLOURS = [31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96]


def show(v):
    print(f"\n\033[1;97;45m 🎤 {v['mc']} \033[0m  whack() gave {v['count']} words  ·  "
          f"{v['bars']} bars  ·  {v['bpm']} BPM  ·  mood: \033[1m{v['mood']}\033[0m  ·  "
          f"hook: \033[1;93m{v['hook'].upper()}\033[0m (x{v['hook_count']} in the whack file)\n")
    print(f"  \033[2m{'1 . . . 2 . . . 3 . . . 4 . . .':<60}  syllables\033[0m")
    fams = {}
    for i, line in enumerate(v["lines"]):
        if i == v["bars"]:
            print("\n  \033[2m[HOOK]\033[0m")
        c = fams.setdefault(line["family"], COLOURS[len(fams) % len(COLOURS)])
        parts, plain = [], 0
        for t in line["tokens"]:
            text = t["t"]
            plain += len(text)
            if t["kind"] == "end":
                parts.append(f"\033[1;4;{c}m{text}\033[0m")
            elif t["kind"] == "rhyme":
                parts.append(f"\033[1;{c}m{text}\033[0m")
            elif t["kind"] == "adlib":
                parts.append(f"\033[2;3m{text}\033[0m")
            else:
                parts.append(text)
        body = "".join(parts)
        n = sum(t["syl"] for t in line["tokens"])
        print(f"  {body}{' ' * max(1, 62 - plain)}\033[2m{n}\033[0m")
    print(f"\n  \033[2munderlined = end rhyme · bold = internal rhyme · same colour = same rhyme family"
          f"\n  every bar = 12 syllables on the 16ths, last one lands on the snare"
          f"\n  {v['true_rhymes']} rhymes built from whack() words\033[0m")


def write_player(verses, out="verse.html"):
    template = (Path(__file__).parent / "player.html").read_text(encoding="utf-8")
    Path(out).write_text(template.replace("/*VERSES*/[]", json.dumps(verses)), encoding="utf-8")
    print(f"\n🔊 Open {Path(out).resolve()} in a browser and press DROP THE BEAT.\n")


def verse():
    """One MC, one whack() call, one verse."""
    return [spit("MC WHACK")]


battle = verse  # older cached copies of player.html call battle()


def main():
    verses = verse()
    show(verses[0])
    write_player(verses)


if __name__ == "__main__":
    main()
