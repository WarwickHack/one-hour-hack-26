// Generates a separate review page and an inline chat preview from the real renderer.
// The game sprite files and boss drawing are never replaced by proposed artwork.
const fs = require('node:fs');
const path = require('node:path');
const base = __dirname, pub = path.join(base,'public');
const Engine = require('./public/engine.js');
const asset = p => 'data:image/svg+xml;base64,'+fs.readFileSync(p).toString('base64');
const sprites = Object.fromEntries(Engine.HERO_KEYS.map(k=>[k,asset(path.join(pub,'sprites',k.replace(/ /g,'-')+'.svg'))]));
let renderer = fs.readFileSync(path.join(pub,'game.js'),'utf8').split('// ---------- loop & input ----------')[0];
renderer = renderer.replace('const cv = document.getElementById("c");','');
renderer = renderer.replace('const actionLabel = document.getElementById("action-label");','const actionLabel = {textContent: ""};');
const start = renderer.indexOf('async function newBattle()');
const end = renderer.indexOf('// ---------- effects ----------');
renderer = renderer.slice(0,start)+renderer.slice(end);
renderer = renderer.replace('img.src = `sprites/${k.replace(/ /g, "-")}.svg`;','img.src = reviewAssets[k];');
const attacks = ['whack','hack','quack','honk','deploy','merge','commit','push','overflow','pitch','conflict','stack overflow','crash','boss'];
const others = ['heal','coffee','sleep','backfire','die','join'];
const cards = (keys,type) => keys.map(k=>`<figure class="review-card"><canvas width="${['hero','modifier'].includes(type)?240:640}" height="${['hero','modifier'].includes(type)?240:360}" data-kind="${type}" data-key="${k}" aria-label="Looping ${k} ${type} preview"></canvas><figcaption>${k.toUpperCase()}</figcaption></figure>`).join('\n');
const alts = ['duck','goose','bug','prod','segfault','rubber duck'];
const compare = alts.map(k=>{
 const filename=k.replace(/ /g,'-')+'-alt.svg', p=path.join(pub,'review/art',filename);
 const next=fs.existsSync(p)?asset(p):sprites[k];
 return `<figure class="compare-card"><figcaption>${k.toUpperCase()}</figcaption><div class="pair"><div><img src="${sprites[k]}" alt="${k}, current Claude art"><span>Claude · current</span></div><div><img src="${next}" alt="${k}, proposed Sol art"><span>Sol · proposed</span></div></div></figure>`;
}).join('\n');
const bossFiles=[['deadline-current.svg','Current · The Deadline'],['deadline-alt.svg','Option A · The Deadline, redrawn'],['scope-creep.svg','Option B · Scope Creep']];
const bosses=bossFiles.filter(([f])=>fs.existsSync(path.join(pub,'review/art',f))).map(([f,label])=>`<figure class="boss-card"><img src="${asset(path.join(pub,'review/art',f))}" alt="${label}"><figcaption>${label}</figcaption></figure>`).join('\n');
const css = `#whack-review{font-family:Consolas,monospace;color:#f3eefc;background:#100c20;padding:20px;border-radius:14px;line-height:1.5}#whack-review *{box-sizing:border-box}#whack-review h2{font-size:23px;margin:28px 0 14px;color:#ffd36b}#whack-review h1{font-size:26px;margin:0}#whack-review p{font-size:12px;color:#bbb0d0}#whack-review button{background:#ffd36b;border:0;border-radius:6px;padding:9px 15px;color:#20172c;font:700 12px Consolas;cursor:pointer}#whack-review .review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:12px}#whack-review .hero-grid{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}#whack-review figure{margin:0;background:#1c1530;border:1px solid #3a2a50;border-radius:10px;overflow:hidden}#whack-review canvas{width:100%;height:auto;display:block}#whack-review figcaption{padding:9px 12px;font-size:12px;color:#e9d8b1;text-align:center}#whack-review .hero-grid canvas{max-height:190px;object-fit:contain}#whack-review .pair{display:grid;grid-template-columns:1fr 1fr;padding:8px 10px 14px;gap:10px}#whack-review .pair div{text-align:center}#whack-review .pair img{width:100%;height:140px}#whack-review .pair span{display:block;font-size:11px;color:#bcb0cf}#whack-review .boss-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}#whack-review .boss-card img{width:100%;height:240px}#whack-review .small{font-size:10px;color:#9c8fb5}`;
const runtime = `(() => {
const root = document.getElementById('whack-review');
const reviewAssets = ${JSON.stringify(sprites)};
const Engine = (()=>{const module={exports:{}};${fs.readFileSync(path.join(pub,'engine.js'),'utf8')};return module.exports;})();
const Sound = {cue(){},quack(){},pause(){}};
function makePreview(cv,mode,key){
${renderer}
const heroMode=mode==='hero'||mode==='modifier';
let elapsed=0, fired=false;
function reset(){
  elapsed=0;fired=false;vis=new Map();fx=[];scheduled=[];bossShown=850;shake=0;bossFlash=0;
  battle=new Engine.Battle(['duck']);phase='ready';
  const kind=key==='null pointer'?'crash':key.includes(' ')?'legend':'noun';
  const hero=battle.makeHero({key:mode==='hero'?key:'duck',text:mode==='hero'?key.toUpperCase():'DUCK',kind:mode==='hero'?kind:'noun'},mode==='modifier'?[key]:[]);
  hero.slot=0; if(!heroMode)hero.scale=1.5;
  const v={h:hero,x:heroMode?80:490,y:heroMode?116:520,homeX:heroMode?80:490,homeY:heroMode?116:520,walkT:0,facing:1,flash:0,dead:false,moving:false,anim:null,leaving:false,born:0};
  vis.set(hero.id,v);return v;
}
let v=reset();
return function tick(dt){
  elapsed+=dt;
  if(elapsed>3.4){v=reset();}
  if(!heroMode&&!fired&&elapsed>.45){
    fired=true;
    if(mode==='attack'){
      if(key==='boss')handleEvent({type:'bossAttack',hero:v.h,dmg:30,enraged:false});
      else attack({hero:v.h,verb:key,dmg:[75],tags:[]});
    } else {
      if(key==='heal')handleEvent({type:'healAll',amount:30});
      if(key==='coffee')handleEvent({type:'coffee'});
      if(key==='sleep')handleEvent({type:'sleep',hero:v.h,amount:40});
      if(key==='backfire')handleEvent({type:'backfire'});
      if(key==='die')handleEvent({type:'die',hero:v.h});
      if(key==='join'){v.x=-80;}
    }
  }
  update(dt);
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  if(heroMode){
    v.moving=true;v.walkT+=dt;ctx.scale(1.5,1.5);drawHero(v);
  }else{
    ctx.scale(.5,.5);ctx.drawImage(bg,0,0);drawBoss();drawHero(v);drawFx();
  }
};
}
let running=true;
const previews=new Map();
root.querySelectorAll('canvas').forEach(cv=>previews.set(cv,{tick:makePreview(cv,cv.dataset.kind,cv.dataset.key),visible:false}));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>previews.get(e.target).visible=e.isIntersecting),{rootMargin:'100px'});
previews.forEach((v,cv)=>observer.observe(cv));
root.querySelector('[data-pause]').addEventListener('click',e=>{running=!running;e.target.textContent=running?'Pause loops':'Resume loops';});
let previous=performance.now();
function frame(now){const dt=Math.min(.04,(now-previous)/1000);previous=now;if(running)previews.forEach(p=>{if(p.visible)p.tick(dt)});requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();`;
const fragment=`<div id="whack-review"><style>${css}</style><h1>Grammar vs The Deadline · Visual review</h1><p>Every card loops independently. Attack previews use the actual game renderer. The proposed artwork below is review-only.</p><button data-pause>Pause loops</button><h2>Every attack</h2><div class="review-grid">${cards(attacks,'attack')}</div><h2>Healing, items and other events</h2><div class="review-grid">${cards(others,'event')}</div><h2>Every animated recruit</h2><div class="review-grid hero-grid">${cards(Engine.HERO_KEYS,'hero')}</div><h2>Adjective modifiers</h2><div class="review-grid hero-grid">${cards(['midnight','capital','rubber','null','one','warwick'],'modifier')}</div><h2>Claude → Sol · proposed alternatives</h2><p>Current art on the left, proposed art on the right. None of these options has replaced an in-game sprite.</p><div class="review-grid">${compare}</div><h2>Boss choices</h2><div class="boss-grid">${bosses}</div><p class="small">Option A retains the clock boss and its rules. Option B proposes a Scope Creep boss whose growing requests visually replace the countdown; it is a concept, not an implemented rule change.</p><script>${runtime}</script></div>\n`;
fs.writeFileSync(path.join(pub,'review.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WHACK visual review</title></head><body style="margin:0;background:#100c20">'+fragment+'</body></html>');
const inlineFlag=process.argv.indexOf('--inline-dir');
if(inlineFlag>=0){
  const inlineDir=process.argv[inlineFlag+1];
  if(!inlineDir)throw new Error('--inline-dir needs an output directory');
  fs.mkdirSync(inlineDir,{recursive:true});
  fs.writeFileSync(path.join(inlineDir,'whack-visual-review.html'),fragment);
}
console.log('Built review:',Buffer.byteLength(fragment),'bytes.');
