const table = (heads, rows) => '<table><thead><tr>' + heads.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(v => '<td>' + v + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
document.getElementById('rules-content').innerHTML = `
<p>Beat the clock's <b>${Engine.BOSS_HP} HP</b> before your words run out. Speed changes viewing time, never the outcome. Word roles are game-specific rather than a general English grammar parser.</p>
<h3>The sequence</h3><p><b>Nouns</b> recruit heroes. <b>Adjectives</b> stack on the next noun. <b>Verbs</b> act through the latest recruited living hero (falling back to the newest survivor). No hero means a wasted verb. Eight heroes fit; a ninth replaces the oldest. Each action finishes before the next one starts.</p>
<h3>Attack chains</h3><p>Consecutive attack verbs by the same hero build power: <b>1×, 1.5×, 2×, 2.5×…</b>. “COMBO x2” means the second attack, with a 1.5× chain multiplier. Nouns reset the chain; items and adjectives interrupt it. Sleep heals up to 40 HP without incrementing the chain, but counts as a verb for the following attack.</p>
<h3>Signature moves</h3>${table(['Hero + verb','Extra multiplier'],Object.entries(Engine.SYNERGY).map(([k,v])=>[k,v+'×']))}
<h3>Adjacent fusions</h3><p>Pairs must be directly adjacent in this order. Fusions are recognized before word roles.</p>${table(['Pair','Effect'],[
['rubber duck','Legendary hero; heals everyone 30 HP on arrival.'],
['marshall wace / brevan howard / capital one / incident io','Legendary heroes: 2.6 power, 160 HP before adjectives.'],
['stack overflow','150 base damage through the current hero, boosted by modifiers and chains.'],
['null pointer','Crashes for 180–240 damage, then dies.'],
['merge conflict','Backfire: all living heroes lose 20 HP.']])}
<h3>Adjectives</h3>${table(['Modifier','Next hero effect'],[
['midnight','2× power; violet aura.'],['capital','1.4× power, 1.3× HP; larger sprite.'],
['rubber','Two hits at 75% damage each; bounces.'],['null','Each hit: 15% chance of 999 damage, otherwise zero; translucent.'],
['one','1.3× power, 1.5× HP; crown.'],['warwick','1.2× power, +40 HP; university scarf.']])}
<h3>Items, luck and retaliation</h3><p><b>Pizza:</b> +30 HP to living heroes. <b>Coffee:</b> next three attack actions gain 1.5× damage; extra coffee adds three charges. Attacks have 85–115% damage variance and a 10% critical chance for double damage. WiFi has a 40% miss chance. Segfault multiplies power by a random 0–3×. Conflict also hurts its actor for 10 HP.</p><p>The boss retaliates against a random living hero every <b>five processed tokens</b> for 22–40 damage, boosted 1.5× below 30% boss HP. Fused pairs count as one token. Defeating the boss stops retaliation.</p>
<h3>Your recruits</h3><div class="gallery">${Engine.HERO_KEYS.map(k=>'<figure><img src="sprites/'+k.replace(/ /g,'-')+'.svg" alt="'+k+'" loading="lazy"><figcaption>'+k+'</figcaption></figure>').join('')}</div>`;
