// GRAMMAR vs THE DEADLINE: canvas renderer.
// Reads events from Engine.Battle and turns them into walking heroes, attacks and a very angry clock.
const W = 1280, H = 720;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const TITLE_FONT = "'Bungee', Impact, sans-serif";
const MONO = "'JetBrains Mono', Consolas, monospace";

const C = {
  ink: "#1b1430",
  noun: "#5aa9ff", verb: "#ff5d6c", adj: "#ffd23f", item: "#5fe08a",
  legend: "#ffb000", ult: "#c77dff", backfire: "#ff8a3d", crash: "#ff4fd8",
  boss: "#ff3b4e", dim: "#8d8aa8", text: "#f3eefc",
};
const KIND_COLOR = { noun: C.noun, verb: C.verb, adj: C.adj, item: C.item, legend: C.legend, ult: C.ult, backfire: C.backfire, crash: C.crash };

const GROUND = 500;           // top of the walkable floor
const BX = 1035, BY = 330;    // boss centre
const STEP_TIME = 0.8;        // seconds per word at normal speed

// ---------- sprites ----------
const SPRITE_KEYS = ["duck", "goose", "bug", "prod", "segfault", "rubber duck"];
const sprites = {};
for (const k of SPRITE_KEYS) {
  const img = new Image();
  img.onload = () => (sprites[k] = img);
  img.src = `sprites/${k.replace(/ /g, "-")}.svg`;
}

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hashHue(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(str, x, y, { size = 16, font = MONO, weight = "800", color = C.text, align = "center", base = "middle", shadow = true } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (shadow) { ctx.fillStyle = "rgba(10,6,25,0.85)"; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// ---------- background (pre-rendered once) ----------
const bg = document.createElement("canvas");
bg.width = W; bg.height = H;
(function paintBackground() {
  const g = bg.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#0a0920");
  sky.addColorStop(0.6, "#231546");
  sky.addColorStop(1, "#4a1e52");
  g.fillStyle = sky; g.fillRect(0, 0, W, GROUND);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.1})`;
    const s = Math.random() < 0.1 ? 2 : 1;
    g.fillRect(Math.random() * W, Math.random() * GROUND * 0.75, s, s);
  }
  // moon
  g.fillStyle = "#fff4d6"; g.beginPath(); g.arc(180, 150, 38, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#231546"; g.beginPath(); g.arc(198, 140, 34, 0, Math.PI * 2); g.fill();
  // far skyline (campus / server farm)
  let x = 0;
  while (x < W) {
    const w = 40 + Math.random() * 70, h = 60 + Math.random() * 130;
    g.fillStyle = "#170f30"; g.fillRect(x, GROUND - h, w, h);
    for (let wy = GROUND - h + 10; wy < GROUND - 10; wy += 16)
      for (let wx = x + 8; wx < x + w - 8; wx += 14)
        if (Math.random() < 0.28) { g.fillStyle = Math.random() < 0.8 ? "#ffcf6b55" : "#6be3ff55"; g.fillRect(wx, wy, 6, 8); }
    x += w + 4;
  }
  // floor
  const fl = g.createLinearGradient(0, GROUND, 0, H);
  fl.addColorStop(0, "#2b1d4d");
  fl.addColorStop(1, "#120c26");
  g.fillStyle = fl; g.fillRect(0, GROUND, W, H - GROUND);
  g.strokeStyle = "rgba(160,120,255,0.18)"; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = GROUND + 8 + i * i * 6; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = -10; i <= 22; i++) { g.beginPath(); g.moveTo(640 + i * 60, GROUND); g.lineTo(640 + i * 160, H); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(0, GROUND, W, 3);
})();

// ---------- game state ----------
let battle = null, phase = "loading", time = 0, stepTimer = 0, introT = 0, endT = 0;
let vis = new Map();          // hero id -> visual
let fx = [];                  // effects
let bossShown = 0, bossFlash = 0, shake = 0, bossPush = 0, bossLunge = 0;
let ribbonPos = 0, fast = false;
let lastStepEvents = [];

function slotHome(k) {
  const col = k % 4, row = k >> 2;
  return { x: 650 - col * 135 - row * 60, y: GROUND + 55 + row * 85 };
}

async function newBattle() {
  phase = "loading";
  let words;
  try { words = await (await fetch("/whack", { cache: "no-store" })).json(); }
  catch { words = ["duck", "quack", "goose", "honk"]; }
  battle = new Engine.Battle(words);
  vis = new Map(); fx = [];
  bossShown = battle.bossMax; ribbonPos = -1; stepTimer = 0;
  phase = "intro"; introT = 2.4;
}

// ---------- effects ----------
function particle(x, y, color, n = 12, speed = 260, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
    fx.push({ kind: "p", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), life: rand(0.4, 0.9), max: 0.9, color, size: rand(3, opts.size || 7), grav: opts.grav ?? 600, shape: opts.shape });
  }
}
function floatText(x, y, str, color, size = 28, life = 1.1) {
  fx.push({ kind: "t", x, y, str, color, size, life, max: life });
}
function projectile(pk, x0, y0, x1, y1, dur, onHit, delay = 0, extra = {}) {
  fx.push({ kind: "proj", pk, x0, y0, x1, y1, t: -delay, dur, onHit, ...extra });
}

function impact(d, tags, color, i = 0) {
  bossShown = Math.max(0, bossShown - d);
  bossFlash = 0.18;
  shake = Math.min(26, Math.max(shake, 5 + d / 10));
  bossPush = Math.min(1, bossPush + d / 200);
  const x = BX - 70 + rand(-20, 20), y = BY + rand(-60, 40);
  particle(x, y, color, 14 + Math.min(30, d / 6), 320);
  particle(x, y, "#fff", 6, 200);
  const size = d >= 200 ? 54 : d >= 90 ? 42 : d > 0 ? 32 : 26;
  floatText(x - 10, y - 30 - i * 24, String(d), d === 0 ? C.dim : d >= 90 ? C.legend : "#fff", size);
  if (i === 0 && tags && tags.length) floatText(BX - 60, BY - 175, tags.join(" · "), C.adj, 18, 1.6);
}

const MELEE = new Set(["whack", "push", "merge", "conflict", "crash"]);
const VERB_FX = {
  quack: { pk: "ring", color: "#ffd23f" }, honk: { pk: "ring", color: "#ffffff", big: true },
  deploy: { pk: "rocket", color: "#ff8a3d" }, commit: { pk: "check", color: "#5fe08a" },
  hack: { pk: "code", color: "#5fe08a" }, pitch: { pk: "slide", color: "#5aa9ff" },
  overflow: { pk: "orb", color: "#6be3ff" },
};

function handleEvent(e) {
  switch (e.type) {
    case "join": {
      const home = slotHome(e.hero.slot);
      const v = { h: e.hero, x: -70 - rand(0, 60), y: home.y, homeX: home.x, homeY: home.y, walkT: 0, facing: 1, flash: 0, dead: false, anim: null, leaving: false, born: time };
      vis.set(e.hero.id, v);
      if (e.hero.legend) floatText(220, GROUND - 40, "LEGENDARY!", C.legend, 34, 1.6);
      break;
    }
    case "leave": { const v = vis.get(e.hero.id); if (v) { v.leaving = true; v.facing = -1; } break; }
    case "clear": vis.delete(e.hero.id); break;
    case "die": {
      const v = vis.get(e.hero.id);
      if (v) {
        const kill = () => { v.dead = true; particle(v.x, v.y - 50, "#b9b4d6", 20, 220); };
        if (v.anim) v.anim.after = kill; else setTimeout(kill, 250);
      }
      break;
    }
    case "attack": attack(e); break;
    case "bossAttack": {
      const v = vis.get(e.hero.id);
      if (!v) break;
      bossLunge = 1;
      fx.push({ kind: "bolt", x0: BX - 80, y0: BY + 40, v, life: 0.35, max: 0.35, color: e.enraged ? "#ff2040" : "#ff5d6c", seed: Math.random() });
      v.flash = 0.35;
      shake = Math.max(shake, 8);
      floatText(v.x, v.y - 120, "-" + e.dmg, C.boss, 26);
      break;
    }
    case "healAll": case "sleep": {
      const targets = e.type === "sleep" ? [vis.get(e.hero.id)] : [...vis.values()].filter((v) => !v.dead && !v.leaving);
      for (const v of targets) if (v) { particle(v.x, v.y - 50, C.item, 10, 120, { grav: -200, shape: "plus", size: 9 }); floatText(v.x, v.y - 125, e.type === "sleep" ? "zzz +" + e.amount : "+" + e.amount, C.item, 20); }
      break;
    }
    case "coffee":
      for (const v of vis.values()) if (!v.dead) particle(v.x, v.y - 90, "#c8a27a", 6, 60, { grav: -160, size: 10 });
      floatText(360, GROUND - 60, "CAFFEINATED x1.5", "#c8a27a", 26, 1.4);
      break;
    case "backfire":
      shake = 14;
      for (const v of vis.values()) if (!v.dead) { v.flash = 0.4; particle(v.x, v.y - 50, C.backfire, 14, 260); }
      floatText(400, GROUND - 80, "MERGE CONFLICT!", C.backfire, 40, 1.5);
      break;
    case "void":
      floatText(320, GROUND - 60, `${e.tok.text}... *echo*`, C.dim, 24, 1.4);
      break;
    case "token":
      if (e.tok.kind === "adj") floatText(250, GROUND - 30, e.tok.text + "...", C.adj, 26, 1.2);
      break;
  }
}

function attack(e) {
  const v = vis.get(e.hero.id);
  const color = KIND_COLOR[e.verb === "stack overflow" ? "ult" : "verb"];
  const hit = (d, i) => impact(d, e.tags, VERB_FX[e.verb]?.color || color, i);
  if (!v) { e.dmg.forEach((d, i) => setTimeout(() => hit(d, i), i * 150)); return; }

  if (e.verb === "stack overflow") {
    v.anim = { type: "cast", t: 0, dur: 0.6, fromX: v.x, fire: () => {
      e.dmg.forEach((d, i) => {
        for (let b = 0; b < 6; b++) {
          projectile("block", BX + rand(-90, 50), -60 - b * 70, BX + rand(-70, 30), BY - 40 + b * 4, 0.55, b === 5 ? () => hit(d, i) : () => { shake = Math.max(shake, 6); particle(BX - 20, BY - 80, C.ult, 5, 160); }, b * 0.09 + i * 0.4, { hue: 260 + b * 12 });
        }
      });
    } };
    return;
  }
  if (MELEE.has(e.verb)) {
    v.anim = { type: "dash", t: 0, dur: e.verb === "crash" ? 0.5 : 0.62, fromX: v.x, toX: BX - 215, fire: () => {
      if (e.verb === "whack") fx.push({ kind: "hammer", x: BX - 150, y: BY - 10, life: 0.35, max: 0.35 });
      if (e.verb === "crash") { particle(BX - 120, BY, C.crash, 50, 500); floatText(BX - 120, BY - 120, "SEGMENTATION... no, NULL POINTER", C.crash, 20, 1.6); }
      e.dmg.forEach((d, i) => setTimeout(() => hit(d, i), i * 140));
    } };
    return;
  }
  const f = VERB_FX[e.verb] || { pk: "orb", color };
  v.anim = { type: "cast", t: 0, dur: 0.5, fromX: v.x, fire: () => {
    const s = spriteScale(v);
    const x0 = v.x + 40 * s, y0 = v.y - 60 * s;
    e.dmg.forEach((d, i) => {
      if (f.pk === "code") {
        for (let c = 0; c < 7; c++) projectile("code", x0, y0 + rand(-20, 20), BX - 60, BY + rand(-60, 60), 0.5 + c * 0.03, c === 6 ? () => hit(d, i) : null, c * 0.05 + i * 0.25, { ch: "01{};<>/"[Math.floor(Math.random() * 8)], color: f.color });
      } else {
        projectile(f.pk, x0, y0, BX - 70, BY + rand(-30, 30), f.pk === "rocket" ? 0.65 : 0.45, () => hit(d, i), i * 0.18, { color: f.color, big: f.big });
      }
    });
  } };
}

// ---------- update ----------
function update(dt) {
  time += dt;
  if (phase === "intro") { introT -= dt; ribbonPos = lerp(ribbonPos, 0, 1 - Math.exp(-dt * 3)); if (introT <= 0) phase = "play"; }
  if (phase === "play") {
    stepTimer -= dt;
    if (stepTimer <= 0 && !battle.done) {
      stepTimer = STEP_TIME;
      lastStepEvents = battle.step();
      lastStepEvents.forEach(handleEvent);
    }
    if (battle.done) {
      const busy = fx.some((f) => f.kind === "proj") || [...vis.values()].some((v) => v.anim);
      if (!busy) { endT += dt; if (endT > 1.2) { phase = "end"; endT = 0; if (battle.won) confetti(); } }
    }
  }
  if (battle) ribbonPos = lerp(ribbonPos, Math.max(0, battle.i - 1), 1 - Math.exp(-dt * 8));

  for (const v of vis.values()) {
    v.flash = Math.max(0, v.flash - dt);
    if (v.anim) {
      const a = v.anim;
      a.t += dt;
      const p = clamp(a.t / a.dur, 0, 1);
      if (a.type === "dash") { v.x = lerp(a.fromX, a.toX, Math.sin(p * Math.PI)); v.hop = Math.sin(p * Math.PI) * 50; }
      else { v.hop = Math.sin(p * Math.PI) * 20; v.x = a.fromX - Math.sin(p * Math.PI) * 10; }
      if (!a.fired && p >= (a.type === "dash" ? 0.5 : 0.25)) { a.fired = true; a.fire(); }
      if (p >= 1) { v.x = a.fromX; v.hop = 0; v.anim = null; if (a.after) a.after(); }
      continue;
    }
    if (v.dead) continue;
    const target = v.leaving ? -200 : v.homeX;
    const dx = target - v.x;
    v.moving = Math.abs(dx) > 2;
    if (v.moving) { v.x += Math.sign(dx) * Math.min(Math.abs(dx), 210 * dt); v.walkT += dt; }
    if (v.leaving && v.x < -150) vis.delete(v.h.id);
  }

  for (const f of fx) {
    if (f.kind === "p") { f.vy += f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.98; f.life -= dt; }
    else if (f.kind === "t") { f.y -= 40 * dt; f.life -= dt; }
    else if (f.kind === "proj") { f.t += dt; if (f.t >= f.dur) { f.dead = true; if (f.onHit) f.onHit(); } }
    else f.life -= dt;
  }
  fx = fx.filter((f) => !f.dead && (f.kind === "proj" || f.life > 0));

  bossFlash = Math.max(0, bossFlash - dt);
  shake = Math.max(0, shake - dt * 60);
  bossPush = Math.max(0, bossPush - dt * 2.5);
  bossLunge = Math.max(0, bossLunge - dt * 3);
}

function confetti() {
  const cols = [C.noun, C.verb, C.adj, C.item, C.legend, C.ult];
  for (let i = 0; i < 160; i++) fx.push({ kind: "p", x: rand(0, W), y: rand(-200, 0), vx: rand(-60, 60), vy: rand(50, 200), life: rand(2, 4), max: 4, color: cols[i % cols.length], size: rand(5, 10), grav: 120, shape: "rect" });
}

// ---------- drawing ----------
function spriteScale(v) { return v.h.scale * (0.9 + (v.y - GROUND) / 500); }

function drawHero(v) {
  const h = v.h, s = spriteScale(v);
  let bob = 0, rot = 0, sx = 1, sy = 1;
  if (v.moving && !v.dead) { bob = Math.abs(Math.sin(v.walkT * 10)) * 9; rot = Math.sin(v.walkT * 10) * 0.07; }
  else { sy = 1 + Math.sin(time * 2.6 + h.id) * 0.025; sx = 2 - sy; }
  if (h.adjs.includes("rubber") && !v.dead) { const b = Math.abs(Math.sin(time * 5 + h.id)); bob += b * 16; sy *= 0.92 + b * 0.1; sx = 2 - sy; }
  bob += v.hop || 0;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, 40 * s * (1 - bob / 160), 9 * s, 0, 0, Math.PI * 2); ctx.fill();

  if (v.dead) { drawTomb(v.x, v.y, s, h); return; }

  // legendary ground ring
  if (h.legend) {
    ctx.strokeStyle = `rgba(255,190,40,${0.5 + 0.3 * Math.sin(time * 4)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, 55 * s, 14 * s, 0, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.save();
  ctx.translate(v.x, v.y - bob);
  ctx.rotate(rot);
  ctx.scale(s * sx * v.facing, s * sy);
  if (h.adjs.includes("midnight")) { ctx.shadowColor = "#a46bff"; ctx.shadowBlur = 30; }
  if (h.legend) { ctx.shadowColor = "#ffc23a"; ctx.shadowBlur = 26 + Math.sin(time * 5) * 8; }
  if (h.nul) ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 9);
  if (v.flash > 0) ctx.filter = "brightness(2.4) saturate(0.4)";
  const img = sprites[h.key];
  if (img) ctx.drawImage(img, -60, -120, 120, 120);
  else drawBlob(h);
  ctx.filter = "none"; ctx.shadowBlur = 0;
  if (h.adjs.includes("one") || h.legend) drawCrown(h.legend ? "#ffc23a" : "#ffe27a");
  ctx.restore();

  // label + hp
  const top = v.y - bob - 125 * s;
  const adjs = h.adjs.map((a) => a.toUpperCase()).join(" ");
  const base = h.name.slice(adjs.length).trim();
  if (adjs) text(adjs, v.x, top - 30, { size: 11, color: C.adj });
  text(base, v.x, top - 16, { size: 14, color: h.legend ? C.legend : C.text });
  const bw = 64;
  rr(v.x - bw / 2, top - 6, bw, 7, 4); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
  rr(v.x - bw / 2, top - 6, bw * (h.hp / h.maxHp), 7, 4); ctx.fillStyle = h.hp / h.maxHp > 0.35 ? C.item : C.boss; ctx.fill();
}

// Placeholder creature for nouns that don't have an SVG sprite yet.
function drawBlob(h) {
  const hue = hashHue(h.key);
  ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.lineJoin = "round";
  ctx.fillStyle = `hsl(${hue} 30% 25%)`;
  rr(-30, -16, 16, 16, 5); ctx.fill(); ctx.stroke();
  rr(10, -16, 16, 16, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `hsl(${hue} 70% 62%)`;
  rr(-42, -100, 84, 88, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `hsl(${hue} 70% 75%)`;
  rr(-28, -60, 44, 34, 14); ctx.fill();
  for (const ex of [4, 26]) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, -74, 9, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(ex + 3, -73, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = `800 22px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = C.ink;
  ctx.fillText(h.key[0].toUpperCase(), -6, -42);
}

function drawCrown(color) {
  ctx.fillStyle = color; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -122); ctx.lineTo(-18, -140); ctx.lineTo(-9, -130); ctx.lineTo(0, -146); ctx.lineTo(9, -130); ctx.lineTo(18, -140); ctx.lineTo(18, -122);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawTomb(x, y, s, h) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "#6d6890"; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, -50); ctx.arc(0, -50, 26, Math.PI, 0); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.font = `800 13px ${MONO}`; ctx.textAlign = "center"; ctx.fillStyle = C.ink; ctx.fillText("RIP", 0, -46);
  ctx.restore();
  text(h.key.toUpperCase(), x, y - 90 * s, { size: 11, color: C.dim });
}

function drawBoss() {
  const p = battle ? battle.progress : 0;
  const enraged = battle && bossShown < battle.bossMax * 0.3;
  const x = BX + bossPush * 40 - bossLunge * 30 + (enraged ? rand(-2, 2) : 0);
  const y = BY + Math.sin(time * 1.7) * 7;
  const R = 150;

  // legs
  ctx.strokeStyle = C.ink; ctx.lineWidth = 16; ctx.lineCap = "round";
  for (const lx of [-60, 60]) { ctx.beginPath(); ctx.moveTo(x + lx * 0.8, y + R - 20); ctx.lineTo(x + lx, GROUND + 95); ctx.stroke(); }
  ctx.fillStyle = "#3a2a5a";
  for (const lx of [-60, 60]) { ctx.beginPath(); ctx.ellipse(x + lx + 10, GROUND + 98, 30, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 4; ctx.stroke(); }

  // alarm bells + hammer
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(x + sgn * 95, y - 120); ctx.rotate(sgn * 0.5 + Math.sin(time * (8 + p * 30)) * 0.08 * (1 + p * 3));
    ctx.fillStyle = "#d9a83a"; ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 38, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = C.ink; ctx.fillRect(x - 6, y - 175, 12, 30);

  // body with red glow
  ctx.save();
  ctx.shadowColor = `rgba(255,40,70,${0.35 + p * 0.6})`;
  ctx.shadowBlur = 30 + p * 50 + (enraged ? Math.sin(time * 12) * 15 : 0);
  const rim = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
  rim.addColorStop(0, "#f2c75c"); rim.addColorStop(1, "#8a5a1c");
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();

  const face = ctx.createRadialGradient(x - 30, y - 40, 10, x, y, R - 18);
  face.addColorStop(0, "#fffaf0");
  face.addColorStop(1, `rgb(${240}, ${222 - p * 90}, ${190 - p * 110})`);
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(x, y, R - 18, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.stroke();

  // ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 === 0 ? R - 44 : R - 36;
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * (R - 26), y + Math.sin(a) * (R - 26)); ctx.stroke();
  }

  // hands: 23:00 -> 00:00 as the words run out
  const minutes = phase === "end" && !battle.won ? 60 : p * 60;
  const ma = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
  const ha = ((11 + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = C.ink; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ha) * 62, y + Math.sin(ha) * 62); ctx.stroke();
  ctx.strokeStyle = "#c81e3a"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ma) * 100, y + Math.sin(ma) * 100); ctx.stroke();

  // face: angry eyes look at the party
  const look = -7;
  for (const sgn of [-1, 1]) {
    const ex = x + sgn * 48, ey = y - 30;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(ex, ey, 24, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = enraged ? "#ff2040" : C.ink;
    ctx.beginPath(); ctx.arc(ex + look, ey + 3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(ex - sgn * 30, ey - 36 + (enraged ? -4 : 0)); ctx.lineTo(ex + sgn * 20, ey - 22); ctx.stroke();
  }
  // mouth
  const mw = 46 + bossLunge * 14 + (enraged ? 10 : 0);
  ctx.fillStyle = "#3a0c1c"; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(x, y + 62, mw, 18 + bossLunge * 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 12 - 5, y + 48); ctx.lineTo(x + i * 12 + 5, y + 48); ctx.lineTo(x + i * 12, y + 58); ctx.fill(); }

  if (bossFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bossFlash * 3})`;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  }

  // HP bar + clock readout
  const bw = 360, bxl = BX - bw / 2, byt = 108;
  text("THE DEADLINE", BX, byt - 18, { font: TITLE_FONT, weight: "400", size: 22, color: "#ffd9de" });
  rr(bxl, byt, bw, 20, 10); ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();
  const frac = battle ? bossShown / battle.bossMax : 1;
  if (frac > 0) { rr(bxl + 3, byt + 3, (bw - 6) * frac, 14, 7); const g = ctx.createLinearGradient(bxl, 0, bxl + bw, 0); g.addColorStop(0, "#ff3b4e"); g.addColorStop(1, "#ff9a3d"); ctx.fillStyle = g; ctx.fill(); }
  text(`${Math.ceil(bossShown)} / ${battle ? battle.bossMax : 0}`, BX, byt + 10, { size: 12 });
  const mm = Math.floor(minutes);
  const clock = mm >= 60 ? "00:00" : `23:${String(mm).padStart(2, "0")}`;
  text(clock, bxl - 16, byt + 10, { size: 26, align: "right", color: mm > 50 ? C.boss : C.text });
}

function drawFx() {
  for (const f of fx) {
    if (f.kind === "p") {
      ctx.globalAlpha = clamp(f.life / 0.5, 0, 1);
      ctx.fillStyle = f.color;
      if (f.shape === "plus") { ctx.fillRect(f.x - f.size / 2, f.y - 1.5, f.size, 3); ctx.fillRect(f.x - 1.5, f.y - f.size / 2, 3, f.size); }
      else if (f.shape === "rect") { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.life * 6); ctx.fillRect(-f.size / 2, -f.size / 4, f.size, f.size / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (f.life / f.max + 0.3), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (f.kind === "t") {
      const a = clamp(f.life / 0.4, 0, 1);
      const pop = 1 + Math.max(0, (f.life - f.max + 0.15) / 0.15) * 0.4;
      ctx.globalAlpha = a;
      text(f.str, f.x, f.y, { size: f.size * pop, font: TITLE_FONT, weight: "400", color: f.color });
      ctx.globalAlpha = 1;
    } else if (f.kind === "proj") {
      if (f.t < 0) continue;
      const p = clamp(f.t / f.dur, 0, 1);
      const x = lerp(f.x0, f.x1, p), y = lerp(f.y0, f.y1, p) - Math.sin(p * Math.PI) * (f.pk === "rocket" ? 90 : f.pk === "block" ? 0 : 30);
      drawProjectile(f, x, y, p);
    } else if (f.kind === "bolt") {
      const p = 1 - f.life / f.max;
      ctx.strokeStyle = f.color; ctx.lineWidth = 6 * (1 - p) + 2; ctx.shadowColor = f.color; ctx.shadowBlur = 20;
      const tx = f.v.x, ty = f.v.y - 60;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0);
      let r = f.seed;
      for (let i = 1; i < 9; i++) { r = (r * 9301 + 49297) % 233280 / 233280; ctx.lineTo(lerp(f.x0, tx, i / 9), lerp(f.y0, ty, i / 9) + (r - 0.5) * 60); }
      ctx.lineTo(tx, ty); ctx.stroke(); ctx.shadowBlur = 0;
    } else if (f.kind === "hammer") {
      const p = 1 - f.life / f.max;
      ctx.save(); ctx.translate(f.x, f.y + 120); ctx.rotate(-1.4 + p * 1.9);
      ctx.fillStyle = "#8a5a2b"; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
      rr(-7, -150, 14, 150, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c9c4dc"; rr(-36, -190, 72, 46, 8); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawProjectile(f, x, y, p) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  switch (f.pk) {
    case "ring": {
      ctx.strokeStyle = f.color; ctx.lineWidth = f.big ? 6 : 4; ctx.shadowColor = f.color; ctx.shadowBlur = 12;
      for (let i = 0; i < 3; i++) { const r = (f.big ? 22 : 14) + i * 12 + p * 20; ctx.globalAlpha = 1 - i * 0.25; ctx.beginPath(); ctx.arc(-i * 18, 0, r, -0.7, 0.7); ctx.stroke(); }
      break;
    }
    case "rocket": {
      const ang = Math.atan2(f.y1 - f.y0 - Math.cos(p * Math.PI) * 90 * Math.PI, f.x1 - f.x0);
      ctx.rotate(clamp(ang, -0.9, 0.9));
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(-50 - Math.random() * 14, 0); ctx.lineTo(-30, 6); ctx.fill();
      ctx.fillStyle = "#e8e6f2"; rr(-30, -9, 42, 18, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(12, -9); ctx.lineTo(26, 0); ctx.lineTo(12, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      particle(x - 30, y, "#ffb26b", 1, 40, { grav: 0, size: 5 });
      break;
    }
    case "check": {
      ctx.strokeStyle = f.color; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.shadowColor = f.color; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 10); ctx.lineTo(16, -14); ctx.stroke();
      break;
    }
    case "code":
      ctx.globalAlpha = 0.9;
      text(f.ch, 0, 0, { size: 22, color: f.color, shadow: false });
      break;
    case "slide": {
      ctx.rotate(p * 10);
      ctx.fillStyle = "#fff"; rr(-22, -15, 44, 30, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = f.color; ctx.fillRect(-16, -9, 22, 5); ctx.fillRect(-16, 0, 30, 3); ctx.fillRect(-16, 6, 18, 3);
      break;
    }
    case "block": {
      ctx.fillStyle = `hsl(${f.hue} 70% 62%)`; rr(-34, -16, 68, 32, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.font = `800 12px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("frame", 0, 1);
      break;
    }
    default: {
      ctx.fillStyle = f.color || "#fff"; ctx.shadowColor = f.color || "#fff"; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawRibbon() {
  ctx.fillStyle = "rgba(8,6,22,0.78)"; ctx.fillRect(0, 0, W, 74);
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(0, 73, W, 1);
  if (!battle) return;
  const cw = 150, gap = 10, cx = W / 2;
  for (let j = Math.floor(ribbonPos) - 6; j <= Math.ceil(ribbonPos) + 6; j++) {
    if (j < 0 || j >= battle.tokens.length) continue;
    const t = battle.tokens[j];
    const x = cx + (j - ribbonPos) * (cw + gap) - cw / 2;
    const cur = j === battle.i - 1 && phase !== "intro";
    const past = j < battle.i - 1;
    const col = KIND_COLOR[t.kind];
    ctx.globalAlpha = past ? 0.35 : 1;
    if (cur) { ctx.shadowColor = col; ctx.shadowBlur = 24; }
    rr(x, 12, cw, 50, 10); ctx.fillStyle = cur ? "#2a2050" : "#17122f"; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = cur ? 3 : 2; ctx.strokeStyle = col; ctx.stroke();
    text(t.text, x + cw / 2, 31, { size: t.text.length > 12 ? 13 : 16, color: "#fff", shadow: false });
    text(Engine.KIND_LABEL[t.kind], x + cw / 2, 51, { size: 10, color: col, shadow: false });
    ctx.globalAlpha = 1;
  }
  // fade edges
  for (const [x0, x1] of [[0, 120], [W, W - 120]]) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "rgba(8,6,22,1)"); g.addColorStop(1, "rgba(8,6,22,0)");
    ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, 120, 74);
  }
  text(`WORD ${Math.max(0, battle.i)}/${battle.tokens.length}`, 16, 92, { size: 13, align: "left", color: C.dim });
}

function drawLog() {
  if (!battle) return;
  const g = ctx.createLinearGradient(0, H - 80, 0, H);
  g.addColorStop(0, "rgba(8,6,22,0)"); g.addColorStop(1, "rgba(8,6,22,0.9)");
  ctx.fillStyle = g; ctx.fillRect(0, H - 80, W, 80);
  const lines = battle.logs.slice(-3);
  lines.forEach((l, i) => {
    ctx.globalAlpha = 0.45 + 0.55 * ((i + 1) / lines.length);
    text(l.text, 24, H - 62 + i * 21 + (3 - lines.length) * 21, { size: 14, align: "left", weight: "500", color: C[l.kind] || C.text });
  });
  ctx.globalAlpha = 1;
  text("hold SPACE: fast-forward   R: whack() again", W - 20, H - 18, { size: 11, align: "right", color: C.dim, weight: "500" });
}

function drawOverlay() {
  if (phase === "intro" && battle) {
    const a = clamp(introT / 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(8,6,22,0.6)"; ctx.fillRect(0, 230, W, 170);
    text("whack()", W / 2, 270, { font: TITLE_FONT, weight: "400", size: 30, color: C.dim });
    text(`returned ${battle.words.length} word${battle.words.length === 1 ? "" : "s"}`, W / 2, 320, { font: TITLE_FONT, weight: "400", size: 52 });
    text(battle.words.length < 25 ? "...that is not a lot of army." : "Your army assembles before midnight.", W / 2, 370, { size: 16, color: C.adj });
    ctx.globalAlpha = 1;
  }
  if (phase === "loading") text("calling whack()...", W / 2, H / 2, { font: TITLE_FONT, weight: "400", size: 36 });
  if (phase === "end") {
    ctx.fillStyle = "rgba(8,6,22,0.7)"; ctx.fillRect(0, 180, W, 300);
    if (battle.won) text("SHIPPED!", W / 2, 250, { font: TITLE_FONT, weight: "400", size: 80, color: C.item });
    else text("DEADLINE MISSED", W / 2, 250, { font: TITLE_FONT, weight: "400", size: 72, color: C.boss });
    text(battle.won ? "THE DEADLINE has been defeated with time to spare." : `THE DEADLINE survives with ${battle.bossHp} HP. The words ran out.`, W / 2, 310, { size: 18 });
    text(`${battle.words.length} words  ·  ${battle.recruited} heroes recruited  ·  ${battle.totalDmg} total damage`, W / 2, 350, { size: 16, color: C.dim });
    text(`best hit: ${battle.best.text} (${battle.best.dmg})`, W / 2, 380, { size: 16, color: C.adj });
    text("press R to whack() again", W / 2, 435, { font: TITLE_FONT, weight: "400", size: 22, color: Math.sin(time * 4) > 0 ? C.text : C.dim });
  }
}

function render() {
  ctx.save();
  ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  ctx.drawImage(bg, 0, 0);
  if (battle) { ctx.fillStyle = `rgba(255,20,60,${battle.progress * 0.16})`; ctx.fillRect(0, 0, W, H); }
  drawBoss();
  const heroes = [...vis.values()].sort((a, b) => a.y - b.y);
  heroes.forEach(drawHero);
  drawFx();
  ctx.restore();
  drawRibbon();
  drawLog();
  drawOverlay();
}

// ---------- loop & input ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * (fast ? 4 : 1);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
addEventListener("keydown", (e) => {
  if (e.code === "Space") { fast = true; e.preventDefault(); }
  if (e.code === "KeyR" && phase !== "loading") newBattle();
});
addEventListener("keyup", (e) => { if (e.code === "Space") fast = false; });
newBattle();
requestAnimationFrame(frame);
