"""Pathfinding for the whack() Doom player.

Turns the level's walls into a grid, remembers which parts of the map we've
been to, and finds the shortest route (breadth-first search) to the nearest
place we haven't been yet, through doors if need be.
"""
import math

import numpy as np

CELL = 16       # grid resolution in map units (the player is 32 wide)
REACH = 10      # cells: anywhere this short a walk from where we've been counts as explored
MAX_STEP = 24   # tallest step the player can walk up
MIN_GAP = 56    # the player is 56 tall: lower openings are closed doors
LOOKAHEAD = 6   # steer at the path cell this many steps ahead


def read_walls(sectors):
    """Every line in the level: (x1, y1, x2, y2, blocking, [(floor, ceiling) of each side])."""
    lines = {}
    for sector in sectors:
        for line in sector.lines:
            key = tuple(sorted([(line.x1, line.y1), (line.x2, line.y2)]))
            entry = lines.setdefault(key, [False, []])
            entry[0] = entry[0] or line.is_blocking
            entry[1].append((sector.floor_height, sector.ceiling_height))
    return [(a[0], a[1], b[0], b[1], blocking, sides) for (a, b), (blocking, sides) in lines.items()]


def grow(mask):
    """mask plus every cell next to it (up, down, left, right)."""
    out = mask.copy()
    out[1:] |= mask[:-1]
    out[:-1] |= mask[1:]
    out[:, 1:] |= mask[:, :-1]
    out[:, :-1] |= mask[:, 1:]
    return out


class Pathfinder:
    def __init__(self, walls):
        xs = [v for w in walls for v in (w[0], w[2])]
        ys = [v for w in walls for v in (w[1], w[3])]
        self.x0, self.y0 = min(xs) - 2 * CELL, min(ys) - 2 * CELL
        self.w = int((max(xs) - self.x0) // CELL) + 3
        self.h = int((max(ys) - self.y0) // CELL) + 3
        solid = np.zeros((self.h, self.w), bool)
        self.doors = np.zeros((self.h, self.w), bool)
        for x1, y1, x2, y2, blocking, sides in walls:
            if blocking:
                kind = "wall"
            elif len(sides) == 2:
                (f1, c1), (f2, c2) = sides
                if abs(f1 - f2) > MAX_STEP:
                    kind = "wall"  # ledge or lift: too tall to step up
                elif min(c1, c2) - max(f1, f2) < MIN_GAP:
                    kind = "door"  # closed door (or a low gap): pressing use should open it
                else:
                    continue  # open archway or a step
            else:
                continue
            cx, cy = self._cells_along(x1, y1, x2, y2)
            (solid if kind == "wall" else self.doors)[cy, cx] = True
        self.free = ~grow(solid)  # keep the player's body clear of walls
        self.visited = np.zeros((self.h, self.w), bool)
        self.blocked_until = np.zeros((self.h, self.w), np.int32)  # places we got stuck, for a while
        self.clock = 0  # counts replans
        self.path = None

    def _cells_along(self, x1, y1, x2, y2):
        n = max(2, int(math.hypot(x2 - x1, y2 - y1) / (CELL / 4)))
        t = np.linspace(0, 1, n)
        return self.to_cell(x1 + t * (x2 - x1), y1 + t * (y2 - y1))

    def to_cell(self, x, y):
        cx = np.clip(((np.asarray(x) - self.x0) // CELL).astype(int), 0, self.w - 1)
        cy = np.clip(((np.asarray(y) - self.y0) // CELL).astype(int), 0, self.h - 1)
        return cx, cy

    def to_world(self, cell):
        return self.x0 + (cell[0] + 0.5) * CELL, self.y0 + (cell[1] + 0.5) * CELL

    def visit(self, x, y):
        """Mark everywhere a short walk from here as explored. Walking distance, so walls block it."""
        cx, cy = (int(v) for v in self.to_cell(x, y))
        free = self.free.copy()
        free[cy, cx] = True
        seen = np.zeros_like(free)
        seen[cy, cx] = True
        for _ in range(REACH):
            seen = grow(seen) & free
        self.visited |= seen

    def replan(self, x, y):
        """Breadth-first search from (x, y) to the nearest unexplored cell we can walk to."""
        sx, sy = (int(v) for v in self.to_cell(x, y))
        self.clock += 1
        free = self.free & (self.blocked_until <= self.clock)
        free[sy, sx] = True
        goal = free & ~self.visited
        dist = np.full(free.shape, -1, np.int32)
        dist[sy, sx] = 0
        frontier = np.zeros_like(free)
        frontier[sy, sx] = True
        end = None
        for d in range(1, self.w * self.h):
            grown = grow(frontier) & free & (dist < 0)
            if not grown.any():
                break  # explored everything we can reach
            dist[grown] = d
            hits = np.argwhere(grown & goal)
            if len(hits):
                end = (int(hits[0][1]), int(hits[0][0]))
                break
            frontier = grown
        if end is None:
            self.path = None
            return
        # walk back downhill from the goal to where we are
        path, (cx, cy) = [end], end
        while dist[cy, cx] > 0:
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < self.w and 0 <= ny < self.h and dist[ny, nx] == dist[cy, cx] - 1:
                    cx, cy = nx, ny
                    break
            path.append((cx, cy))
        self.path = path[::-1]

    def waypoint(self, x, y):
        """The point a little way along the path from where we are now."""
        if not self.path:
            return None
        cx, cy = (int(v) for v in self.to_cell(x, y))
        near = min(range(min(len(self.path), 40)),
                   key=lambda i: abs(self.path[i][0] - cx) + abs(self.path[i][1] - cy))
        return self.path[min(near + LOOKAHEAD, len(self.path) - 1)], near

    def steer(self, x, y, facing):
        """Degrees to turn to follow the path (+ is right), whether a door is coming up, and distance left."""
        found = self.waypoint(x, y)
        if found is None:
            return None
        cell, near = found
        wx, wy = self.to_world(cell)
        bearing = math.degrees(math.atan2(wy - y, wx - x))
        turn = (bearing - facing + 180) % 360 - 180  # Doom angles go anticlockwise
        upcoming = self.path[near:near + LOOKAHEAD + 4]
        door = any(self.doors[c[1], c[0]] for c in upcoming)
        return -turn, door, (len(self.path) - near) * CELL

    def block_ahead(self, x, y, replans=40):
        """We're stuck: route around the next bit of path for a while (40 replans is about 9 seconds),
        in case it was a door that was slow to open or a monster in the way."""
        found = self.waypoint(x, y)
        if found is None:
            return
        cx, cy = found[0]
        self.blocked_until[max(0, cy - 1):cy + 2, max(0, cx - 1):cx + 2] = self.clock + replans
        self.path = None
