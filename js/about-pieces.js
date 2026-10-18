// The About page's loose pieces (see ".board-piece" in style.css): the two that move by script, as
// on the Yuki page (js/tall-machine.js), the waving hand and the cube's eyes. The cloud and the
// pinwheel move by style.css alone.
//
// The hand waves gently, and clicked, waves faster and wider for a few seconds, easing into it
// and back out of it (its swing kept as a running phase, so changing its speed never makes it
// jump). Only the hand itself can be clicked, not the clear corners of its picture; over it the
// cursor's circle grows, as over a link (js/cursor.js). The cube's pupils look as far as they
// can to the side the cursor is on, and come back to the middle as it comes over them, easing
// a little as they go; with no cursor (a touch screen) they look straight ahead.
//
// It only runs while the pieces are in view.
(function () {
  const pieces = document.querySelector('.pieces');
  if (!pieces) return;
  const hand = pieces.querySelector('.hand');
  const handBody = hand.querySelector('.board-piece-body');
  const handShadow = hand.querySelector('.board-piece-shadow');
  const pupils = [...pieces.querySelectorAll('.pupil')].map((pupil) => ({ pupil, ox: 0, oy: 0 }));
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  const WAVE = { speed: 2.4, swing: 0.12 }; // as it idles (radians a second; radians)
  const EAGER = { speed: 14, swing: 0.36, time: 2.6, into: 0.15, outOf: 0.7 }; // clicked
  let t = 0;
  let eagerFrom = -Infinity;
  let phase = 0;
  let angle = 0;
  function eagerness() {
    const since = t - eagerFrom;
    if (since < 0 || since > EAGER.time) return 0;
    const k = Math.min(since / EAGER.into, 1, (EAGER.time - since) / EAGER.outOf);
    return k * k * (3 - 2 * k);
  }

  // A scene unit in pixels, as style.css sizes the pieces (--u).
  const unit = () => (handBody.offsetWidth / handBody.naturalWidth || 0) * 256;

  // ---------------------------------------------------------------- the hand's outline

  // Whether a point in the window is on the hand: its picture's own pixels, read once, at the
  // point turned back by the hand's swing.
  let alpha = null;
  function readAlpha() {
    const canvas = document.createElement('canvas');
    canvas.width = handBody.naturalWidth;
    canvas.height = handBody.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(handBody, 0, 0);
    try {
      alpha = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (err) {
      alpha = null; // (opened from a file: the picture can't be read, so its whole box counts)
    }
  }
  if (handBody.complete) readAlpha();
  else handBody.addEventListener('load', readAlpha);

  function onHand(x, y) {
    const box = hand.getBoundingClientRect(); // (the pivot: the piece itself has no size)
    const scale = handBody.offsetWidth / handBody.naturalWidth;
    // turned back by the swing (the picture is turned by -angle on screen)
    const dx = x - box.left;
    const dy = y - box.top;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const lx = (dx * c - dy * s) / scale + 175;
    const ly = (dx * s + dy * c) / scale + 444;
    if (lx < 0 || ly < 0 || lx >= handBody.naturalWidth || ly >= handBody.naturalHeight) return false;
    if (!alpha) return true;
    return alpha.data[(Math.floor(ly) * alpha.width + Math.floor(lx)) * 4 + 3] > 40;
  }

  handBody.addEventListener('pointermove', (event) => {
    const over = onHand(event.clientX, event.clientY);
    handBody.classList.toggle('hovering-clickable', over);
    handBody.style.cursor = over ? 'pointer' : '';
  });
  handBody.addEventListener('pointerleave', () => {
    handBody.classList.remove('hovering-clickable');
    handBody.style.cursor = '';
  });
  handBody.addEventListener('click', (event) => {
    if (!onHand(event.clientX, event.clientY)) return;
    // (clicked again while it waves, it carries on, from just into it)
    eagerFrom = eagerness() > 0 ? t - EAGER.into : t;
  });

  // ---------------------------------------------------------------- the eyes

  let cursor = null; // { x, y } in the window, or null
  window.addEventListener('site-pointer', ({ detail }) => {
    if (detail.touch) return;
    if (detail.type === 'move') cursor = { x: detail.x, y: detail.y };
    else if (detail.type === 'leave') cursor = null;
  });

  // ---------------------------------------------------------------- the words' place

  // The pieces by the words stand clear of them (see ".pieces" in style.css), so where the
  // words are goes on the pieces' layer: their left and right, the heading's foot, the top of
  // the paragraphs and the foot of the last. Measured again whenever they could have moved.
  const heading = document.querySelector('.hero-name');
  const paragraphs = [...document.querySelectorAll('.hero-text')];
  function measure() {
    if (!heading || !paragraphs.length) return;
    const layer = pieces.getBoundingClientRect();
    const head = heading.getBoundingClientRect();
    const first = paragraphs[0].getBoundingClientRect();
    const last = paragraphs[paragraphs.length - 1].getBoundingClientRect();
    const set = (name, px) => pieces.style.setProperty(name, px.toFixed(1) + 'px');
    set('--words-left', head.left - layer.left);
    set('--words-right', head.right - layer.left);
    set('--heading-bottom', head.bottom - layer.top);
    set('--text-top', first.top - layer.top);
    set('--words-bottom', last.bottom - layer.top);
  }
  measure();
  window.addEventListener('resize', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.querySelector('.hero-block'));

  // ---------------------------------------------------------------- each frame

  let last = null;
  let frame = null;
  function tick(now) {
    frame = requestAnimationFrame(tick);
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt;

    // the hand (held still for a visitor who prefers less motion)
    const k = eagerness();
    phase += dt * (WAVE.speed + (EAGER.speed - WAVE.speed) * k);
    angle = still.matches ? 0 : (WAVE.swing + (EAGER.swing - WAVE.swing) * k) * Math.sin(phase);
    const turn = `rotate(${(-angle).toFixed(4)}rad)`;
    handBody.style.transform = turn;
    handShadow.style.transform = turn;

    // the eyes
    const u = unit();
    const ease = 1 - Math.exp(-14 * dt);
    for (const eye of pupils) {
      let tx = 0;
      let ty = 0;
      if (cursor && u) {
        const box = eye.pupil.getBoundingClientRect();
        const dx = (cursor.x - (box.left + box.width / 2 - eye.ox * u)) / u;
        const dy = -(cursor.y - (box.top + box.height / 2 + eye.oy * u)) / u;
        const d = Math.hypot(dx, dy);
        const reach = d > 0 ? Math.min(0.09, d * 0.25) / d : 0;
        tx = dx * reach;
        ty = dy * reach;
      }
      eye.ox += (tx - eye.ox) * ease;
      eye.oy += (ty - eye.oy) * ease;
      eye.pupil.style.transform = `translate(${(eye.ox * u).toFixed(2)}px, ${(-eye.oy * u).toFixed(2)}px)`;
    }
  }

  function run(on) {
    if (on && frame === null) {
      last = null;
      frame = requestAnimationFrame(tick);
    } else if (!on && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      run(inView && !document.hidden);
    }).observe(pieces);
  }
  document.addEventListener('visibilitychange', () => run(inView && !document.hidden));
  run(true);
})();
