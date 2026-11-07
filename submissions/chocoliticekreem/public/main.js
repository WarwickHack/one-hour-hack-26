import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { buildWorld } from "./world.js";
import { Pond } from "./pond.js";
import { connect } from "./net.js";
import { ABILITIES, updateAbilities } from "./abilities.js";

const AUTO_WHACK_MS = 4000;
const SELF_WHACK_COOLDOWN_MS = 10000;
const POS_SEND_MS = 250;
const BUFFS = new Set(["coffee", "rubber", "null", "pizza"]);
const DEADLINE = 90;
const ROUND_MS = 180000;
const currentRound = () => Math.floor(Date.now() / ROUND_MS);
const roundFrac = () => (Date.now() % ROUND_MS) / ROUND_MS;
const MAX_HP = 5;
const BAD = new Set(["goose", "honk", "prod", "segfault", "null", "pointer", "overflow", "conflict", "sleep", "bug"]);
const GOOD = new Set(["duck", "coffee", "pizza", "rubber", "feature", "prize", "deploy", "merge"]);

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const outline = new OutlineEffect(renderer, { defaultThickness: 0.006, defaultColor: [0.05, 0.05, 0.1], defaultAlpha: 1 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 55, 75);
const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 0, 0);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.47;

const world = buildWorld(scene);
scene.traverse((o) => { if (o.isSprite) o.visible = false; });
const pond = new Pond(scene, world);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const W_TEXTURE = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.font = "900 112px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#3b1a5a";
  ctx.fillText("W", 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const PLAYER_PURPLE = 0xcdb6ff;

function buildPlayerDuck(bodyColor = 0xfaf7ef) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const part = (geo, color, [x, y, z], [sx, sy, sz] = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const body = part(sphere, bodyColor, [0, 0.5, 0], [0.85, 0.62, 1.15]);
  const tail = part(new THREE.ConeGeometry(0.35, 0.7, 12), bodyColor, [0, 0.8, -1.05]);
  tail.rotation.x = -Math.PI / 3;
  const wingL = part(sphere, bodyColor, [-0.72, 0.62, -0.1], [0.22, 0.4, 0.75]);
  const wingR = part(sphere, bodyColor, [0.72, 0.62, -0.1], [0.22, 0.4, 0.75]);
  const head = part(sphere, bodyColor, [0, 1.35, 0.7], [0.48, 0.48, 0.48]);
  const beak = part(sphere, 0xff9a2e, [0, 1.28, 1.2], [0.2, 0.09, 0.3]);
  const eyeL = part(sphere, 0x111111, [-0.22, 1.45, 1.05], [0.07, 0.07, 0.07]);
  const eyeR = part(sphere, 0x111111, [0.22, 1.45, 1.05], [0.07, 0.07, 0.07]);
  const scarf = part(new THREE.TorusGeometry(0.42, 0.1, 8, 24), 0x5b2c83, [0, 1.0, 0.62]);
  scarf.rotation.x = Math.PI / 2.4;
  const shield = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.08, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd000 }),
  );
  shield.rotation.x = Math.PI / 2;
  shield.position.y = 0.1;
  shield.visible = false;
  [body, tail, wingL, wingR, head, beak, eyeL, eyeR, scarf].forEach((m) => { m.castShadow = true; g.add(m); });
  g.add(shield);
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: W_TEXTURE, transparent: true, depthWrite: false }),
  );
  back.material.userData.outlineParameters = { visible: false };
  back.rotation.set(-Math.PI / 2, 0, Math.PI);
  back.position.set(0, 1.135, -0.2);
  g.add(back);
  g.userData = { shield, head };
  return g;
}

const BARRIER = 1.5;
const barrierMat = new THREE.MeshBasicMaterial({
  color: 0x4fc3ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
});
barrierMat.userData.outlineParameters = { visible: false };
const barrier = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 96, 1, true), barrierMat);
barrier.scale.set(world.lake.radiusX * BARRIER, 1, world.lake.radiusZ * BARRIER);
barrier.position.y = 2.5;
scene.add(barrier);

const duck = buildPlayerDuck(PLAYER_PURPLE);
duck.scale.setScalar(1.2);
duck.position.set(0, world.lake.waterY, world.lake.radiusZ * 0.5);
scene.add(duck);

const keys = new Set();
const state = {
  phase: "menu",
  name: "",
  hp: MAX_HP,
  score: 0,
  whacks: 0,
  minutes: 0,
  heading: Math.PI,
  camMode: "third",
  effects: { invert: 0, slow: 0, fast: 0, shield: 0, hidden: 0, invuln: 0, quant: 0 },
  diedTo: null,
  lastSelfWhack: -Infinity,
  nextAuto: 0,
};
pond.player = { position: duck.position, hidden: false, shield: false };

function clockText() {
  const total = 22 * 60 + 30 + Math.min(state.minutes, DEADLINE);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toast(text, cls) {
  const box = $("toasts");
  const el = document.createElement("div");
  el.textContent = text;
  el.className = cls;
  box.append(el);
  setTimeout(() => el.remove(), 3200);
  while (box.children.length > 3) box.firstChild.remove();
}

function log(lines, cls) {
  if (cls !== "you") return;
  const box = $("toasts");
  for (const line of lines.slice(-2)) {
    const el = document.createElement("div");
    el.textContent = line.split(":")[0].split(".")[0];
    if (cls) el.className = cls;
    box.append(el);
    setTimeout(() => el.remove(), 3200);
  }
  while (box.children.length > 3) box.firstChild.remove();
}

const ICONS = {
  goose: "🪿", honk: "📢", prod: "☄️", segfault: "💥", null: "👻", pointer: "👉", sleep: "😴", bug: "🐛",
  overflow: "🗼", conflict: "⚔️", duck: "🦆", coffee: "☕", pizza: "🍕", rubber: "🛟", feature: "✨", prize: "🏆",
  deploy: "🚀", merge: "🔀",
};

function playerColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 85%, 62%)`;
}

function shortName(name) {
  const n = String(name);
  return n.length > 8 ? `${n.slice(0, 8)}…` : n;
}

function showFile(file, words, from) {
  const c = countWords(file.trimEnd().split("\n"));
  const chips = Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w, n], i) => {
      const cls = BAD.has(w) ? "hot" : GOOD.has(w) ? "good" : "";
      return `<div class="row ${cls}" style="animation-delay:${i * 90}ms"><span>${ICONS[w] || "·"} ${w}</span><b>×${n}</b></div>`;
    })
    .join("");
  const panel = $("file-panel");
  panel.style.borderColor = from ? playerColor(from) : "transparent";
  $("file-head").innerHTML = from
    ? `<span class="dot" style="background:${playerColor(from)}"></span>${escapeHtml(shortName(from))}'s whack() · ${words.length}`
    : `whack() · ${words.length}`;
  $("file").innerHTML = chips;
}

function flash(color = "#ff3b2f") {
  const el = $("flash");
  el.style.background = color;
  el.style.transition = "none";
  el.style.opacity = "0.45";
  requestAnimationFrame(() => { el.style.transition = "opacity .5s"; el.style.opacity = "0"; });
}

function addPoints(n) {
  state.score += n * (state.effects.quant > 0 ? 2 : 1);
}

function countWords(words) {
  const c = {};
  for (const w of words) c[w] = (c[w] || 0) + 1;
  return c;
}

function guide(c) {
  const g = [];
  if (c.goose || c.honk) g.push("🪿 GEESE — swim away!");
  if (c.prod) g.push("☄️ METEOR — keep moving!");
  if (c.bug || c.feature) g.push("🐛 bugs on the shore — eat them");
  if (c.pizza || c.coffee) g.push("🍕 food on the lake — grab it");
  return g;
}

function applyToPlayer(c) {
  const e = state.effects;
  const lines = [];
  if (c.segfault) { state.score = Math.max(0, state.score - 10); lines.push("💥 segfault: core dumped (−10)"); }
  if (c.sleep >= 2) { e.slow = Math.min(6, 2 + c.sleep); lines.push(`😴 sleep ×${c.sleep}: you are so, so tired`); }
  if (c.coffee >= 2) { e.fast = Math.min(8, 3 + c.coffee); lines.push(`☕ coffee ×${c.coffee}: ZOOM`); }
  if (c.rubber >= 2) { e.shield = Math.min(10, 4 + c.rubber * 2); lines.push(`🛟 rubber ×${c.rubber}: rubber duck shield up`); }
  if (c.null >= 2) { e.hidden = Math.min(6, 2 + c.null); lines.push(`👻 null ×${c.null}: geese can't dereference you`); }
  const fired = new Set();
  for (const [word, n] of Object.entries(c)) {
    const ability = ABILITIES[word];
    if (!ability || fired.has(ability) || n < 3) continue;
    fired.add(ability);
    try { lines.push(ability(abilityCtx, n)); } catch (err) { console.warn("ability", word, err); }
  }
  return lines;
}

async function doWhack(self) {
  let data;
  try {
    data = await (await fetch("/api/whack")).json();
  } catch {
    log(["⚠️ whack() unreachable. The ducks wait."]);
    return;
  }
  const { words, file } = data;
  state.whacks += 1;
  showFile(file, words);
  const c = countWords(words);
  if (state.phase === "play") {
    if (!self) addPoints(10);
  }
  let header = `⏰ whack() #${state.whacks} · ${words.length} words · ${clockText()}`;
  let pondLines;
  let playerLines;
  if (self) {
    const victim = net.sendWhack(words, (id) => ghosts.get(id)?.userData.target?.alive);
    addPoints(victim ? 30 : 10);
    header = victim
      ? `🎯 ${shortName(victim)} ← ${threatChips(words)} · +30`
      : `🫵 the lake ← ${threatChips(words)} · +10`;
    const me = pond.player;
    pond.player = null;
    pondLines = victim ? [] : pond.applyWhack(words) || [];
    pond.player = me;
    playerLines = applyToPlayer(countWords(words.filter((w) => BUFFS.has(w))));
  } else {
    pondLines = pond.applyWhack(words) || [];
    playerLines = state.phase === "play" ? applyToPlayer(c) : [];
    if (state.phase === "play") {
      toast("+10 survived whack()", "score");
      guide(c).slice(0, 2).forEach((g) => toast(g, "warn"));
    }
  }
  if (self) showOutcome(header);
}

function threatChips(words) {
  const c = countWords(words);
  return Object.entries(c)
    .filter(([w]) => ICONS[w] && BAD.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w, n]) => `${ICONS[w]}×${n}`)
    .join(" ") || "🫧 nothing scary";
}

function showOutcome(text) {
  const el = $("outcome");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 6000);
}

function onResult({ victim, hearts, died }) {
  const bonus = hearts * 15 + (died ? 100 : 0);
  if (bonus) addPoints(bonus);
  showOutcome(died
    ? `☠️ you KO'd ${shortName(victim)} · +${bonus}`
    : hearts
      ? `💥 ${shortName(victim)} lost ${hearts}♥ · +${bonus}`
      : `😶 ${shortName(victim)} dodged it`);
}

function onWhacked({ from, fromId, words }) {
  if (state.phase !== "play") return;
  const hpBefore = state.hp;
  setTimeout(() => {
    net.sendResult(fromId, { hearts: Math.max(0, hpBefore - Math.max(0, state.hp)), died: state.phase === "dead" });
  }, 5000);
  showFile(words.join("\n") + "\n", words, from);
  const pondLines = pond.applyWhack(words) || [];
  const playerLines = applyToPlayer(countWords(words));
  log([...pondLines].reverse());
  log([...playerLines].reverse(), "you");
  toast("🎯 " + shortName(from) + " whacked you", "warn");
  flash(playerColor(from));
}

const drops = [];
function rain(chars, color, count) {
  for (let i = 0; i < count; i++) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    ctx.font = "bold 52px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#0b1030";
    const ch = chars[Math.floor(Math.random() * chars.length)];
    ctx.strokeText(ch, 32, 50);
    ctx.fillStyle = color;
    ctx.fillText(ch, 32, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.setScalar(0.8);
    sp.position.set(duck.position.x + (Math.random() - 0.5) * 24, 18 + Math.random() * 14, duck.position.z + (Math.random() - 0.5) * 24);
    sp.userData.v = 6 + Math.random() * 6;
    scene.add(sp);
    drops.push(sp);
  }
}
function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const sp = drops[i];
    sp.position.y -= sp.userData.v * dt;
    if (sp.position.y < 0) {
      scene.remove(sp);
      sp.material.map.dispose();
      sp.material.dispose();
      drops.splice(i, 1);
    }
  }
}
function ticker() {
  const s = pond.stats ? pond.stats() : {};
  const q = (n) => `${(Math.random() * 9 - 3).toFixed(1)}%`;
  const el = $("ticker");
  el.textContent = `DUCK ${s.ducks ?? 0} ▲${q()}   GOOSE ${s.geese ?? 0} ▼${q()}   BUG ${s.bugs ?? 0} ▲${q()}   ${state.name.toUpperCase()} ${state.score} ▲${q()}   WHACK ${state.whacks} ▲${q()}`;
  el.hidden = false;
  clearTimeout(ticker.t);
  ticker.t = setTimeout(() => (el.hidden = true), 6000);
}

const abilityCtx = {
  THREE, scene, duck, state, MAX_HP, world, pond, rain, flash,
  get effects() { return state.effects; },
  addScore: (n) => addPoints(Math.round(n)),
  heal: (n) => { state.hp = Math.min(MAX_HP, state.hp + n); },
  spawnFloatingText: (text) => log([text], "you"),
};

const dangerRings = [];
const dangerGeo = new THREE.RingGeometry(1.6, 2.1, 28);
const dangerMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
function updateDanger() {
  const hunters = state.phase === "play" ? (pond.geese || []).filter((g) => g.group.position.distanceTo(duck.position) < 30) : [];
  while (dangerRings.length < hunters.length) {
    const r = new THREE.Mesh(dangerGeo, dangerMat);
    r.rotation.x = -Math.PI / 2;
    scene.add(r);
    dangerRings.push(r);
  }
  dangerRings.forEach((r, i) => {
    r.visible = i < hunters.length;
    if (r.visible) r.position.set(hunters[i].group.position.x, world.lake.waterY + 0.35, hunters[i].group.position.z);
  });
  dangerMat.opacity = 0.55 + 0.35 * Math.abs(Math.sin(performance.now() / 150));
}

const ghosts = new Map();
function onPos(p) {
  let g = ghosts.get(p.id);
  if (!g) {
    g = buildPlayerDuck(PLAYER_PURPLE);
    g.add(nameTag(p.name));
    scene.add(g);
    ghosts.set(p.id, g);
  }
  g.userData.target = p;
  g.visible = p.alive;
}
function onLeave(id) {
  const g = ghosts.get(id);
  if (g) { scene.remove(g); ghosts.delete(id); }
}
function nameTag(text) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(11,16,48,.75)";
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = playerColor(text);
  ctx.font = "bold 30px monospace";
  ctx.textAlign = "center";
  ctx.fillText(shortName(text), 128, 43);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(4, 1, 1);
  s.position.y = 2.6;
  return s;
}
function updateGhosts(dt) {
  for (const g of ghosts.values()) {
    const t = g.userData.target;
    if (!t) continue;
    const k = 1 - Math.exp(-10 * dt);
    g.position.x += (t.x - g.position.x) * k;
    g.position.z += (t.z - g.position.z) * k;
    g.position.y = t.y;
    g.rotation.y = t.heading;
  }
}

const playerId = (crypto.randomUUID?.() || String(Math.random())).slice(0, 8);
const net = connect({ id: playerId, name: "lurker", onPos, onLeave, onWhacked, onResult });
let lastPosSend = 0;

pond.onPlayerHit = (kind, by) => {
  if (state.phase !== "play" || state.effects.invuln > 0) return;
  if (state.effects.shield > 0) return;
  const dmg = kind === "prod" ? 2 : 1;
  state.hp -= dmg;
  state.effects.invuln = 1;
  flash(kind === "prod" ? "#ff8a00" : "#ff3b2f");
  toast(kind === "prod" ? `☄️ hit −${dmg} ♥` : `🪿 bitten −${dmg} ♥`, "warn");
  if (state.hp <= 0) end(false, kind === "prod" ? "a PROD meteor" : by);
};

pond.onPlayerPickup = (kind) => {
  if (state.phase !== "play") return;
  if (kind === "bug") { addPoints(10); log(["🐛 you ate a bug (+10)"], "you"); }
  if (kind === "feature") { addPoints(50); log(["✨ you ate a FEATURE (+50)"], "you"); }
  if (kind === "pizza") { addPoints(25); state.hp = Math.min(MAX_HP, state.hp + 1); log(["🍕 +25 · +1 ❤"], "you"); }
  if (kind === "coffee") { addPoints(25); state.effects.fast = Math.max(state.effects.fast, 4); log(["☕ +25 · speed"], "you"); }
};

function selfWhack() {
  const now = performance.now();
  if (state.phase !== "play" || now - state.lastSelfWhack < SELF_WHACK_COOLDOWN_MS) return;
  state.lastSelfWhack = now;
  doWhack(true);
}

function boardList(title, rows, crown) {
  const items = rows.length
    ? rows.map((r, i) => `<li>${crown && i === 0 ? "👑 " : ""}<b>${escapeHtml(r.name)}</b> ${r.score}</li>`).join("")
    : "<li>no ducks yet</li>";
  return `<div class="board"><h3>${title}</h3><ol>${items}</ol></div>`;
}

async function fetchBoards() {
  try {
    return await (await fetch("/api/scores")).json();
  } catch {
    return { current: [], last: [], allTime: [] };
  }
}

async function leaderboardHtml() {
  const b = await fetchBoards();
  return `<div class="side side-left">${boardList("This round", b.current || [])}${boardList("Last round", b.last || [], true)}</div>
    <div class="side side-right">${boardList("All time", b.allTime || [])}</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

async function showMenu() {
  const b = $("banner");
  b.hidden = false;
  b.innerHTML = `
    <h1>LAKE WOXBRIDGE</h1>
    <p class="sub">Every few seconds <b>whack()</b> throws random chaos at you. Survive till midnight.</p>
    <input id="name" maxlength="16" placeholder="duck name" style="font:inherit;padding:10px 14px;border-radius:8px;border:0;text-align:center">
    <p class="sub"><span class="key">WASD</span> swim · <span class="key">SPACE</span> whack another duck · <span class="key">ENTER</span> play</p>
    ${await leaderboardHtml()}`;
  const input = $("name");
  try { state.name = state.name || localStorage.getItem("duckName") || ""; } catch {}
  input.value = state.name;
  input.focus();
}

function start() {
  state.name = ($("name")?.value || "anon duck").trim().slice(0, 16) || "anon duck";
  Object.assign(state, { phase: "play", hp: MAX_HP, score: 0, whacks: 0, diedTo: null, round: currentRound(), startedAt: Date.now() });
  Object.keys(state.effects).forEach((k) => (state.effects[k] = 0));
  duck.position.copy(world.randomLakePoint());
  state.heading = Math.random() * Math.PI * 2;
  duck.visible = true;
  state.camMode = "third";
  net.rename(state.name);
  try { localStorage.setItem("duckName", state.name); } catch {}
  $("banner").hidden = true;
  $("toasts").innerHTML = "";
  state.nextAuto = performance.now() + 1500;
}

async function end(survived, diedTo) {
  state.phase = survived ? "won" : "dead";
  state.diedTo = diedTo;
  if (!survived) duck.visible = false;
  const body = { name: state.name, score: state.score, survived, died_to: diedTo, whacks: state.whacks };
  try {
    await fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { /* leaderboard is a bonus; the game still ends */ }
  const b = $("banner");
  b.hidden = false;
  b.innerHTML = `
    <h1>${survived ? "SURVIVED 🏆" : "QUACKED"}</h1>
    <p class="sub">${survived ? "" : `${escapeHtml(diedTo)} got you · `}<b>${state.score}</b></p>
    ${await leaderboardHtml()}
    <p><span class="key">ENTER</span> next round</p>`;
}

addEventListener("keydown", (ev) => {
  const k = ev.key.toLowerCase();
  if (k === "enter" && state.phase !== "play") {
    if (state.phase === "menu") start();
    else { state.phase = "menu"; showMenu(); }
    return;
  }
  if (ev.target.tagName === "INPUT") return;
  if (k === " ") { ev.preventDefault(); selfWhack(); return; }
  keys.add(k);
});
addEventListener("keyup", (ev) => keys.delete(ev.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
$("whack-btn").addEventListener("click", () => (state.phase === "play" ? selfWhack() : doWhack(false)));

function movePlayer(dt) {
  const e = state.effects;
  const flip = 1;
  let turn = 0;
  let fwd = 0;
  if (keys.has("a") || keys.has("arrowleft")) turn += 1;
  if (keys.has("d") || keys.has("arrowright")) turn -= 1;
  if (keys.has("w") || keys.has("arrowup")) fwd += 1;
  if (keys.has("s") || keys.has("arrowdown")) fwd -= 0.6;
  const speed = 13 * (e.fast > 0 ? 1.6 : 1) * (e.slow > 0 ? 0.5 : 1);
  state.heading += turn * flip * 3.4 * dt;
  const step = fwd * speed * dt;
  let x = duck.position.x + Math.sin(state.heading) * step;
  let z = duck.position.z + Math.cos(state.heading) * step;
  const edge = Math.hypot(x / world.lake.radiusX, z / world.lake.radiusZ) / BARRIER;
  if (edge > 1) { x /= edge; z /= edge; }
  barrierMat.opacity = THREE.MathUtils.clamp((Math.min(edge, 1) - 0.85) / 0.15, 0, 1) * 0.45;
  const swimming = world.isInLake(x, z);
  duck.position.set(x, swimming ? world.lake.waterY + Math.sin(performance.now() / 300) * 0.06 : 0, z);
  duck.rotation.y = state.heading;
}

function tickEffects(dt) {
  const e = state.effects;
  for (const k of Object.keys(e)) e[k] = Math.max(0, e[k] - dt);
  pond.player.hidden = e.hidden > 0;
  pond.player.shield = e.shield > 0;
  duck.userData.shield.visible = e.shield > 0;
  duck.visible = state.phase === "dead" ? false : !(e.invuln > 0 && Math.floor(performance.now() / 80) % 2);
}

const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const following = state.phase === "play" && state.camMode !== "orbit";
  orbit.enabled = !following;
  if (!following) { orbit.update(); return; }
  const fwd = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  if (state.camMode === "third") {
    const want = duck.position.clone().addScaledVector(fwd, -14).add(new THREE.Vector3(0, 8, 0));
    camera.position.lerp(want, 1 - Math.exp(-6 * dt));
    camTarget.copy(duck.position).addScaledVector(fwd, 4).add(new THREE.Vector3(0, 1, 0));
  } else {
    camera.position.copy(duck.position).add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(fwd, 1.0);
    camTarget.copy(camera.position).addScaledVector(fwd, 10).add(new THREE.Vector3(0, -0.6, 0));
  }
  duck.userData.head.visible = state.camMode !== "first";
  camera.lookAt(camTarget);
  orbit.target.copy(duck.position);
}

function renderHud() {
  const playing = state.phase === "play";
  $("clock").textContent = clockText();
  const toNext = Math.max(0, state.nextAuto - performance.now()) / AUTO_WHACK_MS;
  $("next-bar").style.width = `${(1 - toNext) * 100}%`;
  $("hp").textContent = playing ? "♥".repeat(Math.max(0, state.hp)) + "♡".repeat(Math.max(0, MAX_HP - state.hp)) : "";
  $("score").textContent = playing ? `${state.score}` : "";
  const left = Math.ceil((SELF_WHACK_COOLDOWN_MS - (performance.now() - state.lastSelfWhack)) / 1000);
  const btn = $("whack-btn");
  btn.disabled = playing && left > 0;
  btn.textContent = !playing ? "WHACK()" : left > 0 ? `recharging ${left}s` : net.peers.size ? `WHACK() a duck (${net.peers.size})` : "WHACK()";
  const e = state.effects;
  $("effects").textContent = playing
    ? [e.slow && "😴 slow", e.fast && "☕ fast", e.shield && "🛡️ shield", e.hidden && "👻 invisible", e.quant && "📈 ×2"].filter(Boolean).join("  ")
    : "";
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const now = performance.now();
  if (now >= state.nextAuto) {
    state.nextAuto = now + AUTO_WHACK_MS;
    doWhack(false);
  }
  updateGhosts(dt);
  updateDrops(dt);
  updateDanger();
  updateAbilities(abilityCtx, dt);
  if (now - lastPosSend > POS_SEND_MS && state.phase !== "menu") {
    lastPosSend = now;
    const p = duck.position;
    net.sendPos({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), heading: +state.heading.toFixed(2), alive: state.phase === "play" });
  }
  if (state.phase === "play") {
    movePlayer(dt);
    if (currentRound() !== state.round) {
      addPoints(Math.round(500 * Math.min(1, (Date.now() - state.startedAt) / ROUND_MS)));
      end(true, null);
    }
  }
  tickEffects(dt);
  state.minutes = Math.floor(roundFrac() * DEADLINE);
  world.setNight(0);
  world.update(dt, t);
  pond.update(dt, t);
  updateCamera(dt);
  renderHud();
  scene.traverse((o) => {
    if (o.isSprite && !o.material.userData.outlineParameters) o.material.userData.outlineParameters = { visible: false };
  });
  outline.render(scene, camera);
  requestAnimationFrame(frame);
}

showMenu();
frame();
