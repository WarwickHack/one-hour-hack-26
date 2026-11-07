import * as THREE from "three";

const DUCK_CAP = 80;
const GOOSE_CAP = 30;
const BUG_CAP = 40;
const RUBBER_CAP = 1;
const FOOD_CAP = 20;
const DUCK_SCALE = 1.3;
const GOOSE_SCALE = DUCK_SCALE * 1.5;
const BUG_SCALE = 1.5;
const RUBBER_SCALE = 1.8;
const FOOD_SCALE = 1.4;

const G = {
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  tri: new THREE.CylinderGeometry(0.5, 0.5, 1, 3),
  ring: new THREE.RingGeometry(0.85, 1, 48),
  puff: new THREE.SphereGeometry(0.25, 8, 6),
  plane: new THREE.PlaneGeometry(0.4, 0.25),
  meteor: new THREE.IcosahedronGeometry(1.4, 1),
};

const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra });

const M = {
  duckBody: std(0x8b5a2b),
  duckHead: std(0x1f7a3a),
  beak: std(0xff8c1a),
  eye: std(0x111111),
  gooseBody: std(0x9c9c9c),
  black: std(0x1c1c1c),
  white: std(0xffffff),
  bug: std(0xd62828),
  gold: std(0xffd700, { emissive: 0x996600, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }),
  rubber: std(0xffdd00, { roughness: 0.35 }),
  pizza: std(0xf4b142),
  pepperoni: std(0xb22222),
  cup: std(0xf5f5f5),
  coffee: std(0x4b2e1e),
  meteor: std(0x5a3a2a, { emissive: 0xff5500, emissiveIntensity: 1.2 }),
};

const CONFETTI_COLORS = [0xff3b6b, 0xffd23f, 0x3bceac, 0x4d96ff, 0xb15eff, 0xff8c1a, 0xffffff];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const angleDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function part(parent, geo, mat, s, p, r = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(s[0], s[1], s[2]);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

function buildDuckShape(inner, bodyMat, headMat) {
  part(inner, G.sphere, bodyMat, [1.3, 0.7, 0.85], [0, 0.3, 0]);
  part(inner, G.cone, bodyMat, [0.3, 0.45, 0.3], [-0.7, 0.45, 0], [0, 0, Math.PI / 2 - 0.5]);
  part(inner, G.sphere, headMat, [0.5, 0.5, 0.5], [0.5, 0.78, 0]);
  part(inner, G.cone, M.beak, [0.18, 0.34, 0.14], [0.85, 0.74, 0], [0, 0, -Math.PI / 2]);
  part(inner, G.sphere, M.eye, [0.08, 0.08, 0.08], [0.68, 0.86, 0.18], [0, 0, 0], false);
  part(inner, G.sphere, M.eye, [0.08, 0.08, 0.08], [0.68, 0.86, -0.18], [0, 0, 0], false);
}

function buildGooseShape(inner) {
  part(inner, G.sphere, M.gooseBody, [1.3, 0.75, 0.85], [0, 0.35, 0]);
  part(inner, G.cone, M.black, [0.3, 0.4, 0.3], [-0.7, 0.5, 0], [0, 0, Math.PI / 2 - 0.5]);
  part(inner, G.cyl, M.black, [0.16, 0.95, 0.16], [0.5, 0.98, 0], [0, 0, -0.25]);
  part(inner, G.sphere, M.black, [0.38, 0.3, 0.3], [0.66, 1.46, 0]);
  part(inner, G.sphere, M.white, [0.2, 0.15, 0.34], [0.63, 1.42, 0], [0, 0, 0], false);
  part(inner, G.cone, M.black, [0.12, 0.28, 0.12], [0.93, 1.42, 0], [0, 0, -Math.PI / 2]);
}

function buildBugShape(inner) {
  const body = part(inner, G.sphere, M.bug, [0.7, 0.42, 0.55], [0, 0.2, 0]);
  part(inner, G.sphere, M.black, [0.3, 0.26, 0.3], [0.38, 0.18, 0]);
  part(inner, G.cyl, M.black, [0.03, 0.3, 0.03], [0.5, 0.36, 0.08], [0, 0, -0.7], false);
  part(inner, G.cyl, M.black, [0.03, 0.3, 0.03], [0.5, 0.36, -0.08], [0, 0, -0.7], false);
  return body;
}

function buildFoodShape(inner, kind) {
  if (kind === "pizza") {
    part(inner, G.tri, M.pizza, [1.4, 0.12, 1.4], [0, 0.08, 0]);
    part(inner, G.cyl, M.pepperoni, [0.25, 0.14, 0.25], [0.15, 0.1, 0.2]);
    part(inner, G.cyl, M.pepperoni, [0.22, 0.14, 0.22], [-0.2, 0.1, -0.1]);
  } else {
    part(inner, G.cyl, M.cup, [0.6, 0.7, 0.6], [0, 0.35, 0]);
    part(inner, G.cyl, M.coffee, [0.52, 0.02, 0.52], [0, 0.71, 0], [0, 0, 0], false);
    part(inner, G.cyl, M.cup, [0.08, 0.35, 0.2], [0.33, 0.38, 0], [0, 0, 0], false);
  }
}

const labelCache = new Map();
function labelTexture(text, color) {
  const key = `${text}|${color}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "900 78px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, 256, 66);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, tex);
  return tex;
}

export class Pond {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.time = 0;
    this.waterY = world.lake?.waterY ?? 0.05;
    this.ducks = [];
    this.geese = [];
    this.bugs = [];
    this.rubbers = [];
    this.foods = [];
    this.effects = [];
    this.counters = { duck: 0, goose: 0, bug: 0, rubber: 0, food: 0 };
    this.totals = { eaten: 0, crashes: 0 };
    this._dummy = new THREE.Object3D();
    this.player = null;
    this.onPlayerHit = null;
    this.onPlayerPickup = null;
    for (let i = 0; i < 6; i++) this.spawnDuck();
    for (let i = 0; i < 2; i++) this.spawnGoose();
  }

  // ---------- geometry helpers ----------

  lakePoint() {
    const p = this.world.randomLakePoint();
    return new THREE.Vector3(p.x, this.waterY, p.z);
  }

  shorePoint() {
    const p = this.world.randomShorePoint();
    return new THREE.Vector3(p.x, p.y ?? 0, p.z);
  }

  ellipseNorm(x, z) {
    const { center, radiusX, radiusZ } = this.world.lake;
    const nx = (x - center.x) / radiusX;
    const nz = (z - center.z) / radiusZ;
    return { nx, nz, len: Math.hypot(nx, nz) };
  }

  projectToRing(x, z, f) {
    const { center, radiusX, radiusZ } = this.world.lake;
    const { nx, nz, len } = this.ellipseNorm(x, z);
    if (len < 1e-6) return new THREE.Vector3(center.x + f * radiusX, this.waterY, center.z);
    const k = f / len;
    return new THREE.Vector3(center.x + nx * k * radiusX, this.waterY, center.z + nz * k * radiusZ);
  }

  clampIn(x, z, f) {
    const { len } = this.ellipseNorm(x, z);
    if (len <= f) return new THREE.Vector3(x, this.waterY, z);
    return this.projectToRing(x, z, f);
  }

  // ---------- spawning ----------

  makeEntity(kind, group, inner, pos, baseScale) {
    this.counters[kind] += 1;
    const label = kind[0].toUpperCase() + kind.slice(1);
    const heading = Math.random() * Math.PI * 2;
    const e = {
      kind,
      name: `${label} #${this.counters[kind]}`,
      num: this.counters[kind],
      group,
      inner,
      pos: pos.clone(),
      heading,
      target: null,
      retargetAt: 0,
      spawnT: this.time,
      baseScale,
      grow: 1,
      meals: 0,
      phase: Math.random() * 10,
      sleepUntil: 0,
      bobUntil: 0,
      removed: false,
    };
    group.position.copy(pos);
    group.rotation.y = -heading;
    group.scale.setScalar(0.001);
    this.scene.add(group);
    return e;
  }

  spawnDuck(pos = this.lakePoint()) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    buildDuckShape(inner, M.duckBody, M.duckHead);
    const e = this.makeEntity("duck", group, inner, pos, DUCK_SCALE);
    this.ducks.push(e);
    return e;
  }

  spawnGoose(pos = this.lakePoint()) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    buildGooseShape(inner);
    const e = this.makeEntity("goose", group, inner, pos, GOOSE_SCALE);
    this.geese.push(e);
    return e;
  }

  spawnBug(pos = this.shorePoint()) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    const body = buildBugShape(inner);
    const e = this.makeEntity("bug", group, inner, pos, BUG_SCALE);
    e.body = body;
    e.feature = false;
    this.bugs.push(e);
    return e;
  }

  spawnRubber(pos = this.clampIn(...this.xz(this.lakePoint()), 0.6)) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    buildDuckShape(inner, M.rubber, M.rubber);
    const e = this.makeEntity("rubber", group, inner, pos, RUBBER_SCALE);
    e.name = `Rubber Duck #${e.num}`;
    this.rubbers.push(e);
    return e;
  }

  spawnFood(kind) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    buildFoodShape(inner, kind);
    const e = this.makeEntity("food", group, inner, this.lakePoint(), FOOD_SCALE);
    e.food = kind;
    this.foods.push(e);
    return e;
  }

  xz(v) {
    return [v.x, v.z];
  }

  listFor(kind) {
    return { duck: this.ducks, goose: this.geese, bug: this.bugs, rubber: this.rubbers, food: this.foods }[kind];
  }

  removeEntity(e, puffColor = 0xffffff, puffCount = 7) {
    if (e.removed) return;
    e.removed = true;
    this.scene.remove(e.group);
    const list = this.listFor(e.kind);
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
    if (puffColor !== null) {
      const at = e.group.position.clone();
      at.y += 0.6;
      this.puff(at, puffColor, puffCount, e.baseScale * 0.5);
    }
  }

  playerVisible() {
    return !!(this.player && this.player.position && !this.player.hidden);
  }

  xzDist(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  busy(e) {
    return e.removed || e.tower || e.fight || e.flying || e.glitchUntil || e.doomed || e.prey || e.hunter;
  }

  // ---------- effects ----------

  addEffect(update) {
    this.effects.push(update);
  }

  floatText(text, pos, color = "#ffffff", size = 4, life = 1.6) {
    const mat = new THREE.SpriteMaterial({
      map: labelTexture(text, color),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(Math.min(size, 3), Math.min(size, 3) / 4, 1);
    sprite.position.copy(pos);
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    let age = 0;
    this.addEffect((dt) => {
      age += dt;
      sprite.position.y += dt * 2.2;
      mat.opacity = 1 - clamp01((age - life * 0.5) / (life * 0.5));
      if (age < life) return true;
      this.scene.remove(sprite);
      mat.dispose();
      return false;
    });
  }

  textOver(e, text, color, size = 4, life = 1.6) {
    const p = e.group.position.clone();
    p.y += 1.6 * e.baseScale * 0.8 + 0.5;
    this.floatText(text, p, color, size, life);
  }

  puff(pos, color, n = 7, size = 1, life = 0.7) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const parts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(G.puff, mat);
      m.position.copy(pos);
      const v = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.2), rand(-1, 1)).multiplyScalar(2.5 * size);
      parts.push({ m, v, s: rand(0.6, 1.2) * size });
      this.scene.add(m);
    }
    let age = 0;
    this.addEffect((dt) => {
      age += dt;
      const k = age / life;
      for (const p of parts) {
        p.m.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(0.92);
        p.m.scale.setScalar(p.s * (1 + k * 1.5));
      }
      mat.opacity = 1 - clamp01(k);
      if (age < life) return true;
      for (const p of parts) this.scene.remove(p.m);
      mat.dispose();
      return false;
    });
  }

  ring(pos, color = 0xffffff, maxScale = 14, life = 1.4) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(G.ring, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, this.waterY + 0.06, pos.z);
    this.scene.add(m);
    let age = 0;
    this.addEffect((dt) => {
      age += dt;
      const k = clamp01(age / life);
      m.scale.setScalar(1 + k * maxScale);
      mat.opacity = 1 - k;
      if (age < life) return true;
      this.scene.remove(m);
      mat.dispose();
      return false;
    });
  }

  confetti(center) {
    const n = 140;
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
    const mesh = new THREE.InstancedMesh(G.plane, mat, n);
    const color = new THREE.Color();
    const bits = [];
    for (let i = 0; i < n; i++) {
      color.setHex(pick(CONFETTI_COLORS));
      mesh.setColorAt(i, color);
      bits.push({
        p: new THREE.Vector3(center.x + rand(-3, 3), rand(14, 22), center.z + rand(-3, 3)),
        v: new THREE.Vector3(rand(-7, 7), rand(2, 9), rand(-7, 7)),
        r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
        s: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      });
    }
    mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    const d = this._dummy;
    let age = 0;
    const life = 4;
    this.addEffect((dt) => {
      age += dt;
      for (let i = 0; i < n; i++) {
        const b = bits[i];
        b.v.y -= 9 * dt;
        b.v.multiplyScalar(0.97);
        if (b.v.y < -3) b.v.y = -3;
        b.p.addScaledVector(b.v, dt);
        if (b.p.y < this.waterY + 0.05) b.p.y = this.waterY + 0.05;
        b.r.x += b.s.x * dt;
        b.r.y += b.s.y * dt;
        b.r.z += b.s.z * dt;
        d.position.copy(b.p);
        d.rotation.copy(b.r);
        d.scale.setScalar(2);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mat.opacity = 1 - clamp01((age - life + 1) / 1);
      if (age < life) return true;
      this.scene.remove(mesh);
      mesh.dispose();
      mat.dispose();
      return false;
    });
  }

  firework(delay) {
    const from = this.world.piazza ? this.world.piazza.clone() : new THREE.Vector3(0, 0, -40);
    const peak = rand(20, 30);
    const hue = Math.random();
    const shellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 1, 0.7) });
    const shell = new THREE.Mesh(G.puff, shellMat);
    shell.position.copy(from);
    shell.visible = false;
    this.scene.add(shell);
    let age = -delay;
    let burst = null;
    this.addEffect((dt) => {
      age += dt;
      if (age < 0) return true;
      if (!burst) {
        shell.visible = true;
        const k = clamp01(age / 1.1);
        shell.position.set(from.x + Math.sin(age * 9) * 0.3, from.y + peak * (1 - (1 - k) * (1 - k)), from.z);
        if (Math.random() < 0.6) this.puff(shell.position, 0xffcc66, 1, 0.4, 0.4);
        if (k < 1) return true;
        this.scene.remove(shell);
        shellMat.dispose();
        burst = this.makeBurst(shell.position.clone(), hue);
        this.world.highlight?.("hack");
        return true;
      }
      return burst(dt);
    });
  }

  makeBurst(at, hue) {
    const n = 130;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const vel = [];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      positions.set([at.x, at.y, at.z], i * 3);
      c.setHSL((hue + rand(-0.08, 0.08) + 1) % 1, 1, rand(0.55, 0.8));
      colors.set([c.r, c.g, c.b], i * 3);
      const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(8, 13));
      vel.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    let age = 0;
    const life = 1.9;
    return (dt) => {
      age += dt;
      for (let i = 0; i < n; i++) {
        const v = vel[i];
        v.y -= 6 * dt;
        v.multiplyScalar(0.965);
        positions[i * 3] += v.x * dt;
        positions[i * 3 + 1] += v.y * dt;
        positions[i * 3 + 2] += v.z * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - clamp01(age / life);
      if (age < life) return true;
      this.scene.remove(pts);
      geo.dispose();
      mat.dispose();
      return false;
    };
  }

  meteor(target, delay, victims) {
    const start = new THREE.Vector3(target.x + 30, 75, target.z - 35);
    const mesh = new THREE.Mesh(G.meteor, M.meteor);
    mesh.castShadow = true;
    mesh.visible = false;
    this.scene.add(mesh);
    const flight = 1.3;
    let age = -delay;
    this.addEffect((dt) => {
      age += dt;
      if (age < 0) return true;
      mesh.visible = true;
      const k = clamp01(age / flight);
      mesh.position.lerpVectors(start, target, k * k);
      mesh.rotation.x += dt * 5;
      mesh.rotation.z += dt * 3;
      this.puff(mesh.position, Math.random() < 0.5 ? 0xff7a00 : 0x555555, 2, 0.9, 0.6);
      if (k < 1) return true;
      this.scene.remove(mesh);
      this.world.flash?.(0xff8800);
      this.ring(target, 0xffffff, 16, 1.6);
      this.ring(target, 0xff8800, 9, 1.1);
      this.puff(new THREE.Vector3(target.x, this.waterY + 0.5, target.z), 0xffffff, 18, 3, 1.1);
      this.floatText("500", new THREE.Vector3(target.x, 5, target.z), "#ff5533", 8, 2.2);
      for (const v of victims) if (!v.removed) this.removeEntity(v, 0xff9944, 6);
      if (this.player && this.player.position && this.xzDist(this.player.position, target) < 3) {
        this.onPlayerHit?.("prod", "PROD");
      }
      return false;
    });
  }

  // ---------- tick ----------

  applyWhack(words) {
    const counts = new Map();
    for (const raw of words || []) {
      const w = String(raw).toLowerCase().trim();
      if (!w) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    const c = (w) => counts.get(w) || 0;
    const lines = [];
    const log = (score, text) => lines.push({ score, text });
    const t = this.time;

    const nDuck = c("duck");
    if (nDuck) {
      const room = Math.max(0, DUCK_CAP - this.ducks.length);
      const made = Math.min(room, nDuck);
      for (let i = 0; i < made; i++) this.spawnDuck();
      const turned = nDuck - made;
      if (made === 0) log(40, `🦆 duck ×${nDuck} — lake full. ${turned} sent to Coventry`);
      else log(40, `🦆 +${plural(made, "duck", "ducks")} hatched${turned ? ` (${turned} sent to Coventry, lake full)` : ""}`);
    }

    const nGoose = c("goose");
    if (nGoose) {
      const made = Math.min(Math.max(0, GOOSE_CAP - this.geese.length), nGoose);
      for (let i = 0; i < made; i++) this.spawnGoose();
      if (made === 0) log(38, `🪿 goose ×${nGoose} — the geese have unionised. No more admitted`);
      else if (this.playerVisible()) log(38, `🪿 +${plural(made, "goose", "geese")} landed — ${made === 1 ? "it has" : "they have"} your scent`);
      else log(38, `🪿 +${plural(made, "goose", "geese")} landed. Hide your meal deal`);
    }

    const nBug = c("bug");
    if (nBug) {
      const made = Math.min(Math.max(0, BUG_CAP - this.bugs.length), nBug);
      for (let i = 0; i < made; i++) {
        const b = this.spawnBug();
        this.sendNearestDuckTo(b);
      }
      if (made === 0) log(30, `🐛 bug ×${nBug} — QA stopped counting`);
      else log(30, `🐛 +${plural(made, "bug", "bugs")} crawled out of main${this.player ? " — grab them" : ""}`);
    }

    const nFeature = c("feature");
    if (nFeature) {
      const candidates = shuffle(this.bugs.filter((b) => !b.feature && !b.removed));
      const turned = candidates.slice(0, nFeature);
      for (const b of turned) {
        b.feature = true;
        b.body.material = M.gold;
        this.textOver(b, "✨ FEATURE", "#ffd700", 4.5);
        this.puff(b.group.position.clone().setY(1), 0xffd700, 8, 0.8);
      }
      if (turned.length === 0) log(30, `✨ feature ×${nFeature} shipped with zero bugs. Suspicious`);
      else if (turned.length === 1) log(32, `🐛 ${turned[0].name} → ✨ feature (it was always intended)`);
      else log(32, `🐛 → ✨ ×${turned.length} bugs rebranded as features`);
    }

    const nRubber = c("rubber");
    if (nRubber) {
      const made = Math.min(Math.max(0, RUBBER_CAP - this.rubbers.length), nRubber);
      for (let i = 0; i < made; i++) {
        const r = this.spawnRubber();
        this.ring(r.pos, 0xffee88, 6, 1);
      }
      if (made === 0) log(45, `🛁 rubber ×${nRubber} — ${RUBBER_CAP} giant rubber ducks is the legal limit`);
      else log(60, `🛁 ${made === 1 ? "a giant rubber duck has surfaced. It is" : `${made} giant rubber ducks have surfaced. They are`} here to debug`);
    }

    for (const kind of ["pizza", "coffee"]) {
      const n = c(kind);
      if (!n) continue;
      const made = Math.min(Math.max(0, FOOD_CAP - this.foods.length), n);
      let chaser = null;
      for (let i = 0; i < made; i++) {
        const f = this.spawnFood(kind);
        const ds = this.nearestDucks(f.pos, 3);
        for (const d of ds) d.foodTarget = f;
        if (!chaser && ds[0]) chaser = ds[0];
      }
      const emoji = kind === "pizza" ? "🍕" : "☕";
      const tail = chaser ? ` — ${chaser.name} is on it` : " — nobody's hungry";
      if (made === 0) log(18, `${emoji} ${kind} ×${n} — lake is already 40% food`);
      else if (kind === "pizza") log(22, `${emoji} +${made} pizza in the lake${tail}`);
      else log(22, `${emoji} +${made} coffee${tail}. Caffeinated ducks incoming`);
    }

    const nQuack = c("quack");
    if (nQuack) {
      for (const d of this.ducks) d.bobUntil = t + 1.5;
      for (const d of shuffle(this.ducks).slice(0, Math.min(nQuack, 8))) this.textOver(d, "QUACK!", "#ffe14d");
      if (this.ducks.length === 0) log(20, `🦆 quack ×${nQuack} — echoes across an empty lake`);
      else if (nQuack === 1) log(22, "🦆 quack.");
      else if (nQuack < 5) log(25, `🦆 QUACK ×${nQuack}`);
      else log(27, `🦆 QUACK ×${nQuack} — noise complaint filed with Campus Security`);
    }

    const nHonk = c("honk");
    if (nHonk) this.doHonk(nHonk, log);

    const nSleep = c("sleep");
    if (nSleep) {
      const dur = Math.min(3 + nSleep, 8);
      const all = [...this.ducks, ...this.geese, ...this.bugs, ...this.rubbers];
      for (const e of all) if (!e.doomed) e.sleepUntil = Math.max(e.sleepUntil, t + dur);
      for (const e of shuffle(all).slice(0, 10)) this.textOver(e, "zzz", "#bcd7ff", 3, 2.5);
      log(15, `💤 sleep ×${nSleep} — the whole lake dozed off for ${dur}s`);
    }

    const ship = ["deploy", "push", "commit"].filter((w) => c(w));
    if (ship.length) {
      const total = ship.reduce((s, w) => s + c(w), 0);
      const n = Math.min(total, 6);
      for (let i = 0; i < n; i++) this.firework(i * 0.35);
      const desc = ship.map((w) => (c(w) > 1 ? `${w} ×${c(w)}` : w)).join(" · ");
      log(35, `🚀 ${desc} — ${n === 1 ? "a firework" : `${n} fireworks`} over the Piazza`);
    }

    const nProd = c("prod");
    if (nProd) this.doProd(nProd, log);

    for (const w of ["segfault", "null", "pointer"]) {
      const n = c(w);
      if (n) this.doGlitch(w, n, log);
    }

    const nStack = c("stack") + c("overflow");
    if (nStack) this.doStack(nStack, log);

    const nMerge = Math.max(c("merge"), c("conflict"));
    if (nMerge) this.doMerge(nMerge, log);

    const party = ["demo", "pitch", "prize"].filter((w) => c(w));
    if (party.length) {
      const total = party.reduce((s, w) => s + c(w), 0);
      const n = Math.min(total, 4);
      for (let i = 0; i < n; i++) this.confetti(this.lakePoint());
      const desc = party.map((w) => (c(w) > 1 ? `${w} ×${c(w)}` : w)).join(" · ");
      log(50, `🎉 ${desc} — confetti over the lake`);
      if (c("prize") && this.ducks.length) {
        const champ = this.ducks.reduce((a, b) => (b.meals > a.meals ? b : a));
        this.textOver(champ, "🏆 WINNER", "#ffd700", 5, 2.5);
        const why = champ.meals ? ` (${plural(champ.meals, "snack", "snacks")} eaten)` : "";
        log(52, `🏆 prize: ${champ.name}${why} wins Best Use of whack()`);
      }
    }

    const handled = new Set([
      "duck", "goose", "bug", "feature", "rubber", "pizza", "coffee", "quack", "honk", "sleep",
      "deploy", "push", "commit", "prod", "segfault", "null", "pointer", "stack", "overflow",
      "merge", "conflict", "demo", "pitch", "prize",
    ]);
    for (const [w, n] of counts) {
      if (handled.has(w)) continue;
      this.world.highlight?.(w);
      const quip = this.quip(w, n);
      if (quip) log(5, quip);
    }

    lines.sort((a, b) => b.score - a.score);
    return lines.slice(0, 8).map((l) => l.text);
  }

  quip(w, n) {
    const x = n > 1 ? ` ×${n}` : "";
    const anyDuck = this.ducks.length ? pick(this.ducks).name : "a passing duck";
    const q = {
      semicolon: `;${x} a semicolon washed ashore`,
      wifi: `📶 wifi${x} — eduroam dropped. Ducks reconnecting…`,
      midnight: `🌙 midnight${x} — the geese get bolder after dark`,
      hack: `🔨 hack${x} — the Piazza buzzes`,
      whack: `🔨 whack${x} — whack() called whack(). Recursion achieved`,
      bloomberg: `💹 Bloomberg terminal: DUCK ${Math.random() < 0.5 ? "+" : "-"}${rand(1, 9).toFixed(1)}%`,
      netcraft: `🛡️ Netcraft took down a phishing goose`,
      incident: `🚨 incident.io paged the on-call duck`,
      capital: `💳 Capital One approved ${anyDuck} for a bread loan`,
      marshall: `📈 Marshall Wace went long on ducks`,
      brevan: `🏦 Brevan Howard is hedging against geese`,
      oculus: `🔮 the Oculus is watching`,
      warwick: `🎭 Warwick Arts Centre gives the lake a standing ovation`,
      compsoc: `💻 CompSoc is writing a duck tracker in Rust`,
    };
    return q[w] || null;
  }

  nearestDucks(pos, k) {
    return this.ducks
      .filter((d) => !this.busy(d))
      .map((d) => ({ d, dist: d.pos.distanceToSquared(pos) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k)
      .map((o) => o.d);
  }

  sendNearestDuckTo(bug) {
    const [d] = this.nearestDucks(bug.pos, 1);
    if (d) d.bugTarget = bug;
  }

  doHonk(n, log) {
    const t = this.time;
    if (this.playerVisible() && this.geese.length) {
      const chargers = shuffle(this.geese.filter((g) => !this.busy(g))).slice(0, n);
      for (const g of chargers) {
        g.chargeUntil = t + 4;
        g.sleepUntil = 0;
        this.textOver(g, "HONK!", "#ff6b6b", 4.5);
      }
      const honk = n > 1 ? `HONK ×${n}` : "HONK";
      if (!chargers.length) log(60, `🪿 ${honk} — the geese are busy. You live, for now`);
      else if (chargers.length === 1) log(80, `🪿 ${honk} — ${chargers[0].name} is charging at you. RUN`);
      else log(80, `🪿 ${honk} — ${chargers.length} geese have your scent. RUN`);
      return;
    }
    const hunters = shuffle(this.geese.filter((g) => !this.busy(g))).slice(0, n);
    for (const g of shuffle(this.geese).slice(0, Math.min(n, 6))) this.textOver(g, "HONK!", "#ff6b6b", 4.5);
    if (!this.geese.length) {
      log(20, `🪿 HONK ×${n} — but there are no geese. Ducks unbothered`);
      return;
    }
    const pairs = [];
    for (const g of hunters) {
      const prey = this.ducks
        .filter((d) => !this.busy(d))
        .sort((a, b) => a.pos.distanceToSquared(g.pos) - b.pos.distanceToSquared(g.pos))[0];
      if (!prey) break;
      g.prey = prey;
      g.chaseUntil = t + 5;
      g.sleepUntil = 0;
      prey.hunter = g;
      prey.sleepUntil = 0;
      pairs.push(`${g.name} → ${prey.name}`);
    }
    const honk = n > 1 ? `HONK ×${n}` : "HONK";
    if (!pairs.length) log(60, `🪿 ${honk} — no ducks left to chase. The geese won`);
    else if (pairs.length === 1) log(80, `🪿 ${honk} — ${pairs[0].replace(" → ", " is coming for ")}`);
    else log(80, `🪿 ${honk} — the hunt is on: ${pairs.slice(0, 3).join(", ")}${pairs.length > 3 ? "…" : ""}`);
  }

  doProd(n, log) {
    const t = this.time;
    const meteors = Math.min(n, 3);
    const tally = { duck: 0, goose: 0, rubber: 0 };
    for (let i = 0; i < meteors; i++) {
      let target = this.lakePoint();
      if (this.player && this.player.position) {
        const pp = this.player.position;
        const a = rand(0, Math.PI * 2);
        const r = rand(0, 6);
        target = this.clampIn(pp.x + Math.cos(a) * r, pp.z + Math.sin(a) * r, 0.92);
      }
      const victims = [];
      for (const e of [...this.ducks, ...this.geese, ...this.rubbers]) {
        if (e.doomed || e.removed || e.flying) continue;
        const dx = e.pos.x - target.x;
        const dz = e.pos.z - target.z;
        if (dx * dx + dz * dz < 49) {
          e.doomed = true;
          e.sleepUntil = Infinity;
          if (e.prey) e.prey.hunter = null;
          if (e.hunter) e.hunter.prey = null;
          victims.push(e);
          tally[e.kind] += 1;
        }
      }
      this.meteor(target, i * 0.6, victims);
    }
    this.totals.crashes += n;
    const parts = [];
    if (tally.duck) parts.push(plural(tally.duck, "duck", "ducks"));
    if (tally.goose) parts.push(plural(tally.goose, "goose", "geese"));
    if (tally.rubber) parts.push(plural(tally.rubber, "rubber duck", "rubber ducks"));
    const head = `☄️ PROD went down${n > 1 ? ` ×${n}` : ""}.`;
    const aimed = this.player && this.player.position ? " Incoming — it's aimed at you." : "";
    if (parts.length) log(100, `${head}${aimed} ${parts.join(", ")} lost in the blast`);
    else log(95, `${head}${aimed || " Miraculously, no ducks were harmed"}`);
    void t;
  }

  doGlitch(word, n, log) {
    const t = this.time;
    const pool = shuffle([...this.ducks, ...this.geese, ...this.bugs].filter((e) => !this.busy(e)));
    const victims = pool.slice(0, Math.min(n, 6));
    const label = { segfault: "SIGSEGV", null: "NULL", pointer: "0x0" }[word];
    for (const e of victims) {
      e.glitchUntil = t + 1.4;
      e.sleepUntil = 0;
      this.textOver(e, label, "#d06bff", 4, 1.4);
    }
    if (word === "segfault") {
      this.world.flash?.(0xb000ff);
      this.totals.crashes += n;
    }
    const x = n > 1 ? ` ×${n}` : "";
    const who = victims.length <= 2
      ? victims.map((e) => e.name).join(" and ")
      : `${victims[0].name} and ${victims.length - 1} others`;
    const many = victims.length > 1;
    if (!victims.length) {
      log(50, `💥 ${word}${x} (core dumped) — nothing left to crash`);
      return;
    }
    const text = {
      segfault: `💥 segfault${x}: ${who} ${many ? "have" : "has"} been dereferenced`,
      null: `∅ null${x}: ${who} ${many ? "are" : "is"} now undefined`,
      pointer: `👉 pointer${x}: ${who} pointed at 0x0 and vanished`,
    }[word];
    log(word === "segfault" ? 90 : 55, text);
  }

  doStack(n, log) {
    const t = this.time;
    const free = shuffle(this.ducks.filter((d) => !this.busy(d)));
    const height = Math.min(free.length, 3 + 2 * n, 12);
    if (height < 2) {
      log(30, `🥞 stack overflow — not enough ducks to stack. Recursion denied`);
      return;
    }
    const base = this.clampIn(...this.xz(this.lakePoint()), 0.55);
    for (let i = 0; i < height; i++) {
      const d = free[i];
      d.tower = { base, i, t0: t, from: d.pos.clone(), dir: rand(0, Math.PI * 2) };
      d.sleepUntil = 0;
      d.foodTarget = null;
      d.bugTarget = null;
    }
    this.addEffect(this.delay(1.0, () => this.floatText("STACK OVERFLOW", new THREE.Vector3(base.x, height * 1.05 + 3, base.z), "#7df9ff", 9, 2.2)));
    log(65, `🥞 stack overflow: ${height} ducks stacked to height ${height}… then it toppled`);
  }

  doMerge(n, log) {
    const t = this.time;
    const free = shuffle(this.geese.filter((g) => !this.busy(g)));
    const fights = Math.min(Math.floor(free.length / 2), n, 3);
    if (!fights) {
      log(30, `⚔️ merge conflict — not enough geese to fight. Auto-merged`);
      return;
    }
    const summaries = [];
    for (let i = 0; i < fights; i++) {
      const a = free[i * 2];
      const b = free[i * 2 + 1];
      const center = this.clampIn((a.pos.x + b.pos.x) / 2, (a.pos.z + b.pos.z) / 2, 0.75);
      const loserIsB = Math.random() < 0.5;
      a.fight = { center, t0: t, offset: 0, loser: !loserIsB, from: a.pos.clone() };
      b.fight = { center, t0: t, offset: Math.PI, loser: loserIsB, from: b.pos.clone() };
      a.sleepUntil = 0;
      b.sleepUntil = 0;
      const loser = loserIsB ? b : a;
      const winner = loserIsB ? a : b;
      summaries.push(`${winner.name} vs ${loser.name} — #${loser.num} force-pushed itself off the lake`);
    }
    log(70, `⚔️ merge conflict: ${summaries[0]}${fights > 1 ? ` (+${fights - 1} more brawls)` : ""}`);
  }

  delay(seconds, fn) {
    let age = 0;
    return (dt) => {
      age += dt;
      if (age < seconds) return true;
      fn();
      return false;
    };
  }

  // ---------- simulation ----------

  steer(e, tx, tz, speed, dt, mode, turnRate = 3) {
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return dist;
    const desired = Math.atan2(dz, dx);
    const diff = angleDiff(e.heading, desired);
    e.heading += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
    const cx = Math.cos(e.heading);
    const cz = Math.sin(e.heading);
    const step = Math.min(speed * dt, dist);
    const nx = e.pos.x + cx * step;
    const nz = e.pos.z + cz * step;
    const look = e.baseScale * e.grow * 0.6;
    let ok;
    if (mode === "lake") ok = this.world.isInLake(nx + cx * look, nz + cz * look);
    else if (mode === "shore") ok = !this.world.isInLake(nx, nz) && this.ellipseNorm(nx, nz).len < 1.8;
    else ok = true;
    if (ok) {
      e.pos.x = nx;
      e.pos.z = nz;
    } else {
      e.retargetAt = 0;
      e.heading += turnRate * dt * 2;
    }
    return dist;
  }

  wander(e, speed, dt) {
    const t = this.time;
    if (!e.target || t > e.retargetAt) {
      e.target = e.kind === "bug" ? this.projectToRing(e.pos.x + rand(-6, 6), e.pos.z + rand(-6, 6), rand(1.05, 1.25)) : this.lakePoint();
      e.retargetAt = t + rand(4, 9);
    }
    const d = this.steer(e, e.target.x, e.target.z, speed, dt, e.kind === "bug" ? "shore" : "lake", e.kind === "bug" ? 4 : 1.6);
    if (d < 1.2) e.retargetAt = 0;
  }

  updateDuck(e, dt) {
    const t = this.time;
    if (e.hunter && !e.hunter.removed && e.hunter.prey === e) {
      const away = new THREE.Vector3().subVectors(e.pos, e.hunter.pos).setY(0).normalize().multiplyScalar(6);
      const dest = this.clampIn(e.pos.x + away.x, e.pos.z + away.z, 0.85);
      this.steer(e, dest.x, dest.z, 3.2, dt, "lake", 5);
      return;
    }
    e.hunter = null;
    const fast = t < (e.caffeinatedUntil || 0) ? 2.6 : 1;
    if (e.foodTarget && !e.foodTarget.removed) {
      this.steer(e, e.foodTarget.pos.x, e.foodTarget.pos.z, 4.5 * fast, dt, "lake", 4);
      return;
    }
    e.foodTarget = null;
    if (e.bugTarget && !e.bugTarget.removed && !e.bugTarget.feature) {
      const dest = this.projectToRing(e.bugTarget.pos.x, e.bugTarget.pos.z, 0.9);
      const d = this.steer(e, dest.x, dest.z, 3 * fast, dt, "lake", 3);
      if (d < 0.8) e.bugTarget = null;
      return;
    }
    e.bugTarget = null;
    this.wander(e, 1.6 * fast, dt);
  }

  updateGoose(e, dt) {
    const t = this.time;
    if (e.prey) {
      const prey = e.prey;
      if (prey.removed) {
        e.prey = null;
        return;
      }
      const d = this.steer(e, prey.pos.x, prey.pos.z, 8.5, dt, null, 6);
      if (d < 1.6 || t > e.chaseUntil) {
        e.prey = null;
        prey.hunter = null;
        this.textOver(e, "CHOMP", "#ff4d4d", 4);
        this.removeEntity(prey, 0xffffff, 12);
        this.totals.eaten += 1;
        e.meals += 1;
      }
      return;
    }
    if (this.playerVisible()) {
      if (this.chasePlayer(e, dt)) return;
    }
    this.wander(e, 1.3, dt);
  }

  chasePlayer(e, dt) {
    const t = this.time;
    if (t < (e.bonkUntil || 0)) return false;
    const pp = this.player.position;
    const charging = t < (e.chargeUntil || 0);
    const d = this.steer(e, pp.x, pp.z, charging ? 8 : 3.4, dt, "lake", charging ? 6 : 2.5);
    if (d < 1.2) {
      if (this.player.shield) {
        const away = new THREE.Vector3(e.pos.x - pp.x, 0, e.pos.z - pp.z);
        if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
        away.normalize().multiplyScalar(5);
        const dest = this.clampIn(e.pos.x + away.x, e.pos.z + away.z, 0.9);
        e.pos.x = dest.x;
        e.pos.z = dest.z;
        e.bonkUntil = t + 1.2;
        e.chargeUntil = 0;
        this.textOver(e, "BONK", "#7df9ff", 4.5);
        this.puff(e.group.position.clone().setY(1.2), 0xdddddd, 6, 0.8);
      } else if (t - (e.lastHitAt ?? -Infinity) >= 1) {
        e.lastHitAt = t;
        this.onPlayerHit?.("goose", e.name);
      }
    }
    return true;
  }

  checkPlayerPickups() {
    if (!this.player || !this.player.position) return;
    const pp = this.player.position;
    for (const b of this.bugs.slice()) {
      if (b.removed || this.xzDist(b.pos, pp) >= 1.2) continue;
      const kind = b.feature ? "feature" : "bug";
      this.removeEntity(b, b.feature ? 0xffd700 : 0xff5555, 6);
      this.onPlayerPickup?.(kind);
    }
    for (const f of this.foods.slice()) {
      if (f.removed || this.xzDist(f.pos, pp) >= 1.2) continue;
      this.removeEntity(f, 0xffe0a0, 6);
      this.onPlayerPickup?.(f.food);
    }
  }

  updateRubber(e, dt) {
    const target = this.bugs.find((b) => !b.feature && !b.removed);
    if (target) {
      const dest = this.projectToRing(target.pos.x, target.pos.z, 0.8);
      this.steer(e, dest.x, dest.z, 2.4, dt, "lake", 1.2);
    } else {
      this.wander(e, 1.0, dt);
    }
    for (const b of this.bugs.slice()) {
      if (b.feature || b.removed) continue;
      if (b.pos.distanceTo(e.pos) < 7) {
        this.textOver(b, "DEBUGGED", "#ffe14d", 4.5);
        this.removeEntity(b, 0xffee55, 8);
        this.totals.eaten += 1;
      }
    }
  }

  updateBug(e, dt) {
    if (e.feature) {
      e.inner.rotation.y += dt * 2;
      return;
    }
    this.wander(e, 0.9, dt);
  }

  updateTower(e) {
    const tw = e.tower;
    const u = this.time - tw.t0;
    const h = 0.95 * DUCK_SCALE;
    const slotY = this.waterY + tw.i * h;
    if (u < 1) {
      const k = u * u * (3 - 2 * u);
      e.pos.x = tw.from.x + (tw.base.x - tw.from.x) * k;
      e.pos.z = tw.from.z + (tw.base.z - tw.from.z) * k;
      e.group.position.set(e.pos.x, this.waterY + (slotY - this.waterY) * k + Math.sin(k * Math.PI) * 1.5, e.pos.z);
    } else if (u < 3) {
      const sway = Math.sin(u * 5) * 0.05 * tw.i * (u - 1);
      e.group.position.set(tw.base.x + sway, slotY, tw.base.z);
      e.pos.set(tw.base.x, this.waterY, tw.base.z);
    } else if (u < 4.2) {
      if (!tw.land) {
        const r = 1.5 + tw.i * 1.2;
        tw.land = this.clampIn(tw.base.x + Math.cos(tw.dir) * r, tw.base.z + Math.sin(tw.dir) * r, 0.88);
      }
      const p = (u - 3) / 1.2;
      e.pos.x = tw.base.x + (tw.land.x - tw.base.x) * p;
      e.pos.z = tw.base.z + (tw.land.z - tw.base.z) * p;
      e.group.position.set(e.pos.x, slotY * (1 - p) + Math.sin(p * Math.PI) * 2.5 + this.waterY * p, e.pos.z);
      e.inner.rotation.z = p * Math.PI * 2;
    } else {
      e.tower = null;
      e.inner.rotation.z = 0;
      e.pos.y = this.waterY;
      this.ring(e.pos, 0xffffff, 3, 0.8);
      return;
    }
    e.group.rotation.y = -e.heading;
  }

  updateFight(e, dt) {
    const f = e.fight;
    const u = this.time - f.t0;
    if (u < 0.8) {
      const k = u / 0.8;
      const ox = Math.cos(f.offset) * 1.7;
      const oz = Math.sin(f.offset) * 1.7;
      e.pos.x = f.from.x + (f.center.x + ox - f.from.x) * k;
      e.pos.z = f.from.z + (f.center.z + oz - f.from.z) * k;
    } else if (u < 3.2) {
      const a = f.offset + (u - 0.8) * 7;
      e.pos.x = f.center.x + Math.cos(a) * 1.7;
      e.pos.z = f.center.z + Math.sin(a) * 1.7;
      e.heading = a + Math.PI / 2;
      e.inner.rotation.x = Math.sin(u * 20) * 0.3;
      if (Math.random() < dt * 6) this.puff(e.group.position.clone().setY(1.2), 0xdddddd, 2, 0.6, 0.5);
      if (Math.random() < dt * 1.5) this.textOver(e, "HONK", "#ff6b6b", 3, 0.9);
    } else {
      e.inner.rotation.x = 0;
      e.fight = null;
      if (f.loser) {
        const dir = rand(0, Math.PI * 2);
        e.heading = dir;
        e.flying = { vel: new THREE.Vector3(Math.cos(dir) * 9, 6, Math.sin(dir) * 9), t0: this.time };
        this.textOver(e, "git push -f", "#ff9f43", 5, 1.8);
      }
    }
    e.group.position.set(e.pos.x, this.waterY, e.pos.z);
    e.group.rotation.y = -e.heading;
  }

  updateFlying(e, dt) {
    const f = e.flying;
    e.group.position.addScaledVector(f.vel, dt);
    f.vel.y += dt * 2;
    e.pos.copy(e.group.position);
    e.inner.rotation.x = Math.sin(this.time * 25) * 0.4;
    e.inner.rotation.z = 0.3;
    e.group.rotation.y = -e.heading;
    if (e.group.position.y > 35 || this.time - f.t0 > 6) this.removeEntity(e, null);
  }

  updateEntity(e, dt) {
    const t = this.time;
    const pop = easeOutBack(clamp01((t - e.spawnT) / 0.45));
    e.group.scale.setScalar(Math.max(0.001, e.baseScale * e.grow * pop));

    if (e.glitchUntil) {
      e.group.visible = Math.random() > 0.45;
      e.group.position.set(e.pos.x + rand(-0.3, 0.3), e.group.position.y, e.pos.z + rand(-0.3, 0.3));
      e.inner.rotation.y = rand(-0.4, 0.4);
      if (t > e.glitchUntil) {
        if (e.hunter) e.hunter.prey = null;
        if (e.prey) e.prey.hunter = null;
        this.removeEntity(e, 0xb15eff, 9);
      }
      return;
    }
    if (e.tower) return this.updateTower(e);
    if (e.fight) return this.updateFight(e, dt);
    if (e.flying) return this.updateFlying(e, dt);

    const asleep = t < e.sleepUntil;
    if (!asleep) {
      if (e.kind === "duck") this.updateDuck(e, dt);
      else if (e.kind === "goose") this.updateGoose(e, dt);
      else if (e.kind === "rubber") this.updateRubber(e, dt);
      else if (e.kind === "bug") this.updateBug(e, dt);
    }
    if (e.removed) return;

    const baseY = e.kind === "bug" ? (e.pos.y || 0) : this.waterY;
    const quacking = t < e.bobUntil;
    const amp = e.kind === "bug" ? 0.02 : quacking ? 0.35 : asleep ? 0.03 : 0.07;
    const freq = quacking ? 14 : e.kind === "bug" ? 18 : 2.2;
    e.group.position.set(e.pos.x, baseY, e.pos.z);
    e.inner.position.y = Math.abs(Math.sin(t * freq + e.phase)) * amp;
    if (e.kind !== "bug") e.inner.rotation.z = Math.sin(t * 1.7 + e.phase) * 0.05;
    e.group.rotation.y = -e.heading;
  }

  updateFood(f, dt) {
    const t = this.time;
    const pop = easeOutBack(clamp01((t - f.spawnT) / 0.45));
    f.group.scale.setScalar(Math.max(0.001, f.baseScale * pop));
    f.group.position.set(f.pos.x, this.waterY + Math.sin(t * 2 + f.phase) * 0.08, f.pos.z);
    f.inner.rotation.y += dt * 0.4;
    for (const d of this.ducks) {
      if (d.tower || d.glitchUntil || d.doomed) continue;
      if (d.pos.distanceToSquared(f.pos) < 2.2) {
        d.meals += 1;
        if (f.food === "pizza") {
          d.grow = Math.min(d.grow * 1.1, 1.8);
          this.textOver(d, "NOM", "#ffb347", 3);
        } else {
          d.caffeinatedUntil = t + 8;
          this.textOver(d, "ZOOM", "#a0522d", 3.5);
        }
        this.removeEntity(f, 0xffe0a0, 5);
        return;
      }
    }
  }

  checkBugEating() {
    for (const b of this.bugs.slice()) {
      if (b.feature || b.removed || b.glitchUntil) continue;
      for (const d of this.ducks) {
        if (d.tower || d.glitchUntil || d.doomed || t_asleep(d, this.time)) continue;
        const dx = d.pos.x - b.pos.x;
        const dz = d.pos.z - b.pos.z;
        if (dx * dx + dz * dz < 10) {
          d.meals += 1;
          this.textOver(d, "CRUNCH", "#9cff57", 3.5);
          this.removeEntity(b, 0xff5555, 5);
          this.totals.eaten += 1;
          break;
        }
      }
    }
  }

  update(dt, time) {
    this.time = time;
    dt = Math.min(dt, 0.05);
    for (const list of [this.ducks, this.geese, this.bugs, this.rubbers]) {
      for (const e of list.slice()) this.updateEntity(e, dt);
    }
    for (const f of this.foods.slice()) this.updateFood(f, dt);
    this.checkBugEating();
    this.checkPlayerPickups();
    let w = 0;
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i];
      if (fx(dt)) this.effects[w++] = fx;
    }
    this.effects.length = w;
  }

  stats() {
    const features = this.bugs.filter((b) => b.feature).length;
    return {
      ducks: this.ducks.length,
      geese: this.geese.length,
      bugs: this.bugs.length - features,
      features,
      eaten: this.totals.eaten,
      crashes: this.totals.crashes,
    };
  }
}

function t_asleep(e, time) {
  return time < e.sleepUntil;
}
