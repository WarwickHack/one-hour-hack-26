// Short, original Web Audio effects plus the locally bundled duck-quack sample.
// All voices are tracked so restart, pause and mute affect scheduled notes too.
const Sound = (() => {
  let context, master, limiter, noiseBuffer, quackBuffer, sampleLoad;
  let enabled = true, volume = 0.55, generation = 0;
  const voices = new Set();
  const lastCue = new Map();
  function init() {
    if (context) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context = new Audio();
    master = context.createGain(); master.gain.value = volume;
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -15; limiter.knee.value = 12; limiter.ratio.value = 8;
    master.connect(limiter); limiter.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    sampleLoad = fetch('audio/quack.mp3?v=quack5', {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error('Quack sample missing');
      return r.arrayBuffer();
    }).then(b => context.decodeAudioData(b)).then(b => { quackBuffer = b; }).catch(() => {});
  }
  async function unlock() {
    try { init(); if (context?.state === 'suspended') await context.resume(); } catch { /* Silent play still works. */ }
  }
  function active() { return enabled && context?.state === 'running' && volume > 0; }
  function track(source, gain, filter) {
    // A bound on simultaneous voices keeps 10× playback comfortable.
    if (voices.size >= 24) { const old = voices.values().next().value; old.stop(); }
    const voice = { stop() { try { source.stop(); } catch {} source.disconnect(); gain.disconnect(); filter?.disconnect(); voices.delete(voice); } };
    voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); filter?.disconnect(); voices.delete(voice); };
    return voice;
  }
  function tone(freq, end = freq, duration = .12, amplitude = .11, type = 'sine', delay = 0) {
    if (!active()) return;
    const t = context.currentTime + delay;
    const source = context.createOscillator(), gain = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(freq, t);
    source.frequency.exponentialRampToValueAtTime(Math.max(20,end), t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(amplitude, t + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(gain); gain.connect(master); track(source,gain);
    source.start(t); source.stop(t + duration + .01);
  }
  function noise(duration = .12, amplitude = .13, frequency = 1200, delay = 0, end = frequency) {
    if (!active()) return;
    const t = context.currentTime + delay;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noiseBuffer; filter.type = 'bandpass'; filter.Q.value = .8;
    filter.frequency.setValueAtTime(frequency,t); filter.frequency.exponentialRampToValueAtTime(Math.max(40,end),t+duration);
    gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(amplitude,t+.004);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(filter); filter.connect(gain); gain.connect(master); track(source,gain,filter);
    source.start(t); source.stop(t+duration+.01);
  }
  function notes(list, spacing = .09, type = 'triangle', amplitude = .10) {
    list.forEach((f,i) => tone(f,f,.18,amplitude,type,i*spacing));
  }
  function fallbackQuack() {
    tone(420,180,.22,.14,'sawtooth'); tone(650,340,.16,.07,'triangle'); noise(.16,.08,1200);
  }
  async function quack() {
    if (!active()) return;
    const current = generation;
    if (!quackBuffer) await sampleLoad;
    if (current !== generation || !active()) return;
    if (!quackBuffer) { fallbackQuack(); return; }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = quackBuffer; gain.gain.value = .65;
    source.connect(gain); gain.connect(master); track(source,gain);
    source.start();
  }
  function cue(name) {
    if (!active()) return;
    const now = context.currentTime;
    if (now - (lastCue.get(name) ?? -Infinity) < (name === 'step' ? .12 : .035)) return;
    lastCue.set(name,now);
    switch (name) {
      case 'quack': quack(); break;
      case 'honk': tone(160,130,.28,.15,'sawtooth'); tone(241,198,.26,.06,'square'); break;
      case 'whack': noise(.09,.3,1000); tone(170,45,.15,.24,'triangle'); break;
      case 'push': noise(.2,.17,600,0,2200); tone(100,65,.15,.12); break;
      case 'merge': notes([220,277,330],.035); break;
      case 'conflict': notes([185,196,155],.065,'sawtooth',.07); break;
      case 'crash': noise(.33,.22,2400,0,100); notes([600,275,70],.07,'sawtooth',.1); break;
      case 'hack': notes([900,1300,700,1600],.035,'square',.035); noise(.12,.04,5000); break;
      case 'commit': notes([523,659,784],.065); break;
      case 'deploy': noise(.33,.2,300,0,3500); tone(120,780,.3,.1,'sawtooth'); break;
      case 'pitch': tone(330,1000,.23,.12,'triangle'); noise(.1,.05,3000); break;
      case 'overflow': tone(260,780,.3,.12); tone(266,788,.28,.06); break;
      case 'stack overflow': notes([200,260,330,420,530],.04,'square',.04); noise(.25,.16,650,.15); break;
      case 'block': tone(140,60,.08,.15,'triangle'); noise(.07,.1,400); break;
      case 'impact': tone(110,45,.10,.13); noise(.08,.1,900); break;
      case 'critical': notes([880,1320],.04,'triangle',.13); noise(.12,.16,2000); break;
      case 'miss': tone(220,100,.18,.06,'triangle'); break;
      case 'boss': noise(.24,.22,2400,0,250); tone(85,40,.28,.17,'sawtooth'); break;
      case 'join': notes([330,440],.08,'triangle',.075); break;
      case 'legend': notes([392,494,587,784],.075); break;
      case 'leave': tone(330,180,.15,.06,'triangle'); break;
      case 'die': notes([330,247,165],.09,'triangle',.09); noise(.17,.05,700); break;
      case 'heal': notes([523,659,784],.09,'sine',.09); break;
      case 'coffee': noise(.15,.06,4000); notes([440,660,880,1100],.055,'triangle',.08); break;
      case 'sleep': tone(220,165,.4,.07); tone(330,247,.4,.035); break;
      case 'adj': notes([440,554],.05,'sine',.06); break;
      case 'void': tone(150,75,.22,.06); break;
      case 'step': noise(.035,.025,300); break;
      case 'tick': tone(1600,1100,.025,.025,'triangle'); break;
      case 'win': notes([523,659,784,1047],.13,'triangle',.12); break;
      case 'lose': notes([330,311,247,165],.16,'triangle',.12); break;
    }
  }
  function stopAll() { generation++; for (const voice of [...voices]) voice.stop(); lastCue.clear(); }
  function setEnabled(value) { enabled = value; if (!enabled) stopAll(); if(master) master.gain.value = enabled ? volume : 0; }
  function setVolume(value) { volume = Math.max(0,Math.min(1,Number(value)||0)); if(master) master.gain.value = enabled ? volume : 0; }
  function pause(value) { if(value) stopAll(); }
  return {unlock,quack,cue,stopAll,setEnabled,setVolume,pause};
})();
