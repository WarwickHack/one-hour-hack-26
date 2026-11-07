const assert=require('node:assert/strict');
const {Battle}=require('./public/engine.js');
for(const [a,b,key] of [['marshall','wace','marshall wace'],['wace','marshall','marshall wace'],['brevan','howard','brevan howard'],['howard','brevan','brevan howard'],['incident','io','incident io'],['io','incident','incident io']]){
  const battle=new Battle([a,'duck','pizza',b],()=>.5);
  while(!battle.done)battle.step();
  assert.equal(battle.alive().filter(h=>h.key===key).length,1);
  assert.ok(!battle.alive().some(h=>h.key===a||h.key===b));
  assert.ok(battle.alive().some(h=>h.key==='duck'),'Fusion removed an unrelated hero');
}
for(const words of [['capital','coffee','one'],['one','coffee','capital']]){
  const b=new Battle(words,()=>.5);while(!b.done)b.step();
  assert.ok(b.alive().some(h=>h.key==='capital one'));
}
const full=new Battle(['marshall','duck','goose','bug','feature','demo','prize','wifi','wace'],()=>.5);
while(!full.done)full.step();
assert.ok(full.alive().some(h=>h.key==='marshall wace'),'Full party failed to fuse');
assert.ok(full.alive().some(h=>h.key==='duck'),'Full party unnecessarily evicted a hero');
const dead=new Battle(['marshall','duck','pizza','wace'],()=>.5);dead.step();dead.slots[0].hp=0;while(!dead.done)dead.step();
assert.ok(!dead.alive().some(h=>h.key==='marshall wace'),'Dead heroes should not fuse');
console.log('PASS: separated/reversed sponsor pairs, full slots, unrelated recruits and dead partners.');
