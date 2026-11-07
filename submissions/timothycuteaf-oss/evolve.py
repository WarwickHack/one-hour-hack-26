import os, sys, time, struct, zlib
from whack import whack, WORDS

N = 42
IDX = {w: i for i, w in enumerate(WORDS)}
DIRS = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
NAME, PREFIX, TARGET_ARG = "duck", "", ""
PLURAL = {"duck": "DUCKS", "goose": "GEESE"}

HEADING = {"goose": 0, "honk": 0, "pitch": 1, "push": 2, "deploy": 2, "commit": 3, "prod": 3,
           "duck": 4, "bug": 5, "merge": 6, "rubber": 7}


def express(words):
    x = IDX[words[0]]
    y = IDX[words[1]] if len(words) > 1 else IDX[words[0]]
    d = len(words) % 8
    pen, speed, saved, px = True, 1, [], set()

    def dot(cx, cy):
        if 0 <= cx < N and 0 <= cy < N:
            px.add(cy * N + cx)

    def blob(cx, cy, r, plus=False):
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                if not plus or xx == cx or yy == cy:
                    dot(xx, yy)

    def step(n):
        nonlocal x, y
        for _ in range(n):
            x += DIRS[d][0]
            y += DIRS[d][1]
            if pen:
                dot(x, y)

    dot(x, y)
    for w in words[2:]:
        if w in HEADING:
            d = HEADING[w]
            step(speed)
        elif w == "feature":
            d = (d + 1) % 8
            step(speed)
        elif w == "hack":
            d = (d - 1) % 8
            step(speed)
        elif w == "conflict":
            d = (d + 4) % 8
        elif w == "null":
            pen = False
        elif w == "pointer":
            pen = True
        elif w == "quack":
            blob(x, y, 1, plus=True)
        elif w == "pizza":
            blob(x, y, 1)
        elif w == "whack":
            blob(x, y, 2)
        elif w == "coffee":
            speed = 2
        elif w == "sleep":
            speed = 1
        elif w == "stack":
            saved.append((x, y))
        elif w == "overflow":
            if not saved:
                break
            x, y = saved.pop()
        elif w == "wifi":
            p, pen = pen, False
            step(6)
            pen = p
        elif w in ("segfault", "midnight"):
            break
        elif w in ("semicolon", "demo", "prize"):
            pass
        else:
            step(speed)
    return frozenset(px)


def make_duck():
    t = [0] * (N * N)

    def tri(px, py, a, b, c):
        def s(p, q, r):
            return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
        p = (px, py)
        d1, d2, d3 = s(p, a, b), s(p, b, c), s(p, c, a)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))

    for y in range(N):
        for x in range(N):
            body = ((x - 24) / 14.5) ** 2 + ((y - 29) / 8.5) ** 2 <= 1
            head = (x - 13) ** 2 + (y - 13.5) ** 2 <= 6.8 ** 2
            neck = ((x - 15.5) / 5.5) ** 2 + ((y - 22) / 6) ** 2 <= 1
            tail = tri(x, y, (31, 27), (40, 17), (39, 30))
            beak = ((x - 4.5) / 4.2) ** 2 + ((y - 16) / 2.2) ** 2 <= 1 and x <= 8
            eye = x in (11, 12) and y in (11, 12)
            wing = 0.55 <= ((x - 27) / 8) ** 2 + ((y - 27.5) / 4.2) ** 2 <= 0.85 and y <= 28
            if beak:
                t[y * N + x] = 2
            elif (body or head or neck or tail) and not eye and not wing:
                t[y * N + x] = 1
    return t


def load_target(path):
    t = [0] * (N * N)
    with open(path, encoding="utf-8") as f:
        for y, line in enumerate(f.read().splitlines()[:N]):
            for x, ch in enumerate(line[:N]):
                t[y * N + x] = 1 if ch == "#" else 2 if ch == "@" else 0
    return t


PALETTE = [(14, 22, 46), (36, 56, 92), (255, 205, 40), (255, 128, 20),
           (230, 70, 80), (30, 38, 66), (245, 245, 245), (0, 0, 0)]


def classify(count, target):
    out = bytearray(N * N)
    for p in range(N * N):
        t = target[p]
        if count[p]:
            out[p] = 2 if t == 1 else 3 if t == 2 else 4
        else:
            out[p] = 1 if t else 0
    return out


def frame_pixels(cls, iou, scale=6):
    w = N * scale
    rows = []
    for y in range(N):
        row = bytearray()
        for x in range(N):
            row += bytes([cls[y * N + x]]) * scale
        rows.extend([bytes(row)] * scale)
    filled = int(w * iou)
    rows.append(bytes([7]) * w)
    for _ in range(10):
        rows.append(bytes([2]) * filled + bytes([5]) * (w - filled))
    return w, len(rows), b"".join(rows)


def write_gif(path, frames, w, h):
    # cheating at lzw: 8 bit codes + clear every 100px so the table never grows
    out = bytearray(b"GIF89a")
    out += struct.pack("<HHBBB", w, h, 0xF2, 0, 0)
    for c in PALETTE:
        out += bytes(c)
    out += b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"
    for pixels, delay in frames:
        out += b"\x21\xF9\x04\x04" + struct.pack("<H", delay) + b"\x00\x00"
        out += b"\x2C" + struct.pack("<HHHHB", 0, 0, w, h, 0)
        out += b"\x07"
        codes = bytearray()
        for i in range(0, len(pixels), 100):
            codes.append(128)
            codes += pixels[i:i + 100]
        codes.append(129)
        for i in range(0, len(codes), 255):
            chunk = codes[i:i + 255]
            out += bytes([len(chunk)]) + chunk
        out += b"\x00"
    out += b"\x3B"
    with open(path, "wb") as f:
        f.write(out)


def write_png(path, w, h, pixels):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw += bytes(PALETTE[pixels[y * w + x]])

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def fossil_strip(snaps, scale=4, gap=6):
    panels = [frame_pixels(c, i, scale) for c, i in snaps]
    pw, ph = panels[0][0], panels[0][1]
    w = len(panels) * pw + (len(panels) + 1) * gap
    h = ph + 2 * gap
    img = bytearray([7]) * (w * h)
    for k, (_, _, px) in enumerate(panels):
        ox = gap + k * (pw + gap)
        for y in range(ph):
            img[(gap + y) * w + ox:(gap + y) * w + ox + pw] = px[y * pw:(y + 1) * pw]
    return w, h, img


RGB = [f"{r};{g};{b}" for r, g, b in PALETTE]
Y, D, R, B, X = "\x1b[38;2;255;205;40m", "\x1b[2m", "\x1b[0m", "\x1b[1m", "\x1b[9m"


def wrap(words, width=46, lines=3):
    out, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width:
            out.append(cur)
            cur = ""
            if len(out) == lines:
                out[-1] = out[-1][: width - 3] + "..."
                return out
        cur += w + " "
    out.append(cur)
    return out + [""] * (lines - len(out))


def render(cls, s):
    filled = int(20 * s["iou"])
    surv = wrap(s["last_kept"])
    dead = wrap(s["last_dead"], lines=2)
    panel = [
        f"{B}{Y}ON THE ORIGIN OF {PLURAL.get(NAME, NAME.upper() + 'S')}{R}",
        f"{D}by means of natural whacklection{R}",
        "",
        f"whack() calls     {B}{s['calls']:>7}{R}",
        f"genes alive       {s['alive']:>7}",
        f"mutations kept    {s['kept']:>7}",
        f"went extinct      {s['calls'] - s['kept']:>7}",
        "",
        f"duck-ness  {Y}{'█' * filled}{D}{'░' * (20 - filled)}{R} {B}{s['iou']:6.1%}{R}",
        "",
        f"{Y}+ survivor{R} {D}({s['last_op']}){R}",
        *[f"  {line}" for line in surv],
        "",
        f"{D}☠ extinct{R}",
        *[f"  {D}{X}{line}{R}" for line in dead],
        "",
        f"{D}no `import random` was harmed{R}",
        f"{D}Ctrl+C to stop early{R}",
    ]
    panel += [""] * (N // 2 - len(panel))
    out = ["\x1b[H"]
    for r in range(0, N, 2):
        row = [f"\x1b[38;2;{RGB[cls[r * N + x]]}m\x1b[48;2;{RGB[cls[(r + 1) * N + x]]}m▀" for x in range(N)]
        out.append("".join(row) + R + "   " + panel[r // 2] + "\x1b[K\n")
    sys.stdout.write("".join(out))
    sys.stdout.flush()


def setup_term():
    if os.name == "nt":
        os.system("")
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.stdout.write("\x1b[2J\x1b[?25l")


def evolve(max_calls, target=None):
    target = target or make_duck()
    T = sum(1 for t in target if t)
    count = [0] * (N * N)
    genome = []
    hits = miss = 0
    calls = kept = 0
    s = {"calls": 0, "alive": 0, "kept": 0, "iou": 0.0, "last_kept": [], "last_dead": [], "last_op": ""}
    frames, snaps = [], []
    snap_at = [30, 150, 600, 2000]
    next_bucket = 0.0
    last_draw = 0.0

    def paint(pix, sign):
        nonlocal hits, miss
        for p in pix:
            if sign > 0:
                if count[p] == 0:
                    if target[p]:
                        hits += 1
                    else:
                        miss += 1
                count[p] += 1
            else:
                count[p] -= 1
                if count[p] == 0:
                    if target[p]:
                        hits -= 1
                    else:
                        miss -= 1

    def iou():
        return hits / (T + miss)

    def capture(delay=7):
        frames.append((frame_pixels(classify(count, target), iou())[2], delay))

    setup_term()
    capture(40)
    try:
        while calls < max_calls and iou() < 0.985:
            words = whack()
            calls += 1
            before = iou()
            roll = IDX[words[-1]] % 8
            if genome and 3 <= roll <= 5:
                k = (IDX[words[0]] * 101 + len(words) * 7) % len(genome)
                old_words, old = genome[k]
                cut = 2 + (IDX[words[0]] + len(words)) % max(1, len(old_words) - 1)
                spliced = old_words[:cut] + words[1:1 + IDX[words[-1]] % 6]
                op, new = f"spliced gene #{k}", express(spliced)
                paint(old, -1)
                paint(new, +1)
                ok = iou() >= before and new != old
                if ok:
                    genome[k] = (spliced, new)
                    words = spliced
                else:
                    paint(new, -1)
                    paint(old, +1)
            elif not genome or roll < 3:
                op, new = "birth", express(words)
                paint(new, +1)
                ok = iou() > before
                if ok:
                    genome.append((words, new))
                else:
                    paint(new, -1)
            else:
                k = (IDX[words[0]] * 101 + len(words) * 7 + IDX[words[-1]]) % len(genome)
                old_words, old = genome[k]
                paint(old, -1)
                if roll == 6:
                    op, new = f"replaced gene #{k}", express(words)
                    paint(new, +1)
                    ok = iou() >= before and new != old
                    if ok:
                        genome[k] = (words, new)
                    else:
                        paint(new, -1)
                        paint(old, +1)
                else:
                    op = f"gene #{k} culled"
                    ok = iou() >= before
                    if ok:
                        genome.pop(k)
                    else:
                        paint(old, +1)
                    words = old_words if ok else words
            if ok:
                kept += 1
                s["last_kept"], s["last_op"] = words, op
            else:
                s["last_dead"] = words
            cur = iou()
            if cur >= next_bucket:
                capture()
                next_bucket = cur + 0.02
            if snap_at and calls >= snap_at[0]:
                snaps.append((classify(count, target), cur))
                snap_at.pop(0)
            now = time.time()
            if now - last_draw > 1 / 30:
                last_draw = now
                s.update(calls=calls, alive=len(genome), kept=kept, iou=cur)
                render(classify(count, target), s)
    except KeyboardInterrupt:
        pass
    s.update(calls=calls, alive=len(genome), kept=kept, iou=iou())
    final = classify(count, target)
    render(final, s)
    sys.stdout.write("\x1b[?25h\n")
    capture(350)

    w, h = frame_pixels(final, 0)[:2]
    write_gif(PREFIX + "evolution.gif", frames, w, h)
    snaps.append((final, iou()))
    sw, sh, strip = fossil_strip(snaps)
    write_png(PREFIX + "fossil_record.png", sw, sh, strip)
    with open(NAME + ".dna", "w", encoding="utf-8") as f:
        f.write(f"# the complete genome of one {NAME}: {len(genome)} genes. every word in here came out of whack()\n")
        f.write(f"# regrow it with:  python evolve.py{TARGET_ARG} --hatch {NAME}.dna\n")
        f.write(f"# {calls} whack() calls were made. {calls - kept} mutations went extinct.\n")
        for i, (words, _) in enumerate(genome):
            f.write(f"{i:>3}: {' '.join(words)}\n")

    print(f"{B}{Y}A {NAME} has evolved.{R} {iou():.1%} {NAME} after {calls} whack() calls.")
    print(f"Its genome is {len(genome)} whack() calls long ({sum(len(g[0]) for g in genome)} words). "
          f"{calls - kept} mutations went extinct along the way.")
    print(f"{D}wrote {PREFIX}evolution.gif, {PREFIX}fossil_record.png and {NAME}.dna{R}")


def hatch(path, target=None):
    target = target or make_duck()
    T = sum(1 for t in target if t)
    genes = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.startswith("#") and ":" in line:
                words = line.split(":", 1)[1].split()
                if words:
                    genes.append(words)
    setup_term()
    count = [0] * (N * N)
    for i, words in enumerate(genes):
        for p in express(words):
            count[p] += 1
        hits = sum(1 for p in range(N * N) if count[p] and target[p])
        miss = sum(1 for p in range(N * N) if count[p] and not target[p])
        render(classify(count, target), {"calls": 0, "alive": i + 1, "kept": i + 1, "iou": hits / (T + miss),
                                         "last_kept": words, "last_dead": [], "last_op": f"expressing gene #{i}"})
        time.sleep(0.12)
    sys.stdout.write("\x1b[?25h\n")
    print(f"{B}{Y}Hatched.{R} One {NAME}, decompressed from {len(genes)} lines of hackathon words.")


if __name__ == "__main__":
    args, target = sys.argv[1:], None
    if "--target" in args:
        i = args.index("--target")
        target = load_target(args[i + 1])
        NAME = os.path.splitext(os.path.basename(args[i + 1]))[0]
        PREFIX, TARGET_ARG = NAME + "_", " --target " + args[i + 1]
        del args[i:i + 2]
    if len(args) > 1 and args[0] == "--hatch":
        hatch(args[1], target)
    else:
        evolve(int(args[0]) if args else 20000, target)
