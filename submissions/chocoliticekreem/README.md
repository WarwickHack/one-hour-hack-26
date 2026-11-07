# Warwick Quack Soc Social 🦆

**By:** Anson (GitHub: chocoliticekreem)

**Pitch:** You're a duck on the Warwick campus lake, and `whack()` is trying to kill you. Survive until 00:00, when PRs close.

**Play it online, no sign-up:** https://whackquack.vercel.app

## What happens

Every 4 seconds the server calls `whack()`. The file it writes becomes the next 4 seconds of your life, in 3D:

| Word | What it does |
|---|---|
| `duck` | a duck hatches on the lake |
| `goose` / `honk` | geese spawn and hunt **you** |
| `prod` | a meteor hits the lake near you |
| `segfault` | your controls invert |
| `null` | geese can't dereference you, so you're invisible |
| `sleep` | you get slow |
| `coffee` / `pizza` | speed and +1 ❤ |
| `rubber` | rubber duck shield |
| `bug` → `feature` | snacks: +10, or +50 once a bug becomes a feature |
| `stack` / `overflow` | ducks pile into a tower and topple |
| `merge` / `conflict` | two geese fight it out |
| `deploy` / `push` / `commit` | fireworks from the Piazza |
| `midnight` | time flies, pushing the clock toward 00:00 |
| sponsors and campus words | Oculus, Library, Arts Centre, CompSoc and the sponsor boards light up |

The left panel shows the actual `whack` file, line by line, as it lands.

**Push your luck:** press SPACE to call `whack()` yourself. You score double points for every word, and every one of those words still happens to you.

The clock runs from 22:30 to 00:00. Survive and your PR merges 🏆. Get eaten by Goose #7 and you go on the leaderboard with your cause of death.

## How to run it

```
node server.js
```

Then open http://localhost:3026. There are no dependencies: Node 18+ and a browser, with Three.js loaded from a CDN.

Controls: **WASD** swim · **SPACE** call `whack()` yourself · **V** switch camera (third person / first person / orbit) · **ENTER** hatch

## How it uses whack()

`whack.js` is copied in unchanged. `server.js` calls it on every tick and sends the words, plus the contents of the `whack` file, to the browser. The hosted version runs the same file in a Vercel function from `/tmp`. Every creature, meteor, firework and status effect in the game comes from those words. No other randomness drives the gameplay.

## Screenshot

![screenshot](screenshot.png)
