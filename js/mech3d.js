// Wanzers in 3D, built part by part on a skeleton of pivots (hips, thighs, knees, ankles; shoulders, elbows) and lit
// with a few hard bands of toon shading. The look: a heroic V — broad angular chest, narrow waist, big pauldrons with
// forward fins, a low head with a mono-eye and a crest, gauntlet forearms, spiked knees, clawed feet, twin thrusters.
// The armour is weathered: paint chipped back to bare metal along the edges, scratches, rust running from the
// rivets, grime gathering low on every plate.
// poseMech() moves the joints every frame from the same pose as the sprites.
import * as THREE from './lib/three.module.min.js';
import { ITEM } from './data.js?v=16';
import { TOON } from './world3d.js?v=16';
import { hash } from './render.js?v=16';
import { buildVehicle, poseVehicle } from './vehicle3d.js?v=16';

// paint schemes the player can pick in the hangar; accents are the same colours a shade darker
const SCHEME = {
  olive: { paint: ['#2c3a20', '#40542a', '#5a7436', '#74904a', '#96b064'], trim: '#d8b44a' },
  desert: { paint: ['#4a3c26', '#665234', '#86703e', '#a48c54', '#c4aa72'], trim: '#c84a2a' },
  navy: { paint: ['#1c2632', '#2a384a', '#3c4e66', '#546a86', '#7490ae'], trim: '#e0c040' },
  arctic: { paint: ['#4e545c', '#6e767e', '#929aa0', '#b6bcc0', '#d8dcde'], trim: '#d84030' },
  crimson: { paint: ['#361816', '#542420', '#76362c', '#96503e', '#b46a52'], trim: '#e8c050' },
  black: { paint: ['#141416', '#202024', '#2e2e34', '#424248', '#5a5a62'], trim: '#d84a2a' },
};
export const SCHEMES = Object.keys(SCHEME);
export const schemeColour = (k) => SCHEME[k]?.paint[3];
const darker = (c, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
function colours(u) {
  const sc = SCHEME[u.paint] || (u.side === 'e' && u.boss ? { paint: SCHEME.black.paint, trim: '#d86a2a' } : null);
  if (!sc) return COL[u.side];
  return { paint: sc.paint, accent: sc.paint.map((c) => darker(c, 0.74)), trim: sc.trim };
}
// what each part looks like: bodies change the chest, the head and what is on the back; arms the pauldrons and
// their size; legs the greaves
const BODY = {
  B1: { kw: 1, kh: 1, head: 'mono' },
  B2: { kw: 1.1, kh: 1.04, head: 'twin', bulge: true },
  B4: { kw: 0.93, kh: 0.96, head: 'v', wings: true },
  B3: { kw: 1.2, kh: 1.12, head: 'visor', stacks: true },
};
const ARM = { A1: { k: 1, look: 'std' }, A2: { k: 1.06, look: 'round' }, A4: { k: 0.94, look: 'spike' }, A3: { k: 1.16, look: 'heavy' } };
const LEG = { L1: { kx: 1, look: 'std' }, L2: { kx: 1.14, look: 'heavy' }, L4: { kx: 0.88, look: 'fin' } };
const COL = {
  p: { paint: ['#2c3a20', '#40542a', '#5a7436', '#74904a', '#96b064'], accent: ['#222c18', '#303e22', '#42562c', '#566e38', '#6e884a'], trim: '#d8b44a' },
  e: { paint: ['#323134', '#4a494c', '#6a6764', '#8a8680', '#aaa69c'], accent: ['#262528', '#36353a', '#4c4a4c', '#625f5e', '#7c7874'], trim: '#d86a2a' },
};
// ---------------------------------------------------------------- weathered pixel textures
function pixTex(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(g, size);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const texCache = new Map();
function armourTex(pal, seed) {
  const key = pal.join() + seed; if (texCache.has(key)) return texCache.get(key);
  const t = pixTex(32, (g, n) => {
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    // the paint, nearly flat, darkening with grime towards the bottom of the plate (dithered)
    g.fillStyle = pal[2]; g.fillRect(0, 0, n, n);
    g.fillStyle = pal[1]; g.fillRect(1, n - 3, n - 2, 1); // a soft shade along the foot of the plate
    // panel seams round the edge, a lit rim on top
    for (let k = 0; k < n; k++) { px(k, 0, pal[4]); px(0, k, pal[3]); px(k, n - 1, pal[0]); px(n - 1, k, pal[1]); }
    // chips: paint worn back to bare metal along the edges
    for (let k = 0; k < 5; k++) {
      const e = Math.floor(hash(k, seed, 21) * 4), p = 2 + Math.floor(hash(seed, k, 22) * (n - 4)), len = 1 + Math.floor(hash(k, k, seed) * 3);
      for (let j = 0; j < len; j++) { const [x, y] = e === 0 ? [p + j, 1] : e === 1 ? [p + j, n - 2] : e === 2 ? [1, p + j] : [n - 2, p + j]; px(x, y, '#5e626a'); if (e === 0 || e === 2) px(x + (e === 2 ? 1 : 0), y + (e === 0 ? 1 : 0), '#8a8e96'); }
    }
    // scratches
    for (let k = 0; k < (seed === 1 ? 1 : 0); k++) { let x = 4 + Math.floor(hash(k, seed, 31) * 22), y = 4 + Math.floor(hash(seed, k, 32) * 18); const dx = hash(k, 3, seed) > 0.5 ? 1 : -1; for (let j = 0; j < 3 + (k % 3); j++) { px(x, y, j % 2 ? pal[4] : '#7a7e86'); x += dx; if (j % 2) y++; } }
    // rivets, with rust running down from two of them
    for (const [x, y] of [[3, 3], [n - 4, 3], [3, n - 4], [n - 4, n - 4]]) { px(x, y, pal[0]); px(x - 1, y - 1, pal[4]); }
    for (const [x, y0] of [[3, 4], [n - 4, 4]]) if (x === 3 && hash(x, seed, 41) > 0.5) for (let y = y0; y < y0 + 3; y++) px(x, y, '#5e4630');
  });
  texCache.set(key, t); return t;
}
function metalTex(dark) {
  const key = 'metal' + dark; if (texCache.has(key)) return texCache.get(key);
  const pal = dark ? ['#121317', '#1c1e23', '#272a30', '#353940', '#4c5058'] : ['#1c1e23', '#2a2d34', '#3a3e46', '#4e535c', '#727780'];
  const t = pixTex(16, (g, n) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = hash(x, y, dark ? 41 : 40); g.fillStyle = pal[2]; void v; g.fillRect(x, y, 1, 1); } g.fillStyle = pal[0]; g.fillRect(0, n - 1, n, 1); g.fillRect(n - 1, 0, 1, n); g.fillStyle = pal[4]; g.fillRect(0, 0, n, 1); for (let y = 4; y < n - 2; y += 4) { g.fillStyle = pal[1]; g.fillRect(2, y, n - 4, 1); } });
  texCache.set(key, t); return t;
}
const grilleTex = () => { if (texCache.has('grille')) return texCache.get('grille'); const t = pixTex(8, (g, n) => { for (let y = 0; y < n; y++) { g.fillStyle = y % 2 ? '#0e0f12' : '#464a52'; g.fillRect(0, y, n, 1); } }); texCache.set('grille', t); return t; };

// the machine's number on its shoulders, in 3x5 pixel digits
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function decalTex(u, col) {
  const num = u.side === 'p' ? String((u.ri ?? 0) + 1).padStart(2, '0') : String(10 + Math.floor(hash(u.x || 0, u.y || 0, 5) * 89));
  const key = 'decal' + num + col; if (texCache.has(key)) return texCache.get(key);
  const t = pixTex(16, (g) => {
    g.clearRect(0, 0, 16, 16); g.fillStyle = '#16161a'; g.fillRect(2, 4, 12, 8); g.fillStyle = col;
    [...num].forEach((d, k) => { const bits = DIG[+d]; for (let i = 0; i < 15; i++) if (bits[i] === '1') g.fillRect(4 + k * 5 + (i % 3), 5 + Math.floor(i / 3), 1, 1); });
    g.fillRect(3, 11, 10, 0);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); t.offset.set(0, 0);
  // only the plate part of the square: crop the texture to rows 4-12
  t.repeat.set(1, 0.5); t.offset.set(0, 0.25);
  texCache.set(key, t); return t;
}
// ---------------------------------------------------------------- shapes
const geoCache = new Map();
// a tapered block: bottom wb x db, top wt x dt, h tall; the top can lean forward (dz) or sideways (dx)
export function prism(wb, db, wt, dt, h, dz = 0, dx = 0) {
  const key = `p${wb},${db},${wt},${dt},${h},${dz},${dx}`; if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? wt : wb) + (top ? dx : 0), p.getY(i) * h, p.getZ(i) * (top ? dt : db) + (top ? dz : 0)); }
  g.computeVertexNormals(); geoCache.set(key, g); return g;
}
export function cylGeo(r1, r2, len, n = 8) { const key = `y${r1},${r2},${len},${n}`; if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(r1, r2, len, n)); return geoCache.get(key); }

// the materials and little builders every machine is made with (the vehicles too, in vehicle3d.js)
export function kit(u) {
  const C = colours(u);
  const T = (map, extra = {}) => new THREE.MeshToonMaterial({ map, gradientMap: TOON, ...extra });
  const mats = {
    paint: T(armourTex(C.paint, 1)), paint2: T(armourTex(C.paint, 2)), accent: T(armourTex(C.accent, 3)),
    metal: T(metalTex(false)), metalD: T(metalTex(true)), trim: new THREE.MeshToonMaterial({ color: C.trim, gradientMap: TOON }),
    glass: new THREE.MeshToonMaterial({ color: '#1e3440', emissive: '#0c2a38', gradientMap: TOON }), grille: T(grilleTex()),
    eye: new THREE.MeshBasicMaterial({ color: '#ff4a30' }), ink: new THREE.MeshToonMaterial({ color: '#121210', gradientMap: TOON }),
    dead: new THREE.MeshToonMaterial({ color: '#2e2924', gradientMap: TOON }), jet: new THREE.MeshBasicMaterial({ color: '#6ad0f0' }),
    edge: new THREE.MeshToonMaterial({ color: C.paint[4], gradientMap: TOON }), decal: new THREE.MeshBasicMaterial({ map: decalTex(u, C.trim), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffd060' }), white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  };
  const group = new THREE.Group(), hit = [], parts = {};
  const put = (parent, geo, mat, x, y, z, part, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (r) m.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0); m.castShadow = true; m.receiveShadow = true; m.userData = { unit: u, part, mat }; parent.add(m); hit.push(m); (parts[part] ||= []).push(m); return m; };
  const pr = (p, dims, mat, x, y, z, part, r) => put(p, prism(...dims), mat, x, y, z, part, r);
  const blk = (p, w, h, d, mat, x, y, z, part, r) => put(p, prism(w, d, w, d, h), mat, x, y, z, part, r);
  const cyl = (p, r, len, mat, x, y, z, part, axis = 'y', n = 8, r2 = r) => put(p, cylGeo(r, r2, len, n), mat, x, y, z, part, axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : null);
  const rivets = (p, pts, part) => { for (const [x, y, z] of pts) blk(p, 0.02, 0.02, 0.02, mats.metal, x, y, z, part); };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  return { u, C, mats, group, hit, parts, put, pr, blk, cyl, rivets, pivot };
}

export function buildMech(u) {
  const K = kit(u);
  if (ITEM[u.body]?.cls && ITEM[u.body].cls !== 'wanzer') return buildVehicle(u, K);
  const { mats, group, parts, put, pr, blk, cyl, rivets, pivot } = K;
  const legs = ITEM[u.legs], BD = BODY[ITEM[u.body]?.look || u.body] || BODY.B1;

  // ---- the waist: narrow, with a skirt of plates
  const hips = pivot(group, 0, 0.42, 0);
  pr(hips, [0.3, 0.22, 0.36, 0.26, 0.13], mats.metal, 0, 0, 0, 'body');
  pr(hips, [0.2, 0.04, 0.28, 0.05, 0.14, 0.04], mats.accent, 0, -0.05, 0.15, 'body'); // front plate, flared out at the foot
  pr(hips, [0.24, 0.04, 0.28, 0.05, 0.12, -0.04], mats.accent, 0, -0.04, -0.14, 'body');
  for (const s of [-1, 1]) pr(hips, [0.05, 0.18, 0.04, 0.2, 0.16, 0, -s * 0.04], mats.paint2, s * 0.22, -0.05, 0, 'body');
  for (const s of [-1, 1]) { cyl(hips, 0.016, 0.16, mats.metalD, s * 0.1, 0.06, -0.15, 'body', 'y', 6); cyl(hips, 0.022, 0.03, mats.metal, s * 0.1, -0.01, -0.15, 'body', 'y', 6); }
  blk(hips, 0.28, 0.012, 0.012, mats.edge, 0, 0.02, 0.19, 'body'); blk(hips, 0.06, 0.03, 0.01, mats.trim, 0, -0.07, 0.205, 'body');
  // ---- the chest: a broad wedge, wider at the shoulders, pushed forward at the top
  const torso = pivot(hips, 0, 0.06, 0), shell = pivot(torso, 0, 0, 0); shell.scale.set(BD.kw, BD.kh, 1 + (BD.kw - 1) * 0.5);
  pr(shell, [0.46, 0.4, 0.74, 0.5, 0.4, 0.03], mats.paint, 0, 0.2, 0, 'body');
  // two chest plates meeting in a V
  for (const s of [-1, 1]) pr(shell, [0.16, 0.05, 0.3, 0.05, 0.26, 0.02, s * 0.04], mats.paint2, s * 0.13, 0.22, 0.25, 'body', [-0.16, 0, s * 0.08]);
  pr(shell, [0.5, 0.18, 0.6, 0.2, 0.08, 0.02], mats.accent, 0, 0.42, 0.08, 'body'); // the collar
  // the cockpit: an angled visor band across the upper chest
  pr(shell, [0.34, 0.05, 0.38, 0.05, 0.1, 0.02], mats.metalD, 0, 0.33, 0.27, 'body', [-0.3, 0, 0]);
  pr(shell, [0.3, 0.02, 0.33, 0.02, 0.06], mats.glass, 0, 0.335, 0.3, 'body', [-0.3, 0, 0]);
  blk(shell, 0.18, 0.01, 0.01, mats.lamp, -0.04, 0.355, 0.315, 'body');
  for (const s of [-1, 1]) { blk(shell, 0.02, 0.14, 0.2, mats.grille, s * 0.3, 0.14, -0.02, 'body', [0, 0, s * -0.32]); pr(shell, [0.03, 0.3, 0.03, 0.42, 0.05], mats.trim, s * 0.35, 0.31, 0, 'body', [0, 0, s * -0.32]); }
  rivets(shell, [[-0.2, 0.06, 0.21], [0.2, 0.06, 0.21], [-0.32, 0.38, 0.2], [0.32, 0.38, 0.2]], 'body');
  blk(shell, 0.74, 0.012, 0.012, mats.edge, 0, 0.4, 0.28, 'body'); for (const s of [-1, 1]) blk(shell, 0.012, 0.012, 0.48, mats.edge, s * 0.37, 0.4, 0.03, 'body');
  for (const s of [-1, 1]) { blk(shell, 0.09, 0.05, 0.012, mats.grille, s * 0.12, 0.1, 0.235, 'body'); blk(shell, 0.012, 0.012, 0.012, mats.lamp, s * 0.27, 0.36, 0.27, 'body'); }
  // the backpack: a generator, twin thrusters with a blue glow, fins
  pr(shell, [0.36, 0.14, 0.42, 0.16, 0.32, -0.02], mats.metalD, 0, 0.24, -0.31, 'body');
  for (let k = 0; k < 4; k++) blk(shell, 0.34, 0.015, 0.05, mats.metal, 0, 0.13 + k * 0.06, -0.4, 'body');
  for (const s of [-1, 1]) { cyl(shell, 0.06, 0.16, mats.metal, s * 0.13, 0.1, -0.4, 'body', 'y', 8, 0.045); cyl(shell, 0.045, 0.02, mats.jet, s * 0.13, 0.015, -0.4, 'body', 'y', 8); pr(shell, [0.02, 0.2, 0.02, 0.08, 0.2, -0.05], mats.accent, s * 0.19, 0.48, -0.3, 'body'); }
  // body extras
  if (BD.bulge) { for (const s2 of [-1, 1]) { pr(shell, [0.08, 0.34, 0.1, 0.4, 0.3, 0, s2 * 0.03], mats.paint2, s2 * 0.32, 0.17, 0.02, 'body'); rivets(shell, [[s2 * 0.37, 0.24, 0.17], [s2 * 0.37, 0.1, 0.17]], 'body'); } blk(shell, 0.36, 0.1, 0.04, mats.accent, 0, 0.06, 0.24, 'body'); }
  if (BD.wings) for (const s2 of [-1, 1]) { pr(shell, [0.02, 0.26, 0.02, 0.06, 0.42, -0.22, s2 * 0.18], mats.accent, s2 * 0.16, 0.5, -0.36, 'body', [0, 0, s2 * -0.35]); blk(shell, 0.015, 0.36, 0.015, mats.trim, s2 * 0.24, 0.52, -0.44, 'body', [-0.5, 0, s2 * -0.35]); }
  if (BD.stacks) for (const s2 of [-1, 1]) { cyl(shell, 0.05, 0.34, mats.metalD, s2 * 0.12, 0.56, -0.34, 'body', 'y', 8); cyl(shell, 0.06, 0.04, mats.metal, s2 * 0.12, 0.74, -0.34, 'body', 'y', 8); blk(shell, 0.1, 0.02, 0.02, mats.trim, s2 * 0.12, 0.5, -0.29, 'body'); }
  // ---- the head
  const head = pivot(torso, 0, 0.46 * BD.kh, -0.02);
  let eye, sweep = true;
  if (BD.head === 'twin') { // a boxy helmet with two eyes and a chin vent
    pr(head, [0.23, 0.22, 0.21, 0.2, 0.13], mats.paint, 0, 0.065, 0, 'body');
    blk(head, 0.17, 0.035, 0.02, mats.ink, 0, 0.085, 0.112, 'body');
    eye = blk(head, 0.035, 0.02, 0.02, mats.eye, -0.045, 0.085, 0.12, 'body'); blk(head, 0.035, 0.02, 0.02, mats.eye, 0.045, 0.085, 0.12, 'body');
    blk(head, 0.1, 0.03, 0.02, mats.grille, 0, 0.03, 0.115, 'body'); blk(head, 0.25, 0.02, 0.23, mats.accent, 0, 0.135, 0, 'body');
    for (const s2 of [-1, 1]) cyl(head, 0.008, 0.12, mats.metal, s2 * 0.1, 0.2, -0.05, 'body', 'y', 4);
    sweep = false;
  } else if (BD.head === 'v') { // a narrow pointed head under a V-shaped antenna
    pr(head, [0.17, 0.22, 0.12, 0.14, 0.12, -0.03], mats.paint, 0, 0.06, 0, 'body');
    pr(head, [0.1, 0.06, 0.03, 0.03, 0.08, 0.05], mats.accent, 0, 0.04, 0.12, 'body', [-0.5, 0, 0]);
    blk(head, 0.13, 0.02, 0.02, mats.ink, 0, 0.09, 0.1, 'body'); eye = blk(head, 0.035, 0.018, 0.02, mats.eye, 0, 0.09, 0.108, 'body');
    for (const s2 of [-1, 1]) pr(head, [0.025, 0.02, 0.01, 0.01, 0.2], mats.trim, s2 * 0.05, 0.19, 0.06 + s2 * 0.002, 'body', [0, 0, s2 * -0.6]);
    blk(head, 0.03, 0.03, 0.03, mats.lamp, 0, 0.13, 0.08, 'body');
  } else if (BD.head === 'visor') { // a wide, low helmet with one long visor and two horns
    pr(head, [0.28, 0.24, 0.24, 0.2, 0.11], mats.paint, 0, 0.055, 0, 'body');
    blk(head, 0.24, 0.03, 0.02, mats.ink, 0, 0.07, 0.122, 'body'); eye = blk(head, 0.05, 0.02, 0.02, mats.eye, 0, 0.07, 0.13, 'body');
    for (const s2 of [-1, 1]) pr(head, [0.04, 0.05, 0.015, 0.02, 0.12, 0, s2 * 0.04], mats.trim, s2 * 0.1, 0.16, -0.02, 'body');
    blk(head, 0.3, 0.02, 0.26, mats.accent, 0, 0.0, 0, 'body');
  } else { // a low, sleek head, a sloped faceplate, a sweeping mono-eye, a crest
    pr(head, [0.2, 0.22, 0.15, 0.17, 0.12, -0.02], mats.paint, 0, 0.06, 0, 'body');
    pr(head, [0.16, 0.04, 0.12, 0.03, 0.08, 0.03], mats.accent, 0, 0.05, 0.11, 'body', [-0.35, 0, 0]);
    blk(head, 0.15, 0.025, 0.02, mats.ink, 0, 0.085, 0.112, 'body');
    eye = blk(head, 0.04, 0.022, 0.02, mats.eye, 0, 0.085, 0.12, 'body');
    pr(head, [0.02, 0.18, 0.015, 0.06, 0.1, -0.06], mats.trim, 0, 0.16, -0.02, 'body'); // the crest
    for (const s2 of [-1, 1]) cyl(head, 0.025, 0.04, mats.metal, s2 * 0.11, 0.06, 0.02, 'body', 'x');
    cyl(head, 0.007, 0.22, mats.metal, -0.06, 0.24, -0.06, 'body', 'y', 4); blk(head, 0.025, 0.025, 0.025, mats.lamp, -0.06, 0.35, -0.06, 'body');
  }
  // ---- a missile launcher on the shoulder
  if (u.sh) {
    const L = pivot(torso, -0.24 * BD.kw, 0.5 * BD.kh, -0.12); parts.launcher = L;
    pr(L, [0.26, 0.26, 0.24, 0.22, 0.2, 0.02], mats.metal, 0, 0.1, 0, 'body');
    const fam = ITEM[u.sh]?.fam || 'missile';
    if (fam === 'mortar') { cyl(L, 0.06, 0.42, mats.metalD, 0, 0.3, 0.06, 'body', 'y', 8); cyl(L, 0.075, 0.05, mats.metal, 0, 0.5, 0.06, 'body', 'y', 8); }
    else if (fam === 'aamissile') for (const x of [-0.07, 0.07]) { cyl(L, 0.03, 0.34, mats.paint2, x, 0.22, 0.04, 'body', 'z', 6); blk(L, 0.03, 0.03, 0.03, mats.lamp, x, 0.22, 0.22, 'body'); }
    else {
      const [nx, ny, r] = fam === 'cluster' ? [4, 3, 0.022] : fam === 'rocket' ? [3, 2, 0.032] : fam === 'hmissile' ? [2, 1, 0.06] : [2, 2, 0.034];
      for (let k = 0; k < nx; k++) for (let j = 0; j < ny; j++) cyl(L, r, 0.02, mats.ink, nx > 1 ? -0.08 + k * (0.16 / (nx - 1)) : 0, ny > 1 ? 0.04 + j * (0.12 / (ny - 1)) : 0.1, 0.13, 'body', 'z', 6);
    }
    blk(L, 0.22, 0.02, 0.02, mats.trim, 0, 0.19, 0.12, 'body'); blk(L, 0.05, 0.12, 0.05, mats.metalD, 0.08, -0.04, 0.02, 'body');
  }
  // ---- arms: angular pauldrons with forward fins, a joint, a bare upper arm, an elbow, a gauntlet, fingers
  const arm = (side, part, slot) => {
    const AR = ARM[ITEM[u[part]]?.look || u[part]] || ARM.A1;
    const sh = pivot(torso, side * (0.42 * BD.kw + (AR.k - 1) * 0.2), 0.33 * BD.kh, 0); sh.scale.setScalar(AR.k);
    cyl(sh, 0.07, 0.1, mats.metalD, -side * 0.03, 0, 0, part, 'x');
    if (AR.look === 'round') { cyl(sh, 0.19, 0.4, mats.paint, side * 0.06, 0.05, 0, part, 'z', 10); blk(sh, 0.04, 0.05, 0.42, mats.trim, side * 0.24, 0.05, 0, part); }
    else pr(sh, [0.3, 0.42, 0.22, 0.34, 0.2, 0, side * 0.04], mats.paint, side * 0.06, 0.06, 0, part); // pauldron, sloping outwards
    if (AR.look === 'spike') pr(sh, [0.05, 0.16, 0.01, 0.02, 0.32, 0.1], mats.trim, side * 0.1, 0.26, 0.06, part, [0.35, 0, side * -0.4]); // a long swept spike
    else if (AR.look !== 'round') pr(sh, [0.04, 0.12, 0.02, 0.02, 0.16, 0.06], mats.paint2, side * 0.1, 0.2, 0.12, part, [0.5, 0, side * -0.3]); // the forward fin
    if (AR.look === 'heavy') { pr(sh, [0.34, 0.44, 0.26, 0.36, 0.08, 0, side * 0.03], mats.accent, side * 0.07, 0.2, 0, part); rivets(sh, [[side * 0.2, 0.21, 0.1], [side * 0.2, 0.21, -0.1], [side * 0.2, 0.21, 0]], part); }
    pr(sh, [0.32, 0.39, 0.32, 0.39, 0.04], mats.accent, side * 0.06, -0.06, 0, part); // the rim beneath
    blk(sh, 0.02, 0.05, 0.32, mats.trim, side * 0.205, 0.07, 0, part, [0, 0, side * -0.2]);
    rivets(sh, [[side * 0.18, 0.1, 0.15], [side * 0.18, 0.1, -0.15]], part);
    if (AR.look !== 'round') { put(sh, new THREE.PlaneGeometry(0.13, 0.065), mats.decal, side * 0.216, -0.005, 0.02, part, [0, side * Math.PI / 2, 0]).castShadow = false; blk(sh, 0.24, 0.012, 0.012, mats.edge, side * 0.08, 0.16, 0.17, part); }
    else put(sh, new THREE.PlaneGeometry(0.13, 0.065), mats.decal, side * 0.252, -0.005, 0.02, part, [0, side * Math.PI / 2, 0]).castShadow = false;
    const up = pivot(sh, 0, -0.06, 0);
    cyl(up, 0.05, 0.16, mats.metal, 0, -0.09, 0, part); cyl(up, 0.014, 0.14, mats.metalD, side * 0.04, -0.09, 0.04, part, 'y', 4);
    const el = pivot(up, 0, -0.18, 0);
    cyl(el, 0.065, 0.13, mats.metalD, 0, 0, 0, part, 'x');
    pr(el, [0.2, 0.21, 0.15, 0.16, 0.26], mats.paint, 0, -0.14, 0.005, part, [Math.PI, 0, 0]); // the gauntlet, wider at the wrist
    pr(el, [0.03, 0.22, 0.02, 0.05, 0.22, 0.06], mats.paint2, side * 0.1, -0.12, 0, part, [Math.PI, 0, 0]); // a blade fin on the outside
    blk(el, 0.2, 0.015, 0.21, mats.accent, 0, -0.04, 0.005, part);
    blk(el, 0.11, 0.07, 0.11, mats.metal, 0, -0.3, 0, part);
    blk(el, 0.17, 0.012, 0.012, mats.edge, 0, -0.27, 0.085, part); cyl(el, 0.014, 0.18, mats.metal, -side * 0.08, -0.14, -0.06, part, 'y', 6); cyl(el, 0.022, 0.06, mats.metalD, -side * 0.08, -0.06, -0.06, part, 'y', 6);
    for (let k = -1; k <= 1; k++) blk(el, 0.025, 0.055, 0.03, mats.metalD, k * 0.04, -0.348, 0.033, part);
    // the weapon lies along the forearm: down when the arm hangs, forward when it is raised
    const w = u[slot] && ITEM[u[slot]];
    if (w) {
      const hand = pivot(el, 0, -0.3, 0);
      const fam = w.fam || 'mg';
      let len = 0.3;
      if (w.cat === 'shield') { const k = fam === 'shieldH' ? 1.15 : 1; pr(hand, [0.05, 0.34 * k, 0.05, 0.26 * k, 0.52 * k], mats.metalD, side * 0.12, 0.1, 0.02, part); blk(hand, 0.01, 0.42 * k, 0.04, mats.trim, side * 0.15, 0.1, 0.1, part); rivets(hand, [[side * 0.15, 0.32, -0.1], [side * 0.15, -0.12, -0.1], [side * 0.15, 0.32, 0.12]], part); }
      else if (w.cat === 'melee') {
        if (fam === 'knuckle') { pr(hand, [0.17, 0.17, 0.15, 0.15, 0.12], mats.metal, 0, -0.06, 0, part); for (let k = -1; k <= 1; k++) pr(hand, [0.03, 0.04, 0.01, 0.01, 0.06], mats.metalD, k * 0.05, -0.12, 0.06, part, [Math.PI, 0, 0]); }
        else if (fam === 'pile') { blk(hand, 0.1, 0.1, 0.42, mats.metalD, 0, -0.02, 0.14, part); blk(hand, 0.11, 0.03, 0.2, mats.trim, 0, 0.04, 0.1, part); cyl(hand, 0.03, 0.3, mats.metal, 0, -0.02, 0.48, part, 'z', 6); cyl(hand, 0.012, 0.06, mats.metal, 0, -0.02, 0.66, part, 'z', 4, 0.03); }
        else if (fam === 'blade') { cyl(hand, 0.022, 0.18, mats.metalD, 0, 0, 0.06, part, 'z', 6); blk(hand, 0.06, 0.03, 0.04, mats.trim, 0, 0, 0.16, part); pr(hand, [0.015, 0.07, 0.008, 0.04, 0.5], mats.metal, 0, 0, 0.42, part, [Math.PI / 2, 0, 0]); blk(hand, 0.018, 0.012, 0.46, mats.edge, 0, 0.034, 0.42, part); }
        else {
          cyl(hand, 0.025, 0.56, mats.metal, 0, 0, 0.2, part, 'z', 6);
          if (fam === 'axe') { pr(hand, [0.03, 0.08, 0.03, 0.2, 0.22], mats.metal, 0, 0.08, 0.43, part); blk(hand, 0.042, 0.228, 0.02, mats.lamp, 0, 0.08, 0.535, part); }
          else if (fam === 'hammer') { blk(hand, 0.13, 0.14, 0.22, mats.metalD, 0, 0, 0.47, part); blk(hand, 0.14, 0.03, 0.02, mats.trim, 0, 0.04, 0.47, part); }
          else cyl(hand, 0.04, 0.14, mats.jet, 0, 0, 0.47, part, 'z', 6); // shock rod
        }
      } else {
        // guns: a grip and body in the hand, the barrel along the forearm, and what marks each kind
        const G = { mg: [0.42, 0.025], smg: [0.26, 0.022], hmg: [0.46, 0.035], rifle: [0.52, 0.025], sniper: [0.66, 0.025], amr: [0.72, 0.035], rail: [0.6, 0.02], shotgun: [0.32, 0.035], bazooka: [0.5, 0.055], grenade: [0.28, 0.045], flamer: [0.3, 0.03] }[fam] || [0.42, 0.025];
        len = G[0]; const th = G[1];
        pr(hand, [0.09, 0.13, 0.08, 0.1, 0.22], mats.metalD, 0, -0.06, 0, part);
        cyl(hand, th, len, fam === 'bazooka' ? mats.paint2 : mats.metal, 0, -0.08 - len / 2, 0.02, part, 'y', fam === 'bazooka' ? 10 : 6);
        cyl(hand, th * (fam === 'bazooka' ? 1.25 : 1.7), 0.06, mats.metalD, 0, -0.08 - len + 0.03, 0.02, part, 'y', 8);
        if (fam === 'mg' || fam === 'hmg') cyl(hand, 0.07, 0.05, mats.metalD, 0.06, -0.05, 0.05, part, 'x', 8);
        else if (fam === 'grenade') cyl(hand, 0.08, 0.08, mats.metalD, 0, -0.1, 0.07, part, 'y', 8);
        else if (fam === 'flamer') { cyl(hand, 0.05, 0.2, mats.trim, -side * 0.08, -0.12, -0.02, part, 'y', 8); blk(hand, 0.02, 0.02, 0.02, mats.lamp, 0, -0.08 - len, 0.06, part); }
        else if (fam === 'rail') { for (const x of [-0.03, 0.03]) blk(hand, 0.012, len, 0.03, mats.metalD, x, -0.08 - len / 2, 0.02, part); blk(hand, 0.03, len * 0.6, 0.012, mats.jet, 0, -0.08 - len * 0.45, 0.045, part); }
        else if (fam !== 'bazooka') blk(hand, 0.05, 0.08, 0.1, mats.metalD, 0, -0.04, 0.1, part);
        if (['rifle', 'sniper', 'amr'].includes(fam)) { cyl(hand, 0.022, 0.14, mats.metal, 0, -0.107, -0.063, part, 'y', 8); blk(hand, 0.02, 0.02, 0.02, mats.glass, 0, -0.17, -0.06, part); }
        if (fam === 'shotgun') blk(hand, 0.06, 0.08, 0.06, mats.accent, 0, -0.2, 0.05, part);
        if (fam === 'hmg') blk(hand, 0.012, 0.12, 0.14, mats.paint2, 0, -0.16, 0.1, part);
      }
      parts['muzzle' + slot] = pivot(hand, 0, -0.12 - len, 0.02);
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
      for (let k = -4; k <= 4; k++) blk(tr, 0.214, 0.04, 0.08, mats.metal, s * 0.3, 0.025, k * 0.1, 'legs');
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
      const LG = LEG[ITEM[u.legs]?.look || u.legs] || LEG.L1;
      const hip = pivot(group, side * 0.15 * LG.kx, 0.42, 0); hip.scale.x = LG.kx;
      cyl(hip, 0.06, 0.1, mats.metalD, 0, 0, 0, 'legs', 'x');
      cyl(hip, 0.055, 0.22, mats.metal, 0, -0.12, 0, 'legs');
      pr(hip, [0.08, 0.14, 0.06, 0.18, 0.22, 0, side * 0.02], mats.paint2, side * 0.06, -0.1, 0.01, 'legs'); // thigh armour
      cyl(hip, 0.013, 0.2, mats.metalD, 0, -0.11, 0.07, 'legs', 'y', 4); cyl(hip, 0.02, 0.1, mats.metal, 0, -0.06, -0.07, 'legs', 'y', 6); cyl(hip, 0.012, 0.12, mats.metalD, 0, -0.16, -0.07, 'legs', 'y', 6);
      const knee = pivot(hip, 0, -0.24, 0);
      cyl(knee, 0.06, 0.18, mats.metalD, 0, 0, 0, 'legs', 'x');
      pr(knee, [0.19, 0.22, 0.25, 0.28, 0.33], mats.paint, 0, -0.16, 0.01, 'legs', [Math.PI, 0, 0]); // the greave, broad at the top
      pr(knee, [0.05, 0.03, 0.08, 0.05, 0.28, 0.01], mats.paint2, 0, -0.15, 0.15, 'legs', [Math.PI, 0, 0]); // a ridge down the front
      pr(knee, [0.16, 0.12, 0.06, 0.02, 0.16, 0.08], mats.accent, 0, 0.04, 0.13, 'legs', [0.2, 0, 0]); // the knee spike
      blk(knee, 0.26, 0.015, 0.29, mats.accent, 0, -0.06, 0.01, 'legs');
      rivets(knee, [[0.09, -0.08, 0.14], [-0.09, -0.08, 0.14]], 'legs');
      if (LG.look === 'heavy') { pr(knee, [0.05, 0.22, 0.06, 0.26, 0.26], mats.accent, side * 0.15, -0.16, 0.01, 'legs'); blk(knee, 0.3, 0.04, 0.32, mats.paint2, 0, -0.29, 0.01, 'legs'); }
      if (LG.look === 'fin') { pr(knee, [0.03, 0.18, 0.015, 0.04, 0.26, -0.14], mats.paint2, 0, -0.08, -0.16, 'legs', [0.6, 0, 0]); blk(knee, 0.015, 0.2, 0.015, mats.trim, 0, -0.14, 0.17, 'legs'); }
      cyl(knee, 0.026, 0.14, mats.metalD, 0, -0.1, -0.16, 'legs', 'y', 6); cyl(knee, 0.014, 0.12, mats.metal, 0, -0.22, -0.15, 'legs', 'y', 6);
      pr(knee, [0.16, 0.04, 0.12, 0.03, 0.08, 0.02], mats.accent, 0, -0.29, 0.13, 'legs', [0.25, 0, 0]); blk(knee, 0.2, 0.012, 0.012, mats.edge, 0, -0.03, 0.16, 'legs');
      const ank = pivot(knee, 0, -0.32, 0);
      cyl(ank, 0.045, 0.16, mats.metalD, 0, 0, 0, 'legs', 'x');
      pr(ank, [0.26, 0.3, 0.22, 0.26, 0.08], mats.metalD, 0, -0.04, 0.02, 'legs'); // the sole
      for (const s of [-1, 1]) pr(ank, [0.09, 0.14, 0.06, 0.08, 0.07, 0.04], mats.metal, s * 0.065, -0.035, 0.22, 'legs'); // two toe claws
      pr(ank, [0.12, 0.1, 0.08, 0.04, 0.1, -0.04], mats.metal, 0, -0.02, -0.16, 'legs'); // the heel spur
      return { hip, knee, ank };
    };
    legL = leg(-1); legR = leg(1);
  }
  return finish(K, { hips, torso, head, eye, sweep, armR, armL, legL, legR, legsType: legs });
}

// ---- the end of every build: the depth fix, a health bar, a commander's star, a marker over the selected machine
export function finish(K, extra) {
  const { u, mats, group, hit, parts } = K, top = extra.top ?? 1.4;
  // many small parts sit flush on bigger ones; two faces in the same plane flicker as the GPU flips between them.
  // Push every part's faces out by a hair, a little more for each part added after it, smaller parts more (details
  // are smaller than what they sit on), so the detail always wins.
  hit.forEach((mesh, i) => { const g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); const sz = g.boundingBox.getSize(new THREE.Vector3()), big = Math.max(sz.x, sz.y, sz.z), e = 0.001 + 0.007 * (1 - Math.min(1, big / 0.7)) + i * 0.00004; mesh.scale.set(1 + e / Math.max(0.01, sz.x), 1 + e / Math.max(0.01, sz.y), 1 + e / Math.max(0.01, sz.z)); });
  const barC = document.createElement('canvas'); barC.width = 20; barC.height = 5;
  const barT = new THREE.CanvasTexture(barC); barT.magFilter = barT.minFilter = THREE.NearestFilter; barT.generateMipmaps = false;
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false })); bar.scale.set(0.5, 0.125, 1); bar.position.y = top; bar.renderOrder = 9; group.add(bar);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd23a', depthTest: false })); star.scale.set(0.12, 0.12, 1); star.position.y = top + 0.16; star.visible = !!u.boss; star.renderOrder = 9; group.add(star);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffe14a', depthTest: false })); mark.scale.set(0.12, 0.16, 1); mark.position.y = top + 0.3; mark.visible = false; mark.renderOrder = 9; group.add(mark);
  let lastBar = -1, lastAlpha = 1, lastDim = false;
  return {
    group, hit, parts, mats, bar, star, mark, ...extra,
    fade(a) { if (a === lastAlpha) return; const was = lastAlpha < 1; lastAlpha = a; for (const k in mats) { mats[k].opacity = a; if (was !== a < 1) { mats[k].transparent = a < 1; mats[k].needsUpdate = true; } } },
    // a machine that has acted is shown dimmed, not see-through
    dim(on) { if (on === lastDim) return; lastDim = on; for (const k in mats) { const mt = mats[k]; if (!mt.color) continue; if (!mt.userData.base) mt.userData.base = mt.color.clone(); mt.color.copy(mt.userData.base); if (on) mt.color.multiplyScalar(0.55); } },
    bars(u2, sel, t) {
      const k = Math.max(0, u2.hp.body) / u2.max.body, key = Math.round(k * 18);
      if (key !== lastBar) { lastBar = key; const g = barC.getContext('2d'); g.fillStyle = '#100e0a'; g.fillRect(0, 0, 20, 5); g.fillStyle = '#3a3a30'; g.fillRect(1, 1, 18, 3); g.fillStyle = k > 0.5 ? '#9ac850' : k > 0.25 ? '#e0b030' : '#e04a30'; g.fillRect(1, 1, Math.max(1, key), 3); barT.needsUpdate = true; }
      mark.visible = sel; mark.position.y = top + 0.3 + (Math.floor(t * 4) % 2) * 0.04; bar.visible = u2.hp.body > 0;
    },
    // a part flashes white while it is being hit
    flash(part, on, dead) { for (const mesh of parts[part] || []) mesh.material = on ? mats.white : dead ? mats.dead : mesh.userData.mat; },
  };
}

// pose: { phase, walk, aim, recoil, muzzle, flinch, t } and, in the battle scene, a fighting stance:
// stance (0-1: one foot forward, knees bent), sway (-1..1: weight shifting), lean (+ forward), twist (shoulders), guard (0-1: arms up),
// and for hits and moves: crouch (0-1: knees give), kickL/kickR (an arm knocked back), headKick, roll (sideways), armL/armR ({s, e}: set the arm)
export function poseMech(m, u, pose) {
  if (m.vehicle) return poseVehicle(m, u, pose);
  const w = pose.walk || 0, ph = pose.phase || 0, aim = pose.aim || 0, t = pose.t || 0;
  // broken parts go dark; a destroyed arm is gone
  for (const part of ['body', 'armL', 'armR', 'legs']) { const dead = u.hp[part] <= 0; if (m['dead' + part] === dead) continue; m['dead' + part] = dead; for (const mesh of m.parts[part] || []) mesh.material = dead ? m.mats.dead : mesh.userData.mat; }
  for (const a of [m.armR, m.armL]) a.sh.visible = u.hp[a.part] > 0;
  // legs: the same stride as the sprites; the hips ride as high as the straighter leg
  const lame = u.hp.legs <= 0 ? 0.35 : 1;
  const leg = (p) => { const th = 0.55 * Math.sin(p) * w * lame, bend = 0.15 + 1.05 * w * lame * Math.max(0, Math.cos(p)); return { th, bend }; };
  const breathe = Math.sin(t * 2.2) * 0.006 * (1 - w), st = (pose.stance || 0) * (w < 0.5 ? 1 : 0), sway = pose.sway || 0;
  if (m.legL) {
    const a = leg(ph + Math.PI), b = leg(ph), H = (l) => Math.cos(l.th) * 0.24 + Math.cos(l.th - l.bend) * 0.32 + 0.08;
    let hipY = Math.max(H(a), H(b)) + 0.02 + breathe;
    if (st > 0) {
      // standing to fight: the left foot forward, the right one back, both knees bent to the same lowered hip height,
      // each shin solved so its foot stays flat on the ground
      a.th += 0.17 * st + sway * 0.03; b.th -= 0.13 * st - sway * 0.03;
      hipY = Math.min(Math.cos(a.th) * 0.24, Math.cos(b.th) * 0.24) + 0.32 * Math.cos(0.2 * st) + 0.08 + 0.02 + breathe * 2 - Math.min(1, pose.crouch || 0) * 0.13;
      for (const l of [a, b]) l.bend = l.th + Math.acos(Math.max(-1, Math.min(1, (hipY - 0.02 - 0.08 - Math.cos(l.th) * 0.24) / 0.32)));
    }
    for (const [L, l] of [[m.legL, a], [m.legR, b]]) { L.hip.position.y = hipY; L.hip.rotation.x = -l.th; L.knee.rotation.x = l.bend; L.ank.rotation.x = l.th - l.bend; }
    m.hips.position.y = hipY;
  } else if (m.legsType.hover) m.hips.position.y = 0.44 + Math.sin(t * 4) * 0.015;
  m.hips.position.x = sway * 0.025 * st; m.hips.rotation.z = -sway * 0.03 * st;
  m.torso.rotation.x = w * 0.08 * (1 - st) + (pose.lean || 0) - (pose.recoil || 0) * 0.03;
  m.torso.rotation.y = pose.twist || 0; m.torso.rotation.z = sway * 0.05 * st + (pose.roll || 0);
  m.torso.position.x = (pose.flinch || 0) * 0.03;
  m.head.rotation.y = (pose.look || 0) + Math.sin(t * 0.7) * 0.12 * st * (1 - aim);
  m.head.rotation.x = -(pose.headKick || 0) * 0.45; m.head.rotation.z = (pose.headKick || 0) * 0.2 * Math.sign(pose.roll || 1);
  // arms swing against the legs; the right arm comes up to aim
  const sw = 0.45 * w;
  const restR = { s: -(0.1 + Math.sin(ph + Math.PI) * sw), e: -(0.6 + Math.sin(ph + Math.PI) * sw * 1.3) }, restL = { s: -(0.1 + Math.sin(ph) * sw), e: -(0.6 + Math.sin(ph) * sw * 1.3) };
  const aimS = -(Math.PI / 2) + (pose.recoil || 0) * 0.18;
  // on guard the gun arm is half raised and the other arm comes up in front
  const gd = Math.max(st * 0.35, pose.guard || 0), aR = Math.max(aim, gd * 0.55), gL = Math.max(st * 0.5, pose.guard || 0);
  m.armR.up.rotation.x = restR.s * (1 - aR) + aimS * aR; m.armR.el.rotation.x = restR.e * (1 - aR);
  m.armL.up.rotation.x = restL.s * (1 - gL) - 0.55 * gL + Math.sin(t * 1.9) * 0.03 * st; m.armL.el.rotation.x = restL.e * (1 - gL) - 1.2 * gL;
  if (pose.swing != null) { const A = pose.swingL ? m.armL : m.armR; A.up.rotation.x = pose.swing; A.el.rotation.x = -0.3; } // a melee blow, with whichever arm holds the weapon
  if (pose.armR) { m.armR.up.rotation.x = pose.armR.s; m.armR.el.rotation.x = pose.armR.e; }
  if (pose.armL) { m.armL.up.rotation.x = pose.armL.s; m.armL.el.rotation.x = pose.armL.e; }
  // the wrists turn a melee weapon along the blow
  for (const k of ['wL', 'wR']) { const hd = m.parts['hand' + k]; if (hd) hd.rotation.x = pose['wrist' + k[1]] || 0; }
  // an arm that is hit is thrown back and out
  for (const [A, k, side] of [[m.armR, pose.kickR || 0, 1], [m.armL, pose.kickL || 0, -1]]) { A.up.rotation.x += k; A.sh.rotation.z = side * k * 0.35; }
  // the muzzle flash; the mono-eye sweeps from side to side
  const mz = m.parts.muzzlewR;
  if (mz) { if (!mz.flash) { mz.flash = new THREE.Mesh(prism(0.1, 0.1, 0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#ffd060' })); mz.add(mz.flash); } mz.flash.visible = !!pose.muzzle; mz.flash.rotation.set(t * 9, t * 7, 0); mz.flash.scale.setScalar(0.7 + ((t * 37) % 1) * 0.6); }
  if (m.sweep) m.eye.position.x = Math.sin(t * 1.6) * 0.045;
  m.mats.eye.color.set(Math.floor(t * 2) % 2 ? '#ff4a30' : '#ff7a50');
}
