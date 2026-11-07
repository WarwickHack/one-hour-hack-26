// Runs the real renderer/update loop against a minimal canvas host.
// Checks completion, animation sequencing and speed-invariant combat outcomes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Engine = require('./public/engine.js');
const source = fs.readFileSync(__dirname + '/public/game.js', 'utf8');
async function run(words, speed) {
  let seed = 21, now = 0, frame;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32);
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({}, { get: (_, k) => k.startsWith('create') ? () => gradient : noop, set: () => true });
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener: noop, setAttribute: noop, getContext: () => ctx });
    return elements.get(id);
  };
  const scope = vm.createContext({
    Engine: {...Engine, Battle: class extends Engine.Battle {constructor(words){super(words,rng);}}},
    document: {getElementById: el, createElement: () => el('background'), querySelectorAll: () => []},
    Image: class {set src(v){this.onload?.();}},
    fetch: async () => ({json: async () => words}),
    performance: {now: () => now}, addEventListener: noop,
    requestAnimationFrame: fn => {frame = fn;},
    window: {},
  });
  vm.runInContext(fs.readFileSync(__dirname + '/public/audio.js','utf8'),scope);
  vm.runInContext(source, scope);
  // A fifth-token recruit is hit by the boss in the same computed step.
  // It must still enter at full displayed HP, then lose HP on the shown hit.
  vm.runInContext(`{
    const b = new Engine.Battle(['whack','hack','honk','push','duck']);
    for(let i=0;i<4;i++)b.step();
    const events=b.step(), join=events.find(e=>e.type==='join'), hit=events.find(e=>e.type==='bossAttack');
    handleEvent(join);
    if(vis.get(join.hero.id).hp!==join.hero.maxHp)throw new Error('Spawned with future damage');
    handleEvent(hit);
    if(vis.get(join.hero.id).hp!==join.hero.maxHp-hit.dmg)throw new Error('Visible boss hit did not reduce health');
    events.filter(e=>e.type==='health').forEach(handleEvent);
    if(vis.get(join.hero.id).hp!==join.hero.hp)throw new Error('Displayed health drifted');
  }`,scope);
  vm.runInContext('newBattle()',scope);
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext(`speed = ${speed}`, scope);
  let frames = 0;
  while(vm.runInContext('phase !== "end"', scope) && frames++ < 100000) {
    const before = vm.runInContext('battle.i', scope);
    const wasBusy = vm.runInContext('Boolean(busy())', scope);
    now += 1000/60; frame(now);
    const after = vm.runInContext('battle.i', scope);
    if (wasBusy) assert.equal(after,before,'A new word started before movement/attacks finished');
  }
  assert.ok(frames < 100000, 'Battle stalled');
  assert.equal(vm.runInContext('eventQueue.length + scheduled.length',scope),0,'Unfinished actions at end');
  const result = vm.runInContext('JSON.stringify({hp:battle.bossHp,dmg:battle.totalDmg,won:battle.won,recruited:battle.recruited,shown:bossShown})',scope);
  vm.runInContext('newBattle()',scope);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(vm.runInContext('scheduled.length + eventQueue.length + fx.length + vis.size',scope),0,'Old battle leaked into restart');
  return { result, seconds:now/1000 };
}
(async () => {
  for(const key of Engine.HERO_KEYS) assert.ok(fs.existsSync(__dirname+'/public/sprites/'+key.replace(/ /g,'-')+'.svg'),'Missing '+key);
  const fixtures = [
    ['rubber','midnight','bug','hack','hack','coffee','stack','overflow','pizza','null','pointer'],
    ['duck','quack','quack','goose','honk','prod','deploy','merge','conflict'],
    ['whack','null','pointer'],
    ['feature','oculus','compsoc','marshall','wace','brevan','howard','bloomberg','netcraft','incident','io','pointer','stack','semicolon','demo','prize','wifi','sleep','push'],
  ];
  for(const words of fixtures) {
    const runs=[];
    for(const speed of [.5,1,2,4,10]) runs.push(await run(words,speed));
    for(const r of runs) assert.equal(r.result,runs[0].result,'Speed changed outcome');
    // Frame boundaries introduce small rounding differences across long lists.
    assert.ok(Math.abs(runs[0].seconds/runs[4].seconds/20-1)<.035,'Speed ratio is wrong');
    console.log('PASS speeds 0.5/1/2/4/10:',runs.map(r=>r.seconds.toFixed(1)+'s').join(' / '));
  }
  console.log('PASS: all 28 sprites present; no interrupted actions, stalled battles or restart leaks.');
})().catch(err=>{console.error(err);process.exitCode=1;});
