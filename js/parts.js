// Reusable builders: ball paths, wire rails, gears, springs and other small parts.
// The board's front face is the z = 0 plane; the ball always travels in the z = BALL_Z plane.
(function (RG) {
  const BALL_R = RG.BALL_R = 0.28;
  const BALL_Z = RG.BALL_Z = 0.75;
  const TAU = Math.PI * 2;

  function mesh(geometry, material, castShadow = true) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    return m;
  }

  // A polyline the ball can travel along, addressed by distance from its start.
  class Poly {
    constructor(points) {
      this.points = points;
      this.cum = [0];
      for (let i = 1; i < points.length; i++) {
        this.cum.push(this.cum[i - 1] + points[i].distanceTo(points[i - 1]));
      }
      this.length = this.cum[this.cum.length - 1];
    }

    at(s, out = new THREE.Vector3()) {
      s = Math.min(Math.max(s, 0), this.length);
      let lo = 0;
      let hi = this.cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (this.cum[mid] <= s) lo = mid; else hi = mid;
      }
      const span = this.cum[hi] - this.cum[lo];
      return out.lerpVectors(this.points[lo], this.points[hi], span > 0 ? (s - this.cum[lo]) / span : 0);
    }

    // Unit normal pointing to the left of the direction of travel.
    normal(s) {
      const a = this.at(s - 0.03);
      const b = this.at(s + 0.03);
      const t = b.sub(a).normalize();
      return new THREE.Vector2(-t.y, t.x);
    }

    // Points running parallel to the path, `d` to its left (negative = right).
    offset(d, step, s0 = 0, s1 = this.length) {
      const n = Math.max(1, Math.ceil((s1 - s0) / step));
      const out = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n;
        const p = this.at(s);
        const normal = this.normal(s);
        out.push(new THREE.Vector2(p.x + normal.x * d, p.y + normal.y * d));
      }
      return out;
    }
  }

  function arcPoints(cx, cy, r, fromDeg, toDeg) {
    const n = Math.ceil(Math.abs(toDeg - fromDeg) / 5);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
      out.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), BALL_Z));
    }
    return out;
  }

  // A rod sticking straight out of the board.
  function zRod(x, y, z0, z1, r, material) {
    const m = mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 12).rotateX(Math.PI / 2), material);
    m.position.set(x, y, (z0 + z1) / 2);
    return m;
  }

  // A disc whose flat faces look along z. Caps and rim can take different materials.
  function disc(r, depth, capMaterial, sideMaterial = capMaterial) {
    const geometry = new THREE.CylinderGeometry(r, r, depth, 48).rotateX(Math.PI / 2);
    return mesh(geometry, [sideMaterial, capMaterial, capMaterial]);
  }

  // Extrudes a shape from z = 0 to z = depth. A bevel rounds the edges so they catch the
  // light, without growing the part: the outline and depth stay as given.
  function extrude(shape, depth, material, bevel = 0) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * bevel,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset: -bevel,
      bevelSegments: 3,
      curveSegments: 24,
    });
    return mesh(geometry.translate(0, 0, bevel), material);
  }

  // A box with softened edges.
  function box(w, h, d, material) {
    const radius = Math.min(0.045, Math.min(w, h, d) * 0.3);
    return mesh(new RG.RoundedBoxGeometry(w, h, d, 3, radius), material);
  }

  function roundedRect(x, y, w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    return s;
  }

  // Two-wire track in the style of a rolling-ball sculpture. `side` picks which side of the
  // path the wires sit on: +1 = left of travel, -1 = right of travel. `options.drop` is how far
  // the wires sit from the path (0.27 has the ball just touching them; 0.24, the default, a
  // little into them).
  function rail(poly, side, options = {}) {
    const group = new THREE.Group();
    const s0 = options.s0 ?? 0;
    const s1 = options.s1 ?? poly.length;
    const material = options.material || RG.M.paint(RG.C.sky, 0.35);
    const drop = options.drop ?? 0.24;

    const line = poly.offset(side * drop, 0.12, s0, s1);
    for (const dz of [-0.15, 0.15]) {
      const curve = new THREE.CatmullRomCurve3(line.map((p) => new THREE.Vector3(p.x, p.y, BALL_Z + dz)));
      group.add(mesh(new THREE.TubeGeometry(curve, line.length * 2, 0.035, 8), material));
    }

    const count = Math.max(2, Math.round((s1 - s0) / 1.2));
    const supports = options.supports
      || Array.from({ length: count }, (_, i) => s0 + ((s1 - s0) * (i + 0.5)) / count);
    for (const s of supports) {
      const p = poly.offset(side * (drop + 0.07), 1, s, s)[0];
      group.add(zRod(p.x, p.y, 0, BALL_Z + 0.24, 0.03, material));
      group.add(zRod(p.x, p.y, 0, 0.05, 0.09, material));
    }
    return group;
  }

  // A flat band following the path between two offsets, extruded out from the board.
  function ribbon(poly, d0, d1, z0, depth, material, s0 = 0, s1 = poly.length) {
    const inner = poly.offset(d0, 0.08, s0, s1);
    const outer = poly.offset(d1, 0.08, s0, s1).reverse();
    const m = extrude(new THREE.Shape(inner.concat(outer)), depth, material, 0.035);
    m.position.z = z0;
    return m;
  }

  function gear(teeth, pitchRadius, depth, material, holes) {
    const module = (2 * pitchRadius) / teeth;
    const outer = pitchRadius + module * 0.9;
    const root = pitchRadius - module;
    const pitch = TAU / teeth;
    const shape = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a = i * pitch;
      const corners = [[-0.27, root], [-0.13, outer], [0.13, outer], [0.27, root]];
      corners.forEach(([offset, r], j) => {
        const x = Math.cos(a + offset * pitch) * r;
        const y = Math.sin(a + offset * pitch) * r;
        if (i === 0 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      });
    }
    shape.closePath();
    for (let i = 0; i < holes.count; i++) {
      const a = (i / holes.count) * TAU + pitch / 2;
      shape.holes.push(new THREE.Path().absarc(
        Math.cos(a) * holes.ring, Math.sin(a) * holes.ring, holes.radius, 0, TAU, true,
      ));
    }
    return extrude(shape, depth, material, 0.04);
  }

  // Coil spring standing along +y.
  function spring(radius, height, turns, wire, material) {
    const points = [];
    const steps = turns * 16;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * turns * TAU;
      points.push(new THREE.Vector3(Math.cos(a) * radius, (i / steps) * height, Math.sin(a) * radius));
    }
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, wire, 8), material);
  }

  // Flat sunburst of petals around a centre disc.
  function burst(petals, radius, petalMaterials, centreMaterial) {
    const group = new THREE.Group();
    for (let i = 0; i < petals; i++) {
      const spoke = new THREE.Group();
      const material = petalMaterials[i % petalMaterials.length];
      const petal = box(radius * 0.72, radius * 0.16, 0.06, material);
      petal.position.x = radius * 0.6;
      const tip = disc(radius * 0.13, 0.06, material);
      tip.position.x = radius * 0.96;
      spoke.add(petal, tip);
      spoke.rotation.z = (i / petals) * TAU;
      group.add(spoke);
    }
    const centre = disc(radius * 0.34, 0.12, centreMaterial);
    group.add(centre);
    return group;
  }

  function arrow(material) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.18, -0.21);
    shape.lineTo(0.2, 0);
    shape.lineTo(-0.18, 0.21);
    shape.closePath();
    return extrude(shape, 0.1, material, 0.03);
  }

  function cloudShape() {
    const s = new THREE.Shape();
    s.moveTo(-1.1, 0);
    s.lineTo(1.1, 0);
    s.absarc(1.1, 0.4, 0.4, -Math.PI / 2, Math.PI * 0.45);
    s.absarc(0.45, 0.8, 0.55, 0, Math.PI * 0.85);
    s.absarc(-0.45, 0.7, 0.5, 0.3, Math.PI);
    s.absarc(-1.1, 0.4, 0.4, Math.PI / 2, Math.PI * 1.5);
    return s;
  }

  Object.assign(RG, {
    mesh, box, Poly, arcPoints, zRod, disc, extrude, roundedRect, rail, ribbon, gear, spring, burst, arrow, cloudShape,
  });
})(window.RG);
