// The machine itself: a pegboard with a ball that loops through seven stages.
// Nothing here is simulated. The ball follows a scripted route (rolls with constant
// acceleration, ballistic hops, rides on the lift and the wheel) and each mechanism is a
// function of time, so every lap is identical. The ball stops at the end of each step and
// waits for advance(), which plays the next step, rewind(), which plays the last one
// backwards, or goTo(), which jumps straight to any stop.
(function (RG) {
  // `sound.ping(frequency, options)` is called when parts are struck. The page has no sound,
  // so by default those calls do nothing.
  RG.buildMachine = function (sound = { ping() {} }) {
    const {
      M, C, mesh, box, Poly, arcPoints, zRod, disc, extrude, roundedRect, rail, ribbon, gear, spring, arrow,
      cloudShape, BALL_R, BALL_Z,
    } = RG;

    const DEG = Math.PI / 180;
    const GRAVITY = 30;
    const P = (x, y) => new THREE.Vector3(x, y, BALL_Z);
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

    const root = new THREE.Group();
    function place(object, x, y, z = 0) {
      object.position.set(x, y, z);
      root.add(object);
      return object;
    }

    let simT = 0; // total running time, drives decay of things that were struck
    let loopT = 0; // time within the current lap
    const pending = []; // delayed events, in simT
    const animators = []; // (dt) => void, run every frame
    const after = (delay, fn) => pending.push({ at: simT + delay, fn });

    // Something that rings after being hit: returns a decaying sine since the last strike.
    function struck(frequency, decay) {
      let t0 = -Infinity;
      return {
        hit() { t0 = simT; },
        value() {
          const t = simT - t0;
          return t > 10 ? 0 : Math.exp(-decay * t) * Math.sin(frequency * t);
        },
      };
    }

    const steel = M.metal('#dfe6ee', 0.12);
    const brass = M.metal('#f0bf52', 0.22);
    const sky = M.paint(C.sky, 0.35);

    // ---------------------------------------------------------------- board

    const board = extrude(roundedRect(-8.2, 0.2, 16.4, 13.6, 0.5), 0.4, [M.pegboard(2.5), M.matte(C.cream)]);
    place(board, 0, 0, -0.4);
    place(box(17.2, 0.3, 1.5, M.paint(C.navy)), 0, 0.15, -0.2);

    // ---------------------------------------------------------------- route

    const WHEEL = { x: 5.0, y: 4.65, r: 1.45 };
    const POCKET = 75 * DEG; // where the ball drops onto the wheel
    const onWheel = (a) => P(WHEEL.x + WHEEL.r * Math.cos(a), WHEEL.y + WHEEL.r * Math.sin(a));

    const tipPath = new Poly([P(-6.7, 11.9), P(-6.05, 11.8)]);
    const rail1 = new Poly([P(-6.05, 11.8), P(-2.4, 11.25)]);
    const SERP_ENTRY = 0.45; // the ball lands this far along, so the channel has a lead-in
    const serpentine = new Poly([
      P(-1.75, 9.925),
      ...arcPoints(2.3, 9.0, 0.7, 90, -90),
      ...arcPoints(-1.1, 7.4, 0.7, 90, 270),
      P(2.7, 6.5),
    ]);
    const rail1b = new Poly([P(2.7, 6.5), P(4.1, 6.36), onWheel(POCKET)]);
    const guard = new Poly([...arcPoints(WHEEL.x, WHEEL.y, WHEEL.r, 82, -90), P(1.8, 3.0)]);
    const rail2 = new Poly([onWheel(-90 * DEG), P(1.8, 3.0)]);
    const bars = [[1.0, 2.05], [0.2, 1.9], [-0.6, 1.75], [-1.4, 1.6], [-2.2, 1.45]].map(([x, y]) => P(x, y));
    const rail3 = new Poly([P(-3.0, 1.3), P(-6.2, 1.08)]);
    const intoBucket = new Poly([P(-6.2, 1.08), P(-6.7, 1.0)]);

    // ---------------------------------------------------------------- stage 1: the lift

    const LIFT_X = -6.7;
    const Y_LO = 0.72; // bucket floor height at the bottom / top of its travel
    const Y_HI = 11.62;
    const T_LIFT = 4;
    const PULLEY = { x: -7.15, y: 13.0, r: 0.45, z: 0.36 };
    const WEIGHT_X = PULLEY.x - PULLEY.r;
    const HANGER = 0.97; // rope attachment height above the bucket floor

    place(box(0.16, 12.2, 0.2, M.paint(C.navy)), LIFT_X, 6.5, 0.1);

    const bucket = new THREE.Group();
    const red = M.paint(C.red);
    const bucketParts = [
      [box(0.8, 0.1, 0.7, red), 0, -0.05, 0],
      [box(0.1, 0.55, 0.7, red), -0.35, 0.275, 0],
      [box(0.8, 0.55, 0.08, red), 0, 0.275, -0.39],
      [box(0.34, 0.4, 0.3, M.paint(C.yellow)), 0, 0.2, -0.55],
      [mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), steel), 0, 0.75, -0.39],
    ];
    for (const [part, x, y, z] of bucketParts) {
      part.position.set(x, y, z);
      bucket.add(part);
    }
    place(bucket, LIFT_X, Y_LO, BALL_Z);

    const pulley = disc(0.42, 0.14, M.dots(C.pink, C.white, 3), M.paint(C.hot));
    place(pulley, PULLEY.x, PULLEY.y, PULLEY.z);
    root.add(zRod(PULLEY.x, PULLEY.y, 0, PULLEY.z + 0.16, 0.06, red));

    const ropeMaterial = M.matte('#3a3a48', 0.8);
    const ropeGeometry = new THREE.CylinderGeometry(0.022, 0.022, 1, 6);
    const bucketRope = mesh(ropeGeometry, ropeMaterial);
    const weightRope = mesh(ropeGeometry, ropeMaterial);
    root.add(bucketRope, weightRope);
    place(mesh(new THREE.TorusGeometry(PULLEY.r, 0.022, 8, 24, Math.PI), ropeMaterial), PULLEY.x, PULLEY.y, PULLEY.z);

    const weight = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 24), [
      M.stripes(C.red, C.white, 3, Math.PI / 2), red, red,
    ]);
    place(weight, WEIGHT_X, 0, PULLEY.z);

    function stretch(rod, ax, ay, bx, by) {
      rod.position.set((ax + bx) / 2, (ay + by) / 2, PULLEY.z);
      rod.scale.y = Math.hypot(bx - ax, by - ay);
      rod.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
    }

    // The gear pair turns whenever the lift moves.
    const GEAR_A = { x: -4.6, y: 5.2, teeth: 16, r: 1.2 };
    const GEAR_B = { teeth: 10, r: 0.75 };
    const meshAngle = -35 * DEG;
    GEAR_B.x = GEAR_A.x + (GEAR_A.r + GEAR_B.r) * Math.cos(meshAngle);
    GEAR_B.y = GEAR_A.y + (GEAR_A.r + GEAR_B.r) * Math.sin(meshAngle);
    const gearRatio = GEAR_A.teeth / GEAR_B.teeth;
    // Offsets gear B so one of its gaps meets a tooth of gear A on the line between centres.
    const gearPhase = meshAngle + Math.PI - Math.PI / GEAR_B.teeth + gearRatio * meshAngle;

    const gearA = gear(GEAR_A.teeth, GEAR_A.r, 0.25, M.paint(C.yellow), { count: 6, ring: 0.68, radius: 0.17 });
    const gearB = gear(GEAR_B.teeth, GEAR_B.r, 0.25, M.paint(C.pink), { count: 5, ring: 0.42, radius: 0.1 });
    place(gearA, GEAR_A.x, GEAR_A.y, 0.15);
    place(gearB, GEAR_B.x, GEAR_B.y, 0.15);
    for (const g of [GEAR_A, GEAR_B]) {
      root.add(zRod(g.x, g.y, 0, 0.5, 0.09, steel));
      root.add(zRod(g.x, g.y, 0.4, 0.46, 0.16, red));
    }

    // ---------------------------------------------------------------- stage 2: wire rail

    root.add(rail(rail1, -1));

    // Trip lever: the ball knocks its tab, the striker on the other end rings the chimes.
    const LEVER_X = -4.55;
    const lever = new THREE.Group();
    const tab = box(0.07, 0.34, 0.1, red);
    tab.position.y = 0.15;
    const arm = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 8), red);
    arm.position.y = -0.625;
    const striker = mesh(new THREE.SphereGeometry(0.13, 24, 16), red);
    striker.position.y = -1.3;
    lever.add(tab, arm, striker);
    place(lever, LEVER_X, 11.3, BALL_Z);
    root.add(zRod(LEVER_X, 11.3, 0, BALL_Z + 0.08, 0.03, red));
    const leverSwing = struck(6.5, 1.4);

    const chimes = [
      { x: -5.05, length: 2.7, note: 880, delay: 0.24 },
      { x: -4.05, length: 2.2, note: 1175, delay: 0.72 },
      { x: -5.5, length: 3.2, note: 659, delay: 0.38 },
    ].map((spec) => {
      const group = new THREE.Group();
      const string = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), ropeMaterial);
      string.position.y = -0.1;
      const tube = mesh(new THREE.CylinderGeometry(0.1, 0.1, spec.length, 24), brass);
      tube.position.y = -0.2 - spec.length / 2;
      group.add(string, tube);
      place(group, spec.x, 10.7, BALL_Z);
      root.add(zRod(spec.x, 10.7, 0, BALL_Z + 0.1, 0.03, sky));
      return { ...spec, group, swing: struck(5, 0.9), side: Math.sign(spec.x - LEVER_X) };
    });

    function ringChimes() {
      leverSwing.hit();
      for (const chime of chimes) {
        after(chime.delay, () => {
          chime.swing.hit();
          sound.ping(chime.note, { duration: 1.6, gain: 0.12 });
        });
      }
    }

    function makePinwheel(x, y, material) {
      const group = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Group();
        const blade = box(0.5, 0.09, 0.26, material);
        blade.position.x = 0.3;
        spoke.add(blade);
        spoke.rotation.z = (i * Math.PI) / 2;
        group.add(spoke);
      }
      group.add(disc(0.13, 0.34, red));
      root.add(zRod(x, y, 0, BALL_Z, 0.035, sky));
      return place(group, x, y, BALL_Z);
    }

    const pinwheel = makePinwheel(-3.0, 12.12, M.paint(C.yellow));
    let pinwheelSpeed = 0;
    animators.push((dt) => {
      pinwheel.rotation.z += pinwheelSpeed * dt;
      pinwheelSpeed *= Math.exp(-0.9 * dt);
    });

    // ---------------------------------------------------------------- stage 3: serpentine

    const HALF = BALL_R + 0.04; // half the channel width
    const WALL = 0.13;
    const orange = M.paint(C.orange, 0.3);
    root.add(ribbon(serpentine, -(HALF + WALL), HALF + WALL, 0, 0.3, M.paint(C.hot)));
    root.add(ribbon(serpentine, -(HALF + WALL), -HALF, 0.3, 0.72, orange));
    // The upper wall starts late so the ball can drop into the channel.
    root.add(ribbon(serpentine, HALF, HALF + WALL, 0.3, 0.72, orange, 1.5));

    // ---------------------------------------------------------------- stage 4: paddle wheel

    const PADDLES = 6;
    // At rest a paddle sits just under the pocket so the arriving ball leans on it.
    const WHEEL_REST = POCKET - Math.asin((BALL_R + 0.05) / WHEEL.r);
    const CARRY = 165 * DEG; // rotation while holding the ball
    const COAST = 75 * DEG; // then it runs on, ending one whole number of paddles later
    const SPIN_IN = 1.2 / WHEEL.r; // angular speed when the ball arrives / leaves
    const SPIN_OUT = 2.2;
    const T_CARRY = (2 * CARRY) / (SPIN_IN + SPIN_OUT);
    const T_COAST = (2 * COAST) / SPIN_OUT;
    let wheelStart = 0; // lap time the ball lands on the wheel; set once the timeline is laid out
    let coastClock = 0; // seconds the wheel has run on since the ball last rolled off it

    // Wheel rotation `a` seconds after the ball landed on it.
    const carryTurn = (a) => SPIN_IN * a + ((SPIN_OUT - SPIN_IN) / (2 * T_CARRY)) * a * a;

    // The wheel holds still with the ball at the bottom until the ball leaves, then runs on.
    function wheelTurn() {
      const a = loopT - wheelStart;
      if (a <= 0) return 0;
      if (a < T_CARRY) return carryTurn(a);
      const b = coastClock;
      return CARRY + SPIN_OUT * b - (SPIN_OUT / (2 * T_COAST)) * b * b;
    }

    // Paddles are thin enough to pass between the two wires of the rails.
    const wheel = new THREE.Group();
    const wheelDisc = disc(1.05, 0.35, M.dots(C.blue, C.white, 5), M.paint(C.blue));
    wheelDisc.position.z = 0.475;
    wheel.add(wheelDisc);
    for (let i = 0; i < PADDLES; i++) {
      const spoke = new THREE.Group();
      const paddle = box(1.42, 0.1, 0.16, M.paint(C.yellow));
      paddle.position.set(0.91, 0, BALL_Z);
      spoke.add(paddle);
      spoke.rotation.z = (i / PADDLES) * Math.PI * 2;
      wheel.add(spoke);
    }
    const hub = disc(0.26, 0.5, red);
    hub.position.z = BALL_Z;
    wheel.add(hub);
    place(wheel, WHEEL.x, WHEEL.y, 0);
    root.add(zRod(WHEEL.x, WHEEL.y, 0, 0.35, 0.12, steel));

    root.add(rail(rail1b, -1, { s1: rail1b.length - 0.2, supports: [0.3, 1.3] }));
    root.add(rail(guard, 1));

    // ---------------------------------------------------------------- stage 6: xylophone

    const barColors = [C.red, C.orange, C.yellow, C.green, C.blue];
    const barNotes = [1047, 880, 784, 659, 523];
    const xylophone = bars.map((p, i) => {
      const bar = box(0.62, 0.14, 0.9, M.paint(barColors[i], 0.35));
      const y = p.y - BALL_R - 0.07;
      place(bar, p.x, y, BALL_Z);
      for (const dx of [-0.18, 0.18]) root.add(zRod(p.x + dx, y - 0.02, 0, 0.5, 0.03, sky));
      return { bar, y, bounce: struck(20, 7) };
    });

    function hitBar(i) {
      xylophone[i].bounce.hit();
      sound.ping(barNotes[i], { type: 'triangle', duration: 0.7, gain: 0.2 });
    }

    // ---------------------------------------------------------------- stage 7: home stretch

    root.add(rail(rail3, 1));

    // ---------------------------------------------------------------- board decoration

    const yellow = M.paint(C.yellow);
    const arrows = [
      [7.5, 5.6, -90], [7.5, 4.8, -90], [7.5, 4.0, -90],
      [6.6, 2.1, 180], [5.8, 2.1, 180], [5.0, 2.1, 180], [4.2, 2.1, 180],
      [-3.9, 2.4, 180], [-4.7, 2.4, 180], [-5.5, 2.4, 180],
      [-0.2, 12.5, 0], [0.6, 12.5, 0], [1.4, 12.5, 0],
    ];
    for (const [x, y, angle] of arrows) place(arrow(yellow), x, y, 0).rotation.z = angle * DEG;

    const sun = disc(0.95, 0.2, M.target(C.black, C.white, 6), M.paint(C.black));
    place(sun, 6.6, 9.3, 0.3);
    root.add(zRod(6.6, 9.3, 0, 0.3, 0.08, steel));

    const cloud = extrude(cloudShape(), 0.25, [M.stripes(C.hot, C.white, 3.4), M.paint(C.white)], 0.05);
    cloud.scale.setScalar(0.8);
    place(cloud, 6.4, 11.9, 0.12);

    // A second pinwheel that idles on its own, with a disc swinging under it.
    const idler = makePinwheel(4.3, 12.5, M.paint(C.green));
    const pendulum = new THREE.Group();
    const pendulumRod = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), sky);
    pendulumRod.position.y = -0.4;
    const pendulumDisc = disc(0.5, 0.06, yellow);
    pendulumDisc.position.y = -1.25;
    pendulum.add(pendulumRod, pendulumDisc);
    place(pendulum, 4.3, 12.5, BALL_Z - 0.25);

    const halfMoon = new THREE.Shape();
    halfMoon.absarc(0, 0, 1.1, 0, Math.PI);
    halfMoon.closePath();
    place(extrude(halfMoon, 0.3, [M.stripes(C.blue, C.yellow, 2.2), M.paint(C.blue)], 0.05), 6.5, 0.45, 0.05);

    place(box(1.1, 0.12, 0.9, yellow), 3.4, 0.62, 0.45);
    const bumperSpring = place(spring(0.22, 0.55, 5, 0.035, steel), 3.4, 0.68, 0.5);
    const bumperPad = place(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 32), M.paint(C.pink)), 3.4, 0, 0.5);

    animators.push((dt) => {
      sun.rotation.z -= 0.5 * dt;
      idler.rotation.z -= 1.4 * dt;
      pendulum.rotation.z = 0.3 * Math.sin(simT * 2.3);
      cloud.position.y = 11.9 + 0.08 * Math.sin(simT * 1.1);
      const squash = 1 + 0.18 * Math.sin(simT * 3.1);
      bumperSpring.scale.y = squash;
      bumperPad.position.y = 0.68 + 0.55 * squash + 0.07;
    });

    // ---------------------------------------------------------------- ball + timeline

    const ball = place(mesh(new THREE.SphereGeometry(BALL_R, 48, 32), steel), LIFT_X, Y_LO + BALL_R, BALL_Z);

    const segments = [];
    const segment = (T, pos, extra) => segments.push({ T, pos, ...extra });

    // Roll along a path with constant acceleration from speed v0 to v1.
    function roll(poly, v0, v1, extra = {}) {
      const s0 = extra.s0 || 0;
      const length = poly.length - s0;
      segment((2 * length) / (v0 + v1), (u, out) => {
        poly.at(s0 + (length * (2 * v0 * u + (v1 - v0) * u * u)) / (v0 + v1), out);
      }, extra);
    }

    // Free flight between two points, taking T seconds.
    function hop(a, b, T, extra) {
      const vy = (b.y - a.y + 0.5 * GRAVITY * T * T) / T;
      segment(T, (u, out) => {
        const t = u * T;
        out.set(a.x + (b.x - a.x) * u, a.y + vy * t - 0.5 * GRAVITY * t * t, BALL_Z);
      }, extra);
    }

    // The ball's lap time stops between steps but the mechanisms keep running, so the parts
    // that move after the ball has gone (bucket coming back down, wheel running on) have
    // clocks of their own that count up from the moment the ball left them.
    const DESCENT_TIME = 0.7 + 3.2; // pause at the top, then the trip back down
    let descentClock = 0; // seconds since the ball last rolled out of the bucket

    segment(T_LIFT, (u, out) => out.set(LIFT_X, Y_LO + (Y_HI - Y_LO) * ease(u) + BALL_R, BALL_Z), {
      stage: 'The lift',
      onStart: () => sound.ping(196, { type: 'triangle', duration: 0.3, gain: 0.12 }),
    });
    roll(tipPath, 0.3, 1.4, { stage: 'Wire rail' });
    roll(rail1, 1.4, 3.6, {
      id: 'rail1',
      triggers: [
        { x: LEVER_X - 0.2, fire: ringChimes },
        { x: -3.2, fire: () => { pinwheelSpeed = 9; } },
      ],
    });
    const serpentineStart = serpentine.at(SERP_ENTRY);
    hop(rail1.at(rail1.length), serpentineStart, 0.3);
    roll(serpentine, 3.0, 3.6, {
      s0: SERP_ENTRY,
      stage: 'Serpentine',
      onStart: () => sound.ping(150, { duration: 0.18, gain: 0.25 }),
    });
    roll(rail1b, 3.6, 1.2, { stage: 'Paddle wheel' });
    segment(T_CARRY, (u, out) => out.copy(onWheel(POCKET - carryTurn(u * T_CARRY))), {
      id: 'wheel',
      onStart: () => sound.ping(120, { duration: 0.15, gain: 0.25 }),
    });
    roll(rail2, SPIN_OUT * WHEEL.r, 3.4, {
      id: 'rail2',
      stage: 'Low rail',
    });
    hop(rail2.at(rail2.length), bars[0], 0.25, { stage: 'Xylophone' });
    bars.forEach((bar, i) => {
      hop(bar, bars[i + 1] || rail3.at(0), 0.32, { onStart: () => hitBar(i) });
    });
    roll(rail3, 2.5, 2.4, { stage: 'Home stretch' });
    roll(intoBucket, 2.4, 0.2);
    segment(0.6, (u, out) => out.set(LIFT_X, Y_LO + BALL_R, BALL_Z), {
      onStart: () => sound.ping(392, { type: 'triangle', duration: 0.25, gain: 0.15 }),
    });

    let total = 0;
    const stageNames = [];
    for (const s of segments) {
      s.t0 = total;
      total += s.T;
      if (s.stage) stageNames.push(s.stage);
      s.stageIndex = stageNames.length - 1;
    }
    wheelStart = segments.find((s) => s.id === 'wheel').t0;
    const rail1Index = segments.findIndex((s) => s.id === 'rail1'); // the ball has left the bucket
    const rail2Index = segments.findIndex((s) => s.id === 'rail2'); // the ball has left the wheel
    const rail1Start = segments[rail1Index].t0;
    const rail2Start = segments[rail2Index].t0;

    // The stops: the start of the lap, the end of each step, and home again at the end.
    const stopTimes = segments.filter((s) => s.stage).map((s) => s.t0).concat(total);
    const LAST_STOP = stopTimes.length - 1;

    const REWIND_SPEED = 1.6; // rewinding plays a step backwards a little faster than forwards
    let index = -1; // segment the ball is in; -1 = sitting in the bucket before a lap
    let stageIndex = 0; // step being played, or the one that will play next while waiting
    let waiting = true; // the ball rests at a stop until advance() or rewind()
    let started = false; // false on page load, and again whenever the ball is back at the start
    let stop = 0; // the stop the ball is resting at, or heading for
    let leaving = false; // forwards: the ball is setting off from a stop, not arriving at it
    let rewinding = false;
    let rewindFrom = 0; // lap times the current rewind runs between
    let rewindTo = 0;
    let descentFrom = 0; // where the two clocks stood when it began
    let coastFrom = 0;

    // Plays the next step. From the last stop it carries on into a new lap.
    function advance() {
      if (!waiting) return false;
      stop = stop === LAST_STOP ? 1 : stop + 1;
      started = true;
      waiting = false;
      leaving = index >= 0;
      return true;
    }

    // Plays the last step backwards, returning the ball to the stop before.
    function rewind() {
      if (!waiting || stop === 0) return false;
      stop--;
      rewindTo = stopTimes[stop];
      rewindFrom = loopT;
      descentFrom = descentClock;
      coastFrom = coastClock;
      waiting = false;
      rewinding = true;
      return true;
    }

    // Puts the machine at any stop at once, with nothing played in between: the ball is at
    // rest there and every mechanism is where it would have settled. Works mid-step too.
    function goTo(target) {
      if (target < 0 || target > LAST_STOP || (waiting && target === stop)) return false;
      stop = target;
      loopT = stopTimes[target];
      index = -1;
      while (index + 1 < segments.length && segments[index + 1].t0 < loopT) index++;
      const next = segments[index + 1];
      stageIndex = next ? next.stageIndex : 0;
      descentClock = index >= rail1Index ? DESCENT_TIME : 0;
      coastClock = index >= rail2Index ? T_COAST : 0;
      started = target > 0;
      waiting = true;
      rewinding = false;
      leaving = false;
      pending.length = 0; // drop any chimes still queued from the step that was interrupted
      return true;
    }

    // While a rewind passes back over the moment the ball left a mechanism, wind that
    // mechanism's clock down in step, so it is back in place exactly as the ball returns to it.
    function unwind(from, leftAt) {
      if (rewindTo > leftAt || rewindFrom <= leftAt) return null;
      return from * Math.min(Math.max((loopT - leftAt) / (rewindFrom - leftAt), 0), 1);
    }

    function update(dt) {
      simT += dt;

      if (rewinding) {
        loopT = Math.max(loopT - dt * REWIND_SPEED, rewindTo);
        while (index >= 0 && loopT < segments[index].t0) index--;
        descentClock = unwind(descentFrom, rail1Start) ?? descentClock;
        coastClock = unwind(coastFrom, rail2Start) ?? coastClock;
        if (loopT === rewindTo) {
          // Arrived. Rest at the end of the segment before the stop, as when playing forwards.
          while (index >= 0 && segments[index].t0 >= rewindTo) index--;
          stageIndex = segments[index + 1].stageIndex;
          rewinding = false;
          waiting = true;
          if (index < 0) started = false;
        } else {
          stageIndex = segments[index].stageIndex;
        }
      } else if (!waiting) {
        loopT += dt;
        for (;;) {
          const next = segments[index + 1];
          const boundary = next ? next.t0 : total;
          if (loopT < boundary) break;
          // A stop. (Not the one at the very start of a lap: the ball never arrives there
          // going forwards, it only sets off from it.)
          if (index >= 0 && (!next || next.stage)) {
            if (leaving) {
              leaving = false;
            } else {
              loopT = boundary;
              stageIndex = next ? next.stageIndex : 0;
              waiting = true;
              break;
            }
          }
          if (!next) {
            loopT -= total;
            index = -1;
            descentClock = coastClock = 0;
            continue;
          }
          index++;
          stageIndex = next.stageIndex;
          if (next.triggers) for (const trigger of next.triggers) trigger.done = false;
          if (next.onStart) next.onStart();
        }
      }

      if (!rewinding) {
        if (index >= rail1Index) descentClock = Math.min(descentClock + dt, DESCENT_TIME);
        if (index >= rail2Index) coastClock = Math.min(coastClock + dt, T_COAST);
      }

      const current = segments[index];
      if (!current) {
        segments[0].pos(0, ball.position);
      } else {
        current.pos(Math.min((loopT - current.t0) / current.T, 1), ball.position);
        if (current.triggers && !rewinding) {
          for (const trigger of current.triggers) {
            if (!trigger.done && ball.position.x >= trigger.x) {
              trigger.done = true;
              trigger.fire();
            }
          }
        }
      }

      for (let i = pending.length - 1; i >= 0; i--) {
        if (simT >= pending[i].at) pending.splice(i, 1)[0].fn();
      }

      // Lift, rope, counterweight and the gears it drives. The bucket tips at the top, then
      // goes back down once the ball has rolled out.
      const sinceTip = descentClock;
      const floorY = Y_LO + (Y_HI - Y_LO) * (ease(loopT / T_LIFT) - ease((sinceTip - 0.7) / 3.2));
      const travel = floorY - Y_LO;
      const tilt = -0.32 * (ease((loopT - T_LIFT) / 0.35) - ease((sinceTip - 0.15) / 0.5));
      bucket.position.y = floorY;
      bucket.rotation.z = tilt;
      stretch(bucketRope, LIFT_X - HANGER * Math.sin(tilt), floorY + HANGER * Math.cos(tilt), LIFT_X, PULLEY.y);
      const weightTop = 12.3 - travel;
      weight.position.y = weightTop - 0.35;
      stretch(weightRope, WEIGHT_X, weightTop, WEIGHT_X, PULLEY.y);
      pulley.rotation.z = travel / PULLEY.r;
      gearA.rotation.z = travel * 0.45;
      gearB.rotation.z = -gearRatio * gearA.rotation.z + gearPhase;

      wheel.rotation.z = WHEEL_REST - wheelTurn();

      lever.rotation.z = -0.24 * leverSwing.value();
      for (const chime of chimes) chime.group.rotation.z = 0.1 * chime.side * chime.swing.value();
      for (const x of xylophone) x.bar.position.y = x.y - 0.06 * x.bounce.value();
      for (const animate of animators) animate(dt);
    }

    update(0);

    return {
      root,
      ball,
      update,
      advance,
      rewind,
      goTo,
      stops: stopTimes.length,
      get stop() {
        return stop;
      },
      get waiting() {
        return waiting;
      },
      get rewinding() {
        return rewinding;
      },
      get started() {
        return started;
      },
      get stage() {
        return { number: stageIndex + 1, name: stageNames[stageIndex] };
      },
    };
  };
})(window.RG);
