// The Yuki page's white cards (yuki.html): their pictures open up full size, and their
// animatics load and play.
(function () {
  var viewer = document.querySelector('.viewer');
  var flat = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- the pictures, opened up

  // Every picture on a card opens up to fill the window when it is clicked (or, from the
  // keyboard, focused and given Enter or Space): shown whole, over a dark ink veil, growing
  // out of its card and shrinking back into it when closed. A click anywhere (but on a
  // video's controls), Escape or the close button closes it. The animatics open the same
  // way, and play there, with their sound and controls; they stop when closed. (While one is
  // open, scrolling leaves the machine be: see js/tall-main.js.)
  var still = viewer && viewer.querySelector('img');
  var film = viewer && viewer.querySelector('video');
  var big = still; // whichever of the two is showing
  var opener = null;
  var closing = false;

  // From where the picture is on its card to where the opened picture is, as a transform.
  function fromPicture(picture) {
    var from = picture.getBoundingClientRect();
    var to = big.getBoundingClientRect();
    var k = Math.min(from.width / to.width, from.height / to.height);
    var dx = from.left + from.width / 2 - (to.left + to.width / 2);
    var dy = from.top + from.height / 2 - (to.top + to.height / 2);
    return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')';
  }

  function expand(img) {
    opener = img;
    closing = false;
    var moving = img.tagName === 'VIDEO';
    big = moving ? film : still;
    still.hidden = moving;
    film.hidden = !moving;
    if (moving) {
      film.src = img.dataset.full;
      film.loop = img.hasAttribute('data-loop'); // (a short one goes round and round)
      film.setAttribute('aria-label', img.getAttribute('aria-label').replace(/^Open full size: /, ''));
      film.width = img.videoWidth || 1920;
      film.height = img.videoHeight || 1080;
    } else {
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      big.width = img.naturalWidth || img.width;
      big.height = img.naturalHeight || img.height;
    }
    viewer.classList.remove('leaving');
    viewer.showModal();
    if (moving) film.play().catch(function () {});
    if (!flat) {
      big.animate([{ transform: fromPicture(img.closest('.card-picture')), opacity: 0.4 }, { transform: 'none', opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    }
  }

  function shrink() {
    if (!viewer.open || closing) return;
    closing = true;
    film.pause();
    viewer.classList.add('leaving');
    var done = function () {
      viewer.close();
      viewer.classList.remove('leaving');
      closing = false;
      if (opener) opener.focus({ preventScroll: true });
    };
    if (flat) { done(); return; }
    var away = big.animate([{ transform: 'none', opacity: 1 }, { transform: fromPicture(opener.closest('.card-picture')), opacity: 0 }],
      { duration: 300, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' });
    away.onfinish = function () { away.cancel(); done(); };
  }

  if (viewer) [].forEach.call(document.querySelectorAll('.board-card .card-picture img, .board-card .card-picture video'), function (img) {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Open full size: ' + (img.alt || img.getAttribute('aria-label')));
    img.addEventListener('click', function () { expand(img); });
    img.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(img); }
    });
  });
  // ---------------------------------------------------------------- the stickers

  // Die-cut stickers (".card-sticker" in style.css) answer to the pointer only over their own
  // shapes, not the clear corners of their pictures, which overlap where they're stuck on side
  // by side: pointed at, the one whose shape is under the pointer (the topmost, where two are)
  // is marked .is-pointed (to grow and tilt), and a click opens that one, and a click on clear
  // picture opens none. Their shapes are read from their pictures' own pixels, once loaded.
  [].forEach.call(document.querySelectorAll('.card-stickers'), function (sheet) {
    var stickers = [].slice.call(sheet.querySelectorAll('.card-sticker'));
    var alpha = new Map(); // sticker -> { data, w, h }: its picture's opacity, pixel by pixel
    stickers.forEach(function (sticker) {
      var img = sticker.querySelector('img');
      var read = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          alpha.set(sticker, { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height });
        } catch (e) { /* (unreadable, as from a file: its whole box answers instead) */ }
      };
      if (img.complete && img.naturalWidth) read(); else img.addEventListener('load', read);
    });
    // the sticker whose shape is at a point in the window, or null
    function stickerAt(x, y) {
      var box = sheet.getBoundingClientRect();
      for (var i = stickers.length - 1; i >= 0; i--) {
        var s = stickers[i];
        var w = s.offsetWidth;
        var h = s.offsetHeight;
        // the point in the sticker's own (untilted, unscaled) box, about its middle
        var m = new DOMMatrix(getComputedStyle(s).transform).inverse();
        var p = m.transformPoint(new DOMPoint(x - box.left - s.offsetLeft - w / 2, y - box.top - s.offsetTop - h / 2));
        var u = (p.x + w / 2) / w;
        var v = (p.y + h / 2) / h;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        var a = alpha.get(s);
        if (!a) return s;
        var px = Math.min(a.w - 1, Math.floor(u * a.w));
        var py = Math.min(a.h - 1, Math.floor(v * a.h));
        if (a.data[(py * a.w + px) * 4 + 3] > 40) return s;
      }
      return null;
    }
    var pointed = null;
    function point(s) {
      if (s === pointed) return;
      if (pointed) pointed.classList.remove('is-pointed');
      pointed = s;
      if (s) s.classList.add('is-pointed');
    }
    sheet.addEventListener('pointermove', function (event) { point(stickerAt(event.clientX, event.clientY)); });
    sheet.addEventListener('pointerleave', function () { point(null); });
    // (a click goes to the sticker whose shape it's on, if any: before the pictures' own)
    sheet.addEventListener('click', function (event) {
      var s = stickerAt(event.clientX, event.clientY);
      var img = event.target.closest && event.target.closest('img');
      if (s && img && s.contains(img)) return; // (on its own shape: as usual)
      event.stopPropagation();
      if (s) expand(s.querySelector('img'));
    }, true);
  });

  // the play badge on the animatic opens it too
  if (viewer) [].forEach.call(document.querySelectorAll('.board-card .play-badge'), function (badge) {
    badge.addEventListener('click', function () { expand(badge.parentElement.querySelector('video')); });
  });
  if (viewer) {
    viewer.addEventListener('click', function (event) {
      if (event.target === film) return; // its controls
      shrink();
    });
    viewer.addEventListener('cancel', function (event) { event.preventDefault(); shrink(); });
  }

  // ---------------------------------------------------------------- the animatics

  // The animatics only fetch their films once their card is within a window's height of
  // coming into view, so the page doesn't download them while the visitor is up at the top.
  // The ones that play on their own (data-autoplay) play, silently and round and round, only
  // while they're in view, and wait, paused, while they're not; or, for a visitor who would
  // rather things on screen didn't move, they don't play, and stay on the frame named in
  // data-src.
  var waitingFilms = document.querySelectorAll('.board-card video[data-src]');
  var playsAlone = function (f) { return f.hasAttribute('data-autoplay') && !flat; };
  var sourceOf = function (f) { return playsAlone(f) ? f.dataset.src.split('#')[0] : f.dataset.src; };
  if ('IntersectionObserver' in window) {
    var nearby = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (!entry.target.getAttribute('src')) entry.target.src = sourceOf(entry.target);
        nearby.unobserve(entry.target);
      });
    }, { rootMargin: '100% 0px' });
    [].forEach.call(waitingFilms, function (f) { nearby.observe(f); });
    var inView = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var f = entry.target;
        if (entry.isIntersecting) {
          if (!f.getAttribute('src')) f.src = sourceOf(f);
          f.play().catch(function () {});
        } else {
          f.pause();
        }
      });
    }, { threshold: 0.2 });
    [].forEach.call(waitingFilms, function (f) { if (playsAlone(f)) inView.observe(f); });
  } else {
    [].forEach.call(waitingFilms, function (f) {
      f.src = sourceOf(f);
      if (playsAlone(f)) f.play().catch(function () {});
    });
  }
})();
