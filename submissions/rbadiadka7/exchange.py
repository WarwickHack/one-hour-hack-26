"""THE WHACK EXCHANGE: a stock market where whack() is the only source of truth.

Every trading tick calls whack(). The words it writes ARE the market:
mentions move prices, word pairs trigger corporate events, and the
`whack` file is read back as the official trade tape.

There is no other randomness in this program. If the market crashes,
blame whack().

    python3 exchange.py        # opens http://localhost:8026
"""
import json
import math
import os
import sys
import threading
import webbrowser
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)  # whack() writes its file here: that's our trade tape
sys.path.insert(0, HERE)
from whack import whack, WORDS  # noqa: E402  (unmodified!)

PORT = 8026

STOCKS = {
    "DUCK":  ("Duck Dynamics plc",        ["duck", "quack", "rubber"], 42.00),
    "HONK":  ("Goose Holdings (Hostile)", ["goose", "honk"],           13.37),
    "BBG":   ("Bloomberg Terminal Co",    ["bloomberg"],               88.00),
    "BRVH":  ("Brevan Howard",            ["brevan", "howard"],        120.0),
    "COF":   ("Capital One",              ["capital", "one"],          99.00),
    "MWACE": ("Marshall Wace",            ["marshall", "wace"],        77.00),
    "NCFT":  ("Netcraft",                 ["netcraft"],                64.00),
    "INCD":  ("incident.io",              ["incident", "io"],          50.00),
    "OCLS":  ("Oculus",                   ["oculus"],                  30.00),
    "PIZZA": ("Pizza Futures (Hawaiian)", ["pizza"],                   9.99),
    "JAVA":  ("Coffee Futures",           ["coffee"],                  4.20),
    "SLEEP": ("Sleep Inc (Bankrupt-ish)", ["sleep"],                   8.00),
    "BUGF":  ("Bug & Feature LLP",        ["bug", "feature"],          25.00),
    "PROD":  ("Deploy-to-Prod Corp",      ["deploy", "prod", "push", "commit", "merge"], 60.00),
}
SYMS = list(STOCKS)


class Market:
    def __init__(self):
        self.lock = threading.Lock()
        self.tick = 0
        self.price = {s: STOCKS[s][2] for s in SYMS}
        self.hist = {s: [STOCKS[s][2]] for s in SYMS}
        self.index_hist = [1000.0]
        self.news = []
        self.fund_cash, self.fund_pos, self.fund_sym = 1000.0, 0.0, None
        self.fund_hist = [1000.0]
        self.last = {}

    def index(self):
        return 1000.0 * sum(self.price[s] / STOCKS[s][2] for s in SYMS) / len(SYMS)

    def fund_value(self):
        held = self.fund_pos * self.price[self.fund_sym] if self.fund_sym else 0
        return self.fund_cash + held

    def step(self):
        with self.lock:
            return self._step()

    def _step(self):
        self.tick += 1
        words = whack()                         # <- the entire market
        with open("whack", encoding="utf-8") as f:   # <- official trade tape
            tape = f.read().split()
        n = len(words)
        c = Counter(words)
        before = dict(self.price)
        move = {s: 0.0 for s in SYMS}
        events = []

        def ev(kind, text):
            events.append({"kind": kind, "text": text})

        # 1. Supply & demand: mentions vs what you'd expect from n random words
        for s in SYMS:
            m = sum(c[w] for w in STOCKS[s][1])
            expected = n * len(STOCKS[s][1]) / len(WORDS)
            demand = 0.03 * (m - expected)
            if s == "SLEEP":   # talking about sleep != getting it
                demand = -abs(demand) - 0.01
            move[s] += demand + 0.06 * math.log(STOCKS[s][2] / self.price[s])  # gravity

        # 2. Corporate events from adjacent word pairs
        pairs = list(zip(words, words[1:]))
        seen = set()
        for i, (a, b) in enumerate(pairs):
            key = (a, b)
            if key in seen:
                continue
            seen.add(key)
            victim = SYMS[(i * 7 + n) % len(SYMS)]
            other = SYMS[(i * 3 + n + 5) % len(SYMS)]
            if key == ("capital", "one"):
                move["COF"] += 0.10; ev("up", "CAPITAL ONE says its own name correctly, shares soar")
            elif key == ("brevan", "howard"):
                move["BRVH"] += 0.10; ev("up", "BREVAN HOWARD spotted in correct order, macro desk rejoices")
            elif key == ("marshall", "wace"):
                move["MWACE"] += 0.10; ev("up", "MARSHALL WACE assembles, quant funds in awe")
            elif key == ("incident", "io"):
                move["INCD"] += 0.12; ev("up", "INCIDENT.IO declares incident. Business is booming")
            elif key == ("rubber", "duck"):
                move["DUCK"] += 0.15; ev("up", "RUBBER DUCK debugging adopted by entire FTSE 100")
            elif key in (("goose", "duck"), ("honk", "duck"), ("honk", "quack")):
                move["HONK"] += 0.12; move["DUCK"] -= 0.12
                ev("down", "HOSTILE TAKEOVER: Goose Holdings honks at Duck Dynamics")
            elif key == ("stack", "overflow"):
                for s in SYMS:
                    move[s] -= 0.04
                ev("crash", "STACK OVERFLOW: circuit breakers tripped across the floor")
            elif key == ("null", "pointer"):
                move[victim] -= 0.30; ev("crash", f"NULL POINTER: {victim} dereferenced, 30% of it no longer exists")
            elif key == ("merge", "conflict") and victim != other:
                self.price[victim], self.price[other] = self.price[other], self.price[victim]
                ev("crash", f"MERGE CONFLICT: {victim} and {other} accidentally swapped share prices")
            elif key == ("deploy", "prod"):
                move["PROD"] -= 0.15; ev("down", "DEPLOY-TO-PROD CORP deploys to prod. On a Saturday. Shares tank")
            elif key == ("pizza", "midnight") or key == ("midnight", "pizza"):
                move["PIZZA"] += 0.25; ev("up", "MIDNIGHT PIZZA SHORTAGE: Hawaiian futures go parabolic")
            elif key == ("coffee", "coffee"):
                move["JAVA"] += 0.08; ev("up", "DOUBLE ESPRESSO detected, coffee futures caffeinated")
            elif key == ("bug", "feature") or key == ("feature", "bug"):
                move["BUGF"] += 0.20; ev("up", "BUG RECLASSIFIED AS FEATURE. Analysts: 'genius'")
            elif key == ("push", "prod"):
                move["PROD"] -= 0.08; ev("down", "git push --force to prod. Compliance has been notified")
            elif key in (("pitch", "prize"), ("demo", "prize")):
                move["DUCK"] += 0.1; ev("up", "WHACK PRIZE CEREMONY: mini projector now valued at $1B")
            elif key == ("demo", "pitch"):
                for s in SYMS:
                    move[s] += 0.02
                ev("up", "DEMO + PITCH: investors briefly forget what anything does")

        # 3. Macro words
        if c["segfault"]:
            for s in SYMS:
                move[s] -= 0.006 * c["segfault"]
            if c["segfault"] >= 2:
                ev("crash", f"SEGFAULT x{c['segfault']}: market core dumped")
        if c["midnight"]:
            for s in SYMS:
                move[s] *= 1 + 0.2 * min(c["midnight"], 3)
            if c["midnight"] >= 3:
                ev("info", f"MIDNIGHT x{c['midnight']}: after-hours volatility amplified")
        halted = c["wifi"] >= 3
        if halted:
            move = {s: 0.0 for s in SYMS}
            ev("crash", f"WIFI DOWN ({c['wifi']} reports): trading halted. Everyone stares at the router")
        if n == 1:
            ev("info", f"LIQUIDITY CRISIS: whack() traded a single word ('{words[0]}')")
        if n >= 95:
            for s in SYMS:
                move[s] += 0.03
            ev("up", f"WHACK BUBBLE: {n} words traded, irrational exuberance")

        # 4. Apply moves
        for s in SYMS:
            pct = max(-0.6, min(0.6, move[s]))
            self.price[s] = max(0.01, round(self.price[s] * (1 + pct), 2))
            self.hist[s] = (self.hist[s] + [self.price[s]])[-120:]
        chg = {s: (self.price[s] / before[s] - 1) * 100 for s in SYMS}
        self.index_hist = (self.index_hist + [self.index()])[-120:]

        top = max(SYMS, key=lambda s: chg[s])
        bot = min(SYMS, key=lambda s: chg[s])
        if not halted and chg[top] > 0.01:
            ev("up", f"{top} {chg[top]:+.1f}% on {sum(c[w] for w in STOCKS[top][1])} mentions")
        if not halted and chg[bot] < -0.01:
            ev("down", f"{bot} {chg[bot]:.1f}%")
        quote = " ".join(words[:6])
        ev("quote", f"Analyst note: “{quote}{'...' if n > 6 else ''}”")

        # 5. The fund: a quant strategy whose only signal is whack()
        #    Strategy: go all-in on whatever whack() mentioned most (per word in ticker)
        if self.fund_sym:
            self.fund_cash += self.fund_pos * self.price[self.fund_sym]
            self.fund_pos = 0
        pick = max(SYMS, key=lambda s: (sum(c[w] for w in STOCKS[s][1]) / len(STOCKS[s][1]), s))
        self.fund_sym = pick
        self.fund_pos = self.fund_cash / self.price[pick]
        self.fund_cash = 0.0
        self.fund_hist = (self.fund_hist + [self.fund_value()])[-120:]

        for e in events:
            e["tick"] = self.tick
        self.news = (events[::-1] + self.news)[:60]
        self.last = {
            "tick": self.tick, "n": n, "tape": tape, "halted": halted,
            "events": events,
            "stocks": [{"sym": s, "name": STOCKS[s][0], "price": self.price[s],
                        "chg": chg[s], "hist": self.hist[s],
                        "mentions": sum(c[w] for w in STOCKS[s][1])} for s in SYMS],
            "index": self.index_hist[-1], "index_hist": self.index_hist,
            "news": self.news,
            "fund": {"value": self.fund_value(), "hist": self.fund_hist, "holding": pick},
            "counts": c.most_common(8),
        }
        return self.last


MARKET = Market()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, body, ctype):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/tick"):
            self.send(json.dumps(MARKET.step()), "application/json")
        elif self.path.startswith("/state"):
            self.send(json.dumps(MARKET.last), "application/json")
        else:
            with open(os.path.join(HERE, "terminal.html"), "rb") as f:
                self.send(f.read(), "text/html; charset=utf-8")


def main():
    if "--cli" in sys.argv:   # headless mode: print the news wire
        for _ in range(int(sys.argv[-1]) if sys.argv[-1].isdigit() else 20):
            s = MARKET.step()
            for e in s["events"]:
                print(f"[T{s['tick']:03}] {e['text']}")
            print(f"        WHACK26 index {s['index']:.1f} | fund ${s['fund']['value']:.2f}\n")
        return
    for _ in range(40):       # pre-market session so the charts aren't empty
        MARKET.step()
    url = f"http://localhost:{PORT}"
    print(f"THE WHACK EXCHANGE is open at {url}  (Ctrl+C to ring the closing bell)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.5, webbrowser.open, [url]).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
