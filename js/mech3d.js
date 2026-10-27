// Wanzers in 3D: the squat machine of the pixel sprites, built part by part on a skeleton of pivots (hips, thighs,
// knees, ankles; shoulders, elbows) and lit with the same few hard bands of toon shading.
// Detail: armour plates with chamfered edges, small pixel textures on every surface (panel seams round each face,
// rivets, scratches, grime low down), a framed cockpit, vents, a backpack with exhausts and fins, pistons, round
// joints, layered shoulder armour, fingers, guns with brakes, magazines and sights.
// poseMech() moves the joints every frame from the same pose as the sprites.
import * as THREE from './lib/three.module.min.js';
import { ITEM } from './data.js';
import { TOON } from './world3d.js';
import { hash } from './render.js';

const COL = {
  p: { paint: ['#36482a', '#4e6830', '#6a8a40', '#88a656', '#a8c070'], trim: '#d8b44a' },
  e: { paint: ['#3a393c', '#5c5a5c', '#7e7a76', '#9e9a92', '#bcb8ae'], trim: '#d86a2a' },
};
// ---------------------------------------------------------------- pixel textures for the armour
function pixTex(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(g, size);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const texCache = new Map();
// painted armour: mottled paint, a seam round the edge, rivets in the corners, a few scratches, grime at the foot
function paintTex(pal, seed) {
  const key = pal.join() + seed; if (texCache.has(key)) return texCache.get(key);
  const t = pixTex(16, (g, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = hash(x, y, seed); g.fillStyle = v > 0.975 ? pal[3] : v < 0.03 ? pal[1] : pal[2]; g.fillRect(x, y, 1, 1); }
    g.fillStyle = pal[0]; g.fillRect(0, 0, n, 1); g.fillRect(0, 0, 1, n); g.fillStyle = pal[1]; g.fillRect(0, n - 1, n, 1); g.fillRect(n - 1, 0, 1, n);
    g.fillStyle = pal[4]; g.fillRect(1, 1, n - 2, 1);
    for (const [x, y] of [[2, 3], [n - 3, 3], [2, n - 3], [n - 3, n - 3]]) { g.fillStyle = pal[0]; g.fillRect(x, y, 1, 1); g.fillStyle = pal[4]; g.fillRect(x - 1, y - 1, 1, 1); }
    for (let k = 0; k < 3; k++) { const x = 3 + Math.floor(hash(k, seed, 7) * 9), y = 4 + Math.floor(hash(seed, k, 8) * 7); g.fillStyle = pal[4]; g.fillRect(x, y, 2 + (k % 2), 1); }
    for (let x = 1; x < n - 1; x++) if (hash(x, seed, 9) > 0.45) { g.fillStyle = pal[1]; g.fillRect(x, n - 2 - Math.floor(hash(x, seed, 3) * 2), 1, 1); }
  });
  texCache.set(key, t); return t;
}
const metalTex = (dark) => { const key = 'metal' + dark; if (texCache.has(key)) return texCache.get(key); const pal = dark ? ['#16171b', '#22242a', '#2e3138', '#3c4048', '#545a64'] : ['#22242a', '#2e3138', '#3e424a', '#545a64', '#7a808a'];
  const t = pixTex(16, (g, n) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = hash(x, y, dark ? 41 : 40); g.fillStyle = v > 0.9 ? pal[3] : v < 0.12 ? pal[1] : pal[2]; g.fillRect(x, y, 1, 1); } g.fillStyle = pal[0]; g.fillRect(0, n - 1, n, 1); g.fillRect(n - 1, 0, 1, n); g.fillStyle = pal[4]; g.fillRect(0, 0, n, 1); for (let y = 3; y < n; y += 5) { g.fillStyle = pal[1]; g.fillRect(2, y, n - 4, 1); } });
  texCache.set(key, t); return t; };
const grilleTex = () => { if (texCache.has('grille')) return texCache.get('grille'); const t = pixTex(8, (g, n) => { for (let y = 0; y < n; y++) { g.fillStyle = y % 2 ? '#101114' : '#4a4e56'; g.fillRect(0, y, n, 1); } }); texCache.set('grille', t); return t; };

// ---------------------------------------------------------------- shapes
const geoCache = new Map();
// a box whose edges are chamfered: an extruded octagon with a small bevel on its faces
function chamferBox(w, h, d, c = 0.22) {
  const key = `c${w},${h},${d},${c}`; if (geoCache.has(key)) return geoCache.get(key);
  const k = Math.min(w, h) * c, b = Math.min(w, h, d) * 0.1, sw = w / 2 - b, sh = h / 2 - b, kk = Math.min(k, sw * 0.6, sh * 0.6);
  const s = new THREE.Shape(); s.moveTo(-sw + kk, -sh); s.lineTo(sw - kk, -sh); s.lineTo(sw, -sh + kk); s.lineTo(sw, sh - kk); s.lineTo(sw - kk, sh); s.lineTo(-sw + kk, sh); s.lineTo(-sw, sh - kk); s.lineTo(-sw, -sh + kk); s.closePath();
  const gg = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1 });
  gg.translate(0, 0, -(d - 2 * b) / 2);
  // the UVs come out in metres; one texture across about half a metre
  const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2 + 0.5, uv.getY(i) * 2.2 + 0.5);
  gg.computeVertexNormals(); geoCache.set(key, gg); return gg;
}
function plainBox(w, h, d) { const key = `b${w},${h},${d}`; if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d)); return geoCache.get(key); }
function cylGeo(r1, r2, len, n = 8) { const key = `y${r1},${r2},${len},${n}`; if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(r1, r2, len, n)); return geoCache.get(key); }

export function buildMech(u) {
  const C = COL[u.side], legs = ITEM[u.legs];
  const T = (map, extra = {}) => new THREE.MeshToonMaterial({ map, gradientMap: TOON, transparent: true, ...extra });
  const mats = {
    paint: T(paintTex(C.paint, 1)), paint2: T(paintTex(C.paint, 2)), dark: T(paintTex(C.paint.map((c, i) => C.paint[Math.max(0, i - 1)]), 3)),
    metal: T(metalTex(false)), metalD: T(metalTex(true)), trim: new THREE.MeshToonMaterial({ color: C.trim, gradientMap: TOON, transparent: true }),
    glass: new THREE.MeshToonMaterial({ color: '#2c4450', emissive: '#0e2a3a', gradientMap: TOON, transparent: true }), grille: T(grilleTex()),
    eye: new THREE.MeshBasicMaterial({ color: '#ff4a30', transparent: true }), ink: new THREE.MeshToonMaterial({ color: '#141412', gradientMap: TOON, transparent: true }),
    dead: new THREE.MeshToonMaterial({ color: '#2e2924', gradientMap: TOON, transparent: true }), jet: new THREE.MeshBasicMaterial({ color: '#6ad0f0', transparent: true }),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffd060', transparent: true }),
  };
  const group = new THREE.Group(), hit = [], parts = {};
  const put = (parent, geo, mat, x, y, z, part, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; m.userData = { unit: u, part, mat }; parent.add(m); hit.push(m); (parts[part] ||= []).push(m); return m; };
  const box = (p, w, h, d, mat, x, y, z, part, r) => put(p, chamferBox(w, h, d), mat, x, y, z, part, ...(r || []));
  const blk = (p, w, h, d, mat, x, y, z, part, r) => put(p, plainBox(w, h, d), mat, x, y, z, part, ...(r || []));
  const cyl = (p, r, len, mat, x, y, z, part, axis = 'y', n = 8, r2 = r) => put(p, cylGeo(r, r2, len, n), mat, x, y, z, part, axis === 'x' ? 0 : axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);
  const rivets = (p, pts, part) => { for (const [x, y, z] of pts) blk(p, 0.018, 0.018, 0.018, mats.metal, x, y, z, part); };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ---- hips: a block with skirt plates front, back and sides
  const hips = pivot(group, 0, 0.42, 0);
  box(hips, 0.42, 0.13, 0.26, mats.metal, 0, 0, 0, 'body');
  box(hips, 0.3, 0.12, 0.05, mats.paint2, 0, -0.03, 0.15, 'body', [-0.25, 0, 0]);
  box(hips, 0.3, 0.1, 0.05, mats.dark, 0, -0.02, -0.15, 'body', [0.25, 0, 0]);
  for (const s of [-1, 1]) box(hips, 0.05, 0.12, 0.2, mats.paint2, s * 0.24, -0.04, 0, 'body', [0, 0, s * 0.2]);
  // ---- torso: the hull, a chest plate, the framed cockpit, vents, stripes, rivets
  const torso = pivot(hips, 0, 0.06, 0);
  box(torso, 0.62, 0.38, 0.5, mats.paint, 0, 0.21, 0, 'body');
  box(torso, 0.44, 0.2, 0.06, mats.paint2, -0.05, 0.13, 0.25, 'body', [-0.12, 0, 0]); // the chest plate, angled
  box(torso, 0.32, 0.15, 0.04, mats.metalD, 0.12, 0.31, 0.25, 'body'); // cockpit frame
  blk(torso, 0.26, 0.1, 0.02, mats.glass, 0.12, 0.315, 0.272, 'body');
  blk(torso, 0.2, 0.015, 0.01, mats.lamp, 0.1, 0.355, 0.284, 'body'); // a glint on the glass
  for (const s of [-1, 1]) { blk(torso, 0.02, 0.14, 0.22, mats.grille, s * 0.315, 0.16, -0.04, 'body'); blk(torso, 0.02, 0.05, 0.42, mats.trim, s * 0.316, 0.32, 0, 'body'); }
  box(torso, 0.56, 0.06, 0.44, mats.dark, 0, 0.42, -0.01, 'body'); // the top deck
  rivets(torso, [[-0.26, 0.05, 0.255], [0.26, 0.05, 0.255], [-0.26, 0.37, 0.255], [-0.12, 0.05, 0.255]], 'body');
  // a backpack generator with exhausts and cooling fins
  box(torso, 0.4, 0.28, 0.14, mats.metalD, 0, 0.24, -0.3, 'body');
  for (let k = 0; k < 4; k++) blk(torso, 0.36, 0.015, 0.06, mats.metal, 0, 0.14 + k * 0.06, -0.38, 'body');
  for (const s of [-1, 1]) { cyl(torso, 0.035, 0.18, mats.metal, s * 0.14, 0.44, -0.32, 'body'); cyl(torso, 0.025, 0.02, mats.ink, s * 0.14, 0.535, -0.32, 'body'); }
  // ---- head: low, with a visor, side sensors, a lens, an antenna
  const head = pivot(torso, 0, 0.45, -0.06);
  box(head, 0.22, 0.13, 0.22, mats.paint, 0, 0.065, 0, 'body');
  blk(head, 0.18, 0.035, 0.02, mats.ink, 0, 0.075, 0.112, 'body');
  const eye = blk(head, 0.05, 0.03, 0.02, mats.eye, 0.04, 0.075, 0.12, 'body');
  for (const s of [-1, 1]) cyl(head, 0.03, 0.05, mats.metal, s * 0.125, 0.07, 0.02, 'body', 'x');
  cyl(head, 0.008, 0.22, mats.metal, -0.07, 0.24, -0.05, 'body', 'y', 4); blk(head, 0.03, 0.03, 0.03, mats.lamp, -0.07, 0.35, -0.05, 'body');
  // ---- a missile launcher on the back
  if (u.sh) {
    const L = pivot(torso, -0.2, 0.52, -0.22);
    box(L, 0.3, 0.2, 0.26, mats.metal, 0, 0.1, 0, 'body'); blk(L, 0.06, 0.12, 0.06, mats.metalD, 0.1, -0.03, 0.04, 'body');
    const n = u.sh === 'RK1' ? 3 : 2; for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) cyl(L, 0.035, 0.02, mats.ink, -0.09 + k * (0.18 / Math.max(1, n - 1)), 0.06 + j * 0.08, 0.135, 'body', 'z', 6);
    blk(L, 0.26, 0.02, 0.02, mats.trim, 0, 0.19, 0.13, 'body');
  }
  // ---- arms: a joint, layered shoulder armour, an upper arm, an elbow, a ridged forearm, a hand with fingers
  const arm = (side, part, slot) => {
    const sh = pivot(torso, side * 0.4, 0.33, 0);
    cyl(sh, 0.07, 0.1, mats.metalD, -side * 0.02, 0, 0, part, 'x');
    box(sh, 0.26, 0.2, 0.36, mats.paint, side * 0.05, 0.05, 0, part);
    box(sh, 0.06, 0.16, 0.3, mats.paint2, side * 0.18, 0.02, 0, part, [0, 0, side * 0.15]); // the flared outer plate
    blk(sh, 0.02, 0.04, 0.3, mats.trim, side * 0.215, 0.07, 0, part);
    rivets(sh, [[side * 0.17, 0.14, 0.12], [side * 0.17, 0.14, -0.12]], part);
    const up = pivot(sh, 0, -0.06, 0);
    cyl(up, 0.05, 0.16, mats.metal, 0, -0.09, 0, part); cyl(up, 0.015, 0.14, mats.metalD, side * 0.04, -0.09, 0.04, part, 'y', 4);
    const el = pivot(up, 0, -0.18, 0);
    cyl(el, 0.065, 0.13, mats.metalD, 0, 0, 0, part, 'x');
    box(el, 0.17, 0.26, 0.18, mats.paint, 0, -0.13, 0.005, part);
    box(el, 0.06, 0.2, 0.08, mats.paint2, side * 0.08, -0.12, 0.05, part); // a ridge of armour on the outside
    blk(el, 0.18, 0.015, 0.19, mats.dark, 0, -0.04, 0.005, part);
    const palm = blk(el, 0.11, 0.07, 0.11, mats.metal, 0, -0.29, 0, part);
    for (let k = -1; k <= 1; k++) blk(el, 0.025, 0.06, 0.03, mats.metalD, k * 0.035, -0.34, 0.04, part);
    // the weapon points along the forearm: down when the arm hangs, forward when it is raised
    const w = u[slot] && ITEM[u[slot]];
    if (w) {
      const hand = pivot(el, 0, -0.3, 0);
      if (w.cat === 'shield') { box(hand, 0.05, 0.5, 0.34, mats.metalD, side * 0.12, 0.1, 0.02, part); blk(hand, 0.01, 0.4, 0.04, mats.trim, side * 0.15, 0.1, 0.1, part); rivets(hand, [[side * 0.15, 0.32, -0.1], [side * 0.15, -0.12, -0.1], [side * 0.15, 0.32, 0.12]], part); }
      else if (w.cat === 'melee') {
        if (w.id === 'KN1') { box(hand, 0.17, 0.12, 0.17, mats.metal, 0, -0.06, 0, part); for (let k = -1; k <= 1; k++) blk(hand, 0.03, 0.04, 0.05, mats.metalD, k * 0.05, -0.12, 0.06, part); }
        else { cyl(hand, 0.025, 0.56, mats.metal, 0, 0, 0.2, part, 'z', 6); if (w.id === 'AX1') { box(hand, 0.03, 0.22, 0.16, mats.metal, 0, 0.08, 0.43, part); blk(hand, 0.035, 0.22, 0.02, mats.lamp, 0, 0.08, 0.515, part); } if (w.id === 'RD1') cyl(hand, 0.04, 0.14, mats.jet, 0, 0, 0.47, part, 'z', 6); }
      } else {
        const len = { MG1: 0.42, MG2: 0.46, SG1: 0.32, RF1: 0.52, RF2: 0.66 }[w.id] || 0.42, th = w.id === 'SG1' || w.id === 'MG2' ? 0.035 : 0.025;
        box(hand, 0.09, 0.22, 0.13, mats.metalD, 0, -0.06, 0, part); // receiver
        cyl(hand, th, len, mats.metal, 0, -0.08 - len / 2, 0.02, part, 'y', 6); // barrel
        cyl(hand, th * 1.6, 0.06, mats.metalD, 0, -0.08 - len + 0.03, 0.02, part, 'y', 6); // muzzle brake
        if (w.id === 'MG1' || w.id === 'MG2') cyl(hand, 0.07, 0.05, mats.metalD, 0.06, -0.05, 0.05, part, 'x', 8); // drum magazine
        else blk(hand, 0.05, 0.08, 0.1, mats.metalD, 0, -0.04, 0.1, part); // a box magazine
        if (w.id === 'RF2' || w.id === 'RF1') { cyl(hand, 0.022, 0.14, mats.metal, 0, -0.1, -0.06, part, 'y', 6); blk(hand, 0.02, 0.02, 0.02, mats.glass, 0, -0.17, -0.06, part); }
        if (w.id === 'SG1') blk(hand, 0.06, 0.08, 0.06, mats.dark, 0, -0.2, 0.05, part); // the pump
      }
      parts['muzzle' + slot] = pivot(hand, 0, -0.12 - ({ MG1: 0.42, MG2: 0.46, SG1: 0.32, RF1: 0.52, RF2: 0.66 }[w.id] || 0.42), 0.02);
    }
    return { sh, up, el, part };
  };
  const armR = arm(1, 'armR', 'wR'), armL = arm(-1, 'armL', 'wL');
  // ---- legs, treads or a hover skirt
  let legL = null, legR = null;
  if (legs.tread) {
    const tr = pivot(group, 0, 0, 0);
    for (const s of [-1, 1]) {
      box(tr, 0.2, 0.2, 0.92, mats.metalD, s * 0.3, 0.12, 0, 'legs');
      for (let k = -4; k <= 4; k++) blk(tr, 0.22, 0.04, 0.08, mats.metal, s * 0.3, 0.025, k * 0.1, 'legs'); // track links
      for (let k = -1; k <= 1; k++) cyl(tr, 0.08, 0.22, mats.metal, s * 0.3, 0.12, k * 0.28, 'legs', 'x', 8);
      box(tr, 0.06, 0.1, 0.8, mats.paint2, s * 0.42, 0.18, 0, 'legs');
    }
    box(tr, 0.5, 0.2, 0.62, mats.paint, 0, 0.3, 0, 'legs');
    hips.position.y = 0.42;
  } else if (legs.hover) {
    const hv = pivot(group, 0, 0, 0);
    box(hv, 0.72, 0.14, 0.72, mats.dark, 0, 0.15, 0, 'legs'); blk(hv, 0.62, 0.03, 0.62, mats.jet, 0, 0.06, 0, 'legs');
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) cyl(hv, 0.08, 0.03, mats.jet, x, 0.05, z, 'legs', 'y', 8);
    box(hv, 0.34, 0.22, 0.34, mats.paint, 0, 0.32, 0, 'legs');
    hips.position.y = 0.44;
  } else {
    const leg = (side) => {
      const hip = pivot(group, side * 0.16, 0.42, 0);
      cyl(hip, 0.06, 0.1, mats.metalD, 0, 0, 0, 'legs', 'x');
      cyl(hip, 0.055, 0.22, mats.metal, 0, -0.12, 0, 'legs'); // the thigh strut
      box(hip, 0.06, 0.2, 0.16, mats.paint2, side * 0.06, -0.1, 0, 'legs'); // outer thigh armour
      cyl(hip, 0.014, 0.2, mats.metalD, 0, -0.11, 0.06, 'legs', 'y', 4); // a piston
      const knee = pivot(hip, 0, -0.24, 0);
      cyl(knee, 0.06, 0.18, mats.metalD, 0, 0, 0, 'legs', 'x');
      box(knee, 0.22, 0.33, 0.26, mats.paint, 0, -0.15, 0.01, 'legs'); // the greave
      box(knee, 0.06, 0.24, 0.2, mats.paint2, side * 0.11, -0.14, 0, 'legs');
      box(knee, 0.16, 0.15, 0.08, mats.paint2, 0, 0.0, 0.13, 'legs', [-0.3, 0, 0]); // knee guard
      blk(knee, 0.23, 0.015, 0.27, mats.dark, 0, -0.17, 0.01, 'legs');
      rivets(knee, [[0.08, -0.06, 0.14], [-0.08, -0.06, 0.14], [0.08, -0.26, 0.14]], 'legs');
      const ank = pivot(knee, 0, -0.32, 0);
      cyl(ank, 0.045, 0.16, mats.metalD, 0, 0, 0, 'legs', 'x');
      box(ank, 0.24, 0.08, 0.26, mats.metalD, 0, -0.04, 0.0, 'legs'); // the sole
      box(ank, 0.22, 0.07, 0.16, mats.metal, 0, -0.035, 0.19, 'legs', [0.2, 0, 0]); // toe
      box(ank, 0.2, 0.08, 0.1, mats.metal, 0, -0.03, -0.14, 'legs'); // heel
      return { hip, knee, ank };
    };
    legL = leg(-1); legR = leg(1);
  }
  // ---- a health bar, a commander's star, a marker over the selected machine
  const barC = document.createElement('canvas'); barC.width = 20; barC.height = 5;
  const barT = new THREE.CanvasTexture(barC); barT.magFilter = barT.minFilter = THREE.NearestFilter; barT.generateMipmaps = false;
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false })); bar.scale.set(0.5, 0.125, 1); bar.position.y = 1.36; bar.renderOrder = 9; group.add(bar);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd23a', depthTest: false })); star.scale.set(0.12, 0.12, 1); star.position.y = 1.52; star.visible = !!u.boss; star.renderOrder = 9; group.add(star);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffe14a', depthTest: false })); mark.scale.set(0.12, 0.16, 1); mark.position.y = 1.66; mark.visible = false; mark.renderOrder = 9; group.add(mark);
  let lastBar = -1, lastAlpha = -1;
  return {
    group, hit, parts, mats, hips, torso, head, eye, armR, armL, legL, legR, legsType: legs,
    fade(a) { if (a === lastAlpha) return; lastAlpha = a; for (const k in mats) mats[k].opacity = a; },
    bars(u2, sel, t) {
      const k = Math.max(0, u2.hp.body) / u2.max.body, key = Math.round(k * 18);
      if (key !== lastBar) { lastBar = key; const g = barC.getContext('2d'); g.fillStyle = '#100e0a'; g.fillRect(0, 0, 20, 5); g.fillStyle = '#3a3a30'; g.fillRect(1, 1, 18, 3); g.fillStyle = k > 0.5 ? '#9ac850' : k > 0.25 ? '#e0b030' : '#e04a30'; g.fillRect(1, 1, Math.max(1, key), 3); barT.needsUpdate = true; }
      mark.visible = sel; mark.position.y = 1.66 + (Math.floor(t * 4) % 2) * 0.04; bar.visible = u2.hp.body > 0;
    },
  };
}

// pose: { phase, walk, aim, recoil, muzzle, flinch, t }
export function poseMech(m, u, pose) {
  const w = pose.walk || 0, ph = pose.phase || 0, aim = pose.aim || 0, t = pose.t || 0;
  // broken parts go dark; a destroyed arm is gone
  for (const part of ['body', 'armL', 'armR', 'legs']) { const dead = u.hp[part] <= 0; if (m['dead' + part] === dead) continue; m['dead' + part] = dead; for (const mesh of m.parts[part] || []) mesh.material = dead ? m.mats.dead : mesh.userData.mat; }
  for (const a of [m.armR, m.armL]) a.sh.visible = u.hp[a.part] > 0;
  // legs: the same stride as the sprites; the hips ride as high as the straighter leg
  const lame = u.hp.legs <= 0 ? 0.35 : 1;
  const leg = (p) => { const th = 0.55 * Math.sin(p) * w * lame, bend = 0.15 + 1.05 * w * lame * Math.max(0, Math.cos(p)); return { th, bend }; };
  const breathe = Math.sin(t * 2.2) * 0.006 * (1 - w);
  if (m.legL) {
    const a = leg(ph + Math.PI), b = leg(ph), H = (l) => Math.cos(l.th) * 0.24 + Math.cos(l.th - l.bend) * 0.32 + 0.08;
    const hipY = Math.max(H(a), H(b)) + 0.02 + breathe;
    for (const [L, l] of [[m.legL, a], [m.legR, b]]) { L.hip.position.y = hipY; L.hip.rotation.x = -l.th; L.knee.rotation.x = l.bend; L.ank.rotation.x = l.th - l.bend; }
    m.hips.position.y = hipY;
  } else if (m.legsType.hover) m.hips.position.y = 0.44 + Math.sin(t * 4) * 0.015;
  m.torso.rotation.x = w * 0.08 + aim * 0.04;
  m.torso.position.x = (pose.flinch || 0) * 0.03;
  // arms swing against the legs; the right arm comes up to aim
  const sw = 0.45 * w;
  const restR = { s: -(0.1 + Math.sin(ph + Math.PI) * sw), e: -(0.6 + Math.sin(ph + Math.PI) * sw * 1.3) }, restL = { s: -(0.1 + Math.sin(ph) * sw), e: -(0.6 + Math.sin(ph) * sw * 1.3) };
  const aimS = -(Math.PI / 2) + (pose.recoil || 0) * 0.18;
  m.armR.up.rotation.x = restR.s * (1 - aim) + aimS * aim; m.armR.el.rotation.x = restR.e * (1 - aim);
  m.armL.up.rotation.x = restL.s; m.armL.el.rotation.x = restL.e;
  // the muzzle flash
  const mz = m.parts.muzzlewR;
  if (mz) { if (!mz.flash) { mz.flash = new THREE.Mesh(plainBox(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffd060' })); mz.add(mz.flash); } mz.flash.visible = !!pose.muzzle; mz.flash.rotation.set(t * 9, t * 7, 0); }
  m.eye.material.color.set(Math.floor(t * 2) % 2 ? '#ff4a30' : '#ffb070');
}
