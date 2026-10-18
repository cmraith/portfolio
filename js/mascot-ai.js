// Tilde, the site's mascot, part 2: its mind. The body is drawn by js/mascot.js; this decides where
// it goes and what it does. Nothing here is scripted in advance: it keeps a few feelings
// (energy, trust, boredom), notices what is going on around it, and picks what to do next.
//
// Its character: curious, a bit jumpy, easily won over, and prone to naps.
//   - It glides about the window on its own, stopping to look around.
//   - A pointer that sits still makes it curious, and it comes over for a look.
//   - A pointer that rushes at it makes it bolt. The more it trusts you, the less it flinches.
//   - Click it and it is delighted, and trusts you more for the rest of the visit.
//   - Hover over the tilde sticker (its namesake) and it is pleased, and comes over to you.
//   - When the machine is running it hurries over to watch the ball.
//   - Now and then it perches on top of a container.
//   - It gets tired, wanders down to the bottom of the window and dozes until disturbed.
//     Wake it by barging in and it is cross with you for a moment.
//   - It changes how it looks whenever it likes: a new colour, new eyes and mouth,
//     picked from the wardrobe in js/mascot.js. Sometimes that is pure whim, and sometimes
//     it is how it feels (it tends to go pink when patted, pale after a fright, and a cool
//     colour for a nap). Its expression always follows its feelings.
// A little bubble over its head says what it is thinking: ! ? a heart, and z when asleep.
// It appears beside the name when the page loads.
(function (RG) {
  const mascot = RG && RG.mascot;
  if (!mascot) return;

  const SIZE = mascot.size; // the size of its head, in px, set in js/mascot.js
  const K = SIZE / 72; // distances below were tuned at 72px and scale with it
  const EDGE = 8; // how close to the window's edge it will go

  // Someone who asks for less motion gets a mascot that stays in its corner.
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- character

  const SPEED = { stroll: 85, curious: 150, hurry: 300, bolt: 460 }; // px per second
  const NOTICE = 150 * K; // how near a fast pointer must be to frighten it
  const FRIGHT_SPEED = 1100; // px per second: a pointer faster than this, nearby, is frightening
  const PERSONAL_SPACE = 95 * K; // how close it comes to something it is curious about
  const PET_REACH = 46 * K; // a click this close to its middle is a pat

  const feel = {
    energy: 0.9, // 1 fresh, 0 exhausted: falls as it moves about, recovers when resting
    trust: 0.15, // 0 wary, 1 devoted: grows each time it is patted
  };

  // ---------------------------------------------------------------- what it knows

  const me = { x: mascot.start.x, y: mascot.start.y, vx: 0, vy: 0 }; // it appears beside the name
  const goal = { x: me.x, y: me.y };
  const pointer = { x: 0, y: 0, speed: 0, seen: -Infinity, stillSince: 0, here: false };
  let now = 0; // seconds since it woke up
  let mood = 'idle';
  let moodSince = 0;
  let moodFor = 2; // how long it means to stay in this mood
  let speed = SPEED.stroll;
  let lastFright = -Infinity;
  let wiggle = 0; // a happy shimmy on the spot, counting down

  const random = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const far = (x, y) => Math.hypot(x - me.x, y - me.y);
  const bounds = () => ({
    left: EDGE + SIZE / 2,
    right: document.documentElement.clientWidth - EDGE - SIZE / 2, // not counting a scrollbar
    top: EDGE + SIZE / 2,
    bottom: window.innerHeight - EDGE - SIZE / 2,
  });

  function setMood(next, seconds) {
    mood = next;
    moodSince = now;
    moodFor = seconds;
  }

  function headFor(x, y, pace) {
    const b = bounds();
    goal.x = clamp(x, b.left, b.right);
    goal.y = clamp(y, b.top, b.bottom);
    speed = pace;
  }

  // ---------------------------------------------------------------- what it sees

  // Where the machine's ball is on screen while it is rolling, or null (also on pages
  // without a machine).
  function rollingBall() {
    const scene = RG.debug;
    if (!scene || scene.machine.waiting || !window.THREE) return null;
    const p = scene.machine.ball.position.clone().project(scene.camera);
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }

  const visiblePanel = () => document.querySelector('.panel.show');

  window.addEventListener('site-pointer', ({ detail }) => {
    if (detail.type === 'leave') {
      pointer.here = false;
      return;
    }
    const t = performance.now() / 1000;
    if (detail.type === 'move') {
      const dt = Math.max(t - pointer.seen, 0.001);
      const moved = Math.hypot(detail.x - pointer.x, detail.y - pointer.y);
      // A smoothed speed, so one twitchy reading doesn't count as a lunge.
      pointer.speed = pointer.here && dt < 0.25 ? pointer.speed * 0.6 + (moved / dt) * 0.4 : 0;
      if (moved > 3) pointer.stillSince = now;
      pointer.x = detail.x;
      pointer.y = detail.y;
      pointer.seen = t;
      pointer.here = true;
    } else if (detail.type === 'down' && far(detail.x, detail.y) < PET_REACH) {
      pat();
    }
  });

  // Hovering over the tilde sticker calls it over, for as long as the pointer stays there.
  const sticker = document.querySelector('.panel .sticker');
  const stickerArt = sticker && sticker.querySelector('svg');
  let called = false;
  if (sticker && !still) {
    sticker.addEventListener('pointerenter', () => {
      called = true;
      say('heart', 1.4);
      setMood('coming', 30);
    });
    sticker.addEventListener('pointerleave', () => { called = false; });
  }

  // While the sticker is hovered, the snake is drawn as if it were behind the sticker, so its
  // body can never hide it: the sticker's outline is cut out of the snake (see `cover` in
  // js/mascot.js). This eases in and out with the hover.
  const stickerShape = sticker && {
    path: new Path2D(sticker.querySelector('.edge').getAttribute('d')),
    width: parseFloat(getComputedStyle(sticker.querySelector('.edge')).strokeWidth),
  };
  let behind = 0; // 0 in front of the sticker as usual, 1 fully behind it
  function tuckBehindSticker(dt) {
    if (!sticker) return;
    behind += ((sticker.matches(':hover') ? 1 : 0) - behind) * (1 - Math.exp(-14 * dt));
    mascot.cover = behind > 0.01 ? { ...stickerShape, matrix: stickerArt.getScreenCTM(), amount: behind } : null;
  }

  // ---------------------------------------------------------------- what it says

  // Thoughts are shown in a little round bubble over its head.
  const SIGNS = { '!': '!', '?': '?', z: 'z', heart: '♥' };
  const SIGN_SIZE = Math.round(34 * K);
  const sign = document.createElement('canvas');
  sign.className = 'mascot-sign';
  sign.setAttribute('aria-hidden', 'true');
  const signRatio = Math.min(window.devicePixelRatio || 1, 2);
  sign.width = sign.height = SIGN_SIZE * signRatio;
  sign.style.width = sign.style.height = SIGN_SIZE + 'px';
  document.body.appendChild(sign);
  const signCtx = sign.getContext('2d');
  signCtx.scale(signRatio, signRatio);
  let signUntil = 0;

  function say(name, seconds = 1.3) {
    const middle = SIGN_SIZE / 2;
    signCtx.clearRect(0, 0, SIGN_SIZE, SIGN_SIZE);
    signCtx.fillStyle = '#ffffff';
    signCtx.beginPath();
    signCtx.arc(middle, middle, middle - 1, 0, Math.PI * 2);
    signCtx.fill();
    signCtx.fillStyle = name === 'heart' ? '#ff4f8a' : '#1c2b63';
    signCtx.font = `900 ${Math.round(SIGN_SIZE * 0.62)}px "Segoe UI", system-ui, sans-serif`;
    signCtx.textAlign = 'center';
    signCtx.textBaseline = 'middle';
    signCtx.fillText(SIGNS[name], middle, middle + SIGN_SIZE * 0.04);
    signUntil = now + seconds;
    sign.classList.add('show');
  }

  // ---------------------------------------------------------------- how it looks

  const wardrobe = mascot.wardrobe;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const pickOther = (list, ...taken) => pick(list.filter((item) => !taken.includes(item)));
  let nextWhim = random(6, 12); // when it will next fancy a change, in its own seconds
  let grumpyUntil = 0; // cross about being woken, until then

  // Puts together a whole new look. `colors`, if given, are the body colours it has in mind;
  // otherwise any will do. Features get colours that stand out from the head.
  function restyle(colors) {
    const current = mascot.look;
    const headColor = pickOther(colors || wardrobe.bodyColors, current.head);
    mascot.setLook({
      head: headColor,
      tail: pick(wardrobe.contrasting(headColor)), // a body colour well apart from the head's
      eyes: pick(wardrobe.eyes),
      mouth: pick(wardrobe.mouths),
      noseColor: pickOther(wardrobe.featureColors, headColor, 'white'),
      mouthColor: pickOther(wardrobe.featureColors, headColor),
    });
    nextWhim = now + random(8, 18);
  }

  // The expression that goes with how it feels right now.
  function expression() {
    if (now < grumpyUntil) return 'angry';
    if (mood === 'bolting') return 'scared';
    if (now - lastFright < 3.5) return 'nervous'; // still shaken
    if (mood === 'happy' || mood === 'coming') return 'happy';
    if (mood === 'curious') return 'curious';
    if (mood === 'watching') return 'surprised';
    if (mood === 'sleepy' || mood === 'asleep') return 'sleepy';
    if (mood === 'idle' && now - moodSince > 2.2) return 'bored'; // been standing about a while
    return 'content';
  }

  // ---------------------------------------------------------------- what it does

  function pat() {
    feel.trust = Math.min(1, feel.trust + 0.2);
    feel.energy = Math.min(1, feel.energy + 0.15);
    say('heart', 1.6);
    if (Math.random() < 0.6) restyle(['pink', 'hot']); // blushes
    wiggle = 1;
    headFor(me.x, me.y, SPEED.stroll);
    setMood('happy', 1.4);
  }

  function bolt() {
    lastFright = now;
    say('!', 0.9);
    if (Math.random() < 0.5) restyle(['sky', 'pink']); // goes pale
    // Straight away from the pointer, as far as it can get in a moment.
    const away = Math.atan2(me.y - pointer.y, me.x - pointer.x) + random(-0.5, 0.5);
    headFor(me.x + Math.cos(away) * 380, me.y + Math.sin(away) * 380, SPEED.bolt);
    setMood('bolting', 0.9);
  }

  function stroll() {
    const b = bounds();
    headFor(random(b.left, b.right), random(b.top, b.bottom), SPEED.stroll * random(0.8, 1.25));
    setMood('strolling', 12);
  }

  function perch(panel) {
    const box = panel.getBoundingClientRect();
    headFor(random(box.left + SIZE / 2, box.right - SIZE / 2), box.top - SIZE / 2 + 14 * K, SPEED.stroll * 1.2);
    setMood('perching', 14);
  }

  function goToBed() {
    const b = bounds();
    headFor(clamp(me.x + random(-160, 160), b.left, b.right), b.bottom, SPEED.stroll * 0.7);
    if (Math.random() < 0.7) restyle(['blue', 'sky', 'navy', 'green']); // something restful
    setMood('sleepy', 14);
  }

  // Called whenever it has nothing in hand: weighs up how it feels and picks something.
  function decide() {
    if (feel.energy < 0.22) return goToBed();
    const panel = visiblePanel();
    const pointerIsCalm = pointer.here && now - pointer.stillSince > 0.8;
    const roll = Math.random();
    if (pointerIsCalm && roll < 0.3 + feel.trust * 0.45) {
      say('?', 1.1);
      return setMood('curious', random(4, 8));
    }
    if (panel && roll > 0.72) return perch(panel);
    if (roll > 0.55) return setMood('idle', random(1.2, 3.5)); // just stands and looks about
    return stroll();
  }

  function think(dt) {
    const arrived = far(goal.x, goal.y) < 6;
    const moodAge = now - moodSince;
    const ball = rollingBall();

    // Reflexes come first, whatever it was doing.
    const jumpy = 1 - feel.trust * 0.8;
    if (
      pointer.here && mood !== 'bolting' && mood !== 'happy' && mood !== 'coming' && now - lastFright > 3
      && far(pointer.x, pointer.y) < NOTICE && pointer.speed > FRIGHT_SPEED / jumpy
    ) {
      return bolt();
    }
    if (ball && mood !== 'watching' && mood !== 'bolting' && mood !== 'happy' && mood !== 'coming') {
      say('!', 0.9);
      setMood('watching', 60);
    }

    // On a whim, while it is awake and nothing much is happening, it changes its look.
    if (now > nextWhim && (mood === 'idle' || mood === 'strolling' || mood === 'perching')) restyle();

    switch (mood) {
      case 'watching':
        if (!ball) return setMood('idle', random(1, 2));
        // Keeps up with the ball, a little above and to its left.
        headFor(ball.x - 80 * K, ball.y - 70 * K, SPEED.hurry);
        break;
      case 'coming': {
        // Called over by the sticker: hurries over and stays right beside the sticker, until
        // the pointer leaves the sticker (or the sticker's card goes away).
        const showing = sticker.closest('.panel').classList.contains('show');
        if (!called || !showing || !pointer.here || moodAge > moodFor) {
          called = false;
          return setMood('happy', 1.2); // lingers, still pleased, then goes back to its own business
        }
        // It stops at the nearest spot that leaves the whole sticker clear of its head; if it
        // happens to be on top of the sticker already, it gets off by the nearest side.
        const box = sticker.getBoundingClientRect();
        const clear = SIZE / 2 + 12 * K;
        const left = box.left - clear, right = box.right + clear;
        const top = box.top - clear, bottom = box.bottom + clear;
        let x = clamp(me.x, left, right);
        let y = clamp(me.y, top, bottom);
        if (me.x > left && me.x < right && me.y > top && me.y < bottom) {
          const out = [me.x - left, right - me.x, me.y - top, bottom - me.y];
          const side = out.indexOf(Math.min(...out));
          if (side === 0) x = left; else if (side === 1) x = right; else if (side === 2) y = top; else y = bottom;
        }
        headFor(x, y, SPEED.hurry);
        break;
      }
      case 'curious':
        if (!pointer.here || moodAge > moodFor) return decide();
        // Comes close, then hovers at a polite distance (closer the more it trusts you).
        if (far(pointer.x, pointer.y) > PERSONAL_SPACE * (1.25 - feel.trust * 0.5)) {
          headFor(pointer.x, pointer.y, SPEED.curious);
        } else {
          headFor(me.x, me.y, SPEED.curious);
        }
        break;
      case 'sleepy':
        if (arrived) {
          say('z', 1.6);
          setMood('asleep', random(9, 16));
        }
        break;
      case 'asleep':
        feel.energy = Math.min(1, feel.energy + dt * 0.09);
        if (Math.floor(moodAge / 2.6) !== Math.floor((moodAge - dt) / 2.6)) say('z', 1.6);
        // Woken by the pointer coming close (which annoys it), or by having slept enough.
        if (pointer.here && far(pointer.x, pointer.y) < 80 * K) {
          say('!', 0.8);
          grumpyUntil = now + 1.8;
          setMood('idle', random(1.8, 2.4));
        } else if (moodAge > moodFor) {
          restyle(); // wakes up fresh
          setMood('idle', random(0.8, 1.6));
        }
        break;
      case 'bolting':
      case 'happy':
      case 'idle':
        if (moodAge > moodFor) decide();
        break;
      default: // strolling, perching
        if (arrived) setMood('idle', mood === 'perching' ? random(4, 9) : random(1, 3.5));
        else if (moodAge > moodFor) decide();
    }
  }

  // ---------------------------------------------------------------- moving and drawing

  function move(dt) {
    const b = bounds();
    const dx = goal.x - me.x;
    const dy = goal.y - me.y;
    const distance = Math.hypot(dx, dy);
    // Slows as it arrives, and takes a moment to get going or change direction.
    const want = Math.min(speed, distance * 4);
    const turn = 1 - Math.exp(-(mood === 'bolting' ? 14 : 6) * dt);
    me.vx += ((distance > 0.5 ? (dx / distance) * want : 0) - me.vx) * turn;
    me.vy += ((distance > 0.5 ? (dy / distance) * want : 0) - me.vy) * turn;
    me.x = clamp(me.x + me.vx * dt, b.left, b.right);
    me.y = clamp(me.y + me.vy * dt, b.top, b.bottom);

    const pace = Math.hypot(me.vx, me.vy);
    feel.energy = Math.max(0, feel.energy - pace * dt * 0.00013);
    if (mood === 'idle') feel.energy = Math.min(1, feel.energy + dt * 0.005);

    // It glides straight to wherever it is going, its body trailing along the path behind.
    let x = me.x;
    const y = me.y;
    if (wiggle > 0) { // delighted: a quick shimmy from side to side on the spot
      wiggle = Math.max(0, wiggle - dt * 0.75);
      x += Math.sin(wiggle * Math.PI * 8) * 9 * K * wiggle;
    }
    const stretch = mood === 'asleep' ? -0.12 + Math.sin(now * 1.6) * 0.03 : 0; // settled, breathing

    // Hand the body its pose: where the head is, how squashed, and its expression.
    mascot.pose({ x, y, stretch, expression: expression() });
    const signLeft = Math.round(x + SIZE * 0.5 - SIGN_SIZE * 0.5);
    const signTop = Math.round(y - SIZE * 0.5 - SIGN_SIZE * 0.7);
    sign.style.transform = `translate3d(${signLeft}px, ${signTop}px, 0)`;
    if (now > signUntil) sign.classList.remove('show');
    tuckBehindSticker(dt);
  }

  function step(dt) {
    now += dt;
    if (!still) think(dt);
    move(dt);
  }

  // It sets off on a stroll the moment the page loads, rather than standing about first.
  if (!still) stroll();

  let last = performance.now();
  function frame(time) {
    requestAnimationFrame(frame); // first, so that one bad frame can never stop it for good
    if (mascot.paused) { last = time; return; } // switched off from the menu: it waits where it is
    step(Math.min((time - last) / 1000, 0.05));
    last = time;
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    const b = bounds();
    me.x = clamp(me.x, b.left, b.right);
    me.y = clamp(me.y, b.top, b.bottom);
    headFor(goal.x, goal.y, speed);
  });

  // For looking in on it from the browser's console.
  mascot.mind = { feel, me, goal, pointer, get mood() { return mood; }, say, pat, step, restyle, expression };
})(window.RG);
