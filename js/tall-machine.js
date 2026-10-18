// The Yuki page's machine: a second Rube Goldberg machine, tall and narrow, that the ball
// runs down from top to bottom as the visitor scrolls: gradually, a little further with every
// bit of scrolling, and back up again scrolling up. Built from the same palette, materials and
// parts as the Work page's machine (materials.js, parts.js), in the same toy-like style. Its
// route, in six parts:
//
//   1. Zigzag      a cup at the top tips the ball into a channel that switches back and forth,
//                  levelling off for a moment after the first turn,
//   2.             then running on down the rest of it
//   3. Funnel      it spirals down a striped funnel standing out from the board
//   4. Plinko      it bounces down rows of pegs
//   5. Seesaw      it drops onto a seesaw, which tips (ringing a bell) and rolls it on
//   6. Launcher    a spring catapults it in an arc into the goal, and a starburst pops
//
// The machine stands in a narrow column on the right of the board, and eleven white cards (put
// on the page by tall-main.js) run down its left side. Between its parts, the ball runs down
// lanes in the column: a ladder of blocks, a column of pegs, a switchback channel or a cascade
// of rails, one under another (see "the white cards' lanes" and "the layout").
//
// As on the Work page nothing is simulated: the ball follows a scripted route, and every
// mechanism is a function of the time along that route, so playing it backwards (scrolling up)
// rewinds everything exactly. seek() sends the ball a distance along its path, which it eases
// to (every mechanism keeping time with it); jump() puts it there at once; hold() keeps it
// where it is, ignoring scrolling.
(function (RG) {
  RG.buildTallMachine = function ({ cardHeights = [] } = {}) {
    const {
      M, C, mesh, box, Poly, arcPoints, zRod, disc, extrude, roundedRect, rail, ribbon, spring, arrow,
      cloudShape, BALL_R, BALL_Z,
    } = RG;

    const DEG = Math.PI / 180;
    const GRAVITY = 30;
    const TAU = Math.PI * 2;
    const P = (x, y, z = BALL_Z) => new THREE.Vector3(x, y, z);
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

    const root = new THREE.Group();
    function place(object, x, y, z = 0) {
      object.position.set(x, y, z);
      root.add(object);
      return object;
    }

    let simT = 0; // total running time, for things that idle and things that ring
    let loopT = 0; // time along the ball's route
    const pending = []; // delayed events, in simT
    const after = (delay, fn) => pending.push({ at: simT + delay, fn });
    const animators = []; // (dt) => void, every frame

    // Something that rings after being hit: a decaying sine since the last strike.
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
    const red = M.paint(C.red);
    const yellow = M.paint(C.yellow);
    const navy = M.paint(C.navy);

    // ---------------------------------------------------------------- sections

    // The machine is built in sections (the zigzag, the funnel, the plinko board, the seesaw,
    // the staircase, the launcher), each where it first stood, one above the other; then each is
    // moved up as a whole (see "the layout", below) to make room between them for the white
    // cards and the lanes the ball runs down beside them. Everything added to the machine
    // between beginSection() and endSection() goes into that section.
    // (Everything from the funnel up first stood RAISE higher, to make room for the plinko board.)
    const RAISE = 9;
    const sections = {};
    let sectionFrom = 0;
    const beginSection = () => { sectionFrom = root.children.length; };
    function endSection(name, entry, exit) {
      const group = new THREE.Group();
      group.add(...root.children.slice(sectionFrom));
      root.add(group);
      sections[name] = { group, entry, exit, dy: 0 };
      return group;
    }
    // places something in a section after it has ended
    const placeIn = (name, object, x, y, z = 0) => {
      object.position.set(x, y, z);
      sections[name].group.add(object);
      return object;
    };

    // ---------------------------------------------------------------- 1. the cup and the zigzag

    // The cup holds the ball at the top left (the first white card stands to the right of it and
    // the zigzag, the others down the board's left side below them: see "the white cards"). It
    // tips over its lower right corner, pouring the ball into the channel, and rights itself
    // once the ball has gone.
    beginSection();
    const CUP_REST = P(-4.55, 23.0 + RAISE); // the ball's centre, in the cup
    const HINGE = { x: CUP_REST.x + 0.42, y: CUP_REST.y - BALL_R - 0.1 };
    const CUP_TIP = -55 * DEG;
    const T_TIP = 0.6;
    const cupAngle = (t) => CUP_TIP * (ease(t / T_TIP) - ease((t - 2.2) / 0.8));
    const hinge = new THREE.Group();
    const cup = new THREE.Group();
    const cupColor = M.paint(C.hot);
    for (const [w, h, d, x, y, z, material] of [
      [0.84, 0.1, 0.72, 0, -BALL_R - 0.05, 0, cupColor], // floor
      [0.1, 0.62, 0.72, -0.42, 0, 0, cupColor], // back of the cup (left)
      [0.1, 0.26, 0.72, 0.42, -0.18, 0, cupColor], // the low lip it pours over
      [0.84, 0.62, 0.08, 0, 0, -0.4, M.dots(C.hot, C.white, 3)], // the wall against the board
    ]) {
      const part = box(w, h, d, material);
      part.position.set(x, y, z);
      cup.add(part);
    }
    cup.position.set(CUP_REST.x - HINGE.x, CUP_REST.y - HINGE.y, 0);
    hinge.add(cup);
    place(hinge, HINGE.x, HINGE.y, BALL_Z);
    root.add(zRod(HINGE.x, HINGE.y, 0, BALL_Z + 0.4, 0.05, steel));
    // where the ball is in the tipping cup, `angle` into the tip
    const inCup = (angle, out) => out.set(
      HINGE.x + (CUP_REST.x - HINGE.x) * Math.cos(angle) - (CUP_REST.y - HINGE.y) * Math.sin(angle),
      HINGE.y + (CUP_REST.x - HINGE.x) * Math.sin(angle) + (CUP_REST.y - HINGE.y) * Math.cos(angle),
      BALL_Z,
    );
    const poured = inCup(CUP_TIP, new THREE.Vector3());
    // where the ball goes over the cup's lip as it pours out: just over the lip's outer top
    // corner, the cup tipped
    const overLip = (() => {
      const cx = CUP_REST.x - HINGE.x + 0.47; // (the corner, from the hinge, upright)
      const cy = CUP_REST.y - HINGE.y - 0.05;
      const x = HINGE.x + cx * Math.cos(CUP_TIP) - cy * Math.sin(CUP_TIP);
      const y = HINGE.y + cx * Math.sin(CUP_TIP) + cy * Math.cos(CUP_TIP);
      return P(x + 0.1, y + BALL_R + 0.04);
    })();

    // The zigzag: a channel folded back and forth down the board's left side, then one long run
    // across, under the first card, to the machine's column on the right, ending on a flat
    // ledge. After the first hairpin it runs flat for a moment, where the ball comes to rest:
    // the zigzag is two steps, the first ending there (upper), the second running on from there
    // down to the ledge (lower). The channel is drawn along the whole of it.
    const ZIG_R = 0.55; // the hairpins' radius
    const FLAT_END = P(-3.1, 21.55 + RAISE);
    const upperPoints = [
      P(-3.45, 22.86 + RAISE), // (clear of the cup's lip, tipped)
      P(-2.5, 22.66 + RAISE),
      ...arcPoints(-2.5, 22.11 + RAISE, ZIG_R, 90, -90).slice(1),
    ];
    const LONG_RUN = [P(-3.8, 20.3 + RAISE), P(1.45, 19.38 + RAISE)]; // (the long run across)
    const lowerPoints = [
      P(-3.8, 21.4 + RAISE),
      ...arcPoints(-3.8, 20.85 + RAISE, ZIG_R, 90, 270).slice(1),
      LONG_RUN[1],
    ];
    const zigzag = new Poly([...upperPoints, FLAT_END, ...lowerPoints]);
    const zigzagUpper = new Poly(upperPoints);
    const restFlat = new Poly([upperPoints[upperPoints.length - 1], FLAT_END]); // where step 1 ends
    const zigzagLower = new Poly([FLAT_END, ...lowerPoints]);
    const ledge = new Poly([LONG_RUN[1], P(1.8, 19.36 + RAISE)]);
    // how high the long run's channel reaches (its upper wall), at x
    const longRunTop = (x) => LONG_RUN[0].y + ((x - LONG_RUN[0].x) / (LONG_RUN[1].x - LONG_RUN[0].x)) * (LONG_RUN[1].y - LONG_RUN[0].y) + 0.45;
    const HALF = BALL_R + 0.04; // half the channel's width
    const WALL = 0.13;
    const channelFloor = M.paint(C.blue);
    const channelWalls = M.paint(C.yellow, 0.3);
    for (const path of [zigzag, ledge]) {
      root.add(ribbon(path, -(HALF + WALL), HALF + WALL, 0, 0.3, channelFloor));
      root.add(ribbon(path, -(HALF + WALL), -HALF, 0.3, 0.72, channelWalls));
    }
    // the upper wall starts a little way in, so the ball can drop in from the cup
    root.add(ribbon(zigzag, HALF, HALF + WALL, 0.3, 0.72, channelWalls, 0.6));
    root.add(ribbon(ledge, HALF, HALF + WALL, 0.3, 0.72, channelWalls));
    endSection('top', null, ledge.at(ledge.length));

    // ---------------------------------------------------------------- 2. the funnel

    // A striped funnel standing out from the board on a bracket, its mouth tipped towards the
    // viewer (FUNNEL_TIP) so you can see into it. The ball rolls round and round inside it,
    // faster and faster as it narrows, and comes to rest low down in it, above the neck.
    beginSection();
    const FUNNEL = { x: 3.2, y: 15.2 + RAISE, z: 1.75 };
    const FUNNEL_TIP = 40 * DEG;
    const funnel = new THREE.Group();
    const funnelProfile = [];
    for (let i = 0; i <= 20; i++) {
      const v = i / 20; // up the funnel
      funnelProfile.push(new THREE.Vector2(0.38 + 1.07 * Math.pow(v, 1.35), -0.2 + 1.55 * v));
    }
    const funnelMaterial = M.stripes(C.red, C.white, 14);
    funnelMaterial.side = THREE.DoubleSide;
    funnel.add(mesh(new THREE.LatheGeometry(funnelProfile, 64), funnelMaterial));
    const funnelRed = M.paint(C.red);
    const funnelRimMesh = mesh(new THREE.TorusGeometry(1.45, 0.07, 10, 64).rotateX(Math.PI / 2), funnelRed);
    funnelRimMesh.position.y = 1.35;
    const neckMaterial = funnelRed.clone();
    neckMaterial.side = THREE.DoubleSide;
    const neck = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 32, 1, true), neckMaterial);
    neck.position.y = -0.45;
    funnel.add(funnelRimMesh, neck);
    funnel.rotation.x = FUNNEL_TIP;
    place(funnel, FUNNEL.x, FUNNEL.y, FUNNEL.z);
    for (const dx of [-0.75, 0.75]) root.add(zRod(FUNNEL.x + dx, FUNNEL.y + 0.2, 0, FUNNEL.z - 0.6, 0.05, steel));

    // The ball spirals in from near the rim (SPIRAL.r0 from the funnel's axis) to the neck
    // (SPIRAL.r1), resting against the inside of the wall all the way: at each distance from
    // the axis, as low as it can be without going into the wall (restHeight, worked out from
    // the funnel's own shape, its neck included). Then it drops down the axis, out of the neck.
    const SPIRAL_TURNS = 2.5;
    const SPIRAL = { r0: 1.05, r1: 0.12 };
    const funnelWall = [new THREE.Vector2(0.38, -0.7), ...funnelProfile]; // (the neck, then the funnel)
    function restHeight(r) {
      let y = -Infinity;
      for (let i = 0; i + 1 < funnelWall.length; i++) {
        const a = funnelWall[i];
        const b = funnelWall[i + 1];
        for (let k = 0; k <= 12; k++) {
          const dx = a.x + ((b.x - a.x) * k) / 12 - r;
          if (Math.abs(dx) < BALL_R) y = Math.max(y, a.y + ((b.y - a.y) * k) / 12 + Math.sqrt(BALL_R * BALL_R - dx * dx));
        }
      }
      return y + 0.01;
    }
    const restHeights = Array.from({ length: 101 }, (_, i) => restHeight(SPIRAL.r0 + (SPIRAL.r1 - SPIRAL.r0) * (i / 100)));
    const tipCos = Math.cos(FUNNEL_TIP);
    const tipSin = Math.sin(FUNNEL_TIP);
    // a point in the funnel's own terms (its axis up y), tipped and placed with it
    const tipped = (x, y, z, out) => out.set(FUNNEL.x + x, FUNNEL.y + y * tipCos - z * tipSin, FUNNEL.z + y * tipSin + z * tipCos);
    function inFunnel(u, out) {
      const angle = TAU * SPIRAL_TURNS * Math.pow(u, 1.4); // speeding up as it narrows
      const r = SPIRAL.r0 + (SPIRAL.r1 - SPIRAL.r0) * u;
      const i = Math.min(Math.floor(u * 100), 99);
      const f = u * 100 - i;
      const y = restHeights[i] + (restHeights[i + 1] - restHeights[i]) * f;
      return tipped(r * Math.cos(angle), y, r * Math.sin(angle), out);
    }
    const funnelRim = inFunnel(0, new THREE.Vector3());
    const funnelNeck = inFunnel(1, new THREE.Vector3());
    const funnelOut = tipped(0, -1.0, 0, new THREE.Vector3()); // (on the axis, below the neck)
    endSection('funnel', funnelRim, funnelOut);

    // ---------------------------------------------------------------- the plinko board

    // Below the funnel, rows of pegs sticking out of the board, each capped with a coloured
    // button. The ball drops out of the funnel onto the top row and bounces down from peg to
    // peg, one a row, each dipping as it is hit, then falls out of the bottom. It is as narrow
    // as a card's lane, on the right, so a card fits beside it (and the funnel) on the left.
    beginSection();
    const PEG_R = 0.12;
    const PEG_ROWS = 8;
    const ROW_TOP = 13.3 + RAISE; // the top row's height
    const ROW_GAP = 0.95;
    const pegColors = [C.hot, C.orange, C.yellow, C.green, C.blue, C.pink];
    const pegs = new Map(); // "row,x" -> { cap, y, bounce }
    for (let row = 0; row < PEG_ROWS; row++) {
      const y = ROW_TOP - row * ROW_GAP;
      const xs = row % 2 ? [2.25, 3.05, 3.85, 4.65] : [1.85, 2.65, 3.45, 4.25];
      xs.forEach((x, i) => {
        root.add(zRod(x, y, 0, BALL_Z + 0.4, PEG_R, steel));
        const cap = disc(0.2, 0.12, M.paint(pegColors[(row * 2 + i) % pegColors.length]));
        place(cap, x, y, BALL_Z + 0.46);
        pegs.set(row + ',' + x, { cap, bounce: struck(16, 6) });
      });
    }
    // The pegs the ball bounces off, one a row, the first under the funnel's neck: it lands on
    // top of each, rolls round it to the side it goes on to, and drops straight down through the
    // gap beside it onto the peg below (the pegs a row are just far enough apart for the ball to
    // pass between them).
    const PLINKO_PATH = [3.45, 3.05, 2.65, 3.05, 3.45, 3.85, 3.45, 3.05];
    const PEG_REACH = PEG_R + BALL_R + 0.005; // the ball's centre from a peg's, against it
    const plinkoStops = PLINKO_PATH.map((x, row) => {
      const y = ROW_TOP - row * ROW_GAP;
      return { at: P(x, y + PEG_REACH), peg: pegs.get(row + ',' + x), x, y };
    });
    endSection('plinko', plinkoStops[0].at, plinkoStops[plinkoStops.length - 1].at);

    // ---------------------------------------------------------------- 3. the seesaw

    // A striped plank on a fulcrum, resting with its left end up (SIDE: the end the ball lands
    // on, by the lanes above and below). The ball lands on it, it tips the other way (its right
    // end swinging up into the bell), and the ball rolls off the end it landed on.
    beginSection();
    const PIVOT = { x: 3.15, y: 12.4 };
    const TILT = 10 * DEG;
    const SIDE = -1;
    const PLANK = 1.0; // half its length (short, to stand in the machine's narrow column)
    const ON_PLANK = 0.07 + BALL_R; // the ball's centre above the plank's middle line
    const LAND = 0.7; // how far out along the plank the ball lands
    // the plank's angle, a part of the way (0 to 1) through tipping: from the ball's end (SIDE) up,
    // before it lands, to that end down, under its weight
    const plankAngle = (p) => SIDE * TILT * (1 - 2 * ease(p));
    const seesaw = new THREE.Group();
    seesaw.add(box(PLANK * 2, 0.14, 0.8, M.stripes(C.green, C.white, 2.5)));
    const pin = disc(0.13, 0.95, red);
    seesaw.add(pin);
    place(seesaw, PIVOT.x, PIVOT.y, BALL_Z);
    const fulcrum = new THREE.Shape();
    fulcrum.moveTo(-0.45, -0.85);
    fulcrum.lineTo(0.45, -0.85);
    fulcrum.lineTo(0, 0);
    fulcrum.closePath();
    place(extrude(fulcrum, 0.5, M.paint(C.orange), 0.04), PIVOT.x, PIVOT.y, BALL_Z - 0.25);
    root.add(zRod(PIVOT.x, PIVOT.y - 0.5, 0, BALL_Z - 0.2, 0.06, steel));

    // the ball's place on the plank, `along` it, with the plank at `angle`
    const onPlank = (along, angle, out) => out.set(
      PIVOT.x + along * Math.cos(angle) - ON_PLANK * Math.sin(angle),
      PIVOT.y + along * Math.sin(angle) + ON_PLANK * Math.cos(angle),
      BALL_Z,
    );

    // The bell, hanging over the plank's other end (right), struck when that end swings up.
    const bell = new THREE.Group();
    const bellRope = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), M.matte('#3a3a48', 0.8));
    bellRope.position.y = -0.22;
    const bellProfile = [];
    for (let i = 0; i <= 16; i++) {
      const v = i / 16;
      bellProfile.push(new THREE.Vector2(0.06 + 0.36 * Math.pow(v, 1.8), -v * 0.5));
    }
    const bellBody = mesh(new THREE.LatheGeometry(bellProfile, 40), brass);
    bellBody.material.side = THREE.DoubleSide;
    bellBody.position.y = -0.42;
    bell.add(bellRope, bellBody);
    const BELL = { x: PIVOT.x - SIDE * (PLANK * Math.cos(TILT) - 0.05), y: 13.75 };
    place(bell, BELL.x, BELL.y, BALL_Z);
    root.add(zRod(BELL.x, BELL.y, 0, BALL_Z, 0.03, sky));
    const bellSwing = struck(7, 1.1);
    // where the ball lands on the plank, and where it rolls off its end: up to its end, over the
    // plank's end corner (plankTip), and round it, until it leaves it (OFF_EDGE round), the way a
    // slowly rolling ball goes over an edge
    const landed = onPlank(SIDE * LAND, plankAngle(0), new THREE.Vector3());
    const OFF_EDGE = 50 * DEG;
    const plankTip = (() => {
      const a = plankAngle(1);
      const ex = SIDE * PLANK;
      return new THREE.Vector2(PIVOT.x + ex * Math.cos(a) - 0.07 * Math.sin(a), PIVOT.y + ex * Math.sin(a) + 0.07 * Math.cos(a));
    })();
    function overTip(turn, out) {
      const a = plankAngle(1);
      const up_ = new THREE.Vector2(-Math.sin(a), Math.cos(a)); // (off the plank's face)
      const on = new THREE.Vector2(SIDE * Math.cos(a), SIDE * Math.sin(a)); // (on, past its end)
      const r = BALL_R + 0.005;
      return out.set(
        plankTip.x + r * (up_.x * Math.cos(turn) + on.x * Math.sin(turn)),
        plankTip.y + r * (up_.y * Math.cos(turn) + on.y * Math.sin(turn)),
        BALL_Z,
      );
    }
    const plankEnd = overTip(0, new THREE.Vector3());
    const plankRelease = overTip(OFF_EDGE, new THREE.Vector3());
    endSection('seesaw', landed, plankRelease);

    // ---------------------------------------------------------------- 5. the launcher and the goal

    // A spring-loaded cup at the bottom right, set low: it sinks under the ball, then fires it.
    beginSection();
    const LAUNCH = P(3.6, 4.2); // the ball's centre, resting in the launcher
    const SINK = 0.35; // how far the spring is pressed down before it fires
    const SPRING_BASE = 2.45;
    const SPRING_LENGTH = LAUNCH.y - BALL_R - 0.08 - SPRING_BASE;
    place(box(1.0, 0.24, 0.9, navy), LAUNCH.x, SPRING_BASE - 0.12, BALL_Z);
    const coil = place(spring(0.26, SPRING_LENGTH, 6, 0.04, steel), LAUNCH.x, SPRING_BASE, BALL_Z);
    const plunger = place(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 32), M.paint(C.yellow)), LAUNCH.x, 0, BALL_Z);
    for (const dx of [-0.48, 0.48]) place(box(0.1, 1.9, 0.9, M.paint(C.red)), LAUNCH.x + dx, SPRING_BASE + 0.95, BALL_Z);
    place(box(1.06, 1.9, 0.08, M.stripes(C.red, C.white, 2.5)), LAUNCH.x, SPRING_BASE + 0.95, BALL_Z - 0.45);

    // Over it, a hood: a quarter-pipe curving up from the launcher and over to the left, into a
    // short level lip (out to HOOD_MOUTH). The ball, falling onto the lip, rolls along it and
    // round the hood down into the launcher; fired, it shoots up, round the hood and out along
    // the lip, and flies on off its end to the goal, so it turns against the hood, not in the air.
    const HOOD_R = 0.5;
    const HOOD_Y = SPRING_BASE + 1.95; // (the hood's curve starts just over the launcher's sides)
    const hoodPath = new Poly(arcPoints(LAUNCH.x - HOOD_R, HOOD_Y, HOOD_R, 0, 90));
    const HOOD_MOUTH = P(LAUNCH.x - HOOD_R - 0.6, HOOD_Y + HOOD_R - 0.03);
    const lipPath = new Poly([hoodPath.at(hoodPath.length), HOOD_MOUTH]);
    const hoodRed = M.paint(C.red);
    root.add(ribbon(hoodPath, -(HALF + WALL), HALF + WALL, 0, 0.3, M.paint(C.navy)));
    root.add(ribbon(hoodPath, -(HALF + WALL), -HALF, 0.3, 0.72, hoodRed)); // (the outside of the curve)
    root.add(ribbon(lipPath, -(HALF + WALL), HALF + WALL, 0, 0.3, M.paint(C.navy)));
    root.add(ribbon(lipPath, HALF, HALF + WALL, 0.3, 0.72, hoodRed)); // (the lip's floor)

    // The goal: a dotted cup on a post at the bottom left, with a starburst behind it.
    const GOAL = P(-2.9, 1.65);
    const goalColor = M.dots(C.blue, C.white, 3);
    for (const [w, h, d, x, y, z] of [
      [1.0, 0.1, 0.9, 0, -BALL_R - 0.05, 0],
      [0.1, 0.5, 0.9, -0.5, -0.12, 0],
      [0.1, 0.5, 0.9, 0.5, -0.12, 0],
      [1.0, 0.5, 0.08, 0, -0.12, -0.45],
    ]) place(box(w, h, d, goalColor), GOAL.x + x, GOAL.y + y, BALL_Z + z);
    place(box(0.22, GOAL.y - BALL_R - 0.6, 0.22, navy), GOAL.x, (GOAL.y - BALL_R - 0.1 + 0.3) / 2 + 0.05, BALL_Z);

    function starShape(points, outer, inner) {
      const s = new THREE.Shape();
      for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * TAU + Math.PI / 2;
        const r = i % 2 ? inner : outer;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.closePath();
      return s;
    }
    const starburst = new THREE.Group();
    starburst.add(extrude(starShape(10, 1.25, 0.6), 0.12, M.paint(C.hot), 0.03));
    const starCentre = extrude(starShape(10, 0.75, 0.42), 0.1, M.paint(C.yellow), 0.03);
    starCentre.position.z = 0.12;
    starburst.add(starCentre);
    place(starburst, GOAL.x, 3.15, 0.1);
    endSection('launch', HOOD_MOUTH, null); // (it stays where it is, at the foot of the board; the ball comes in onto the hood's lip)

    // ---------------------------------------------------------------- back to the top

    // A big red push button on the plinth at the foot of the machine, facing the viewer, with
    // a white arrow pointing up: clicking it sends everything back to the start (see
    // tall-main.js). It lights up a little when pointed at, and presses in when clicked.
    const topButton = new THREE.Group();
    topButton.add(extrude(roundedRect(-0.75, 0, 1.5, 1.5, 0.35), 0.5, [M.paint(C.yellow), M.paint(C.yellow)], 0.08));
    const buttonCap = new THREE.Group();
    const capMaterial = M.paint(C.red).clone(); // its own, so it alone lights up
    buttonCap.add(disc(0.5, 0.3, capMaterial));
    const upArrow = new THREE.Shape();
    upArrow.moveTo(0, 0.32);
    upArrow.lineTo(0.27, 0.04);
    upArrow.lineTo(0.1, 0.04);
    upArrow.lineTo(0.1, -0.28);
    upArrow.lineTo(-0.1, -0.28);
    upArrow.lineTo(-0.1, 0.04);
    upArrow.lineTo(-0.27, 0.04);
    upArrow.closePath();
    const upArrowMesh = extrude(upArrow, 0.06, M.paint(C.white), 0.02);
    upArrowMesh.position.z = 0.15;
    buttonCap.add(upArrowMesh);
    buttonCap.position.set(0, 0.75, 0.62);
    topButton.add(buttonCap);
    place(topButton, 0.9, 0, 2.2); // (a little right of the middle, so a phone shows it beside the goal)
    const CAP_Z = 0.62;
    let pressedAt = -Infinity;
    let lit = 0; // 0..1, how lit up it is
    let lighting = 0; // what it is easing towards
    animators.push((dt) => {
      const since = simT - pressedAt;
      buttonCap.position.z = CAP_Z - 0.16 * (since < 0.5 ? Math.exp(-6 * since) : 0);
      lit += (lighting - lit) * (1 - Math.exp(-12 * dt));
      capMaterial.emissive.setRGB(0.35 * lit, 0.05 * lit, 0.05 * lit);
      buttonCap.scale.setScalar(1 + 0.08 * lit);
    });

    // ---------------------------------------------------------------- decoration

    // (each in the section it stands by)

    // A striped cloud at the top, over the first card, bobbing.
    const cloud = extrude(cloudShape(), 0.25, [M.stripes(C.hot, C.white, 3.4), M.paint(C.white)], 0.05);
    cloud.scale.setScalar(0.75);
    const CLOUD_Y = 25.0 + RAISE;
    placeIn('top', cloud, 1.1, CLOUD_Y, 0.12);

    // A flower spinning on a stick at the top, beside the cup.
    const pinwheelFlower = RG.burst(12, 0.85, [M.paint(C.orange), M.paint(C.white)], M.paint(C.blue));
    placeIn('top', pinwheelFlower, -2.4, 24.9 + RAISE, 0.4);
    placeIn('top', zRod(0, 0, 0, 0.4, 0.06, steel), -2.4, 24.9 + RAISE, 0.2);
    animators.push(() => { pinwheelFlower.rotation.z = simT * 0.5; });

    // A yellow hand low on the board's left, between the last two cards, waving hello: one outline (palm, four
    // fingers with narrow gaps between them, and the thumb angled off to the right), extruded
    // once, so its rounded edges run unbroken all the way round.
    function handShape() {
      const s = new THREE.Shape();
      const PALM = 0.48; // half the palm's width
      const CORNER = 0.18; // the palm's rounded bottom corners (under where the thumb leaves it)
      const VALLEY = 0.88; // how high the gaps between the fingers reach down to
      const FINGER = 0.219; // a finger's width
      const GAP = (2 * PALM - 4 * FINGER) / 3;
      const TIPS = [1.24, 1.43, 1.48, 1.36]; // little finger to index finger, left to right
      const fillet = (corner, from, to) => {
        // a soft inside corner: from a point on the way in to one on the way out, round `corner`
        s.lineTo(from.x, from.y);
        s.quadraticCurveTo(corner.x, corner.y, to.x, to.y);
      };
      // the thumb: a capsule leaning out to the right, its lower edge leaving the palm at J1,
      // low on it (as a thumb does, from near the wrist), its tip about halfway up the palm
      const lean = new THREE.Vector2(Math.sin(50 * DEG), Math.cos(50 * DEG)); // along it, outwards
      const across = new THREE.Vector2(lean.y, -lean.x); // its lower side
      const THUMB_R = 0.11;
      const J1 = new THREE.Vector2(PALM, 0.24);
      const tip = J1.clone().addScaledVector(lean, 0.42).addScaledVector(across, -THUMB_R);
      const upper = tip.clone().addScaledVector(across, -THUMB_R); // its upper edge, at the tip
      const J2 = new THREE.Vector2(PALM, upper.y - ((upper.x - PALM) * lean.y) / lean.x); // where that meets the palm
      const angle = Math.atan2(across.y, across.x);

      // anticlockwise from the bottom middle
      s.moveTo(0, 0);
      s.absarc(PALM - CORNER, CORNER, CORNER, -Math.PI / 2, 0, false);
      fillet(J1, new THREE.Vector2(PALM, J1.y - 0.05), J1.clone().addScaledVector(lean, 0.05));
      s.absarc(tip.x, tip.y, THUMB_R, angle, angle + Math.PI, false);
      fillet(J2, J2.clone().addScaledVector(lean, 0.07), new THREE.Vector2(PALM, J2.y + 0.07));
      // the fingers, right to left: up each one's right side, round its tip, down its left side
      // and round the bottom of the gap
      for (let i = 3; i >= 0; i--) {
        const x0 = -PALM + i * (FINGER + GAP);
        const r = FINGER / 2;
        s.absarc(x0 + r, TIPS[i] - r, r, 0, Math.PI, false);
        if (i > 0) s.absarc(x0 - GAP / 2, VALLEY, GAP / 2, 0, -Math.PI, true);
      }
      s.absarc(-PALM + CORNER, CORNER, CORNER, Math.PI, Math.PI * 1.5, false);
      s.closePath();
      return s;
    }
    const hand = extrude(handShape(), 0.22, [M.paint(C.yellow), M.paint(C.yellow)], 0.05);
    hand.scale.setScalar(1.05);
    // (it stands low on the board's left, between the last two cards: placed once they are: see
    // "the cards, spaced out")

    // Arrows along the bottom, from the launcher towards the goal.
    for (const [x, y, angle] of [[2.6, 3.2, 180], [1.9, 3.2, 180]]) {
      place(arrow(yellow), x, y, 0).rotation.z = angle * DEG;
    }

    // A pink polka-dot flower, made of overlapping discs, at the bottom right.
    const flower = new THREE.Group();
    const flowerMaterial = M.dots(C.pink, C.white, 3);
    for (let i = 0; i < 8; i++) {
      const petal = disc(0.3, 0.24, flowerMaterial, M.paint(C.pink));
      petal.position.set(Math.cos((i / 8) * TAU) * 0.42, Math.sin((i / 8) * TAU) * 0.42, 0);
      flower.add(petal);
    }
    flower.add(disc(0.45, 0.26, flowerMaterial, M.paint(C.pink)));
    place(flower, 2.6, 1.2, 0.3);

    // A striped half-moon on the base.
    const halfMoon = new THREE.Shape();
    halfMoon.absarc(0, 0, 0.95, 0, Math.PI);
    halfMoon.closePath();
    place(extrude(halfMoon, 0.3, [M.stripes(C.navy, C.yellow, 2.2), M.paint(C.navy)], 0.05), -0.6, 0.3, 0.05);

    // A green cube with eyes, watching the visitor's cursor (or, with no cursor, the ball). (The
    // ball bounces off its top on the way to the goal: ON_CUBE, in "the ball and its route".)
    place(box(1.2, 1.2, 1.2, M.paint(C.green)), 0.6, 2.9, 0.75);
    const pupils = [-0.26, 0.26].map((dx) => {
      place(disc(0.21, 0.04, M.paint(C.white)), 0.6 + dx, 3.0, 1.37);
      return { x: 0.6 + dx, y: 3.0, ox: 0, oy: 0, pupil: place(disc(0.1, 0.04, M.paint(C.black)), 0.6 + dx, 3.0, 1.41) };
    });
    let gaze = null; // where the cursor points, at the eyes' depth (set by tall-main.js), or null

    // The hand waves gently, and clicked (tall-main.js), waves faster and wider for a few
    // seconds, easing into it and back out of it. (Its swing is kept as a running phase, so
    // changing its speed never makes it jump.)
    const WAVE = { speed: 2.4, swing: 0.12 }; // as it idles
    const EAGER = { speed: 14, swing: 0.36, time: 2.6, into: 0.15, outOf: 0.7 }; // clicked
    let eagerFrom = -Infinity;
    let wavePhase = 0;
    function eagerness() {
      const since = simT - eagerFrom;
      if (since < 0 || since > EAGER.time) return 0;
      const k = Math.min(since / EAGER.into, 1, (EAGER.time - since) / EAGER.outOf);
      return k * k * (3 - 2 * k);
    }

    animators.push((dt) => {
      cloud.position.y = CLOUD_Y + 0.08 * Math.sin(simT * 1.1);
      const k = eagerness();
      wavePhase += dt * (WAVE.speed + (EAGER.speed - WAVE.speed) * k);
      hand.rotation.z = (WAVE.swing + (EAGER.swing - WAVE.swing) * k) * Math.sin(wavePhase);
    });

    // ---------------------------------------------------------------- the white cards' lanes

    // The white cards (tall-main.js puts them on the page), CARD in size, take the left of the
    // board (within COLUMN either side of the middle), and the machine the right: a lane as wide
    // as what's left (LANE_W). Between its sections, lanes take the ball on down, one under
    // another (LANE_GAP apart): in each, one of four contraptions (LANE_H tall): a ladder of toy
    // blocks it hops down, a column of pegs it bounces down, a switchback channel, or a cascade
    // of wire rails.
    //
    // The ball moves between them as a real ball would: off the end of a channel or a rail it
    // flies on at the speed it was rolling, falling in an arc; off a peg it rolls round it and
    // drops straight down beside it; off a block it bounces a little and falls. So each contraption
    // starts where the ball lands (entry), and those it leaves rolling off an end shape their
    // last run or rail so it lands just where it should next.
    const CARD = { w: 5.8, h: 3.6 };
    const COLUMN = 4.85;
    const LANE_W = 3.4;
    const LANE_H = 4.0;
    const LANE_GAP = 1.7;
    const RAIL_DROP = 0.27; // the rails' wires, down from the ball's centre (so it rests on them)
    const cards = []; // each card's [left, bottom, right, top], on the board's face
    const laneColors = [C.hot, C.orange, C.yellow, C.green, C.blue, C.pink];
    let colorIndex = 0;
    const nextColor = () => laneColors[colorIndex++ % laneColors.length];
    const dipping = []; // (every frame) the blocks that dip and the pegs that pulse when hit

    // how long it takes to fall a height h from rest (or from rolling along the level)
    const fallTime = (h) => Math.sqrt((2 * Math.max(h, 0.02)) / GRAVITY);
    // A fall from a down to b, as a ball rolling off something falls: straight on across at the
    // speed it was going, and down faster and faster.
    function fall(a, b, landing) {
      const T = fallTime(a.y - b.y);
      hop(a, b, T, landing ? { onStart: () => after(T, landing) } : undefined);
    }
    // Rolling off a peg the ball is on (at `from`), round it to its side (`dir`), where it drops
    // straight down past it: the point it rolls to.
    function offPeg(peg, from, dir) {
      const a0 = (Math.atan2(from.y - peg.y, from.x - peg.x) * 180) / Math.PI;
      const arc = new Poly(arcPoints(peg.x, peg.y, PEG_REACH, a0, dir > 0 ? 0 : 180));
      roll(arc, 0.5, 1.6);
      return arc.at(arc.length);
    }
    const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

    // Each contraption fills a lane (from x0 to x1, from yTop down LANE_H). It is given where the
    // ball lands in it (entry: an x, or null to choose for itself: then on the far side from
    // where the ball comes from, fromX, so it has room to get there), and what comes after it
    // (out: how far below its end that is, h, and, for a section below, where, x, and how fast
    // the ball should be going, v; and, after a ladder of blocks, where what's next starts, if
    // that is already settled, nextFirst). It gives where the ball starts in it (start), what
    // happens when it lands there (arrive), its route through it (route), the way out of it to
    // what's next (leave), where the ball leaves it (endX), and where what's next must start,
    // if it decides (exitX). Each also says, beforehand, where it would start (first).
    const awayFrom = (fromX, mid, near, far) => (fromX != null && fromX < mid ? far : near);

    // A ladder of toy blocks in two columns, the ball hopping from one to the next down across,
    // and bouncing a little off the last, on to whatever is next: four blocks or five, so the last
    // is the one in the column further from where the next thing starts.
    blockLadder.first = ({ x0, x1, mid, entry, fromX }) => entry ?? awayFrom(fromX, mid, x0 + 0.85, x1 - 0.85);
    function blockLadder(ctx) {
      const { x0, x1, mid, yTop } = ctx;
      const first = blockLadder.first(ctx);
      const other = clamp(first + (first < mid ? 1.7 : -1.7), x0 + 0.55, x1 - 0.55);
      const n = ctx.nextFirst != null && Math.abs(other - ctx.nextFirst) > Math.abs(first - ctx.nextFirst) ? 4 : 5;
      const finishes = [
        (c) => M.paint(c), (c) => M.dots(c, C.white, 2), (c) => M.paint(c), (c) => M.stripes(c, C.white, 2),
      ];
      const stops = [];
      for (let k = 0; k < n; k++) {
        const x = k % 2 ? other : first;
        const y = yTop - (LANE_H * k) / (n - 1);
        const restY = y - BALL_R - 0.31;
        const block = place(box(0.9, 0.62, 0.9, finishes[k % finishes.length](nextColor())), x, restY, BALL_Z);
        root.add(zRod(x, restY, 0, BALL_Z - 0.4, 0.05, steel));
        const bounce = struck(18, 7);
        dipping.push(() => { block.position.y = restY - 0.07 * bounce.value(); });
        stops.push({ at: P(x, y), bounce });
      }
      return {
        start: stops[0].at,
        arrive: () => stops[0].bounce.hit(),
        endX: stops[n - 1].at.x,
        route() {
          for (let k = 1; k < n; k++) {
            hop(stops[k - 1].at, stops[k].at, 0.36, { onStart: () => after(0.36, () => stops[k].bounce.hit()) });
          }
        },
        leave(next) {
          const a = stops[n - 1].at;
          const T = 0.12 + fallTime(a.y - next.start.y); // (a little bounce off it: clear of its edge, and of the block over it)
          hop(a, next.start, T, next.arrive ? { onStart: () => after(T, next.arrive) } : undefined);
        },
      };
    }

    // Where a ball rolling off an end (going `dir`, at v) lands, h below and onto `landing`: the
    // end's x, kept to within lo and hi. (So a contraption ending that way can shape its end.)
    const endFor = (landing, dir, v, h, lo, hi) => clamp(landing - dir * v * fallTime(h), lo, hi);

    // A switchback channel like the zigzag's, folded back and forth down the lane, its last run
    // ending where the ball, rolling off it, flies on to land where it should next.
    // (its first run's direction and where it starts: toward the far side; or, if it must end
    // going a set way, to land on a section below, the other way to that)
    function switchbackStart({ x0, x1, mid, entry, fromX, out }) {
      const xa = x0 + 1.05;
      const xb = x1 - 1.05;
      if (out.x != null) {
        const firstDir = -(Math.sign(out.x - mid) || 1);
        return { firstDir, first: entry ?? (firstDir > 0 ? xa - 0.35 : xb + 0.35) };
      }
      const first = entry ?? awayFrom(fromX, mid, xa - 0.35, xb + 0.35);
      return { firstDir: first < mid ? 1 : -1, first };
    }
    switchback.first = (ctx) => switchbackStart(ctx).first;
    function switchback(ctx) {
      const { x0, x1, mid, yTop, out } = ctx;
      const r = 0.55; // the hairpins' radius
      const xa = x0 + 1.05;
      const xb = x1 - 1.05;
      const turns = 3; // (so the last run goes the other way to the first)
      const v = out.v ?? 2.6;
      const { firstDir, first } = switchbackStart(ctx);
      const lastDir = -firstDir;
      const landing = out.x ?? (lastDir > 0 ? x1 - 0.7 : x0 + 0.7);
      const endX = lastDir > 0
        ? endFor(landing, lastDir, v, out.h, xa + 0.3, x1 - 0.25)
        : endFor(landing, lastDir, v, out.h, x0 + 0.25, xb - 0.3);
      const drop = (LANE_H - turns * 2 * r) / (turns + 1); // each run's fall
      let dir = firstDir;
      let y = yTop;
      const points = [P(first, y)];
      for (let k = 0; k <= turns; k++) {
        const runTo = k < turns ? (dir > 0 ? xb : xa) : endX;
        y -= drop;
        points.push(P(runTo, y));
        if (k < turns) {
          points.push(...arcPoints(runTo, y - r, r, 90, dir > 0 ? -90 : 270).slice(1));
          y -= 2 * r;
          dir = -dir;
        }
      }
      const path = new Poly(points);
      root.add(ribbon(path, -(HALF + WALL), HALF + WALL, 0, 0.3, channelFloor));
      // (the wall on the upper side of the first run starts a little way in, so the ball can
      // drop in: going right, the upper side is the left of the way it goes)
      root.add(ribbon(path, -(HALF + WALL), -HALF, 0.3, 0.72, channelWalls, firstDir < 0 ? 0.7 : 0));
      root.add(ribbon(path, HALF, HALF + WALL, 0.3, 0.72, channelWalls, firstDir < 0 ? 0 : 0.7));
      const end = path.at(path.length);
      return {
        start: path.at(0),
        endX: endX,
        exitX: endX + lastDir * v * fallTime(out.h),
        route() { roll(path, 0.8, v); },
        leave(next) { fall(end, next.start, next.arrive); },
      };
    }

    // ---- the lanes' other contraptions, each used once (after the toy-box machines in the
    // reference drawings: a paddle wheel, a staircase, a twisting pipe, a helter-skelter, a
    // xylophone and drum, a bucket on a pulley, and a kicking boot). Each takes the ball where it
    // lands (entry) as the ones above do, and the ones that can be told where to send it (out.x)
    // send it there.
    const startAt = ({ entry, mid }) => entry ?? mid;
    // the way down from a point a little below the path, for a part the ball rides on top of
    const under = (a, b, d) => {
      const t = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
      const n = t.y > 0 ? new THREE.Vector2(t.y, -t.x) : new THREE.Vector2(-t.y, t.x);
      return n.y > 0 ? n.negate().multiplyScalar(d) : n.multiplyScalar(d);
    };
    // Rolling off an edge the way a ball does (not straight off its end, through its corner): on
    // round the edge's corner, from where it is on top of it (from), going `dir`, until it leaves
    // it, 50° round (or `turn`). The way round, as a path; its end is where it leaves the edge.
    const edgeArc = (corner, from, dir, turn = 50) => {
      const a0 = (Math.atan2(from.y - corner.y, from.x - corner.x) * 180) / Math.PI;
      return new Poly(arcPoints(corner.x, corner.y, BALL_R + 0.005, a0, a0 - dir * turn));
    };
    // the time a segment of the route starts, once it is set (for parts that move with the ball)
    const lastSegment = () => segments[segments.length - 1];
    const segmentU = (seg) => (seg ? clamp01((loopT - seg.t0) / seg.T) : 0);

    // A paddle wheel like the marble wall's: a blue wheel with red blades. The ball drops onto
    // a blade, rides it down the wheel's side (its weight turning the wheel), rolls out along it
    // as it tips below level, and drops off its end.
    paddleWheel.first = startAt;
    function paddleWheel(ctx) {
      const { x0, x1, mid, yTop } = ctx;
      const want = startAt(ctx);
      const RW = 1.05; // the blades' reach
      const RB = 0.72; // how far out the ball rides
      const LIFT = BALL_R + 0.06; // the ball's centre off a blade's middle
      const BLADES = 6;
      const A1 = -35 * DEG; // where it rolls off (below level)
      const s = want < mid ? 1 : -1; // the side it rides down (towards the lane's middle)
      // the ball on a blade at `a` above level on side s, r out from the hub c
      const onBlade = (c, a, r) => P(c.x + s * (r * Math.cos(a) - LIFT * Math.sin(a)), c.y + r * Math.sin(a) + LIFT * Math.cos(a));
      const c = new THREE.Vector2(0, yTop - LANE_H / 2 + 0.2);
      c.x = clamp(want - onBlade(new THREE.Vector2(0, 0), 50 * DEG, RB).x, x0 + RW + 0.15, x1 - RW - 0.15);
      // (the blade it lands on: the angle that puts it just under where it falls)
      let a0 = 50 * DEG;
      for (let deg = 25, best = Infinity; deg <= 80; deg += 0.5) {
        const miss = Math.abs(onBlade(c, deg * DEG, RB).x - want);
        if (miss < best) { best = miss; a0 = deg * DEG; }
      }
      const blade = (a) => (s > 0 ? a : Math.PI - a); // a blade's angle, as the wheel turns
      const wheel = new THREE.Group();
      wheel.add(disc(RW + 0.12, 0.1, M.paint(C.blue), M.paint(C.navy)).translateZ(-0.42)); // (behind the ball)
      for (let k = 0; k < BLADES; k++) {
        const arm = new THREE.Group();
        const paddle = box(RW, 0.12, 0.62, M.paint(C.red));
        paddle.position.x = RW / 2;
        arm.add(paddle);
        arm.rotation.z = blade(a0) + (k * TAU) / BLADES;
        wheel.add(arm);
      }
      wheel.add(disc(0.24, 0.7, M.paint(C.red), M.paint(C.white)));
      place(wheel, c.x, c.y, BALL_Z);
      root.add(zRod(c.x, c.y, 0, BALL_Z - 0.3, 0.07, steel));
      let ride = null;
      dipping.push(() => { wheel.rotation.z = (blade(a0 + (A1 - a0) * ease(segmentU(ride))) - blade(a0)); });
      const caught = onBlade(c, a0, RB);
      const tipped = onBlade(c, A1, RB);
      const atTip = onBlade(c, A1, RW); // (over the blade's end)
      // and on round the end of the blade, until it drops off, clear of it
      const tipCorner = new THREE.Vector2(
        c.x + s * (RW * Math.cos(A1) - 0.06 * Math.sin(A1)),
        c.y + RW * Math.sin(A1) + 0.06 * Math.cos(A1),
      );
      const overTip = edgeArc(tipCorner, atTip, s);
      const release = overTip.at(overTip.length);
      return {
        start: caught,
        endX: release.x,
        exitX: release.x,
        route() {
          segment(1.3, (u, out) => out.copy(onBlade(c, a0 + (A1 - a0) * ease(u), RB)));
          ride = lastSegment();
          roll(new Poly([tipped, atTip]), 0.4, 1.0);
          roll(overTip, 1.0, 1.0);
        },
        leave(next) { fall(release, next.start, next.arrive); },
      };
    }

    // A hop from a to b, bouncing just high enough (the longer it takes, the higher) to clear the
    // corner of the edge it goes over by `room`.
    function clearHop(a, b, corner, room = 0.03) {
      for (let T = 0.3; T < 1.2; T += 0.02) {
        const vy = (b.y - a.y + 0.5 * GRAVITY * T * T) / T;
        let clear = true;
        for (let k = 1; k < 40 && clear; k++) {
          const t = (T * k) / 40;
          const x = a.x + ((b.x - a.x) * k) / 40;
          const y = a.y + vy * t - 0.5 * GRAVITY * t * t;
          if (Math.hypot(x - corner.x, y - corner.y) < BALL_R + room) clear = false;
        }
        if (clear) return T;
      }
      return 1.2;
    }

    // A staircase of chunky coloured steps, like the marble wall's, the ball bouncing down it a
    // step at a time and rolling off the bottom step, flying on: on towards the far side; or,
    // to land just where it should next, if that's set, with its steps as wide as it takes
    // from where the ball lands on the first to where it must leave the last (it then stands low
    // in the lane, its last step at the lane's foot).
    const STEP_LEAD = (BALL_R + 0.005) * Math.sin(50 * DEG); // (how far on past a step's edge it leaves it)
    function stairsPlan({ x0, x1, mid, yTop, entry, out }) {
      const v = out.v ?? 1.2;
      if (out.x != null) {
        const dir = Math.sign(out.x - mid) || -1; // (arriving going that way, from the middle's side)
        const edge = out.x - dir * v * fallTime(out.h) - dir * STEP_LEAD; // the last step's edge
        const N = 4;
        const start = entry ?? clamp(edge - dir * (N - 0.5) * 0.45, x0 + 0.3, x1 - 0.3);
        const W = clamp(((edge - start) * dir) / (N - 0.5), 0.3, 0.7);
        const firstTop = yTop - 1.0;
        const lastTop = yTop - LANE_H - BALL_R + 0.08;
        return { v, dir, N, W, start, RISE: (firstTop - lastTop) / (N - 1), firstTop };
      }
      const start = entry ?? mid;
      const dir = start < mid ? 1 : -1; // (down towards the far side, where there's room)
      // (leaving room past the last step for the ball to fly on, still over the lane)
      const room = (dir > 0 ? x1 - 0.4 - start : start - (x0 + 0.4)) - 0.25 - v * fallTime(out.h);
      const N = room > 2.1 ? 5 : 4;
      return { v, dir, N, W: clamp(room / (N - 0.5), 0.38, 0.6), start, RISE: (LANE_H - 0.7) / N, firstTop: yTop - 0.35 };
    }
    staircase.first = (ctx) => stairsPlan(ctx).start;
    function staircase(ctx) {
      const { out } = ctx;
      const { v, dir, N, W, start, RISE, firstTop } = stairsPlan(ctx);
      const steps = [];
      const colors = [C.hot, C.orange, C.yellow, C.green, C.blue];
      for (let k = 0; k < N; k++) {
        const cx = start + dir * k * W;
        const top = firstTop - k * RISE; // the step's top face
        const tread = place(box(W + 0.02, 0.16, 0.95, M.paint(colors[k % colors.length])), cx, top - 0.08, BALL_Z);
        if (k + 1 < N) {
          const nextTop = top - RISE;
          place(box(0.14, RISE - 0.16, 0.95, M.stripes(C.navy, C.white, 2)), cx + dir * (W / 2 - 0.07), (top - 0.16 + nextTop) / 2, BALL_Z);
        }
        root.add(zRod(cx, top - 0.08, 0, BALL_Z - 0.4, 0.05, steel));
        const bounce = struck(18, 7);
        dipping.push(() => { tread.position.y = top - 0.08 - 0.05 * bounce.value(); });
        // (where the ball lands on it: on the first, in its middle; on the rest, far enough out
        // that, coming down, it's clear of the edge of the step above)
        const landX = k === 0 ? cx : cx - dir * (W / 2) + dir * Math.min(W - 0.04, Math.max(W / 2, BALL_R + 0.08));
        steps.push({ at: P(landX, top + BALL_R), corner: new THREE.Vector2(cx + dir * (W / 2), top), bounce });
      }
      const last = steps[N - 1].at;
      const edge = P(last.x + dir * (W / 2), last.y);
      const over = edgeArc(new THREE.Vector2(edge.x, edge.y - BALL_R), edge, dir);
      const end = over.at(over.length);
      return {
        start: steps[0].at,
        arrive: () => steps[0].bounce.hit(),
        endX: end.x,
        exitX: out.x ?? end.x + dir * v * fallTime(out.h),
        route() {
          for (let k = 1; k < N; k++) {
            const T = clearHop(steps[k - 1].at, steps[k].at, steps[k - 1].corner);
            hop(steps[k - 1].at, steps[k].at, T, { onStart: () => after(T, () => steps[k].bounce.hit()) });
          }
          roll(new Poly([last, edge]), 0.6, v);
          roll(over, v, v);
        },
        leave(next) { fall(end, next.start, next.arrive); },
      };
    }

    // A twisting pipe of clear tinted glass with coloured bands round it: the ball drops into its
    // funnel mouth, runs down inside it, swinging out to the far side and back, and shoots out of
    // its spout, flying on (to just where it should go next, if that is set).
    twistPipe.first = startAt;
    function twistPipe(ctx) {
      const { x0, x1, mid, yTop, out } = ctx;
      const start = startAt(ctx);
      const v = out.v ?? 2.2;
      const yEnd = yTop - LANE_H;
      const sdir = out.x != null ? (out.x < mid ? -1 : 1) : (start < mid ? 1 : -1); // the spout's way
      const spoutX = out.x != null
        ? clamp(out.x - sdir * v * fallTime(out.h), x0 + 0.5, x1 - 0.5)
        : (sdir > 0 ? x1 - 0.5 : x0 + 0.5);
      const far = sdir > 0 ? x0 + 0.9 : x1 - 0.9; // (it swings out this way first)
      const curve = new THREE.CatmullRomCurve3([
        P(start, yTop - 0.35), P(start, yTop - 0.95), P(far, yTop - 1.75), P(far, yTop - 2.45),
        P(spoutX - sdir * 0.95, yEnd + 0.35), P(spoutX - sdir * 0.35, yEnd + 0.03), P(spoutX, yEnd),
      ], false, 'centripetal');
      const path = new Poly(curve.getSpacedPoints(160));
      const glass = new THREE.MeshStandardMaterial({ color: C.sky, transparent: true, opacity: 0.4, roughness: 0.12, depthWrite: false });
      const tube = mesh(new THREE.TubeGeometry(curve, 220, 0.4, 24, false), glass, false);
      root.add(tube);
      // its bands, every so often along it, from its top to just short of the spout (clear of
      // the ball flying out)
      const bands = Math.round(curve.getLength() / 0.75);
      for (let k = 0; k < bands; k++) {
        const u = k / bands;
        const p = curve.getPointAt(u);
        const band = mesh(new THREE.TorusGeometry(0.42, 0.055, 10, 32), M.paint(nextColor()));
        band.position.copy(p);
        band.lookAt(p.clone().add(curve.getTangentAt(u)));
        root.add(band);
      }
      // the funnel mouth over its top, and the clips holding it to the board
      const mouthProfile = [new THREE.Vector2(0.4, 0), new THREE.Vector2(0.48, 0.12), new THREE.Vector2(0.72, 0.42)];
      const mouth = mesh(new THREE.LatheGeometry(mouthProfile, 40), Object.assign(M.paint(nextColor()).clone(), { side: THREE.DoubleSide }));
      place(mouth, start, yTop - 0.35, BALL_Z);
      for (const u of [0.25, 0.55, 0.85]) {
        const p = curve.getPointAt(u);
        root.add(zRod(p.x, p.y, 0, BALL_Z - 0.4, 0.05, steel));
      }
      const end = path.at(path.length);
      return {
        start: path.at(0),
        endX: end.x,
        exitX: end.x + sdir * v * fallTime(out.h),
        route() { roll(path, 0.6, v); },
        leave(next) { fall(end, next.start, next.arrive); },
      };
    }

    // A helter-skelter: two wires wound one and a half times round a striped pole standing out
    // from the board, the ball spiralling down them (round the front, behind the pole, round the
    // front again) and flying off the bottom, behind the pole, going across the lane.
    helterSkelter.first = startAt;
    function helterSkelter(ctx) {
      const { x0, x1, yTop, out } = ctx;
      const want = startAt(ctx);
      // (which way round it winds: going on, in front, the way the ball comes in, across)
      const spin = ctx.arriving > 0 ? -1 : 1;
      const R_H = 0.75; // the ball's path, out from the pole
      const TURNS = 1.5;
      const v = out.v ?? 2.0;
      // Where the pole stands: so that the ball, leaving the last turn (behind it, as far the other
      // side of it as it landed on this side) and flying on, lands where what's next would like
      // it, if that's known; within the lane (it may stand a little out over the lane's inner
      // edge, clear of the cards).
      const lo = Math.max(x0 + 0.58, want - 0.95 * R_H);
      const hi = Math.min(x1 - 0.95, want + 0.95 * R_H);
      let cx = clamp(want, lo, hi);
      if (ctx.nextFirst != null) {
        for (let k = 0; k < 4; k++) {
          const sin = Math.sqrt(Math.max(1 - ((want - cx) / R_H) ** 2, 0));
          cx = clamp((ctx.nextFirst - spin * v * sin * fallTime(out.h) + want) / 2, lo, hi);
        }
      }
      const cz = R_H + BALL_R + 0.2; // (so its back turns are clear of the board)
      const phi0 = Math.acos(clamp((want - cx) / R_H, -1, 1)); // (in front of the pole)
      const y0 = yTop - 0.3;
      const y1 = yTop - LANE_H + 0.45;
      const pointAt = (u, dr = 0, dy = 0) => {
        const phi = phi0 + spin * TAU * TURNS * u; // (round to the left, in front, or the other way)
        return new THREE.Vector3(cx + (R_H + dr) * Math.cos(phi), y0 + (y1 - y0) * u + dy, cz + (R_H + dr) * Math.sin(phi));
      };
      const SAMPLES_H = 260;
      const path = new Poly(Array.from({ length: SAMPLES_H + 1 }, (_, k) => pointAt(k / SAMPLES_H)));
      const wireMaterial = M.paint(nextColor(), 0.35);
      const WIRE_END = SAMPLES_H - 12; // (the wires stop a little short of where it flies off, clear of it)
      for (const dr of [-0.15, 0.15]) {
        // (a little further down than a straight rail's, as the path slopes)
        const curve = new THREE.CatmullRomCurve3(Array.from({ length: WIRE_END + 1 }, (_, k) => pointAt(k / SAMPLES_H, dr, -RAIL_DROP - 0.02)));
        root.add(mesh(new THREE.TubeGeometry(curve, WIRE_END * 2, 0.035, 8), wireMaterial));
      }
      // the pole, its cap, the spokes holding the wires, and the brackets holding it to the board
      const poleTop = y0 + 0.05; // (its cap just over the top turn, clear of the ball dropping in)
      const poleFoot = y1 - 0.55;
      const pole = mesh(new THREE.CylinderGeometry(0.2, 0.2, poleTop - poleFoot, 24), M.stripes(C.hot, C.white, 6, Math.PI / 2));
      pole.position.set(cx, (poleTop + poleFoot) / 2, cz);
      root.add(pole);
      const cap = mesh(new THREE.SphereGeometry(0.3, 24, 16), M.dots(C.yellow, C.white, 3));
      cap.position.set(cx, poleTop + 0.2, cz);
      root.add(cap);
      for (let k = 0; k < TURNS * 4; k++) {
        const u = k / (TURNS * 4);
        const p = pointAt(u, 0, -RAIL_DROP - 0.1);
        const spoke = mesh(new THREE.CylinderGeometry(0.025, 0.025, R_H + 0.15, 6), wireMaterial);
        spoke.position.set((cx + p.x) / 2, p.y, (cz + p.z) / 2);
        spoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.x - cx, 0, p.z - cz).normalize());
        root.add(spoke);
      }
      // (its bracket at its top, clear of the ball spiralling round and flying off the bottom)
      root.add(zRod(cx, poleTop - 0.25, 0, cz, 0.08, steel));
      const end = path.at(path.length);
      const leaving = path.at(path.length).sub(path.at(path.length - 0.05)).normalize();
      return {
        start: path.at(0),
        endX: end.x,
        exitX: end.x + leaving.x * v * fallTime(out.h),
        route() { roll(path, 0.8, v); },
        leave(next) { fall(end, next.start, next.arrive); },
      };
    }

    // A xylophone and a drum: the ball rolls down a run of rainbow keys (each ringing as it
    // goes over), flies off its end onto a drum, bounces up off it, back the other way, onto a
    // second run of keys under the first, and rolls off that, flying on (to just where it should
    // go next, if that is set: its second run ends going towards that side).
    xylophone.first = ({ entry, out, x0, x1, mid }) => entry ?? (out && out.x != null ? (out.x < mid ? x0 + 0.6 : x1 - 0.6) : mid);
    function xylophone(ctx) {
      const { x0, x1, mid, yTop, out } = ctx;
      const start = xylophone.first(ctx);
      const aimed = out.x != null;
      const dir = aimed ? (out.x < mid ? 1 : -1) : (start < mid ? 1 : -1); // (run 1's way; run 2 comes back)
      const DRUM_R = 0.42;
      const OFF = 1.8; // how fast it leaves the first run
      const DROP = 1.3; // down from there to the drum (so its bounce back passes under the keys' end)
      const S1 = 0.45; // each run's fall
      const S2 = 0.3;
      const BOUNCE = 0.5; // down from the drum's top to the second run
      const v = out.v ?? 1.3;
      const bottom = yTop - LANE_H;
      // (aimed, it stands low in the lane, so the second run ends at the lane's foot)
      const a = P(start, aimed ? Math.min(yTop - 0.35, bottom + S1 + DROP + BOUNCE + S2 + 0.2) : yTop - 0.35);
      // the first run, as far towards the far side as leaves room there for the drum
      const drumMost = dir > 0 ? x1 - DRUM_R - 0.12 : x0 + DRUM_R + 0.12;
      const reach = OFF * fallTime(DROP) + 0.25;
      const b = P(dir > 0 ? Math.max(drumMost - reach, start + 0.6) : Math.min(drumMost + reach, start - 0.6), a.y - S1);
      // off the end of a run, over its last key's edge (the ball, on top of it at p, going `way`)
      const offRun = (from, p, way) => {
        const down = under(from, p, BALL_R);
        return edgeArc(new THREE.Vector2(p.x + down.x, p.y + down.y), p, way);
      };
      const over1 = offRun(a, b, dir);
      const left1 = over1.at(over1.length);
      const drumBall = P(0, b.y - DROP);
      drumBall.x = left1.x + dir * OFF * fallTime(left1.y - drumBall.y);
      const c = P(drumBall.x - dir * 0.95, drumBall.y - BOUNCE); // (clear of the drum's rim)
      // the second run, back the other way, to d: where the ball, rolling off it, lands just where
      // it should next, if that is set
      let d;
      if (aimed) {
        const trial = P(c.x - dir * 1.0, c.y - S2);
        const lead = offRun(c, trial, -dir).at(Infinity).sub(trial); // (how far on it leaves the run)
        d = P(out.x + dir * v * fallTime(out.h) - lead.x, c.y - S2);
      } else {
        const far = dir > 0 ? x0 + 0.5 : x1 - 0.5;
        d = P(c.x - dir * clamp(Math.abs(c.x - far) - 0.6, 0.9, 2.2), c.y - S2);
      }
      if ((c.x - d.x) * dir < 0.5) d.x = c.x - dir * 0.5;
      const over2 = offRun(c, d, -dir);
      const left2 = over2.at(over2.length);
      const rainbow = [C.red, C.orange, C.yellow, C.green, C.sky, C.blue, C.hot, C.pink];
      function keys(from, to) {
        const n = Math.max(3, Math.round(from.distanceTo(to) / 0.3));
        const down = under(from, to, BALL_R + 0.06);
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const list = [];
        for (let k = 0; k < n; k++) {
          const p = new THREE.Vector3().lerpVectors(from, to, (k + 0.5) / n);
          const key = box(0.24, 0.1, 0.95 - (0.3 * k) / n, M.paint(rainbow[k % rainbow.length]));
          key.rotation.z = angle;
          const restY = p.y + down.y;
          place(key, p.x + down.x, restY, BALL_Z);
          const bounce = struck(22, 8);
          dipping.push(() => { key.position.y = restY - 0.04 * bounce.value(); });
          list.push(bounce);
        }
        // the frame they lie on, and its posts
        for (const dz of [-0.36, 0.36]) {
          const bar = box(from.distanceTo(to) + 0.2, 0.06, 0.06, navy);
          bar.rotation.z = angle;
          place(bar, (from.x + to.x) / 2 + down.x * 1.5, (from.y + to.y) / 2 + down.y * 1.5, BALL_Z + dz);
        }
        for (const p of [from, to]) root.add(zRod(p.x + down.x * 1.5, p.y + down.y * 1.5, 0, BALL_Z - 0.36, 0.04, steel));
        return list;
      }
      const run1 = keys(a, b);
      const run2 = keys(c, d);
      const drum = new THREE.Group();
      const shell = mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, 0.45, 40), [M.stripes(C.red, C.white, 8, Math.PI / 2), M.paint(C.white), M.paint(C.white)]);
      shell.position.y = -0.225;
      drum.add(shell);
      for (const y of [0, -0.45]) {
        const hoop = mesh(new THREE.TorusGeometry(DRUM_R + 0.01, 0.035, 8, 40).rotateX(Math.PI / 2), M.paint(C.yellow));
        hoop.position.y = y;
        drum.add(hoop);
      }
      const drumTop = drumBall.y - BALL_R;
      place(drum, drumBall.x, drumTop, BALL_Z);
      root.add(zRod(drumBall.x, drumTop - 0.22, 0, BALL_Z - DRUM_R, 0.06, steel));
      const boom = struck(14, 6);
      dipping.push(() => { drum.scale.y = 1 - 0.12 * Math.abs(boom.value()); });
      const ring = (list, T) => () => list.forEach((bounce, k) => after((T * (k + 0.5)) / list.length, () => bounce.hit()));
      return {
        start: a,
        endX: left2.x,
        exitX: aimed ? out.x : left2.x - dir * v * fallTime(out.h),
        route() {
          const T1 = (2 * a.distanceTo(b)) / (0.8 + OFF);
          roll(new Poly([a, b]), 0.8, OFF, { onStart: ring(run1, T1) });
          roll(over1, OFF, OFF);
          fall(left1, drumBall, () => boom.hit());
          const T2 = (2 * c.distanceTo(d)) / (1.0 + v);
          hop(drumBall, c, 0.45);
          roll(new Poly([c, d]), 1.0, v, { onStart: ring(run2, T2) });
          roll(over2, v, v);
        },
        leave(next) { fall(left2, next.start, next.arrive); },
      };
    }

    // A bucket hanging from a pulley, a counterweight on the rope's other end: the ball drops
    // into it and its weight brings it down (the counterweight going up), onto a little shelf,
    // which tips it as it settles, pouring the ball out over its low side.
    // (it pours out POUR to the side it tips to: towards where what's next would like it, if
    // that's known, or the lane's middle; and it would like to hang where that pours it there)
    const POUR = 1.02;
    const bucketTip = (hang, { nextFirst, mid }) => ((nextFirst ?? mid) >= hang ? 1 : -1);
    bucketLift.first = ({ entry, nextFirst, x0, x1, mid }) => {
      if (entry != null || nextFirst == null) return entry ?? mid;
      const hang = nextFirst - POUR;
      return hang >= x0 + 0.65 ? hang : nextFirst + POUR;
    };
    function bucketLift(ctx) {
      const { x0, x1, yTop } = ctx;
      const hang = clamp(startAt(ctx), x0 + 0.65, x1 - 0.65);
      const tip = bucketTip(hang, ctx);
      const s = -tip; // the pulley's other side (the counterweight's)
      const PR = 0.42;
      const BACK = BALL_Z - 0.42; // (the rope, pulley and weight hang behind the ball's way down)
      const pulley = new THREE.Vector2(hang + s * PR, yTop - 0.25);
      const DOWN = 2.1;
      const top = P(hang, yTop - 1.05); // the ball in it, at the top
      const low = P(hang, top.y - DOWN);
      const TILT = -tip * 55 * DEG;
      const hinge = new THREE.Vector2(hang + tip * 0.42, low.y - BALL_R - 0.1);
      const turn = (p, angle) => {
        const dx = p.x - hinge.x;
        const dy = p.y - hinge.y;
        return P(hinge.x + dx * Math.cos(angle) - dy * Math.sin(angle), hinge.y + dx * Math.sin(angle) + dy * Math.cos(angle));
      };
      // the bucket: floor, tall back side, low lip on the tipping side, and a back against the
      // board's side, with an eye on top for the rope (not a handle over it, in the ball's way)
      const pivot = new THREE.Group(); // (at the hinge, so it tips about it)
      const bucket = new THREE.Group();
      const finish = M.dots(C.blue, C.white, 3);
      for (const [w, h, d, x, y, z, material] of [
        [0.92, 0.1, 0.84, 0, -BALL_R - 0.05, 0, finish],
        [0.1, 0.62, 0.84, -tip * 0.46, 0, 0, finish],
        [0.1, 0.28, 0.84, tip * 0.46, -0.19, 0, finish],
        [0.92, 0.62, 0.08, 0, 0, -0.42, M.paint(C.blue)],
      ]) {
        const part = box(w, h, d, material);
        part.position.set(x, y, z);
        bucket.add(part);
      }
      const eye = mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 16), steel);
      eye.position.set(0, 0.38, -0.42);
      bucket.add(eye);
      bucket.position.set(hang - hinge.x, low.y - hinge.y, 0);
      pivot.add(bucket);
      place(pivot, hinge.x, hinge.y, BALL_Z);
      // the shelf it comes down onto, under its tipping corner (narrow, clear of the ball pouring out)
      place(box(0.24, 0.12, 0.8, M.stripes(C.orange, C.white, 2)), hinge.x - tip * 0.02, hinge.y - 0.06, BALL_Z);
      root.add(zRod(hinge.x - tip * 0.02, hinge.y - 0.06, 0, BALL_Z - 0.4, 0.05, steel));
      // the pulley, the counterweight, and the rope
      const wheel = disc(PR, 0.14, M.paint(C.yellow), M.paint(C.orange));
      place(wheel, pulley.x, pulley.y, BACK);
      root.add(zRod(pulley.x, pulley.y, 0, BACK, 0.05, steel));
      const weight = box(0.42, 0.5, 0.42, M.stripes(C.hot, C.white, 2));
      const weightTop = top.y - 0.2;
      place(weight, pulley.x + s * PR, weightTop - DOWN - 0.25, BACK);
      const ropeMaterial = M.matte('#3a3a48', 0.8);
      const rope = () => { const r = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), ropeMaterial); root.add(r); return r; };
      const ropes = [rope(), rope()];
      const stretch = (r, from, to) => {
        r.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, BACK);
        r.scale.y = Math.max(from.distanceTo(to), 0.01);
        r.rotation.z = Math.atan2(to.y - from.y, to.x - from.x) - Math.PI / 2;
      };
      let sinking = null;
      let tipping = null;
      dipping.push(() => {
        const sunk = DOWN * (1 - ease(segmentU(sinking)));
        const angle = TILT * ease(segmentU(tipping));
        pivot.position.y = hinge.y + sunk;
        pivot.rotation.z = angle;
        weight.position.y = weightTop - DOWN - 0.25 + DOWN - sunk;
        wheel.rotation.z = (s * (DOWN - sunk)) / PR;
        const grip = turn(P(hang, low.y + 0.38), angle); // (the eye on its back)
        stretch(ropes[0], new THREE.Vector3(hang, pulley.y, BALL_Z), new THREE.Vector3(grip.x, grip.y + sunk, BALL_Z));
        stretch(ropes[1], new THREE.Vector3(pulley.x + s * PR, pulley.y, BALL_Z), new THREE.Vector3(pulley.x + s * PR, weight.position.y + 0.25, BALL_Z));
      });
      // where the ball goes over the lip as it pours out (as out of the cup at the top)
      // and on round the lip's corner until it's clear of the bucket's side under it, to drop
      const lipCorner = turn(P(hang + tip * 0.51, low.y - 0.05), TILT);
      const overLip = P(lipCorner.x + tip * 0.1, lipCorner.y + BALL_R + 0.04);
      const offLip = edgeArc(new THREE.Vector2(lipCorner.x, lipCorner.y), overLip, tip, 80);
      const poured = offLip.at(offLip.length);
      return {
        start: top,
        endX: poured.x,
        exitX: poured.x,
        route() {
          segment(1.5, (u, out) => out.copy(low).setY(low.y + DOWN * (1 - ease(u))));
          sinking = lastSegment();
          segment(0.6, (u, out) => out.copy(turn(low, TILT * ease(u))));
          tipping = lastSegment();
          roll(new Poly([turn(low, TILT), overLip]), 0.3, 1.0);
          roll(offLip, 1.0, 1.0);
        },
        leave(next) { fall(poured, next.start, next.arrive); },
      };
    }

    // A boot on a pendulum, like the reference machines' kicking boot: the ball drops onto a
    // little tray that rolls it onto a tee; the boot, held up behind it, swings down and kicks
    // it, sending it in an arc across the lane (KICK at least, so it's well clear of the tee as
    // it comes down) to where it should go next if that's set, or where what's next starts if
    // that's known. (The tee stands as near where the ball lands as leaves room for the boot
    // behind it, BEHIND, and the kick in front.)
    // (L: the pivot down to the sole; REACH: the toe's front, out in front of the pivot, TOE up
    // from the sole: as drawn (DRAWN), and as it stands, SIZE times that; BEHIND: how far behind
    // the tee the boot reaches, held up)
    // (SIZE: as big as it can be, held up behind its tee, out towards the board's edge, and still
    // be in view)
    const BOOT = { SIZE: 1.9, DRAWN: { L: 1.2, REACH: 0.55, TOE: 0.3 }, RAISE: 25 * DEG, KICK: 0.9 };
    for (const key of ['L', 'REACH', 'TOE']) BOOT[key] = BOOT.DRAWN[key] * BOOT.SIZE;
    BOOT.BEHIND = BALL_R + BOOT.REACH + BOOT.L * Math.sin(BOOT.RAISE) + 0.46 * BOOT.SIZE * Math.cos(BOOT.RAISE);
    function bootPlan({ x0, x1, mid, entry, out, nextFirst }) {
      const entryX = entry ?? mid;
      const land = out.x ?? nextFirst ?? (entryX < mid ? x1 - 0.6 : x0 + 0.6);
      const kd = land >= mid ? 1 : -1; // the way it kicks
      const teeX = kd > 0
        ? clamp(entryX, Math.min(x0 - 0.3 + BOOT.BEHIND, land - BOOT.KICK), land - BOOT.KICK)
        : clamp(entryX, land + BOOT.KICK, Math.max(x1 + 0.45 - BOOT.BEHIND, land + BOOT.KICK));
      return { entryX, land, kd, teeX };
    }
    bootKick.first = (ctx) => ctx.entry ?? bootPlan(ctx).teeX; // (where it would like the ball: right on the tee)
    function bootKick(ctx) {
      const { yTop, out } = ctx;
      const { RAISE, SIZE } = BOOT;
      const { entryX, land, kd, teeX } = bootPlan(ctx);
      const ball = P(teeX, yTop - 3.0); // (low in the lane, so its kick needn't be high)
      const pivot = new THREE.Vector2(teeX - kd * (BALL_R + BOOT.REACH), ball.y + BOOT.L - BOOT.TOE);
      const { L, REACH, TOE } = BOOT.DRAWN; // (the boot is drawn at these, then made SIZE times as big)
      // the tray, from where the ball lands down to the tee, if that's not (nearly) right over it
      const trayFrom = P(entryX, ball.y + 0.2 + 0.15 * Math.abs(entryX - teeX));
      const tray = Math.abs(entryX - teeX) > 0.4;
      if (tray) {
        const stop = new THREE.Vector3().lerpVectors(ball, trayFrom, 0.25 / ball.distanceTo(trayFrom)); // (short of the tee's cup)
        const down = under(trayFrom, stop, BALL_R + 0.05);
        const plank = box(stop.distanceTo(trayFrom) + 0.2, 0.1, 0.7, M.dots(C.pink, C.white, 3));
        plank.rotation.z = Math.atan2(stop.y - trayFrom.y, stop.x - trayFrom.x);
        place(plank, (stop.x + trayFrom.x) / 2 + down.x, (stop.y + trayFrom.y) / 2 + down.y, BALL_Z);
        root.add(zRod((stop.x + trayFrom.x) / 2 + down.x, (stop.y + trayFrom.y) / 2 + down.y, 0, BALL_Z - 0.35, 0.05, steel));
      }
      // the tee
      place(mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 16), M.paint(C.green)), teeX, ball.y - BALL_R - 0.3, BALL_Z);
      place(mesh(new THREE.CylinderGeometry(0.2, 0.08, 0.08, 24), M.paint(C.green)), teeX, ball.y - BALL_R - 0.03, BALL_Z);
      root.add(zRod(teeX, ball.y - BALL_R - 0.45, 0, BALL_Z, 0.05, steel));
      // The boot: a big yellow wellington with white polka dots, puffy and glossy. Its leg flares a
      // little up from a rounded heel to a fat rolled cuff; its front sweeps down in a long curve
      // over the instep into a big round toe, domed in depth too (out to REACH, in front of the
      // pivot, where it meets the ball, TOE up from the sole); a thick orange sole follows the
      // foot, with chunky tread lugs under it. (Drawn toe to the right, then turned to face the way
      // it kicks.)
      const BACK = -0.42; // the back of its leg
      const SHIN = 0.04; // the front of its leg
      const SOLE = 0.13; // the sole's height
      const TOP = 0.98; // the leg's top, under the cuff (up from the sole)
      const toeY = -L + TOE;
      const body = new THREE.Shape();
      body.moveTo(BACK + 0.12, -L + SOLE - 0.02);
      body.quadraticCurveTo(BACK, -L + SOLE - 0.02, BACK, -L + 0.27); // (the heel, rounded)
      body.lineTo(BACK - 0.03, -L + TOP);
      body.lineTo(SHIN + 0.03, -L + TOP);
      body.lineTo(SHIN, -L + 0.74);
      body.bezierCurveTo(SHIN - 0.01, -L + 0.53, 0.22, -L + 0.5, 0.36, toeY + 0.17); // (the instep)
      body.quadraticCurveTo(REACH + 0.01, toeY + 0.14, REACH, toeY); // (the toe's front)
      body.quadraticCurveTo(REACH - 0.01, -L + SOLE - 0.02, REACH - 0.16, -L + SOLE - 0.02);
      body.closePath();
      const bootGroup = new THREE.Group();
      bootGroup.scale.set(kd * SIZE, SIZE, SIZE);
      // (puffy: its edges rounded deep into its sides, all the way round, so the toe and heel
      // are round in depth too, and its outline kept as drawn; 0.6 deep in all, centred)
      const PUFF = 0.18;
      const shellGeometry = new THREE.ExtrudeGeometry(body, {
        depth: 0.6 - 2 * PUFF, bevelEnabled: true, bevelThickness: PUFF, bevelSize: 0.1, bevelOffset: -0.1, bevelSegments: 8, curveSegments: 32,
      });
      shellGeometry.translate(0, 0, PUFF - 0.3);
      const shell = mesh(shellGeometry, [M.dots(C.yellow, C.white, 6), M.paint(C.yellow, 0.22)]);
      bootGroup.add(shell);
      // the rolled cuff, wider and deeper than the leg, a lighter yellow
      const cuff = extrude(roundedRect(BACK - 0.08, -L + TOP - 0.05, SHIN - BACK + 0.16, 0.22, 0.1), 0.74, M.paint('#ffe066', 0.22), 0.08);
      cuff.position.z = -0.37;
      bootGroup.add(cuff);
      // the sole, along the whole foot, and its lugs
      const soleColor = M.paint('#d9822b', 0.6);
      // (its front a little short of the toe's, clear of the tee as it swings through)
      const sole = extrude(roundedRect(BACK - 0.04, -L, REACH - BACK - 0.02, SOLE, 0.06), 0.72, soleColor, 0.04);
      sole.position.z = -0.36;
      bootGroup.add(sole);
      for (let x = BACK + 0.04; x < REACH - 0.12; x += 0.15) {
        const lug = box(0.09, 0.05, 0.64, soleColor);
        lug.position.set(x, -L - 0.02, 0);
        bootGroup.add(lug);
      }
      const swing = new THREE.Group();
      swing.add(bootGroup);
      // the arm, down from the pivot into the boot's leg
      const arm = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 8), steel);
      arm.scale.setScalar(SIZE);
      arm.position.y = -0.2 * SIZE;
      swing.add(arm);
      place(swing, pivot.x, pivot.y, BALL_Z);
      // (its axle, from the board out through the cuff, capped on the cuff's face)
      const capZ = BALL_Z + 0.37 * SIZE + 0.05;
      root.add(zRod(pivot.x, pivot.y, 0, capZ, 0.06, steel));
      place(disc(0.12 * Math.max(SIZE, 1), 0.1, M.paint(C.red)), pivot.x, pivot.y, capZ + 0.05);
      const RAISED = -kd * RAISE;
      let kicking = null;
      dipping.push(() => {
        if (!kicking || loopT < kicking.t0 + kicking.T) {
          const u = segmentU(kicking);
          swing.rotation.z = RAISED * Math.cos((u * u * Math.PI) / 2); // (falling, faster and faster)
        } else {
          const t = loopT - kicking.t0 - kicking.T; // (then swinging on through, and back, settling)
          swing.rotation.z = kd * 0.35 * Math.sin(4 * t) * Math.exp(-1.2 * t);
        }
      });
      return {
        start: tray ? trayFrom : ball,
        endX: teeX,
        exitX: out.x == null ? land : undefined,
        route() {
          if (tray) roll(new Poly([trayFrom, ball]), 0.4, 0.9);
          segment(0.6, (u, o) => o.copy(ball));
          kicking = lastSegment();
        },
        leave(next) {
          if (ctx.cross) {
            // Kicked back across the board (from here, mirrored, on the left, to what's next, on
            // the right, as built: from here on the route isn't mirrored): a low lob, rising
            // LOB over the tee, fast across the gap between the cards.
            const from = P(-ball.x, ball.y, ball.z);
            mirrored = false;
            const LOB = 0.6;
            const up = Math.sqrt(2 * GRAVITY * LOB);
            const T = (up + Math.sqrt(up * up + 2 * GRAVITY * Math.max(from.y - next.start.y, 0))) / GRAVITY;
            hop(from, next.start, T, next.arrive ? { onStart: () => after(T, next.arrive) } : undefined);
            return;
          }
          // a flight long enough that the ball is well across (CLEAR) by the time it is back down
          // level with the tee (and past the tray, if that's in front of it)
          const across = Math.abs(next.start.x - ball.x);
          const dy = next.start.y - ball.y;
          const trayAhead = tray && (entryX - teeX) * kd > 0 ? Math.abs(entryX - teeX) + 0.3 : 0;
          const CLEAR = Math.min(Math.max(0.6, trayAhead), across - 0.2);
          const T = Math.max(0.5, Math.sqrt(Math.max(-dy, 0) / (15 * Math.max(1 - CLEAR / across, 0.2))));
          hop(ball, next.start, T, next.arrive ? { onStart: () => after(T, next.arrive) } : undefined);
        },
      };
    }

    // The lanes between two sections, from yTop down, one under another: the first starting
    // where the ball lands from the section above (entry), each after starting where the one
    // before sends it, and the last sending it on to the section below (last: where, how far
    // below, and how fast).
    // Where the machine crosses back over the board (crossAt: the lane that sends the ball across,
    // see "the layout"), that lane and those before it stand mirrored, on the left, and those
    // after it on the right: so what the crossing lane is to aim for, and where the next lane
    // catches the ball, are each turned over side to side between them. Each leg keeps what it
    // added to the machine (objects), so the layout can tell which to mirror.
    function lanes(contraptions, yTop, entry, last, crossAt = -1) {
      const x0 = COLUMN - LANE_W;
      const x1 = COLUMN;
      const mid = (x0 + x1) / 2;
      const legs = [];
      const outOf = (i) => (i + 1 < contraptions.length ? { h: LANE_GAP } : last);
      const laneTop = (i) => yTop - i * (LANE_H + LANE_GAP);
      const across = (i, x) => (i === crossAt && x != null ? -x : x); // (from the lane after it, into its own terms)
      // Planned first from the bottom up: where each would like the ball to land in it (first),
      // knowing where the one after would like it (so a contraption that can send the ball where
      // it likes, sends it there: nextFirst).
      const wants = [];
      for (let i = contraptions.length - 1, want = null; i >= 0; i--) {
        want = contraptions[i].first({ x0, x1, mid, yTop: laneTop(i), entry: null, fromX: null, out: outOf(i), nextFirst: across(i, want), cross: i === crossAt });
        wants[i] = want;
      }
      let fromX = null;
      contraptions.forEach((contraption, i) => {
        const ctx = {
          x0, x1, mid, yTop: laneTop(i), entry, fromX, out: outOf(i), nextFirst: across(i, wants[i + 1] ?? null),
          cross: i === crossAt, arriving: i === crossAt + 1 && crossAt >= 0 ? 1 : -1, // (the way the ball comes in, across x)
        };
        const from = root.children.length;
        const leg = contraption(ctx);
        leg.objects = root.children.slice(from);
        legs.push(leg);
        entry = i === crossAt ? -(leg.exitX ?? 0) : leg.exitX ?? null;
        fromX = i === crossAt ? -leg.endX : leg.endX;
      });
      return legs;
    }

    // The ball's route through the lanes, from where it lands in the first to the section below
    // (next: its start, and what happens when the ball lands there).
    function runLanes(legs, next) {
      legs.forEach((leg, i) => {
        leg.route();
        leg.leave(legs[i + 1] ?? next);
      });
    }

    // ---------------------------------------------------------------- the layout

    // From the top down: the sections, and between them the lanes, all in the machine's column
    // on the right, one under another. (The funnel drops the ball straight onto the plinko
    // board, as they were made to stand.)
    // (each: the section, the lanes under it, and, where the ball crosses back over the board
    // in those lanes, which does it: crossAt)
    const LAYOUT = [
      ['top', [blockLadder, switchback]], // (then the cascade across the board: see "the crossing")
      ['funnel', []],
      ['plinko', [paddleWheel, xylophone, twistPipe]],
      ['seesaw', [bootKick, helterSkelter, bucketLift, staircase], 0], // (the boot kicks it back across)
      ['launch'],
    ];
    // How far the ball drops from a section into the lane below it (clear of the section's
    // lowest parts beside it), and from a lane into the section below (clear of the section's
    // highest parts), and how fast it should be going as it lands in that section.
    const DROP_IN = { top: 1.25, plinko: 1.6, seesaw: 1.55 };
    const DROP_OUT = { funnel: 2.6, seesaw: 2.0, launch: 1.2 };
    const LAND_SPEED = { funnel: 2.8, seesaw: 1.4, launch: 1.5 };
    const LEDGE_SPEED = 2.6; // how fast the ball rolls off the zigzag's ledge
    const PLANK_SPEED = 1.0; // and off the seesaw's plank
    // Where the ball, leaving a section, lands in the lane below it (DROP_IN under it): flying on
    // off the ledge's end, dropping straight down beside the plinko board's last peg, or flying
    // on off the plank's end.
    const lastStop = plinkoStops[plinkoStops.length - 1];
    const PLINKO_OUT = -1; // (to the left, so the lanes below lead on from one to the next)
    const ENTRY = {
      top: () => ledge.at(ledge.length).x + LEDGE_SPEED * fallTime(DROP_IN.top),
      plinko: () => lastStop.x + PLINKO_OUT * 0.4,
      seesaw: () => plankRelease.x + SIDE * PLANK_SPEED * fallTime(DROP_IN.seesaw),
    };
    // From the funnel down to the seesaw and the boot under it, the machine stands on the board's
    // left instead, mirrored (all of it built as on the right, then turned over side to side: see
    // below), so the cards beside it stand on the right; under the boot, which kicks the ball back
    // across the board, it stands on the right again, as built, the last cards beside it on the
    // left (see "the white cards"). The ball crosses over just above the funnel, from
    // the foot of the top lanes across the board (the crossing), on the top lanes' cascade of
    // wire rails, stretched across: its CROSS.rails rails each slope down to the left (by
    // CROSS.slope), the ball rolling off the end of each and falling CROSS.gap onto the next,
    // which starts just where it lands. The last of the lanes (a switchback, which can send the
    // ball just where it should go) drops it onto the first, CROSS.in below, going left, about
    // CROSS.x (just where: startX); off the last it flies on into the funnel's mouth, where it
    // falls DROP_OUT.funnel as before.
    const CROSS = { x: 3.0, in: 2.0, v0: 1.4, rails: 4, slope: 0.3, gap: 0.45, V: 2.4 };
    function crossing(startX = CROSS.x) {
      const land = P(-funnelRim.x, funnelRim.y + sections.funnel.dy, funnelRim.z); // (the funnel's mouth, mirrored)
      const end = P(land.x + LAND_SPEED.funnel * fallTime(DROP_OUT.funnel), land.y + DROP_OUT.funnel);
      const { rails: n, slope, gap, V } = CROSS;
      const flight = V * fallTime(gap); // (how far across each fall between rails carries it)
      const length = (startX - end.x - (n - 1) * flight) / n; // (each rail's, across)
      const polys = [];
      let x = startX;
      let y = end.y + n * slope + (n - 1) * gap;
      for (let k = 0; k < n; k++) {
        polys.push(new Poly([P(x, y), P(x - length, y - slope)]));
        x -= length + flight;
        y -= slope + gap;
      }
      return { land, end, start: polys[0].at(0), polys };
    }

    // Placed from the bottom up: the launcher stays where it is, at the foot of the board, and
    // each section above stands on the lanes below it (or, with none, where it first stood
    // over the section below); the top section's lanes lead onto the crossing.
    const lanesBelow = {};
    for (let i = LAYOUT.length - 2; i >= 0; i--) {
      const [name, contraptions, crossAt] = LAYOUT[i];
      const belowName = LAYOUT[i + 1][0];
      const below = sections[belowName];
      const section = sections[name];
      if (contraptions.length) {
        let lastExit = below.entry.y + below.dy + DROP_OUT[belowName];
        let last = { x: below.entry.x, h: DROP_OUT[belowName], v: LAND_SPEED[belowName] };
        if (name === 'top') {
          const { start } = crossing();
          lastExit = start.y + CROSS.in;
          last = { x: start.x, h: CROSS.in, v: CROSS.v0 };
        }
        const yTop = lastExit + contraptions.length * LANE_H + (contraptions.length - 1) * LANE_GAP;
        lanesBelow[name] = lanes(contraptions, yTop, ENTRY[name](), last, crossAt);
        section.dy = yTop + DROP_IN[name] - section.exit.y;
      } else {
        section.dy = below.dy;
      }
      section.group.position.y = section.dy;
    }

    // The crossing's rails, each its own colour, as in the lanes, starting just where the
    // switchback over them drops the ball.
    const cross = crossing(lanesBelow.top[lanesBelow.top.length - 1].exitX ?? CROSS.x);
    for (const poly of cross.polys) {
      root.add(rail(poly, 1, { material: M.paint(nextColor(), 0.35), drop: RAIL_DROP })); // (going left)
    }

    // The middle of the machine, mirrored: the funnel, the plinko board and the seesaw, the lanes
    // between them, and the boot, turned over side to side about the board's middle.
    const SEESAW_CROSS = LAYOUT.find(([name]) => name === 'seesaw')[2];
    const lower = new THREE.Group();
    lower.scale.x = -1;
    lower.add(
      sections.funnel.group, sections.plinko.group, sections.seesaw.group,
      ...lanesBelow.plinko.flatMap((leg) => leg.objects),
      ...lanesBelow.seesaw.slice(0, SEESAW_CROSS + 1).flatMap((leg) => leg.objects),
    );
    root.add(lower);
    // The white cards. The first (the brief) at the top on the right, beside the cup and the
    // zigzag, over its long run across; the next LEFT down the board's left side, beside the top
    // lanes, from under the long run to over the crossing; the next RIGHT down the right side,
    // beside the mirrored middle of the machine, from under the crossing to over the boot's kick
    // back across; and the rest down the left side again, beside the machine's foot, from under
    // the boot and its kick to the last, just over the launcher's shot at the bottom: each lot
    // evenly spaced (and they make sure of their room: see "the cards, spaced out"). Each is
    // CARD.h tall, or as tall as cardHeights says (the page's, in order from the top). (The last
    // two lots are placed once the ball's way is known, its kick across among it: see there.)
    const CARD_COUNT = 11;
    const CARD_LEFT = 2;
    const CARD_RIGHT = 6;
    const cardHeightsAll = Array.from({ length: CARD_COUNT }, (_, i) => cardHeights[i] || CARD.h);
    const stackCards = (hs, top, foot, left) => {
      const gap = (top - foot - hs.reduce((sum, h) => sum + h, 0)) / Math.max(hs.length - 1, 1);
      for (const h of hs) {
        cards.push([left, top - h, left + CARD.w, top]);
        top -= h + gap;
      }
    };
    let rightCardsTop = 0; // (where the right-hand lot starts, under the crossing)
    {
      const ROOM = 0.3;
      const LEFT = CARD_LEFT;
      const heights = cardHeightsAll;
      const firstFoot = longRunTop(COLUMN - CARD.w) + sections.top.dy + ROOM;
      cards.push([COLUMN - CARD.w, firstFoot, COLUMN, firstFoot + heights[0]]);
      // (where the ball goes on the crossing's rails, and how far a card stays clear of it: over
      // it, of the ball; under it, of the rails' wires and their supports)
      const crossPoints = cross.polys.flatMap((poly) => Array.from({ length: 21 }, (_, k) => poly.at((poly.length * k) / 20)));
      const ABOVE = BALL_R + 0.45;
      const BELOW = RAIL_DROP + 0.55;
      const crossHighest = (x0, x1) => Math.max(...crossPoints.filter((p) => p.x >= x0 && p.x <= x1).map((p) => p.y));
      const crossLowest = (x0, x1) => Math.min(...crossPoints.filter((p) => p.x >= x0 && p.x <= x1).map((p) => p.y));
      const firstTop = longRunTop(-COLUMN + CARD.w) - 0.9 + sections.top.dy - ROOM; // (under the run's lower wall)
      stackCards(heights.slice(1, 1 + LEFT), firstTop, crossHighest(-COLUMN, -COLUMN + CARD.w + 0.3) + ABOVE, -COLUMN);
      rightCardsTop = crossLowest(COLUMN - CARD.w - 0.3, COLUMN) - BELOW;
    }

    // ---------------------------------------------------------------- the board

    // The board is far wider and taller than the machine on it, so with the camera close in it
    // fills the whole window, on any shape of screen, from the top of the machine to its foot.
    // A pegboard, as on the Work page, but quiet (its holes faded out to plain cream) wherever
    // the cards' words stand on it, so they read clearly: quiet() takes those places, as
    // [left, bottom, right, top] on the board (see tall-main.js), and the holes fade out over
    // QUIET_EDGE around each.
    const BOARD = { x: -16, y: 0.2, w: 32, h: sections.top.dy + 34 + RAISE - 0.2 };
    const QUIET_MAX = 32;
    const QUIET_EDGE = 0.45;
    const boardFace = M.pegboard(2.5);
    const quietUniforms = {
      quietRects: { value: Array.from({ length: QUIET_MAX }, () => new THREE.Vector4()) },
      quietCount: { value: 0 },
      quietColor: { value: new THREE.Color(C.cream) },
    };
    boardFace.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, quietUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vBoardXY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoardXY = (modelMatrix * vec4(transformed, 1.0)).xy;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vBoardXY;
          uniform vec4 quietRects[${QUIET_MAX}];
          uniform int quietCount;
          uniform vec3 quietColor;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float quiet = 0.0;
          for (int i = 0; i < ${QUIET_MAX}; i++) {
            if (i >= quietCount) break;
            vec4 r = quietRects[i];
            // how far outside the place it is (or, below 0, inside it)
            float out_ = max(max(r.x - vBoardXY.x, vBoardXY.x - r.z), max(r.y - vBoardXY.y, vBoardXY.y - r.w));
            quiet = max(quiet, 1.0 - smoothstep(0.0, ${QUIET_EDGE.toFixed(2)}, out_));
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, quietColor, quiet);`);
    };
    place(extrude(roundedRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 0.5), 0.4, [boardFace, M.matte(C.cream)]), 0, 0, -0.4);
    function quiet(rects) {
      const n = Math.min(rects.length, QUIET_MAX);
      for (let i = 0; i < n; i++) quietUniforms.quietRects.value[i].set(...rects[i]);
      quietUniforms.quietCount.value = n;
    }
    place(box(BOARD.w + 0.8, 0.3, 1.5, navy), 0, 0.15, -0.2);

    // ---------------------------------------------------------------- the bottle label

    // The Yūki bottle label, a real paper strip on the board in the label card's place (put
    // there by tall-main.js: place()), printed on its face, with a silver foil back. It unrolls
    // across the board from left to right as it comes into view (set(), from 0, rolled up at
    // its left end, to 1, laid flat): the part not yet laid is wound in a tight spiral, a roll
    // standing out from the board that travels along as the paper is smoothed down behind it.
    const label = (() => {
      const SEGMENTS = 320; // along the strip, for a smooth roll
      const R_CORE = 0.11; // the roll's innermost radius
      const PAPER = 0.007; // how much each turn round the roll adds to it (the paper's thickness)
      const LIFT = 0.02; // the paper's face, off the board's
      const geometry = new THREE.PlaneGeometry(1, 1, SEGMENTS, 1);
      // (the picture file, or, opened straight from a file, the picture written out in full: see
      // js/label-picture.js)
      const texture = new THREE.TextureLoader().load(RG.LABEL_PICTURE || 'img/yuki/label.webp');
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      const front = mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, side: THREE.FrontSide }));
      // (its back a silvery foil: metal, a little rough, catching the room's light like the
      // machine's steel)
      const back = mesh(geometry, new THREE.MeshStandardMaterial({
        color: '#c4cad3', metalness: 1, roughness: 0.32, envMap: RG.envMap, side: THREE.BackSide,
      }));
      const group = new THREE.Group();
      group.add(front, back);
      group.visible = false; // (until it is placed)
      root.add(group);
      let x0 = 0;
      let y0 = 0;
      let w = 1;
      let h = 1;
      let shown = -1;
      const position = geometry.attributes.position;
      function set(p) {
        p = Math.min(Math.max(p, 0), 1);
        if (Math.abs(p - shown) < 1e-4 || !group.visible) return;
        shown = p;
        const laid = p * w; // how much of it is flat on the board
        const rolled = w - laid; // and how much is still wound up
        const outer = R_CORE + (PAPER * rolled) / (TAU * R_CORE); // the roll's radius, at its outside
        const cx = x0 + laid; // where the roll touches the board
        const cz = LIFT + outer; // its axis, out from the board
        for (let i = 0; i < position.count; i++) {
          const u = (i % (SEGMENTS + 1)) / SEGMENTS; // along the strip, 0 to 1
          const y = y0 + (i < SEGMENTS + 1 ? h : 0); // (the plane's first row is its top)
          const along = u * w;
          if (along <= laid) {
            position.setXYZ(i, x0 + along, y, LIFT);
          } else {
            // wound round the roll, from where it leaves the board: the turns further in (more
            // of the strip from the board) a little tighter
            const s = along - laid;
            const r = R_CORE + (PAPER * (rolled - s)) / (TAU * R_CORE);
            const angle = s / r;
            position.setXYZ(i, cx + r * Math.sin(angle), y, cz - r * Math.cos(angle));
          }
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      }
      return {
        // where it goes: [left, bottom, right, top] on the board
        place([left, bottom, right, top]) {
          // As large as there is room for, centred where it is: from the board's edge on its
          // side, as a laptop's window shows it, to just short of the machine's lanes on the
          // other (its card on the left, or on the right, by the mirrored lower machine), at the
          // label's own shape.
          const onRight = left + right > 0;
          const WIDEST_LEFT = onRight ? -(COLUMN - LANE_W - 0.25) : -COLUMN - 0.2;
          const WIDEST_RIGHT = onRight ? COLUMN + 0.2 : COLUMN - LANE_W - 0.25;
          const SHAPE = 1820 / 455;
          const middle = (bottom + top) / 2;
          const half = (WIDEST_RIGHT - WIDEST_LEFT) / SHAPE / 2;
          [left, bottom, right, top] = [WIDEST_LEFT, middle - half, WIDEST_RIGHT, middle + half];
          if (left === x0 && bottom === y0 && right - left === w && top - bottom === h) return;
          x0 = left;
          y0 = bottom;
          w = right - left;
          h = top - bottom;
          group.visible = true;
          const p = shown < 0 ? 0 : shown;
          shown = -1;
          set(p);
        },
        set,
        // the middle of it, top to bottom (for when it should unroll), or null until placed
        get middle() { return group.visible ? y0 + h / 2 : null; },
      };
    })();

    // ---------------------------------------------------------------- the ball and its route

    const ball = place(mesh(new THREE.SphereGeometry(BALL_R, 48, 32), steel), CUP_REST.x, CUP_REST.y, BALL_Z);

    // (From the funnel on, the route is worked out as the machine was built, on the right, and
    // turned over side to side with it: mirrored.)
    const segments = [];
    let mirrored = false;
    const turnOver = (pos) => (u, out) => { pos(u, out); out.x = -out.x; return out; };
    const segment = (T, pos, extra) => segments.push({ T, pos: mirrored ? turnOver(pos) : pos, ...extra });

    // Roll along a path with constant acceleration from speed v0 to v1.
    function roll(poly, v0, v1, extra) {
      segment((2 * poly.length) / (v0 + v1), (u, out) => {
        poly.at((poly.length * (2 * v0 * u + (v1 - v0) * u * u)) / (v0 + v1), out);
      }, extra);
    }

    // Flight between two points, taking T seconds: across and in or out in a straight line,
    // up and down under gravity.
    function hop(a, b, T, extra) {
      const vy = (b.y - a.y + 0.5 * GRAVITY * T * T) / T;
      segment(T, (u, out) => {
        const t = u * T;
        out.set(a.x + (b.x - a.x) * u, a.y + vy * t - 0.5 * GRAVITY * t * t, a.z + (b.z - a.z) * u);
      }, extra);
    }

    // Each section's parts of the route, where the section now stands (its dy).
    const up = (v, dy) => new THREE.Vector3(v.x, v.y + dy, v.z);
    const upPoly = (poly, dy) => new Poly(poly.points.map((p) => up(p, dy)));
    const upPos = (dy, pos) => (u, out) => { pos(u, out); out.y += dy; return out; };
    const dTop = sections.top.dy;
    const dFunnel = sections.funnel.dy;
    const dPlinko = sections.plinko.dy;
    const dSeesaw = sections.seesaw.dy;

    // 1. Zigzag, upper: poured from the cup (over its lip), down the first run and round the
    // first hairpin, coming to rest on the flat
    segment(T_TIP, upPos(dTop, (u, out) => inCup(CUP_TIP * ease(u), out)), { stage: 'Zigzag, upper' });
    roll(new Poly([up(poured, dTop), up(overLip, dTop), up(zigzag.at(0), dTop)]), 0.3, 1.0);
    roll(upPoly(zigzagUpper, dTop), 1.0, 2.6);
    roll(upPoly(restFlat, dTop), 2.6, 0);
    // 2. Zigzag, lower: off the flat, down the rest of it to the ledge
    roll(upPoly(zigzagLower, dTop), 0.4, 3.2, { stage: 'Zigzag, lower' });
    roll(upPoly(ledge, dTop), 3.2, LEDGE_SPEED);
    // off the ledge's end (flying on), down the lanes, onto the crossing
    fall(up(sections.top.exit, dTop), lanesBelow.top[0].start, lanesBelow.top[0].arrive);
    runLanes(lanesBelow.top, { start: cross.start });
    // across the board on its rails, from one to the next, and off the last (flying on) into the
    // funnel's mouth, on the left
    cross.polys.forEach((poly, k) => {
      const last = k === cross.polys.length - 1;
      if (k > 0) fall(cross.polys[k - 1].at(cross.polys[k - 1].length), poly.at(0));
      roll(poly, k > 0 ? 1.0 : CROSS.v0, last ? LAND_SPEED.funnel : CROSS.V);
    });
    fall(cross.end, cross.land);
    mirrored = true;
    // 3. Funnel: round and round it, and out of its neck, down its axis
    segment(3.0, upPos(dFunnel, inFunnel), { stage: 'Funnel' });
    roll(new Poly([up(funnelNeck, dFunnel), up(funnelOut, dFunnel)]), 1.0, 2.2);
    // onto the plinko board's top peg
    fall(up(funnelOut, dFunnel), up(plinkoStops[0].at, dPlinko), () => plinkoStops[0].peg.bounce.hit());
    // 4. Plinko: down from peg to peg, rolling round each and dropping through the gap beside
    // it onto the next
    const pegAt = (stop) => ({ x: stop.x, y: stop.y + dPlinko });
    plinkoStops.forEach((stop, i) => {
      const next = plinkoStops[i + 1];
      if (!next) return;
      const side = offPeg(pegAt(stop), up(stop.at, dPlinko), Math.sign(next.x - stop.x));
      if (i === 0) segments[segments.length - 1].stage = 'Plinko';
      fall(side, up(next.at, dPlinko), () => next.peg.bounce.hit());
    });
    // off the last peg, straight down into the lanes, down them onto the seesaw
    fall(offPeg(pegAt(lastStop), up(lastStop.at, dPlinko), PLINKO_OUT), lanesBelow.plinko[0].start, lanesBelow.plinko[0].arrive);
    runLanes(lanesBelow.plinko, { start: up(landed, dSeesaw) });
    // 5. Seesaw
    const T_TIPPING = 0.5;
    segment(T_TIPPING, upPos(dSeesaw, (u, out) => onPlank(SIDE * LAND, plankAngle(u), out)), {
      id: 'tipping',
      stage: 'Seesaw',
      onStart: () => after(T_TIPPING * 0.6, () => bellSwing.hit()),
    });
    // rolling down the plank, faster and faster, to its end (at PLANK_SPEED), round its end
    // corner until it leaves it, and on, falling
    const T_ROLL_OFF = (2 * (PLANK - LAND)) / PLANK_SPEED;
    segment(T_ROLL_OFF, upPos(dSeesaw, (u, out) => onPlank(SIDE * (LAND + (PLANK - LAND) * u * u), plankAngle(1), out)));
    segment((BALL_R * OFF_EDGE) / PLANK_SPEED, upPos(dSeesaw, (u, out) => overTip(OFF_EDGE * u, out)));
    fall(up(plankRelease, dSeesaw), lanesBelow.seesaw[0].start, lanesBelow.seesaw[0].arrive);
    // down the last lanes, into the launcher's hood (see the launcher)
    runLanes(lanesBelow.seesaw, { start: HOOD_MOUTH });
    roll(new Poly([HOOD_MOUTH, ...hoodPath.points.slice().reverse(), LAUNCH]), LAND_SPEED.launch, 2.0);
    // 7. Launcher: pressed down, then fired straight up, round the hood and out along its lip,
    // flying on off its end (level, fast, under the last card) into the goal
    const T_SINK = 0.7;
    const sunk = P(LAUNCH.x, LAUNCH.y - SINK);
    segment(T_SINK, (u, out) => out.copy(LAUNCH).setY(LAUNCH.y - SINK * ease(u)), { id: 'sink', stage: 'Launcher' });
    // ...flying on off the lip onto the top of the green cube with eyes, bouncing off it in a low
    // arc (under the last card) into the goal
    const ON_CUBE = P(0.75, 3.5 + BALL_R); // (on the cube's top: see "the green cube")
    const SHOT = (HOOD_MOUTH.x - ON_CUBE.x) / fallTime(HOOD_MOUTH.y - ON_CUBE.y); // (how fast it leaves the lip)
    const firing = new Poly([sunk, ...hoodPath.points, HOOD_MOUTH]);
    segment(firing.length / SHOT, (u, out) => firing.at(firing.length * u, out), { id: 'flight' });
    fall(HOOD_MOUTH, ON_CUBE);
    hop(ON_CUBE, GOAL, 0.62);
    hop(GOAL, GOAL, 0.25, { id: 'landed' }); // a little bounce in the cup

    let total = 0;
    const stageNames = [];
    for (const s of segments) {
      s.t0 = total;
      total += s.T;
      if (s.stage) stageNames.push(s.stage);
      s.stageIndex = stageNames.length - 1;
    }
    const timeOf = (id) => segments.find((s) => s.id === id).t0;
    const T_TIPPED = timeOf('tipping');
    const T_FIRE = timeOf('flight');
    const T_LANDED = timeOf('landed');
    const T_SUNK = timeOf('sink');

    // Where the ball is along its route is set from outside (by scrolling: see tall-main.js),
    // not as a time but as a distance along its path (`length` in all): so however quickly or
    // slowly each part of the route was timed, the ball moves along it at an even pace for
    // the scrolling, and every mechanism keeps time with it, whatever pace that is. Its path is
    // measured once, here: the distance the ball covers, plus a little for time passing
    // (TIME_WEIGHT, in units per second), so the moments where it hardly moves (the seesaw
    // tipping, the spring pressing down) still take a little scrolling. The ball eases after
    // where it is sent, just enough to smooth out a mouse wheel's clicks.
    const SAMPLES = 12000;
    const TIME_WEIGHT = 0.4;
    const EASE_RATE = 22; // how quickly it catches up (per second of the machine's time)
    const sampleTimes = new Float32Array(SAMPLES + 1);
    const sampleAlong = new Float32Array(SAMPLES + 1);
    const sampleX = new Float32Array(SAMPLES + 1); // (where the ball is, for spacing out the cards)
    const sampleY = new Float32Array(SAMPLES + 1);
    {
      const here = new THREE.Vector3();
      const last = new THREE.Vector3();
      let s = 0;
      for (let k = 0; k <= SAMPLES; k++) {
        const t = (total * k) / SAMPLES;
        const segIndex = segmentAt(Math.min(t, total - 1e-6));
        const seg = segments[segIndex];
        seg.pos(clamp01((t - seg.t0) / seg.T), here);
        if (k > 0) s += here.distanceTo(last) + TIME_WEIGHT * (total / SAMPLES);
        last.copy(here);
        sampleTimes[k] = t;
        sampleAlong[k] = s;
        sampleX[k] = here.x;
        sampleY[k] = here.y;
      }
    }
    const length = sampleAlong[SAMPLES];

    // ---------------------------------------------------------------- the cards, spaced out

    // Each card starts beside its lane. Then, where the machine leaves room on its side of the
    // board (beside a section, or a lane on the other side), it slides up or down so that the
    // cards are as evenly spaced down the page as they can be: never within CARD_ROOM of any
    // part of the machine (the seesaw at either tilt) or the ball's path, nor within CARD_GAP
    // of each other. The first and last stay where they are.
    {
      const CARD_ROOM = 0.25;
      const CARD_GAP = 1.6;
      root.updateMatrixWorld(true);
      const blocks = []; // [x0, x1, y0, y1]: everything standing out from the board, and the ball's path
      const bounds = new THREE.Box3();
      const collect = (object) => object.traverse((o) => {
        if (!o.isMesh || o === ball) return;
        bounds.setFromObject(o);
        if (bounds.max.x - bounds.min.x > 20) return; // (the board, and its shelf)
        blocks.push([bounds.min.x, bounds.max.x, bounds.min.y, bounds.max.y]);
      });
      collect(root);
      for (const tilt of [TILT, -TILT]) {
        seesaw.rotation.z = tilt;
        seesaw.updateMatrixWorld(true);
        collect(seesaw);
      }
      for (let k = 0; k <= SAMPLES; k += 2) {
        blocks.push([sampleX[k] - BALL_R, sampleX[k] + BALL_R, sampleY[k] - BALL_R, sampleY[k] + BALL_R]);
      }
      // The last two lots of cards (see "the white cards"): the right-hand lot from under the
      // crossing down to just over the highest of what's under it on that side (the boot's kick
      // across, and the machine's foot); and the last lot, on the left, from just under the lowest
      // of what's over it on that side (the boot, and its kick) down to just over the launcher's
      // shot.
      {
        const lastFoot = LAUNCH.y + 1.1;
        const within = ([x0, x1], left) => x1 > left - CARD_ROOM && x0 < left + CARD.w + CARD_ROOM;
        const rightLeft = COLUMN - CARD.w;
        const rightFoot = Math.max(...blocks.filter((b) => within(b, rightLeft) && b[3] < rightCardsTop - 1).map((b) => b[3])) + CARD_ROOM + 0.2;
        const leftTop = Math.min(...blocks.filter((b) => within(b, -COLUMN) && b[2] > lastFoot).map((b) => b[2])) - CARD_ROOM - 0.2;
        stackCards(cardHeightsAll.slice(1 + CARD_LEFT, 1 + CARD_LEFT + CARD_RIGHT), rightCardsTop, rightFoot, rightLeft);
        stackCards(cardHeightsAll.slice(1 + CARD_LEFT + CARD_RIGHT), leftTop, lastFoot, -COLUMN);
        cards.sort((a, b) => b[3] - a[3]); // (from the top down)
      }
      // how far each card's top can go up (hi) and down (lo) and stay clear
      const spaced = cards.map(([left, bottom, right, top]) => {
        const h = top - bottom; // (each its own height)
        let lo = -Infinity;
        let hi = Infinity;
        for (const [x0, x1, y0, y1] of blocks) {
          if (x1 < left - CARD_ROOM || x0 > right + CARD_ROOM) continue;
          const from = y0 - CARD_ROOM; // the card's top is blocked from here...
          const to = y1 + CARD_ROOM + h; // ...to here
          if (to <= top) lo = Math.max(lo, to);
          else if (from >= top) hi = Math.min(hi, from);
          // (already as near as it may be, beside its lane: it may only move away)
          else if ((y0 + y1) / 2 < top - h / 2) lo = Math.max(lo, top);
          else hi = Math.min(hi, top);
        }
        return { left, right, top, h, lo: Math.min(lo, top), hi: Math.max(hi, top) };
      });
      for (let pass = 0; pass < 200; pass++) {
        for (let i = 1; i < spaced.length - 1; i++) {
          const card = spaced[i];
          const aboveFoot = spaced[i - 1].top - spaced[i - 1].h;
          const belowTop = spaced[i + 1].top;
          // halfway between the card above and the one below, as far as it may go
          let top = (aboveFoot + belowTop + card.h) / 2;
          top = Math.min(top, aboveFoot - CARD_GAP);
          top = Math.max(top, belowTop + card.h + CARD_GAP);
          card.top = Math.min(Math.max(top, card.lo), card.hi);
        }
      }
      spaced.forEach((card, i) => { cards[i] = [card.left, card.top - card.h, card.right, card.top]; });
      // (the first of the right-hand lot, the branding card, a little lower, further under the
      // crossing over it, nothing else moved)
      const BRANDING_DROP = 0.85;
      const branding = cards[1 + CARD_LEFT];
      branding[1] -= BRANDING_DROP;
      branding[3] -= BRANDING_DROP;
    }
    // The waving hand, in the middle of the gap between the last two cards, on the left (its
    // outline is about 1.55 tall from its wrist, and stands a little right of its wrist, with
    // its thumb out).
    {
      const [above, below] = cards.slice(-2);
      place(hand, (below[0] + below[2]) / 2 - 0.19, (above[1] + below[3]) / 2 - 0.78, 0.15);
    }
    // the time along the route at which the ball has come `d` along its path
    function timeAt(d) {
      if (d <= 0) return 0;
      if (d >= length) return total;
      let lo = 0;
      let hi = SAMPLES;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (sampleAlong[mid] <= d) lo = mid; else hi = mid;
      }
      const span = sampleAlong[hi] - sampleAlong[lo];
      return sampleTimes[lo] + (span > 0 ? (d - sampleAlong[lo]) / span : 0) * (sampleTimes[hi] - sampleTimes[lo]);
    }

    let along = 0; // how far along its path the ball is
    let sentTo = 0; // and how far along it has been sent
    let index = 0; // the segment the ball is in

    function segmentAt(t) {
      let i = 0;
      while (i + 1 < segments.length && segments[i + 1].t0 <= t) i++;
      return i;
    }

    // Send the ball to a distance along its path; it eases there. (Not while it is held: see
    // hold.)
    let held = false;
    function seek(d) {
      if (held) return;
      sentTo = Math.min(Math.max(d, 0), length);
    }

    // Hold the ball where it is, ignoring scrolling (while the red button's glide back up to the
    // top plays: see tall-main.js), or let it go again.
    function hold(on) {
      held = on;
    }

    // Put the ball, and everything with it, at a distance along its path at once.
    function jump(d) {
      sentTo = along = Math.min(Math.max(d, 0), length);
      loopT = timeAt(along);
      pending.length = 0;
      index = segmentAt(Math.min(loopT, total - 1e-6));
    }

    function update(dt) {
      simT += dt;

      const before = along;
      if (along !== sentTo) {
        along += (sentTo - along) * (1 - Math.exp(-EASE_RATE * dt));
        if (Math.abs(sentTo - along) < 0.002) along = sentTo;
      }
      if (along !== before) {
        loopT = timeAt(along);
        const now = segmentAt(Math.min(loopT, total - 1e-6));
        // going forwards, set off whatever happens as the ball enters each new segment (the
        // bell, the blocks dipping)
        if (along > before) for (let i = index + 1; i <= now; i++) if (segments[i].onStart) segments[i].onStart();
        index = now;
      }

      const current = segments[index];
      current.pos(clamp01((loopT - current.t0) / current.T), ball.position);

      for (let i = pending.length - 1; i >= 0; i--) {
        if (simT >= pending[i].at) pending.splice(i, 1)[0].fn();
      }

      // Every mechanism follows the time along the route.
      hinge.rotation.z = cupAngle(loopT);
      const tilt = plankAngle((loopT - T_TIPPED) / T_TIPPING);
      seesaw.rotation.z = tilt;
      bell.rotation.z = 0.25 * bellSwing.value();

      // the launcher: pressed down with the ball, then springing back after firing, with a wobble
      let pressed = SINK * ease((loopT - T_SUNK) / T_SINK);
      if (loopT > T_FIRE) {
        const since = loopT - T_FIRE;
        pressed = SINK * Math.exp(-7 * since) * Math.cos(16 * since);
      }
      const padY = LAUNCH.y - BALL_R - 0.06 - pressed;
      plunger.position.y = padY;
      coil.scale.y = (padY - 0.06 - SPRING_BASE) / SPRING_LENGTH;

      // the starburst pops up when the ball lands, with a spring, and turns
      const pop = loopT - T_LANDED;
      const grow = pop <= 0 ? 0 : 1 - Math.exp(-6 * pop) * Math.cos(11 * pop);
      starburst.scale.setScalar(0.45 + 0.75 * grow);
      starburst.rotation.z = simT * 0.25;

      for (const peg of pegs.values()) peg.cap.scale.setScalar(1 + 0.3 * Math.abs(peg.bounce.value()));
      for (const dip of dipping) dip();

      // The eyes look at the cursor, or with no cursor (a touch screen) at the ball. The pupils
      // look as far as they can to the side the cursor is on, and come back to the middle as it
      // comes over them, easing a little as they go.
      const looking = gaze || ball.position;
      const k = 1 - Math.exp(-14 * dt);
      for (const eye of pupils) {
        const dx = looking.x - eye.x;
        const dy = looking.y - eye.y;
        const d = Math.hypot(dx, dy);
        const reach = d > 0 ? Math.min(0.09, d * 0.25) / d : 0;
        eye.ox += (dx * reach - eye.ox) * k;
        eye.oy += (dy * reach - eye.oy) * k;
        eye.pupil.position.set(eye.x + eye.ox, eye.y + eye.oy, 1.41);
      }

      for (const animate of animators) animate(dt);
    }

    update(0);

    return {
      root,
      ball,
      update,
      seek,
      jump,
      hold,
      start: ball.position.clone(), // where the ball starts, in its cup
      length, // the length of the ball's path (with a little for time passing; see above)
      get along() { return along; }, // how far along it the ball is
      get target() { return sentTo; }, // and how far along it has been sent
      height: BOARD.y + BOARD.h, // the top of the board
      // the white cards' spaces on the board, from the top down: [left, bottom, right, top]
      cards,
      // the places on the board where the holes fade out, under the cards' words
      quiet,
      // the bottle label on the board, unrolling (see "the bottle label")
      label,
      // (for checking: the lanes, where each catches the ball and lets it go)
      lanes: Object.fromEntries(Object.entries(lanesBelow).map(([name, legs]) => [name, legs.map((leg) => ({ start: leg.start.x, endX: leg.endX, exitX: leg.exitX }))])),
      // where the eyes should look: a point in the scene, or null to watch the ball
      lookAt(point) { gaze = point; },
      eyeDepth: 1.41,
      // the push button that sends everything back to the start
      topButton: {
        object: topButton,
        light(on) { lighting = on ? 1 : 0; },
        press() { pressedAt = simT; },
      },
      // the waving hand, which waves eagerly when clicked (clicked again while it does, it
      // just keeps going a little longer)
      hand: {
        object: hand,
        wave() { eagerFrom = eagerness() > 0 ? simT - EAGER.into : simT; },
      },
    };
  };

  // Everything around the machine: the floor, a plinth, and toy-block towers either side.
  RG.buildTallStage = function () {
    const { M, C, mesh, box, disc, extrude, roundedRect, burst } = RG;
    const root = new THREE.Group();
    const animators = [];
    const place = (object, x, y, z = 0) => {
      object.position.set(x, y, z);
      root.add(object);
      return object;
    };

    const FLOOR_Y = -0.5;
    place(mesh(new THREE.CircleGeometry(160, 64).rotateX(-Math.PI / 2), M.matte(C.mustard), false), 0, FLOOR_Y, 0);
    const plinth = extrude(roundedRect(-8.6, -3.2, 17.2, 7.2, 2.2), -FLOOR_Y, M.matte(C.pink, 0.7), 0.04);
    plinth.rotation.x = -Math.PI / 2;
    place(plinth, 0, FLOOR_Y, 0);

    // Left: a stack of blocks, a wavy column, and a dotted disc on top.
    const LEFT = -6.9;
    place(box(1.7, 1.1, 1.7, M.paint(C.blue)), LEFT, 0.55, 0.3);
    place(box(1.3, 1.3, 1.3, M.dots(C.yellow, C.white, 2)), LEFT, 1.75, 0.3);
    const profile = [];
    for (let i = 0; i <= 48; i++) {
      const y = (i / 48) * 3.2;
      profile.push(new THREE.Vector2(0.5 + 0.16 * Math.cos((y / 3.2) * Math.PI * 6), y));
    }
    place(mesh(new THREE.LatheGeometry(profile, 40), M.paint(C.orange, 0.4)), LEFT, 2.4, 0.3);
    const dotted = disc(0.95, 0.3, M.dots(C.hot, C.white, 4), M.paint(C.hot));
    place(dotted, LEFT, 6.55, 0.3);
    animators.push((t) => { dotted.rotation.z = t * 0.4; });

    function burstOnStick(x, z, height, radius, petals, colors, centre, speed) {
      place(mesh(new THREE.CylinderGeometry(0.04, 0.04, height, 10), M.metal('#dfe6ee', 0.2)), x, height / 2, z);
      const flower = burst(petals, radius, colors.map((c) => M.paint(c)), M.paint(centre));
      place(flower, x, height, z + 0.1);
      animators.push((t) => { flower.rotation.z = t * speed; });
    }
    burstOnStick(-7.9, -1.4, 9.2, 0.9, 12, [C.green, C.white], C.red, 0.35);

    // Right: an arch, a striped slab, and a target on top.
    const RIGHT = 6.9;
    const arch = new THREE.Shape();
    arch.moveTo(-1.1, 0);
    arch.lineTo(-0.45, 0);
    arch.lineTo(-0.45, 1.7);
    arch.absarc(0, 1.7, 0.45, Math.PI, 0, true);
    arch.lineTo(0.45, 0);
    arch.lineTo(1.1, 0);
    arch.lineTo(1.1, 1.7);
    arch.absarc(0, 1.7, 1.1, 0, Math.PI);
    arch.closePath();
    place(extrude(arch, 1.0, M.paint(C.green), 0.07), RIGHT, 0, 0.6);
    place(extrude(roundedRect(-0.6, 0, 1.2, 5.6, 0.6), 0.45, [M.stripes(C.navy, C.white, 2.2), M.paint(C.navy)], 0.06), RIGHT + 0.4, 0, -0.7);
    const target = disc(0.85, 0.3, M.target(C.black, C.white, 7), M.paint(C.black));
    place(target, RIGHT + 0.4, 6.4, -0.2);
    animators.push((t) => { target.rotation.z = -t * 0.6; });
    place(mesh(new THREE.SphereGeometry(0.42, 32, 24), M.paint(C.yellow, 0.3)), RIGHT - 1.2, 0.42, 1.9);
    burstOnStick(7.9, -1.6, 8.2, 0.8, 10, [C.blue, C.orange], C.yellow, -0.3);

    return {
      root,
      update(t) {
        for (const animate of animators) animate(t);
      },
    };
  };
})(window.RG);
