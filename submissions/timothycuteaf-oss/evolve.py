import os, sys, time, struct, zlib
from whack import whack, WORDS

N = 42
IDX = {w: i for i, w in enumerate(WORDS)}
DIRS = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
MOVE = {"goose": 0, "honk": 0, "pitch": 1, "push": 2, "deploy": 2, "commit": 3, "prod": 3, "duck": 4, "bug": 5, "merge": 6, "rubber": 7}
TURN = {"feature": 1, "hack": -1}
STAMP = {"quack": (1, True), "pizza": (1, False), "whack": (2, False)}
PAL = [(14, 22, 46), (36, 56, 92), (255, 205, 40), (255, 128, 20), (230, 70, 80), (30, 38, 66), (245, 245, 245), (0, 0, 0)]
RGB = [f"{r};{g};{b}" for r, g, b in PAL]
Y, D, R, B, X = "\x1b[38;2;255;205;40m", "\x1b[2m", "\x1b[0m", "\x1b[1m", "\x1b[9m"
NAME, PREFIX, TARGET_ARG = "duck", "", ""


def express(words):
    x, y = IDX[words[0]], IDX[words[min(1, len(words) - 1)]]
    d, pen, speed, saved, px = len(words) % 8, True, 1, [], set()

    def dot(a, b):
        if 0 <= a < N and 0 <= b < N: px.add(b * N + a)

    def step(n, draw=True):
        nonlocal x, y
        for _ in range(n):
            x, y = x + DIRS[d][0], y + DIRS[d][1]
            if pen and draw: dot(x, y)

    dot(x, y)
    for w in words[2:]:
        if w in MOVE: d = MOVE[w]; step(speed)
        elif w in TURN: d = (d + TURN[w]) % 8; step(speed)
        elif w in STAMP:
            r, plus = STAMP[w]
            for b in range(y - r, y + r + 1):
                for a in range(x - r, x + r + 1):
                    if not plus or a == x or b == y: dot(a, b)
        elif w == "conflict": d = (d + 4) % 8
        elif w in ("null", "pointer"): pen = w == "pointer"
        elif w in ("coffee", "sleep"): speed = 2 if w == "coffee" else 1
        elif w == "stack": saved.append((x, y))
        elif w == "overflow":
            if not saved: break
            x, y = saved.pop()
        elif w == "wifi": step(6, False)
        elif w in ("segfault", "midnight"): break
        elif w not in ("semicolon", "demo", "prize"): step(speed)
    return frozenset(px)


def make_duck():
    def tri(p, a, b, c):
        s = lambda p, q, r: (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
        d = (s(p, a, b), s(p, b, c), s(p, c, a))
        return not (min(d) < 0 and max(d) > 0)
    t = [0] * (N * N)
    for y in range(N):
        for x in range(N):
            body = ((x - 24) / 14.5) ** 2 + ((y - 29) / 8.5) ** 2 <= 1
            head = (x - 13) ** 2 + (y - 13.5) ** 2 <= 6.8 ** 2
            neck = ((x - 15.5) / 5.5) ** 2 + ((y - 22) / 6) ** 2 <= 1
            tail = tri((x, y), (31, 27), (40, 17), (39, 30))
            beak = ((x - 4.5) / 4.2) ** 2 + ((y - 16) / 2.2) ** 2 <= 1 and x <= 8
            eye = x in (11, 12) and y in (11, 12)
            wing = 0.55 <= ((x - 27) / 8) ** 2 + ((y - 27.5) / 4.2) ** 2 <= 0.85 and y <= 28
            t[y * N + x] = 2 if beak else 1 if (body or head or neck or tail) and not eye and not wing else 0
    return t


def load_target(path):
    lines = open(path, encoding="utf-8").read().splitlines()[:N]
    t = [0] * (N * N)
    for y, line in enumerate(lines):
        for x, ch in enumerate(line[:N]): t[y * N + x] = 1 if ch == "#" else 2 if ch == "@" else 0
    return t


def classify(count, t):
    return bytes((2 if t[p] == 1 else 3 if t[p] == 2 else 4) if count[p] else (1 if t[p] else 0) for p in range(N * N))


def frame(cls, iou, s=6):
    w, f = N * s, int(N * s * iou)
    rows = [bytes(v for v in cls[y * N:(y + 1) * N] for _ in range(s)) for y in range(N) for _ in range(s)]
    return w, N * s + 11, b"".join(rows) + bytes([7]) * w + (bytes([2]) * f + bytes([5]) * (w - f)) * 10


def write_gif(path, frames, w, h):
    o = b"GIF89a" + struct.pack("<HHBBB", w, h, 0xF2, 0, 0) + bytes(sum(PAL, ())) + b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"
    for px, delay in frames:
        o += b"\x21\xF9\x04\x04" + struct.pack("<H", delay) + b"\x00\x00\x2C" + struct.pack("<HHHHB", 0, 0, w, h, 0) + b"\x07"
        c = b"".join(b"\x80" + px[i:i + 100] for i in range(0, len(px), 100)) + b"\x81"
        o += b"".join(bytes([len(c[i:i + 255])]) + c[i:i + 255] for i in range(0, len(c), 255)) + b"\x00"
    open(path, "wb").write(o + b"\x3B")


def write_png(path, w, h, px):
    raw = b"".join(b"\x00" + b"".join(bytes(PAL[v]) for v in px[y * w:(y + 1) * w]) for y in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw, 9)) + ch(b"IEND", b""))


def fossil_strip(snaps, s=4, g=6):
    ps = [frame(c, i, s) for c, i in snaps]
    pw, ph = ps[0][:2]
    w, h = len(ps) * pw + (len(ps) + 1) * g, ph + 2 * g
    img = bytearray([7]) * (w * h)
    for k, (_, _, px) in enumerate(ps):
        ox = g + k * (pw + g)
        for y in range(ph): img[(g + y) * w + ox:(g + y) * w + ox + pw] = px[y * pw:(y + 1) * pw]
    return w, h, img


def wrap(words, width=46, lines=3):
    out, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width:
            out.append(cur); cur = ""
            if len(out) == lines: return out[:-1] + [out[-1][:width - 3] + "..."]
        cur += w + " "
    return (out + [cur] + [""] * lines)[:lines]


def render(cls, s):
    f = int(20 * s["iou"])
    panel = [f"{B}{Y}ON THE ORIGIN OF {'GEESE' if NAME == 'goose' else NAME.upper() + 'S'}{R}", f"{D}by means of natural whacklection{R}", "",
             f"whack() calls     {B}{s['calls']:>7}{R}", f"genes alive       {s['alive']:>7}", f"mutations kept    {s['kept']:>7}",
             f"went extinct      {s['calls'] - s['kept']:>7}", "", f"duck-ness  {Y}{'█' * f}{D}{'░' * (20 - f)}{R} {B}{s['iou']:6.1%}{R}", "",
             f"{Y}+ survivor{R} {D}({s['last_op']}){R}", *[f"  {l}" for l in wrap(s["last_kept"])], "",
             f"{D}☠ extinct{R}", *[f"  {D}{X}{l}{R}" for l in wrap(s["last_dead"], lines=2)], "",
             f"{D}no `import random` was harmed{R}", f"{D}Ctrl+C to stop early{R}", "", ""]
    out = "".join("".join(f"\x1b[38;2;{RGB[cls[r * N + x]]}m\x1b[48;2;{RGB[cls[(r + 1) * N + x]]}m▀" for x in range(N))
                  + R + "   " + panel[r // 2] + "\x1b[K\n" for r in range(0, N, 2))
    sys.stdout.write("\x1b[H" + out); sys.stdout.flush()


def setup_term():
    if os.name == "nt": os.system("")
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    sys.stdout.write("\x1b[2J\x1b[?25l")


def evolve(max_calls, target):
    T, count, genome, hm = sum(map(bool, target)), [0] * (N * N), [], [0, 0]
    calls = kept = 0
    frames, snaps, snap_at, nxt, last = [], [], [30, 150, 600, 2000], 0.0, 0.0
    s = dict(calls=0, alive=0, kept=0, iou=0.0, last_kept=[], last_dead=[], last_op="")

    def paint(pix, sign):
        for p in pix:
            if sign < 0: count[p] -= 1
            if count[p] == 0: hm[0 if target[p] else 1] += sign
            if sign > 0: count[p] += 1

    iou = lambda: hm[0] / (T + hm[1])
    capture = lambda delay=7: frames.append((frame(classify(count, target), iou())[2], delay))

    def swap(k, nw):
        before, (_, op) = iou(), genome[k]
        new = express(nw) if nw else frozenset()
        paint(op, -1); paint(new, 1)
        if iou() >= before and new != op:
            if nw: genome[k] = (nw, new)
            else: genome.pop(k)
            return True
        paint(new, -1); paint(op, 1)
        return False

    setup_term(); capture(40)
    try:
        while calls < max_calls and iou() < 0.985:
            words = whack(); calls += 1
            a, z, n = IDX[words[0]], IDX[words[-1]], len(words)
            roll = z % 8
            if genome and 3 <= roll <= 5:
                k = (a * 101 + n * 7) % len(genome); ow = genome[k][0]
                nw = ow[:2 + (a + n) % max(1, len(ow) - 1)] + words[1:1 + z % 6]
                op, ok = f"spliced gene #{k}", swap(k, nw)
                if ok: words = nw
            elif not genome or roll < 3:
                before, new = iou(), express(words); paint(new, 1)
                op, ok = "birth", iou() > before
                if ok: genome.append((words, new))
                else: paint(new, -1)
            else:
                k = (a * 101 + n * 7 + z) % len(genome); ow = genome[k][0]
                if roll == 6: op, ok = f"replaced gene #{k}", swap(k, words)
                else:
                    op, ok = f"gene #{k} culled", swap(k, None)
                    if ok: words = ow
            kept += ok
            if ok: s["last_kept"], s["last_op"] = words, op
            else: s["last_dead"] = words
            cur = iou()
            if cur >= nxt: capture(); nxt = cur + 0.02
            if snap_at and calls >= snap_at[0]: snaps.append((classify(count, target), cur)); snap_at.pop(0)
            if time.time() - last > 1 / 30:
                last = time.time(); s.update(calls=calls, alive=len(genome), kept=kept, iou=cur)
                render(classify(count, target), s)
    except KeyboardInterrupt:
        pass
    s.update(calls=calls, alive=len(genome), kept=kept, iou=iou())
    final = classify(count, target)
    render(final, s); sys.stdout.write("\x1b[?25h\n"); capture(350)

    write_gif(PREFIX + "evolution.gif", frames, *frame(final, 0)[:2])
    write_png(PREFIX + "fossil_record.png", *fossil_strip(snaps + [(final, iou())]))
    with open(NAME + ".dna", "w", encoding="utf-8") as f:
        f.write(f"# the complete genome of one {NAME}: {len(genome)} genes. every word in here came out of whack()\n"
                f"# regrow it with:  python evolve.py{TARGET_ARG} --hatch {NAME}.dna\n"
                f"# {calls} whack() calls were made. {calls - kept} mutations went extinct.\n")
        f.writelines(f"{i:>3}: {' '.join(w)}\n" for i, (w, _) in enumerate(genome))
    print(f"{B}{Y}A {NAME} has evolved.{R} {iou():.1%} {NAME} after {calls} whack() calls.")
    print(f"Its genome is {len(genome)} whack() calls long ({sum(len(g[0]) for g in genome)} words). {calls - kept} mutations went extinct along the way.")
    print(f"{D}wrote {PREFIX}evolution.gif, {PREFIX}fossil_record.png and {NAME}.dna{R}")


def hatch(path, target):
    genes = [l.split(":", 1)[1].split() for l in open(path, encoding="utf-8") if not l.startswith("#") and ":" in l]
    genes, T, count = [g for g in genes if g], sum(map(bool, target)), [0] * (N * N)
    setup_term()
    for i, words in enumerate(genes):
        for p in express(words): count[p] += 1
        hits = sum(1 for p in range(N * N) if count[p] and target[p])
        miss = sum(1 for p in range(N * N) if count[p] and not target[p])
        render(classify(count, target), dict(calls=0, alive=i + 1, kept=i + 1, iou=hits / (T + miss), last_kept=words, last_dead=[], last_op=f"expressing gene #{i}"))
        time.sleep(0.12)
    sys.stdout.write("\x1b[?25h\n")
    print(f"{B}{Y}Hatched.{R} One {NAME}, decompressed from {len(genes)} lines of hackathon words.")


if __name__ == "__main__":
    args, target = sys.argv[1:], None
    if "--target" in args:
        i = args.index("--target")
        target, NAME = load_target(args[i + 1]), os.path.splitext(os.path.basename(args[i + 1]))[0]
        PREFIX, TARGET_ARG = NAME + "_", " --target " + args[i + 1]
        del args[i:i + 2]
    target = target or make_duck()
    if len(args) > 1 and args[0] == "--hatch": hatch(args[1], target)
    else: evolve(int(args[0]) if args else 20000, target)
