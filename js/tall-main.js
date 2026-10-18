// The Yuki page's scene: renderer, lights, camera, and the scroll control for its tall machine
// (js/tall-machine.js). Laid out like the Work page's (js/main.js): the same backdrop, light
// and shadows, and the same step down in shadow detail on a device that can't keep up. Called from yuki.html once Three.js has loaded.
//
// The camera opens close in on the ball at the top. Scrolling down moves the ball gradually down
// the machine, and the camera follows it, staying close in the whole way; scrolling up moves it
// back up.
(function (RG) {
  // The backdrop: a gradient from the lighter yellow at the top to the mustard of the floor,
  // reached at the horizon (the middle of the window, the camera looking level), as on the
  // Work page.
  function backdropGradient() {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, RG.C.backdropTop);
    gradient.addColorStop(0.5, RG.C.mustard);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  RG.startTall = function ({ RoomEnvironment }) {
    const canvas = document.getElementById('scene');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = backdropGradient();
    scene.fog = new THREE.Fog(RG.C.mustard, 80, 170);
    RG.envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

    // The same light as the Work page. The machine is too tall for one shadow to cover it all
    // in detail, so the sun moves up and down with the view (see followSun), its shadow
    // covering the part of the machine in view and a good way round it.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe2a0, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    const SUN_FROM = new THREE.Vector3(-11, 24, 19); // where the sun shines from, from what it lights
    const SUN_STEP = 2; // it moves in steps, so its shadows don't shimmer as the view moves
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -13;
    sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 13;
    sun.shadow.camera.bottom = -13;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    const stage = RG.buildTallStage();
    // (the machine leaves room for the white cards in yuki.html, each as tall as its
    // data-height says, in the scene's units, or the usual height)
    const cardHeights = [...document.querySelectorAll('.board-card')].map((card) => parseFloat(card.dataset.height) || null);
    const machine = RG.buildTallMachine({ cardHeights });
    scene.add(stage.root, machine.root);

    // ---------------------------------------------------------------- camera

    const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
    const FOLLOW_DISTANCE = 12; // following the ball
    const FOLLOW_RATE = 5.5; // (a touch brisker than the Work page's, to keep up with SPEED)
    const CATCH_UP = 0.9; // how much faster it follows, per unit the ball is from the middle of the view
    // How fast the whole scene runs: the machine, its decoration and the towers around it.
    // 1 is the pace the parts were timed at; above 1 is faster.
    const SPEED = 1.25;
    const BOARD_HALF_WIDTH = 4.9; // the machine's half-width, and a little more

    function resize() {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    const tanHalfFov = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // The camera stays close in on the ball the whole way, from the top on first load to the
    // goal at the bottom.
    function aimDistance() {
      // a narrow screen shows less across, so it stands a little further back
      return FOLLOW_DISTANCE * Math.min(Math.max(0.85 / camera.aspect, 1), 1.7);
    }

    // Where to look to show a point of the machine: at it, though from side to side only as far
    // as keeps the machine filling the view (on a screen wider than it, in the middle), and
    // never so low that the view shows more than a strip of the floor under the board (LOWEST:
    // the lowest the view's foot goes).
    // At the top, the view is raised as far as it takes to show all of the first white card
    // (beside the cup, a little above the ball: see tall-machine.js), with TOP_ROOM over it, and
    // comes down to the ball as it runs the first RAISE_FADE down from its cup.
    const LOWEST = -1;
    const TOP_ROOM = 0.5;
    const RAISE_FADE = 4;
    function aimFor(point, out) {
      const halfHeight = aimDistance() * tanHalfFov();
      const halfWidth = halfHeight * camera.aspect;
      const reach = Math.max(0, BOARD_HALF_WIDTH - halfWidth);
      const lift = Math.max(0, machine.cards[0][3] + TOP_ROOM - halfHeight - machine.start.y);
      const fade = Math.min(Math.max((point.y - machine.start.y + RAISE_FADE) / RAISE_FADE, 0), 1);
      const y = point.y + lift * fade;
      return out.set(Math.min(Math.max(point.x, -reach), reach), Math.max(y, LOWEST + halfHeight), 0);
    }
    // the ball
    const aimAt = (out) => aimFor(machine.ball.position, out);

    // Smoothed twice, as on the Work page: `lead` chases the aim and the view chases `lead`.
    const aim = new THREE.Vector3();
    const lead = aimAt(new THREE.Vector3());
    const look = lead.clone();
    let leadDistance = aimDistance();
    let distance = leadDistance;

    let glide = null; // the glide back up to the top, while it plays (see backToTop)
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    function updateCamera(dt) {
      if (glide) {
        // Gliding back up to the top (the red button): the view moves straight up, easing in
        // and out. The machine doesn't move on the way: it is put back at the start in a moment
        // when neither the ball nor its cup is in view, so the ball is simply waiting in its
        // cup when the view arrives. If the way up is too short for such a moment, the ball
        // shrinks away instead, and pops back up in its cup.
        glide.t = Math.min(glide.t + dt, glide.T);
        const p = glide.t / glide.T;
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        look.lerpVectors(glide.from, glide.to, e);
        lead.copy(look);
        const out = (y) => Math.abs(y - look.y) > distance * tanHalfFov() + 1; // out of view
        if (glide.unseen) {
          // a long way up: put back at the start once both the ball and its cup are out of view
          if (!glide.reset && out(machine.ball.position.y) && out(machine.start.y)) {
            glide.reset = true;
            machine.jump(0);
            machine.update(0);
          }
        } else {
          // a short way: the ball shrinks away where it is, and pops back up in its cup
          const SHRINK = 0.18;
          const GROW = 0.35;
          if (glide.t < SHRINK) {
            machine.ball.scale.setScalar(1 - ease(glide.t / SHRINK));
          } else {
            if (!glide.reset) {
              glide.reset = true;
              machine.jump(0);
              machine.update(0); // (in its cup in this very frame)
            }
            const g = Math.min((glide.t - SHRINK) / GROW, 1);
            machine.ball.scale.setScalar(Math.max(0.001, 1 - Math.exp(-6 * g) * Math.cos(9 * g)));
          }
        }
        if (glide.t === glide.T) {
          if (!glide.reset) {
            machine.jump(0);
            machine.update(0);
          }
          machine.ball.scale.setScalar(1);
          glide = null;
          machine.hold(false); // and let the scrolling have it again
        }
      } else {
        // The further the ball has got from the middle of the view, the faster the camera
        // catches up (CATCH_UP), so a ball sent along quickly by fast scrolling stays in view,
        // while small moves are still followed gently.
        aimAt(aim);
        const gap = Math.hypot(aim.x - look.x, aim.y - look.y);
        const k = 1 - Math.exp(-FOLLOW_RATE * (1 + CATCH_UP * gap) * dt);
        lead.lerp(aim, k);
        leadDistance += (aimDistance() - leadDistance) * k;
        look.lerp(lead, k);
        distance += (leadDistance - distance) * k;
      }
      const further = Math.max(0, distance - 40);
      scene.fog.near = 80 + further;
      scene.fog.far = 170 + further;
      camera.position.set(look.x, look.y, distance);
      camera.lookAt(look);
    }
    function snapCamera() {
      aimAt(lead);
      look.copy(lead);
      leadDistance = distance = aimDistance();
      updateCamera(0);
    }
    snapCamera();

    // ---------------------------------------------------------------- scrolling

    // Scrolling moves the ball along its path, as freely as scrolling a page: every bit of
    // scrolling down sends it on, every bit up sends it back (machine.seek()), with no limit
    // on how fast. It moves as far along its path as the page would have scrolled: a pixel of
    // scrolling is a pixel's worth of the scene at the ball, with the camera as close as it is
    // (PACE), so the ball keeps pace with the scrolling and the camera with the ball. A swipe
    // on a touch screen drags it along with the finger; the arrow keys nudge it, and Page Down
    // and Page Up (and space) move it further. The page itself never scrolls.
    const PACE = 1;
    const SWIPE_GAIN = 1;
    // world units of the ball's path per px of scrolling
    const perPixel = () => PACE * (2 * aimDistance() * tanHalfFov()) / Math.max(window.innerHeight, 1);
    // (none of it while the menu has it, or a picture from a card is open: see js/cards.js;
    // nor a key a card's picture has already taken)
    const viewer = document.querySelector('.viewer');
    const inMenu = (event) => (event.target.closest && event.target.closest('.menu'))
      || (viewer && viewer.open) || event.defaultPrevented;
    const scrub = (px) => machine.seek(machine.target + px * perPixel());

    // ---------------------------------------------------------------- the opening video

    // The page opens on the finished animation, filling
    // the window, with its sound on (or silent, if the browser won't allow sound yet, until the
    // visitor first clicks or presses a key) and its play and sound buttons. The first scroll
    // (or swipe, or arrow key) down sinks it away and brings the machine
    // forward, a move through depth that style.css animates from two classes: "back" on the
    // video, "front" on the machine's layer while it waits close up. From the very top of the
    // machine, carrying on scrolling up (a little more than one nudge: PULL) goes back to the
    // video.
    const videoStage = document.querySelector('.stage');
    const machineScreen = document.querySelector('.machine-screen');
    // (a page with no video yet opens on a picture instead, <img class="bleed">, with no
    // player: everything else is the same)
    const video = videoStage && videoStage.querySelector('video.bleed');
    const playButton = document.querySelector('.player .play');
    const soundButton = document.querySelector('.player .sound');
    const CHANGE = 600; // ms, the length of the move (--change in style.css)
    const PULL = 120; // px of scrolling up, at the top, to go back to the video
    let reading = !videoStage; // the machine is in view (straight away, with no video)
    let changing = false; // the move between the two is playing
    let wasPlaying = false;
    let pull = 0;

    if (video) {
      let waitingForSound = false;
      video.muted = false;
      video.play().catch(() => {
        video.muted = true;
        waitingForSound = true;
        video.play().catch(() => {});
      });
      for (const type of ['pointerdown', 'keydown']) {
        window.addEventListener(type, (event) => {
          if (!waitingForSound) return;
          waitingForSound = false;
          // not if the click is on the player: that is the visitor using its controls
          if (event.target === video || (event.target.closest && event.target.closest('.player'))) return;
          video.muted = false;
        });
      }
      const togglePlay = () => { if (video.paused) video.play().catch(() => {}); else video.pause(); };
      playButton.addEventListener('click', togglePlay);
      video.addEventListener('click', togglePlay);
      soundButton.addEventListener('click', () => { video.muted = !video.muted; });
      const show = () => {
        playButton.classList.toggle('off', video.paused);
        playButton.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
        soundButton.classList.toggle('off', video.muted);
        soundButton.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      };
      for (const type of ['play', 'pause', 'volumechange']) video.addEventListener(type, show);
      show();
    }

    function turnTo(toMachine) {
      if (!videoStage || changing || toMachine === reading) return;
      reading = toMachine;
      changing = true;
      pull = 0;
      videoStage.classList.toggle('back', reading);
      machineScreen.classList.toggle('front', !reading);
      // out of sight, the video rests; coming back, it carries on if it was playing before
      if (video) {
        if (reading) wasPlaying = !video.paused;
        else if (wasPlaying) video.play().catch(() => {});
      }
      setTimeout(() => {
        changing = false;
        if (reading && video) video.pause();
      }, CHANGE);
    }
    // at the very top of the machine (where a scroll up goes back to the video)
    const atTop = () => machine.target <= 0.001 && machine.along <= 0.001;

    // ---------------------------------------------------------------- scrolling, and the move between the two

    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey || inMenu(event)) return;
      event.preventDefault();
      // (lines or pages, from some mice, as px)
      const dy = event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (!reading) {
        if (dy > 4) turnTo(true);
        return;
      }
      if (changing) return;
      if (dy < 0 && atTop()) {
        pull -= dy;
        if (pull > PULL) turnTo(false);
        return;
      }
      pull = 0;
      scrub(dy);
    }, { passive: false });

    let touchY = null;
    let touchFrom = null; // where the swipe began, for the move between video and machine
    window.addEventListener('touchstart', (event) => {
      touchY = touchFrom = event.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchmove', (event) => {
      if (touchY === null || (viewer && viewer.open)) return;
      const y = event.touches[0].clientY;
      if (!reading) {
        if (touchFrom - y > 40) turnTo(true);
      } else if (!changing) {
        if (atTop() && y - touchFrom > 40 && y > touchY) turnTo(false);
        else scrub((touchY - y) * SWIPE_GAIN);
      }
      touchY = y;
    }, { passive: true });
    window.addEventListener('touchend', () => { touchY = touchFrom = null; }, { passive: true });

    window.addEventListener('keydown', (event) => {
      if (inMenu(event)) return;
      const nudge = { ArrowDown: 120, ArrowUp: -120, PageDown: 600, ' ': 600, PageUp: -600 }[event.key];
      if (!nudge) return;
      event.preventDefault();
      if (!reading) {
        if (nudge > 0) turnTo(true);
      } else if (!changing) {
        if (nudge < 0 && atTop()) turnTo(false);
        else scrub(nudge);
      }
    });

    // ---------------------------------------------------------------- back to the top

    // The push button at the foot of the machine: clicking it scrolls the view smoothly back up
    // to the top, easing in and out, the machine put back at the start out of sight on the way
    // (see updateCamera). While it's pointed at, it lights up, and the canvas is marked
    // .hovering-clickable so the cursor's circle grows over it as over a link (js/cursor.js).
    // The Home key does the same, and so does the button in the page for the keyboard (yuki.html).
    // (The waving hand at the top can be clicked too: it waves back eagerly.)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let overButton = false;
    function hits(event, object) {
      pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObject(object, true).length > 0;
    }
    const buttonAt = (event) => hits(event, machine.topButton.object);
    const handAt = (event) => hits(event, machine.hand.object);
    function point(button, hand) {
      if (button !== overButton) machine.topButton.light(button);
      overButton = button;
      canvas.classList.toggle('hovering-clickable', button || hand);
    }
    // The glide back up: from where the view is to the top, taking a time in proportion to the
    // way up (GLIDE_PACE units a second, on average), within GLIDE_TIME.
    const GLIDE_PACE = 22;
    const GLIDE_TIME = [0.5, 1.6]; // seconds, at the least and the most
    function backToTop() {
      machine.topButton.press();
      const to = aimFor(machine.start, new THREE.Vector3());
      const way = Math.hypot(to.x - look.x, to.y - look.y);
      if (way < 0.01) return;
      machine.hold(true); // (no scrolling while it glides)
      const T = Math.min(Math.max(way / GLIDE_PACE, GLIDE_TIME[0]), GLIDE_TIME[1]);
      // Can the machine be put back at the start unseen on the way? Only if there is a moment
      // when neither the ball nor its cup is in view: if the ball is far enough below the top.
      const unseen = machine.start.y - machine.ball.position.y > 2 * (distance * tanHalfFov() + 1);
      glide = { from: look.clone(), to, t: 0, T, reset: false, unseen };
    }
    canvas.addEventListener('pointermove', (event) => { if (event.pointerType !== 'touch') point(buttonAt(event), handAt(event)); });
    canvas.addEventListener('pointerleave', () => point(false, false));
    canvas.addEventListener('click', (event) => {
      if (buttonAt(event)) backToTop();
      else if (handAt(event)) machine.hand.wave();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Home' && reading && !inMenu(event)) { event.preventDefault(); backToTop(); }
    });
    const keyButton = document.querySelector('.back-to-top');
    if (keyButton) keyButton.addEventListener('click', backToTop);

    // ---------------------------------------------------------------- the white cards

    // The white cards on the board (".board-card" in style.css), all one landscape size, each
    // pinned to the space the machine leaves for it beside one of its lanes: [left, bottom,
    // right, top] in the scene, on the board's face. Each frame they are moved to
    // where the view shows that space, so they scroll with the machine. The camera looks
    // straight at the board, so a card is the space's own shape, scaled.
    const CARD_SPACES = machine.cards; // (the machine leaves room for them: see tall-machine.js)
    const BOARD_FACE = 0; // the board's face, in depth
    const boardCards = [...document.querySelectorAll('.board-card')].slice(0, CARD_SPACES.length).map((element, i) => (
      { element, space: CARD_SPACES[i], shown: '', size: '' }
    ));
    function placeCards() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = vh / (2 * (distance - BOARD_FACE) * tanHalfFov()); // px per unit on the board
      for (const card of boardCards) {
        const [left, bottom, right, top] = card.space;
        const x = vw / 2 + (left - look.x) * scale;
        const y = vh / 2 - (top - look.y) * scale;
        const w = (right - left) * scale;
        const h = (top - bottom) * scale;
        // (one out of view is still moved, off the window, but not shown: so its pictures load
        // as it comes near, and its animatics only play once it is in view; see js/cards.js)
        const inView = x < vw && x + w > 0 && y < vh && y + h > 0;
        const shown = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        if (shown === card.shown) continue;
        card.shown = shown;
        const size = w.toFixed(1) + 'x' + h.toFixed(1);
        if (size !== card.size) {
          card.size = size;
          card.element.style.width = w.toFixed(1) + 'px';
          card.element.style.height = h.toFixed(1) + 'px';
        }
        card.element.style.transform = shown;
        card.element.style.visibility = inView ? 'visible' : 'hidden';
      }
    }

    // Where the cards' words stand on the board, so the pegboard's holes fade out under them
    // (machine.quiet): each heading, paragraph and caption, a little way round. The words are sized to their card, so where they stand on it doesn't
    // change as it grows and shrinks; they are measured again only when the window changes
    // shape, or the fonts arrive (which can change where lines break).
    const WORDS = '.card-title, .card-inner p';
    const WORDS_ROOM = 0.25; // (in the scene's units)
    let wordsMoved = true;
    window.addEventListener('resize', () => { wordsMoved = true; });
    if (document.fonts) document.fonts.ready.then(() => { wordsMoved = true; });
    function quietUnderWords() {
      const places = [];
      for (const card of boardCards) {
        const box = card.element.getBoundingClientRect();
        if (!box.width || !box.height) return false; // (not placed yet: try again next frame)
        const [left, bottom, right, top] = card.space;
        const across = (px) => left + ((px - box.left) / box.width) * (right - left);
        const down = (px) => top - ((px - box.top) / box.height) * (top - bottom);
        for (const words of card.element.querySelectorAll(WORDS)) {
          const r = words.getBoundingClientRect();
          if (!r.width) continue;
          places.push([across(r.left) - WORDS_ROOM, down(r.bottom) - WORDS_ROOM, across(r.right) + WORDS_ROOM, down(r.top) + WORDS_ROOM]);
        }
        // (and the bottle label goes into the space its card leaves for it)
        const labelSpace = card.element.querySelector('.card-label-space');
        if (labelSpace) {
          const r = labelSpace.getBoundingClientRect();
          if (r.width) machine.label.place([across(r.left), down(r.bottom), across(r.right), down(r.top)]);
        }
      }
      machine.quiet(places);
      return true;
    }

    // The bottle label unrolls as it comes into view: rolled up while its middle is still
    // under the window's foot, and laid flat by the time it is LABEL_LAID of the way up to the
    // window's middle; rolling back up as it goes back down.
    const LABEL_LAID = 0.85;
    function unrollLabel() {
      const middle = machine.label.middle;
      if (middle === null) return;
      const halfHeight = distance * tanHalfFov();
      const foot = look.y - halfHeight;
      const p = (middle - foot) / (halfHeight * LABEL_LAID);
      // (eased in and out, like a hand smoothing it down)
      const q = Math.min(Math.max(p, 0), 1);
      machine.label.set(q * q * (3 - 2 * q));
    }

    // ---------------------------------------------------------------- the eyes

    // The green cube's eyes look at the cursor: each frame (the camera moves, so the same spot
    // on the screen points somewhere new), where the cursor points in the scene at the eyes'
    // depth. With no cursor (a touch screen, or the pointer gone from the window) they watch
    // the ball instead. The cursor is as js/cursor.js reports it.
    const eyePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -machine.eyeDepth);
    const gaze = new THREE.Vector3();
    let cursor = null; // { x, y } in the window, or null
    window.addEventListener('site-pointer', ({ detail }) => {
      if (detail.touch) return;
      if (detail.type === 'move') cursor = { x: detail.x, y: detail.y };
      else if (detail.type === 'leave') cursor = null;
    });
    function aimEyes() {
      if (!cursor) {
        machine.lookAt(null);
        return;
      }
      pointer.set((cursor.x / window.innerWidth) * 2 - 1, -(cursor.y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      machine.lookAt(raycaster.ray.intersectPlane(eyePlane, gaze));
    }

    // ---------------------------------------------------------------- loop

    // As on the Work page: on a device that can't keep up, the scene steps down, at most
    // twice: half-detail shadows and 1.5 pixels to the CSS pixel, then 1 (see js/main.js).
    // (Only frames that are drawn count: none are while the video is in front.)
    const SETTLE_FRAMES = 90;
    const WATCH_FRAMES = 120;
    const SLOW_FRAME = 1 / 45;
    const STEP_RATIOS = [1.5, 1];
    const watched = [];
    let step = 0;
    let seen = 0;
    function watchSpeed(rawDt) {
      if (step >= STEP_RATIOS.length || document.hidden || !(reading || changing)) return;
      if (++seen <= SETTLE_FRAMES || rawDt > 0.25) return;
      watched.push(rawDt);
      if (watched.length < WATCH_FRAMES) return;
      watched.sort((a, b) => a - b);
      const typical = watched[Math.floor(watched.length / 2)];
      watched.length = 0;
      seen = 0;
      if (typical <= SLOW_FRAME) {
        step = STEP_RATIOS.length;
        return;
      }
      if (step === 0) {
        sun.shadow.mapSize.set(2048, 2048);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null;
        }
      }
      if (renderer.getPixelRatio() > STEP_RATIOS[step]) renderer.setPixelRatio(STEP_RATIOS[step]);
      step++;
    }

    // the sun, kept over the part of the machine in view (in steps of SUN_STEP)
    let sunAt = NaN;
    function followSun() {
      const y = Math.round(look.y / SUN_STEP) * SUN_STEP;
      if (y === sunAt) return;
      sunAt = y;
      sun.target.position.set(0, y, 0);
      sun.position.copy(SUN_FROM).add(sun.target.position);
    }

    const clock = new THREE.Clock();
    let decorTime = 0;
    function frame() {
      const rawDt = clock.getDelta();
      watchSpeed(rawDt);
      const dt = Math.min(rawDt, 0.05);
      aimEyes();
      machine.update(dt * SPEED);
      decorTime += dt * SPEED;
      stage.update(decorTime);
      updateCamera(dt);
      followSun();
      placeCards();
      if (wordsMoved) wordsMoved = !quietUnderWords();
      unrollLabel();
      // (not drawn while the video is in front, out of sight: it only needs drawing once it is
      // on its way, or there)
      if ((reading || changing) && canvas.width > 1 && canvas.height > 1) renderer.render(scene, camera);
    }
    renderer.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        clock.getDelta();
        renderer.setAnimationLoop(frame);
      });

    RG.debug = { scene, camera, machine, renderer, sun, snapCamera, updateCamera, placeCards, unrollLabel };
  };
})(window.RG);
