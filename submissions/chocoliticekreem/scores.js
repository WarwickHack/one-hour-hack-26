// Leaderboard: Supabase when SUPABASE_URL + SUPABASE_KEY are set (hosted), in-memory otherwise (local).
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const memory = [];

function clean(body) {
  return {
    name: String(body.name || "anon duck").replace(/[^\w .-]/g, "").slice(0, 16) || "anon duck",
    // debt: client-reported score, trivially spoofable. ceiling: honest players. upgrade: if someone cheats the board
    score: Math.max(0, Math.min(1000000, Math.floor(Number(body.score) || 0))),
    survived: Boolean(body.survived),
    died_to: body.died_to ? String(body.died_to).slice(0, 40) : null,
    whacks: Math.max(0, Math.min(10000, Math.floor(Number(body.whacks) || 0))),
  };
}

function bestPerName(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

async function top() {
  if (!URL) return bestPerName([...memory].sort((a, b) => b.score - a.score));
  const res = await fetch(`${URL}/rest/v1/whack_scores?select=name,score,survived,died_to,whacks,created_at&order=score.desc&limit=500`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  return res.ok ? bestPerName(await res.json()) : [];
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
