# Game plan: GRAMMAR vs THE DEADLINE

**Language:** JavaScript, with no npm dependencies. A tiny Node server (`server.js`) serves the page and exposes `GET /whack`, which calls the unmodified `whack.js` and returns the words. The game runs on a browser `<canvas>`.
Run it with `node server.js` and open http://localhost:3000. Pressing R calls `whack()` again. The main file must not be named `whack`.

**Art:** hand-made flat SVG sprites, one per noun (`sprites/*.svg`), in a consistent style: 3px dark outline, shared palette, same eye style. No emoji.

## Core loop
1. Call `whack()`, which returns 1–100 words.
2. Tag each word with its part of speech and fuse known word pairs.
3. Feed the tokens in one at a time, about 0.5s each. Hold SPACE to fast-forward.
4. The boss is **THE DEADLINE**, a giant angry clock. Its hands move toward 00:00 as the words run out.
5. If the boss's HP hits 0, you win: "SHIPPED!". If you run out of words, you lose: "DEADLINE MISSED".
6. Press R to call `whack()` again with a new army.

## Parts of speech (hand-tagged, since there are only 42 words)
| Type | Words | Role |
|---|---|---|
| Noun → **hero** | duck, goose, bug, feature, oculus, compsoc, bloomberg, netcraft, prod, segfault, semicolon, demo, prize, wifi, pointer, stack, marshall, wace, brevan, howard, incident, io | Joins the party (max 8 slots; the oldest leaves when full) |
| Verb → **action** | whack, hack, quack, honk, deploy, merge, commit, push, overflow, pitch, conflict, sleep | The most recent living hero attacks the boss |
| Adjective → **modifier** | midnight (×2 power), capital (big, ×1.4), rubber (hits twice), null (0 damage, 15% chance of 999 "undefined behaviour"), one (crown, ×1.3, extra HP), warwick (+HP, ×1.2) | Stacks onto the *next* hero |
| Noun → **item** | pizza (heals the party), coffee (×1.5 on the next 3 actions) | Instant effect |

## Word-pair fusions (the "good combination" luck)
- **Legendary heroes** (×2.6 power, 160 HP): `rubber duck` (also heals everyone), `marshall wace`, `brevan howard`, `capital one`, `incident io`
- `stack overflow`: an ultimate attack with 150 base damage
- `null pointer`: a kamikaze hero that crashes into the boss for about 200 damage and dies
- `merge conflict`: backfires and damages your own party

## Combat rules
- Each verb has base damage (whack 45, deploy 40, hack 35 … conflict 12), multiplied by the hero's power.
- **Combo:** each verb in a row from the same hero adds +0.5× to the multiplier.
- **Signature moves (×2):** duck+quack, goose+honk, demo+pitch, prod+deploy (×3), feature+commit/push, compsoc/bug+hack.
- **Quirks:** segfault deals random 0–3× damage, wifi misses 40% of the time, prod hits hard but has only 40 HP. 10% crit chance.
- A verb with no hero alive echoes into the void.
- **Boss:** strikes a random hero every 5 tokens for 22–40 damage, and harder below 30% HP (enraged).
- Tune the boss's HP with a headless `--sim 2000` mode so the win rate is about 40%. Long lists and good combos win.

## Screen (1280×720 canvas on a 2D side-view stage)
- **Top:** a scrolling ribbon of word chips, colour-coded by part of speech, with the current word in the centre.
- **Left:** the party. Heroes spawn off-screen left and walk right with a bobbing walk cycle to a front line. When a hero acts, it dashes to the boss and hops back. Each has a name label (adjectives + noun), an HP bar, and a tombstone when it dies.
- **Adjectives as visuals:** midnight is a purple glow, capital doubles the sprite's size, rubber makes it bounce, null is a see-through outline, one adds a drawn crown, and warwick adds a scarf.
- **Verbs as visuals:** whack is a hammer arc, honk and quack send sound-wave rings, deploy is a rocket, commit is a ✔ bolt, push is a shove dash, hack is green code rain, stack overflow drops a falling block tower, and merge conflict is red crossed arrows hitting your own party.
- **Right:** the boss clock, with eyes that track the active hero, an HP bar, and a digital "23:47" countdown.
- **Bottom:** a 3-line battle log, e.g. "MIDNIGHT GOOSE HONKS AT THE DEADLINE — SIGNATURE MOVE! 118".
- **FX:** projectiles, floating damage numbers, particles, screen shake, the boss flashing on hits, red lightning for boss attacks, a red tint creeping in near midnight, and confetti on a win.

## Build order (to fit the hour)
1. Engine: tagging, fusion and `Battle.step()` returning events, plus `--sim` to tune HP. (~15 min)
2. Pygame rendering: ribbon, party, boss, log. (~20 min)
3. FX and end screens. (~10 min)
4. `--shot` headless screenshot, README and PR "Submission: <name>". (~10 min)
