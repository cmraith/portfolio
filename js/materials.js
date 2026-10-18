// Palette, canvas-drawn pattern textures and the material factory.
window.RG = window.RG || {};

(function (RG) {
  const C = RG.C = {
    cream: '#f6f0e1',
    peg: '#d3c8b0',
    yellow: '#ffd026',
    mustard: '#f5c21b', // the backdrop at the horizon, and the floor: hsl(46, 92%, 53%)
    backdropTop: '#f9ef67', // the backdrop at the top of the window: hsl(56, 92%, 69%)
    pink: '#ff9dbb',
    hot: '#ff4f8a',
    orange: '#ff6b1c',
    red: '#e8362e',
    green: '#1fa55d',
    blue: '#2b5fd9',
    sky: '#a8d5ee',
    navy: '#1c2b63',
    black: '#1d1d22',
    white: '#ffffff',
  };

  const cache = new Map();
  function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }

  function canvasTexture(size, draw, repeat) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // One tile = a centre dot plus four corner quarters, which tiles into staggered polka dots.
  function dotsTexture(bg, fg) {
    return cached('dots' + bg + fg, () => canvasTexture(128, (ctx, s) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = fg;
      for (const [x, y] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, s * 0.21, 0, Math.PI * 2);
        ctx.fill();
      }
    }, true));
  }

  function stripesTexture(a, b) {
    return cached('stripes' + a + b, () => canvasTexture(64, (ctx, s) => {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = b;
      ctx.fillRect(s / 2, 0, s / 2, s);
    }, true));
  }

  function targetTexture(a, b, rings) {
    return cached('target' + a + b + rings, () => canvasTexture(512, (ctx, s) => {
      for (let i = 0; i < rings; i++) {
        ctx.fillStyle = i % 2 ? b : a;
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, (s / 2) * (1 - i / rings) * 1.02, 0, Math.PI * 2);
        ctx.fill();
      }
    }, false));
  }

  function pegboardTexture() {
    return cached('pegboard', () => canvasTexture(64, (ctx, s) => {
      ctx.fillStyle = C.cream;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = C.peg;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }, true));
  }

  function textured(tex, repeatX, repeatY, rotation) {
    const map = tex.clone();
    map.needsUpdate = true;
    map.repeat.set(repeatX, repeatY);
    if (rotation) {
      map.center.set(0.5, 0.5);
      map.rotation = rotation;
    }
    return map;
  }

  // Moulded-plastic look: a smooth base under a clear glossy coat that picks up highlights
  // from the sun and soft reflections of the room environment main.js bakes into RG.envMap.
  function plastic(params, roughness = 0.3) {
    return new THREE.MeshPhysicalMaterial({
      roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMap: RG.envMap,
      envMapIntensity: 0.3,
      ...params,
    });
  }

  RG.M = {
    // Solid-colour plastic, used for almost every part.
    paint(color, roughness) {
      return cached('paint' + color + roughness, () => plastic({ color }, roughness));
    },
    // No gloss or reflections: the floor, plinth, pegboard and ropes.
    matte(color, roughness = 0.9) {
      return cached('matte' + color + roughness, () => new THREE.MeshStandardMaterial({ color, roughness }));
    },
    // Metals mirror the room environment.
    metal(color, roughness = 0.25) {
      return cached('metal' + color + roughness, () => new THREE.MeshStandardMaterial({
        color, roughness, metalness: 1, envMap: RG.envMap,
      }));
    },
    // `repeat` is tiles per UV unit: tiles per world unit on extruded shapes, tiles across on disc caps.
    dots(bg, fg, repeat) {
      return plastic({ map: textured(dotsTexture(bg, fg), repeat, repeat) });
    },
    stripes(a, b, repeat, rotation = 0) {
      return plastic({ map: textured(stripesTexture(a, b), repeat, repeat, rotation) });
    },
    target(a, b, rings = 7) {
      return plastic({ map: textured(targetTexture(a, b, rings), 1, 1) });
    },
    pegboard(holesPerUnit) {
      return new THREE.MeshStandardMaterial({
        map: textured(pegboardTexture(), holesPerUnit, holesPerUnit),
        roughness: 0.85,
      });
    },
  };
})(window.RG);
