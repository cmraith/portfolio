// Tilde (~), the site's mascot, part 1: its body. A flat snake with a face: a round head, and behind it
// a body made of the trail it has just travelled: one smooth tube in a colour of its own,
// fading away to nothing at the tip of its tail (even where it curls over itself).
//
// This file only draws. It offers a wardrobe (colours, and kinds of eyes and mouth) and
// a set of expressions, and can draw any combination. Which ones it wears, where it goes and
// what it does are decided in js/mascot-ai.js, which calls setLook() and pose().
(function () {
  // Its size: a little smaller on a phone-sized screen, so it doesn't crowd it.
  const SMALL = Math.min(window.innerWidth, window.innerHeight) < 500;
  const HEAD = SMALL ? 52 : 68; // diameter of the head, and width of the body, in px
  const LENGTH = SMALL ? 250 : 330; // how much of its path the body covers, in px
  const SPACING = 5; // distance between the discs that make up the body, in px
  const TAIL_FADE = 0.2; // how much of the body, from the tip of the tail, fades away
  const INK = '#15151a'; // pupils and dark lines

  // ---------------------------------------------------------------- the wardrobe

  // Colours it can be: the paint colours of the Rube Goldberg machine (RG.C in
  // js/materials.js). The machine's yellow, cream and white are only ever used for features,
  // since a snake in those would vanish against the yellow backdrop.
  const COLORS = {
    hot: [255, 79, 138], pink: [255, 157, 187], orange: [255, 107, 28], red: [232, 54, 46],
    green: [31, 165, 93], blue: [43, 95, 217], sky: [168, 213, 238], navy: [28, 43, 99],
    yellow: [255, 208, 38], cream: [246, 240, 225], white: [255, 255, 255],
  };
  const BODY_COLORS = ['hot', 'pink', 'orange', 'red', 'green', 'blue', 'sky', 'navy'];
  const FEATURE_COLORS = [...BODY_COLORS, 'yellow', 'cream', 'white'];

  // Body colours that stand well apart from a given head colour, so the face is always
  // clearly a different colour from the body behind it. Measured as distance between the
  // colours' red, green and blue.
  const CONTRAST = 150;
  const apart = (a, b) => Math.hypot(...COLORS[a].map((channel, i) => channel - COLORS[b][i]));
  const contrasting = (name) => {
    const far = BODY_COLORS.filter((other) => apart(other, name) >= CONTRAST);
    return far.length ? far : BODY_COLORS.filter((other) => other !== name);
  };

  const EYES = ['white', 'wide', 'almond']; // white discs; larger ones; almonds. Always white.
  // The nose is always the same small circle; only its colour varies.
  const MOUTHS = ['smile', 'grin', 'chip', 'u']; // a curved line; a filled half moon; a tiny one; a tiny "u"

  // How a feeling shows on whatever face it is wearing.
  //   eyes: size multiplier, or 'closed'   pupils: size multiplier   brows: a shape or none
  //   mouth: a shape that replaces the face's own, or none to keep it   cheeks: blush
  const EXPRESSIONS = {
    content: {},
    happy: { mouth: 'beam', cheeks: true },
    curious: { eyes: 1.2, brows: 'raised', mouth: 'o' },
    surprised: { eyes: 1.3, brows: 'raised', mouth: 'oh' },
    scared: { eyes: 1.2, pupils: 0.6, brows: 'worried', mouth: 'wavy' },
    nervous: { brows: 'worried', mouth: 'wavy', sideways: true },
    bored: { eyes: 0.85, brows: 'flat', mouth: 'flat' },
    angry: { brows: 'angry', mouth: 'frown' },
    sleepy: { eyes: 'closed', mouth: 'flat' },
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'mascot';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // The sheet it is drawn on covers only the patch of the window the snake is in (within the
  // window, less any scrollbar), and moves with it: the soft shadow under it (style.css) is
  // then worked out over that patch alone, not over the whole window, every frame. The patch
  // starts on a whole screen pixel, so the drawing lands exactly where it would on a sheet
  // covering the window. One unit of drawing is one px of page.
  let ratio = 1; // canvas pixels per px of page
  let sheetRatio = 0; // the ratio the sheet's size on the page was last set for
  let originX = 0; // where the sheet's top left corner is, in canvas pixels from the window's
  let originY = 0;

  // Fits the sheet over the snake (with a margin of a head's width all round, for the head and
  // its face), clipped to the window, and readies it for drawing in px of page. Returns false
  // if none of the snake is in the window.
  const SHEET_STEP = 64; // the sheet grows in steps of this many canvas pixels, so it is rarely resized
  function fitSheet(points) {
    // The screen's pixels per px of page, read afresh every frame: zooming the page, or
    // moving the window to another screen, changes it, and not always with any event to say so.
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const margin = HEAD * (1 + Math.abs(head.stretch)) + 4;
    const right = Math.ceil(Math.min(maxX + margin, document.documentElement.clientWidth) * ratio);
    const bottom = Math.ceil(Math.min(maxY + margin, window.innerHeight) * ratio);
    originX = Math.floor(Math.max(minX - margin, 0) * ratio);
    originY = Math.floor(Math.max(minY - margin, 0) * ratio);
    const width = right - originX;
    const height = bottom - originY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (width < 1 || height < 1) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return false;
    }
    // a size in steps, grown when the snake needs more room and shrunk when it needs much less
    const fit = (needed, now) => (now < needed || now > needed * 2 + SHEET_STEP ? Math.ceil(needed / SHEET_STEP) * SHEET_STEP : now);
    const sheetWidth = fit(width, canvas.width);
    const sheetHeight = fit(height, canvas.height);
    if (canvas.width !== sheetWidth || canvas.height !== sheetHeight) {
      canvas.width = sheetWidth;
      canvas.height = sheetHeight;
      sheetRatio = 0;
    }
    // its size on the page, whenever its size in pixels or the screen's pixels change
    if (sheetRatio !== ratio) {
      sheetRatio = ratio;
      canvas.style.width = sheetWidth / ratio + 'px';
      canvas.style.height = sheetHeight / ratio + 'px';
    }
    canvas.style.transform = 'translate(' + originX / ratio + 'px, ' + originY / ratio + 'px)';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // drawing beyond the patch (where the sheet runs on past the window's edge) is cut off,
    // just as the window's edge would cut it off
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.setTransform(ratio, 0, 0, ratio, -originX, -originY);
    return true;
  }

  // ---------------------------------------------------------------- its state

  // Where it appears when the page loads: right beside the name, level with its middle. (On a
  // page without the name, the bottom left corner.)
  function startingPoint() {
    const lines = [...document.querySelectorAll('.title .line, .title h1')];
    // (Someone who asks for less motion gets a mascot that stays put, so it goes in the corner.)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!lines.length || still) return { x: 20 + HEAD / 2, y: window.innerHeight - 16 - HEAD / 2 };
    const boxes = lines.map((line) => line.getBoundingClientRect());
    const right = Math.max(...boxes.map((box) => box.right));
    const top = Math.min(...boxes.map((box) => box.top));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const beside = right + HEAD * 0.5 + 16;
    const edge = document.documentElement.clientWidth - 8 - HEAD / 2;
    // On a narrow screen there may be no room beside the name; then it starts just below it,
    // under the end of the name.
    if (beside > edge) return { x: Math.min(right - HEAD / 2, edge), y: bottom + HEAD / 2 + 12 };
    return { x: beside, y: (top + bottom) / 2 };
  }
  const start = startingPoint();
  const head = { x: start.x, y: start.y, stretch: 0 };
  let facing = { x: -1, y: 0 }; // the way it last moved, which its face and pupils lean towards
  const trail = []; // where its head has been, newest last

  // It arrives with its whole body already behind it, so it never shows up as a bare head:
  // the tail leaves the head away from the name and curls round through a quarter circle,
  // towards whichever of the top and bottom of the window has more room.
  const CURL = LENGTH / (Math.PI / 2); // radius of that quarter circle
  const curlTo = start.y <= window.innerHeight / 2 ? 1 : -1; // down, or up
  for (let d = LENGTH; d > 0; d -= SPACING) {
    const angle = d / CURL;
    trail.push({ x: head.x + CURL * Math.sin(angle), y: head.y + curlTo * CURL * (1 - Math.cos(angle)) });
  }

  // What it is wearing: `wanted` is what its mind last asked for; `shown` is what is on its
  // face right now. Colours ease across; the face swaps in a quick blink.
  const FIRST = {
    head: 'hot', tail: 'blue', eyes: 'white', mouth: 'smile',
    noseColor: 'yellow', mouthColor: 'white',
  };
  let wanted = { ...FIRST, expression: 'content' };
  let shown = { ...wanted };
  let blink = 1; // 0..1 through a swap; 1 = settled
  const now = { head: [...COLORS[FIRST.head]], tail: [...COLORS[FIRST.tail]] }; // colours right now

  const sameFace = (a, b) => ['eyes', 'mouth', 'noseColor', 'mouthColor', 'expression']
    .every((key) => a[key] === b[key]);

  function want(next) {
    wanted = next;
    if (!sameFace(wanted, shown) && blink >= 1) blink = 0;
  }

  // Called by its mind when it decides to change how it looks. Any of: head, tail (colour
  // names), eyes, mouth (kinds), noseColor, mouthColor (colour names).
  function setLook(look) {
    want({ ...wanted, ...look });
  }

  // Called by its mind every frame: where its head is, how squashed, and its expression.
  function pose({ x, y, stretch, expression }) {
    const last = trail[trail.length - 1] || head;
    const moved = Math.hypot(x - last.x, y - last.y);
    if (moved >= SPACING) {
      // Fill in the path it has covered, one disc every SPACING px.
      for (let d = SPACING; d <= moved; d += SPACING) {
        trail.push({ x: last.x + ((x - last.x) * d) / moved, y: last.y + ((y - last.y) * d) / moved });
      }
      while (trail.length > LENGTH / SPACING) trail.shift();
      const lean = { x: (x - last.x) / moved, y: (y - last.y) / moved };
      facing = { x: facing.x + (lean.x - facing.x) * 0.25, y: facing.y + (lean.y - facing.y) * 0.25 };
    }
    head.x = x;
    head.y = y;
    head.stretch = stretch;
    if (expression && expression !== wanted.expression) want({ ...wanted, expression });
  }

  // ---------------------------------------------------------------- drawing the face

  const rgb = (c) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
  const paint = (name) => rgb(COLORS[name] || COLORS.white);
  const disc = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const line = (...points) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };

  // Everything is measured in `s`, the head's diameter, from the middle of the face.
  function drawFace(look, s) {
    const feeling = EXPRESSIONS[look.expression] || EXPRESSIONS.content;
    ctx.lineCap = ctx.lineJoin = 'round';

    // Cheeks first, so the other features sit on top.
    if (feeling.cheeks) {
      ctx.fillStyle = paint(look.head === 'red' ? 'pink' : 'red');
      ctx.globalAlpha = 0.85;
      disc(-0.3 * s, 0.1 * s, 0.065 * s);
      disc(0.3 * s, 0.1 * s, 0.065 * s);
      ctx.globalAlpha = 1;
    }

    // Eyes. Pupils look the way it is heading, or off to one side when it is nervous.
    const big = typeof feeling.eyes === 'number' ? feeling.eyes : 1;
    const pupil = feeling.pupils || 1;
    const glance = feeling.sideways ? { x: 0.9, y: 0.1 } : facing;
    for (const side of [-1, 1]) {
      const ex = side * 0.17 * s;
      const ey = -0.09 * s;
      if (feeling.eyes === 'closed') {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.035 * s;
        ctx.beginPath();
        ctx.arc(ex, ey - 0.03 * s, 0.07 * s, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
        continue;
      }
      const px = ex + glance.x * 0.03 * s * big;
      const py = ey + glance.y * 0.03 * s * big;
      if (look.eyes === 'wide') {
        ctx.fillStyle = paint('white');
        disc(ex, ey, 0.115 * s * big);
        ctx.fillStyle = INK;
        disc(px, py, 0.07 * s * big * pupil);
      } else if (look.eyes === 'almond') {
        ctx.fillStyle = paint('white');
        ctx.beginPath();
        ctx.ellipse(ex, ey, 0.115 * s * big, 0.075 * s * big, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = INK;
        disc(px, py, 0.055 * s * big * pupil);
      } else { // white
        ctx.fillStyle = paint('white');
        disc(ex, ey, 0.105 * s * big);
        ctx.fillStyle = INK;
        disc(px, py, 0.06 * s * big * pupil);
      }
    }

    // Eyebrows, when the feeling calls for them.
    if (feeling.brows) {
      ctx.strokeStyle = paint(look.mouthColor);
      ctx.lineWidth = 0.04 * s;
      const top = -0.09 * s - 0.15 * s * big;
      for (const side of [-1, 1]) {
        const inner = side * 0.08 * s;
        const outer = side * 0.27 * s;
        if (feeling.brows === 'raised') {
          ctx.beginPath();
          ctx.arc(side * 0.17 * s, top + 0.05 * s, 0.08 * s, Math.PI * 1.2, Math.PI * 1.8);
          ctx.stroke();
        } else if (feeling.brows === 'worried') {
          line([inner, top - 0.02 * s], [outer, top + 0.045 * s]);
        } else if (feeling.brows === 'angry') {
          line([inner, top + 0.07 * s], [outer, top]);
        } else { // flat
          line([inner + side * 0.02 * s, top + 0.055 * s], [outer - side * 0.02 * s, top + 0.055 * s]);
        }
      }
    }

    // Nose: always a small circle, in whatever colour it has picked.
    ctx.fillStyle = paint(look.noseColor);
    disc(0, 0.05 * s, 0.048 * s);

    // Mouth: the feeling's, if it has one; otherwise the face's own.
    const mouth = feeling.mouth || look.mouth;
    ctx.fillStyle = ctx.strokeStyle = paint(look.mouthColor);
    ctx.lineWidth = 0.042 * s;
    ctx.beginPath();
    if (mouth === 'smile') {
      ctx.arc(0, 0.09 * s, 0.17 * s, Math.PI * 0.18, Math.PI * 0.82);
      ctx.stroke();
    } else if (mouth === 'beam') {
      ctx.lineWidth = 0.05 * s;
      ctx.arc(0, 0.06 * s, 0.22 * s, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (mouth === 'grin') {
      ctx.arc(0, 0.17 * s, 0.13 * s, 0, Math.PI);
      ctx.fill();
    } else if (mouth === 'chip') {
      ctx.arc(0, 0.2 * s, 0.06 * s, 0, Math.PI);
      ctx.fill();
    } else if (mouth === 'u') {
      ctx.arc(0, 0.2 * s, 0.045 * s, 0, Math.PI);
      ctx.stroke();
    } else if (mouth === 'o') {
      ctx.ellipse(0, 0.24 * s, 0.04 * s, 0.055 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mouth === 'oh') {
      ctx.ellipse(0, 0.25 * s, 0.07 * s, 0.055 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mouth === 'wavy') {
      const y = 0.25 * s;
      line([-0.13 * s, y], [-0.08 * s, y - 0.03 * s], [-0.03 * s, y + 0.02 * s], [0.02 * s, y - 0.03 * s],
        [0.07 * s, y + 0.02 * s], [0.13 * s, y - 0.02 * s]);
    } else if (mouth === 'frown') {
      ctx.arc(0, 0.36 * s, 0.14 * s, Math.PI * 1.22, Math.PI * 1.78);
      ctx.stroke();
    } else { // flat
      ctx.lineWidth = 0.05 * s;
      line([-0.07 * s, 0.24 * s], [0.07 * s, 0.24 * s]);
    }
  }

  // ---------------------------------------------------------------- drawing the snake

  // Paints the end of the tail: the stretch of the body from the tip (path[0]) to
  // path[paintTo]. Each pixel near that stretch takes the colour and see-through-ness of the
  // nearest point on it, measured along the body: see-through at the tip, growing solid by
  // path[fadeTo], and solid from there on. Working pixel by pixel (over just that small patch) keeps the fade smooth however
  // the tail curls, with no build-up where pieces of it overlap.
  const fadeSheet = document.createElement('canvas');
  const fadeCtx = fadeSheet.getContext('2d');
  // for each pixel of the patch: how near the stretch it is (squared), and where on it
  let nearestSheet = new Float64Array(0);
  let atSheet = new Float64Array(0);
  let indexSheet = new Float64Array(0);
  function paintFadedTail(path, paintTo, fadeTo, radius) {
    // the stretch, and how far along it each point is
    const points = path.slice(0, paintTo + 1);
    const along = [0];
    for (let k = 1; k < points.length; k++) {
      along.push(along[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y));
    }
    const length = along[fadeTo] || 1; // the length of the fade

    // the patch of the window it covers, in canvas pixels
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const left = Math.min(...xs) - radius - 2;
    const top = Math.min(...ys) - radius - 2;
    const width = Math.ceil((Math.max(...xs) + radius + 2 - left) * ratio);
    const height = Math.ceil((Math.max(...ys) + radius + 2 - top) * ratio);
    if (width < 1 || height < 1) return;
    if (fadeSheet.width !== width || fadeSheet.height !== height) {
      fadeSheet.width = width;
      fadeSheet.height = height;
    }
    const image = fadeCtx.createImageData(width, height);
    const data = image.data;
    const last = path.length - 1;

    // The nearest point on the stretch to each pixel, found piece by piece: each piece of the
    // stretch is only measured against the pixels near enough to it to be painted (within a
    // body's half width, and a little more), which is far less work than measuring every
    // pixel against every piece and comes out exactly the same. Pieces are taken in order,
    // and a later one only wins if it is strictly nearer, as when every piece was measured.
    const pixels = width * height;
    if (nearestSheet.length < pixels) {
      nearestSheet = new Float64Array(pixels);
      atSheet = new Float64Array(pixels);
      indexSheet = new Float64Array(pixels);
    }
    nearestSheet.fill(Infinity, 0, pixels);
    const reach = radius + 1; // further than this from a piece, a pixel takes none of its paint
    for (let k = 0; k < points.length - 1; k++) {
      const ax = points[k].x, ay = points[k].y;
      const dx = points[k + 1].x - ax, dy = points[k + 1].y - ay;
      const span = dx * dx + dy * dy;
      // the pixels whose middles are within reach of the piece's box
      const fromX = Math.max(Math.floor((Math.min(ax, ax + dx) - reach - left) * ratio - 0.5), 0);
      const toX = Math.min(Math.ceil((Math.max(ax, ax + dx) + reach - left) * ratio - 0.5), width - 1);
      const fromY = Math.max(Math.floor((Math.min(ay, ay + dy) - reach - top) * ratio - 0.5), 0);
      const toY = Math.min(Math.ceil((Math.max(ay, ay + dy) + reach - top) * ratio - 0.5), height - 1);
      for (let py = fromY; py <= toY; py++) {
        const y = top + (py + 0.5) / ratio;
        for (let px = fromX; px <= toX; px++) {
          const x = left + (px + 0.5) / ratio;
          const t = span ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / span, 0), 1) : 0;
          const ex = x - (ax + t * dx), ey = y - (ay + t * dy);
          const d = ex * ex + ey * ey;
          const p = py * width + px;
          if (d < nearestSheet[p]) {
            nearestSheet[p] = d;
            atSheet[p] = along[k] + t * (along[k + 1] - along[k]); // how far along the stretch
            indexSheet[p] = k + t; // and where that is along the whole body, in pieces
          }
        }
      }
    }

    for (let p = 0; p < pixels; p++) {
      const nearest = nearestSheet[p];
      if (nearest === Infinity) continue;
      const distance = Math.sqrt(nearest);
      const edge = Math.min(Math.max(radius + 0.5 - distance, 0), 1); // smooth outer edge
      if (!edge) continue;
      const shade = indexSheet[p] / last;
      const i = p * 4;
      for (let c = 0; c < 3; c++) data[i + c] = now.tail[c] + (255 - now.tail[c]) * 0.3 * shade;
      data[i + 3] = 255 * edge * Math.min(atSheet[p] / length, 1);
    }
    fadeCtx.putImageData(image, 0, 0);
    ctx.drawImage(fadeSheet, left, top, width / ratio, height / ratio);
  }

  function draw() {
    ctx.save();
    drawSnake();
    ctx.restore();
  }

  function drawSnake() {
    const path = trail.concat([head]);
    const visible = fitSheet(path);

    // Ease its colours towards the ones it has chosen.
    const headColor = COLORS[wanted.head] || COLORS.hot;
    const tailColor = COLORS[wanted.tail] || COLORS.orange;
    for (let i = 0; i < 3; i++) {
      now.head[i] += (headColor[i] - now.head[i]) * 0.08;
      now.tail[i] += (tailColor[i] - now.tail[i]) * 0.08;
    }

    // A change of face happens in a blink: the old one closes, the new one opens.
    let open = 1;
    if (blink < 1) {
      const before = blink;
      blink = Math.min(1, blink + 0.09);
      if (before < 0.5 && blink >= 0.5) shown = { ...wanted };
      open = Math.abs(1 - blink * 2);
      if (blink >= 1 && !sameFace(wanted, shown)) blink = 0; // it changed its mind mid-blink
    }

    // The body: a tube as wide as the head, laid along its trail from the tail up to the head.
    // It is all in its body colour (`tail`), shading gently paler towards the neck, so the
    // head, in a colour of its own, stands out against it.
    //
    // The end of the tail fades away to nothing. That stretch is painted first, as a picture
    // of its own (see paintFadedTail), and the rest of the body is laid over it, so where the
    // snake crosses its own tail the newer part lies on top, solid, and the fade underneath
    // stays smooth.
    if (!visible) return; // (its colours and blink carry on easing even while it is out of sight)
    const radius = HEAD / 2;
    const shade = (along) => rgb(now.tail.map((channel) => channel + (255 - channel) * 0.3 * along));
    const fadeTo = Math.floor((path.length - 1) * TAIL_FADE);
    // The painted stretch carries on, solid, a little past the fade: far enough that the
    // rounded ends of the pieces laid after it land on solid paint, not on the fade.
    const paintTo = fadeTo > 1 ? Math.min(fadeTo + Math.ceil((radius + 2) / SPACING), path.length - 1) : 0;
    if (fadeTo > 1) paintFadedTail(path, paintTo, fadeTo, radius);

    // The rest, in short, solid, round-ended pieces; each overlaps the next, so the colour
    // flows smoothly with no seams.
    ctx.lineWidth = HEAD;
    ctx.lineCap = 'round';
    for (let i = paintTo; i < path.length - 1; i++) {
      ctx.strokeStyle = shade(i / (path.length - 1));
      ctx.beginPath();
      ctx.moveTo(path[i].x, path[i].y);
      ctx.lineTo(path[i + 1].x, path[i + 1].y);
      ctx.stroke();
    }

    // The head (a little flattened when it settles to sleep), with the face leaning the way
    // it's going.
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.scale(1 - head.stretch, 1 + head.stretch);
    ctx.fillStyle = rgb(now.head);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(facing.x * HEAD * 0.06, facing.y * HEAD * 0.05);
    ctx.scale(1, Math.max(open, 0.05));
    drawFace({ ...shown, head: wanted.head }, HEAD);
    ctx.restore();

    // Anything it has been told to stay behind (see `cover` below) is cut out of the drawing,
    // so that thing shows through as if the snake had passed underneath it.
    const cover = api.cover;
    if (cover && cover.amount > 0) {
      const m = cover.matrix;
      ctx.save();
      ctx.setTransform(ratio * m.a, ratio * m.b, ratio * m.c, ratio * m.d, ratio * m.e - originX, ratio * m.f - originY);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = Math.min(cover.amount, 1);
      ctx.lineWidth = cover.width;
      ctx.lineCap = 'round';
      ctx.stroke(cover.path);
      ctx.restore();
    }
  }

  function frame() {
    requestAnimationFrame(frame); // first, so that one bad frame can never stop it for good
    if (!api.paused) draw();
  }
  requestAnimationFrame(frame);

  const api = {
    canvas, size: HEAD, start, pose, setLook, draw, trail,
    get look() { return { ...wanted }; },
    wardrobe: {
      bodyColors: BODY_COLORS, featureColors: FEATURE_COLORS, eyes: EYES, mouths: MOUTHS, contrasting,
      expressions: Object.keys(EXPRESSIONS),
    },
    // Switched off from the menu (js/menu.js): hidden, and neither drawn nor moving.
    paused: false,
    // Something on the page it should appear to pass behind, or null: { path (a Path2D),
    // matrix (from the path's units to px on the page), width (of the path's stroke) and
    // amount (0..1, how fully it is behind) }. Set by its mind.
    cover: null,
  };
  window.RG = window.RG || {};
  window.RG.mascot = api;
})();
