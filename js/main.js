// Renderer, lights, camera and the scroll control. Called from index.html once Three.js has loaded.
(function (RG) {
  // The backdrop: a gradient that fills the window behind the scene, from a lighter, slightly
  // greener yellow at the top to the mustard of the floor. The camera always looks level, so
  // the horizon sits across the middle of the window, where the floor fades into the fog. The
  // gradient reaches the mustard exactly there, which keeps the join invisible. style.css
  // repeats the same gradient (--backdrop) for the page and the menu panel.
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

  RG.start = function ({ OrbitControls, RoomEnvironment }) {
    const canvas = document.getElementById('scene');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = backdropGradient();
    scene.fog = new THREE.Fog(RG.C.mustard, 80, 170);

    // Reflected by the metal and glossy plastic materials; the matte ones ignore it.
    RG.envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe2a0, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-11, 22, 17);
    sun.target.position.set(0, 6, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -17;
    sun.shadow.camera.right = 17;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -13;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    // ---------------------------------------------------------------- scene contents

    const stage = RG.buildStage();
    const machine = RG.buildMachine();
    scene.add(stage.root, machine.root);

    // ---------------------------------------------------------------- camera

    const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;

    // The camera always tracks the ball from a fixed distance and angle; the viewer can't
    // move it.
    const START_DIRECTION = new THREE.Vector3(0, 0, 1); // straight out from the board
    const START_DISTANCE = 20;
    const LOAD_DISTANCE = 34; // pulled back when the page first loads, before the first step
    const FOLLOW_RATE = 4.5;

    // Where the ball sits on screen, as a fraction of the window from its centre:
    // - while moving, and when it comes home to the bucket at the end of a lap: centred
    // - whenever it stops after a step: near the right edge
    // - when the page first loads, before the first step: in the lower right corner, with
    //   the camera pulled back
    const STRIP = 0.28; // the ball rests in the middle of a strip this fraction of the screen wide
    const EDGE_X = 0.5 - STRIP / 2;
    const CORNER_Y = 0.3;
    let aside = false;

    // On a tall screen (a phone or a tablet held upright) there isn't room beside the ball,
    // so the layout turns: the containers run along the bottom of the window and the ball
    // rests above them, and on the opening screen the name sits in the upper part with the
    // whole machine below it. style.css switches on the same test.
    const TALL = window.matchMedia('(max-aspect-ratio: 9/10)');
    const TALL_BALL_Y = 0.27; // on a tall screen the ball rests this far down the window
    const TALL_FIT = 20; // world units across the opening view on a tall screen: the machine
    const TALL_FLOOR = 0.07; // ...whose foot sits this far up from the bottom of the window
    const TALL_SHARE = 0.46; // ...and which takes up no more than this much of its height (or less: see measureIntro),
    const MACHINE_HEIGHT = 14.8; // (the machine's height, floor to top, in world units)
    const MACHINE_FOOT = -0.5; // height of the floor the machine stands on

    // The containers shown beside the ball at each stop fill the rest of the window (or, on
    // a tall screen, run along its bottom; see style.css).
    const panelsBox = document.querySelector('.panels');
    const placePanels = () => { panelsBox.style.width = TALL.matches ? '' : (1 - STRIP) * 100 + '%'; };
    placePanels();
    const panels = [...document.querySelectorAll('.panel')];
    let shownStep = 0;

    function resize() {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('resize', placePanels);
    resize();

    // On a tall screen's opening view, how much of the window's height the machine may take:
    // TALL_SHARE, or less on a short phone, where the blurb and the prompt under the name
    // reach further down; the machine then stands a little smaller, clear under them
    // (measured again when the window changes shape, or the fonts arrive).
    const introCopy = document.querySelector('.intro-copy');
    const INTRO_GAP = 0.03; // (of the window's height, between the prompt and the machine's top)
    let tallShare = TALL_SHARE;
    function measureIntro() {
      const bottom = introCopy ? introCopy.getBoundingClientRect().bottom : 0;
      const free = 1 - bottom / Math.max(window.innerHeight, 1) - INTRO_GAP - TALL_FLOOR;
      tallShare = Math.min(TALL_SHARE, Math.max(free, 0.2));
    }
    window.addEventListener('resize', measureIntro);
    if (document.fonts) document.fonts.ready.then(measureIntro);
    measureIntro();

    // How far back the camera should be right now: pulled out until the first step starts.
    // A tall screen shows less across, so there it stands further back: on the opening
    // screen far enough to fit the whole machine across, and while following the ball by as
    // much as the screen is narrower than a square one (up to a point).
    const tanHalfFov = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    function aimDistance() {
      if (!TALL.matches) return machine.started ? START_DISTANCE : LOAD_DISTANCE;
      if (!machine.started) {
        // far enough back for the machine to fit across the screen, and to leave the upper
        // part of the screen clear for the name, the blurb and the prompt
        const across = TALL_FIT / 2 / (tanHalfFov() * camera.aspect);
        const down = MACHINE_HEIGHT / tallShare / 2 / tanHalfFov();
        return Math.max(across, down);
      }
      return START_DISTANCE * Math.min(Math.max(0.85 / camera.aspect, 1), 1.7);
    }

    // The point the camera should be looking at right now.
    function aimAt(out) {
      // The view is this many world units tall at the ball's depth.
      const viewHeight = 2 * aimDistance() * tanHalfFov();
      out.copy(machine.ball.position);
      if (TALL.matches) {
        if (!machine.started) {
          // The whole machine, across the middle, standing near the bottom of the window.
          out.x = 0;
          out.y = MACHINE_FOOT + viewHeight * (0.5 - TALL_FLOOR);
        } else if (aside) {
          out.y -= viewHeight * (0.5 - TALL_BALL_Y); // the ball up above the container
        }
      } else if (!machine.started) {
        out.x -= viewHeight * camera.aspect * EDGE_X;
        out.y += viewHeight * CORNER_Y;
      } else if (aside) {
        out.x -= viewHeight * camera.aspect * EDGE_X;
      }
      return out;
    }

    // Smoothed twice: `lead` chases the aim and the view chases `lead`, so the camera eases
    // into and out of every move and the ball's hops and landings don't jolt it. The distance
    // is smoothed the same way.
    const aim = new THREE.Vector3();
    const lead = aimAt(new THREE.Vector3());
    let leadDistance = aimDistance();
    let distance = leadDistance;
    controls.target.copy(lead);

    function updateCamera(dt) {
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      lead.lerp(aimAt(aim), k);
      leadDistance += (aimDistance() - leadDistance) * k;
      controls.target.lerp(lead, k);
      distance += (leadDistance - distance) * k;
      // Standing further back than usual (on a tall screen), push the fog back by as much, so
      // the machine stays clear of it.
      const further = Math.max(0, distance - LOAD_DISTANCE);
      scene.fog.near = 80 + further;
      scene.fog.far = 170 + further;
      camera.position.copy(controls.target).addScaledVector(START_DIRECTION, distance);
      controls.update();
    }
    updateCamera(0);

    // Cuts straight to where the camera should be, with no glide.
    function snapCamera() {
      aimAt(lead);
      controls.target.copy(lead);
      leadDistance = distance = aimDistance();
      updateCamera(0);
    }

    // The opening view is framed for the window's shape. If the window changes size before
    // the first step, jump straight to the new framing instead of drifting to it.
    window.addEventListener('resize', () => {
      if (!machine.started) snapCamera();
    });

    // ---------------------------------------------------------------- controls

    // The ball waits at the end of every step; scrolling down sends it on and scrolling up
    // rewinds the step it just finished. The page itself never scrolls, so this listens for
    // the gesture: the mouse wheel or trackpad, or a swipe on a touch screen.
    //
    // One gesture moves the ball one step. A trackpad keeps sending wheel events for a second
    // or more after a flick, so a gesture only counts if it began while the ball was waiting,
    // and it is used up as soon as it has sent the ball on.
    const GESTURE_GAP = 180; // ms without wheel events before the next one starts a new gesture
    const WHEEL_THRESHOLD = 20; // scroll distance that counts as deliberate
    const SWIPE_THRESHOLD = 40; // px
    let lastWheelAt = -Infinity;
    let wheelTravel = 0;
    let gestureLive = false;

    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey) return; // pinch / browser zoom
      event.preventDefault();
      if (event.timeStamp - lastWheelAt > GESTURE_GAP) {
        gestureLive = machine.waiting;
        wheelTravel = 0;
      }
      lastWheelAt = event.timeStamp;
      wheelTravel += event.deltaY;
      if (gestureLive && Math.abs(wheelTravel) > WHEEL_THRESHOLD) {
        gestureLive = false;
        if (wheelTravel > 0) machine.advance(); else machine.rewind();
      }
    }, { passive: false });

    let touchStartY = 0;
    window.addEventListener('touchstart', (event) => {
      touchStartY = event.touches[0].clientY;
      gestureLive = machine.waiting;
    }, { passive: true });
    window.addEventListener('touchmove', (event) => {
      const swipe = touchStartY - event.touches[0].clientY;
      if (gestureLive && Math.abs(swipe) > SWIPE_THRESHOLD) {
        gestureLive = false;
        if (swipe > 0) machine.advance(); else machine.rewind();
      }
    }, { passive: true });

    // Progress dots: one per stop. Clicking one cuts straight to that stop: the machine, the
    // camera, the name and the container all jump there with nothing animated in between.
    // Either side of them, a previous and a next arrow cut straight to the stop before or after
    // (going on from the stop the ball is at, or, on its way between two, the one it left or
    // the one it's heading for), so a visitor can skip the machine's runs.
    const dotsNav = document.querySelector('.dots');
    const arrow = (way, label, path) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-arrow';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
      button.addEventListener('click', () => {
        if (machine.goTo(neighbour(way))) snap = true;
      });
      return button;
    };
    // the stop before (way -1) or after (way 1) where the ball is now
    function neighbour(way) {
      const at = machine.stop;
      if (machine.waiting) return at + way;
      // on its way to `at`: forwards, it left the one before; rewinding, the one after
      const left = machine.rewinding ? at + 1 : at - 1;
      return way > 0 ? Math.max(at, left) : Math.min(at, left);
    }
    const previous = arrow(-1, 'Previous step', 'M14.5 6l-6 6 6 6');
    const next = arrow(1, 'Next step', 'M9.5 6l6 6-6 6');
    dotsNav.appendChild(previous);
    const dots = Array.from({ length: machine.stops }, (_, i) => {
      const dot = document.createElement('button');
      const label = i === 0 ? 'Start' : i === machine.stops - 1 ? 'Finish' : 'Step ' + i;
      dot.type = 'button';
      dot.className = i === 0 ? 'dot home' : 'dot';
      dot.title = label;
      dot.setAttribute('aria-label', label);
      dot.addEventListener('click', () => {
        if (machine.goTo(i)) snap = true;
      });
      dotsNav.appendChild(dot);
      return dot;
    });
    dotsNav.appendChild(next);
    let shownStop = -1;
    let snap = false; // a dot was clicked: the next frame lands everything without animating

    // Starts a video with its sound on. Browsers only allow sound from a page the visitor has
    // clicked, tapped or typed on; scrolling doesn't count. So if the sound is refused, the
    // video starts silent instead, and the sound comes on at the visitor's first click or key
    // press. Either way the player's own controls can mute and unmute it.
    let waitingForSound = null;
    function playWithSound(video) {
      video.currentTime = 0;
      video.muted = false;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
        waitingForSound = video;
      });
    }
    for (const type of ['pointerdown', 'keydown']) {
      window.addEventListener(type, (event) => {
        const video = waitingForSound;
        waitingForSound = null;
        // Not if the click is on the player itself: that is the visitor using its controls.
        if (video && !video.paused && event.target !== video) video.muted = false;
      });
    }

    // The name's glide is switched on only for the moment it is needed (see style.css).
    const title = document.querySelector('.title');
    title.addEventListener('transitionend', () => title.classList.remove('gliding'));
    let intro = true;

    // ---------------------------------------------------------------- loop

    const clock = new THREE.Clock();
    let decorTime = 0;

    // On a device that can't keep up, the scene steps down. It keeps an eye on how long frames
    // take once the scene has settled, and if they take consistently longer than at about 45
    // frames a second, it steps down a step, for good, and watches again; at most twice:
    //   1. shadows at half the detail (2048 pixels across instead of 4096), and on a sharp
    //      screen the scene drawn at 1.5 pixels to the CSS pixel instead of 2 (most of the
    //      saving: about 40% less work, where the shadows alone save about 10%);
    //   2. still slow: drawn at 1 pixel to the CSS pixel (about 70% less work than 2).
    // A fast device never steps down and keeps the full detail.
    const SETTLE_FRAMES = 90; // ignored: the first frames, while everything warms up (and after a step)
    const WATCH_FRAMES = 120; // then judged on this many
    const SLOW_FRAME = 1 / 45; // seconds
    const STEP_RATIOS = [1.5, 1];
    const watched = [];
    let step = 0;
    let seen = 0;
    function watchSpeed(rawDt) {
      if (step >= STEP_RATIOS.length || document.hidden) return;
      if (++seen <= SETTLE_FRAMES || rawDt > 0.25) return; // (a long gap is a pause, not slowness)
      watched.push(rawDt);
      if (watched.length < WATCH_FRAMES) return;
      watched.sort((a, b) => a - b);
      const typical = watched[Math.floor(watched.length / 2)];
      watched.length = 0;
      seen = 0;
      if (typical <= SLOW_FRAME) {
        step = STEP_RATIOS.length; // fast enough: stops watching
        return;
      }
      if (step === 0) {
        sun.shadow.mapSize.set(2048, 2048);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null; // made again at the new size on the next frame
        }
      }
      if (renderer.getPixelRatio() > STEP_RATIOS[step]) renderer.setPixelRatio(STEP_RATIOS[step]);
      step++;
    }

    function frame() {
      const rawDt = clock.getDelta();
      watchSpeed(rawDt);
      // Clamp so a background tab doesn't come back with one giant step.
      const dt = Math.min(rawDt, 0.05);
      machine.update(dt);
      decorTime += dt;
      stage.update(decorTime);

      // (resting at any stop but the start: after each step, and at the finish)
      aside = machine.waiting && machine.stop > 0;

      // For a jump, switch the page's own transitions off while the changes below land.
      if (snap) document.body.classList.add('snapping');

      // While the ball is stopped aside, show the container for the stop it's resting at: the
      // step it just finished, or, at the finish, the last project's.
      const step = aside ? machine.stop : 0;
      if (step !== shownStep) {
        shownStep = step;
        for (const panel of panels) {
          const show = Number(panel.dataset.step) === step;
          panel.classList.toggle('show', show);
          // A container's video plays from the start, with sound, while the container is
          // showing, and stops when it goes.
          const video = panel.querySelector('video');
          if (video && show) playWithSound(video);
          else if (video) video.pause();
        }
      }

      // Light the dot for the stop the ball is at, or on its way to; and the arrows can't go on
      // past the first stop or the last.
      if (machine.stop !== shownStop) {
        shownStop = machine.stop;
        dots.forEach((dot, i) => {
          if (i === shownStop) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current');
        });
      }
      previous.disabled = neighbour(-1) < 0;
      next.disabled = neighbour(1) > machine.stops - 1;

      // Once the first step starts, the name glides from the middle of the screen to its
      // corner. Rewinding all the way to the beginning sends it back.
      if (machine.started === intro) {
        intro = !machine.started;
        if (!snap) title.classList.add('gliding');
        document.body.classList.toggle('intro', intro);
        // The progress dots and their arrows come in once the visitor first sets the machine
        // going, and stay (even back at the start).
        if (!intro) document.body.classList.add('dots-shown');
      }

      if (snap) {
        snap = false;
        snapCamera();
        void document.body.offsetHeight; // apply the changes before transitions come back
        document.body.classList.remove('snapping');
      } else {
        updateCamera(dt);
      }
      if (canvas.width > 1 && canvas.height > 1) renderer.render(scene, camera);
    }
    // The scene's shaders are made ready first, where the browser can do it in the background
    // (alongside everything else on the page, rather than holding it all up while the first
    // frame is drawn); then the scene starts. If that isn't possible, it just starts, and they
    // are made ready as the first frame is drawn, as before.
    renderer.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        clock.getDelta(); // the first frame's step starts from now, not from before the wait
        renderer.setAnimationLoop(frame);
      });

    RG.debug = { scene, camera, controls, machine, renderer, sun };
  };
})(window.RG);
