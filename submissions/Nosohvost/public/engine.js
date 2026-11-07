// Battle engine: turns whack() words into parts of speech, then into a fight.
// Pure logic, no drawing. Works in the browser (global `Engine`) and in Node (for sim.js).
(function (root) {
  const VERBS = new Set(["whack", "hack", "quack", "honk", "deploy", "merge", "commit", "push", "sleep", "overflow", "pitch", "conflict"]);
  const ADJS = new Set(["null", "rubber", "capital", "midnight", "one", "warwick"]);
  const ITEMS = new Set(["pizza", "coffee"]);
  // Two words next to each other can fuse into something stronger (or worse).
  const FUSIONS = {
    "rubber duck": "legend",
    "marshall wace": "legend",
    "brevan howard": "legend",
    "capital one": "legend",
    "incident io": "legend",
    "stack overflow": "ult",
    "merge conflict": "backfire",
    "null pointer": "crash",
  };
  const PARTY_FUSIONS = {
    marshall: { partner: "wace", key: "marshall wace" },
    wace: { partner: "marshall", key: "marshall wace" },
    brevan: { partner: "howard", key: "brevan howard" },
    howard: { partner: "brevan", key: "brevan howard" },
    incident: { partner: "io", key: "incident io" },
    io: { partner: "incident", key: "incident io" },
  };
  const KIND_LABEL = {
    noun: "NOUN", verb: "VERB", adj: "ADJECTIVE", item: "ITEM",
    legend: "LEGENDARY", ult: "ULTIMATE", backfire: "BACKFIRE", crash: "EXCEPTION",
  };

  const HERO_STATS = { // [power, hp]
    goose: [1.6, 90], duck: [1.2, 70], bug: [0.7, 45], feature: [1.1, 80], prod: [1.9, 40],
    segfault: [1.0, 60], semicolon: [0.6, 50], demo: [1.0, 70], prize: [1.3, 70], wifi: [1.2, 60],
    oculus: [1.3, 80], compsoc: [1.4, 90], bloomberg: [1.4, 90], netcraft: [1.3, 85],
  };
  const LEGEND_STATS = [2.6, 160];
  const VERB_DMG = { whack: 45, hack: 35, quack: 18, honk: 28, deploy: 40, merge: 22, commit: 25, push: 30, overflow: 35, pitch: 30, conflict: 12 };
  const VERB_SAY = {
    whack: "WHACKS", hack: "HACKS", quack: "QUACKS AT", honk: "HONKS AT", deploy: "DEPLOYS ON",
    merge: "MERGES INTO", commit: "COMMITS CRIMES AGAINST", push: "SHOVES", overflow: "OVERFLOWS ONTO",
    pitch: "PITCHES AT", conflict: "PICKS A FIGHT WITH",
  };
  const SYNERGY = {
    "duck quack": 2, "goose honk": 2, "demo pitch": 2, "prod deploy": 3, "feature commit": 2, "feature push": 2,
    "compsoc hack": 2, "bug hack": 2, "rubber duck quack": 3, "netcraft deploy": 2, "bloomberg pitch": 2,
  };
  const BOSS_HP = 850;
  const BOSS_EVERY = 5;
  const SLOTS = 8;

  function tokenize(words) {
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const pair = words[i] + " " + words[i + 1];
      if (i + 1 < words.length && FUSIONS[pair]) {
        out.push({ text: pair.toUpperCase(), key: pair, kind: FUSIONS[pair] });
        i++;
      } else {
        const w = words[i];
        const kind = VERBS.has(w) ? "verb" : ADJS.has(w) ? "adj" : ITEMS.has(w) ? "item" : "noun";
        out.push({ text: w.toUpperCase(), key: w, kind });
      }
    }
    return out;
  }

  class Battle {
    constructor(words, rng = Math.random) {
      this.rng = rng;
      this.words = words;
      this.tokens = tokenize(words);
      this.i = 0;
      this.bossMax = BOSS_HP;
      this.bossHp = BOSS_HP;
      this.slots = new Array(SLOTS).fill(null);
      this.pendingAdj = [];
      this.lastActor = null;
      this.prevKind = null;
      this.combo = 0;
      this.caffeine = 0;
      this.done = false;
      this.won = false;
      this.recruited = 0;
      this.totalDmg = 0;
      this.best = { dmg: 0, text: "nobody" };
      this.ticks = 0;
      this.nextId = 0;
      this.logs = [];
    }
    get progress() { return this.tokens.length ? this.i / this.tokens.length : 1; }
    log(text, kind) { this.logs.push({ text, kind }); }
    alive() { return this.slots.filter((h) => h && h.hp > 0); }

    makeHero(tok, adjs) {
      const legend = tok.kind !== "noun";
      let [pow, hp] = legend ? LEGEND_STATS : HERO_STATS[tok.key] || [1, 75];
      const h = { id: this.nextId++, key: tok.key, kind: tok.kind, adjs: [...adjs], legend, hits: 1, nul: false, scale: 1 };
      for (const a of adjs) {
        if (a === "midnight") pow *= 2;
        if (a === "capital") { pow *= 1.4; hp *= 1.3; h.scale *= 1.3; }
        if (a === "rubber") h.hits = 2;
        if (a === "null") h.nul = true;
        if (a === "one") { pow *= 1.3; hp *= 1.5; }
        if (a === "warwick") { pow *= 1.2; hp += 40; }
      }
      h.pow = pow;
      h.maxHp = Math.round(hp);
      h.hp = h.maxHp;
      h.name = [...adjs.map((a) => a.toUpperCase()), tok.text].join(" ");
      return h;
    }

    recruit(h, ev) {
      let k = this.slots.indexOf(null);
      if (k < 0) k = this.slots.findIndex((s) => s.hp <= 0);
      if (k < 0) {
        let oldest = null;
        for (const s of this.slots) if (!oldest || s.id < oldest.id) oldest = s;
        k = this.slots.indexOf(oldest);
        ev.push({ type: "leave", hero: oldest });
        this.log(`${oldest.name} clocks off and goes home.`, "dim");
      } else if (this.slots[k]) {
        ev.push({ type: "clear", hero: this.slots[k] });
      }
      this.slots[k] = h;
      h.slot = k;
      this.recruited++;
      ev.push({ type: "join", hero: h });
    }

    actor() {
      if (this.lastActor && this.lastActor.hp > 0 && this.slots.includes(this.lastActor)) return this.lastActor;
      let best = null;
      for (const s of this.slots) if (s && s.hp > 0 && (!best || s.id > best.id)) best = s;
      return best;
    }

    hurtBoss(d) { this.bossHp = Math.max(0, this.bossHp - d); this.totalDmg += d; }
    hurtHero(h, d, ev) {
      if (h.hp <= 0) return;
      h.hp = Math.max(0, h.hp - d);
      ev.push({ type: "health", hero: h, hp: h.hp });
      if (h.hp <= 0) {
        ev.push({ type: "die", hero: h });
        this.log(`${h.name} has been garbage collected.`, "dim");
      }
    }
    healAll(n) { for (const s of this.alive()) s.hp = Math.min(s.maxHp, s.hp + n); }

    step() {
      const ev = [];
      if (this.done) return ev;
      let tok = this.tokens[this.i++];
      // Capital and One are modifiers rather than recruits. They can find each
      // other while still pending, even with unrelated words between them.
      if (tok.kind === "adj" && (tok.key === "capital" || tok.key === "one")) {
        const partner = this.pendingAdj.indexOf(tok.key === "capital" ? "one" : "capital");
        if (partner >= 0) {
          this.pendingAdj.splice(partner, 1);
          tok = {text:"CAPITAL ONE", key:"capital one", kind:"legend"};
        }
      }
      ev.push({ type: "token", tok });
      switch (tok.kind) {
        case "adj":
          this.pendingAdj.push(tok.key);
          this.log(`${tok.text}... (waiting for a noun)`, "adj");
          break;
        case "noun": case "legend": case "crash": {
          const recipe = tok.kind === "noun" ? PARTY_FUSIONS[tok.key] : null;
          const partner = recipe ? this.alive().filter(h => h.key === recipe.partner).sort((a,b) => a.id-b.id)[0] : null;
          const recruitTok = partner ? {text:recipe.key.toUpperCase(),key:recipe.key,kind:"legend"} : tok;
          const h = this.makeHero(recruitTok, partner ? [...partner.adjs, ...this.pendingAdj] : this.pendingAdj);
          if (partner) {
            this.slots[partner.slot] = null;
            ev.push({type:"fuse",hero:partner,into:h});
            this.log(`${partner.name} and ${tok.text} fuse into ${h.name}!`,"legend");
          }
          this.pendingAdj = [];
          this.recruit(h, ev);
          this.lastActor = h;
          this.combo = 0;
          if (recruitTok.kind === "legend") this.log(`LEGENDARY ${h.name} joins the party!`, "legend");
          else this.log(`${h.name} joins the party.`, "noun");
          if (tok.key === "rubber duck") {
            this.healAll(30);
            ev.push({ type: "healAll", amount: 30 });
            this.log("The RUBBER DUCK debugs everyone (+30 HP).", "item");
          }
          if (tok.kind === "crash") {
            const d = Math.round(180 + this.rng() * 60);
            this.hurtBoss(d);
            if (d > this.best.dmg) this.best = { dmg: d, text: "NULL POINTER EXCEPTION" };
            ev.push({ type: "attack", hero: h, verb: "crash", dmg: [d], tags: ["NULL POINTER EXCEPTION"] });
            this.log(`${h.name} dereferences itself into THE DEADLINE: ${d}!`, "legend");
            h.hp = 0;
            ev.push({ type: "die", hero: h });
          }
          break;
        }
        case "item":
          if (tok.key === "pizza") {
            this.healAll(30);
            ev.push({ type: "healAll", amount: 30, item: "pizza" });
            this.log("PIZZA arrives. Everyone heals 30 HP.", "item");
          } else {
            this.caffeine += 3;
            ev.push({ type: "coffee" });
            this.log("COFFEE! The next 3 attacks deal x1.5.", "item");
          }
          break;
        case "verb": case "ult":
          this.act(tok, ev);
          break;
        case "backfire":
          ev.push({ type: "backfire" });
          this.log("MERGE CONFLICT! The party hurts itself in confusion (-20 each).", "boss");
          for (const s of this.alive()) this.hurtHero(s, 20, ev);
          break;
      }
      this.prevKind = tok.kind;
      this.ticks++;

      if (this.bossHp > 0 && this.ticks % BOSS_EVERY === 0) {
        const a = this.alive();
        if (a.length) {
          const t = a[Math.floor(this.rng() * a.length)];
          const enraged = this.bossHp < this.bossMax * 0.3;
          const d = Math.round((22 + this.rng() * 18) * (enraged ? 1.5 : 1));
          ev.push({ type: "bossAttack", hero: t, dmg: d, enraged });
          this.log(`THE DEADLINE strikes ${t.name} for ${d}${enraged ? " (ENRAGED)" : ""}.`, "boss");
          this.hurtHero(t, d, ev);
        }
      }

      if (this.bossHp <= 0) { this.done = true; this.won = true; ev.push({ type: "end", won: true }); }
      else if (this.i >= this.tokens.length) { this.done = true; ev.push({ type: "end", won: false }); }
      return ev;
    }

    act(tok, ev) {
      const h = this.actor();
      if (!h) {
        ev.push({ type: "void", tok });
        this.log(`"${tok.text}" echoes into the void. Nobody is there to do it.`, "dim");
        return;
      }
      if (tok.key === "sleep") {
        const a = Math.min(40, h.maxHp - h.hp);
        h.hp += a;
        this.lastActor = h;
        ev.push({ type: "sleep", hero: h, amount: a });
        this.log(`${h.name} takes a power nap (+${a} HP).`, "item");
        return;
      }
      const chained = this.lastActor === h && (this.prevKind === "verb" || this.prevKind === "ult");
      this.combo = chained ? this.combo + 1 : 1;
      this.lastActor = h;

      const base = tok.kind === "ult" ? 150 : VERB_DMG[tok.key];
      let mult = h.pow * (1 + 0.5 * (this.combo - 1));
      const tags = [];
      if (this.combo > 1) tags.push(`COMBO x${this.combo}`);
      const syn = SYNERGY[h.key + " " + tok.key];
      if (syn) { mult *= syn; tags.push("SIGNATURE MOVE"); }
      if (this.caffeine > 0) { mult *= 1.5; this.caffeine--; tags.push("CAFFEINATED"); }
      if (h.key === "segfault") { const r = this.rng() * 3; mult *= r; tags.push(r < 0.5 ? "CORE DUMPED" : "UNSTABLE"); }
      const miss = h.key === "wifi" && this.rng() < 0.4;
      if (!miss && this.rng() < 0.1) { mult *= 2; tags.push("CRIT"); }

      const dmg = [];
      for (let k = 0; k < h.hits; k++) {
        let d = miss ? 0 : Math.round(base * mult * (h.hits > 1 ? 0.75 : 1) * (0.85 + this.rng() * 0.3));
        if (h.nul) {
          if (this.rng() < 0.15) { d = 999; tags.push("UNDEFINED BEHAVIOUR"); } else d = 0;
        }
        dmg.push(d);
        this.hurtBoss(d);
      }
      if (miss) tags.push("WIFI DROPPED");
      if (h.nul && dmg.every((d) => d === 0)) tags.push("RETURNED NULL");
      const tot = dmg.reduce((a, b) => a + b, 0);
      if (tot > this.best.dmg) this.best = { dmg: tot, text: `${h.name} ${tok.text}` };

      ev.push({ type: "attack", hero: h, verb: tok.kind === "ult" ? "stack overflow" : tok.key, dmg, tags });
      const say = tok.kind === "ult" ? "drops a STACK OVERFLOW on" : VERB_SAY[tok.key];
      this.log(`${h.name} ${say} THE DEADLINE: ${tot}${tags.length ? "  [" + tags.join(", ") + "]" : ""}`, tok.kind === "ult" ? "legend" : "verb");
      if (tok.key === "conflict") this.hurtHero(h, 10, ev);
    }
  }

  const HERO_KEYS = ["duck", "goose", "bug", "feature", "oculus", "compsoc", "marshall", "wace", "brevan", "howard", "bloomberg", "netcraft", "incident", "io", "prod", "segfault", "pointer", "stack", "semicolon", "demo", "prize", "wifi", "rubber duck", "marshall wace", "brevan howard", "capital one", "incident io", "null pointer"];
  const Engine = { Battle, tokenize, KIND_LABEL, BOSS_HP, HERO_KEYS, SYNERGY, FUSIONS, PARTY_FUSIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
