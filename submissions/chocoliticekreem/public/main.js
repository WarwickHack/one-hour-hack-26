import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { buildWorld } from "./world.js";
import { Pond } from "./pond.js";
import { connect } from "./net.js";

const AUTO_WHACK_MS = 4000;
const SELF_WHACK_COOLDOWN_MS = 10000;
const POS_SEND_MS = 250;
const BUFFS = new Set(["coffee", "rubber", "null", "pizza"]);
const DEADLINE = 90;
const ROUND_MS = 60000;
const currentRound = () => Math.floor(Date.now() / ROUND_MS);
const roundFrac = () => (Date.now() % ROUND_MS) / ROUND_MS;
const MAX_HP = 5;
const BAD = new Set(["goose", "honk", "prod", "segfault", "null", "pointer", "overflow", "conflict", "sleep", "bug"]);
const GOOD = new Set(["duck", "coffee", "pizza", "rubber", "feature", "prize", "deploy", "merge"]);

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
const outline = new OutlineEffect(renderer, { defaultThickness: 0.006, defaultColor: [0.05, 0.05, 0.1], defaultAlpha: 1 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 55, 75);
const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 0, 0);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.47;

const world = buildWorld(scene);
const pond = new Pond(scene, world);

let audio = null;
function sfx(kind) {
  try {
    audio = audio || new AudioContext();
    const t = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.connect(g).connect(audio.destination);
    const tones = {
      quack: ["sawtooth", 520, 260, 0.18],
      hit: ["square", 160, 60, 0.25],
      pickup: ["sine", 880, 1320, 0.12],
      logo: ["triangle", 660, 1760, 0.3],
      ko: ["triangle", 440, 1100, 0.35],
    };
    const [type, f0, f1, dur] = tones[kind];
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur);
  } catch { /* sound is a bonus */ }
}
let shake = 0;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
function sharpenTextures() {
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) for (const key of ["map", "emissiveMap"]) {
      const t = m[key];
      if (t && t.anisotropy !== MAX_ANISO) { t.anisotropy = MAX_ANISO; t.needsUpdate = true; }
    }
  });
}
sharpenTextures();
setInterval(sharpenTextures, 3000);

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
  el.innerHTML = text;
  el.className = cls;
  box.append(el);
  setTimeout(() => el.remove(), 3200);
  while (box.children.length > 3) box.firstChild.remove();
  drawIcons();
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
  goose: "bird", honk: "megaphone", prod: "flame", segfault: "zap", null: "ghost", pointer: "mouse-pointer-2",
  sleep: "moon", bug: "bug", overflow: "layers", stack: "layers", conflict: "swords", duck: "egg", coffee: "coffee",
  pizza: "pizza", rubber: "life-buoy", feature: "sparkles", prize: "trophy", deploy: "rocket", merge: "git-merge",
  commit: "git-commit-horizontal", push: "upload", wifi: "wifi", midnight: "moon-star", demo: "presentation",
  pitch: "mic", whack: "hammer", hack: "terminal", quack: "message-circle", warwick: "landmark", oculus: "eye",
  compsoc: "cpu", marshall: "chart-candlestick", wace: "chart-candlestick", brevan: "globe", howard: "globe",
  capital: "credit-card", one: "credit-card", bloomberg: "chart-line", netcraft: "shield", incident: "siren",
  io: "siren", semicolon: "code",
};
const icon = (name) => `<i data-lucide="${name}" class="ic"></i>`;
const drawIcons = () => window.lucide?.createIcons();

function playerColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 85%, 62%)`;
}

function shortName(name) {
  const n = String(name);
  return n.length > 8 ? `${n.slice(0, 8)}…` : n;
}

const feed = [];
function addFeed(source, words) {
  const c = countWords(words);
  const top = Object.entries(c)
    .sort((a, b) => (!!ICONS[b[0]] - !!ICONS[a[0]]) || b[1] - a[1])
    .slice(0, 2)
    .map(([w]) => `<span class="${BAD.has(w) ? "hot" : GOOD.has(w) ? "good" : ""}">${icon(ICONS[w] || "circle")}${w}</span>`)
    .join(" ");
  const color = source === "server" ? "#8a90a8" : source === "you" ? "#ffd166" : playerColor(source);
  const label = source === "server" ? "server" : source === "you" ? "you" : shortName(source);
  feed.unshift(`<span class="src" style="background:${color}">${escapeHtml(label)}</span> ${top}`);
  feed.length = Math.min(feed.length, 4);
  $("file").innerHTML = feed.map((html, i) => `<div class="row${i === 0 ? " newest" : ""}" style="opacity:${1 - i * 0.22}">${html}</div>`).join("");
  drawIcons();
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
  $("file-head").innerHTML = "latest whack() calls";
  $("file").innerHTML = "";
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
  if (c.goose || c.honk) g.push(`${icon("bird")} GEESE — swim away`);
  if (c.prod) g.push(`${icon("flame")} METEOR — keep moving`);
  if (c.bug || c.feature) g.push(`${icon("bug")} bugs on the shore — eat them`);
  if (c.pizza || c.coffee) g.push(`${icon("pizza")} food on the lake — grab it`);
  return g;
}

function applyToPlayer(c) {
  const e = state.effects;
  const lines = [];
  if (c.segfault) { state.score = Math.max(0, state.score - 10); lines.push("segfault −10"); }
  for (const [word, slug] of Object.entries(SPONSOR_SLUGS)) {
    if ((c[word] || 0) >= 2) spawnLogo(word, slug);
  }
  return lines;
}

const SPONSOR_SLUGS = {
  marshall: "marshallwace", wace: "marshallwace", brevan: "brevanhoward", howard: "brevanhoward",
  capital: "capitalone", one: "capitalone", bloomberg: "bloomberg", netcraft: "netcraft",
  incident: "incidentio", io: "incidentio",
};
const LOGO_FILES = {
  marshallwace: "marshallwace.png", brevanhoward: "brevanhoward.png", capitalone: "capitalone.png",
  bloomberg: "bloomberg.png", netcraft: "netcraft.jpg", incidentio: "incidentio.png",
};
const logoTextures = {};
const logoLoader = new THREE.TextureLoader();
const logos = [];
const MAX_LOGOS = 4;

function logoTexture(slug) {
  if (!logoTextures[slug]) {
    logoTextures[slug] = logoLoader.load(`logos/${LOGO_FILES[slug]}`);
    logoTextures[slug].colorSpace = THREE.SRGBColorSpace;
  }
  return logoTextures[slug];
}

function spawnLogo(word, slug) {
  if (logos.length >= MAX_LOGOS || logos.some((l) => l.userData.slug === slug)) return;
  const g = new THREE.Group();
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshBasicMaterial({ map: logoTexture(slug), side: THREE.DoubleSide, transparent: true }),
  );
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.9), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  backing.position.z = 0;
  card.position.z = 0.02;
  const cardBack = card.clone();
  cardBack.position.z = -0.02;
  cardBack.rotation.y = Math.PI;
  card.position.y = backing.position.y = 2.2;
  const fit = () => {
    const img = card.material.map.image;
    if (!img || !img.width) return;
    const w = 3.4;
    const h = Math.max(0.5, Math.min(1.9, w * img.height / img.width));
    card.scale.set(w / 3.2, h / 1.6, 1);
    cardBack.scale.copy(card.scale);
    backing.scale.set((w + 0.4) / 3.5, (h + 0.4) / 1.9, 1);
  };
  const glow = new THREE.Mesh(glowGeo, glowMats.good);
  glow.rotation.x = -Math.PI / 2;
  glow.scale.setScalar(1.6);
  const tag = wordTag(`${word} +50`, "good");
  tag.position.y = 3.3;
  tags.push(tag);
  g.add(backing, card, glow, tag, cardBack);
  g.position.copy(world.randomLakePoint());
  g.userData = { slug, word, born: performance.now(), cards: [backing, card, cardBack] };
  fit();
  if (!card.material.map.image?.width) setTimeout(fit, 800);
  scene.add(g);
  logos.push(g);
}

function updateLogos() {
  const now = performance.now();
  for (let i = logos.length - 1; i >= 0; i--) {
    const g = logos[i];
    g.rotation.y += 0.02;
    for (const m of g.userData.cards) m.position.y = 2.2 + Math.sin(now / 300 + i) * 0.25;
    const grabbed = state.phase === "play" && g.position.distanceTo(duck.position) < 2.6;
    if (grabbed) {
      addPoints(50);
      sfx("logo");
      toast(`${icon("trophy")} ${g.userData.word} +50`, "score");
      world.logoBurst?.(g.userData.word);
    }
    if (grabbed || now - g.userData.born > 25000) {
      scene.remove(g);
      logos.splice(i, 1);
    }
  }
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
    const victim = net.sendWhack(words, (id) => ghosts.get(id)?.userData.target?.alive) || whackBot(words);
    addFeed("you", words);
    addPoints(victim ? 30 : 10);
    header = victim
      ? `${icon("crosshair")} whack() → ${escapeHtml(shortName(victim))} +30`
      : `${icon("crosshair")} whack() → the lake +10`;
    const me = pond.player;
    pond.player = null;
    pondLines = victim ? [] : pond.applyWhack(words) || [];
    pond.player = me;
    playerLines = applyToPlayer(countWords(words.filter((w) => BUFFS.has(w))));
  } else {
    pondLines = pond.applyWhack(words) || [];
    playerLines = state.phase === "play" ? applyToPlayer(c) : [];
    addFeed("server", words);
    if (state.phase === "play") {

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
    .map(([w]) => `${icon(ICONS[w])}${w}`)
    .join(" ") || "nothing scary";
}

function showOutcome(text) {
  const el = $("outcome");
  el.innerHTML = text;
  drawIcons();
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 6000);
}

function onResult({ victim, hearts, died }) {
  const bonus = hearts * 15 + (died ? 100 : 0);
  if (bonus) addPoints(bonus);
  if (died) sfx("ko");
  showOutcome(died
    ? `${icon("skull")} You KO'd ${escapeHtml(shortName(victim))}! +${bonus}`
    : hearts
      ? `${icon("heart-crack")} You hit ${escapeHtml(shortName(victim))}! +${bonus}`
      : `${icon("wind")} ${escapeHtml(shortName(victim))} dodged it`);
}

function onWhacked({ from, fromId, words }) {
  if (state.phase !== "play") return;
  const hpBefore = state.hp;
  if (fromId) setTimeout(() => {
    net.sendResult(fromId, { hearts: Math.max(0, hpBefore - Math.max(0, state.hp)), died: state.phase === "dead" });
  }, 5000);
  showFile(words.join("\n") + "\n", words, from);
  const pondLines = pond.applyWhack(words) || [];
  const playerLines = applyToPlayer(countWords(words));
  addFeed(from, words);
  log([...pondLines].reverse());
  log([...playerLines].reverse(), "you");
  toast(`${icon("crosshair")} ${escapeHtml(shortName(from))} whacked you`, "warn");
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

const TAG_KINDS = { goose: "bad", bug: "good", food: "good", rubber: "good" };
const tagged = new WeakSet();
const glowGeo = new THREE.RingGeometry(1.1, 1.5, 24);
const glowMats = {
  bad: new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  good: new THREE.MeshBasicMaterial({ color: 0x3bff9a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
};
function wordTag(text, mood) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = mood === "bad" ? "rgba(200,30,40,.85)" : "rgba(20,150,90,.85)";
  ctx.beginPath();
  ctx.roundRect(28, 10, 200, 44, 22);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 42);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true });
  mat.userData.outlineParameters = { visible: false };
  const sp = new THREE.Sprite(mat);
  sp.scale.set(2.4, 0.6, 1);
  sp.userData.born = performance.now();
  return sp;
}
const tags = [];
function tagNewEntities() {
  const lists = { goose: pond.geese, bug: pond.bugs, food: pond.foods, rubber: pond.rubbers };
  for (const [kind, list] of Object.entries(lists)) {
    for (const e of list || []) {
      if (tagged.has(e)) continue;
      tagged.add(e);
      const mood = TAG_KINDS[kind];
      const glow = new THREE.Mesh(glowGeo, glowMats[mood]);
      glow.material.userData.outlineParameters = { visible: false };
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.05;
      e.group.add(glow);
      const tag = wordTag(kind === "food" ? e.food : kind, mood);
      tag.userData.follow = e.group;
      scene.add(tag);
      tags.push(tag);
    }
  }
}
function fadeTags() {
  const now = performance.now();
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i];
    const age = (now - t.userData.born) / 1000;
    const f = t.userData.follow;
    if (f) t.position.set(f.position.x, f.position.y + 1.4, f.position.z);
    t.material.opacity = age < 3 ? 1 : Math.max(0, 1 - (age - 3));
    if (age > 4) {
      t.parent?.remove(t);
      t.material.map.dispose();
      t.material.dispose();
      tags.splice(i, 1);
    }
  }
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
  const label = shortName(text);
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.font = "600 56px Fredoka, system-ui, sans-serif";
  const w = Math.min(480, ctx.measureText(label).width + 110);
  const x0 = (512 - w) / 2;
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(15,20,52,.82)";
  ctx.beginPath();
  ctx.roundRect(x0, 18, w, 84, 42);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = playerColor(text);
  ctx.beginPath();
  ctx.arc(x0 + 44, 60, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x0 + 70, 62);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  mat.userData.outlineParameters = { visible: false };
  const s = new THREE.Sprite(mat);
  s.scale.set(3.6, 0.9, 1);
  s.position.y = 2.7;
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

const BOT_NAMES = ["Rootes", "SigmaSoc", "W Hack"];
const bots = BOT_NAMES.map((name) => {
  const group = buildPlayerDuck(PLAYER_PURPLE);
  group.add(nameTag(name));
  group.position.copy(world.randomLakePoint());
  scene.add(group);
  return { name, group, heading: Math.random() * Math.PI * 2, hp: MAX_HP, deadUntil: 0, score: 0, nextWhack: performance.now() + 8000 + Math.random() * 10000 };
});

let lastBotScore = 0;
function updateBots(dt) {
  const now = performance.now();
  if (state.phase === "play" && now - lastBotScore > 4000) {
    lastBotScore = now;
    for (const b of bots) if (!b.deadUntil) b.score += 10 + Math.floor(Math.random() * 20);
  }
  for (const b of bots) {
    if (b.deadUntil && now > b.deadUntil) {
      b.deadUntil = 0;
      b.hp = MAX_HP;
      b.group.position.copy(world.randomLakePoint());
    }
    b.group.visible = !b.deadUntil;
    if (b.deadUntil) continue;
    b.heading += (Math.random() - 0.5) * 2 * dt;
    let x = b.group.position.x + Math.sin(b.heading) * 7 * dt;
    let z = b.group.position.z + Math.cos(b.heading) * 7 * dt;
    if (!world.isInLake(x, z)) {
      b.heading += Math.PI;
      x = b.group.position.x;
      z = b.group.position.z;
    }
    b.group.position.set(x, world.lake.waterY + Math.sin(now / 300 + x) * 0.06, z);
    b.group.rotation.y = b.heading;
    if (state.phase === "play" && now > b.nextWhack) {
      b.nextWhack = now + 15000 + Math.random() * 10000;
      fetch("/api/whack").then((r) => r.json()).then(({ words }) => onWhacked({ from: b.name, fromId: null, words })).catch(() => {});
    }
  }
}

function whackBot(words) {
  const alive = bots.filter((b) => !b.deadUntil);
  if (!alive.length) return null;
  const b = alive[Math.floor(Math.random() * alive.length)];
  const c = countWords(words);
  const hearts = Math.min(b.hp, Math.floor(((c.goose || 0) + (c.honk || 0) + 2 * (c.prod || 0)) / 4));
  b.hp -= hearts;
  const died = b.hp <= 0;
  if (died) b.deadUntil = performance.now() + 10000;
  setTimeout(() => onResult({ victim: b.name, hearts, died }), 5000);
  return b.name;
}

const playerId = (crypto.randomUUID?.() || String(Math.random())).slice(0, 8);
const net = connect({ id: playerId, name: "lurker", onPos, onLeave, onWhacked, onResult });
let lastPosSend = 0;

pond.onPlayerHit = (kind, by) => {
  if (state.phase !== "play" || state.effects.invuln > 0) return;
  if (state.effects.shield > 0) return;
  const dmg = 1;
  state.hp -= dmg;
  state.effects.invuln = 1;
  flash(kind === "prod" ? "#ff8a00" : "#ff3b2f");
  toast(kind === "prod" ? `${icon("flame")} hit −${dmg} ♥` : `${icon("bird")} bitten −${dmg} ♥`, "warn");
  sfx("hit");
  shake = 0.35;
  if (state.hp <= 0) end(false, kind === "prod" ? "a PROD meteor" : by);
};

pond.onPlayerPickup = (kind) => {
  if (state.phase !== "play") return;
  if (kind === "bug") { addPoints(10); log(["🐛 you ate a bug (+10)"], "you"); }
  if (kind === "feature") { addPoints(50); log(["✨ you ate a FEATURE (+50)"], "you"); }
  sfx("pickup");
  if (kind === "pizza") { addPoints(25); state.hp = Math.min(MAX_HP, state.hp + 1); log(["🍕 +25 · +1 ❤"], "you"); }
  if (kind === "coffee") { addPoints(25); state.effects.fast = Math.max(state.effects.fast, 4); log(["☕ +25 · speed"], "you"); }
};

function selfWhack() {
  sfx("quack");
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

async function showMenu(headline = "") {
  const b = $("banner");
  b.classList.remove("spectate");
  b.hidden = false;
  b.innerHTML = `
    ${headline}
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
  state.joinedAt = performance.now();
  bots.forEach((b, i) => {
    b.nextWhack = performance.now() + 10000 + i * 7000;
    b.score = 0;
    const ang = state.heading + (i - 1) * 0.7;
    const dist = 10 + i * 4;
    const x = duck.position.x + Math.sin(ang) * dist;
    const z = duck.position.z + Math.cos(ang) * dist;
    b.group.position.copy(world.isInLake(x, z) ? new THREE.Vector3(x, world.lake.waterY, z) : world.randomLakePoint());
  });
}

async function end(survived, diedTo) {
  state.phase = survived ? "menu" : "dead";
  state.diedTo = diedTo;
  if (!survived) duck.visible = false;
  const body = { name: state.name, score: state.score, survived, died_to: diedTo, whacks: state.whacks, round: state.round };
  try {
    await fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { /* leaderboard is a bonus; the game still ends */ }
  if (survived) {
    showMenu(`<p class="survived">SURVIVED 🏆 <b>${state.score}</b> pts</p>`);
    return;
  }
  if (state.phase !== "dead") return;
  const b = $("banner");
  b.hidden = false;
  b.classList.add("spectate");
  b.innerHTML = `
    <div class="card">
      <h1>${survived ? "SURVIVED 🏆" : "QUACKED"}</h1>
      <p class="sub">${survived ? "" : `${escapeHtml(diedTo)} got you · `}<b>${state.score}</b> pts</p>
      <p class="sub">👀 spectating · drag to look around · next round in <b id="countdown"></b></p>
    </div>
    ${await leaderboardHtml()}`;
}

addEventListener("keydown", (ev) => {
  const k = ev.key.toLowerCase();
  if (k === "enter" && state.phase === "menu") {
    start();
    return;
  }
  if (ev.target.tagName === "INPUT") return;
  if (k === " ") { ev.preventDefault(); selfWhack(); return; }
  keys.add(k);
});
addEventListener("keyup", (ev) => keys.delete(ev.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
$("whack-btn").addEventListener("click", () => (state.phase === "play" ? selfWhack() : doWhack(false)));

const PLAYER_RADIUS = 1.1;
function bump(x, z, pos, r) {
  const dx = pos.x - x;
  const dz = pos.z - z;
  const d = Math.hypot(dx, dz);
  const min = r + PLAYER_RADIUS;
  if (d < min) {
    const nx = d > 0.0001 ? dx / d : 1;
    const nz = d > 0.0001 ? dz / d : 0;
    pos.x = x + nx * min;
    pos.z = z + nz * min;
  }
}

// bumper-boat physics: the player shoves creatures and bots aside, so they can't be passed through and never pin you
function collide(x, z) {
  for (const e of pond.ducks || []) bump(x, z, e.pos, 1.0);
  for (const e of pond.geese || []) bump(x, z, e.pos, 1.4);
  for (const e of pond.rubbers || []) bump(x, z, e.pos, 2.0);
  for (const b of bots) if (!b.deadUntil) bump(x, z, b.group.position, 1.3);
  return [x, z];
}

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
  [x, z] = collide(x, z);
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
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake * 2;
    camera.position.y += (Math.random() - 0.5) * shake * 2;
  }
  camera.lookAt(camTarget);
  orbit.target.copy(duck.position);
}

const crown = (() => {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.7, roughness: 0.25, emissive: 0x7a5200, emissiveIntensity: 0.4 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), gold);
    const a = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.38, 0.25, Math.sin(a) * 0.38);
    g.add(spike);
  }
  g.visible = false;
  scene.add(g);
  return g;
})();
let crownOn = null;

let lastLive = 0;
function renderLive() {
  if (crownOn) {
    crown.position.set(crownOn.position.x, crownOn.position.y + 2.45, crownOn.position.z);
    crown.rotation.y += 0.03;
  }
  const now = performance.now();
  if (now - lastLive < 500) return;
  lastLive = now;
  const rows = [];
  if (state.phase === "play") rows.push({ name: state.name, score: state.score, me: true });
  for (const b of bots) if (!b.deadUntil) rows.push({ name: b.name, score: b.score, bot: true });
  for (const g of ghosts.values()) {
    const t = g.userData.target;
    if (t?.alive) rows.push({ name: t.name, score: t.score || 0, group: g });
  }
  rows.sort((a, b) => b.score - a.score);
  const leader = rows[0];
  crownOn = !leader ? null : leader.me ? duck : leader.bot ? bots.find((b) => b.name === leader.name)?.group : leader.group;
  crown.visible = state.phase === "play" && !!crownOn;
  const el = $("live");
  el.hidden = state.phase !== "play";
  el.innerHTML = `<div class="panel-head">live ranking</div>${rows.slice(0, 6).map((r, i) =>
    `<div class="live-row${r.me ? " me" : ""}"><span>${i + 1}. ${escapeHtml(shortName(r.name))}${r.bot ? " <em>bot</em>" : ""}</span><b>${r.score}</b></div>`).join("")}`;
}

function renderHud() {
  renderLive();
  const idle = performance.now() - Math.max(state.lastSelfWhack, state.joinedAt || 0);
  $("nudge").hidden = !(state.phase === "play" && idle > 10000);
  const playing = state.phase === "play";
  $("clock").textContent = clockText();
  const toNext = Math.max(0, state.nextAuto - performance.now()) / AUTO_WHACK_MS;
  $("next-bar").style.width = `${(1 - toNext) * 100}%`;
  $("hp").textContent = playing ? "♥".repeat(Math.max(0, state.hp)) + "♡".repeat(Math.max(0, MAX_HP - state.hp)) : "";
  $("score").textContent = playing ? `${state.score}` : "";
  const left = Math.ceil((SELF_WHACK_COOLDOWN_MS - (performance.now() - state.lastSelfWhack)) / 1000);
  const cd = $("mycd");
  cd.hidden = !playing;
  cd.textContent = left > 0 ? `your whack ${left}s` : "your whack READY";
  cd.className = left > 0 ? "" : "ready";
  const btn = $("whack-btn");
  btn.disabled = playing && left > 0;
  btn.textContent = !playing ? "WHACK()" : left > 0 ? `recharging ${left}s` : `WHACK() a duck (${net.peers.size + bots.filter((b) => !b.deadUntil).length})`;
  const e = state.effects;
  const fx = playing
    ? [e.slow && `${icon("moon")}slow`, e.fast && `${icon("zap")}fast`, e.shield && `${icon("shield")}shield`,
      e.hidden && `${icon("ghost")}invisible`, e.quant && `${icon("chart-candlestick")}×2`].filter(Boolean).join("  ")
    : "";
  if (fx !== renderHud.fx) {
    renderHud.fx = fx;
    $("effects").innerHTML = fx;
    drawIcons();
  }
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
  updateBots(dt);
  tagNewEntities();
  fadeTags();
  updateLogos();
  updateDanger();
  if (now - lastPosSend > POS_SEND_MS && state.phase !== "menu") {
    lastPosSend = now;
    const p = duck.position;
    net.sendPos({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), heading: +state.heading.toFixed(2), alive: state.phase === "play", score: state.score });
  }
  if ((state.phase === "dead" || state.phase === "won") && currentRound() !== state.round) {
    state.phase = "menu";
    $("banner").classList.remove("spectate");
    showMenu();
  }
  const cd = $("countdown");
  if (cd) cd.textContent = `${Math.ceil((ROUND_MS - (Date.now() % ROUND_MS)) / 1000)}s`;
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

