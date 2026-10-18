// The name. This sets its two lines (the second is enlarged until it is as wide as the first,
// so the two form a block with straight left and right edges), and builds
// its hover effect: every letter is cut into small pieces, "quarters", and the
// quarters within a short distance of the pointer turn into tiles of flat geometric shapes
// (see ".title h1 .ch" in style.css). Each quarter responds on its own.
//
// Runs as soon as the heading exists, before the page is first drawn. It rebuilds the heading
// as one cell per letter, sized to the letter's own width so the name looks exactly as it did
// as plain text. Inside a cell, each quarter holds its own copy of the letter, clipped to
// that quarter, and the tile that replaces it.
//
// A page may also show the name large and plain (.hero-name, the About page): its lines are
// sized the same way, without the hover effect.
(function () {
  const headings = [...document.querySelectorAll('.title h1, .hero-name')];

  // Quarters are kept about the same size everywhere: roughly half the height of a first-line
  // capital, and this wide. A letter is cut into as many rows and columns of them as fit it
  // best, so a first-line letter gets 2 x 2 (the narrow I gets 1 x 2) and the larger second
  // line gets more.
  const TILE_WIDTH = 0.33; // em of the first line
  const COLOR = {
    pink: '#ff9dbb',
    orange: '#ff6b1c',
    blue: '#2b5fd9',
    green: '#6cc5a0',
    yellow: '#ffd84d',
    cream: '#f6f0e1',
    ink: '#1c2b63',
  };

  // ---------------------------------------------------------------- shapes, on a 100 x 100 tile

  const ground = (color) => `<rect width="100" height="100" fill="${color}"/>`;
  const disc = (color, r, cx = 50, cy = 50) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;

  // Quarter circle of radius r centred on one corner: tl, tr, br or bl.
  function quarter(color, corner, r = 100) {
    const d = {
      tl: `M0 0H${r}A${r} ${r} 0 0 1 0 ${r}Z`,
      tr: `M100 0V${r}A${r} ${r} 0 0 1 ${100 - r} 0Z`,
      br: `M100 100H${100 - r}A${r} ${r} 0 0 1 100 ${100 - r}Z`,
      bl: `M0 100V${100 - r}A${r} ${r} 0 0 1 ${r} 100Z`,
    }[corner];
    return `<path d="${d}" fill="${color}"/>`;
  }

  // Half the tile, cut corner to corner; `corner` is the right-angled one.
  function triangle(color, corner) {
    const points = {
      tl: '0,0 100,0 0,100',
      tr: '0,0 100,0 100,100',
      br: '100,0 100,100 0,100',
      bl: '0,0 100,100 0,100',
    }[corner];
    return `<polygon points="${points}" fill="${color}"/>`;
  }

  function stripes(color) {
    let bands = '';
    for (let y = -34; y < 130; y += 28) bands += `<rect x="-40" y="${y}" width="180" height="14"/>`;
    return `<g transform="rotate(-45 50 50)" fill="${color}">${bands}</g>`;
  }

  const cross = (color) => `<g transform="rotate(45 50 50)" fill="${color}">`
    + '<rect x="16" y="39" width="68" height="22"/><rect x="39" y="16" width="22" height="68"/></g>';

  const dome = (color) => `<path d="M0 100V50A50 50 0 0 1 100 50V100Z" fill="${color}"/>`;

  // The tile designs. Tiles are dealt from this list in an order that keeps repeats apart.
  const designs = [
    ground(COLOR.cream) + quarter(COLOR.pink, 'br') + quarter(COLOR.blue, 'br', 50),
    ground(COLOR.orange) + disc(COLOR.cream, 28),
    ground(COLOR.cream) + triangle(COLOR.orange, 'br'),
    ground(COLOR.green) + quarter(COLOR.blue, 'tl'),
    ground(COLOR.ink) + quarter(COLOR.yellow, 'bl'),
    ground(COLOR.yellow) + disc(COLOR.orange, 30),
    ground(COLOR.blue) + cross(COLOR.cream),
    ground(COLOR.cream) + stripes(COLOR.ink),
    ground(COLOR.pink) + dome(COLOR.ink),
    ground(COLOR.pink) + quarter(COLOR.green, 'tr'),
    ground(COLOR.ink) + triangle(COLOR.green, 'bl'),
    ground(COLOR.green) + disc(COLOR.cream, 32) + disc(COLOR.green, 13),
    ground(COLOR.cream) + cross(COLOR.ink),
    `<rect width="50" height="100" fill="${COLOR.blue}"/><rect x="50" width="50" height="100" fill="${COLOR.orange}"/>`
      + disc(COLOR.pink, 15, 25) + disc(COLOR.cream, 15, 75),
    ground(COLOR.orange) + quarter(COLOR.cream, 'tl') + quarter(COLOR.orange, 'tl', 50),
    ground(COLOR.cream) + disc(COLOR.ink, 30),
    ground(COLOR.yellow) + triangle(COLOR.blue, 'tr'),
  ];
  const DEAL = 7; // step through the list; shares no factor with its length (17)

  // Builds one heading; returns its quarters.
  function build(heading) {
    // (from the heading as written, kept the first time, as it can be built again: see below)
    if (heading.dataset.source === undefined) heading.dataset.source = heading.innerHTML;
    const lines = heading.dataset.source.split(/<br\s*\/?>/i).map((line) => line.trim());

    // ---------------------------------------------------------------- measuring the font

    // Everything in em, so it holds at any size the name is drawn at.
    const style = getComputedStyle(heading);
    const fontSize = parseFloat(style.fontSize);
    const spacing = parseFloat(style.letterSpacing) / fontSize || 0;
    const lineHeight = parseFloat(style.lineHeight) / fontSize;
    const ctx = document.createElement('canvas').getContext('2d');
    const SAMPLE = 200;
    ctx.font = `${style.fontWeight} ${SAMPLE}px ${style.fontFamily}`;
    const advance = (letter) => ctx.measureText(letter).width / SAMPLE + spacing;

    // Where the capital letters sit inside a line, so a tile covers exactly their height.
    const caps = ctx.measureText('H');
    const fontHeight = (caps.fontBoundingBoxAscent + caps.fontBoundingBoxDescent) / SAMPLE;
    const baseline = (lineHeight - fontHeight) / 2 + caps.fontBoundingBoxAscent / SAMPLE;
    const capHeight = caps.actualBoundingBoxAscent / SAMPLE;
    heading.style.setProperty('--cap-top', (baseline - capHeight).toFixed(4) + 'em');
    heading.style.setProperty('--cap-height', capHeight.toFixed(4) + 'em');

    // How wide a line's letters are, from the left edge of the first to the right edge of the
    // last. Letters start and end a little inside their own boxes; `inset` is how far in the
    // first one starts, which the line is pulled back by so its letters sit on the grid line.
    function measure(text) {
      const letters = [...text.toUpperCase()];
      const first = ctx.measureText(letters[0]);
      const last = ctx.measureText(letters[letters.length - 1]);
      const boxes = letters.reduce((sum, letter) => sum + advance(letter), 0);
      const inset = spacing / 2 - first.actualBoundingBoxLeft / SAMPLE;
      const outset = spacing / 2 + (last.width - last.actualBoundingBoxRight) / SAMPLE;
      return { inset, width: boxes - inset - outset, boxes };
    }

    // How large each line is drawn, relative to the name's own size: the first as it is, and
    // every other line scaled until its letters span the same width as the first line's. The
    // heading as a whole may be sized as other words would be on one line (data-size-as: the
    // About page's, so splitting it and adding to it leave its first line's size alone).
    const sizeAs = heading.dataset.sizeAs;
    const measured = lines.map(measure);
    const LINE_SCALE = measured.map((line) => measured[0].width / line.width);

    // The name's full height, in multiples of its font size, for centring it on the opening
    // screen and placing the hint under it (see style.css).
    const nameHeight = LINE_SCALE.reduce((sum, scale) => sum + scale * lineHeight, 0);

    // A plain copy of the name (.hero-name, the About page's large one) takes only the lines'
    // sizes, with no hover effect: its height and width (in multiples of its size) go on the
    // element holding it, so style.css can size it, and anything set with it, to fit its space.
    if (!heading.closest('.title')) {
      const whole = sizeAs ? measure(sizeAs) : null;
      heading.parentElement.style.setProperty('--name-height', (whole ? lineHeight : nameHeight).toFixed(4));
      heading.parentElement.style.setProperty('--name-width', (whole || measured[0]).width.toFixed(4));
      // (and it is as wide as those words, so the words under it are too)
      if (whole) heading.style.width = (whole.boxes - whole.inset).toFixed(4) + 'em';
      heading.setAttribute('aria-label', lines.join(' '));
      heading.textContent = '';
      lines.forEach((text, lineIndex) => {
        const line = document.createElement('span');
        line.className = 'line';
        line.setAttribute('aria-hidden', 'true');
        line.style.fontSize = (LINE_SCALE[lineIndex] || 1).toFixed(4) + 'em';
        line.style.marginLeft = (-measured[lineIndex].inset).toFixed(4) + 'em';
        // one cell per letter, each as wide as measured, as in the corner name, so the lines
        // come out exactly as wide as each other
        for (const letter of text.toUpperCase()) {
          const cell = document.createElement('span');
          cell.className = 'ch';
          cell.style.setProperty('--w', advance(letter).toFixed(4) + 'em');
          cell.textContent = letter;
          line.appendChild(cell);
        }
        heading.appendChild(line);
      });
      return [];
    }
    document.documentElement.style.setProperty('--name-height', nameHeight.toFixed(4));
    // (and its letters' width: the Yuki page fits a box behind it)
    document.documentElement.style.setProperty('--name-width', measured[0].width.toFixed(4));

    // ---------------------------------------------------------------- rebuilding the heading

    heading.setAttribute('aria-label', lines.join(' '));
    heading.textContent = '';
    const SPILL = '-0.3em'; // on a letter's outer edges, don't clip: curves overshoot a little
    const OVERLAP = '0.02em'; // neighbouring quarters overlap this much, so no seam shows (in em, so it
    // holds when the name is drawn large and shrunk: see .title in style.css)
    let dealt = 0;
    lines.forEach((text, lineIndex) => {
      const scale = LINE_SCALE[lineIndex] || 1;
      const line = document.createElement('span');
      line.className = 'line';
      line.style.fontSize = scale.toFixed(4) + 'em';
      line.style.marginLeft = (-measured[lineIndex].inset).toFixed(4) + 'em';
      heading.appendChild(line);

      // Rows of quarters for this line: two on a first-line letter, more on a larger one.
      const rows = Math.max(1, Math.round(2 * scale));

      for (const letter of text.toUpperCase()) {
        const width = advance(letter); // in em of this line
        const columns = Math.max(1, Math.round((width * scale) / TILE_WIDTH));
        const cell = document.createElement('span');
        cell.className = 'ch';
        cell.setAttribute('aria-hidden', 'true');
        cell.style.setProperty('--w', width.toFixed(4) + 'em');
        cell.style.setProperty('--columns', columns);
        cell.style.setProperty('--rows', rows);

        // An invisible copy that gives the cell its size and baseline.
        let html = '<span class="sizer"></span>';
        for (let q = 0; q < columns * rows; q++) {
          const col = q % columns;
          const row = Math.floor(q / columns);
          const design = designs[(dealt++ * DEAL) % designs.length];

          // The piece of the letter this quarter shows: inset(top right bottom left), measured
          // on the whole cell. Cuts between rows divide the capitals' height evenly; cuts
          // between columns divide the cell's width evenly.
          const cutAbove = `(var(--cap-top) + var(--cap-height) * ${row} / ${rows})`;
          const cutBelow = `(var(--cap-top) + var(--cap-height) * ${row + 1} / ${rows})`;
          const clip = [
            row === 0 ? SPILL : `calc(${cutAbove} - ${OVERLAP})`,
            col === columns - 1 ? SPILL : `calc(100% * ${columns - col - 1} / ${columns} - ${OVERLAP})`,
            row === rows - 1 ? SPILL : `calc(100% - ${cutBelow} - ${OVERLAP})`,
            col === 0 ? SPILL : `calc(100% * ${col} / ${columns} - ${OVERLAP})`,
          ].join(' ');

          html += `<span class="quarter" style="--col:${col};--row:${row}">`
            + `<span class="piece" style="clip-path:inset(${clip})"></span>`
            + `<svg class="tile" viewBox="0 0 100 100" preserveAspectRatio="none">${design}</svg>`
            + '</span>';
        }
        cell.innerHTML = html;
        cell.querySelectorAll('.sizer, .piece').forEach((copy) => { copy.textContent = letter; });
        line.appendChild(cell);
      }
    });

    return [...heading.querySelectorAll('.quarter')];
  }

  const names = headings.map(build); // each heading's quarters

  // The name is measured in its font (Nunito, hosted with the site). If that hasn't arrived
  // yet (it holds the name back meanwhile: "block" in style.css), the measurements above were
  // of a stand-in, so build it again, measured right, once it has.
  const font = '900 20px "Nunito"';
  if (document.fonts && !document.fonts.check(font)) {
    document.fonts.load(font).then(() => {
      headings.forEach((heading, i) => { names[i] = build(heading); });
      schedule();
    });
  }

  // ---------------------------------------------------------------- following the pointer

  // Every quarter whose centre is within this distance of the pointer shows its tile. The
  // distance is in quarter-heights, so it keeps pace with the size the name is drawn at.
  const REACH = 2.2;
  const MIN_REACH = 46; // px: at the least, reaching past the cursor's circle
  let pointer = null; // last known position, or null when it has left the window
  let queued = false;

  function refresh() {
    queued = false;
    names.forEach(refreshName);
  }

  function refreshName(quarters) {
    if (!quarters.length) return;
    // (only while the name is large, on the Work page's opening screen: small, in its corner
    // of the nav bar, it stays plain)
    const large = !!quarters[0].closest('body.intro');
    const active = !!pointer && large;
    const reach = active ? Math.max(quarters[0].getBoundingClientRect().height * REACH, MIN_REACH) : 0;
    for (const quarter of quarters) {
      let distance = Infinity;
      if (active) {
        const box = quarter.getBoundingClientRect();
        distance = Math.hypot(box.left + box.width / 2 - pointer.x, box.top + box.height / 2 - pointer.y);
      }
      const on = distance < reach;
      // --far (0 at the pointer, 1 at the edge of its reach) staggers the change outwards.
      if (on) quarter.style.setProperty('--far', (distance / reach).toFixed(2));
      quarter.classList.toggle('on', on);
    }
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(refresh);
    }
  }

  // The pointer is reported by js/cursor.js, which also sees it inside a frame (the game on
  // the Play page), where this page's own pointer events stop.
  window.addEventListener('site-pointer', ({ detail }) => {
    if (detail.type === 'move') pointer = { x: detail.x, y: detail.y };
    else if (detail.type === 'leave') pointer = null;
    else return;
    schedule();
  });

  // The effect works only while the name is large, on the opening screen (see refreshName).
  // When the name moves between that and its corner, bring the quarters in line straight away
  // rather than at the next pointer move (so any tiles showing turn back as it goes).
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
