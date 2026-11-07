import * as THREE from "three";

const rings = [];
const n = (count) => Math.max(1, Math.min(count || 1, 5));

function ring(ctx, color, maxScale, life, y = 0.2) {
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
  ctx.rain("0123456789%", "#7CFC00", 40);
  ctx.effects.quant = Math.max(ctx.effects.quant || 0, 5);
  ctx.spawnFloatingText("QUANT MODE x2", "#7CFC00");
  return "📈 QUANT MODE: Marshall Wace's long/short desk doubles your points for 5s";
};

const macro = (ctx, count) => {
  const bet = 5 + Math.floor(Math.random() * 20) * n(count);
  ctx.rain("£$€¥", "#FFD700", 30);
  ctx.addScore(bet);
  ctx.spawnFloatingText(`MACRO +${bet}`, "#FFD700");
  return `🌍 GLOBAL MACRO: Brevan Howard bet on rates, the pond paid out +${bet}`;
};

const cashback = (ctx) => {
  const back = 10 + Math.floor((ctx.state.score || 0) * 0.01);
  ctx.rain("💳", "#D03027", 20);
  ctx.addScore(back);
  ctx.spawnFloatingText(`CASHBACK +${back}`, "#D03027");
  return `💳 CASHBACK: Capital One asks what's in your wallet: +${back}`;
};

const onCall = (ctx) => {
  ctx.flash("#ff3b30");
  ctx.effects.invuln = Math.max(ctx.effects.invuln || 0, 3);
  ctx.spawnFloatingText("INCIDENT DECLARED", "#ff3b30");
  return "🚨 ON-CALL: incident.io paged the duck. Invulnerable for 3s while it triages";
};

export const ABILITIES = {
  whack: (ctx, count) => {
    ring(ctx, 0xff8800, 8, 0.8);
    ctx.addScore(10 * n(count));
    ctx.flash("#ff8800");
    return `🔨 WHACK ATTACK: shockwave ring, +${10 * n(count)}`;
  },
  hack: (ctx) => {
    ctx.rain("01", "#00ff66", 40);
    ctx.effects.fast = Math.max(ctx.effects.fast || 0, 4);
    return "💻 HACKERMODE: green binary rain, speed boost for 4s";
  },
  quack: (ctx) => {
    if (ctx.state.hp < ctx.MAX_HP) ctx.heal(1);
    ctx.spawnFloatingText("QUACK!", "#ffd800");
    return "🦆 QUACK BACK: a mighty quack restores 1 HP";
  },
  warwick: (ctx, count) => {
    ctx.rain("🦆", "#ffffff", 25);
    ctx.addScore(5 * n(count));
    ctx.spawnFloatingText("2.3 DUCKS PER ROOD", "#ffffff");
    return `🏫 DUCK DENSITY: Warwick's famous 2.3 ducks per rood, +${5 * n(count)}`;
  },
  oculus: (ctx) => {
    ring(ctx, 0x66ccff, 3, 5, 2.5);
    ctx.effects.hidden = Math.max(ctx.effects.hidden || 0, 5);
    ctx.world.highlight("oculus");
    return "👁️ LECTURE THEATRE: you blend into the Oculus crowd, hidden for 5s";
  },
  compsoc: (ctx) => {
    ctx.rain("🍕", "#ff9900", 25);
    if (ctx.state.hp < ctx.MAX_HP) ctx.heal(1);
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
    ctx.spawnFloatingText("DUCK ▲ 4.20%", "#ffb000");
    return "📟 TERMINAL: Bloomberg ticker says DUCK is up 4.20%, +15";
  },
  netcraft: (ctx) => {
    ctx.rain("🎣", "#3399ff", 15);
    ctx.effects.shield = Math.max(ctx.effects.shield || 0, 4);
    return "🛡️ PHISHING TAKEDOWN: Netcraft blocks the next hits, shield for 4s";
  },
  incident: onCall,
  io: onCall,
  semicolon: (ctx) => {
    ctx.rain(";", "#cccccc", 30);
    ctx.effects.invuln = Math.max(ctx.effects.invuln || 0, 1);
    return "⌨️ SEMICOLON: statement terminated; so is the next hit (1s invuln)";
  },
  wifi: (ctx) => {
    ctx.rain("📶", "#999999", 15);
    ctx.effects.slow = Math.max(ctx.effects.slow || 0, 2);
    return "📶 EDUROAM DROPPED: 2s of lag, reconnecting...";
  },
  demo: (ctx) => {
    ctx.effects.invuln = Math.max(ctx.effects.invuln || 0, 3);
    ctx.spawnFloatingText("WORKS ON MY MACHINE", "#bb86fc");
    return "🎬 DEMO GODS: nothing can crash during the demo, invulnerable 3s";
  },
  pitch: (ctx, count) => {
    ctx.rain("💰", "#00c853", 20);
    ctx.addScore(20 * n(count));
    ctx.spawnFloatingText("SERIES A", "#00c853");
    return `🎤 ELEVATOR PITCH: judges loved it, raised +${20 * n(count)}`;
  },
  commit: (ctx) => {
    ctx.effects.shield = Math.max(ctx.effects.shield || 0, 3);
    ctx.spawnFloatingText("CHANGES STAGED", "#f05032");
    return "📝 COMMIT: progress saved, shield for 3s";
  },
  push: (ctx) => {
    ctx.effects.fast = Math.max(ctx.effects.fast || 0, 3);
    ctx.spawnFloatingText("--force", "#f05032");
    return "🚀 FORCE PUSH: no review, no regrets, speed boost 3s";
  },
};

export const ABILITY_DOCS = [
  { word: "whack", name: "WHACK ATTACK", effect: "Orange shockwave ring, +10 points per mention" },
  { word: "hack", name: "HACKERMODE", effect: "Binary rain, speed boost 4s" },
  { word: "quack", name: "QUACK BACK", effect: "Heal 1 HP" },
  { word: "warwick", name: "DUCK DENSITY", effect: "Duck rain (Warwick: 2.3 ducks per rood), +5 per mention" },
  { word: "oculus", name: "LECTURE THEATRE", effect: "Halo over the duck, hidden 5s" },
  { word: "compsoc", name: "FREE PIZZA", effect: "Pizza rain, heal 1 HP" },
  { word: "marshall / wace", name: "QUANT MODE", effect: "Number rain, points x2 for 5s" },
  { word: "brevan / howard", name: "GLOBAL MACRO", effect: "Currency rain, random +5..+100 macro payout" },
  { word: "capital / one", name: "CASHBACK", effect: "Card rain, +10 plus 1% of score" },
  { word: "bloomberg", name: "TERMINAL", effect: "Amber flash, DUCK ticker up 4.20%, +15" },
  { word: "netcraft", name: "PHISHING TAKEDOWN", effect: "Shield 4s" },
  { word: "incident / io", name: "ON-CALL", effect: "Red alert flash, invulnerable 3s" },
  { word: "semicolon", name: "SEMICOLON", effect: "Semicolon rain, invulnerable 1s" },
  { word: "wifi", name: "EDUROAM DROPPED", effect: "2s of lag (slow)" },
  { word: "demo", name: "DEMO GODS", effect: "Invulnerable 3s" },
  { word: "pitch", name: "ELEVATOR PITCH", effect: "Money rain, +20 per mention" },
  { word: "commit", name: "COMMIT", effect: "Shield 3s" },
  { word: "push", name: "FORCE PUSH", effect: "Speed boost 3s" },
];
