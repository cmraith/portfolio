// Loaded as a plain (non-module) script so the page also works when opened straight from
// disk: browsers block <script type="module" src> over file://, but not a dynamic import()
// of the CDN copy of three.js. Everything below runs once three.js has arrived.
(async () => {
const THREE = await import('three');
const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 1.5, 6.9);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.1, 0);
controls.enableDamping = true;
controls.enablePan = false;
// No zooming: the scroll wheel scrolls the Play page instead, on to (or back from) its other games.
controls.enableZoom = false;
controls.minDistance = 3.5;
controls.maxDistance = 11;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = Math.PI * 0.56;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.1;

// Lights: warm sky/ground fill, a key light that casts the shadow, a cool rim.
scene.add(new THREE.HemisphereLight(0xfff4e8, 0xc9937a, 1.25));

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-3, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -3;
key.shadow.camera.right = key.shadow.camera.top = 3;
key.shadow.radius = 6;
key.shadow.bias = -0.0005;
scene.add(key);

const rim = new THREE.DirectionalLight(0xffd9c2, 1.2);
rim.position.set(4, 2, -4);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.ShadowMaterial({ opacity: 0.16 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.99;
// (no shadow on the floor: it's hidden, kept only for its height, where the crumbs land)
ground.visible = false;
scene.add(ground);

// ---------------------------------------------------------------------------
// Helpers: seeded randomness, wrapping value noise, smooth painted canvas textures
// ---------------------------------------------------------------------------

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise that wraps horizontally, so the texture seam around the apple is invisible.
function valueNoise(rand, cellsX, cellsY) {
  const grid = Array.from({ length: (cellsY + 1) * cellsX }, rand);
  const at = (i, j) => grid[j * cellsX + (((i % cellsX) + cellsX) % cellsX)];
  return (u, v) => {
    const x = u * cellsX;
    const y = v * cellsY;
    const i = Math.floor(x);
    const j = Math.min(Math.floor(y), cellsY - 1);
    const fx = x - i, fy = y - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// Colours are [r, g, b] in 0..1 (sRGB).
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c, s) => [c[0] * s, c[1] * s, c[2] * s];

// A high-res texture painted per pixel, sampled with smooth (linear, mipmapped) filtering.
// paint(u, v) gets u around the apple (0..1, wrapping) and v from bottom (0) to top (1).
function paintedTexture(width, height, paint) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint((x + 0.5) / width, 1 - (y + 0.5) / height);
      const i = (y * width + x) * 4;
      img.data[i] = r * 255;
      img.data[i + 1] = g * 255;
      img.data[i + 2] = b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// ---------------------------------------------------------------------------
// Apple skins: soft, painterly washes of colour rather than hard pixels.
// Texture u wraps around the apple, v runs bottom (0) to top (1).
// ---------------------------------------------------------------------------

// Red skin with broad orange and golden washes blended through it, deeper red in the
// dimples top and bottom, and a faint mottling like soft brushwork.
function appleSkin(seed = 7) {
  const rand = rng(seed);
  const wash = valueNoise(rand, 5, 3);      // big soft blotches
  const detail = valueNoise(rand, 11, 6);   // smaller patches inside them
  const mottle = valueNoise(rand, 28, 14);  // faint dabs of lighter and darker paint
  const DEEP = [0.6, 0.07, 0.06];
  const RED = [0.93, 0.22, 0.11];
  const ORANGE = [0.97, 0.45, 0.15];
  const GOLD = [1, 0.72, 0.28];

  return paintedTexture(512, 256, (u, v) => {
    const w = wash(u, v) * 0.6 + detail(u, v) * 0.4;
    const warmth = w + (0.5 - v) * 0.35; // warmer towards the base
    let c = mix(RED, ORANGE, smoothstep(0.3, 0.64, warmth));
    c = mix(c, GOLD, 0.8 * smoothstep(0.56, 0.84, warmth));
    c = mix(c, DEEP, 0.75 * smoothstep(0.86, 0.99, v) + 0.6 * smoothstep(0.14, 0.02, v));
    return scale(c, 1 + (mottle(u, v) - 0.5) * 0.08);
  });
}

// Pale, woody stem: darker at the base where it meets the apple.
function stemSkin(seed = 3) {
  const rand = rng(seed);
  const grain = valueNoise(rand, 6, 12);
  return paintedTexture(64, 128, (u, v) => {
    const c = mix([0.42, 0.26, 0.14], [0.8, 0.62, 0.42], smoothstep(0, 0.8, v));
    return scale(c, 1 + (grain(u, v) - 0.5) * 0.12);
  });
}

// Creamy inside, shown wherever a bite has cut into the apple.
function fleshSkin(seed = 5) {
  const rand = rng(seed);
  const wash = valueNoise(rand, 8, 4);
  const grain = valueNoise(rand, 40, 80);
  return paintedTexture(256, 128, (u, v) => {
    const c = mix([0.93, 0.82, 0.58], [1, 0.95, 0.83], smoothstep(0.2, 0.8, wash(u, v)));
    return scale(c, 1 + (grain(u, v) - 0.5) * 0.06);
  });
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const positionKey = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Lathe duplicates vertices along the UV seam and at the poles. Find those coincident
// sets once; bites move them identically, so the sets never change.
function coincidentVertices(geometry) {
  const pos = geometry.attributes.position;
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = positionKey(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }
  return [...groups.values()].filter((idx) => idx.length > 1);
}

// Average normals across coincident vertices so the body shades smoothly with no visible seam.
function weldNormals(geometry, groups) {
  const nor = geometry.attributes.normal;
  const n = new THREE.Vector3();
  for (const idx of groups) {
    n.set(0, 0, 0);
    for (const i of idx) n.x += nor.getX(i), n.y += nor.getY(i), n.z += nor.getZ(i);
    n.normalize();
    for (const i of idx) nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
}

// Apple silhouette from the bottom dimple up to the stem well: wider shoulders,
// slightly narrower base, dimples top and bottom.
const APPLE_PROFILE = [
  [0.0, -0.74], [0.16, -0.82], [0.36, -0.89], [0.58, -0.86], [0.78, -0.72],
  [0.93, -0.48], [1.01, -0.18], [1.03, 0.12], [0.99, 0.4], [0.88, 0.63],
  [0.7, 0.8], [0.46, 0.86], [0.24, 0.8], [0.1, 0.67], [0.0, 0.6],
];

// Resampled to a fine outline so the worm's small bites have enough vertices to carve.
const APPLE_OUTLINE = new THREE.SplineCurve(
  APPLE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y * 1.08))
).getSpacedPoints(80).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
const APPLE_BOTTOM = Math.min(...APPLE_OUTLINE.map((p) => p.y));
const APPLE_TOP = Math.max(...APPLE_OUTLINE.map((p) => p.y));

// Smooth lumps and a slight lean. Functions of angle and height, so the seam stays closed.
const lumpiness = (angle, y) =>
  (1 + 0.03 * Math.sin(angle * 3 + 1.3) * Math.sin(y * 2.6 + 0.4) + 0.018 * Math.sin(angle * 5 - y * 3.1)) *
  (1 + 0.04 * Math.sin(angle * 2 + 0.6) * (y + 0.9));

function appleGeometry() {
  const geo = new THREE.LatheGeometry(APPLE_OUTLINE, 80);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.hypot(x, z) < 1e-4) continue;
    const s = lumpiness(Math.atan2(x, z), y);
    pos.setXYZ(i, x * s, y, z * s);
  }
  // How far each vertex has been bitten inward; the shader paints flesh where this is > 0.
  geo.setAttribute('eaten', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  geo.computeVertexNormals();
  return geo;
}

function stemGeometry() {
  const length = 0.62;
  const geo = new THREE.CylinderGeometry(0.055, 0.085, length, 6, 4);
  geo.translate(0, length / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const t = y / length;
    const slant = t > 0.99 ? x * 0.6 : 0; // angled snip at the tip
    pos.setXYZ(i, x + 0.14 * t * t, y + slant, pos.getZ(i));
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const APPLE_GEO = appleGeometry();
const APPLE_SEAMS = coincidentVertices(APPLE_GEO);
weldNormals(APPLE_GEO, APPLE_SEAMS);
const STEM_GEO = stemGeometry();
const stemMat = new THREE.MeshStandardMaterial({ map: stemSkin(), roughness: 0.8 });
const bodyMat = new THREE.MeshStandardMaterial({ map: appleSkin(), roughness: 0.6 });
const tipMat = new THREE.MeshStandardMaterial({ color: 0xd9853a, roughness: 0.7 });

// Swap the skin for flesh wherever the surface has been bitten, deepening towards the core.
const fleshMap = fleshSkin();
bodyMat.onBeforeCompile = (shader) => {
  shader.uniforms.fleshMap = { value: fleshMap };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float eaten;\nvarying float vEaten;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\nvEaten = eaten;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D fleshMap;\nvarying float vEaten;')
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      vec3 flesh = texture2D(fleshMap, vMapUv).rgb;
      flesh *= mix(vec3(1.0), vec3(0.92, 0.82, 0.62), smoothstep(0.3, 0.7, vEaten));
      diffuseColor.rgb = mix(diffuseColor.rgb, flesh, step(0.025, vEaten));`
    );
};

function makeApple() {
  const apple = new THREE.Group();
  const body = new THREE.Mesh(APPLE_GEO, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  apple.add(body);

  // Cylinder material groups: side, top cap, bottom cap.
  const stem = new THREE.Mesh(STEM_GEO, [stemMat, tipMat, stemMat]);
  stem.position.set(0.02, 0.65, 0);
  stem.rotation.set(0.05, 0, -0.22);
  stem.castShadow = true;
  apple.add(stem);
  return apple;
}

// `rig` carries the idle bob / boop bounce; `display` holds the apple and pops it in on load.
const rig = new THREE.Group();
scene.add(rig);
const display = new THREE.Group();
display.add(makeApple());
rig.add(display);

let popT = 0;

// ---------------------------------------------------------------------------
// Eating: the worm takes small bites as it crawls. Each bite is a sphere pressed into the
// apple, carving vertices radially inward. Nothing is carved past the core, so an apple
// eaten all over is left as a core.
// ---------------------------------------------------------------------------

const BITE_RADIUS = 0.2;
const BITE_DEPTH = 0.18;      // each pass over a spot eats one layer this thick
const CHOMP_TIME = 0.12;      // a bite sinks in over this long
const bites = [];             // every bite on this apple; the worm walks on the result
const growing = [];           // bites still sinking in

// The core can't be eaten past: a narrow waist that flares out into the top and bottom caps,
// with a stringy, uneven surface.
function coreRadius(angle, y) {
  const t = (y - APPLE_BOTTOM) / (APPLE_TOP - APPLE_BOTTOM);
  const flare = 0.8 * (1 - smoothstep(0, 0.34, t)) + 0.9 * smoothstep(0.64, 0.9, t);
  return 0.26 + 0.9 * flare + 0.035 * Math.sin(angle * 7 + y * 11) + 0.02 * Math.sin(angle * 13 - y * 17);
}

// Where the ray from the axis out through (angle, y) enters a bite sphere. Returns the inner
// crossing (Infinity if it misses) and leaves the outer one in biteOuter.
let biteOuter = 0;
function biteInner(b, angle, y) {
  const dy = y - b.y;
  if (Math.abs(dy) >= BITE_RADIUS) return Infinity;
  const cos = Math.cos(angle - b.angle);
  if (cos <= 0) return Infinity;
  const along = b.centre * cos;
  const disc = along * along - b.centre * b.centre - dy * dy + BITE_RADIUS * BITE_RADIUS;
  if (disc <= 0) return Infinity;
  const s = Math.sqrt(disc);
  biteOuter = along + s;
  return along - s;
}

// Distance from the axis after bites, for a rest-shape point at radius r, angle and height y.
// `upTo` limits it to the first bites, to see the surface as it was before them.
function carvedRadius(r, angle, y, upTo = bites.length) {
  if (r <= 1e-4) return r;
  let nr = r;
  // Keep stepping inward while the surface point sits inside a bite, so overlapping bites join up.
  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < upTo; i++) {
      const b = bites[i];
      const inner = biteInner(b, angle, y);
      if (nr > inner + 1e-5 && nr < biteOuter + 1e-5) { nr = inner; moved = true; }
    }
  }
  return nr < r ? Math.max(nr, Math.min(r, coreRadius(angle, y))) : r;
}

// Per-vertex rest shape in cylindrical coordinates, the radius it can be eaten down to,
// and its current (carved) radius.
const base = (() => {
  const pos = APPLE_GEO.attributes.position;
  const v = { x: [], y: [], z: [], r: [], angle: [], core: [] };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z), angle = Math.atan2(x, z);
    v.x.push(x); v.y.push(y); v.z.push(z); v.r.push(r); v.angle.push(angle);
    v.core.push(Math.min(r, coreRadius(angle, y)));
  }
  return v;
})();
const carved = Float32Array.from(base.r);
const EDIBLE = base.r.reduce((sum, r, i) => sum + r - base.core[i], 0);
let eatenFraction = 0;

// Press one bite into the mesh. Carving only ever removes, so a bite that's still sinking in
// can simply be re-applied each frame.
function applyBite(b) {
  let changed = false;
  for (let i = 0; i < carved.length; i++) {
    const nr = carved[i];
    if (nr <= base.core[i] + 1e-5) continue;
    const inner = biteInner(b, base.angle[i], base.y[i]);
    if (!(nr > inner + 1e-5 && nr < biteOuter + 1e-5)) continue;
    carved[i] = Math.max(inner, base.core[i]);
    changed = true;
  }
  return changed;
}

function syncAppleMesh() {
  const pos = APPLE_GEO.attributes.position;
  const eaten = APPLE_GEO.attributes.eaten;
  let sum = 0;
  for (let i = 0; i < carved.length; i++) {
    const r = base.r[i];
    const s = r > 1e-4 ? carved[i] / r : 1;
    pos.setXYZ(i, base.x[i] * s, base.y[i], base.z[i] * s);
    eaten.setX(i, r - carved[i]);
    sum += r - carved[i];
  }
  eatenFraction = sum / EDIBLE;
  pos.needsUpdate = true;
  eaten.needsUpdate = true;
  APPLE_GEO.computeVertexNormals();
  weldNormals(APPLE_GEO, APPLE_SEAMS);
}

// Bites overlap their neighbours, so the spot just ahead of the worm is already half-eaten by
// its own last few bites. Judge depth ignoring those, or every bite would land deeper than the
// one before and a single pass would tunnel straight to the core.
const BITE_SPACING = 0.09;   // the worm takes a bite each time its head travels this far
const TRAIL_BITES = Math.ceil((2 * BITE_RADIUS) / BITE_SPACING);

// Bite the apple at a rest-shape point, one layer deeper than it had been eaten before this
// pass. Returns false if there's nothing left to eat there.
function biteAt(rest) {
  const r = Math.hypot(rest.x, rest.z), angle = Math.atan2(rest.x, rest.z);
  const now = carvedRadius(r, angle, rest.y);
  if (now <= Math.min(r, coreRadius(angle, rest.y)) + 0.02) return false;
  const before = carvedRadius(r, angle, rest.y, Math.max(0, bites.length - TRAIL_BITES));
  const layer = Math.floor((r - before) / BITE_DEPTH + 0.25) + 1;
  const floor = r - layer * BITE_DEPTH;
  if (floor >= now - 0.01) return false; // this pass has already eaten down to here
  const b = { angle, y: rest.y, target: floor + BITE_RADIUS, centre: now + BITE_RADIUS, grow: 0 };
  b.start = b.centre;
  bites.push(b);
  growing.push(b);
  const out = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  spawnCrumbs(out.clone().multiplyScalar(now).setY(rest.y), out, 3);
  return true;
}

function updateBites(dt) {
  if (!growing.length) return;
  let changed = false;
  for (const b of growing) {
    b.grow = Math.min(1, b.grow + dt / CHOMP_TIME);
    b.centre = b.target + (1 - b.grow) ** 3 * (b.start - b.target);
    if (applyBite(b)) changed = true;
  }
  for (let i = growing.length - 1; i >= 0; i--) if (growing[i].grow >= 1) growing.splice(i, 1);
  if (changed) syncAppleMesh();
}

// Once most of the apple is eaten, show off the core for a moment, then a fresh apple pops in.
const FINISHED_AT = 0.75;
const CORE_HOLD = 1.4;
const POP_OUT = 0.35;
let finishT = -1;

function resetApple() {
  bites.length = 0;
  growing.length = 0;
  carved.set(base.r);
  syncAppleMesh();
}

// Returns the pop-out scale while an eaten apple is being swapped for a fresh one.
function updateApple(dt) {
  if (finishT < 0) {
    if (eatenFraction >= FINISHED_AT) finishT = 0;
    return 1;
  }
  finishT += dt;
  if (finishT >= CORE_HOLD + POP_OUT) {
    resetApple();
    finishT = -1;
    popT = 0;
    return 1;
  }
  const out = Math.max(0, (finishT - CORE_HOLD) / POP_OUT);
  return 1 - out * out;
}

// Crumbs of flesh (and the odd bit of skin) spray out of each bite. They fly in 3D until they
// reach the floor, then drop out of the scene into a flat overlay and fall to the bottom of the
// screen, where they pile up for good.
const CRUMB_SIZE = 0.06;
const CRUMB_GEO = new THREE.BoxGeometry(CRUMB_SIZE, CRUMB_SIZE, CRUMB_SIZE);
const crumbMats = [
  new THREE.MeshStandardMaterial({ color: 0xf5e2b0, roughness: 0.6 }),
  new THREE.MeshStandardMaterial({ color: 0xc41f1b, roughness: 0.5 }),
];

// The overlay is measured in screen units: 100 tall, 0 at the bottom edge, x = 0 in the middle.
const overlay = new THREE.Scene();
const overlayCamera = new THREE.OrthographicCamera(-50, 50, 100, 0, 0.1, 100);
overlayCamera.position.z = 50;
overlay.add(new THREE.HemisphereLight(0xfff4e8, 0xc9937a, 1.3));
const overlayKey = new THREE.DirectionalLight(0xffffff, 1.6);
overlayKey.position.set(-1, 2, 3);
overlay.add(overlayKey);

function resizeOverlay(aspect) {
  overlayCamera.left = -50 * aspect;
  overlayCamera.right = 50 * aspect;
  overlayCamera.updateProjectionMatrix();
}

// The pile: one instance per landed crumb, stacked on a height per column.
const PILE_CUBE = 1.4;          // crumb size in screen units
const PILE_MAX = 3000;
const PILE_STEP = PILE_CUBE * 0.85; // cubes nestle into each other a little
const PILE_TOP = 16;            // once the pile's this high, new crumbs just vanish into it
const pileHeights = new Map();  // column -> top of the pile there
const pileMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ roughness: 0.6 }),
  PILE_MAX
);
pileMesh.count = 0;
pileMesh.frustumCulled = false;
overlay.add(pileMesh);
const _pileM = new THREE.Matrix4(), _pileQ = new THREE.Quaternion(), _pileE = new THREE.Euler();
const _pileP = new THREE.Vector3(), _pileS = new THREE.Vector3(PILE_CUBE, PILE_CUBE, PILE_CUBE);

const pileHeight = (col) => pileHeights.get(col) ?? 0;
const columnLimit = () => Math.floor((overlayCamera.right - PILE_CUBE / 2) / PILE_CUBE);

// Settle a landing crumb: roll it downhill while a neighbouring column is a step lower, so the
// crumbs build soft heaps instead of towers. Then add it to the pile.
function landCrumb(x, material) {
  if (pileMesh.count >= PILE_MAX) return;
  const limit = columnLimit();
  let col = Math.max(-limit, Math.min(limit, Math.round(x / PILE_CUBE)));
  for (let step = 0; step < 40; step++) {
    const h = pileHeight(col);
    const lowL = col > -limit && pileHeight(col - 1) < h - PILE_STEP;
    const lowR = col < limit && pileHeight(col + 1) < h - PILE_STEP;
    if (!lowL && !lowR) break;
    col += lowL && lowR ? (Math.random() < 0.5 ? -1 : 1) : lowL ? -1 : 1;
  }
  const h = pileHeight(col);
  if (h >= PILE_TOP) return;
  _pileP.set(col * PILE_CUBE + (Math.random() - 0.5) * 0.3 * PILE_CUBE, h + PILE_CUBE / 2, 0);
  _pileE.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.5);
  pileMesh.setMatrixAt(pileMesh.count, _pileM.compose(_pileP, _pileQ.setFromEuler(_pileE), _pileS));
  pileMesh.setColorAt(pileMesh.count, material.color);
  pileMesh.count++;
  pileMesh.instanceMatrix.needsUpdate = true;
  pileMesh.instanceColor.needsUpdate = true;
  pileHeights.set(col, h + PILE_STEP);
}

// Each crumb is either flying in the 3D scene or falling through the overlay.
const crumbs = Array.from({ length: 64 }, (_, i) => {
  const mesh = new THREE.Mesh(CRUMB_GEO, crumbMats[i % 4 === 0 ? 1 : 0]);
  mesh.visible = false;
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, inOverlay: false };
});
let nextCrumb = 0;

function toScene(c) {
  if (!c.inOverlay) return;
  overlay.remove(c.mesh);
  scene.add(c.mesh);
  c.mesh.scale.setScalar(1);
  c.inOverlay = false;
}

// Hand a crumb from the 3D scene to the overlay at the same spot on screen, keeping its motion.
const _ndc = new THREE.Vector3(), _ndc2 = new THREE.Vector3();
function toOverlay(c) {
  const half = overlayCamera.right;
  _ndc.copy(c.mesh.position).project(camera);
  _ndc2.copy(c.mesh.position).addScaledVector(c.vel, 1 / 60).project(camera);
  c.vel.set((_ndc2.x - _ndc.x) * half * 60, (_ndc2.y - _ndc.y) * 50 * 60, 0);
  scene.remove(c.mesh);
  overlay.add(c.mesh);
  c.mesh.position.set(_ndc.x * half, (_ndc.y + 1) * 50, 0);
  c.mesh.scale.setScalar(PILE_CUBE / CRUMB_SIZE);
  c.inOverlay = true;}

function resetCrumbs() {
  for (const c of crumbs) {
    toScene(c);
    c.life = 0;
    c.mesh.visible = false;
  }
  pileMesh.count = 0;
  pileHeights.clear();
}

// `local` is in the apple's space; `out` is the direction to fling them.
function spawnCrumbs(local, out, count) {
  const at = display.localToWorld(local.clone());
  for (let k = 0; k < count; k++) {
    const c = crumbs[nextCrumb++ % crumbs.length];
    toScene(c);
    c.mesh.position.copy(at);
    c.vel.copy(out).multiplyScalar(0.3 + Math.random() * 0.6);
    c.vel.x += (Math.random() - 0.5) * 0.8;
    c.vel.y = 1 + Math.random() * 1.4;
    c.vel.z += (Math.random() - 0.5) * 0.8;
    c.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14);
    c.life = 1;
    c.mesh.visible = true;
  }
}

function updateCrumbs(dt) {
  for (const c of crumbs) {
    if (c.life <= 0) continue;
    c.mesh.rotation.x += c.spin.x * dt;
    c.mesh.rotation.y += c.spin.y * dt;
    c.mesh.rotation.z += c.spin.z * dt;

    if (!c.inOverlay) {
      c.vel.y -= 9 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      if (c.mesh.position.y < ground.position.y + CRUMB_SIZE / 2) toOverlay(c);
      continue;
    }

    // Falling to the bottom of the screen; bounce off the side edges.
    c.vel.y -= 260 * dt;
    c.mesh.position.addScaledVector(c.vel, dt);
    const edge = overlayCamera.right - PILE_CUBE / 2;
    if (Math.abs(c.mesh.position.x) > edge) {
      c.mesh.position.x = Math.sign(c.mesh.position.x) * edge;
      c.vel.x *= -0.5;
    }
    const col = Math.round(c.mesh.position.x / PILE_CUBE);
    if (c.vel.y < 0 && c.mesh.position.y - PILE_CUBE / 2 <= pileHeight(col)) {
      landCrumb(c.mesh.position.x, c.mesh.material);
      toScene(c);
      c.life = 0;
      c.mesh.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Worm: the player. Its joints crawl over the apple's rest (unbitten) shape, and are drawn
// on the bitten surface directly beneath, so the worm sinks into bites as they land.
// Everything here is in the apple's local space, so the worm pops and bobs with it.
// ---------------------------------------------------------------------------

const WORM_JOINTS = 15;      // follow-the-leader chain, head first (at the start; eating adds more)
const WORM_LINK = 0.065;     // spacing between joints
const WORM_RADIUS = 0.1;
const WORM_SIDES = 7;        // low-poly cross-section
const WORM_SPEED = 0.55;
const WORM_TURN = 10;        // how fast the head swings round to face the pressed direction
const WORM_MIN_Y = -0.7;     // stay off the underside, where the apple meets the floor
const GROW_PER_BITE = 0.015; // length added at the tail for every bite of fresh apple, forever

// The worm's shape is laid out by distance along its body, so growing never stretches it:
// the head and band stay put, and the tail's taper just moves further back.
const START_LENGTH = WORM_JOINTS * WORM_LINK;
const RING_STEP = START_LENGTH / 51; // rings along the drawn tube, one every this far

// Nearest point on the rest shape (lumps included) to p, and the outward normal there.
function restSurface(p, outPoint, outNormal) {
  const angle = Math.atan2(p.x, p.z);
  const r = Math.hypot(p.x, p.z) / lumpiness(angle, p.y);
  let best = Infinity, br = 0, by = 0, nr = 1, ny = 0;
  for (let i = 1; i < APPLE_OUTLINE.length; i++) {
    const a = APPLE_OUTLINE[i - 1], b = APPLE_OUTLINE[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((r - a.x) * dx + (p.y - a.y) * dy) / len2));
    const qx = a.x + dx * t, qy = a.y + dy * t;
    const d = (r - qx) ** 2 + (p.y - qy) ** 2;
    if (d < best) {
      best = d; br = qx; by = qy;
      const len = Math.sqrt(len2);
      nr = dy / len; ny = -dx / len; // the outline runs bottom to top, so this points outward
    }
  }
  const s = Math.sin(angle), c = Math.cos(angle), lump = lumpiness(angle, by);
  outPoint.set(s * br * lump, by, c * br * lump);
  if (outNormal) outNormal.set(s * nr, ny, c * nr).normalize();
  return outPoint;
}

// Drop a rest-shape point radially onto the bitten surface.
function carvedPoint(rest, out) {
  const r = Math.hypot(rest.x, rest.z);
  const s = r > 1e-4 ? carvedRadius(r, Math.atan2(rest.x, rest.z), rest.y) / r : 1;
  return out.set(rest.x * s, rest.y, rest.z * s);
}

// Normal of the bitten surface at a rest point, by finite differences.
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3();
function carvedNormal(rest, restNormal, out) {
  _t1.crossVectors(restNormal, Math.abs(restNormal.y) < 0.9 ? THREE.Object3D.DEFAULT_UP : _p0.set(1, 0, 0)).normalize();
  _t2.crossVectors(restNormal, _t1);
  carvedPoint(rest, _p0);
  carvedPoint(_p1.copy(rest).addScaledVector(_t1, 0.03), _p1).sub(_p0);
  carvedPoint(_p2.copy(rest).addScaledVector(_t2, 0.03), _p2).sub(_p0);
  out.crossVectors(_p1, _p2).normalize();
  if (out.dot(restNormal) < 0) out.negate();
  return out;
}

// Per-ring radius and colour: rounded head, slimmer tail, a fat pink band behind the head,
// and a darker groove every few rings.
const BODY_PINK = new THREE.Color(0xf6b3c4);
const GROOVE_PINK = new THREE.Color(0xe698ae);
const BAND_PINK = new THREE.Color(0xe8679a);
const BAND_GROOVE = new THREE.Color(0xc84f81);
// Lengths along the body, from the head (the cap and band) or back from the tail tip.
const HEAD_CAP = 0.1 * START_LENGTH, TAIL_CAP = 0.12 * START_LENGTH;
const BAND_START = 0.17 * START_LENGTH, BAND_END = 0.3 * START_LENGTH;
const TAPER = 0.65 * START_LENGTH;   // the tail slims over this last stretch of the body

// Radius (in body radii) of ring k, which sits `d` along a body `length` long. Sets ringColor.
let ringColor = BODY_PINK;
function ringRadius(k, d, length) {
  const fromTail = length - d;
  let r = 1 - 0.35 * smoothstep(0, 1, 1 - fromTail / TAPER);
  ringColor = BODY_PINK;
  if (d > BAND_START && d < BAND_END) {
    const groove = k % 3 === 0;
    r *= groove ? 1.1 : 1.24;
    ringColor = groove ? BAND_GROOVE : BAND_PINK;
  } else if (d > BAND_END && k % 4 === 0 && fromTail > TAIL_CAP) {
    r *= 0.93;
    ringColor = GROOVE_PINK;
  }
  if (d < HEAD_CAP) r *= Math.sqrt(1 - (1 - d / HEAD_CAP) ** 2);
  if (fromTail < TAIL_CAP) r *= Math.sqrt(Math.max(0, 1 - (1 - fromTail / TAIL_CAP) ** 2));
  return r;
}

// The tube's buffers grow (doubling) as the worm does; only the rings in use are drawn.
const wormGeo = new THREE.BufferGeometry();
let ringCapacity = 0;
function ensureRings(count) {
  if (count <= ringCapacity) return;
  ringCapacity = Math.max(count, ringCapacity * 2, 64);
  wormGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ringCapacity * WORM_SIDES * 3), 3));
  wormGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ringCapacity * WORM_SIDES * 3), 3));
  const idx = [];
  for (let k = 0; k < ringCapacity - 1; k++) {
    for (let j = 0; j < WORM_SIDES; j++) {
      const a = k * WORM_SIDES + j, b = k * WORM_SIDES + ((j + 1) % WORM_SIDES);
      const c = a + WORM_SIDES, d = b + WORM_SIDES;
      idx.push(a, c, b, b, c, d);
    }
  }
  wormGeo.setIndex(idx);
}
ensureRings(52);
const wormMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55 });
const wormMesh = new THREE.Mesh(wormGeo, wormMat);
wormMesh.castShadow = true;
wormMesh.frustumCulled = false;
display.add(wormMesh);

// Face: two dot eyes, a red nose and a little smile. Each feature is placed by its offset
// across the face (in body radii); updateWorm pushes it out onto the rounded head each frame.
const face = new THREE.Group();
const faceFeatures = [];
{
  const R = WORM_RADIUS;
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1010, roughness: 0.3 });
  const add = (mesh, x, y) => {
    face.add(mesh);
    faceFeatures.push({ mesh, x, y });
  };
  const eyeGeo = new THREE.IcosahedronGeometry(R * 0.14, 0);
  add(new THREE.Mesh(eyeGeo, black), -0.34, 0.3);
  add(new THREE.Mesh(eyeGeo, black), 0.34, 0.3);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xe8322e, roughness: 0.4, flatShading: true });
  add(new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.19, 0), noseMat), 0, -0.02);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(R * 0.2, R * 0.05, 3, 8, Math.PI), black);
  smile.geometry.rotateZ(Math.PI); // bottom half of the ring
  add(smile, 0, -0.3);
}
display.add(face);

// Chain state. joints[] live on the rest shape; the rest is scratch reused every frame.
const joints = Array.from({ length: WORM_JOINTS }, () => new THREE.Vector3());
const heading = new THREE.Vector3(1, 0, 0);
const headNormal = new THREE.Vector3();
const spine = Array.from({ length: WORM_JOINTS + 1 }, () => new THREE.Vector3()); // tip + joints
const spineNormals = Array.from({ length: WORM_JOINTS + 1 }, () => new THREE.Vector3(0, 1, 0));
const spineCurve = new THREE.CatmullRomCurve3(spine);
const keys = { up: false, down: false, left: false, right: false };
let crawlPhase = 0;
let crawlAmount = 0;
let wormMovedThisFrame = false;
const lastBite = new THREE.Vector3(Infinity, 0, 0);
let munchT = 1;              // head bulge after each bite

// Growing: every link is WORM_LINK long except the last, which lengthens as the worm eats.
// Once it's half a link too long, a new joint is slotted in ahead of the tail tip.
let tailLink = WORM_LINK;
let growthOwed = 0;          // length earned by eating that the tail hasn't grown into yet

const linkLength = (i) => (i === joints.length - 1 ? tailLink : WORM_LINK);
const bodyLength = () => (joints.length - 1) * WORM_LINK + tailLink; // nose tip to tail tip

function growTail(amount) {
  tailLink += amount;
  if (tailLink < 1.5 * WORM_LINK) return;
  const end = joints.length - 1;
  const added = new THREE.Vector3().subVectors(joints[end], joints[end - 1]).setLength(WORM_LINK).add(joints[end - 1]);
  restSurface(added, added, null);
  joints.splice(end, 0, added);
  spine.push(new THREE.Vector3());
  spineNormals.splice(end + 1, 0, spineNormals[end + 1].clone());
  tailLink -= WORM_LINK;
}

// Start on the front of the apple, facing sideways, with the body trailing behind.
function resetWorm() {
  joints.length = WORM_JOINTS;
  spine.length = WORM_JOINTS + 1;
  spineNormals.length = WORM_JOINTS + 1;
  tailLink = WORM_LINK;
  growthOwed = 0;
  heading.set(1, 0, 0);
  restSurface(new THREE.Vector3(0.25, 0.3, 1), joints[0], headNormal);
  for (let i = 1; i < WORM_JOINTS; i++) {
    restSurface(_p0.copy(joints[i - 1]).addScaledVector(heading, -linkLength(i)), joints[i], null);
  }
  crawlAmount = 0;
  munchT = 1;
  lastBite.set(Infinity, 0, 0);
}
resetWorm();

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  keys[k] = true;
  controls.autoRotate = false; // the player's in charge of where things go now
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
});
window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

const _restN = new THREE.Vector3(), _carvedN = new THREE.Vector3(), _q = new THREE.Vector3();
const _up = new THREE.Vector3(), _side = new THREE.Vector3(), _tan = new THREE.Vector3();
const _faceBasis = new THREE.Matrix4();
const _want = new THREE.Vector3(), _camUp = new THREE.Vector3(), _quat = new THREE.Quaternion();

function updateWorm(dt, time) {
  // Steer in screen space: the keys give a direction as seen on screen, which is flattened onto
  // the apple's surface at the head. The worm turns towards it (fast, but not instantly, so
  // reversing makes a tight U-turn rather than folding the body in half) and crawls forward.
  restSurface(joints[0], _q, headNormal);
  const sx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const sy = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  let speed = 0;
  if (sx || sy) {
    _want.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(sx);
    _want.addScaledVector(_camUp.setFromMatrixColumn(camera.matrixWorld, 1), sy);
    _want.applyQuaternion(display.getWorldQuaternion(_quat).invert()); // into the apple's space
    _want.addScaledVector(headNormal, -_want.dot(headNormal));
    const along = _want.length(); // shrinks towards the apple's silhouette, where "left" points into it
    if (along > 1e-3) {
      _want.divideScalar(along);
      const angle = Math.atan2(_camUp.crossVectors(heading, _want).dot(headNormal), heading.dot(_want));
      const turn = Math.max(-WORM_TURN * dt, Math.min(WORM_TURN * dt, angle));
      heading.applyAxisAngle(headNormal, turn);
      // Ease off mid-turn and near the silhouette, so the worm glides to a stop at the edge.
      speed = WORM_SPEED * (0.25 + 0.75 * Math.max(0, Math.cos(angle))) * Math.min(1, along / 0.5);
    }
  }
  wormMovedThisFrame = false;
  if (speed > 0) {
    restSurface(_q.copy(joints[0]).addScaledVector(heading, speed * dt), _q, _restN);
    if (_q.y > WORM_MIN_Y) {
      joints[0].copy(_q);
      headNormal.copy(_restN);
      crawlPhase += speed * dt;
      wormMovedThisFrame = true;
    }
  }
  heading.addScaledVector(headNormal, -heading.dot(headNormal)).normalize();
  crawlAmount += ((wormMovedThisFrame ? 1 : 0) - crawlAmount) * Math.min(1, dt * 6);

  // Grow snake-style: the tail only lengthens as fast as the head moves forward, so the tail
  // tip holds still rather than backing into the fresh bites just behind it.
  if (wormMovedThisFrame && growthOwed > 0) {
    const grow = Math.min(growthOwed, speed * dt);
    growthOwed -= grow;
    growTail(grow);
  }

  // Each joint trails the one ahead at a fixed distance, pulled back onto the apple.
  for (let i = 1; i < joints.length; i++) {
    _q.subVectors(joints[i], joints[i - 1]);
    if (_q.lengthSq() < 1e-10) _q.copy(heading).negate();
    _q.setLength(linkLength(i));
    restSurface(_q.add(joints[i - 1]), joints[i], null);
  }

  // The worm eats with its mouth: each bite lands just ahead of its nose, so it chews a tunnel
  // and its body follows along in it. (Not while an eaten apple is being swapped out.)
  if (wormMovedThisFrame && finishT < 0) {
    restSurface(_q.copy(joints[0]).addScaledVector(heading, 2 * WORM_LINK), _q, null);
    if (_q.distanceTo(lastBite) > BITE_SPACING) {
      lastBite.copy(_q);
      if (biteAt(_q)) {
        munchT = 0;
        growthOwed += GROW_PER_BITE;
      }
    }
  }
  munchT = Math.min(1, munchT + dt * 7);
  const munch = Math.sin(munchT * Math.PI);

  // The spine runs nose tip, then each joint: links are all WORM_LINK apart except the last.
  const segs = joints.length, length = bodyLength();
  const straight = (segs - 1) * WORM_LINK;
  const segAt = (d) => (d <= straight ? d / WORM_LINK : segs - 1 + (d - straight) / tailLink);

  // Spine: a nose point just ahead of the head (so turning on the spot shows), then the joints.
  // Drop each onto the bitten surface, lift it clear by the body radius, and rear the head up.
  for (let i = 0; i <= segs; i++) {
    const rest = i === 0
      ? restSurface(_q.copy(joints[0]).addScaledVector(heading, WORM_LINK), _q, null)
      : joints[i - 1];
    restSurface(rest, _p0, _restN);
    carvedNormal(rest, _restN, _carvedN);
    spineNormals[i].lerp(_carvedN, Math.min(1, dt * 12)).normalize();
    const r = ringRadius(1, i < segs ? i * WORM_LINK : length, length);
    const rear = Math.max(0, 1 - i / 4) ** 2 * (0.1 + 0.012 * Math.sin(time * 3));
    carvedPoint(rest, spine[i]).addScaledVector(spineNormals[i], WORM_RADIUS * Math.max(r, 0.6) + 0.012 + rear);
  }

  // Skin the tube: a ring every RING_STEP from the nose, plus one on the tail tip, with a
  // squeeze wave running down the body while it crawls.
  const rings = Math.ceil(length / RING_STEP - 1e-6) + 1;
  ensureRings(rings);
  const pos = wormGeo.attributes.position, col = wormGeo.attributes.color;
  for (let k = 0; k < rings; k++) {
    const d = Math.min(k * RING_STEP, length);
    const r = ringRadius(k, d, length);
    const s = d / START_LENGTH;
    const f = segAt(d), i0 = Math.min(segs - 1, Math.floor(f)), i1 = i0 + 1;
    const c = spineCurve.getPoint(f / segs, _p1);
    spineCurve.getTangent(f / segs, _tan);
    _up.lerpVectors(spineNormals[i0], spineNormals[i1], f - i0);
    _side.crossVectors(_tan, _up).normalize();
    _up.crossVectors(_side, _tan).normalize();
    const radius = WORM_RADIUS * r *
      (1 + 0.1 * crawlAmount * Math.sin(crawlPhase * 40 - s * 16)) *
      (1 + 0.14 * munch * (1 - smoothstep(0, 0.2, s)));
    for (let j = 0; j < WORM_SIDES; j++) {
      const a = (j / WORM_SIDES) * Math.PI * 2;
      const cs = Math.cos(a) * radius, sn = Math.sin(a) * radius;
      pos.setXYZ(k * WORM_SIDES + j, c.x + _side.x * cs + _up.x * sn, c.y + _side.y * cs + _up.y * sn, c.z + _side.z * cs + _up.z * sn);
      col.setXYZ(k * WORM_SIDES + j, ringColor.r, ringColor.g, ringColor.b);
    }
  }
  wormGeo.setDrawRange(0, (rings - 1) * WORM_SIDES * 6);
  pos.needsUpdate = true;
  col.needsUpdate = true;
  wormGeo.computeBoundingSphere(); // keeps boop raycasts accurate

  // Face sits at the centre of the head, looking at the tip. The head cap is an elongated dome,
  // so each feature goes out to the dome's surface at its spot.
  const f = segAt(HEAD_CAP);
  spineCurve.getPoint(f / segs, face.position);
  _tan.subVectors(spineCurve.getPoint(0, _p2), face.position);
  const capLength = _tan.length();
  _tan.divideScalar(capLength);
  _up.lerpVectors(spineNormals[Math.floor(f)], spineNormals[Math.floor(f) + 1], f % 1);
  _up.addScaledVector(_tan, -_up.dot(_tan)).normalize();
  _side.crossVectors(_up, _tan);
  face.quaternion.setFromRotationMatrix(_faceBasis.makeBasis(_side, _up, _tan));
  const headR = WORM_RADIUS * ringRadius(1, HEAD_CAP, length);
  for (const { mesh, x, y } of faceFeatures) {
    const z = capLength * Math.sqrt(Math.max(0, 1 - x * x - y * y));
    mesh.position.set(x * headR, y * headR, z);
  }
}

// While the worm crawls, swing the camera round to keep it in view (unless the player is dragging).
let dragging = false;
controls.addEventListener('start', () => (dragging = true));
controls.addEventListener('end', () => (dragging = false));

function followWorm(dt) {
  if (!wormMovedThisFrame || dragging) return;
  const head = display.localToWorld(_q.copy(joints[0]));
  if (Math.hypot(head.x, head.z) < 0.3) return; // near the top, the direction is meaningless
  const want = Math.atan2(head.x, head.z);
  const off = _p0.subVectors(camera.position, controls.target);
  const have = Math.atan2(off.x, off.z);
  let delta = want - have;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, delta * Math.min(1, dt * 1.5));
  camera.position.copy(controls.target).add(off);
}

// ---------------------------------------------------------------------------
// Boop: click the apple for a squash-and-stretch hop. Drags don't count.
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let boopT = 1;
let downAt = null;

canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(display, true).length) boopT = 0;
});

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Pull back on narrow screens so the apple still fits.
  camera.fov = w / h < 0.8 ? 50 : 35;
  camera.updateProjectionMatrix();
  resizeOverlay(w / h);
}
window.addEventListener('resize', resize);
resize();

const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  updateWorm(dt, time);
  updateBites(dt);
  const outScale = updateApple(dt);
  updateCrumbs(dt);
  followWorm(dt);
  popT = Math.min(1, popT + dt * 2.2);
  display.scale.setScalar(Math.max(0.001, easeOutBack(popT) * outScale));

  let hop = 0, squash = 0;
  if (boopT < 1) {
    boopT = Math.min(1, boopT + dt * 1.8);
    hop = Math.sin(boopT * Math.PI) * 0.7;
    squash = Math.sin(boopT * Math.PI * 3) * 0.14 * (1 - boopT);
  }
  rig.position.y = hop + Math.sin(time * 1.6) * 0.03;
  rig.scale.set(1 + squash, 1 - squash, 1 + squash);
  rig.rotation.z = Math.sin(time * 1.1) * 0.03;

  controls.update(dt);
  renderer.render(scene, camera);
  // Falling crumbs and the pile draw on top, at the bottom of the screen.
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(overlay, overlayCamera);
  renderer.autoClear = true;
});
})();
