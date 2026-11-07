# Grammar vs The Deadline — full rules

[Back to the submission README](README.md). These rules describe the current [`engine.js`](public/engine.js) behavior. Word roles are specific to this game.

## Win condition and word order

Reduce **THE DEADLINE from 850 HP to zero** before the word sequence ends. An empty party does not end the run; later words may recruit more heroes. Exhausting the sequence with the boss still alive loses the battle.

Words are processed in the order returned by the official `whack()`. Known adjacent pairs fuse first, in the listed order. Each pair consumes two original words but becomes **one processed token**, including for boss retaliation. The on-screen word counter counts these processed tokens. The clock advances with sequence progress; playback speed is not a combat resource.

## Recruits and actions

Nouns recruit into **eight slots**: empty slots first, then dead heroes' slots, otherwise the oldest recruit leaves. Attacks use the most recently recruited living hero, falling back to the newest survivor. Without a living hero, a verb or ultimate is wasted.

Adjectives wait for the next recruit, including fused recruits. They are consumed on recruitment and can remain pending through intervening items or verbs. Repeated power/HP modifiers apply in sequence; repeated `rubber` still gives two hits and repeated `null` still enables the same null-hit rule.

| Ordinary hero | Power | Starting HP |
| --- | --- | --- |
| Goose | 1.6 | 90 |
| Duck | 1.2 | 70 |
| Bug | 0.7 | 45 |
| Feature | 1.1 | 80 |
| Prod | 1.9 | 40 |
| Segfault | 1.0 | 60 |
| Semicolon | 0.6 | 50 |
| Demo | 1.0 | 70 |
| Prize | 1.3 | 70 |
| WiFi | 1.2 | 60 |
| Oculus | 1.3 | 80 |
| CompSoc / Bloomberg | 1.4 | 90 |
| Netcraft | 1.3 | 85 |
| Marshall / Wace / Brevan / Howard / Incident / IO / Pointer / Stack | 1.0 | 75 |

## Combos and signatures

Consecutive attack verbs by the **same hero** build the chain: attack 1 has a **1×** chain multiplier, attack 2 **1.5×**, attack 3 **2×**, attack 4 **2.5×**, and so on. **COMBO xN labels the attack number, not the damage multiplier.** The `stack overflow` ultimate participates in chains.

Recruitment resets the chain. Adjectives, items and `merge conflict` interrupt it, so the next attack starts at 1×. A change of acting hero also starts a new chain.

`Sleep` restores up to **40 HP** to the actor, capped at maximum HP. It does not attack, consume coffee or increment/reset the combo counter; it does set the preceding token's role to verb. If the next attack uses the same hero, it increments the existing counter. Consequently, sleep can bridge an interruption while preserving an earlier counter; this is an exception to the simple consecutive-attack explanation.

| Signature combination | Extra damage multiplier |
| --- | --- |
| Duck + quack; Goose + honk | 2× |
| Demo + pitch; Bloomberg + pitch | 2× |
| Prod + deploy | 3× |
| Feature + commit; Feature + push | 2× |
| CompSoc + hack; Bug + hack | 2× |
| Rubber Duck + quack | 3× |
| Netcraft + deploy | 2× |

Example: `duck quack quack` recruits a 1.2-power duck. The second quack starts from 18 base damage × 1.2 power × 1.5 chain × 2 signature = **64.8 before variance, critical hits and rounding**.

## Adjacent fusions

Sponsor recruits also fuse **across the living party**, in either order: Marshall + Wace, Brevan + Howard, and Incident + IO. Intervening words do not matter; the earlier hero must still be alive and occupying a slot. The oldest eligible partner is consumed, freeing its slot for a new legendary hero. Its adjectives carry over, pending adjectives are added, and the legendary starts at full HP. An unrelated hero is not evicted to perform a fusion. Capital and One can similarly match while they are both pending modifiers; once applied to a different recruit they are no longer pending. Other pairs below remain adjacency-only.

Unlike adjacent pairs, separated words each retain their own processed token and therefore each count toward boss retaliation.

| Exact adjacent pair | Effect |
| --- | --- |
| `rubber duck` | Legendary hero, 2.6 power and 160 HP before modifiers; heals all living heroes by up to 30 HP on arrival. |
| `marshall wace`, `brevan howard`, `capital one`, `incident io` | Legendary heroes, 2.6 power and 160 HP before modifiers. |
| `stack overflow` | Ultimate attack through the current hero: 150 base damage before normal attack multipliers. Wasted if no hero can act. |
| `null pointer` | Exception recruit; immediately deals a rounded random 180–240 damage and dies. This crash bypasses normal attack multipliers, coffee and hit rules. |
| `merge conflict` | Backfire: every living hero loses 20 HP; can kill heroes. |

Fusion takes precedence over separate roles: `rubber duck` creates the legendary hero rather than giving an ordinary duck the rubber modifier. Place adjectives before the complete recruit token/pair, for example `midnight rubber duck`.

## Adjective modifiers

| Adjective | Effect on the next recruit | Visual |
| --- | --- | --- |
| `midnight` | 2× power | Violet aura |
| `capital` | 1.4× power, 1.3× HP, 1.3× scale | Larger sprite |
| `rubber` | Two hits, each at 75% normal per-hit damage | Bounce |
| `null` | Each hit independently has a 15% chance of 999 damage, otherwise zero | Translucency |
| `one` | 1.3× power, 1.5× HP | Crown |
| `warwick` | 1.2× power, +40 HP | Scarf |

HP is rounded after all modifiers. Modifiers apply in word order, so additive Warwick HP can be multiplied by a later HP modifier. Null damage overrides the ordinary damage calculation. The Null Pointer fusion's immediate crash uses its separate rule above.

## Damage, items and luck

| Attack | Base damage |
| --- | --- |
| `whack` | 45 |
| `deploy` | 40 |
| `hack`, `overflow` | 35 |
| `push`, `pitch` | 30 |
| `honk` | 28 |
| `commit` | 25 |
| `merge` | 22 |
| `quack` | 18 |
| `conflict` | 12; actor also loses 10 HP after attacking |
| Fused `stack overflow` | 150 |

Ordinary per-hit damage is rounded from **base × hero power × chain × signature × coffee × hero quirk × critical × multi-hit factor × random variance**. Applicable factors multiply together.

- **Pizza:** heals living heroes by up to 30 HP, never above maximum; does not revive the dead.
- **Coffee:** adds three charges. Each attack action consumes one for 1.5× damage, including a miss or null result. Both rubber hits share that charge. Further coffee adds charges; unused charges persist across recruitment.
- **Variance:** each hit rolls 85–115% of calculated damage.
- **Critical:** a 10% chance per non-missed attack action doubles normal damage; rubber hits share that roll.
- **WiFi:** a 40% chance per attack action to miss; rubber hits share that roll. The null modifier's subsequent zero/999 override still applies if present.
- **Segfault:** an additional random 0–3× multiplier per attack action.
- **Rubber:** two hits at 75% each, with separate variance and null rolls. Without null, that is 150% total before per-hit variance/rounding.

Sleep, healing, backfire and Null Pointer's immediate crash do not use the normal attack formula or consume coffee.

## Retaliation and presentation

After every **five processed tokens**, if the boss still has HP and a living hero exists, it strikes one random survivor for a rounded **22–40 damage**. Below **30% of its 850 HP** (strictly below 255 HP), the roll is multiplied by **1.5 before rounding**. Killing the boss prevents retaliation on that token. Dead heroes become tombstones until their slots are reused.

The renderer sequences entrances, attacks, hits, retaliation and deaths, and waits for queued action effects before the result screen. Victory shows **SHIPPED!** and confetti; defeat shows **DEADLINE MISSED**. Both show word count, recruits, total damage and best hit. The 0.5×/1×/2×/4×/10× controls change playback time; the field guide pauses it. Review artwork and proposed bosses do not add combat rules.
