# Warwick Quack Soc Social 🦆

**By:** Anson (GitHub: chocoliticekreem)

**Pitch:** You are a whacky quacky duck on Lake Woxbridge, by the Oculus. Every word `whack()` writes happens to you, and you can aim your own `whack()` at other ducks.

**Play it online, no sign-up:** https://whackquack.vercel.app (send it to a friend and whack each other)

## How to run it

```
node server.js
```

Then open http://localhost:3026. There are no dependencies, just Node 18+ and a browser. Three.js loads from a CDN.

**W/S** swim · **A/D** turn · **SPACE** `whack()` another duck (10s cooldown) · **ENTER** play

## Screenshot

![gameplay](gameplay.gif)

![screenshot](screenshot.png)

## How whack() runs the game

`whack.js` is copied in unchanged. Every 4 seconds the server calls it, and the words it writes become the next 4 seconds of your life:

| Word | What happens to you |
|---|---|
| `goose` / `honk` | geese spawn and hunt you |
| `prod` | a meteor lands near you |
| `segfault` | core dumped: −10 points |
| `sleep` | you slow down |
| `null` | geese can't dereference you, so you go invisible |
| `coffee` / `pizza` | speed, +1 ❤ |
| `rubber` | rubber duck shield |
| `bug` → `feature` | snacks: +10, or +50 once a bug becomes a feature |
| `duck` | more ducks hatch on the lake |
| `stack` / `overflow` | ducks pile into a tower and topple |
| `merge` / `conflict` | two geese fight, one force-pushes itself off the lake |
| `midnight` | time flies, pushing the clock toward 00:00 |

Every word is either **bad** (red glow and tag: geese, meteors, segfault), **good** (green glow and tag: food, bugs to eat, rubber duck shield) or harmless scenery. When a sponsor word shows up 3+ times in one whack, its real logo bursts off its billboard with hearts and you get +20.

The clock runs from 22:30 to 00:00, when PRs close. Scoring: +10 for each `whack()` you survive, +25 for each pizza or coffee you eat, +30 when your `whack()` lands on another duck, and +500 for making it to midnight 🏆. Red rings on the water mark danger: hunting geese and incoming meteors. The leaderboard keeps each duck's best score.

## Multiplayer

Every duck online sees the others with name tags. Pressing SPACE calls `whack()` and sends the whole word list to a random other player, so their geese, meteors and segfaults come from you, and you score double. With nobody else online, it lands on the lake instead. One target per throw and a 10-second cooldown keep a 20-duck lake from turning into a massacre. Five seconds later the victim's game reports back: +15 for every heart they lost, +100 for a KO, or "they dodged it".

Rounds are shared 3-minute windows, so everyone online hits midnight together. Every score is stored with its round. The menu shows the top 5 for this round, last round (with the winner 👑) and all time.

The hosted version runs the same `whack.js` in a Vercel function, from `/tmp` because that's the only writable folder there. Positions sync over Supabase Realtime, and scores are stored in Supabase.
