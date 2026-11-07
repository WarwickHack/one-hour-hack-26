// Leaderboard: Supabase when SUPABASE_URL + SUPABASE_KEY are set (hosted), in-memory otherwise (local).
// Rounds are shared 3-minute wall-clock windows, so every duck online plays the same round.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const ROUND_MS = 180000;
const memory = [];

const currentRound = () => Math.floor(Date.now() / ROUND_MS);

function clean(body) {
  return {
    name: String(body.name || "anon duck").replace(/[^\w .-]/g, "").slice(0, 16) || "anon duck",
    // debt: client-reported score, trivially spoofable. ceiling: honest players. upgrade: if someone cheats the board
    score: Math.max(0, Math.min(1000000, Math.floor(Number(body.score) || 0))),
    survived: Boolean(body.survived),
    died_to: body.died_to ? String(body.died_to).slice(0, 40) : null,
    whacks: Math.max(0, Math.min(10000, Math.floor(Number(body.whacks) || 0))),
    round: [currentRound(), currentRound() - 1].includes(Number(body.round)) ? Number(body.round) : currentRound(),
  };
}

function bestPerName(rows, limit = 5) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

async function query(filter) {
  if (!URL) {
    const rows = filter === "" ? memory : memory.filter((r) => `round=eq.${r.round}` === filter);
    return [...rows].sort((a, b) => b.score - a.score);
  }
  const res = await fetch(`${URL}/rest/v1/whack_scores?select=name,score,survived,round&order=score.desc&limit=300${filter ? `&${filter}` : ""}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  return res.ok ? res.json() : [];
}

async function top() {
  const round = currentRound();
  const [current, last, allTime] = await Promise.all([
    query(`round=eq.${round}`),
    query(`round=eq.${round - 1}`),
    query(""),
  ]);
  return {
    round,
    roundMs: ROUND_MS,
    current: bestPerName(current),
    last: bestPerName(last),
    allTime: bestPerName(allTime),
  };
}

async function submit(body) {
  const row = clean(body);
  if (!URL) {
    memory.push({ ...row, created_at: new Date().toISOString() });
    return row;
  }
  await fetch(`${URL}/rest/v1/whack_scores`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  return row;
}

module.exports = { top, submit };
