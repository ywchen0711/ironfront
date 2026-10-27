// The vehicles in 3D: tanks, APCs, attack helicopters, self-propelled guns, anti-air trucks — and the things a
// mission is about (a supply truck, a comms tower, a fuel depot). They are built with the same kit as the wanzers
// (mech3d.js: materials, toon light, weathered paint) and give back the same handles, so the map, the battle scene
// and the hangar can treat every machine alike:
//   torso = the hull, armR = the main mount (turret / chin gun), armL = the side mount (pintle gun / pylons),
//   legs = the drive (tracks / wheels / rotor), head = a point above, parts.muzzlewR / muzzlewL / launcher.
import * as THREE from './lib/three.module.min.js';
import { ITEM } from './data.js?v=16';
import { finish, prism } from './mech3d.js?v=16';

export function buildVehicle(u, K) {
  const cls = ITEM[u.body].cls, { mats, group, parts, put, pr, blk, cyl, pivot } = K;
  const spin = [], extra = { vehicle: cls, cls, wheelList: spin, sweep: false, legL: null, legR: null, legsType: ITEM[u.legs] };
  const decal = (p, x, y, z, side, part) => { const d = put(p, new THREE.PlaneGeometry(0.13, 0.065), mats.decal, x, y, z, part, [0, side * Math.PI / 2, 0]); d.castShadow = false; };
  const mount = (sh, up, el) => ({ sh, up: up || sh, el: el || up || sh });
  const wR = u.wR && ITEM[u.wR], wL = u.wL && ITEM[u.wL];

  // ---- running gear
  const tracks = (len, x0) => {
    for (const s of [-1, 1]) {
      blk(group, 0.2, 0.22, len, mats.metalD, s * x0, 0.13, 0, 'legs');
      blk(group, 0.205, 0.02, len * 0.96, mats.metal, s * x0, 0.25, 0, 'legs');
      for (let k = 0; k < 5; k++) spin.push(cyl(group, 0.085, 0.215, mats.metal, s * x0, 0.12, -len / 2 + 0.11 + k * (len - 0.22) / 4, 'legs', 'x', 8));
      pr(group, [0.035, len * 0.92, 0.025, len * 0.86, 0.12], mats.paint2, s * (x0 + 0.12), 0.21, 0, 'legs');
    }
  };
  const wheels = (n, x0, len, r = 0.11) => {
    for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
      const z = -len / 2 + k * len / (n - 1);
      spin.push(cyl(group, r, 0.09, mats.metalD, s * x0, r, z, 'legs', 'x', 10));
      cyl(group, r * 0.45, 0.1, mats.metal, s * x0, r, z, 'legs', 'x', 6);
    }
  };
  const lights = (p, y, z, w2) => { let eye; for (const s of [-1, 1]) eye = blk(p, 0.045, 0.03, 0.02, mats.lamp, s * w2, y, z, 'body'); return eye; };
  // a gun barrel along +z from a pivot, with a muzzle at its end
  const barrel = (p, r, len, part, slot, brake = true) => {
    cyl(p, r, len, mats.metal, 0, 0, len / 2, part, 'z', 8);
    if (brake) blk(p, r * 2.6, r * 2, 0.06, mats.metalD, 0, 0, len, part);
    parts['muzzle' + slot] = pivot(p, 0, 0, len + 0.04);
  };
  const launcherBox = (p, x, y, z, part) => {
    if (!u.sh) return;
    const L = pivot(p, x, y, z); parts.launcher = L;
    blk(L, 0.12, 0.12, 0.3, mats.metalD, 0, 0, 0, part);
    for (const [a, b] of [[-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03]]) cyl(L, 0.022, 0.01, mats.ink, a, b, 0.151, part, 'z', 6);
    blk(L, 0.125, 0.015, 0.2, mats.trim, 0, 0.065, 0, part);
  };

  if (cls === 'tank') {
    tracks(1.0, 0.34);
    const torso = pivot(group, 0, 0.25, 0); extra.hullY = 0.25;
    pr(torso, [0.62, 1.0, 0.56, 0.92, 0.18], mats.paint, 0, 0.09, 0, 'body');
    pr(torso, [0.62, 0.22, 0.56, 0.04, 0.13, -0.09], mats.paint2, 0, 0.065, 0.6, 'body');
    blk(torso, 0.48, 0.02, 0.3, mats.grille, 0, 0.19, -0.3, 'body');
    for (const s of [-1, 1]) { blk(torso, 0.04, 0.06, 0.3, mats.accent, s * 0.3, 0.15, -0.15, 'body'); cyl(torso, 0.025, 0.08, mats.metalD, s * 0.17, 0.12, -0.5, 'body', 'z', 6); decal(torso, s * 0.292, 0.09, 0.2, s, 'body'); }
    extra.eye = lights(torso, 0.13, 0.6, 0.22);
    const sh = pivot(torso, 0, 0.18, -0.04);
    pr(sh, [0.44, 0.5, 0.36, 0.4, 0.15, 0.02], mats.paint, 0, 0.075, 0, 'armR');
    blk(sh, 0.16, 0.1, 0.08, mats.metalD, 0, 0.07, 0.27, 'armR');
    blk(sh, 0.34, 0.1, 0.12, mats.accent, 0, 0.07, -0.28, 'armR');
    blk(sh, 0.36, 0.012, 0.012, mats.edge, 0, 0.152, 0.2, 'armR');
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) cyl(sh, 0.015, 0.05, mats.metalD, s * 0.21, 0.1, 0.1 + k * 0.045, 'armR', 'z', 6);
    cyl(sh, 0.006, 0.42, mats.metal, -0.15, 0.36, -0.22, 'armR', 'y', 4);
    const gun = pivot(sh, 0, 0.07, 0.31), bar = pivot(gun, 0, 0, 0);
    const big = !wR || wR.fam === 'cannon';
    barrel(bar, big ? 0.03 : 0.02, big ? 0.7 : 0.5, 'armR', 'wR');
    if (big) cyl(bar, 0.045, 0.1, mats.metalD, 0, 0, 0.38, 'armR', 'z', 8);
    extra.gun = gun; extra.gunBar = bar; extra.gunBase = 0;
    // a pintle gun on the commander's cupola
    const cup = pivot(sh, 0.1, 0.15, -0.06);
    cyl(cup, 0.06, 0.05, mats.metal, 0, 0.02, 0, 'armL', 'y', 8);
    const pin = pivot(cup, 0, 0.08, 0.02); blk(pin, 0.04, 0.04, 0.12, mats.metalD, 0, 0, 0.04, 'armL');
    if (wL) barrel(pin, 0.01, 0.2, 'armL', 'wL', false);
    launcherBox(sh, -0.25, 0.1, 0, 'armR');
    Object.assign(extra, { torso, hips: torso, head: pivot(sh, 0, 0.32, 0), armR: { ...mount(sh, gun, bar), part: 'armR' }, armL: { ...mount(cup, pin), part: 'armL' }, top: 1.0 });
  } else if (cls === 'apc') {
    wheels(4, 0.32, 0.78);
    const torso = pivot(group, 0, 0.2, 0); extra.hullY = 0.2;
    pr(torso, [0.6, 1.05, 0.52, 0.94, 0.26], mats.paint, 0, 0.13, 0, 'body');
    pr(torso, [0.6, 0.24, 0.5, 0.04, 0.18, -0.1], mats.paint2, 0, 0.09, 0.63, 'body');
    for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) blk(torso, 0.012, 0.03, 0.06, mats.glass, s * 0.272, 0.2, -0.25 + k * 0.2, 'body'); decal(torso, s * 0.283, 0.12, 0.05, s, 'body'); }
    blk(torso, 0.3, 0.18, 0.02, mats.accent, 0, 0.12, -0.53, 'body'); blk(torso, 0.5, 0.012, 0.012, mats.edge, 0, 0.26, 0.45, 'body');
    extra.eye = lights(torso, 0.15, 0.69, 0.2);
    const sh = pivot(torso, 0, 0.26, 0.08);
    pr(sh, [0.28, 0.32, 0.22, 0.26, 0.1], mats.paint, 0, 0.05, 0, 'armR');
    const gun = pivot(sh, 0, 0.05, 0.16), bar = pivot(gun, 0, 0, 0); barrel(bar, 0.018, 0.45, 'armR', 'wR');
    extra.gun = gun; extra.gunBar = bar; extra.gunBase = 0;
    const hatch = pivot(torso, -0.12, 0.28, -0.28);
    cyl(hatch, 0.07, 0.03, mats.metal, 0, 0, 0, 'armL', 'y', 8);
    const pin = pivot(hatch, 0, 0.06, 0); blk(pin, 0.035, 0.035, 0.1, mats.metalD, 0, 0, 0.03, 'armL');
    if (wL) barrel(pin, 0.009, 0.18, 'armL', 'wL', false);
    launcherBox(sh, 0.2, 0.06, 0, 'armR');
    Object.assign(extra, { torso, hips: torso, head: pivot(sh, 0, 0.26, 0), armR: { ...mount(sh, gun, bar), part: 'armR' }, armL: { ...mount(hatch, pin), part: 'armL' }, top: 0.95 });
  } else if (cls === 'heli') {
    extra.air = true;
    const torso = pivot(group, 0, 0.36, 0); extra.hullY = 0.36;
    pr(torso, [0.22, 0.62, 0.18, 0.5, 0.22], mats.paint, 0, 0, 0, 'body');
    pr(torso, [0.2, 0.2, 0.08, 0.1, 0.26], mats.paint, 0, -0.03, 0.43, 'body', [Math.PI / 2, 0, 0]);
    blk(torso, 0.14, 0.1, 0.2, mats.glass, 0, 0.13, 0.2, 'body'); blk(torso, 0.15, 0.12, 0.16, mats.glass, 0, 0.16, 0.02, 'body');
    blk(torso, 0.012, 0.012, 0.36, mats.trim, 0, 0.225, 0.1, 'body');
    blk(torso, 0.26, 0.1, 0.3, mats.accent, 0, 0.15, -0.17, 'body');
    for (const s of [-1, 1]) { cyl(torso, 0.035, 0.08, mats.metalD, s * 0.15, 0.16, -0.12, 'body', 'z', 8); decal(torso, s * 0.112, -0.01, -0.12, s, 'body'); }
    cyl(torso, 0.055, 0.78, mats.paint, 0, 0.06, -0.64, 'body', 'z', 8, 0.03);
    pr(torso, [0.02, 0.18, 0.012, 0.08, 0.24, -0.06], mats.paint2, 0, 0.17, -0.98, 'body');
    blk(torso, 0.3, 0.015, 0.08, mats.paint2, 0, 0.06, -0.88, 'body');
    for (const s of [-1, 1]) { cyl(torso, 0.012, 0.62, mats.metal, s * 0.16, -0.27, 0.02, 'body', 'z', 6); for (const z of [-0.12, 0.16]) blk(torso, 0.012, 0.16, 0.012, mats.metal, s * 0.13, -0.19, z, 'body', [0, 0, s * 0.35]); }
    extra.eye = blk(torso, 0.03, 0.02, 0.02, mats.lamp, 0, -0.06, 0.56, 'body');
    // the main rotor and the tail rotor (they are the "legs": lose them and it comes down)
    cyl(torso, 0.025, 0.12, mats.metalD, 0, 0.27, -0.04, 'legs', 'y', 6);
    const rotor = pivot(torso, 0, 0.34, -0.04);
    cyl(rotor, 0.05, 0.04, mats.metal, 0, 0, 0, 'legs', 'y', 8);
    for (let k = 0; k < 4; k++) { const b = pivot(rotor, 0, 0, 0); b.rotation.y = k * Math.PI / 2; blk(b, 0.05, 0.012, 0.74, mats.metalD, 0, 0, 0.4, 'legs'); }
    const tail = pivot(torso, 0.035, 0.2, -0.99);
    for (let k = 0; k < 2; k++) { const b = pivot(tail, 0, 0, 0); b.rotation.x = k * Math.PI / 2; blk(b, 0.01, 0.24, 0.03, mats.metalD, 0, 0, 0, 'legs'); }
    extra.rotor = rotor; extra.tailRotor = tail;
    // stub wings with rocket pods (the side mount) and a chin gun (the main mount)
    const wing = pivot(torso, 0, -0.03, -0.03);
    blk(wing, 0.74, 0.025, 0.14, mats.paint2, 0, 0, 0, 'armL');
    for (const s of [-1, 1]) { cyl(wing, 0.042, 0.24, mats.metalD, s * 0.28, -0.065, 0.02, 'armL', 'z', 8); cyl(wing, 0.03, 0.012, mats.ink, s * 0.28, -0.065, 0.141, 'armL', 'z', 6); }
    parts.muzzlewL = pivot(wing, 0.28, -0.065, 0.16);
    const chin = pivot(torso, 0, -0.14, 0.38);
    cyl(chin, 0.05, 0.06, mats.metalD, 0, 0, 0, 'armR', 'y', 8);
    const gun = pivot(chin, 0, -0.025, 0.02), bar = pivot(gun, 0, 0, 0);
    for (const x of [-0.012, 0.012]) cyl(bar, 0.009, 0.26, mats.metal, x, 0, 0.13, 'armR', 'z', 6);
    parts.muzzlewR = pivot(bar, 0, 0, 0.3);
    extra.gun = gun; extra.gunBar = bar; extra.gunBase = 0;
    if (u.sh) { const L = pivot(wing, -0.37, 0.03, 0); parts.launcher = L; for (const y of [0, 0.05]) { cyl(L, 0.02, 0.3, mats.paint2, 0, y, 0.02, 'armL', 'z', 6); blk(L, 0.022, 0.022, 0.02, mats.lamp, 0, y, 0.18, 'armL'); } }
    Object.assign(extra, { torso, hips: torso, head: pivot(torso, 0, 0.3, 0.2), armR: { ...mount(chin, gun, bar), part: 'armR' }, armL: { ...mount(wing), part: 'armL' }, top: 1.0 });
  } else if (cls === 'spg') {
    tracks(1.1, 0.34);
    const torso = pivot(group, 0, 0.25, 0); extra.hullY = 0.25;
    pr(torso, [0.62, 1.1, 0.58, 1.0, 0.16], mats.paint, 0, 0.08, 0, 'body');
    pr(torso, [0.62, 0.2, 0.58, 0.04, 0.12, -0.08], mats.paint2, 0, 0.06, 0.64, 'body');
    extra.eye = lights(torso, 0.12, 0.65, 0.22);
    const sh = pivot(torso, 0, 0.16, -0.14);
    pr(sh, [0.56, 0.62, 0.5, 0.56, 0.24], mats.paint, 0, 0.12, 0, 'armR');
    for (const s of [-1, 1]) { blk(sh, 0.01, 0.14, 0.18, mats.accent, s * 0.272, 0.12, -0.1, 'armR'); decal(sh, s * 0.276, 0.16, 0.14, s, 'armR'); }
    blk(sh, 0.5, 0.012, 0.012, mats.edge, 0, 0.24, 0.28, 'armR');
    const hw = pivot(sh, 0, 0.14, 0.31); hw.rotation.x = -0.38;
    cyl(hw, 0.04, 0.95, mats.metal, 0, 0, 0.47, 'armR', 'z', 8); cyl(hw, 0.06, 0.16, mats.metalD, 0, 0, 0.06, 'armR', 'z', 8); blk(hw, 0.11, 0.08, 0.08, mats.metalD, 0, 0, 0.94, 'armR');
    if (u.sh) parts.launcher = pivot(hw, 0, 0, 1.0);
    const mg = pivot(sh, 0.16, 0.28, 0.05), bar = pivot(mg, 0, 0, 0); blk(mg, 0.04, 0.04, 0.1, mats.metalD, 0, 0, 0, 'armR');
    if (wR) barrel(bar, 0.01, 0.2, 'armR', 'wR', false);
    extra.gun = mg; extra.gunBar = bar; extra.gunBase = 0;
    const spade = pivot(torso, 0, 0.05, -0.56); blk(spade, 0.5, 0.14, 0.04, mats.metalD, 0, 0, 0, 'armL', [0.3, 0, 0]);
    Object.assign(extra, { torso, hips: torso, head: pivot(sh, 0, 0.42, 0), armR: { ...mount(sh, mg, bar), part: 'armR' }, armL: { ...mount(spade), part: 'armL' }, top: 1.05 });
  } else if (cls === 'aa' || cls === 'truck') {
    wheels(3, 0.31, 0.7);
    const torso = pivot(group, 0, 0.2, 0); extra.hullY = 0.2;
    pr(torso, [0.56, 0.32, 0.5, 0.26, 0.28], mats.paint, 0, 0.14, 0.36, 'body');
    blk(torso, 0.46, 0.1, 0.02, mats.glass, 0, 0.2, 0.525, 'body');
    blk(torso, 0.6, 0.07, 0.72, mats.accent, 0, 0.035, -0.14, 'body');
    extra.eye = lights(torso, 0.08, 0.525, 0.2);
    for (const s of [-1, 1]) decal(torso, s * 0.266, 0.14, 0.36, s, 'body');
    if (cls === 'truck') {
      blk(torso, 0.58, 0.32, 0.6, mats.paint2, 0, 0.23, -0.15, 'body');
      for (let k = 0; k < 4; k++) blk(torso, 0.6, 0.02, 0.025, mats.accent, 0, 0.395, -0.4 + k * 0.17, 'body');
      blk(torso, 0.3, 0.06, 0.02, mats.trim, 0, 0.23, -0.452, 'body');
      const dummy = pivot(torso, 0, 0.3, 0);
      Object.assign(extra, { torso, hips: torso, head: pivot(torso, 0, 0.6, 0), armR: { ...mount(dummy), part: 'armR' }, armL: { ...mount(dummy), part: 'armL' }, top: 0.9 });
    } else {
      const sh = pivot(torso, 0, 0.07, -0.14);
      cyl(sh, 0.18, 0.08, mats.paint, 0, 0.04, 0, 'armR', 'y', 10);
      blk(sh, 0.3, 0.16, 0.26, mats.paint2, 0, 0.16, 0, 'armR');
      const gun = pivot(sh, 0, 0.18, 0.08), bar = pivot(gun, 0, 0, 0); extra.gunBase = -0.5; gun.rotation.x = -0.5;
      for (const s of [-1, 1]) cyl(bar, 0.018, 0.55, mats.metal, s * 0.08, 0, 0.3, 'armR', 'z', 6);
      parts.muzzlewR = pivot(bar, 0.08, 0, 0.6);
      extra.gun = gun; extra.gunBar = bar;
      const mast = pivot(torso, 0, 0.07, -0.44);
      cyl(mast, 0.02, 0.26, mats.metalD, 0, 0.13, 0, 'armL', 'y', 6);
      const dish = pivot(mast, 0, 0.28, 0); blk(dish, 0.32, 0.16, 0.02, mats.metalD, 0, 0, 0.02, 'armL', [-0.3, 0, 0]); blk(dish, 0.02, 0.02, 0.08, mats.metal, 0, 0, 0.06, 'armL');
      extra.radar = dish;
      launcherBox(sh, -0.24, 0.2, 0, 'armR');
      Object.assign(extra, { torso, hips: torso, head: pivot(sh, 0, 0.38, 0), armR: { ...mount(sh, gun, bar), part: 'armR' }, armL: { ...mount(mast), part: 'armL' }, top: 0.95 });
    }
  } else if (cls === 'tower') {
    const torso = pivot(group, 0, 0, 0); extra.hullY = 0;
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) cyl(torso, 0.025, 1.4, mats.metalD, x * 0.75, 0.7, z * 0.75, 'body', 'y', 6, 0.03);
    for (let k = 0; k < 4; k++) { const y = 0.2 + k * 0.32, w2 = 0.4 - k * 0.04; for (const [a, b] of [[0, 1], [1, 0]]) blk(torso, a ? w2 : 0.02, 0.02, b ? w2 : 0.02, mats.metal, 0, y, 0, 'body'); }
    blk(torso, 0.5, 0.06, 0.5, mats.paint, 0, 0.06, 0, 'body');
    blk(torso, 0.3, 0.05, 0.3, mats.paint2, 0, 1.42, 0, 'body');
    blk(torso, 0.34, 0.24, 0.02, mats.metalD, 0, 1.6, 0.12, 'body', [-0.3, 0, 0]);
    cyl(torso, 0.008, 0.5, mats.metal, 0.1, 1.7, -0.08, 'body', 'y', 4);
    extra.eye = blk(torso, 0.05, 0.05, 0.05, mats.eye, 0.1, 1.96, -0.08, 'body');
    const d = pivot(torso, 0, 0.5, 0);
    Object.assign(extra, { torso, hips: torso, head: pivot(torso, 0, 2.0, 0), armR: { ...mount(d), part: 'armR' }, armL: { ...mount(d), part: 'armL' }, top: 2.2, blink: true });
  } else { // depot
    const torso = pivot(group, 0, 0, 0); extra.hullY = 0;
    blk(torso, 0.86, 0.06, 0.86, mats.metalD, 0, 0.03, 0, 'body');
    for (const s of [-1, 1]) { cyl(torso, 0.19, 0.78, mats.paint, s * 0.21, 0.27, 0, 'body', 'z', 12); cyl(torso, 0.16, 0.04, mats.paint2, s * 0.21, 0.27, 0.4, 'body', 'z', 12); cyl(torso, 0.16, 0.04, mats.paint2, s * 0.21, 0.27, -0.4, 'body', 'z', 12); blk(torso, 0.06, 0.06, 0.78, mats.trim, s * 0.21, 0.47, 0, 'body'); }
    cyl(torso, 0.03, 0.6, mats.metal, 0, 0.12, 0, 'body', 'x', 6);
    extra.eye = blk(torso, 0.04, 0.04, 0.04, mats.lamp, 0, 0.5, 0.4, 'body');
    const d = pivot(torso, 0, 0.3, 0);
    Object.assign(extra, { torso, hips: torso, head: pivot(torso, 0, 0.7, 0), armR: { ...mount(d), part: 'armR' }, armL: { ...mount(d), part: 'armL' }, top: 0.9 });
  }
  return finish(K, extra);
}

// pose a vehicle: the same pose as the wanzers (walk, aim, recoil, muzzle, lean, roll, kick, crouch…), read its way
export function poseVehicle(m, u, pose) {
  const t = pose.t || 0, w = pose.walk || 0, ph = pose.phase || 0;
  for (const part of ['body', 'armL', 'armR', 'legs']) { const dead = u.hp[part] <= 0; if (m['dead' + part] === dead) continue; m['dead' + part] = dead; for (const mesh of m.parts[part] || []) mesh.material = dead ? m.mats.dead : mesh.userData.mat; }
  // wheels and tracks turn while it moves
  const dph = ph - (m.lastPh ?? ph); m.lastPh = ph;
  if (w > 0.1 && Math.abs(dph) < 2) m.wheelA = (m.wheelA || 0) + dph * 1.1;
  for (const s of m.wheelList) s.rotation.x = m.wheelA || 0;
  if (m.rotor) { m.rotor.rotation.y = t * 22; m.tailRotor.rotation.x = t * 40; }
  if (m.radar) m.radar.rotation.y = t * 1.4;
  // the hull pitches and rolls; a helicopter bobs and leans into its flight
  m.torso.position.y = m.hullY - (pose.crouch || 0) * 0.04 + (m.air ? Math.sin(t * 2.1) * 0.03 : w > 0.1 ? Math.sin(ph * 2) * 0.006 : 0);
  m.torso.rotation.x = (m.air ? w * 0.22 : 0) + (pose.lean || 0) * 0.35 - (pose.recoil || 0) * (m.cls === 'tank' ? 0.06 : 0.02);
  m.torso.rotation.z = (pose.roll || 0) * 0.6;
  // the turret turns to the target, kicks when hit; the gun lifts to aim and runs back when it fires
  if (m.armR.sh !== m.torso && !m.air) m.armR.sh.rotation.y = (pose.twist || 0) + ((pose.kickR || 0) - (pose.kickL || 0)) * 0.15;
  if (m.gun) { m.gun.rotation.x = (m.gunBase || 0) - (pose.aim || 0) * 0.06; m.gunBar.position.z = -(pose.recoil || 0) * 0.06; }
  const mz = m.parts.muzzlewR;
  if (mz) { if (!mz.flash) { mz.flash = new THREE.Mesh(prism(0.1, 0.1, 0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#ffd060' })); mz.add(mz.flash); } mz.flash.visible = !!pose.muzzle; mz.flash.rotation.set(t * 9, t * 7, 0); mz.flash.scale.setScalar((m.cls === 'tank' ? 1.6 : 0.8) + ((t * 37) % 1) * 0.6); }
  if (m.blink && m.eye) m.eye.visible = Math.floor(t * 1.5) % 2 === 0;
}
