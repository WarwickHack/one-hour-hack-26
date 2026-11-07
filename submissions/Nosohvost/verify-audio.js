const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let started=0, stopped=0, nodes=[];
const param = () => ({value:0,setValueAtTime(v){assert.ok(Number.isFinite(v));},linearRampToValueAtTime(v){assert.ok(Number.isFinite(v));},exponentialRampToValueAtTime(v){assert.ok(v>0);}});
function node(kind) {const n={kind,gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};nodes.push(n);return n;}
class AudioContext {
  constructor(){this.state='suspended';this.sampleRate=44100;this.currentTime=0;this.destination={};}
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return node('gain');}
  createDynamicsCompressor(){return {connect(){},threshold:param(),knee:param(),ratio:param()};}
  createBuffer(){return {getChannelData:()=>new Float32Array(44100)};}
  createBufferSource(){return node('sample');}
  createBiquadFilter(){return node('filter');}
  createOscillator(){return node('tone');}
  decodeAudioData(){return Promise.resolve({duration:1});}
}
const scope=vm.createContext({window:{AudioContext},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(10)})});
vm.runInContext(fs.readFileSync(__dirname+'/public/audio.js','utf8'),scope);
(async()=>{
  await vm.runInContext('Sound.unlock()',scope);
  await new Promise(r=>setImmediate(r));
  await vm.runInContext('Sound.quack()',scope);
  assert.ok(started>0,'Opening quack did not play');
  const cues=['honk','whack','push','merge','conflict','crash','hack','commit','deploy','pitch','overflow','stack overflow','block','impact','critical','miss','boss','join','legend','leave','die','heal','coffee','sleep','adj','void','step','tick','win','lose'];
  for(const cue of cues){vm.runInContext('Sound.stopAll()',scope);const before=started;vm.runInContext(`Sound.cue(${JSON.stringify(cue)})`,scope);assert.ok(started>before,`Silent cue ${cue}`);}
  vm.runInContext('Sound.setEnabled(false)',scope);const before=started;
  vm.runInContext('Sound.cue("whack"); Sound.quack()',scope);assert.equal(started,before,'Mute failed');
  vm.runInContext('Sound.setEnabled(true);Sound.setVolume(0);Sound.cue("hack")',scope);assert.equal(started,before,'Volume zero failed');
  vm.runInContext('Sound.setVolume(.55);Sound.cue("deploy");Sound.pause(true)',scope);assert.ok(stopped>0,'Pause did not stop active sounds');
  console.log('PASS: opening sample, all 30 synthesized cues, mute, volume and pause cancellation.');
})().catch(err=>{console.error(err);process.exitCode=1;});
