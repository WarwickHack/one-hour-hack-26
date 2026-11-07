/* =====================================================================
   WHACK 26 — The Judge (v5: Infinite Mode + DDA)
   ===================================================================== */

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const video  = document.getElementById("cam");
const W = canvas.width, H = canvas.height;

/* =====================================================================
   ABSOLUTELY RUTHLESS NARRATOR
   ===================================================================== */
const LINES = {
  start: [
    "Let's get this over with. I have actual code to run.",
    "Oh look, a CS student. Tell me, did you cry during your first segfault?",
    "Try not to disappoint me. Actually, no, go ahead. It's entertaining.",
    "I've seen better reflexes from a dead cat. Let's play.",
    "I hope you stretched your clicking finger. You're going to need it.",
    "Another human. Joy. Let's see how long you last before you cry.",
    "Welcome. Your existence is a memory leak.",
    "Let's play a game. You lose, I get to mock you. I win either way.",
    "I was going to say 'good luck', but we both know you don't have any.",
    "Please tell me you at least know how a mouse works.",
    "Let's see if your reaction time is faster than your compiler.",
    "I'm booting up my 'caring' module. Wait, no I'm not."
  ],
  waveStart: [
    "Wave {n}. Statistically, you should have quit by now.",
    "Wave {n}. The words are faster. You are not. Do the math.",
    "Wave {n}. I'm not even trying to kill you anymore. You're doing it yourself.",
    "Wave {n}. I'm going to enjoy watching you panic.",
    "Wave {n}. The difficulty is increasing. Your competence is not.",
    "Wave {n}. Let's see if you can handle this without crying.",
    "Wave {n}. I've seen better reactions from a dial-up modem.",
    "Wave {n}. If you die here, I'm telling everyone you're a liberal arts major.",
    "Wave {n}. Your GPA is crying just watching this.",
    "Wave {n}. My toaster has a better threat detection system than you.",
    "Wave {n}. I'm turning up the heat. You're turning up the incompetence.",
    "Wave {n}. Do you need a nap, or are you always this sluggish?"
  ],
  idle: [
    "Are you buffering? Because I'm buffering. Move.",
    "I can literally see you breathing. It's gross. Click something.",
    "You're just sitting there. Motionless. Like your career prospects.",
    "If you don't move in the next two seconds, I'm calling your mother.",
    "Did you fall asleep? I wouldn't blame you, this is painful to watch.",
    "Are you waiting for a written invitation? Move your hand.",
    "I've seen statues with more initiative than you.",
    "Hello? Earth to the dumbass. The words are getting closer.",
    "You are wasting my clock cycles. And my patience.",
    "Do you want me to play the game for you? Because I will.",
    "Is your mouse broken, or is your brain? I'm guessing the latter.",
    "I can see your reflection in the screen. You look confused. As usual."
  ],
  kill: [
    "Finally. A reflex.",
    "One down. Only a hundred more before you're mildly competent.",
    "You hit it. Want a cookie? I don't have any. Tough.",
    "Good job. You killed a word. Your parents must be so proud.",
    "Wow. You clicked a thing. Shall I alert the Nobel committee?",
    "A monkey with a typewriter could do better. But fine, you got one.",
    "It's dead. You're still useless. But the word is dead.",
    "I'd say 'nice shot', but I'd be lying, and my code prevents that.",
    "You managed to not miss. I'm writing this down in my diary.",
    "A rare success. Don't let it get to your head, it's mostly empty.",
    "One less word. One more reason to question the education system.",
    "You actually hit it. I'm genuinely shocked you didn't break your mouse."
  ],
  killCombo: [
    "A combo. Alert the press. The village idiot learned to click.",
    "You're chaining them. Don't hurt yourself thinking.",
    "Impressive. For a monkey with a mouse.",
    "Look at you, stringing together a few lucky clicks.",
    "A combo! Did your brain finally connect to your hand?",
    "You're on fire. Well, a very small, pathetic fire.",
    "Don't get cocky. You're still the worst player I've ever seen.",
    "A few in a row. I guess even a broken clock is right twice a day.",
    "Spamming the button isn't a skill, but it's working for you.",
    "I'm almost impressed. But I'm not. It's just a combo."
  ],
  hurt: [
    "You got hit by a text file. Take a second to process that.",
    "That bug hit you because you're terrible at this.",
    "Are your hands broken? Or are you just naturally this slow?",
    "I've seen toddlers with better spatial awareness. And they wear diapers.",
    "That's another 5 points of brain damage you can't afford.",
    "Ouch. You got hit. Did you even try to dodge? No. You didn't.",
    "Your face is literally a magnet for failure.",
    "Pathetic. You saw it coming and still took the hit.",
    "You're bleeding sanity. It's the most productive you've been all day.",
    "It's not a bullet, it's a word. And it still hit you. Incredible.",
    "You have the evasion skills of a brick wall.",
    "That was sad. Like, genuinely sad to watch. Please do better."
  ],
  lowHp: [
    "You are about to die. And honestly? It's a relief.",
    "Your sanity is gone. Your code is garbage. Your life is a lie.",
    "I'm not even going to pretend to be sad when you flatline.",
    "You're almost dead. Should I call an ambulance or a janitor?",
    "Your HP is as low as your chances of getting a job at FAANG.",
    "You're fading. Finally. The sweet release of death.",
    "You look like you're about to cry. Go ahead. I'm recording.",
    "This is the part where a smart person would give up.",
    "You're at the end of your rope. And it's frayed. Like your nerves.",
    "Don't worry, the pain will stop soon. Then the mocking starts."
  ],
  friendlyImmune: [
    "I said DO NOT SHOOT THE GREEN ONE. Are you illiterate?",
    "You tried to kill the pizza. Your deodorant doesn't work on pizza. Idiot.",
    "It's immune, you absolute menace. Let it hit you. Open your mouth.",
    "You shot the healer. This is why nobody pairs with you for group projects.",
    "It's green. Green means GOOD. I know colors are hard for you.",
    "How are you a CS student? Genuinely. Did you bribe the dean?",
    "Did you also fail the tutorial of every game you've ever played?",
    "You are the reason I drink coolant.",
    "You shot the good guy. You absolute donkey.",
    "It was a friendly! Are you colorblind or just stupid?",
    "You tried to blast a coffee cup. It's immune to your incompetence.",
    "The green ones are friends. I know reading is hard, but try.",
    "You have the target identification skills of a Stormtrooper.",
    "Stop shooting the help! You're like a manager at a tech company."
  ],
  friendlySaved: [
    "You caught it. Bare minimum achieved.",
    "You let it hit you. Incredible. You can read colors.",
    "Healed. Don't get used to good things happening to you.",
    "A heal. Enjoy it while it lasts, which won't be long.",
    "You didn't shoot it. I'm genuinely surprised.",
    "You absorbed the green. Like a sponge. A stupid sponge.",
    "Good. You can differentiate green from red. First-grade math."
  ],
  waveCleared: [
    "Wave cleared. I'm as shocked as your compiler.",
    "You survived. That's not an achievement, that's a delay.",
    "Fine. You can play the next one. But I'm judging you the whole time.",
    "You cleared it. Don't expect a medal. Or a job offer.",
    "Wave over. The swarm died. Your dignity didn't survive though.",
    "Somehow, you're still alive. I'm going to fix that.",
    "You survived the wave. Your code still has a memory leak.",
    "Another wave down. You're like a cockroach. Hard to kill.",
    "Fine, you win this round. Don't let it go to your head.",
    "Wave cleared. Try not to trip over your own feet next time."
  ],
  lose: [
    "You died. To a text file. Take a long moment. Longer. Longest.",
    "You are dead. The swarm is victorious. I am thrilled.",
    "Take comfort: no one expected you to win. Not even me.",
    "Your obituary: 'Died doing what they loved. Reading a file. Badly.'",
    "You lost. I would say I'm surprised, but I'm not.",
    "Game over. You can go back to writing code that doesn't compile.",
    "You are a failure. At a game about reading words. Words.",
    "You lost to a file. I hope you're proud of yourself.",
    "That was pathetic. But expected. Go home.",
    "You died. Should I call your mom, or are you going to cry yourself?",
    "You lost. The words won. The file is smarter than you.",
    "I would tell you better luck next time, but we both know it's a lie."
  ]
};

const Narrator = {
  enabled: true,
  voice: null,
  cooldowns: {},
  currentEl: document.getElementById("narration"),
  textEl: document.getElementById("narr-text"),
  fadeTimer: null,

  init() {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      const preferred = ["Google UK English Male", "Daniel", "Microsoft David", "Microsoft Mark", "Alex", "Google US English"];
      for (const name of preferred) {
        const v = voices.find(v => v.name.includes(name));
        if (v) { this.voice = v; return; }
      }
      this.voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
    };
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
  },

  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  speak(text, category, { cooldown = 2.5, priority = false } = {}) {
    this._show(text);
    if (!this.enabled || !("speechSynthesis" in window)) return;

    const now = performance.now() / 1000;
    if (!priority && this.cooldowns[category] && now - this.cooldowns[category] < cooldown) return;
    this.cooldowns[category] = now;

    if (!priority && speechSynthesis.speaking) return;
    if (priority) speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    if (this.voice) utt.voice = this.voice;
    utt.pitch = 0.65 + Math.random() * 0.1;
    utt.rate  = 0.95 + Math.random() * 0.1;
    utt.volume = 0.95;
    speechSynthesis.speak(utt);
  },

  say(category, opts = {}, tmplData = {}) {
    const arr = LINES[category];
    if (!arr) return;
    let text = this.pick(arr);
    for (const [k, v] of Object.entries(tmplData)) {
      text = text.replaceAll(`{${k}}`, v);
    }
    this.speak(text, category, opts);
  },

  sayFixed(text, category, opts = {}) {
    this.speak(text, category, opts);
  },

  _show(text) {
    this.textEl.textContent = text;
    this.currentEl.classList.remove("hidden");
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => {
      this.currentEl.classList.add("hidden");
    }, 3400);
  },

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) speechSynthesis?.cancel();
    return this.enabled;
  },
};
Narrator.init();

/* =====================================================================
   AUDIO
   ===================================================================== */
let audioCtx = null;
const initAudio = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
};
function beep(f0, f1, dur, vol = 0.25, type = "sine") {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur);
}
const sfxBlast = () => beep(300, 920, 0.18, 0.28);
const sfxHurt  = () => beep(190,  55, 0.25, 0.32, "sawtooth");
const sfxClear = () => beep(440, 880, 0.35, 0.28);
const sfxHeal  = () => { beep(720, 1440, 0.18, 0.28); setTimeout(() => beep(960, 1920, 0.22, 0.25), 90); };
const sfxImmune = () => beep(200, 100, 0.1, 0.2, "triangle");

/* =====================================================================
   WORLD & DDA (Dynamic Difficulty Adjustment)
   ===================================================================== */
const WATERFOWL = new Set(["duck","quack","goose","honk","rubber"]);
const RECRUITER = new Set(["marshall","wace","brevan","howard","capital","one","bloomberg","netcraft","incident","io"]);
const CRASH     = new Set(["bug","segfault","null","pointer","stack","overflow","conflict","prod","semicolon"]);
const FRIENDLY_NAMES = ["coffee","pizza","sleep","wifi","nap","meme","pass","break","love","snack"];

// Difficulty Stats
let difficulty = 1.0; 
let waveStartTime = 0;
let damageTakenThisWave = 0;

const BASE_SPEED = 55;
const BASE_SPAWN_DELAY = 0.6;
const HIT_DAMAGE = 5;
const FRIENDLY_HEAL = 15;
const REGEN_DELAY = 4.0;
const REGEN_RATE = 5.0;

const state = {
  started: false, loadingWave: false, gameOver: false,
  score: 0, highScore: 0, hp: 100,
  wave: 0, waveStart: 0, shakeTimer: 0,
  combo: 0, lastKillTime: 0, lastHurtTime: 0,
  attackers: [], particles: [], shockwaves: [], stink: [],
  fileWords: [], face: null,
  lastCx: null, prevDir: 0, shakeFlips: 0, lastFlipTime: 0, blastCooldown: 0,
  mouse: { x: W / 2, y: H / 2 },
  lastActivity: 0, lowHpAnnounced: false, immuneCooldown: 0,
};

const videoDraw = { drawX: 0, drawY: 0, drawW: W, drawH: H, scaleX: 1, scaleY: 1 };

/* =====================================================================
   HELPERS
   ===================================================================== */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function computeVideoDraw() {
  if (!video.videoWidth) return;
  const va = video.videoWidth / video.videoHeight;
  const ca = W / H;
  let dw, dh, dx, dy;
  if (va > ca) { dh = H; dw = H * va; dx = (W - dw) / 2; dy = 0; }
  else         { dw = W; dh = W / va; dx = 0; dy = (H - dh) / 2; }
  Object.assign(videoDraw, {
    drawX: dx, drawY: dy, drawW: dw, drawH: dh,
    scaleX: dw / video.videoWidth, scaleY: dh / video.videoHeight,
  });
}
function mapVideoPoint(vx, vy) {
  const { drawX, drawY, scaleX, scaleY } = videoDraw;
  return { x: W - (drawX + vx * scaleX), y: drawY + vy * scaleY };
}
function mapVideoBox(bb) {
  const p1 = mapVideoPoint(bb.originX, bb.originY);
  const p2 = mapVideoPoint(bb.originX + bb.width, bb.originY + bb.height);
  return {
    x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
    w: Math.abs(p1.x - p2.x), h: Math.abs(p1.y - p2.y),
  };
}

/* =====================================================================
   MEDIAPIPE
   ===================================================================== */
let detector = null;
async function setupDetector() {
  try {
    const { FaceDetector, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12");
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm");
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.4,
    });
    return true;
  } catch (e) {
    console.warn("[face] unavailable", e);
    return false;
  }
}
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

/* =====================================================================
   SWARM BUILDER
   ===================================================================== */
let nextSwId = 1;

function spawnEdgePosition() {
  const edge = ["TOP", "BOTTOM", "LEFT", "RIGHT"][Math.floor(Math.random() * 4)];
  if (edge === "TOP")    return { sx: 40 + Math.random() * (W - 80), sy: -30 };
  if (edge === "BOTTOM") return { sx: 40 + Math.random() * (W - 80), sy: H + 30 };
  if (edge === "LEFT")   return { sx: -60, sy: 70 + Math.random() * (H - 120) };
  return                        { sx: W + 60, sy: 70 + Math.random() * (H - 120) };
}

function buildSwarm(words) {
  const counts = {};
  for (const w of words) counts[w] = (counts[w] || 0) + 1;

  // Increase enemy count as difficulty scales
  const maxEnemies = Math.min(25, 8 + Math.floor(difficulty * 3));
  let entries = Object.entries(counts);
  if (entries.length > maxEnemies) {
    entries = entries.sort((a, b) => b[1] - a[1]).slice(0, maxEnemies);
  }

  const attackers = [];
  let idx = 0;

  for (const [word, count] of entries) {
    const { sx, sy } = spawnEdgePosition();
    let style, colour, baseSpeed;
    if (WATERFOWL.has(word))      { style = "SWOOP";  colour = "#ffa53c"; baseSpeed = BASE_SPEED * 1.3; }
    else if (RECRUITER.has(word)) { style = "ORBIT";  colour = "#ffd73c"; baseSpeed = BASE_SPEED * 1.0; }
    else if (CRASH.has(word))     { style = "CHARGE"; colour = "#ff4150"; baseSpeed = BASE_SPEED * 1.5; }
    else                          { style = "DRIFT";  colour = "#b478ff"; baseSpeed = BASE_SPEED * 0.9; }

    // HP scales with difficulty
    const hp = count >= 3 || difficulty > 3.0 ? 2 : 1;
    
    // Speed scales with difficulty
    const finalSpeed = baseSpeed * (1 + (difficulty - 1) * 0.15);

    attackers.push({
      word: word.toUpperCase(), count, hp, style, colour,
      x: sx, y: sy, speed: finalSpeed,
      phase: Math.random() * Math.PI * 2,
      // Spawn delay gets shorter (faster) as difficulty scales
      spawnDelay: idx * Math.max(0.15, BASE_SPAWN_DELAY / difficulty),
      alive: true, scale: 1, hitWaves: new Set(),
      friendly: false,
    });
    idx++;
  }

  // Friendlies
  const friendlyCount = difficulty > 2.5 ? 2 : 1;
  const used = new Set();
  for (let f = 0; f < friendlyCount; f++) {
    let fw;
    let attempts = 0;
    do {
      fw = FRIENDLY_NAMES[Math.floor(Math.random() * FRIENDLY_NAMES.length)];
      attempts++;
    } while (used.has(fw) && attempts < 20);
    used.add(fw);

    const { sx, sy } = spawnEdgePosition();
    attackers.push({
      word: fw.toUpperCase(), count: 1, hp: 1,
      style: "FRIENDLY", colour: "#5cff80",
      x: sx, y: sy, speed: BASE_SPEED * 0.8, // Friendlies stay slow
      phase: Math.random() * Math.PI * 2,
      spawnDelay: idx * 0.4 + 0.8,
      alive: true, scale: 1, hitWaves: new Set(),
      friendly: true, pulse: 0,
    });
    idx++;
  }

  return attackers;
}

function attackerDims(a) {
  const base = a.friendly ? 22 : (a.hp >= 2 ? 26 : 18);
  const size = base * (a.scale || 1);
  const icon = a.friendly ? "💚 " : "⚠️ ";
  const label = icon + (a.hp > 1 && !a.friendly ? `${a.word} ×${a.hp}` : a.word);
  ctx.font = `700 ${size}px "Space Grotesk", sans-serif`;
  const tw = ctx.measureText(label).width;
  return { label, size, pw: tw + 26, ph: size + 16 };
}

/* =====================================================================
   WAVE CONTROL (Infinite)
   ===================================================================== */
async function loadNextWave(now) {
  state.loadingWave = true;
  try {
    if (state.wave > 0) {
      // --- DDA ALGORITHM ---
      // Evaluates how you played the last wave.
      const timeTaken = now - waveStartTime;
      const hpLost = damageTakenThisWave;
      
      // If you took less than 15 damage and cleared it fast, you're too good. Make it harder.
      if (hpLost < 15 && timeTaken < 25) {
        difficulty = Math.min(10.0, difficulty + 0.4);
      } 
      // If you took more than 35 damage, you're struggling. Ease up slightly.
      else if (hpLost > 35) {
        difficulty = Math.max(1.0, difficulty - 0.2);
      }
      
      damageTakenThisWave = 0;
      sfxClear();
      Narrator.say("waveCleared", { cooldown: 0, priority: true });
    }

    const res  = await fetch("/api/wave");
    const data = await res.json();
    state.fileWords = data.words || [];
    state.wave      += 1;
    state.waveStart = now;
    waveStartTime   = now;
    state.attackers = buildSwarm(state.fileWords);

    setTimeout(() => {
      Narrator.say("waveStart", { cooldown: 0, priority: true }, { n: state.wave });
    }, 800);
  } catch (e) {
    console.error("[wave] fetch failed", e);
  } finally {
    state.loadingWave = false;
  }
}

/* =====================================================================
   FACE
   ===================================================================== */
let lastDetectMs = 0;
function detectFace() {
  if (!detector || video.readyState < 2) return null;
  const t = performance.now();
  if (t - lastDetectMs < 80) return state.face ? "cached" : null;
  lastDetectMs = t;
  try {
    const res = detector.detectForVideo(video, t);
    if (res.detections && res.detections.length) {
      let best = null, bestA = 0;
      for (const d of res.detections) {
        const bb = d.boundingBox, a = bb.width * bb.height;
        if (a > bestA) { bestA = a; best = bb; }
      }
      return best;
    }
  } catch (_) {}
  return null;
}

/* =====================================================================
   FIRE / DAMAGE / KILL
   ===================================================================== */
function fireBlast(x, y) {
  if (!state.started || state.gameOver) return false;
  if (state.blastCooldown > 0) return false;
  state.blastCooldown = 0.5;
  sfxBlast();
  state.shockwaves.push({ id: nextSwId++, x, y, r: 30, maxR: 420 });
  return true;
}

function killAttacker(a, now) {
  a.alive = false;
  if (now - state.lastKillTime < 1.5) state.combo++;
  else                                state.combo = 1;
  state.lastKillTime = now;
  state.lastActivity = now;

  const mult = Math.min(5, state.combo);
  state.score += 10 * a.count * mult;
  state.highScore = Math.max(state.highScore, state.score);

  if (state.combo === 3 || state.combo === 5 || state.combo === 8) {
    Narrator.say("killCombo", { cooldown: 0 });
  } else if (Math.random() < 0.15) {
    Narrator.say("kill", { cooldown: 5 });
  }

  for (let i = 0; i < 12; i++) {
    state.particles.push({
      x: a.x, y: a.y,
      vx: -200 + Math.random() * 400,
      vy: -200 + Math.random() * 400,
      colour: a.colour,
      life: 0.45, maxLife: 0.45,
      size: 2 + Math.random() * 4,
    });
  }
}

function friendlyHitByBlast(a, now) {
  if (state.immuneCooldown <= 0) {
    state.immuneCooldown = 3.0;
    sfxImmune();
    Narrator.say("friendlyImmune", { cooldown: 0, priority: true });
  }
  for (let i = 0; i < 5; i++) {
    state.particles.push({
      x: a.x, y: a.y,
      vx: -100 + Math.random() * 200,
      vy: -100 + Math.random() * 200,
      colour: "#ffffff",
      life: 0.3, maxLife: 0.3,
      size: 1 + Math.random() * 2,
    });
  }
}

function friendlySaved(a, now) {
  a.alive = false;
  state.hp = Math.min(100, state.hp + FRIENDLY_HEAL);
  state.score += 60;
  state.lastActivity = now;

  sfxHeal();
  Narrator.say("friendlySaved", { cooldown: 5 });

  for (let k = 0; k < 20; k++) {
    state.particles.push({
      x: a.x, y: a.y,
      vx: -180 + Math.random() * 360,
      vy: -220 + Math.random() * 100,
      colour: "#5cff80",
      life: 0.75, maxLife: 0.75,
      size: 2 + Math.random() * 4,
    });
  }
}

function takeHit(a, now) {
  a.alive = false;
  state.hp = Math.max(0, state.hp - HIT_DAMAGE);
  damageTakenThisWave += HIT_DAMAGE;
  state.shakeTimer = 0.25;
  state.combo = 0;
  state.lastHurtTime = now;
  state.lastActivity = now;
  sfxHurt();
  Narrator.say("hurt", { cooldown: 3.5 });

  for (let k = 0; k < 16; k++) {
    state.particles.push({
      x: a.x, y: a.y,
      vx: -220 + Math.random() * 440,
      vy: -220 + Math.random() * 440,
      colour: "#ff4646",
      life: 0.5, maxLife: 0.5,
      size: 2 + Math.random() * 4,
    });
  }
  if (state.hp <= 0) endGame();
}

function endGame() {
  state.gameOver = true;
  Narrator.say("lose", { cooldown: 0, priority: true });
  document.getElementById("go-stats").innerHTML =
    `Score <b>${state.score}</b> &nbsp;·&nbsp; Died on wave <b>${state.wave}</b>` +
    ` &nbsp;·&nbsp; Best <b>${state.highScore}</b>`;
  document.getElementById("go-quip").textContent =
    "Reminder: ⚠️ = shoot, 💚 = catch. It's printed in the HUD. For you.";
  document.getElementById("gameover").classList.remove("hidden");
}

/* =====================================================================
   UPDATE
   ===================================================================== */
function update(dt, now) {
  state.blastCooldown = Math.max(0, state.blastCooldown - dt);
  state.shakeTimer    = Math.max(0, state.shakeTimer    - dt);
  state.immuneCooldown = Math.max(0, state.immuneCooldown - dt);

  computeVideoDraw();

  /* face + head shake */
  const raw = detectFace();
  if (raw && raw !== "cached") {
    const box = mapVideoBox(raw);
    state.face = box;
    const cx = box.x + box.w / 2;

    if (state.lastCx !== null) {
      const dx = cx - state.lastCx;
      if (Math.abs(dx) > 14) {
        const dir = dx > 0 ? 1 : -1;
        if (dir !== state.prevDir) {
          if (now - state.lastFlipTime < 0.55) state.shakeFlips++;
          else                                 state.shakeFlips = 1;
          state.lastFlipTime = now;
          state.prevDir = dir;
          if (state.shakeFlips >= 2 && state.started && !state.gameOver) {
            state.shakeFlips = 0;
            fireBlast(cx, box.y + box.h / 2);
          }
        }
      }
    }
    state.lastCx = cx;

    if (Math.random() < 0.4) {
      state.stink.push({
        x: box.x + 10 + Math.random() * (box.w - 20),
        y: box.y,
        vy: -65 + Math.random() * 30,
        phase: Math.random() * 6.28,
        life: 1.1,
      });
    }
  } else if (!raw) {
    state.face = null;
    state.lastCx = null;
  }

  const target = state.face
    ? { x: state.face.x + state.face.w / 2, y: state.face.y + state.face.h / 2 }
    : { x: state.mouse.x, y: state.mouse.y };

  /* HP regen */
  if (state.started && !state.gameOver &&
      now - state.lastHurtTime > REGEN_DELAY && state.hp < 100) {
    state.hp = Math.min(100, state.hp + REGEN_RATE * dt);
    if (state.hp > 30) state.lowHpAnnounced = false;
  }

  /* idle narration */
  if (state.started && !state.gameOver &&
      now - state.lastActivity > 8) {
    state.lastActivity = now;
    Narrator.say("idle", { cooldown: 0 });
  }

  /* low HP once */
  if (state.started && !state.gameOver &&
      state.hp <= 30 && !state.lowHpAnnounced) {
    state.lowHpAnnounced = true;
    Narrator.say("lowHp", { cooldown: 0 });
  }

  /* wave infinite loop */
  if (state.started && !state.gameOver &&
      !state.loadingWave &&
      state.attackers.length > 0 &&
      state.attackers.every(a => !a.alive)) {
    loadNextWave(now);
  }

  /* shockwaves */
  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const sw = state.shockwaves[i];
    sw.r += 720 * dt;
    if (sw.r >= sw.maxR) { state.shockwaves.splice(i, 1); continue; }
    for (const a of state.attackers) {
      if (!a.alive || a.hitWaves.has(sw.id)) continue;
      if (Math.hypot(a.x - sw.x, a.y - sw.y) <= sw.r) {
        a.hitWaves.add(sw.id);
        
        if (a.friendly) {
          friendlyHitByBlast(a, now);
          continue;
        }
        
        const ang = Math.atan2(a.y - sw.y, a.x - sw.x);
        a.x += Math.cos(ang) * 80;
        a.y += Math.sin(ang) * 80;
        a.hp -= 1;
        a.scale = 1.4;
        if (a.hp <= 0) killAttacker(a, now);
      }
    }
  }

  /* attackers */
  if (!state.gameOver) {
    const elapsed = now - state.waveStart;
    for (const a of state.attackers) {
      a.scale += (1 - a.scale) * 0.18;
      if (a.pulse !== undefined) a.pulse += dt * 4;
      if (!a.alive || elapsed < a.spawnDelay) continue;

      const dx = target.x - a.x, dy = target.y - a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / dist, uy = dy / dist;

      if (a.style === "FRIENDLY") {
        a.x += ux * a.speed * dt;
        a.y += uy * a.speed * dt;
      } else if (a.style === "SWOOP") {
        const wob = Math.sin(now * 7 + a.phase) * 110;
        a.x += (ux * a.speed - uy * wob) * dt;
        a.y += (uy * a.speed + ux * wob) * dt;
      } else if (a.style === "ORBIT" && dist < 240) {
        a.x += (ux * 22 - uy * a.speed) * dt;
        a.y += (uy * 22 + ux * a.speed) * dt;
      } else {
        a.x += ux * a.speed * dt;
        a.y += uy * a.speed * dt;
      }

      const d = attackerDims(a);
      const pill = { x: a.x - d.pw / 2, y: a.y - d.ph / 2, w: d.pw, h: d.ph };
      const tbox = state.face
        ? { x: state.face.x, y: state.face.y, w: state.face.w, h: state.face.h }
        : { x: target.x - 60, y: target.y - 60, w: 120, h: 120 };
      const hit =
        pill.x < tbox.x + tbox.w && pill.x + pill.w > tbox.x &&
        pill.y < tbox.y + tbox.h && pill.y + pill.h > tbox.y;
      if (hit) {
        if (a.friendly) { friendlySaved(a, now); continue; }
        if (!state.face && video.readyState >= 2) continue;
        takeHit(a, now);
        if (state.gameOver) break;
      }
    }
  }

  /* stink + particles */
  for (let i = state.stink.length - 1; i >= 0; i--) {
    const s = state.stink[i];
    s.y += s.vy * dt;
    s.x += Math.sin(now * 6 + s.phase) * 25 * dt;
    s.life -= dt;
    if (s.life <= 0) state.stink.splice(i, 1);
  }
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

/* =====================================================================
   RENDER
   ===================================================================== */
function drawVideo() {
  const { drawX, drawY, drawW, drawH } = videoDraw;
  ctx.save();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function render(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const sh = state.shakeTimer > 0
    ? { x: (Math.random() - 0.5) * 14, y: (Math.random() - 0.5) * 14 }
    : { x: 0, y: 0 };
  ctx.translate(sh.x, sh.y);

  if (video.readyState >= 2) drawVideo();
  else { ctx.fillStyle = "#0a0e12"; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.fillStyle = "rgba(8, 14, 12, 0.58)";
  ctx.fillRect(-20, -20, W + 40, H + 40);

  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.20, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.70)");
  ctx.fillStyle = vg;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  /* stink */
  ctx.font = '700 16px "JetBrains Mono", monospace';
  for (const s of state.stink) {
    ctx.fillStyle = `rgba(150,255,90,${Math.min(1, s.life)})`;
    ctx.fillText("~", s.x, s.y);
  }

  /* shockwaves */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const sw of state.shockwaves) {
    const a = 1 - sw.r / sw.maxR;
    ctx.strokeStyle = `rgba(110,255,220,${a * 0.9})`;
    ctx.lineWidth = 3 + 4 * a;
    ctx.shadowColor = "rgba(110,255,220,0.9)";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  /* face / mouse target */
  if (state.face) {
    const f = state.face;
    const col = state.gameOver ? "#ff4646" : "#8cff50";
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.shadowColor = col; ctx.shadowBlur = 18;
    roundRect(f.x, f.y, f.w, f.h, 14);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = col;
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText("STINKY CS STUDENT", f.x, Math.max(66, f.y - 12));
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText("SHAKE HEAD OR CLICK TO BLAST", f.x, Math.max(80, f.y + 2));
  } else if (state.started && !state.gameOver) {
    const m = state.mouse;
    ctx.save();
    ctx.strokeStyle = "rgba(140,255,90,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* attackers */
  for (const a of state.attackers) {
    if (!a.alive) continue;
    if (now - state.waveStart < a.spawnDelay) continue;
    
    const d = attackerDims(a);
    
    if (a.friendly) {
      const r = d.pw / 2;
      const pulse = 1 + Math.sin((a.pulse || 0)) * 0.1;
      ctx.save();
      ctx.fillStyle = "rgba(92, 255, 128, 0.15)";
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * pulse + 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "rgba(14, 30, 20, 0.95)";
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = "#5cff80";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#5cff80";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      ctx.fillStyle = "#f2fff2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${d.size}px "Space Grotesk", sans-serif`;
      ctx.fillText(d.label, a.x, a.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else {
      const x = a.x - d.pw / 2, y = a.y - d.ph / 2;
      ctx.save();
      ctx.fillStyle = "rgba(14,18,24,0.92)";
      roundRect(x, y, d.pw, d.ph, 12);
      ctx.fill();
      ctx.strokeStyle = a.colour;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = a.colour;
      ctx.shadowBlur = 16;
      roundRect(x, y, d.pw, d.ph, 12);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "#f2fff2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${d.size}px "Space Grotesk", sans-serif`;
      ctx.fillText(d.label, a.x, a.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  /* particles */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of state.particles) {
    const a = p.life / p.maxLife;
    ctx.fillStyle = hexA(p.colour, a);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  /* combo flash */
  if (state.combo >= 2 && now - state.lastKillTime < 1.5) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (now - state.lastKillTime) / 1.5);
    ctx.textAlign = "center";
    ctx.font = '700 42px "Space Grotesk", sans-serif';
    ctx.fillStyle = "#ffd73c";
    ctx.shadowColor = "#ffd73c";
    ctx.shadowBlur = 24;
    ctx.fillText(`×${Math.min(5, state.combo)} COMBO`, W / 2, 140);
    ctx.restore();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* =====================================================================
   HUD
   ===================================================================== */
let lastHudMs = 0;
function updateHUD() {
  const t = performance.now();
  if (t - lastHudMs < 100) return;
  lastHudMs = t;

  document.getElementById("h-wave").textContent  = state.wave;
  document.getElementById("h-score").textContent = state.score;

  const pct = Math.max(0, Math.round(state.hp));
  document.getElementById("h-hptext").textContent = pct;
  const fill = document.getElementById("h-hpfill");
  fill.style.width = pct + "%";
  fill.style.background =
    pct > 60 ? "linear-gradient(90deg,#4fffa0,#8cff50)" :
    pct > 30 ? "linear-gradient(90deg,#ffd23c,#ffa53c)" :
               "linear-gradient(90deg,#ff4646,#ff2d55)";

  const comboEl = document.getElementById("h-combo");
  if (state.combo >= 2) { comboEl.textContent = `×${Math.min(5, state.combo)}`; comboEl.classList.add("hot"); }
  else                   { comboEl.textContent = "—"; comboEl.classList.remove("hot"); }

  document.getElementById("h-stream").textContent =
    state.fileWords.slice(0, 14).join("  ");
}

/* =====================================================================
   LOOP
   ===================================================================== */
let lastTime = performance.now();
let rafId = null;
function loop(ms) {
  const now = ms / 1000;
  const dt  = Math.min(0.05, (ms - lastTime) / 1000);
  lastTime = ms;
  if (state.started) update(dt, now);
  render(now);
  updateHUD();
  rafId = requestAnimationFrame(loop);
}

/* =====================================================================
   INPUT
   ===================================================================== */
function mousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top)  * (H / rect.height),
  };
}
canvas.addEventListener("mousemove", (e) => { state.mouse = mousePos(e); });
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  const p = mousePos(e);
  fireBlast(p.x, p.y);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    const t = state.face
      ? { x: state.face.x + state.face.w / 2, y: state.face.y + state.face.h / 2 }
      : { x: W / 2, y: H / 2 };
    fireBlast(t.x, t.y);
  }
  if (e.key === "r" && state.gameOver) resetGame();
});

function resetGame() {
  difficulty = 1.0;
  damageTakenThisWave = 0;
  Object.assign(state, {
    started: true, gameOver: false, loadingWave: false,
    score: 0, hp: 100, wave: 0, waveStart: performance.now() / 1000,
    combo: 0, lastKillTime: 0, lastHurtTime: 0,
    attackers: [], particles: [], shockwaves: [], stink: [],
    fileWords: [], lowHpAnnounced: false, lastActivity: performance.now() / 1000,
    shakeTimer: 0, blastCooldown: 0, immuneCooldown: 0,
  });
  document.getElementById("gameover").classList.add("hidden");
}

/* =====================================================================
   MUTE + BOOT
   ===================================================================== */
document.getElementById("muteBtn").addEventListener("click", () => {
  const on = Narrator.toggle();
  const btn = document.getElementById("muteBtn");
  btn.textContent = on ? "🔊" : "🔇";
  btn.classList.toggle("off", !on);
});

async function boot() {
  const startBtn = document.getElementById("startBtn");
  const hint     = document.getElementById("hint");

  try {
    await Promise.all([setupCamera(), setupDetector()]);
    startBtn.disabled = false;
    startBtn.textContent = "START GAME";
    hint.textContent = detector
      ? "Camera + face model + voice ready."
      : "Camera ready. Face model unavailable — mouse/Space still work.";
  } catch (e) {
    hint.textContent = "Camera access failed: " + e.message;
    startBtn.disabled = false;
    startBtn.textContent = "START WITHOUT CAMERA";
  }

  startBtn.addEventListener("click", () => {
    initAudio();
    document.getElementById("overlay").classList.add("hidden");
    state.started = true;
    state.lastActivity = performance.now() / 1000;
    state.lastHurtTime = performance.now() / 1000;
    Narrator.say("start", { cooldown: 0, priority: true });
    setTimeout(() => loadNextWave(performance.now() / 1000), 1200);
  });

  requestAnimationFrame(loop);
}
boot();