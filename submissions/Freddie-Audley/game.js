const cast = {
  whack: "The Whacker",
  hack: "Hack Sprite",
  duck: "Duck",
  quack: "Quacker",
  goose: "Goose",
  honk: "Honker",
  bug: "Bug",
  feature: "Feature",
  warwick: "Warwick",
  oculus: "Oculus",
  compsoc: "CompSoc",
  marshall: "Marshall",
  wace: "WACE",
  brevan: "Brevan",
  howard: "Howard",
  capital: "Capital",
  one: "One",
  bloomberg: "Bloomberg",
  netcraft: "Netcraft",
  incident: "Incident",
  io: "IO",
  pizza: "Pizza",
  coffee: "Coffee",
  sleep: "Sleepy",
  deploy: "Deploy",
  merge: "Merge",
  conflict: "Conflict",
  commit: "Commit",
  push: "Push",
  prod: "Prod",
  segfault: "Segfault",
  null: "Null",
  pointer: "Pointer",
  stack: "Stack",
  overflow: "Overflow",
  semicolon: "Semicolon",
  rubber: "Rubber Duck",
  demo: "Demo",
  pitch: "Pitch",
  prize: "Prize",
  midnight: "Midnight",
  wifi: "WiFi",
};

const holes = [...document.querySelectorAll(".hole")];
const scoreLabel = document.querySelector("#score");
const streakLabel = document.querySelector("#streak");
const timeLabel = document.querySelector("#time");
const statusLabel = document.querySelector("#status");
const startButton = document.querySelector("#start");
const castList = document.querySelector("#cast");
const wordLog = document.querySelector("#word-log");

let words = [];
let wordIndex = 0;
let seedWords = [];
let random = Math.random;
const castWords = new Set();
let score = 0;
let streak = 0;
let timeLeft = 30;
let running = false;
const activeHoles = new Set();
let spawnTimer = null;
let clockTimer = null;
let groupHideTimer = null;
let isSpawning = false;

function seededRandom(sequence) {
  let seed = 2166136261;
  for (const word of sequence) {
    for (let index = 0; index < word.length; index += 1) {
      seed = Math.imul(seed ^ word.charCodeAt(index), 16777619);
    }
  }
  seed >>>= 0;
  if (seed === 0) seed = 0x9e3779b9;

  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function updateStats() {
  scoreLabel.textContent = String(score).padStart(3, "0");
  streakLabel.textContent = `${streak}×`;
  timeLabel.textContent = String(timeLeft).padStart(2, "0");
}

function updateCast() {
  castList.replaceChildren(...[...castWords].map((word) => {
    const chip = document.createElement("span");
    chip.className = "cast-chip";
    chip.textContent = word;
    return chip;
  }));
}

function logWord(word) {
  if (wordLog.querySelector(".log-empty")) wordLog.replaceChildren();
  const entry = document.createElement("li");
  entry.textContent = word.toUpperCase();
  wordLog.prepend(entry);
  while (wordLog.children.length > 14) wordLog.lastElementChild.remove();
}

async function getWhackWords() {
  const response = await fetch("/api/round", { method: "POST" });
  if (!response.ok) throw new Error(`Word roll failed (${response.status})`);
  const result = await response.json();
  if (!Array.isArray(result.words) || result.words.length === 0 ||
      result.words.some((word) => typeof word !== "string" || !cast[word])) {
    throw new Error("The word roll returned an invalid character list.");
  }
  return result.words;
}

async function refillWords(count) {
  while (words.length - wordIndex < count) {
    const nextWords = await getWhackWords();
    words.push(...nextWords);
    seedWords.push(...nextWords);
    random = seededRandom(seedWords);
    nextWords.forEach((word) => castWords.add(word));
    updateCast();
  }
}

function hideMoles() {
  window.clearTimeout(groupHideTimer);
  for (const hole of holes) {
    hole.classList.remove("up", "bonk");
  }
  activeHoles.clear();
}

async function spawnMoles() {
  if (!running || isSpawning) return;
  isSpawning = true;

  try {
    const count = 1 + Math.floor(random() * 4);
    await refillWords(count);
    if (!running) return;

    hideMoles();
    const availableHoles = [...holes];

    for (let index = 0; index < count; index += 1) {
      const selectedIndex = index + Math.floor(random() * (availableHoles.length - index));
      [availableHoles[index], availableHoles[selectedIndex]] =
        [availableHoles[selectedIndex], availableHoles[index]];

      const hole = availableHoles[index];
      const word = words[wordIndex];
      wordIndex += 1;
      logWord(word);
      hole.querySelector(".mole-image").src = `/resources/${word}.png`;
      hole.setAttribute("aria-label", `Whack ${cast[word]}, themed around ${word}`);
      hole.dataset.word = word;
      hole.dataset.appearance = String(wordIndex);
      hole.classList.add("up");
      activeHoles.add(hole);
    }

    groupHideTimer = window.setTimeout(() => {
      if (activeHoles.size === 0) return;
      streak = 0;
      updateStats();
      statusLabel.textContent = "Too slow! Some moles got away.";
      hideMoles();
    }, 1140);
  } catch (error) {
    console.error("Could not refill the word jar:", error);
    running = false;
    window.clearInterval(spawnTimer);
    window.clearInterval(clockTimer);
    hideMoles();
    startButton.disabled = false;
    startButton.innerHTML = 'TRY AGAIN <span aria-hidden="true">↻</span>';
    statusLabel.textContent = "Word jar refill failed. Round stopped.";
  } finally {
    isSpawning = false;
  }
}

function finishRound() {
  running = false;
  window.clearInterval(spawnTimer);
  window.clearInterval(clockTimer);
  hideMoles();
  startButton.disabled = false;
  startButton.innerHTML = 'Play again <span aria-hidden="true">↻</span>';
  statusLabel.textContent = score >= 200
    ? `Absolute legend! You scored ${score}.`
    : `Round over! You scored ${score}. Give it another whack?`;
}

function whackHole(event) {
  const hole = event.currentTarget;
  if (!running || !activeHoles.has(hole)) return;

  hole.classList.add("bonk");
  activeHoles.delete(hole);
  score += 10 + Math.min(streak, 10);
  streak += 1;
  statusLabel.textContent = `${cast[hole.dataset.word]} bonked! Nice reflexes.`;
  updateStats();
  if (activeHoles.size === 0) window.clearTimeout(groupHideTimer);
  window.setTimeout(() => hole.classList.remove("up", "bonk"), 140);
}

async function startRound() {
  if (running) return;
  startButton.disabled = true;
  startButton.textContent = "Shaking the word jar…";
  statusLabel.textContent = "Calling the cast…";

  try {
    words = await getWhackWords();
    wordIndex = 0;
    seedWords = [...words];
    random = seededRandom(seedWords);
    castWords.clear();
    words.forEach((word) => castWords.add(word));
    score = 0;
    streak = 0;
    timeLeft = 30;
    running = true;
    updateStats();
    updateCast();
    statusLabel.textContent = "Go go go! Whack 'em while they're up!";
    startButton.textContent = "Round in progress";
    await spawnMoles();
    spawnTimer = window.setInterval(spawnMoles, 1425);
    clockTimer = window.setInterval(() => {
      timeLeft -= 1;
      updateStats();
      if (timeLeft <= 0) finishRound();
    }, 1000);
  } catch (error) {
    console.error("Could not start the round:", error);
    statusLabel.textContent = "Couldn't start a round. Is the game server running?";
    startButton.disabled = false;
    startButton.innerHTML = 'Try again <span aria-hidden="true">→</span>';
  }
}

holes.forEach((hole) => hole.addEventListener("click", whackHole));
startButton.addEventListener("click", startRound);
updateStats();
