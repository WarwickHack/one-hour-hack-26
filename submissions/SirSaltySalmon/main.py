"""Can whack() run Doom?

Every call to whack() writes a fresh "whack" file. We treat that file as a
controller tape: each word on it is a button press, played into the real Doom
engine (ViZDoom + the free Freedoom game files). The screen is drawn in your
terminal using the words on the tape as the pixels.
"""
import argparse
import math
import os
from collections import deque
import shutil
import sys
import time

import numpy as np
import vizdoom as vzd

from pathfinder import Pathfinder, read_walls
from whack import whack

WAD = os.path.join(os.path.dirname(vzd.__file__), "freedoom2.wad")  # Freedoom: free Doom levels

TICS_PER_WORD = 4  # Doom runs at 35 tics a second, so about 9 words a second
TICS_PER_FRAME = 2  # draw every other tic so the terminal can keep up

F, BACK, TL, TR, SL, SR, FIRE, USE, RUN, AIM = range(10)
BUTTONS = [
    vzd.Button.MOVE_FORWARD, vzd.Button.MOVE_BACKWARD, vzd.Button.TURN_LEFT,
    vzd.Button.TURN_RIGHT, vzd.Button.MOVE_LEFT, vzd.Button.MOVE_RIGHT,
    vzd.Button.ATTACK, vzd.Button.USE, vzd.Button.SPEED,
    vzd.Button.TURN_LEFT_RIGHT_DELTA,  # turn by an exact angle, positive = right
]
BUTTON_NAMES = ["FORWARD", "BACK", "TURN-L", "TURN-R", "STRAFE-L", "STRAFE-R", "FIRE", "USE", "RUN", "AIM"]

# When a monster is on screen, these words aim at it instead of wandering
GUIDED = {F, TL, TR, FIRE}
MONSTERS = {
    "Zombieman", "ShotgunGuy", "ChaingunGuy", "DoomImp", "Demon", "Spectre", "LostSoul",
    "Cacodemon", "HellKnight", "BaronOfHell", "Arachnotron", "PainElemental", "Revenant",
    "Fatso", "Archvile", "SpiderMastermind", "Cyberdemon", "WolfensteinSS",
}

# What each of the 42 words does.
CONTROLS = {
    # shipping moves you forward
    "push": {F}, "merge": {F}, "commit": {F}, "feature": {F}, "hack": {F}, "pitch": {F},
    "deploy": {F, RUN}, "prod": {F, RUN}, "pizza": {F, RUN}, "coffee": {F, RUN},
    # violence
    "whack": {FIRE}, "bug": {FIRE}, "segfault": {FIRE}, "null": {FIRE}, "pointer": {FIRE},
    "incident": {FIRE}, "demo": {F, FIRE}, "prize": {F, FIRE},
    # geese and sponsors steer
    "goose": {TL}, "warwick": {TL}, "compsoc": {TL}, "marshall": {TL}, "wace": {TL},
    "one": {TL}, "netcraft": {TL},
    "honk": {TR}, "oculus": {TR}, "brevan": {TR}, "howard": {TR}, "capital": {TR},
    "bloomberg": {TR},
    # ducks dodge
    "duck": {SL}, "quack": {SR},
    # things going wrong knock you back
    "conflict": {BACK}, "overflow": {BACK}, "stack": {BACK},
    # I/O opens doors
    "io": {USE, F}, "rubber": {USE, F}, "wifi": {USE}, "semicolon": {USE},
    # and sometimes you just pass out
    "sleep": set(), "midnight": set(),
}


PICKUPS = {"Health", "Ammo", "Weapon", "Armor", "Powerup", "Key"}
WALL_TOO_CLOSE = 30  # depth buffer units
KNOCK_TICS = 24  # tap use at a wall for this long before giving up on it being a door
PATH_KINDS = ("HEADING TO", "DOOR AHEAD")
STUCK_TICS = 70  # 2 seconds on the route without getting anywhere means that way is blocked


def screen_angle(x, width):
    """Degrees to turn to face column x of the screen (90 degree field of view, + is right)."""
    return math.degrees(math.atan((x - width / 2) / (width / 2)))


def biggest(labels):
    return max(labels, key=lambda label: label.width * label.height, default=None)


def open_way(state):
    """Which way the corridor goes (the most distant wall at eye level), and how close the wall ahead is."""
    depth = state.depth_buffer
    h, w = depth.shape
    far = depth[int(h * 0.45):int(h * 0.55)].min(axis=0).astype(np.float32)
    ahead = float(far[w * 3 // 8:w * 5 // 8].mean())
    far = np.convolve(far, np.ones(w // 16) / (w // 16), mode="same")
    far -= np.abs(np.arange(w) - w / 2) * 0.05  # if it's a tie, keep going straight
    col = int(np.argmax(far))
    if far[col] < WALL_TOO_CLOSE:  # boxed in: turn round
        return 60.0, ahead
    return screen_angle(col, w), ahead


def plan(state, bored, route):
    """Where the words should point: a monster, else a pickup, else the route somewhere new."""
    width = state.screen_buffer.shape[1]
    monster = biggest([l for l in state.labels
                       if (l.object_name in MONSTERS or l.object_category == "Monster")
                       and l.height >= l.width * 0.8])  # lying flat means already dead
    if monster:
        return "LOCKED ON", monster.object_name, screen_angle(monster.x + monster.width / 2, width)
    item = None if bored else biggest([l for l in state.labels if l.object_category in PICKUPS])
    if item:
        return "GOING FOR", item.object_name, screen_angle(item.x + item.width / 2, width)
    if route is not None:  # the pathfinder knows the way to somewhere we haven't been
        turn, door, left = route
        return ("DOOR AHEAD" if door else "HEADING TO"), f"new ground, {left} units", turn
    # explored everything we can reach: fall back to wandering down corridors
    angle, ahead = open_way(state)
    if ahead < WALL_TOO_CLOSE:
        return "WALL AHEAD", "turning", angle
    if bored:  # been in this room too long: every move word heads for the way out
        return "BORED", "next room", angle
    return "EXPLORING", "open space", angle


def held_buttons(word, goal):
    held = set(CONTROLS.get(word, set()))
    kind, _, angle = goal
    if kind == "LOCKED ON":
        if held & GUIDED:
            held = (held - {TL, TR}) | {AIM}
            if FIRE in held and abs(angle) > 4:
                held.discard(FIRE)  # hold fire until lined up
        return held
    if FIRE in held:  # nothing to shoot, so whack the wall instead: opens doors
        held = (held - {FIRE}) | {USE, F}
    if kind in PATH_KINDS:  # follow the route: face along it, walk once roughly lined up
        if held & {F, TL, TR, BACK, USE}:
            held = (held - {TL, TR, BACK}) | {AIM}
            held = held | {F} if abs(angle) < 45 else held - {F}
            if kind == "DOOR AHEAD":
                held.add(USE)
        return held
    if kind == "KNOCKING":  # wall right ahead might be a door, so try opening it first
        return {USE, F} if held else held
    if kind == "WALL AHEAD":  # face the open way before walking on
        if held & {F, TL, TR, BACK}:
            held = (held - {F, TL, TR, BACK, RUN}) | {AIM}
        return held
    if kind == "BORED":
        if held & {F, TL, TR, BACK}:
            held = (held - {TL, TR, BACK}) | {F, AIM, RUN}
        return held
    if held & ({F, TL, TR} if kind == "GOING FOR" else {F}):
        held = (held - {TL, TR}) | {AIM}
    return held


def steer(word, goal):
    held = held_buttons(word, goal)
    action = [1.0 if b in held else 0.0 for b in range(len(BUTTONS))]
    if AIM in held:  # turn towards the goal with the ordinary turn buttons
        action[AIM] = 0.0
        if goal[2] > 2:
            action[TR] = 1.0
        elif goal[2] < -2:
            action[TL] = 1.0
        if abs(goal[2]) > 15:
            action[RUN] = 1.0  # turns twice as fast
    return action


def describe(word, goal):
    return "+".join(BUTTON_NAMES[b] for b in sorted(held_buttons(word, goal))) or "zzz"


def make_game(window):
    game = vzd.DoomGame()
    game.set_doom_game_path(WAD)
    game.set_doom_map("map01")
    game.set_doom_skill(1)
    game.set_screen_resolution(vzd.ScreenResolution.RES_640X480)
    game.set_screen_format(vzd.ScreenFormat.RGB24)
    game.set_render_hud(window)
    game.set_render_weapon(True)
    game.set_render_crosshair(False)
    game.set_window_visible(window)
    game.set_sound_enabled(False)
    game.set_episode_timeout(0)
    game.set_available_buttons(BUTTONS)
    game.set_labels_buffer_enabled(True)  # tells us what's on screen, so words can aim
    game.set_depth_buffer_enabled(True)  # tells us which way is open, so words can find the way
    game.set_available_game_variables([
        vzd.GameVariable.HEALTH, vzd.GameVariable.KILLCOUNT, vzd.GameVariable.SELECTED_WEAPON_AMMO,
        vzd.GameVariable.POSITION_X, vzd.GameVariable.POSITION_Y, vzd.GameVariable.ANGLE,
    ])
    game.set_mode(vzd.Mode.PLAYER)
    game.init()
    return game


def level_walls(level):
    """The level's walls, read once from a hidden copy of the game (too slow to fetch every tic)."""
    probe = vzd.DoomGame()
    probe.set_doom_game_path(WAD)
    probe.set_doom_map(f"map{level:02d}")
    probe.set_window_visible(False)
    probe.set_sound_enabled(False)
    probe.set_sectors_info_enabled(True)
    probe.init()
    walls = read_walls(probe.get_state().sectors)
    probe.close()
    return walls


def to_cells(rgb, text, cols, rows):
    """Shrink a Doom frame to a grid of letters taken from the tape."""
    h, w, _ = rgb.shape
    ys = np.linspace(0, h - 1, rows).astype(int)
    xs = np.linspace(0, w - 1, cols).astype(int)
    small = rgb[ys][:, xs].astype(np.float32)
    lum = small.mean(axis=2)
    # Doom is dark, so brighten it, then round colours so we print fewer colour codes
    base = np.clip(small * 1.6, 0, 255)
    bg = (base * 0.55).astype(int) // 16 * 16
    fg = np.clip(base * 1.25 + 40, 0, 255).astype(int) // 24 * 24 + 12
    letters = np.array(list(text))[np.arange(rows * cols) % len(text)].reshape(rows, cols)
    chars = np.where(lum > 90, np.char.upper(letters), letters)
    colors = np.concatenate([bg, fg], axis=2)  # one (bg, fg) colour pair per cell
    return colors.tolist(), chars.tolist()


def to_ansi(colors, chars):
    lines = []
    for color_row, char_row in zip(colors, chars):
        parts, prev = [], None
        for col, ch in zip(color_row, char_row):
            if col != prev:
                parts.append("\x1b[48;2;%d;%d;%d;38;2;%d;%d;%dm" % tuple(col))
                prev = col
            parts.append(ch)
        lines.append("".join(parts) + "\x1b[0m\x1b[K")
    return "\n".join(lines)


def hud(n, tape, i, game_vars, goal, kills, level, deaths, cols):
    hp, ammo = int(game_vars[0]), int(game_vars[2])
    word = tape[i]
    ticker = " ".join(tape[max(0, i - 3):i] + [f"[{word.upper()}]"] + tape[i + 1:i + 12])
    lines = [
        f" whack() #{n} | word {i + 1}/{len(tape)}: {word.upper()} -> {describe(word, goal)}",
        f" MAP{level:02d} | HP {hp} | KILLS {kills} | AMMO {ammo} | DEATHS {deaths} | {goal[0]}: {goal[1].upper()}",
        f" tape: {ticker}",
    ]
    return [line[:cols].ljust(cols) for line in lines]


class Recorder:
    """Saves what the terminal shows as a GIF, for the README."""

    def __init__(self, path, cols=72, rows=27, max_frames=60):
        from PIL import Image, ImageDraw, ImageFont
        self.Image, self.ImageDraw = Image, ImageDraw
        self.path, self.cols, self.rows, self.max_frames = path, cols, rows, max_frames
        self.frames, self.saved, self.count = [], False, 0
        for name in ("consola.ttf", "DejaVuSansMono.ttf", "Menlo.ttc", "cour.ttf"):
            try:
                self.font = ImageFont.truetype(name, 11)
                break
            except OSError:
                continue
        else:
            self.font = ImageFont.load_default()
        self.cw = self.font.getlength("M")
        self.ch = self.font.getbbox("Mg")[3] + 2  # bottom of the tallest letters

    def add(self, rgb, text, hud_lines):
        self.count += 1
        if self.saved or self.count % 2:  # every other frame keeps the file small
            return
        colors, chars = to_cells(rgb, text, self.cols, self.rows)
        img = self.Image.new("RGB", (int(self.cw * self.cols) + 8, int(self.ch * (self.rows + 4)) + 8))
        draw = self.ImageDraw.Draw(img)
        for r, (color_row, char_row) in enumerate(zip(colors, chars)):
            c, y = 0, 4 + r * self.ch
            while c < self.cols:
                start, col = c, color_row[c]
                while c < self.cols and color_row[c] == col:
                    c += 1
                x0, x1 = 4 + start * self.cw, 4 + c * self.cw
                draw.rectangle((x0, y, x1, y + self.ch), fill=tuple(col[:3]))
                draw.text((x0, y), "".join(char_row[start:c]), font=self.font, fill=tuple(col[3:]))
        for k, line in enumerate(hud_lines):
            draw.text((4, 4 + (self.rows + 1 + k) * self.ch), line[:self.cols], font=self.font,
                      fill=(255, 220, 90) if k == 0 else (200, 200, 200))
        # the real game frame next to the word version
        height = int(self.ch * self.rows)
        frame = self.Image.fromarray(rgb).resize((height * 4 // 3, height))
        both = self.Image.new("RGB", (img.width + frame.width + 4, img.height))
        both.paste(img, (0, 0))
        both.paste(frame, (img.width, 4))
        self.frames.append(both.quantize(colors=64))
        if len(self.frames) >= self.max_frames:
            self.save()

    def save(self):
        if self.saved or not self.frames:
            return
        self.frames[0].save(self.path, save_all=True, append_images=self.frames[1:],
                            duration=1000 * TICS_PER_FRAME * 2 // 35, loop=0)
        self.saved = True


def main():
    parser = argparse.ArgumentParser(description="Doom, played by whack().")
    parser.add_argument("--rounds", type=int, default=0, help="stop after this many whack() calls (0 = never)")
    parser.add_argument("--no-window", action="store_true", help="terminal only, for machines without a screen")
    parser.add_argument("--gif", metavar="FILE", help="record the first ~12 seconds to a GIF")
    args = parser.parse_args()

    os.chdir(os.path.dirname(os.path.abspath(__file__)))  # keep the whack file and ViZDoom's config in here
    os.system("")  # switches on colour codes in the Windows console
    try:
        game = make_game(window=not args.no_window)
    except Exception:  # no screen to open a window on: terminal only
        game = make_game(window=False)
    recorder = Recorder(args.gif) if args.gif else None
    term_cols, term_rows = shutil.get_terminal_size((100, 40))
    cols = min(term_cols - 1, 160)
    rows = max(10, min(term_rows - 5, int(cols * 0.375)))  # 4:3 screen, characters twice as tall as wide

    n, level, deaths, tic, kills, level_kills = 0, 1, 0, 0, 0, 0
    trail, explored, bored = deque(maxlen=105), set(), False  # last 3 seconds of 128-unit squares
    wall_tics = 0  # how long a wall has been right in front of us
    nav, nav_level, moved = None, 0, deque(maxlen=STUCK_TICS)  # pathfinder, and where we've been lately
    next_frame = time.perf_counter()
    sys.stdout.write("\x1b[2J\x1b[?25l")
    try:
        while not args.rounds or n < args.rounds:
            n += 1
            whack()
            # whack() wrote the tape to disk: play it back like a cartridge
            with open("whack", encoding="utf-8") as tape_file:
                tape = tape_file.read().split()
            text = "".join(tape)
            for i, word in enumerate(tape):
                for _ in range(TICS_PER_WORD):
                    if game.is_episode_finished():
                        if game.is_player_dead():
                            deaths += 1
                        else:  # whack() finished the level
                            level = level % 32 + 1
                            game.set_doom_map(f"map{level:02d}")
                        game.new_episode()
                        level_kills = 0
                        trail.clear()
                    state = game.get_state()
                    cell = (level, int(state.game_variables[3]) // 128, int(state.game_variables[4]) // 128)
                    trail.append(cell)
                    explored.add(cell)
                    if len(trail) == trail.maxlen and len(set(trail)) <= 4:
                        bored = True  # 3 seconds in the same few squares
                    elif len(set(trail)) >= 8:
                        bored = False
                    if nav is None or nav_level != level:
                        nav, nav_level = Pathfinder(level_walls(level)), level
                    x, y, facing = (float(v) for v in state.game_variables[3:6])
                    nav.visit(x, y)
                    if tic % 8 == 0:
                        nav.replan(x, y)
                    goal = plan(state, bored, nav.steer(x, y, facing))
                    if goal[0] in PATH_KINDS:
                        moved.append((x, y))
                        if len(moved) == STUCK_TICS and math.dist(moved[0], moved[-1]) < 32:
                            nav.block_ahead(x, y)  # can't get through: find another way
                            moved.clear()
                    else:
                        moved.clear()
                    wall_tics = wall_tics + 1 if goal[0] == "WALL AHEAD" else 0
                    if 0 < wall_tics <= KNOCK_TICS:
                        goal = ("KNOCKING", "door?", 0.0)
                    action = steer(word, goal)
                    if goal[0] in ("KNOCKING", "DOOR AHEAD") and tic % 2:
                        action[USE] = 0.0  # tap use rather than hold it, Doom only opens on a press
                    game.make_action(action)
                    tic += 1
                    level_now = int(state.game_variables[1])
                    if level_now > level_kills:
                        kills += level_now - level_kills
                        level_kills = level_now
                    if tic % TICS_PER_FRAME:
                        continue
                    lines = hud(n, tape, i, state.game_variables, goal, kills, level, deaths, cols)
                    if recorder:
                        recorder.add(state.screen_buffer, text, lines)
                    screen = to_ansi(*to_cells(state.screen_buffer, text, cols, rows))
                    sys.stdout.write("\x1b[H" + screen + "\n\x1b[33m" + "\n".join(lines) + "\x1b[0m")
                    sys.stdout.flush()
                    next_frame += TICS_PER_FRAME / 35
                    time.sleep(max(0.0, next_frame - time.perf_counter()))
                    next_frame = max(next_frame, time.perf_counter() - 0.5)
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\x1b[0m\x1b[?25h\n")
        game.close()
        print(f"{n} whack() tapes played: {kills} kills, {deaths} deaths, "
              f"{len(explored)} squares explored, reached MAP{level:02d}")
        if recorder:
            recorder.save()
            print(f"saved {args.gif}")


if __name__ == "__main__":
    main()
