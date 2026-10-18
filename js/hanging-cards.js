// The About page's hanging cards: a small 3D scene of their own over its second screen, on the
// board like the Work and Yuki pages' machines (the same light, the same paints, the same
// scale: a scene unit is 2.5 of the board's hole spacing, as for the loose pieces on the first
// screen). The canvas is see-through but for the cards, their rod and rings, and their
// shadows, so the board (style.css) shows through it, darkened where they shade it.
//
// A yellow rod across the board on steel brackets, and hanging from it in one row, ten
// colourful cards, overlapping, each on a ring that loops over the rod and through a hole
// punched near the card's top. Each hangs a card's thickness further from the board than the
// one it overlaps, so they lie over one another (and shade one another) rather than passing
// through. The cards are blank for now (photos and words to come): each a plain sheet of one
// bright colour from the site's palette.
//
// Each card swings from the rod like a pendulum, slowing as it goes, back to how it hangs at
// rest. Only taking hold of one moves it (the pointer passing over moves nothing): clicked, it
// gets a little push; pulled, it comes to the front and slides along the rod after the pointer,
// its ring running along the rod, swinging as it goes, and stays where it's let go. On a touch
// screen a card is pulled sideways; up and down still scrolls the page. The scene is only drawn
// when something changes, and the cards keep still (but can still be moved) for a visitor who
// prefers less motion.
(function (RG) {
  RG.startCards = function ({ RoomEnvironment }) {
    const canvas = document.querySelector('.cards-scene');
    if (!canvas) return;
    const section = canvas.parentElement;
    const { M, C, box, roundedRect } = RG;
    const DEG = Math.PI / 180;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');

    // ---------------------------------------------------------------- the scene

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    RG.envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

    const scene = new THREE.Scene();
    // The same light as the Work and Yuki pages.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe2a0, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    const SUN_FROM = new THREE.Vector3(-11, 24, 19);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    // The board: only its shadows are drawn (the board itself is the page's, behind). Their
    // colour and strength darken the board as the loose pieces' shadows do (their pictures
    // take it to about 74%, 72% and 68% of its red, green and blue).
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ color: '#534425', opacity: 0.4 }),
    );
    board.receiveShadow = true;
    scene.add(board);

    // Looking straight at the board, a scene unit to `unit` pixels, (0, 0) at the screen's top
    // left, y up (so the screen runs down to -height).
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 50);
    camera.position.z = 20;

    // ---------------------------------------------------------------- the parts

    const ROD_Z = 0.45; // how far out from the board the rods (and so the cards) stand
    const ROD_R = 0.09;
    const RING_R = 0.2; // a ring's radius, to the middle of its wire
    const WIRE = 0.022; // and its wire's
    const HOLE_R = 0.06;
    const HOLE_DOWN = 0.16; // a hole's centre, down from its card's top
    const THICK = 0.035; // a card's thickness: stiff card
    const RING_TURN = 35 * DEG; // turned this far from side-on, so its loop shows

    // A ring hangs over the rod, the top of its inside resting on the rod's top; the card hangs
    // from the ring's bottom, the top of its hole resting on the ring's wire.
    const RING_Y = ROD_R - (RING_R - WIRE); // the ring's centre, from the rod's
    const HOLE_Y = RING_Y - RING_R + WIRE - HOLE_R; // the hole's centre
    const CARD_TOP = HOLE_Y + HOLE_DOWN;

    const steel = M.metal('#dfe6ee', 0.12);
    const rodPaint = M.paint(C.yellow);

    // The cards: each one solid, bright colour from the site's palette (and its ring another,
    // and how it hangs at rest, in degrees).
    const CARDS = [
      { card: C.hot, ring: C.yellow, tilt: -5 },
      { card: C.yellow, ring: C.blue, tilt: 4 },
      { card: C.blue, ring: C.hot, tilt: -3 },
      { card: C.orange, ring: C.blue, tilt: 6 },
      { card: C.green, ring: C.pink, tilt: -4 },
      { card: C.pink, ring: C.green, tilt: 3 },
      { card: C.red, ring: C.yellow, tilt: -6 },
      { card: C.sky, ring: C.orange, tilt: 5 },
      { card: '#6cc5a0', ring: C.hot, tilt: -2 }, // (mint, from the name's hover tiles)
      { card: '#7a3cf0', ring: C.yellow, tilt: 4 }, // (violet, the site's badges: --badge)
    ];

    // A card of width w, hanging from (0, 0): the top of its ring's loop, on the rod.
    function makeCard(colors, w) {
      const h = (w * 4) / 3;
      const shape = roundedRect(-w / 2, -h, w, h, 0.1);
      const hole = new THREE.Path();
      hole.absarc(0, -HOLE_DOWN, HOLE_R, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: THICK - 0.012,
        bevelEnabled: true,
        bevelSize: 0.006,
        bevelThickness: 0.006,
        bevelOffset: -0.006,
        bevelSegments: 2,
        curveSegments: 16,
      });
      const card = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colors.card, roughness: 0.85 }));
      card.position.set(0, CARD_TOP, -THICK / 2 + 0.006);
      card.castShadow = true;
      card.receiveShadow = true;
      return { card, h };
    }

    const cards = CARDS.map((colors, i) => {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, WIRE, 16, 64), M.metal(colors.ring, 0.3));
      ring.rotation.y = Math.PI / 2 - RING_TURN; // its loop across the rod, turned a little to show
      ring.position.y = RING_Y;
      ring.castShadow = true;
      group.add(ring);
      scene.add(group);
      const rest = colors.tilt * DEG;
      return {
        colors, group, card: null, h: 1, w: 0,
        rest, angle: rest, spin: 0,
        rod: 0, x: 0, along: 0, layer: 0, // where it hangs: how far along the rod, and how near the front
        pos: new THREE.Vector3(), vx: 0,
      };
    });

    // ---------------------------------------------------------------- the layout

    let unit = 1;
    let width = 1;
    let height = 1;
    let w = 1; // the cards' width
    const LAYER = THICK + 0.008; // how much further from the board each card is than the one under it
    const rods = []; // { y, x0, x1 (its ends), lo, hi (where a ring can hang on it), mesh }

    // Where a card hangs is kept as how far along the rod it is (0 at one end, 1 at the other),
    // so its place holds when the window changes size; and its layer, 0 for the one nearest the
    // board, which the others overlap.
    cards.forEach((one, i) => {
      one.along = i / (cards.length - 1);
      one.layer = i;
    });

    function layout() {
      // a unit as style.css sizes the board's holes (--peg-gap: max(18px, 2.9vw)), times 2.5
      unit = Math.max(18, 0.029 * window.innerWidth) * 2.5;
      const margin = Math.min(Math.max(20, 0.05 * window.innerWidth), 72) / unit;
      const nav = 134 / unit;
      width = section.clientWidth / unit;

      // all on one rod across the screen, overlapping, each about a fifth of the rod across
      const span = width - 2 * margin;
      w = Math.min(2.8, Math.max(2.2, span * 0.21));
      const needed = nav + (-CARD_TOP + (w * 4) / 3 + 0.3) + margin;

      // the screen as tall as the cards need (at least the window), the rod in the middle
      section.style.minHeight = Math.ceil(Math.max(window.innerHeight, needed * unit)) + 'px';
      height = section.clientHeight / unit;
      const y = -(nav + Math.max(0, (height - needed) / 2)) + ROD_R;

      for (const rod of rods) scene.remove(rod.mesh);
      rods.length = 0;
      const x0 = margin;
      const x1 = width - margin;
      const mesh = rail(x0, x1, y);
      scene.add(mesh);
      rods.push({ y, x0, x1, lo: x0 + w / 2 + 0.1, hi: x1 - w / 2 - 0.1, mesh });

      for (const one of cards) {
        if (one.w !== w) {
          if (one.card) {
            one.group.remove(one.card);
            one.card.geometry.dispose();
            one.card.material.dispose();
          }
          const made = makeCard(one.colors, w);
          one.card = made.card;
          one.h = made.h;
          one.group.add(made.card);
          one.w = w;
        }
        one.rod = 0;
        one.x = xAlong(one.along);
        one.pos.set(one.x, y, depth(one));
        one.vx = 0;
        one.group.position.copy(one.pos);
        one.group.rotation.z = one.angle;
      }

      const box = canvas.getBoundingClientRect();
      camera.right = width;
      camera.bottom = -height;
      camera.updateProjectionMatrix();
      board.scale.set(width * 3, height * 3, 1);
      board.position.set(width / 2, -height / 2, 0);
      sun.target.position.set(width / 2, -height / 2, 0);
      sun.position.copy(sun.target.position).add(SUN_FROM);
      const reach = Math.hypot(width, height) / 2 + 2;
      Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
      sun.shadow.camera.updateProjectionMatrix();
      renderer.setSize(box.width, box.height, false);
      draw();
    }

    const xAlong = (along) => rods[0].lo + along * (rods[0].hi - rods[0].lo);
    // how far from the board a card hangs: its layer's, over the rod's (the rings, a little
    // apart along the rod's depth, all still loop over it)
    const depth = (one) => ROD_Z + (one.layer - (cards.length - 1) / 2) * LAYER;

    // A rod from x0 to x1 at height y, held off the board at each end by a steel bracket.
    function rail(x0, x1, y) {
      const group = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(ROD_R, ROD_R, x1 - x0, 32).rotateZ(Math.PI / 2), rodPaint);
      rod.position.set((x0 + x1) / 2, y, ROD_Z);
      rod.castShadow = true;
      group.add(rod);
      for (const x of [x0, x1]) {
        const arm = box(0.12, 0.2, ROD_Z, steel);
        arm.position.set(x, y, ROD_Z / 2);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(ROD_R * 1.5, ROD_R * 1.5, 0.08, 32).rotateZ(Math.PI / 2), steel);
        cap.position.set(x, y, ROD_Z);
        cap.castShadow = true;
        group.add(arm, cap);
      }
      return group;
    }

    // A card brought to the front: over all the others, which close up the layers under it.
    function toFront(one) {
      for (const other of cards) if (other.layer > one.layer) other.layer -= 1;
      one.layer = cards.length - 1;
    }

    // ---------------------------------------------------------------- drawing, and moving

    const SPRING = 15; // how hard a card is pulled back to rest (about 1.6 seconds a swing)
    const DAMPING = 1.1; // how quickly its swinging dies away
    const CARRY = 0.9; // how much carrying it about swings it
    const LIMIT = 1.1; // the furthest it swings either way (radians)

    let drawing = false;
    function draw() {
      if (drawing) return;
      drawing = true;
      requestAnimationFrame(() => {
        drawing = false;
        renderer.render(scene, camera);
      });
    }

    let frame = null;
    let last = null;
    function tick(now) {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 1 / 20);
      last = now;
      let moving = false;
      const follow = (k) => 1 - Math.exp(-k * dt);
      for (const one of cards) {
        // where it's going: along the rod, where it's pulled to (kept between the rod's ends) or
        // where it hangs, in its layer
        const rod = rods[one.rod];
        const target = {
          x: one.held ? Math.max(rod.lo, Math.min(rod.hi, one.held.x)) : one.x,
          y: rod.y,
          z: depth(one),
        };
        const before = one.pos.x;
        one.pos.x += (target.x - one.pos.x) * follow(one.held ? 30 : 12);
        one.pos.y += (target.y - one.pos.y) * follow(one.held ? 30 : 12);
        one.pos.z += (target.z - one.pos.z) * follow(14);
        const vx = (one.pos.x - before) / dt;
        const ax = (vx - one.vx) / dt;
        one.vx = vx;
        if (Math.abs(target.x - one.pos.x) + Math.abs(target.y - one.pos.y) + Math.abs(target.z - one.pos.z) > 0.001) moving = true;
        else one.pos.set(target.x, target.y, target.z);

        // its swing: pulled back to rest, slowed, and (moved about) left behind by its ring
        const length = -CARD_TOP + one.h / 2;
        // (a card moving by itself, as one going back where it was, swings less than one pulled)
        const carried = still.matches ? 0 : (-ax * CARRY * (one.held ? 1 : 0.4)) / length;
        one.spin += (-SPRING * (one.angle - one.rest) - DAMPING * one.spin + carried) * dt;
        one.angle += one.spin * dt;
        if (Math.abs(one.angle - one.rest) > LIMIT) {
          one.angle = one.rest + Math.sign(one.angle - one.rest) * LIMIT;
          one.spin *= -0.3;
        }
        if (Math.abs(one.spin) > 0.002 || Math.abs(one.angle - one.rest) > 0.0005) moving = true;
        else {
          one.spin = 0;
          one.angle = one.rest;
        }
        if (one.held) moving = true;
        one.group.position.copy(one.pos);
        one.group.rotation.z = one.angle;
      }
      renderer.render(scene, camera);
      frame = moving ? requestAnimationFrame(tick) : null;
      if (!moving) last = null;
    }
    function wake() {
      if (frame === null) frame = requestAnimationFrame(tick);
    }

    // ---------------------------------------------------------------- the pointer

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    // A point in the window, in the scene (on the board's plane: the camera looks straight on).
    function toScene(event) {
      const box = canvas.getBoundingClientRect();
      return { x: (event.clientX - box.left) / unit, y: -(event.clientY - box.top) / unit, box };
    }
    function cardAt(event) {
      const { box } = toScene(event);
      pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(cards.map((one) => one.card), false)[0];
      return hit ? cards.find((one) => one.card === hit.object) : null;
    }

    let press = null; // { one, from: { x, y } in the window, grab: { x, y } from its ring, id }
    let over = null;
    function hover(one) {
      if (one === over) return;
      over = one;
      canvas.classList.toggle('hovering-clickable', !!one);
      if (!press) canvas.style.cursor = one ? 'grab' : '';
    }

    canvas.addEventListener('pointermove', (event) => {
      const p = toScene(event);
      if (press) {
        const one = press.one;
        // taken hold of once pulled a little way, and brought to the front, over the others it
        // slides past; then it follows the pointer along the rod (only across: up and down,
        // it stays on the rod)
        if (!one.held && Math.hypot(event.clientX - press.from.x, event.clientY - press.from.y) > 5) {
          one.held = { x: one.pos.x, x0: one.x };
          toFront(one);
          canvas.style.cursor = 'grabbing';
        }
        if (one.held) {
          one.held.x = p.x - press.grab.x;
          wake();
        }
        return;
      }
      hover(cardAt(event));
    });
    canvas.addEventListener('pointerleave', () => hover(null));

    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const one = cardAt(event);
      if (!one) return;
      const p = toScene(event);
      press = { one, from: { x: event.clientX, y: event.clientY }, grab: { x: p.x - one.pos.x, y: p.y - one.pos.y }, id: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
    });

    // Let go: a card pulled stays where it was pulled to, at the front (or, its pulling cut
    // short, slides back where it came from); one only clicked gets a little push, away from
    // where it was clicked.
    function letGo(event, cancelled) {
      if (!press) return;
      const one = press.one;
      press = null;
      if (one.held) {
        const from = one.held;
        one.held = null;
        if (cancelled) {
          one.x = from.x0;
        } else {
          one.x = Math.max(rods[0].lo, Math.min(rods[0].hi, from.x));
          one.along = (one.x - rods[0].lo) / (rods[0].hi - rods[0].lo);
        }
      } else if (!cancelled && !still.matches && event) {
        const side = toScene(event).x < one.pos.x ? 1 : -1;
        one.spin += side * 1.4;
      }
      canvas.style.cursor = over ? 'grab' : '';
      wake();
    }
    canvas.addEventListener('pointerup', (event) => letGo(event, false));
    canvas.addEventListener('pointercancel', () => letGo(null, true));
    canvas.addEventListener('lostpointercapture', () => letGo(null, false));

    // (for looking into from the browser's console)
    RG.cards = { cards, rods };

    // ---------------------------------------------------------------- starting

    layout();
    let width0 = window.innerWidth;
    window.addEventListener('resize', () => {
      // (only when the window's width changes: a phone's toolbar coming and going changes its
      // height as the page scrolls, and that shouldn't deal the cards out afresh)
      if (window.innerWidth === width0) return;
      width0 = window.innerWidth;
      layout();
    });
  };
})(window.RG);
