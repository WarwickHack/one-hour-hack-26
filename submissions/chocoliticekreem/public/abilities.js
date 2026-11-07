import * as THREE from "three";

const rings = [];
const n = (count) => Math.max(1, Math.min(count || 1, 2));
const extend = (ctx, key, secs) => { ctx.effects[key] = Math.max(ctx.effects[key] || 0, secs); };

function ring(ctx, color, maxScale = 1.5, life = 0.6, y = 0.2) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(ctx.duck.position);
  mesh.position.y += y;
  ctx.scene.add(mesh);
  rings.push({ mesh, t: 0, life, maxScale });
}

export function updateAbilities(ctx, dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const k = r.t / r.life;
    r.mesh.scale.setScalar(1 + k * r.maxScale);
    r.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) {
      ctx.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
      rings.splice(i, 1);
    }
  }
}

const quant = (ctx) => {
  ctx.rain("0123456789", "#7CFC00", 8);
  extend(ctx, "quant", 5);
  ctx.spawnFloatingText("QUANT MODE ×2");
  return "📈 QUANT MODE: Marshall Wace's long/short desk doubles your points for 5s";
};

const macro = (ctx) => {
  const bet = 10 + Math.floor(Math.random() * 21);
  ring(ctx, 0xffd700);
  ctx.addScore(bet);
  return `🌍 GLOBAL MACRO: Brevan Howard called rates right, +${bet}`;
};

const cashback = (ctx) => {
  const back = Math.min(50, 10 + Math.floor((ctx.state.score || 0) * 0.01));
  ctx.rain("£", "#D03027", 6);
  ctx.addScore(back);
  return `💳 CASHBACK: Capital One asks what's in your wallet: +${back}`;
};

const onCall = (ctx) => {
  ctx.flash("#ff3b30");
  ring(ctx, 0xff3b30);
  extend(ctx, "invuln", 3);
  ctx.spawnFloatingText("ON-CALL");
  return "🚨 ON-CALL: incident.io paged the duck. Invulnerable for 3s while it triages";
};

export const ABILITIES = {
  whack: (ctx, count) => {
    ring(ctx, 0xff8800, 3, 0.6);
    ctx.addScore(10 * n(count));
    return `🔨 WHACK ATTACK: CompSoc runs whack(), shockwave +${10 * n(count)}`;
  },
  hack: (ctx) => {
    ctx.rain("01", "#00ff66", 8);
    extend(ctx, "fast", 4);
    return "💻 HACKERMODE: binary rain, speed boost for 4s";
  },
  quack: (ctx) => {
    ring(ctx, 0xffd800);
    ctx.heal(1);
    return "🦆 QUACK BACK: a mighty quack restores 1 HP";
  },
  warwick: (ctx, count) => {
    ctx.rain("🦆", "#ffffff", 6);
    ctx.addScore(5 * n(count));
    return `🏫 DUCK DENSITY: Warwick's famous 2.3 ducks per rood, +${5 * n(count)}`;
  },
  oculus: (ctx) => {
    ring(ctx, 0x66ccff, 1.5, 1.2, 2.5);
    extend(ctx, "hidden", 5);
    ctx.world.highlight?.("oculus");
    return "👁️ LECTURE THEATRE: you blend into the Oculus crowd, hidden for 5s";
  },
  compsoc: (ctx) => {
    ring(ctx, 0xff9900);
    ctx.heal(1);
    return "🍕 COMPSOC FREE PIZZA: +1 HP, the real reason anyone came";
  },
  marshall: quant,
  wace: quant,
  brevan: macro,
  howard: macro,
  capital: cashback,
  one: cashback,
  bloomberg: (ctx) => {
    ctx.flash("#ffb000");
    ctx.addScore(15);
    return "📟 TERMINAL: Bloomberg amber ticker says DUCK is up 4.20%, +15";
  },
  netcraft: (ctx) => {
    ring(ctx, 0x3399ff);
    extend(ctx, "shield", 4);
    return "🛡️ PHISHING TAKEDOWN: Netcraft blocks the next hits, shield for 4s";
  },
  incident: onCall,
  io: onCall,
  semicolon: (ctx) => {
    ring(ctx, 0xcccccc);
    extend(ctx, "invuln", 1);
    return "⌨️ SEMICOLON: statement terminated; so is the next hit (1s invuln)";
  },
  wifi: (ctx) => {
    ring(ctx, 0x999999);
    extend(ctx, "slow", 2);
    return "📶 EDUROAM DROPPED: 2s of lag, reconnecting...";
  },
  demo: (ctx) => {
    ring(ctx, 0xbb86fc);
    extend(ctx, "invuln", 3);
    return "🎬 DEMO GODS: nothing can crash during the demo, invulnerable 3s";
  },
  pitch: (ctx, count) => {
    ring(ctx, 0x00c853);
    ctx.addScore(20 * n(count));
    return `🎤 ELEVATOR PITCH: judges loved it, raised +${20 * n(count)}`;
  },
  commit: (ctx) => {
    ring(ctx, 0xf05032);
    extend(ctx, "shield", 3);
    return "📝 COMMIT: progress saved, shield for 3s";
  },
  push: (ctx) => {
    ring(ctx, 0xf05032);
    extend(ctx, "fast", 3);
    return "🚀 FORCE PUSH: no review, no regrets, speed boost 3s";
  },
};

export const ABILITY_DOCS = [
  { word: "whack", name: "WHACK ATTACK", effect: "Orange shockwave ring, +10 (+20 if mentioned twice or more)" },
  { word: "hack", name: "HACKERMODE", effect: "Short binary rain, speed boost 4s" },
  { word: "quack", name: "QUACK BACK", effect: "Yellow pulse, heal 1 HP" },
  { word: "warwick", name: "DUCK DENSITY", effect: "Duck rain (Warwick: 2.3 ducks per rood), +5 (+10 on repeat)" },
  { word: "oculus", name: "LECTURE THEATRE", effect: "Blue halo over the duck, hidden 5s" },
  { word: "compsoc", name: "FREE PIZZA", effect: "Orange pulse, heal 1 HP" },
  { word: "marshall / wace", name: "QUANT MODE", effect: "Number rain, points x2 for 5s" },
  { word: "brevan / howard", name: "GLOBAL MACRO", effect: "Gold pulse, random +10..+30 macro payout" },
  { word: "capital / one", name: "CASHBACK", effect: "£ rain, +10 plus 1% of score (max +50)" },
  { word: "bloomberg", name: "TERMINAL", effect: "Amber flash, DUCK ticker up 4.20%, +15" },
  { word: "netcraft", name: "PHISHING TAKEDOWN", effect: "Blue pulse, shield 4s" },
  { word: "incident / io", name: "ON-CALL", effect: "Red alert flash, invulnerable 3s" },
  { word: "semicolon", name: "SEMICOLON", effect: "Grey pulse, invulnerable 1s" },
  { word: "wifi", name: "EDUROAM DROPPED", effect: "2s of lag (slow)" },
  { word: "demo", name: "DEMO GODS", effect: "Purple pulse, invulnerable 3s" },
  { word: "pitch", name: "ELEVATOR PITCH", effect: "Green pulse, +20 (+40 on repeat)" },
  { word: "commit", name: "COMMIT", effect: "Shield 3s" },
  { word: "push", name: "FORCE PUSH", effect: "Speed boost 3s" },
];
