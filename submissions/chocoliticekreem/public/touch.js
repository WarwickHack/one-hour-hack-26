(function () {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

  function send(type, key) {
    window.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true }));
  }

  var css = document.createElement('style');
  css.textContent = [
    '.hint, #whack-btn { display: none !important; }',
    '.tc-ctl { position: fixed; z-index: 5; bottom: 24px; touch-action: none;',
    '  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;',
    '  -webkit-tap-highlight-color: transparent; }',
    '#tc-joy { left: 24px; width: 120px; height: 120px; border-radius: 50%;',
    '  background: rgba(15,20,52,.55); border: 1px solid rgba(255,255,255,.18);',
    '  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }',
    '#tc-knob { position: absolute; left: 35px; top: 35px; width: 50px; height: 50px;',
    '  border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);',
    '  pointer-events: none; }',
    '#tc-whack { right: 24px; width: 88px; height: 88px; border-radius: 50%; border: 0;',
    '  background: linear-gradient(135deg, #ff8f7e, #ff5e4d); color: #fff;',
    '  font: 800 16px/1 system-ui, sans-serif; letter-spacing: .04em;',
    '  box-shadow: 0 4px 14px rgba(255,94,77,.45); }',
    '#tc-whack:active { transform: scale(.94); }',
    '#tc-play { left: 50%; transform: translateX(-50%); padding: 12px 28px;',
    '  border-radius: 999px; border: 0; background: #fff; color: #0f1434;',
    '  font: 800 16px/1 system-ui, sans-serif; letter-spacing: .06em; }',
    '#tc-play[hidden] { display: none; }'
  ].join('\n');
  document.head.appendChild(css);

  var joy = document.createElement('div');
  joy.id = 'tc-joy';
  joy.className = 'tc-ctl';
  var knob = document.createElement('div');
  knob.id = 'tc-knob';
  joy.appendChild(knob);

  var whack = document.createElement('button');
  whack.id = 'tc-whack';
  whack.className = 'tc-ctl';
  whack.type = 'button';
  whack.textContent = 'WHACK';

  var play = document.createElement('button');
  play.id = 'tc-play';
  play.className = 'tc-ctl';
  play.type = 'button';
  play.textContent = 'PLAY';
  play.hidden = true;

  document.body.appendChild(joy);
  document.body.appendChild(whack);
  document.body.appendChild(play);

  var DEAD = 18;
  var MAX = 35;
  var down = {};
  var activeId = null;

  function setKeys(want) {
    ['w', 'a', 's', 'd'].forEach(function (k) {
      if (want[k] && !down[k]) { down[k] = true; send('keydown', k); }
      else if (!want[k] && down[k]) { down[k] = false; send('keyup', k); }
    });
  }

  function update(ev) {
    var r = joy.getBoundingClientRect();
    var dx = ev.clientX - (r.left + r.width / 2);
    var dy = ev.clientY - (r.top + r.height / 2);
    var dist = Math.hypot(dx, dy);
    var kx = dx, ky = dy;
    if (dist > MAX) { kx = dx / dist * MAX; ky = dy / dist * MAX; }
    knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
    setKeys({ w: dy < -DEAD, s: dy > DEAD, a: dx < -DEAD, d: dx > DEAD });
  }

  function release() {
    activeId = null;
    knob.style.transform = '';
    setKeys({});
  }

  joy.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    activeId = ev.pointerId;
    try { joy.setPointerCapture(ev.pointerId); } catch (e) { /* capture unsupported */ }
    update(ev);
  });
  joy.addEventListener('pointermove', function (ev) {
    if (ev.pointerId === activeId) update(ev);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
    joy.addEventListener(t, function (ev) {
      if (ev.pointerId === activeId) release();
    });
  });

  whack.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    send('keydown', ' ');
    send('keyup', ' ');
  });

  play.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    send('keydown', 'Enter');
  });

  setInterval(function () {
    var b = document.getElementById('banner');
    play.hidden = !(b && !b.hidden && !b.classList.contains('spectate'));
  }, 300);
})();
