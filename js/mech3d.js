// Wanzers in 3D, built part by part on a skeleton of pivots (hips, thighs, knees, ankles; shoulders, elbows) and lit
// with a few hard bands of toon shading. The look: a heroic V — broad angular chest, narrow waist, big pauldrons with
// forward fins, a low head with a mono-eye and a crest, gauntlet forearms, spiked knees, clawed feet, twin thrusters.
// The armour is weathered: paint chipped back to bare metal along the edges, scratches, rust running from the
// rivets, grime gathering low on every plate.
// poseMech() moves the joints every frame from the same pose as the sprites.
import * as THREE from './lib/three.module.min.js';
import { ITEM } from './data.js';
import { TOON } from './world3d.js';
import { hash } from './render.js';

const COL = {
  p: { paint: ['#2c3a20', '#40542a', '#5a7436', '#74904a', '#96b064'], accent: ['#222c18', '#303e22', '#42562c', '#566e38', '#6e884a'], trim: '#d8b44a' },
  e: { paint: ['#323134', '#4a494c', '#6a6764', '#8a8680', '#aaa69c'], accent: ['#262528', '#36353a', '#4c4a4c', '#625f5e', '#7c7874'], trim: '#d86a2a' },
};
// ---------------------------------------------------------------- weathered pixel textures
function pixTex(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(g, size);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const texCache = new Map();
function armourTex(pal, seed) {
  const key = pal.join() + seed; if (texCache.has(key)) return texCache.get(key);
  const t = pixTex(32, (g, n) => {
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    // the paint, nearly flat, darkening with grime towards the bottom of the plate (dithered)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = hash(x, y, seed), low = (y - n * 0.72) / (n * 0.28); px(x, y, low > 0 && (x + y) % 2 === 0 && v < low * 0.7 ? pal[1] : v > 0.985 ? pal[3] : pal[2]); }
    // panel seams round the edge, a lit rim on top
    for (let k = 0; k < n; k++) { px(k, 0, pal[4]); px(0, k, pal[3]); px(k, n - 1, pal[0]); px(n - 1, k, pal[1]); }
    // chips: paint worn back to bare metal along the edges
    for (let k = 0; k < 18; k++) {
      const e = Math.floor(hash(k, seed, 21) * 4), p = 2 + Math.floor(hash(seed, k, 22) * (n - 4)), len = 1 + Math.floor(hash(k, k, seed) * 3);
      for (let j = 0; j < len; j++) { const [x, y] = e === 0 ? [p + j, 1] : e === 1 ? [p + j, n - 2] : e === 2 ? [1, p + j] : [n - 2, p + j]; px(x, y, '#5e626a'); if (e === 0 || e === 2) px(x + (e === 2 ? 1 : 0), y + (e === 0 ? 1 : 0), '#8a8e96'); }
    }
    // scratches
    for (let k = 0; k < 4; k++) { let x = 4 + Math.floor(hash(k, seed, 31) * 22), y = 4 + Math.floor(hash(seed, k, 32) * 18); const dx = hash(k, 3, seed) > 0.5 ? 1 : -1; for (let j = 0; j < 3 + (k % 3); j++) { px(x, y, j % 2 ? pal[4] : '#7a7e86'); x += dx; if (j % 2) y++; } }
    // rivets, with rust running down from two of them
    for (const [x, y] of [[3, 3], [n - 4, 3], [3, n - 4], [n - 4, n - 4]]) { px(x, y, pal[0]); px(x - 1, y - 1, pal[4]); }
    for (const [x, y0] of [[3, 4], [n - 4, 4]]) if (hash(x, seed, 41) > 0.35) for (let y = y0; y < y0 + 4 + Math.floor(hash(seed, x, 42) * 6); y++) px(x + (y % 3 === 0 ? 1 : 0), y, y % 2 ? '#5a3c22' : '#6e4a2a');
  });
  texCache.set(key, t); return t;
}
function metalTex(dark) {
  const key = 'metal' + dark; if (texCache.has(key)) return texCache.get(key);
  const pal = dark ? ['#121317', '#1c1e23', '#272a30', '#353940', '#4c5058'] : ['#1c1e23', '#2a2d34', '#3a3e46', '#4e535c', '#727780'];
  const t = pixTex(16, (g, n) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = hash(x, y, dark ? 41 : 40); g.fillStyle = v > 0.95 ? pal[3] : y > n - 4 && v < 0.5 ? pal[1] : pal[2]; g.fillRect(x, y, 1, 1); } g.fillStyle = pal[0]; g.fillRect(0, n - 1, n, 1); g.fillRect(n - 1, 0, 1, n); g.fillStyle = pal[4]; g.fillRect(0, 0, n, 1); for (let y = 4; y < n - 2; y += 4) { g.fillStyle = pal[1]; g.fillRect(2, y, n - 4, 1); } g.fillStyle = '#5a3c22'; g.fillRect(5, n - 3, 2, 1); });
  texCache.set(key, t); return t;
}
const grilleTex = () => { if (texCache.has('grille')) return texCache.get('grille'); const t = pixTex(8, (g, n) => { for (let y = 0; y < n; y++) { g.fillStyle = y % 2 ? '#0e0f12' : '#464a52'; g.fillRect(0, y, n, 1); } }); texCache.set('grille', t); return t; };

// ---------------------------------------------------------------- shapes
const geoCache = new Map();
// a tapered block: bottom wb x db, top wt x dt, h tall; the top can lean forward (dz) or sideways (dx)
function prism(wb, db, wt, dt, h, dz = 0, dx = 0) {
  const key = `p${wb},${db},${wt},${dt},${h},${dz},${dx}`; if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? wt : wb) + (top ? dx : 0), p.getY(i) * h, p.getZ(i) * (top ? dt : db) + (top ? dz : 0)); }
  g.computeVertexNormals(); geoCache.set(key, g); return g;
}
function cylGeo(r1, r2, len, n = 8) { const key = `y${r1},${r2},${len},${n}`; if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(r1, r2, len, n)); return geoCache.get(key); }

export function buildMech(u) {
  const C = COL[u.side], legs = ITEM[u.legs];
  const T = (map, extra = {}) => new THREE.MeshToonMaterial({ map, gradientMap: TOON, transparent: true, ...extra });
  const mats = {
    paint: T(armourTex(C.paint, 1)), paint2: T(armourTex(C.paint, 2)), accent: T(armourTex(C.accent, 3)),
    metal: T(metalTex(false)), metalD: T(metalTex(true)), trim: new THREE.MeshToonMaterial({ color: C.trim, gradientMap: TOON, transparent: true }),
    glass: new THREE.MeshToonMaterial({ color: '#1e3440', emissive: '#0c2a38', gradientMap: TOON, transparent: true }), grille: T(grilleTex()),
    eye: new THREE.MeshBasicMaterial({ color: '#ff4a30', transparent: true }), ink: new THREE.MeshToonMaterial({ color: '#121210', gradientMap: TOON, transparent: true }),
    dead: new THREE.MeshToonMaterial({ color: '#2e2924', gradientMap: TOON, transparent: true }), jet: new THREE.MeshBasicMaterial({ color: '#6ad0f0', transparent: true }),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffd060', transparent: true }), white: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }),
  };
  const group = new THREE.Group(), hit = [], parts = {};
  const put = (parent, geo, mat, x, y, z, part, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (r) m.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0); m.castShadow = true; m.receiveShadow = true; m.userData = { unit: u, part, mat }; parent.add(m); hit.push(m); (parts[part] ||= []).push(m); return m; };
  const pr = (p, dims, mat, x, y, z, part, r) => put(p, prism(...dims), mat, x, y, z, part, r);
  const blk = (p, w, h, d, mat, x, y, z, part, r) => put(p, prism(w, d, w, d, h), mat, x, y, z, part, r);
  const cyl = (p, r, len, mat, x, y, z, part, axis = 'y', n = 8, r2 = r) => put(p, cylGeo(r, r2, len, n), mat, x, y, z, part, axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : null);
  const rivets = (p, pts, part) => { for (const [x, y, z] of pts) blk(p, 0.02, 0.02, 0.02, mats.metal, x, y, z, part); };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ---- the waist: narrow, with a skirt of plates
  const hips = pivot(group, 0, 0.42, 0);
  pr(hips, [0.3, 0.22, 0.36, 0.26, 0.13], mats.metal, 0, 0, 0, 'body');
  pr(hips, [0.2, 0.04, 0.28, 0.05, 0.14, 0.04], mats.accent, 0, -0.05, 0.15, 'body'); // front plate, flared out at the foot
  pr(hips, [0.24, 0.04, 0.28, 0.05, 0.12, -0.04], mats.accent, 0, -0.04, -0.14, 'body');
  for (const s of [-1, 1]) pr(hips, [0.05, 0.18, 0.04, 0.2, 0.16, 0, -s * 0.04], mats.paint2, s * 0.22, -0.05, 0, 'body');
  // ---- the chest: a broad wedge, wider at the shoulders, pushed forward at the top
  const torso = pivot(hips, 0, 0.06, 0);
  pr(torso, [0.46, 0.4, 0.74, 0.5, 0.4, 0.03], mats.paint, 0, 0.2, 0, 'body');
  // two chest plates meeting in a V
  for (const s of [-1, 1]) pr(torso, [0.16, 0.05, 0.3, 0.05, 0.26, 0.02, s * 0.04], mats.paint2, s * 0.13, 0.22, 0.25, 'body', [-0.16, 0, s * 0.08]);
  pr(torso, [0.5, 0.18, 0.6, 0.2, 0.08, 0.02], mats.accent, 0, 0.42, 0.08, 'body'); // the collar
  // the cockpit: an angled visor band across the upper chest
  pr(torso, [0.34, 0.05, 0.38, 0.05, 0.1, 0.02], mats.metalD, 0, 0.33, 0.27, 'body', [-0.3, 0, 0]);
  pr(torso, [0.3, 0.02, 0.33, 0.02, 0.06], mats.glass, 0, 0.335, 0.3, 'body', [-0.3, 0, 0]);
  blk(torso, 0.18, 0.01, 0.01, mats.lamp, -0.04, 0.355, 0.315, 'body');
  for (const s of [-1, 1]) { blk(torso, 0.02, 0.14, 0.2, mats.grille, s * 0.3, 0.14, -0.02, 'body', [0, 0, s * -0.32]); pr(torso, [0.03, 0.3, 0.03, 0.42, 0.05], mats.trim, s * 0.35, 0.31, 0, 'body', [0, 0, s * -0.32]); }
  rivets(torso, [[-0.2, 0.06, 0.21], [0.2, 0.06, 0.21], [-0.32, 0.38, 0.2], [0.32, 0.38, 0.2]], 'body');
  // the backpack: a generator, twin thrusters with a blue glow, fins
  pr(torso, [0.36, 0.14, 0.42, 0.16, 0.32, -0.02], mats.metalD, 0, 0.24, -0.31, 'body');
  for (let k = 0; k < 4; k++) blk(torso, 0.34, 0.015, 0.05, mats.metal, 0, 0.13 + k * 0.06, -0.4, 'body');
  for (const s of [-1, 1]) { cyl(torso, 0.06, 0.16, mats.metal, s * 0.13, 0.1, -0.4, 'body', 'y', 8, 0.045); cyl(torso, 0.045, 0.02, mats.jet, s * 0.13, 0.015, -0.4, 'body', 'y', 8); pr(torso, [0.02, 0.2, 0.02, 0.08, 0.2, -0.05], mats.accent, s * 0.19, 0.48, -0.3, 'body'); }
  // ---- the head: low and sleek, a sloped faceplate, a mono-eye that sweeps, a crest
  const head = pivot(torso, 0, 0.46, -0.02);
  pr(head, [0.2, 0.22, 0.15, 0.17, 0.12, -0.02], mats.paint, 0, 0.06, 0, 'body');
  pr(head, [0.16, 0.04, 0.12, 0.03, 0.08, 0.03], mats.accent, 0, 0.05, 0.11, 'body', [-0.35, 0, 0]);
  blk(head, 0.15, 0.025, 0.02, mats.ink, 0, 0.085, 0.112, 'body');
  const eye = blk(head, 0.04, 0.022, 0.02, mats.eye, 0, 0.085, 0.12, 'body');
  pr(head, [0.02, 0.18, 0.015, 0.06, 0.1, -0.06], mats.trim, 0, 0.16, -0.02, 'body'); // the crest
  for (const s of [-1, 1]) cyl(head, 0.025, 0.04, mats.metal, s * 0.11, 0.06, 0.02, 'body', 'x');
  cyl(head, 0.007, 0.22, mats.metal, -0.06, 0.24, -0.06, 'body', 'y', 4); blk(head, 0.025, 0.025, 0.025, mats.lamp, -0.06, 0.35, -0.06, 'body');
  // ---- a missile launcher on the shoulder
  if (u.sh) {
    const L = pivot(torso, -0.24, 0.5, -0.12); parts.launcher = L;
    pr(L, [0.26, 0.26, 0.24, 0.22, 0.2, 0.02], mats.metal, 0, 0.1, 0, 'body');
    const n = u.sh === 'RK1' ? 3 : 2; for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) cyl(L, 0.032, 0.02, mats.ink, -0.08 + k * (0.16 / Math.max(1, n - 1)), 0.06 + j * 0.08, 0.13, 'body', 'z', 6);
    blk(L, 0.22, 0.02, 0.02, mats.trim, 0, 0.19, 0.12, 'body'); blk(L, 0.05, 0.12, 0.05, mats.metalD, 0.08, -0.04, 0.02, 'body');
  }
  // ---- arms: angular pauldrons with forward fins, a joint, a bare upper arm, an elbow, a gauntlet, fingers
  const arm = (side, part, slot) => {
    const sh = pivot(torso, side * 0.42, 0.33, 0);
    cyl(sh, 0.07, 0.1, mats.metalD, -side * 0.03, 0, 0, part, 'x');
    pr(sh, [0.3, 0.42, 0.22, 0.34, 0.2, 0, side * 0.04], mats.paint, side * 0.06, 0.06, 0, part); // pauldron, sloping outwards
    pr(sh, [0.04, 0.12, 0.02, 0.02, 0.16, 0.06], mats.paint2, side * 0.1, 0.2, 0.12, part, [0.5, 0, side * -0.3]); // the forward fin
    pr(sh, [0.32, 0.4, 0.32, 0.4, 0.04], mats.accent, side * 0.06, -0.06, 0, part); // the rim beneath
    blk(sh, 0.02, 0.05, 0.32, mats.trim, side * 0.205, 0.07, 0, part, [0, 0, side * -0.2]);
    rivets(sh, [[side * 0.18, 0.1, 0.15], [side * 0.18, 0.1, -0.15]], part);
    const up = pivot(sh, 0, -0.06, 0);
    cyl(up, 0.05, 0.16, mats.metal, 0, -0.09, 0, part); cyl(up, 0.014, 0.14, mats.metalD, side * 0.04, -0.09, 0.04, part, 'y', 4);
    const el = pivot(up, 0, -0.18, 0);
    cyl(el, 0.065, 0.13, mats.metalD, 0, 0, 0, part, 'x');
    pr(el, [0.2, 0.21, 0.15, 0.16, 0.26], mats.paint, 0, -0.14, 0.005, part, [Math.PI, 0, 0]); // the gauntlet, wider at the wrist
    pr(el, [0.03, 0.22, 0.02, 0.05, 0.22, 0.06], mats.paint2, side * 0.1, -0.12, 0, part, [Math.PI, 0, 0]); // a blade fin on the outside
    blk(el, 0.2, 0.015, 0.21, mats.accent, 0, -0.04, 0.005, part);
    blk(el, 0.11, 0.07, 0.11, mats.metal, 0, -0.3, 0, part);
    for (let k = -1; k <= 1; k++) blk(el, 0.025, 0.06, 0.03, mats.metalD, k * 0.035, -0.35, 0.04, part);
    // the weapon lies along the forearm: down when the arm hangs, forward when it is raised
    const w = u[slot] && ITEM[u[slot]];
    if (w) {
      const hand = pivot(el, 0, -0.3, 0);
      if (w.cat === 'shield') { pr(hand, [0.05, 0.34, 0.05, 0.26, 0.52], mats.metalD, side * 0.12, 0.1, 0.02, part); blk(hand, 0.01, 0.42, 0.04, mats.trim, side * 0.15, 0.1, 0.1, part); rivets(hand, [[side * 0.15, 0.32, -0.1], [side * 0.15, -0.12, -0.1], [side * 0.15, 0.32, 0.12]], part); }
      else if (w.cat === 'melee') {
        if (w.id === 'KN1') { pr(hand, [0.17, 0.17, 0.15, 0.15, 0.12], mats.metal, 0, -0.06, 0, part); for (let k = -1; k <= 1; k++) pr(hand, [0.03, 0.04, 0.01, 0.01, 0.06], mats.metalD, k * 0.05, -0.12, 0.06, part, [Math.PI, 0, 0]); }
        else { cyl(hand, 0.025, 0.56, mats.metal, 0, 0, 0.2, part, 'z', 6); if (w.id === 'AX1') { pr(hand, [0.03, 0.08, 0.03, 0.2, 0.22], mats.metal, 0, 0.08, 0.43, part); blk(hand, 0.035, 0.22, 0.02, mats.lamp, 0, 0.08, 0.53, part); } if (w.id === 'RD1') cyl(hand, 0.04, 0.14, mats.jet, 0, 0, 0.47, part, 'z', 6); }
      } else {
        const len = { MG1: 0.42, MG2: 0.46, SG1: 0.32, RF1: 0.52, RF2: 0.66 }[w.id] || 0.42, th = w.id === 'SG1' || w.id === 'MG2' ? 0.035 : 0.025;
        pr(hand, [0.09, 0.13, 0.08, 0.1, 0.22], mats.metalD, 0, -0.06, 0, part);
        cyl(hand, th, len, mats.metal, 0, -0.08 - len / 2, 0.02, part, 'y', 6);
        cyl(hand, th * 1.7, 0.06, mats.metalD, 0, -0.08 - len + 0.03, 0.02, part, 'y', 6);
        if (w.id === 'MG1' || w.id === 'MG2') cyl(hand, 0.07, 0.05, mats.metalD, 0.06, -0.05, 0.05, part, 'x', 8); else blk(hand, 0.05, 0.08, 0.1, mats.metalD, 0, -0.04, 0.1, part);
        if (w.id === 'RF2' || w.id === 'RF1') { cyl(hand, 0.022, 0.14, mats.metal, 0, -0.1, -0.06, part, 'y', 6); blk(hand, 0.02, 0.02, 0.02, mats.glass, 0, -0.17, -0.06, part); }
        if (w.id === 'SG1') blk(hand, 0.06, 0.08, 0.06, mats.accent, 0, -0.2, 0.05, part);
      }
      parts['muzzle' + slot] = pivot(hand, 0, -0.12 - ({ MG1: 0.42, MG2: 0.46, SG1: 0.32, RF1: 0.52, RF2: 0.66 }[w.id] || 0.42), 0.02);
      parts['hand' + slot] = hand;
    }
    return { sh, up, el, part };
  };
  const armR = arm(1, 'armR', 'wR'), armL = arm(-1, 'armL', 'wL');
  // ---- legs: armoured thighs, spiked knees, tapered greaves, clawed feet; or treads; or a hover skirt
  let legL = null, legR = null;
  if (legs.tread) {
    const tr = pivot(group, 0, 0, 0);
    for (const s of [-1, 1]) {
      pr(tr, [0.2, 0.92, 0.2, 0.8, 0.2], mats.metalD, s * 0.3, 0.12, 0, 'legs');
      for (let k = -4; k <= 4; k++) blk(tr, 0.22, 0.04, 0.08, mats.metal, s * 0.3, 0.025, k * 0.1, 'legs');
      for (let k = -1; k <= 1; k++) cyl(tr, 0.08, 0.22, mats.metal, s * 0.3, 0.12, k * 0.28, 'legs', 'x', 8);
      pr(tr, [0.06, 0.84, 0.05, 0.7, 0.12], mats.paint2, s * 0.42, 0.18, 0, 'legs');
    }
    pr(tr, [0.56, 0.66, 0.46, 0.56, 0.2], mats.paint, 0, 0.3, 0, 'legs');
    hips.position.y = 0.42;
  } else if (legs.hover) {
    const hv = pivot(group, 0, 0, 0);
    pr(hv, [0.76, 0.76, 0.64, 0.64, 0.14], mats.accent, 0, 0.15, 0, 'legs'); blk(hv, 0.62, 0.03, 0.62, mats.jet, 0, 0.06, 0, 'legs');
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) cyl(hv, 0.08, 0.03, mats.jet, x, 0.05, z, 'legs', 'y', 8);
    pr(hv, [0.36, 0.36, 0.3, 0.3, 0.22], mats.paint, 0, 0.32, 0, 'legs');
    hips.position.y = 0.44;
  } else {
    const leg = (side) => {
      const hip = pivot(group, side * 0.15, 0.42, 0);
      cyl(hip, 0.06, 0.1, mats.metalD, 0, 0, 0, 'legs', 'x');
      cyl(hip, 0.055, 0.22, mats.metal, 0, -0.12, 0, 'legs');
      pr(hip, [0.08, 0.14, 0.06, 0.18, 0.22, 0, side * 0.02], mats.paint2, side * 0.06, -0.1, 0.01, 'legs'); // thigh armour
      cyl(hip, 0.013, 0.2, mats.metalD, 0, -0.11, 0.07, 'legs', 'y', 4);
      const knee = pivot(hip, 0, -0.24, 0);
      cyl(knee, 0.06, 0.18, mats.metalD, 0, 0, 0, 'legs', 'x');
      pr(knee, [0.19, 0.22, 0.25, 0.28, 0.33], mats.paint, 0, -0.16, 0.01, 'legs', [Math.PI, 0, 0]); // the greave, broad at the top
      pr(knee, [0.05, 0.03, 0.08, 0.05, 0.28, 0.01], mats.paint2, 0, -0.15, 0.15, 'legs', [Math.PI, 0, 0]); // a ridge down the front
      pr(knee, [0.16, 0.12, 0.06, 0.02, 0.16, 0.08], mats.accent, 0, 0.04, 0.13, 'legs', [0.2, 0, 0]); // the knee spike
      blk(knee, 0.26, 0.015, 0.29, mats.accent, 0, -0.06, 0.01, 'legs');
      rivets(knee, [[0.09, -0.08, 0.14], [-0.09, -0.08, 0.14]], 'legs');
      const ank = pivot(knee, 0, -0.32, 0);
      cyl(ank, 0.045, 0.16, mats.metalD, 0, 0, 0, 'legs', 'x');
      pr(ank, [0.26, 0.3, 0.22, 0.26, 0.08], mats.metalD, 0, -0.04, 0.02, 'legs'); // the sole
      for (const s of [-1, 1]) pr(ank, [0.09, 0.14, 0.06, 0.08, 0.07, 0.04], mats.metal, s * 0.065, -0.035, 0.22, 'legs'); // two toe claws
      pr(ank, [0.12, 0.1, 0.08, 0.04, 0.1, -0.04], mats.metal, 0, -0.02, -0.16, 'legs'); // the heel spur
      return { hip, knee, ank };
    };
    legL = leg(-1); legR = leg(1);
  }
  // ---- a health bar, a commander's star, a marker over the selected machine
  const barC = document.createElement('canvas'); barC.width = 20; barC.height = 5;
  const barT = new THREE.CanvasTexture(barC); barT.magFilter = barT.minFilter = THREE.NearestFilter; barT.generateMipmaps = false;
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false })); bar.scale.set(0.5, 0.125, 1); bar.position.y = 1.4; bar.renderOrder = 9; group.add(bar);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd23a', depthTest: false })); star.scale.set(0.12, 0.12, 1); star.position.y = 1.56; star.visible = !!u.boss; star.renderOrder = 9; group.add(star);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffe14a', depthTest: false })); mark.scale.set(0.12, 0.16, 1); mark.position.y = 1.7; mark.visible = false; mark.renderOrder = 9; group.add(mark);
  let lastBar = -1, lastAlpha = -1;
  return {
    group, hit, parts, mats, hips, torso, head, eye, armR, armL, legL, legR, legsType: legs, bar, star, mark,
    fade(a) { if (a === lastAlpha) return; lastAlpha = a; for (const k in mats) mats[k].opacity = a; },
    bars(u2, sel, t) {
      const k = Math.max(0, u2.hp.body) / u2.max.body, key = Math.round(k * 18);
      if (key !== lastBar) { lastBar = key; const g = barC.getContext('2d'); g.fillStyle = '#100e0a'; g.fillRect(0, 0, 20, 5); g.fillStyle = '#3a3a30'; g.fillRect(1, 1, 18, 3); g.fillStyle = k > 0.5 ? '#9ac850' : k > 0.25 ? '#e0b030' : '#e04a30'; g.fillRect(1, 1, Math.max(1, key), 3); barT.needsUpdate = true; }
      mark.visible = sel; mark.position.y = 1.7 + (Math.floor(t * 4) % 2) * 0.04; bar.visible = u2.hp.body > 0;
    },
    // a part flashes white while it is being hit
    flash(part, on, dead) { for (const mesh of parts[part] || []) mesh.material = on ? mats.white : dead ? mats.dead : mesh.userData.mat; },
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
  if (pose.swing != null) { const A = pose.swingL ? m.armL : m.armR; A.up.rotation.x = pose.swing; A.el.rotation.x = -0.3; } // a melee blow, with whichever arm holds the weapon
  // the muzzle flash; the mono-eye sweeps from side to side
  const mz = m.parts.muzzlewR;
  if (mz) { if (!mz.flash) { mz.flash = new THREE.Mesh(prism(0.16, 0.16, 0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffd060' })); mz.add(mz.flash); } mz.flash.visible = !!pose.muzzle; mz.flash.rotation.set(t * 9, t * 7, 0); }
  m.eye.position.x = Math.sin(t * 1.6) * 0.045;
  m.mats.eye.color.set(Math.floor(t * 2) % 2 ? '#ff4a30' : '#ff7a50');
}
