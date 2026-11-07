# Warwick Quack Soc Social 🦆

**By:** Anson (GitHub: chocoliticekreem)

**Pitch:** You are a whacky quacky duck on Lake Woxbridge, by the Oculus. Every word `whack()` writes spawns something on the lake, and you can aim your own `whack()` at other ducks.

**Play online, no sign-up:** https://whackquack.vercel.app

## How to run it

```
node server.js
```

Open http://localhost:3026. No dependencies.

**W/S** swim · **A/D** turn · **SPACE** whack() another duck · **ENTER** play · touch controls on phones

## Screenshot

![gameplay](gameplay.gif)

![screenshot](screenshot.png)

## How it plays

The server calls the official, unchanged `whack()` every 4 seconds. Each word becomes something on the lake:

- 🔴 **Run:** `goose` / `honk` (geese hunt you), `prod` (meteor, red target circle). Each hit costs 1 ❤ of 5.
- 🟢 **Grab:** `pizza`, `coffee`, `bug`, and sponsor words, which drop their real logo worth +50.
- Everything else is scenery: ducks, fireworks, campus buildings lighting up.

**Multiplayer:** SPACE throws your `whack()` at a random live duck, and their geese and meteors come from you. There are 3 bots, Rootes, SigmaSoc and W Hack, that whack you back. Rounds last 1 minute, with a live ranking, a 👑 over the leader, and a best-score leaderboard.

Hosted on Vercel, which runs the same `whack.js`, with Supabase for multiplayer and scores.
