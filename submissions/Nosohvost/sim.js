// Headless balance check: node sim.js [runs]
// Calls the real whack() for every battle and reports how often the party beats THE DEADLINE.
process.chdir(__dirname);
const { whack } = require("./whack.js");
const { Battle } = require("./public/engine.js");

const runs = Number(process.argv[2]) || 2000;
let wins = 0;
const byLen = {};
for (let r = 0; r < runs; r++) {
  const words = whack();
  const b = new Battle(words);
  while (!b.done) b.step();
  if (b.won) wins++;
  const bucket = Math.floor((words.length - 1) / 20) * 20 + 1;
  byLen[bucket] = byLen[bucket] || [0, 0];
  byLen[bucket][0] += b.won ? 1 : 0;
  byLen[bucket][1]++;
}
console.log(`win rate: ${((100 * wins) / runs).toFixed(1)}% over ${runs} whack() calls`);
for (const [k, [w, n]] of Object.entries(byLen)) console.log(`  ${k}-${+k + 19} words: ${((100 * w) / n).toFixed(0)}%`);
