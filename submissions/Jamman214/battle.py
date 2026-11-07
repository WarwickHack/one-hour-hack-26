#!/usr/bin/env python3
"""WHACK ROYALE: every word whack() returns becomes a fighter. SPACE = whack()."""
import math, os, random, sys

TEST = "--test" in sys.argv
if TEST:
    os.environ["SDL_VIDEODRIVER"] = "dummy"
import pygame

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)  # whack() writes ./whack, keep it in our folder
sys.path.insert(0, HERE)
from whack import whack, WORDS

V = pygame.Vector2
W, H = 1280, 800
MAX_ENTS = 220  # whack() can chain-spawn; cap keeps the frame rate alive
pygame.init()
screen = pygame.display.set_mode((W, H))
pygame.display.set_caption("WHACK ROYALE")
world = pygame.Surface((W, H))
F_S, F_M, F_L = (pygame.font.Font(None, s) for s in (18, 30, 60))
IMG = {f[:-4]: pygame.image.load(os.path.join("assets", f)).convert_alpha()
       for f in os.listdir("assets") if f.endswith(".png")}
IMG["rubberduck"] = IMG["duck"]

PAIRS = {"marshall": "wace", "brevan": "howard", "capital": "one", "incident": "io",
         "null": "pointer", "stack": "overflow", "rubber": "duck", "merge": "conflict"}
PARTNER = {**PAIRS, **{b: a for a, b in PAIRS.items()}}
PICKUPS = {"pizza", "coffee", "prize"}
SHIELDED = {"netcraft", "warwick"}
STATS = {  # word: (hp, speed, contact dps, radius); default (120, 90, 25, 20)
    "whack": (180, 95, 45, 22), "goose": (140, 175, 35, 20), "warwick": (640, 35, 20, 34),
    "deploy": (60, 230, 0, 16), "bug": (50, 70, 10, 14), "netcraft": (260, 70, 25, 24),
    "conflict": (120, 110, 60, 20), "pizza": (40, 25, 0, 16), "coffee": (40, 25, 0, 16), "prize": (100, 45, 0, 20),
    "brevanhoward": (680, 55, 30, 44), "marshallwace": (680, 50, 30, 42), "capitalone": (660, 80, 60, 40),
    "incidentio": (640, 60, 25, 40), "rubberduck": (520, 100, 30, 36),
}
CD = {"whack": 8, "hack": 4, "quack": 3, "honk": 5, "bug": 2.5, "feature": 3, "oculus": 1.5, "compsoc": 7,
      "bloomberg": 0.6, "sleep": 4, "midnight": 14, "semicolon": 3, "demo": 4, "pitch": 4, "segfault": 9,
      "capitalone": 2.5, "incidentio": 6, "rubberduck": 3}

ents, spawnq, parts, rings, beams, texts, bullets, waves, feed = ([] for _ in range(9))
nights = []  # [centre, radius, life, source entity]
state = {"shake": 0.0, "flash": None, "calls": 0, "last": [], "fusions": 0, "info": False}
_serial = 0


class E:
    def __init__(s, word, pos, vel=(0, 0)):
        global _serial
        _serial += 1
        s.id, s.word = _serial, word
        hp, s.speed, s.dps, s.r = STATS.get(word, (120, 90, 25, 20))
        s.hp = s.maxhp = hp
        s.pos, s.vel = V(pos), V(vel)
        s.cd = random.uniform(0.5, CD.get(word, 99))
        s.stun = s.slow = s.boost = s.dash = s.retarget = 0.0
        s.lives = 1 if word == "commit" else 0
        s.grace = 1.2  # spawn protection: a wave bursts from one point
        s.target, s.dead, s.silent, s.killer = None, False, False, None
        s.fusing, s.fuse_t = None, 0.0
        s.angle = random.uniform(0, math.tau)
        s.color = tuple(min(255, c + 70) for c in pygame.transform.average_color(IMG[word])[:3])


# ---------- helpers ----------
_sprites, _labels = {}, {}
def sprite(word, r):
    k = (word, int(r))
    if k not in _sprites:
        im, h = IMG[word], int(r * 2)
        _sprites[k] = pygame.transform.smoothscale(im, (max(1, im.get_width() * h // im.get_height()), h))
    return _sprites[k]

def label(word):
    if word not in _labels:
        _labels[word] = F_S.render(word, True, (220, 220, 230))
    return _labels[word]

def add_text(pos, s, col=(255, 255, 255), font=None, life=1.5):
    texts.append([V(pos), s, col, life, life, font or F_M])

def burst(pos, col, n=14, spd=220, life=0.7):
    for _ in range(n):
        a = random.uniform(0, math.tau)
        parts.append([V(pos), V(math.cos(a), math.sin(a)) * random.uniform(0.3, 1) * spd, col, life, random.randint(2, 5), life])

def ring(pos, maxr, col, life=0.5, width=4):
    rings.append([V(pos), maxr, col, life, life, width])

def beam(a, b, col, life=0.25, w=3):
    beams.append([V(a), V(b), col, life, life, w])

def away(a, b, k):  # vector from b towards a, length k
    d = a - b
    return d.normalize() * k if d.length_squared() > 0.01 else V(k, 0).rotate(random.uniform(0, 360))

def hurt(t, dmg, src):
    if t.dead or t.grace > 0:
        return
    t.hp -= dmg * (0.5 if t.word in SHIELDED else 1)
    if src:
        t.killer = src.word

def alive(pred=lambda o: True):
    return [o for o in ents if not o.dead and pred(o)]

def near(e, rad):
    return [o for o in ents if o is not e and not o.dead and o.pos.distance_squared_to(e.pos) < rad * rad]

def nearest(e, pred=lambda o: True, maxd=1e5):
    best, bd = None, maxd * maxd
    for o in ents:
        if o is not e and not o.dead and pred(o):
            d = o.pos.distance_squared_to(e.pos)
            if d < bd:
                best, bd = o, d
    return best

def fighter(o):
    return o.word not in PICKUPS

def segdist(p, a, b):
    ab = b - a
    t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared(), 1e-6)))
    return p.distance_to(a + ab * t)

def explode(pos, rad, dmg, src=None, col=(255, 160, 40)):
    pos = V(pos)
    ring(pos, rad, col, 0.5, 6)
    burst(pos, col, 40, rad * 3)
    state["shake"] = max(state["shake"], rad / 15)
    for o in ents:
        if o is not src and not o.dead and o.pos.distance_to(pos) < rad + o.r:
            hurt(o, dmg, src)
            o.vel += away(o.pos, pos, 300)

def spawn_wave(pos):
    words = whack()
    state["calls"] += 1
    state["last"] = words
    room = max(0, MAX_ENTS - len(ents) - len(spawnq))
    for w in words[:room]:
        a = random.uniform(0, math.tau)
        spawnq.append(E(w, pos, V(math.cos(a), math.sin(a)) * random.uniform(150, 600)))
    ring(pos, 260, (255, 230, 80), 0.6, 8)
    state["shake"] = max(state["shake"], 8)
    add_text(pos - V(0, 40), f"whack() x{len(words)}", (255, 230, 80), F_L, 1.2)


# ---------- abilities (on cooldown) ----------
def a_whack(e):
    if random.random() < 0.3:
        spawn_wave(V(e.pos))
    elif t := nearest(e, fighter, 90):
        hurt(t, 50, e)
        ring(t.pos, 50, (255, 230, 80), 0.3)
        add_text(t.pos, "WHACK", (255, 230, 80), F_S, 0.6)

def a_hack(e):
    if t := nearest(e, lambda o: fighter(o) and o.r < 30 and o.word != "hack" and not o.fusing, 160):
        t.dead = t.silent = True
        n = E(random.choice(WORDS), t.pos)
        spawnq.append(n)
        beam(e.pos, t.pos, (170, 80, 255), 0.4, 4)
        add_text(t.pos, f"{t.word} -> {n.word}", (190, 120, 255), F_S, 1)

def a_quack(e):
    for o in near(e, 140):
        o.vel += away(o.pos, e.pos, 350)
    ring(e.pos, 140, (255, 220, 60), 0.4)
    add_text(e.pos, "QUACK", (255, 220, 60), F_S, 0.7)

def a_honk(e):
    for o in near(e, 130):
        o.stun = 1.5
    ring(e.pos, 130, (240, 240, 255), 0.5, 6)
    add_text(e.pos, "HONK!", (255, 255, 255), F_M, 0.8)

def a_bug(e):
    if len(alive(lambda o: o.word == "bug")) < 70 and len(ents) + len(spawnq) < MAX_ENTS:
        spawnq.append(E("bug", e.pos + V(random.uniform(-20, 20), random.uniform(-20, 20))))

def a_feature(e):
    for o in near(e, 110):
        o.hp = min(o.maxhp, o.hp + 40)
    ring(e.pos, 110, (120, 255, 140), 0.4)

def a_oculus(e):
    if t := nearest(e, fighter, 320):
        beam(e.pos, t.pos, (80, 160, 255), 0.2, 5)
        hurt(t, 25, e)

def a_compsoc(e):
    spawnq.append(E("hack", e.pos))
    add_text(e.pos, "+hack", (170, 80, 255), F_S, 0.8)

def a_bloomberg(e):
    if t := nearest(e, fighter, 400):
        bullets.append([V(e.pos), away(t.pos, e.pos, 500), e,
                        random.choice(["+2.3%", "-1.1%", "$$$", "BUY", "SELL", "+0.4%", "-6.9%"]), 1.2])

def a_sleep(e):
    for o in near(e, 120):
        o.slow = 2.5
    ring(e.pos, 120, (110, 140, 255), 0.6)
    add_text(e.pos, "zzz", (140, 160, 255), F_M, 1)

def a_midnight(e):
    nights.append([V(e.pos), 0.0, 5.0, e])
    add_text(e.pos - V(0, 40), "IT'S MIDNIGHT", (200, 200, 255), F_M, 2)

def in_night(p):
    return any(p.distance_squared_to(n[0]) < n[1] ** 2 for n in nights)

def a_semicolon(e):
    burst(e.pos, e.color, 10)
    e.pos = V(random.uniform(40, W - 40), random.uniform(40, H - 40))
    burst(e.pos, e.color, 10)
    add_text(e.pos, "missing ;", (255, 220, 100), F_S, 0.8)

def a_demo(e):
    victims = near(e, 140)
    for o in victims:
        o.pos = V(random.uniform(40, W - 40), random.uniform(40, H - 40))
    if victims:
        add_text(e.pos, "it worked on my machine", (255, 140, 140), F_S, 1.2)

def a_pitch(e):
    for o in near(e, 250):
        o.vel += away(e.pos, o.pos, 250)
    ring(e.pos, 250, (220, 120, 255), 0.5, 2)
    add_text(e.pos, "so basically...", (220, 120, 255), F_S, 1)

def a_segfault(e):
    if random.random() < 0.25:
        e.hp = 0  # spontaneous crash; die() does the boom

def a_capitalone(e):
    if t := nearest(e, fighter):
        e.dash = 0.45
        e.vel = away(t.pos, e.pos, 900)
        add_text(e.pos, "SWIPE!", (255, 80, 80), F_M, 0.8)

def incident(e):
    state["flash"] = [(255, 40, 40), 0.5, 0.5]
    for o in alive(lambda o: o.word in ("bug", "segfault", "prod", "conflict")):
        beam(e.pos, o.pos, (255, 60, 60), 0.4, 3)
        o.hp, o.killer = 0, "incident.io"
    add_text((W / 2, H / 2), "INCIDENT DECLARED", (255, 80, 80), F_L, 2)

def a_rubberduck(e):
    bugs = alive(lambda o: o.word == "bug")[:6]
    for o in bugs:
        beam(e.pos, o.pos, (255, 230, 80), 0.4, 3)
        o.hp, o.killer = 0, "rubberduck"
    if bugs:
        add_text(e.pos, "debugging...", (255, 230, 80), F_M, 1)

ABIL = {"whack": a_whack, "hack": a_hack, "quack": a_quack, "honk": a_honk, "bug": a_bug, "feature": a_feature,
        "oculus": a_oculus, "compsoc": a_compsoc, "bloomberg": a_bloomberg, "sleep": a_sleep, "midnight": a_midnight,
        "semicolon": a_semicolon, "demo": a_demo, "pitch": a_pitch, "segfault": a_segfault,
        "capitalone": a_capitalone, "incidentio": incident, "rubberduck": a_rubberduck}


# ---------- auras (every frame) ----------
def au_prod(e, dt):
    for o in near(e, 70):
        hurt(o, 25 * dt, e)
    if random.random() < 0.5:
        parts.append([e.pos + V(random.uniform(-25, 25), 10), V(0, -80), (255, random.randint(80, 180), 30), 0.6, 4, 0.6])

def au_wifi(e, dt):
    for o in near(e, 110):
        if random.random() < 0.08:
            o.pos += V(random.uniform(-30, 30), random.uniform(-30, 30))  # lag spike

def au_brevanhoward(e, dt):
    for o in near(e, 140):
        hurt(o, 10 * dt, e)
        e.hp = min(e.maxhp, e.hp + 4 * dt)
        beam(e.pos, o.pos, (255, 215, 90), 0.03, 1)

def au_marshallwace(e, dt):
    e.angle += 1.8 * dt
    tip = e.pos + V(330, 0).rotate_rad(e.angle)
    for o in ents:
        if o is not e and not o.dead and segdist(o.pos, e.pos, tip) < o.r + 6:
            hurt(o, 90 * dt, e)
    beam(e.pos, tip, (200, 80, 255), 0.03, 7)

AURA = {"prod": au_prod, "wifi": au_wifi, "brevanhoward": au_brevanhoward, "marshallwace": au_marshallwace}


# ---------- fusions ----------
def ev_nullpointer(pos):
    explode(pos, 220, 90, None, (255, 80, 80))
    add_text(pos + V(0, 50), "Segmentation fault (core dumped)", (255, 80, 80), F_M, 2)
    for _ in range(3):
        spawnq.append(E("segfault", pos + V(random.uniform(-60, 60), random.uniform(-60, 60))))

def ev_stackoverflow(pos):
    waves.append([-40.0, set()])
    state["flash"] = [(60, 120, 255), 0.4, 0.4]

def ev_mergeconflict(pos):
    explode(pos, 160, 70, None, (255, 120, 0))
    for i, s in enumerate(("<<<<<<< HEAD", "=======", ">>>>>>> main")):
        add_text(pos + V(0, 40 + 26 * i), s, (255, 160, 60), F_M, 2)
    spawnq.extend(E("conflict", pos) for _ in range(2))

EVENTS = {"nullpointer": ev_nullpointer, "stackoverflow": ev_stackoverflow, "mergeconflict": ev_mergeconflict}

def fuse(a, b):
    l, r = (a, b) if a.word in PAIRS else (b, a)
    name, pos = l.word + r.word, (a.pos + b.pos) / 2
    a.dead = a.silent = b.dead = b.silent = True
    state["fusions"] += 1
    state["flash"] = [(255, 255, 255), 0.25, 0.25]
    state["shake"] = max(state["shake"], 14)
    burst(pos, l.color, 50, 500)
    ring(pos, 220, (255, 255, 255), 0.6, 8)
    add_text(pos - V(0, 60), f"{l.word.upper()} + {r.word.upper()}", (255, 255, 120), F_L, 2)
    if name in STATS:
        n = E(name, pos)
        spawnq.append(n)
        if name == "incidentio":
            incident(n)
    else:
        EVENTS[name](pos)

FUSE_T = 1.6

def start_fuse(a, b):
    a.fusing, b.fusing = b, a
    a.fuse_t = b.fuse_t = FUSE_T
    a.grace = b.grace = FUSE_T + 0.3  # can't be killed mid-fusion
    mid = (a.pos + b.pos) / 2
    a.angle = math.atan2(a.pos.y - mid.y, a.pos.x - mid.x)
    add_text(mid - V(0, 50), f"{a.word} + {b.word} ...", (255, 255, 160), F_M, FUSE_T)

def fusing_step(a, dt):
    """Halves spiral into each other faster and faster while energy gets sucked in, then fuse()."""
    b = a.fusing
    a.fuse_t -= dt
    p = 1 - a.fuse_t / FUSE_T
    mid = (a.pos + b.pos) / 2
    a.angle += (3 + 16 * p) * dt
    off = V(70 * (1 - p) + 4, 0).rotate_rad(a.angle)
    a.pos, b.pos, a.vel, b.vel = mid + off, mid - off, V(), V()
    for _ in range(int(2 + 8 * p)):
        q = mid + V(random.uniform(80, 220) * (1.2 - p), 0).rotate(random.uniform(0, 360))
        parts.append([q, (mid - q) * 2.5, random.choice((a.color, b.color, (255, 255, 255))), 0.4, 3, 0.4])
    state["shake"] = max(state["shake"], 7 * p)
    if random.random() < dt * 8:
        ring(mid, 40 + 140 * p, random.choice((a.color, b.color)), 0.3, 3)
    if a.fuse_t <= 0:
        fuse(a, b)


# ---------- simulation ----------
def pick_target(e):
    if e.word in PICKUPS:
        return None
    if e.word in PARTNER and (p := nearest(e, lambda o: o.word == PARTNER[e.word] and not o.fusing)):
        return p  # halves hunt their other half
    if e.word in ("duck", "rubberduck") and (p := nearest(e, lambda o: o.word == "bug")):
        return p
    if e.word == "netcraft" and (p := nearest(e, lambda o: o.word == "hack")):
        return p
    return nearest(e, lambda o: o.word == "prize", 350) or nearest(e, fighter)

def contact(a, b, dt):
    if a.dead or b.dead:
        return
    if PARTNER.get(a.word) == b.word:
        if not a.fusing and not b.fusing:
            start_fuse(a, b)
        return
    for p, o in ((a, b), (b, a)):
        if p.word in PICKUPS and o.word not in PICKUPS:
            p.dead = p.silent = True
            burst(p.pos, p.color, 20)
            if p.word == "pizza":
                o.hp = min(o.maxhp, o.hp + 120)
                add_text(o.pos, "+120 hp", (120, 255, 120), F_S, 1)
            elif p.word == "coffee":
                o.boost = 5
                add_text(o.pos, "caffeinated!", (220, 160, 90), F_S, 1)
            else:
                o.r, o.maxhp, o.dps = min(40, o.r * 1.5), o.maxhp * 2, o.dps * 2
                o.hp = o.maxhp
                ring(o.pos, 120, (255, 215, 0), 0.6, 5)
                add_text(o.pos, f"{o.word.upper()} WON THE PRIZE", (255, 215, 0), F_M, 1.5)
            return
    if a.word in PICKUPS or b.word in PICKUPS:
        return
    d = b.pos - a.pos
    n = d.normalize() if d.length_squared() > 0.01 else V(1, 0)
    overlap = a.r + b.r - d.length()
    a.pos -= n * overlap / 2
    b.pos += n * overlap / 2
    a.vel -= n * 120  # hit and bounce off, not grind
    b.vel += n * 120
    for p, o in ((a, b), (b, a)):
        if p.word == "deploy":
            p.hp, p.killer = 0, "prod"
        elif (p.word in ("duck", "rubberduck") and o.word == "bug") or (p.word == "netcraft" and o.word == "hack"):
            o.hp, o.killer = 0, p.word
        elif p.word == "push":
            o.vel += away(o.pos, p.pos, 500)
        hurt(o, p.dps * 0.4 * (3 if p.dash else 1), p)  # each bounce is one hit
    burst((a.pos + b.pos) / 2, (255, 240, 200), 4, 160, 0.25)

def die(e):
    burst(e.pos, e.color, 18, 260)
    feed.insert(0, [f"{e.killer or '???'}  x  {e.word}", 4.0])
    del feed[8:]
    if e.word in ("segfault", "deploy"):
        explode(e.pos, 130, 70, e, (255, 90, 40))
        if e.word == "segfault":
            add_text(e.pos, "core dumped", (255, 90, 40), F_S, 1)
    elif e.word == "feature":
        spawnq.append(E("bug", e.pos))
        add_text(e.pos, "it's a bug now", (120, 255, 140), F_S, 1)

def step(dt):
    for n in nights:
        n[2] -= dt
        n[1] = min(n[1] + 260 * dt, 650) * (min(1, n[2]))  # spread out, then shrink away
        if not n[3].dead:
            n[0] = V(n[3].pos)
    nights[:] = [n for n in nights if n[2] > 0]
    state["shake"] = max(0, state["shake"] - 30 * dt)
    for e in ents:
        if e.dead:
            continue
        e.stun, e.slow, e.boost, e.dash, e.grace = (max(0, x - dt) for x in (e.stun, e.slow, e.boost, e.dash, e.grace))
        if e.fusing:
            if e.fusing.dead:
                e.fusing = None  # partner got sniped (incident.io / rubber duck)
            else:
                if e.id < e.fusing.id:
                    fusing_step(e, dt)
                continue
        e.retarget -= dt
        if e.retarget <= 0 or (e.target and e.target.dead):
            e.retarget = random.uniform(0.3, 0.6)
            e.target = pick_target(e)
        if e.dash > 0:
            parts.append([V(e.pos), V(), (255, 80, 80), 0.3, 6, 0.3])
        else:
            if e.target:
                want = away(e.target.pos, e.pos, e.speed)
            else:
                e.angle += random.uniform(-2, 2) * dt
                want = V(e.speed, 0).rotate_rad(e.angle)
            mul = 0 if e.stun else (0.4 if e.slow else 1) * (1.8 if e.boost else 1) * (0.5 if in_night(e.pos) else 1)
            e.vel += (want * mul - e.vel) * min(1, 3 * dt)
        e.pos += e.vel * dt
        for i, lim in ((0, W), (1, H)):
            if e.pos[i] < e.r:
                e.pos[i], e.vel[i] = e.r, abs(e.vel[i])
            elif e.pos[i] > lim - e.r:
                e.pos[i], e.vel[i] = lim - e.r, -abs(e.vel[i])
        e.cd -= dt
        if e.cd <= 0 and e.word in ABIL:
            e.cd = CD[e.word] * random.uniform(0.7, 1.3)
            ABIL[e.word](e)
        if e.word in AURA:
            AURA[e.word](e, dt)

    grid = {}  # spatial hash so collisions aren't O(n^2)
    for e in ents:
        if not e.dead:
            grid.setdefault((int(e.pos.x // 100), int(e.pos.y // 100)), []).append(e)
    for (cx, cy), cell in grid.items():
        for e in cell:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for o in grid.get((cx + dx, cy + dy), ()):
                        if o.id > e.id and e.pos.distance_squared_to(o.pos) < (e.r + o.r) ** 2:
                            contact(e, o, dt)

    for b in bullets:
        b[0] += b[1] * dt
        b[4] -= dt
        for o in ents:
            if o is not b[2] and not o.dead and fighter(o) and o.pos.distance_squared_to(b[0]) < o.r * o.r:
                hurt(o, 15, b[2])
                b[4] = 0
                break
    for w in waves:
        w[0] += 700 * dt
        for o in ents:
            if not o.dead and o.id not in w[1] and abs(o.pos.x - w[0]) < 40:
                w[1].add(o.id)
                hurt(o, 60, None)
                o.killer = "stackoverflow"
                o.vel.x += 400

    for e in ents:
        if not e.dead and e.hp <= 0:
            if e.lives:
                e.lives -= 1
                e.hp = e.maxhp
                ring(e.pos, 60, (120, 255, 120), 0.5)
                add_text(e.pos, "git reset --hard", (120, 255, 120), F_S, 1)
            else:
                e.dead = True
                die(e)
    ents[:] = [e for e in ents if not e.dead] + spawnq
    spawnq.clear()

    for p in parts:
        p[0] += p[1] * dt
        p[3] -= dt
    for lst in (rings, beams, texts):
        for x in lst:
            x[3] -= dt
    for t in texts:
        t[0].y -= 30 * dt
    for f in feed:
        f[1] -= dt
    if state["flash"]:
        state["flash"][1] -= dt
    parts[:] = [p for p in parts if p[3] > 0][-1500:]
    rings[:] = [x for x in rings if x[3] > 0]
    beams[:] = [x for x in beams if x[3] > 0]
    texts[:] = [x for x in texts if x[3] > 0]
    bullets[:] = [b for b in bullets if b[4] > 0]
    waves[:] = [w for w in waves if w[0] < W + 60]
    feed[:] = [f for f in feed if f[1] > 0]


# ---------- drawing ----------
def overlay(col, alpha):
    s = pygame.Surface((W, H))
    s.fill(col)
    s.set_alpha(int(alpha))
    world.blit(s, (0, 0))

NIGHT = pygame.Surface((256, 256), pygame.SRCALPHA)  # soft dark disc, pre-rendered once
for k, a in ((1, 55), (0.8, 100), (0.6, 140), (0.4, 175)):
    pygame.draw.circle(NIGHT, (0, 0, 25, a), (128, 128), 128 * k)

def draw():
    world.fill((14, 14, 22))
    for x in range(0, W, 64):
        pygame.draw.line(world, (24, 24, 36), (x, 0), (x, H))
    for y in range(0, H, 64):
        pygame.draw.line(world, (24, 24, 36), (0, y), (W, y))
    for w in waves:
        band = pygame.Surface((80, H), pygame.SRCALPHA)
        band.fill((60, 140, 255, 110))
        world.blit(band, (w[0] - 40, 0))
        for i, ch in enumerate("STACK OVERFLOW"):
            world.blit(F_M.render(ch, True, (220, 240, 255)), (w[0] - 8, 120 + i * 36))
    for pos, maxr, col, life, l0, wd in rings:
        r = int(maxr * (1 - life / l0)) + 2
        pygame.draw.circle(world, col, pos, r, max(1, min(wd, r)))
    for a, b, col, life, l0, wd in beams:
        pygame.draw.line(world, col, a, b, max(1, round(wd * life / l0)))
    t = pygame.time.get_ticks() / 1000
    for e in ents:
        if e.word in PARTNER and e.target and e.target.word == PARTNER[e.word]:
            c = max(0.0, 1 - e.pos.distance_to(e.target.pos) / 450)  # closer = hotter tether
            pulse = 0.5 + 0.5 * math.sin(t * (6 + 20 * c))
            col = (255, 255, int(120 + 135 * c * pulse))
            pygame.draw.line(world, col, e.pos, e.target.pos, 1 + int(4 * c * pulse))
            if c > 0.3 and random.random() < c:
                parts.append([e.pos.lerp(e.target.pos, random.random()), V(random.uniform(-40, 40), random.uniform(-40, 40)), col, 0.3, 3, 0.3])
        if e.fusing and e.id < e.fusing.id:
            p = 1 - e.fuse_t / FUSE_T
            mid = (e.pos + e.fusing.pos) / 2
            pygame.draw.circle(world, (255, 255, 255), mid, 20 + 110 * (1 - p), 2 + int(4 * p))
            pygame.draw.circle(world, e.color, mid, 10 + 30 * p * (0.5 + 0.5 * math.sin(t * 30)))
    for e in ents:
        if e.r >= 36:
            pygame.draw.circle(world, e.color, e.pos, e.r + 8 + 4 * math.sin(t * 6), 3)
        if e.stun:
            pygame.draw.circle(world, (240, 240, 255), e.pos, e.r + 4, 2)
        if e.boost:
            pygame.draw.circle(world, (255, 150, 60), e.pos, e.r + 4, 2)
        img = sprite(e.word, e.r)
        world.blit(img, img.get_rect(center=(round(e.pos.x), round(e.pos.y))))
        bw = e.r * 2
        x, y = e.pos.x - e.r, e.pos.y - e.r - 7
        pygame.draw.rect(world, (90, 20, 30), (x, y, bw, 4))
        pygame.draw.rect(world, (80, 230, 110), (x, y, bw * max(0, e.hp) / e.maxhp, 4))
        lb = label(e.word)
        world.blit(lb, lb.get_rect(midtop=(e.pos.x, e.pos.y + e.r + 1)))
    for b in bullets:
        world.blit(F_S.render(b[3], True, (90, 255, 120) if "+" in b[3] or "BUY" in b[3] else (255, 90, 90)), b[0])
    for pos, vel, col, life, size, l0 in parts:
        pygame.draw.circle(world, col, pos, size * life / l0 + 1)
    for pos, s, col, life, l0, font in texts:
        surf = font.render(s, True, col)
        surf.set_alpha(int(255 * min(1, 2 * life / l0)))
        world.blit(surf, surf.get_rect(center=pos))
    for c, r, life, src in nights:
        if r >= 2:
            img = pygame.transform.scale(NIGHT, (int(2 * r), int(2 * r)))
            world.blit(img, img.get_rect(center=(round(c.x), round(c.y))))
        pygame.draw.circle(world, (90, 100, 200), c, r, 2)
    if state["flash"] and state["flash"][1] > 0:
        col, life, l0 = state["flash"]
        overlay(col, 120 * life / l0)
    sh = state["shake"]
    screen.fill((0, 0, 0))
    screen.blit(world, (random.uniform(-sh, sh), random.uniform(-sh, sh)))

    screen.blit(F_M.render("WHACK ROYALE", True, (255, 230, 80)), (14, 10))
    screen.blit(F_S.render(f"SPACE = whack()   entities {len(ents)}   whack() calls {state['calls']}   "
                           f"fusions {state['fusions']}   I info   ESC quit", True, (200, 200, 210)), (14, 38))
    for i, (s, life) in enumerate(feed):
        surf = F_S.render(s, True, (255, 200, 200))
        surf.set_alpha(int(255 * min(1, life)))
        screen.blit(surf, surf.get_rect(topright=(W - 14, 12 + i * 18)))
    if state["last"]:
        s = "last whack(): " + " ".join(state["last"])
        screen.blit(F_S.render(s[:180] + ("..." if len(s) > 180 else ""), True, (150, 150, 170)), (14, H - 24))
    msg = None
    if not ents:
        msg = "PRESS SPACE TO whack()"
    elif len(ents) == 1:
        msg = f"LAST WORD STANDING: {ents[0].word.upper()}"
    if msg:
        surf = F_L.render(msg, True, (255, 230, 80))
        screen.blit(surf, surf.get_rect(center=(W / 2, H / 2 + 100)))


BOSS_INFO = [  # (fused name, the two halves, what it does)
    ("brevanhoward", "brevan", "howard", "Drains 10 HP/s from everything within 140px and heals itself"),
    ("marshallwace", "marshall", "wace", "330px laser sweeps a full circle, 90 dmg/s to anything it crosses"),
    ("capitalone", "capital", "one", "SWIPE! Dashes at a target every ~2.5s for triple bump damage"),
    ("incidentio", "incident", "io", "Every 6s wipes all bugs, segfaults, prod & conflicts"),
    ("rubberduck", "rubber", "duck", "debugging... zaps up to 6 bugs anywhere on screen every 3s"),
    ("nullpointer", "null", "pointer", "Segfault: 220px explosion (90 dmg), leaves 3 segfaults behind"),
    ("stackoverflow", "stack", "overflow", "A tidal wave sweeps the whole screen, 60 dmg to everything"),
    ("mergeconflict", "merge", "conflict", "<<<<<<< HEAD: 160px explosion (70 dmg), spawns 2 conflicts"),
]
_info = []

def draw_info():
    """Fusion cheat sheet, rendered once and cached."""
    if not _info:
        panel = pygame.Surface((W, H), pygame.SRCALPHA)
        panel.fill((8, 8, 16, 255))
        title = F_L.render("FUSIONS", True, (255, 230, 80))
        panel.blit(title, title.get_rect(center=(W / 2, 60)))
        sub = F_S.render("halves hunt each other down and fuse on contact   |   I to close",
                         True, (170, 170, 190))
        panel.blit(sub, sub.get_rect(center=(W / 2, 100)))
        for i, (name, a, b, desc) in enumerate(BOSS_INFO):
            x, y = 40 + (i % 2) * 620, 140 + (i // 2) * 150
            pygame.draw.rect(panel, (30, 30, 46), (x, y, 580, 130), border_radius=10)
            if name in STATS:  # a boss unit: show the full logo
                img = sprite(name, 40)
                panel.blit(img, img.get_rect(center=(x + 60, y + 65)))
                kind, col = f"BOSS  {STATS[name][0]} HP", (120, 255, 140)
            else:  # an instant event: show the two halves
                ia, ib = sprite(a, 21), sprite(b, 21)
                panel.blit(ia, ia.get_rect(midright=(x + 58, y + 65)))
                panel.blit(ib, ib.get_rect(midleft=(x + 62, y + 65)))
                kind, col = "INSTANT EVENT", (255, 160, 80)
            panel.blit(F_M.render(f"{a.upper()} + {b.upper()}", True, (255, 255, 160)), (x + 120, y + 22))
            panel.blit(F_S.render(kind, True, col), (x + 120, y + 52))
            panel.blit(F_S.render(desc, True, (220, 220, 230)), (x + 120, y + 80))
        _info.append(panel)
    screen.blit(_info[0], (0, 0))


def main():
    clock = pygame.time.Clock()
    while True:
        dt = min(clock.tick(60) / 1000, 0.05)
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT or (ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE):
                return
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_SPACE:
                spawn_wave(V(W / 2 + random.uniform(-200, 200), H / 2 + random.uniform(-120, 120)))
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_i:
                state["info"] = not state["info"]
        if not state["info"]:  # info screen pauses the battle
            step(dt)
        draw()
        if state["info"]:
            draw_info()
        pygame.display.flip()


def selftest():
    """Headless: every word + every pair on the field, sim 15s, check fusions happen. Saves screenshot.png."""
    random.seed(3)
    for w in WORDS:
        ents.append(E(w, (random.uniform(60, W - 60), random.uniform(60, H - 60))))
    for a, b in PAIRS.items():  # put halves close so they find each other
        p = V(random.uniform(200, W - 200), random.uniform(200, H - 200))
        ents.extend([E(a, p - V(80, 0)), E(b, p + V(80, 0))])
    spawn_wave(V(W / 2, H / 2))
    for i in range(900):
        step(1 / 60)
        if i == 150:
            draw()
            pygame.image.save(screen, "screenshot.png")
    assert state["fusions"] >= 6, state["fusions"]
    assert state["calls"] >= 1
    print(f"selftest ok: {state['fusions']} fusions, {state['calls']} whack() calls, {len(ents)} alive")


if __name__ == "__main__":
    selftest() if TEST else main()
    pygame.quit()
