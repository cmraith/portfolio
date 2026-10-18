// The pointer, for the whole site.
//
// 1. It reports where the pointer is, on this page or inside a frame within it (the game on
//    the Play page), as "site-pointer" events on the window. Anything that needs to know,
//    such as the mascot, listens for those instead of the browser's own pointer events,
//    which stop at a frame's edge.
// 2. With a mouse or trackpad, it replaces the normal arrow with a flat circle that inverts
//    whatever is underneath it (see ".cursor" in style.css).
(function () {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------------------------------------------------------------- reporting the pointer

  // detail: { type: 'move' | 'down' | 'up' | 'leave', x, y, target }, x and y in this page.
  function report(type, event, at) {
    window.dispatchEvent(new CustomEvent('site-pointer', {
      detail: {
        type,
        x: event ? event.clientX + at.left : 0,
        y: event ? event.clientY + at.top : 0,
        target: event ? event.target : null,
        touch: event ? event.pointerType === 'touch' : false,
      },
    }));
  }

  // Watches the pointer in one window: this page, or a frame inside it. `offset` gives where
  // that window's top left corner sits on this page.
  function follow(view, offset) {
    view.addEventListener('pointermove', (event) => report('move', event, offset()));
    view.addEventListener('pointerdown', (event) => report('down', event, offset()));
    view.addEventListener('pointerup', (event) => report('up', event, offset()));
    view.document.documentElement.addEventListener('pointerleave', () => report('leave'));
  }

  follow(window, () => ({ left: 0, top: 0 }));

  // A frame is a separate page with its own pointer, which this page never sees. Only frames
  // from this same site can be looked inside.
  function adopt(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.documentElement) return;
      if (fine) {
        const style = doc.createElement('style');
        style.textContent = '* { cursor: none !important; }';
        doc.head.appendChild(style);
      }
      follow(frame.contentWindow, () => frame.getBoundingClientRect());
    } catch (error) {
      // A frame this page isn't allowed to look inside keeps its own cursor.
    }
  }

  for (const frame of document.querySelectorAll('iframe')) {
    frame.addEventListener('load', () => adopt(frame));
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') adopt(frame);
  }

  // ---------------------------------------------------------------- the circle

  // Only with a mouse or trackpad. On a touch screen there is no pointer to follow, so
  // nothing is added and nothing is hidden.
  if (!fine) return;

  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  document.documentElement.classList.add('custom-cursor'); // hides the normal arrow

  // Things that can be clicked; the circle grows over them, in place of the pointing hand.
  // (.hovering-clickable: a clickable thing drawn in a 3D scene; the scene sets it on its canvas
  // while the pointer is over it)
  const CLICKABLE = 'a, button, [role="button"], input, select, textarea, label, .hovering-clickable';

  window.addEventListener('site-pointer', ({ detail }) => {
    if (detail.touch) return;
    if (detail.type === 'move') {
      dot.style.transform = `translate3d(${detail.x}px, ${detail.y}px, 0)`;
      dot.classList.add('visible');
      const target = detail.target;
      const clickable = target && target.closest && target.closest(CLICKABLE);
      // (a die-cut sticker only where its own shape is under the pointer: js/cards.js marks it)
      const clearSticker = clickable && clickable.closest('.card-sticker') && !clickable.closest('.card-sticker.is-pointed');
      dot.classList.toggle('over-link', !!clickable && !clearSticker);
    } else if (detail.type === 'down') {
      dot.classList.add('pressed');
    } else if (detail.type === 'up') {
      dot.classList.remove('pressed');
    } else if (detail.type === 'leave') {
      dot.classList.remove('visible');
    }
  });
})();
