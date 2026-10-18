// Everything around the machine: floor, plinth and the block sculptures beside it.
(function (RG) {
  RG.buildStage = function () {
    const { M, C, mesh, disc, extrude, roundedRect, burst } = RG;
    const root = new THREE.Group();
    const animators = [];

    function place(object, x, y, z = 0) {
      object.position.set(x, y, z);
      root.add(object);
      return object;
    }

    // ---------------------------------------------------------------- floor + plinth

    const FLOOR_Y = -0.5;
    const floor = mesh(new THREE.CircleGeometry(160, 64).rotateX(-Math.PI / 2), M.matte(C.mustard), false);
    place(floor, 0, FLOOR_Y, 0);

    const plinth = extrude(roundedRect(-12.6, -3.2, 25.2, 7.4, 2.2), -FLOOR_Y, M.matte(C.pink, 0.7), 0.04);
    plinth.rotation.x = -Math.PI / 2;
    place(plinth, 0, FLOOR_Y, 0);

    // ---------------------------------------------------------------- left sculpture

    const LEFT = -10.6;
    place(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.7, 48), M.paint(C.blue)), LEFT, 0.35, 0.4);

    const profile = [];
    for (let i = 0; i <= 48; i++) {
      const y = (i / 48) * 3;
      profile.push(new THREE.Vector2(0.52 + 0.17 * Math.cos((y / 3) * Math.PI * 6), y));
    }
    place(mesh(new THREE.LatheGeometry(profile, 40), M.paint(C.orange, 0.4)), LEFT, 0.7, 0.4);

    const target = disc(1.05, 0.32, M.target(C.black, C.white, 7), M.paint(C.black));
    place(target, LEFT, 4.75, 0.4);
    animators.push((t) => { target.rotation.z = t * 0.6; });

    function burstOnStick(x, z, height, radius, petals, colors, centre, speed) {
      place(mesh(new THREE.CylinderGeometry(0.04, 0.04, height, 10), M.metal('#dfe6ee', 0.2)), x, height / 2, z);
      const flower = burst(petals, radius, colors.map((c) => M.paint(c)), M.paint(centre));
      place(flower, x, height, z + 0.1);
      animators.push((t) => { flower.rotation.z = t * speed; });
    }
    burstOnStick(-11.6, -1.2, 8.2, 1.0, 12, [C.red, C.yellow], C.navy, 0.35);
    burstOnStick(-9.6, -1.6, 6.6, 0.7, 10, [C.green, C.white], C.hot, -0.5);

    // ---------------------------------------------------------------- right sculpture

    const RIGHT = 10.5;
    const arch = new THREE.Shape();
    arch.moveTo(-1.2, 0);
    arch.lineTo(-0.5, 0);
    arch.lineTo(-0.5, 1.8);
    arch.absarc(0, 1.8, 0.5, Math.PI, 0, true);
    arch.lineTo(0.5, 0);
    arch.lineTo(1.2, 0);
    arch.lineTo(1.2, 1.8);
    arch.absarc(0, 1.8, 1.2, 0, Math.PI);
    arch.closePath();
    place(extrude(arch, 1.0, M.paint(C.green), 0.07), RIGHT, 0, 0.3);

    const slab = extrude(roundedRect(-0.65, 0, 1.3, 4.6, 0.65), 0.45, [M.stripes(C.navy, C.white, 2.2), M.paint(C.navy)], 0.06);
    place(slab, RIGHT + 0.7, 0, -0.9);

    const dotted = disc(0.85, 0.3, M.dots(C.hot, C.white, 4), M.paint(C.hot));
    place(dotted, RIGHT - 0.5, 3.85, 0.9);

    place(mesh(new THREE.SphereGeometry(0.42, 32, 24), M.paint(C.yellow, 0.3)), RIGHT - 1.4, 0.42, 1.6);

    burstOnStick(11.7, -1.4, 7.4, 0.9, 12, [C.blue, C.orange], C.yellow, -0.3);

    return {
      root,
      update(t) {
        for (const animate of animators) animate(t);
      },
    };
  };
})(window.RG);
