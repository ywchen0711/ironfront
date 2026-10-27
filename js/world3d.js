// The battlefield in 3D, in the same pixel-art look: the scene is rendered at a fraction of the screen's resolution
// and blown up without smoothing; every surface wears a little pixel texture painted from the 2D palettes; the light
// falls in a few hard bands (toon shading) and casts hard-edged shadows. The camera can turn all the way round,
// tilt, zoom and pan.
//   load(B)        build the scene for a battle
//   render(...)    draw a frame (units, highlights, labels)
//   pick(x, y)     the square under a point on the screen
import * as THREE from './lib/three.module.min.js';
import { P, hash, pickPal, shade, pine, crates, wreck } from './render.js?v=16';
import { alive } from './rules.js?v=16';
import { buildMech, poseMech } from './mech3d.js?v=16';
import { mapPose } from './render.js?v=16';

const HEIGHT = { d: 0.12, '.': 0.12, ',': 0.12, r: 0.1, f: 0.14, x: 0.14, c: 0.14, h: 0.45, H: 0.78, '#': 0.62, b: 1.75, w: -0.05 };
export const heightOf = (c) => HEIGHT[c] ?? 0.12;
const BASE = -0.35; // the bottom of every block

let renderer, scene, camera, root, sun, glCanvas, PX = 3, VW = 1, VH = 1;
const cam = { target: new THREE.Vector3(), theta: Math.PI / 4, phi: 0.62, zoom: 1, want: null };
let B = null, tiles = [], mechs = new Map(), hlPool = [], labelSprites = [], cursorMesh = null;
const toon = (() => { const d = new Uint8Array([70, 130, 190, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const TOON = toon;

// ---------------------------------------------------------------- setup
export function init(canvas) {
  glCanvas = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#100e0c');
  camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 5, 90); // a tight depth range: more depth precision
  scene.add(new THREE.HemisphereLight('#d8d0bc', '#3a3228', 1.5));
  sun = new THREE.DirectionalLight('#fff0d4', 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
}
// the battle scene borrows the same renderer
export function renderWith(scn, cmr) { renderer.render(scn, cmr); }
export const viewSize = () => ({ w: renderer.domElement.width, h: renderer.domElement.height });
export function resize(w, h, px) {
  VW = w; VH = h; PX = px;
  renderer.setSize(Math.max(1, Math.ceil(w / px)), Math.max(1, Math.ceil(h / px)), false);
  glCanvas.style.width = w + 'px'; glCanvas.style.height = h + 'px';
}

// ---------------------------------------------------------------- pixel textures for the squares
function tex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g, w, h);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texCache = new Map();
const cached = (key, make) => { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); };
function fillNoise(g, w, h, pal, seed, f) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = hash((x >> 1) + seed * 31, (y >> 1) + seed * 17, seed); g.fillStyle = (f && f(x, y)) || (v > 0.9 ? pal[1] : v > 0.84 ? pal[2] : pal[0]); g.fillRect(x, y, 1, 1); } }
function topTex(ch, v, along) {
  return cached(`t${ch}${v}${along}`, () => tex(16, 16, (g) => {
    if (ch === '.') fillNoise(g, 16, 16, P.grass, v);
    else if (ch === ',') fillNoise(g, 16, 16, P.conc, v, (x, y) => (x === 15 || y === 15 ? '#4a443a' : null));
    else if (ch === 'r') fillNoise(g, 16, 16, P.asph, v, (x, y) => ((along === 'x' && y >= 7 && y <= 8 && x % 8 < 4) || (along === 'y' && x >= 7 && x <= 8 && y % 8 < 4) ? '#8a7a3a' : null));
    else if (ch === 'f') fillNoise(g, 16, 16, P.forest, v);
    else if (ch === 'x') fillNoise(g, 16, 16, P.rubble, v);
    else if (ch === 'c') fillNoise(g, 16, 16, P.snow, v);
    else if (ch === 'd') fillNoise(g, 16, 16, P.sand, v);
    else if (ch === 'w') fillNoise(g, 16, 16, P.water, v, (x, y) => (hash(x, y, v + 9) > 0.93 ? '#4a7484' : null));
    else if (ch === 'h') fillNoise(g, 16, 16, P.grass, v);
    else if (ch === 'H') fillNoise(g, 16, 16, P.dirt.concat(P.grass.slice(0, 2)), v);
    else if (ch === '#') fillNoise(g, 16, 16, P.wallTop, v, (x, y) => (x === 0 || y === 0 ? '#a8a296' : null));
    else if (ch === 'b') { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x >> 1) % 2 ? P.roof[1] : hash(x, y, v) > 0.9 ? '#6a341f' : P.roof[0]; g.fillRect(x, y, 1, 1); } g.fillStyle = P.roofEdge; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); }
    else fillNoise(g, 16, 16, P.grass, v);
    // a few marks: oil stains on concrete, cracks in asphalt
    if (ch === ',' && hash(v, 3) < 0.4) { g.fillStyle = '#2e2a26'; g.fillRect(4 + v % 5, 6, 5, 3); g.fillRect(5 + v % 5, 5, 3, 5); }
    if (ch === 'r' && hash(v, 4) < 0.3) { g.fillStyle = '#2e2a26'; for (let k = 0; k < 6; k++) g.fillRect(3 + k, 10 + (k % 2), 1, 1); }
  }));
}
function sideTex(ch, v, hu) {
  const hpx = Math.max(4, Math.round(hu * 16));
  return cached(`s${ch}${v}${hpx}`, () => tex(16, hpx, (g, w, h) => {
    if (ch === 'b') {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { g.fillStyle = y < 3 ? '#5a2c1c' : y > h - 2 ? '#14100c' : (x >> 1) % 2 ? P.wallA[0] : P.wallA[1]; g.fillRect(x, y, 1, 1); }
      if (v % 3 === 0) { g.fillStyle = '#2a2018'; g.fillRect(4, h - 12, 8, 11); g.fillStyle = '#5a2c1c'; g.fillRect(3, h - 13, 10, 1); g.fillRect(3, h - 13, 1, 12); g.fillRect(12, h - 13, 1, 12); }
      else if (v % 3 === 1) { g.fillStyle = '#3a2a1a'; g.fillRect(2, 7, 12, 3); }
    } else if (ch === '#') { fillNoise(g, w, h, P.wallSide, v, (x, y) => (y === h - 1 ? '#1a1612' : x % 6 === 0 ? '#4a463e' : null)); g.fillStyle = '#c8a040'; g.fillRect(3, h - 5, 2, 2); }
    else if (ch === 'h' || ch === 'H') fillNoise(g, w, h, P.dirt, v, (x, y) => (y === h - 1 ? '#1a1612' : null));
    else if (ch === 'w') fillNoise(g, w, h, ['#16262e', '#1a2c34'], v);
    else if (ch === 'c') fillNoise(g, w, h, P.snow.map((c) => shade(c, 0.82)), v);
    else fillNoise(g, w, h, (ch === ',' ? P.conc : ch === 'r' ? P.asph : ch === 'd' ? P.sand : P.dirt).map((c) => shade(c, 0.7)), v, (x, y) => (y === h - 1 ? '#1a1612' : null));
  }));
}
const mat = (map) => new THREE.MeshToonMaterial({ map, gradientMap: toon });
// a picture (pine, crates, wreck) as a sprite that always faces the camera
function spriteOf(key, w, h, paint, scale) {
  const t = cached('p' + key, () => tex(w, h, paint));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.5 }));
  s.scale.set(w * scale, h * scale, 1); s.center.set(0.5, 0);
  return s;
}

// ---------------------------------------------------------------- the scene for one battle
export function load(battle) {
  B = battle;
  if (root) { scene.remove(root); root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  root = new THREE.Group(); scene.add(root); tiles = []; mechs.clear(); hlPool = []; labelSprites = [];
  const map = B.map, H = map.length, W = map[0].length, at = (x, y) => map[y]?.[x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = map[y][x], h = heightOf(ch), v = Math.floor(hash(x, y, 1) * 6);
    const along = ch === 'r' ? ((at(x + 1, y) === 'r' || at(x - 1, y) === 'r') && !(at(x, y + 1) === 'r' || at(x, y - 1) === 'r') ? 'x' : (at(x, y + 1) === 'r' || at(x, y - 1) === 'r') && !(at(x + 1, y) === 'r' || at(x - 1, y) === 'r') ? 'y' : '') : '';
    const side = mat(sideTex(ch, v, h - BASE)), top = mat(topTex(ch, v, along));
    const geo = new THREE.BoxGeometry(1, h - BASE, 1);
    const m = new THREE.Mesh(geo, [side, side, top, side, side, side]);
    m.position.set(x, (h + BASE) / 2, y); m.castShadow = ch === 'b' || ch === '#' || ch === 'H' || ch === 'h'; m.receiveShadow = true;
    m.userData = { x, y }; root.add(m); tiles.push(m);
    // what stands on the square
    const r = (k) => hash(x, y, 50 + k);
    if (ch === 'f' || (ch === 'c' && r(12) < 0.25)) for (let k = 0; k < (ch === 'f' ? 3 : 1); k++) { const s = spriteOf('pine' + (ch === 'c') + (k % 2), 20, 30, (g) => pine(g, 10, 28, 20 + (k % 2) * 4, ch === 'c'), 0.045); s.position.set(x + (r(k) - 0.5) * 0.6, h, y + (r(k + 5) - 0.5) * 0.6); root.add(s); }
    if (ch === 'x') { const s = spriteOf('wreck', 16, 10, (g) => wreck(g, 8, 9), 0.05); s.position.set(x, h, y); root.add(s); }
    if (ch === ',' && r(5) < 0.18) { const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), mat(cached('crate', () => tex(8, 8, (g) => { g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#5e4626'; g.fillRect(0, 0, 8, 1); g.fillRect(0, 7, 8, 1); g.fillRect(0, 0, 1, 8); g.fillRect(7, 0, 1, 8); g.fillRect(3, 0, 2, 8); g.fillStyle = '#a8824a'; g.fillRect(1, 1, 2, 1); })))); box.position.set(x + (r(6) - 0.5) * 0.5, h + 0.11, y + (r(7) - 0.5) * 0.5); box.rotation.y = r(8) * 3; box.castShadow = true; box.receiveShadow = true; root.add(box); }
    if (ch === '.' && r(9) < 0.07) { const pole = new THREE.Group(), pm = new THREE.MeshToonMaterial({ color: '#8a8478', gradientMap: toon }); const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), pm), b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), pm); a.position.y = 0.65; b.position.y = 1.22; pole.add(a, b); pole.position.set(x + 0.3, h, y - 0.3); a.castShadow = true; root.add(pole); }
  }
  // the shadow camera covers the whole map
  const span = Math.max(W, H) * 0.8 + 2;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(W / 2 - 10, 18, H / 2 - 6); sun.target.position.set(W / 2, 0, H / 2);
  // highlights and the cursor
  const hlMat = (col) => new THREE.MeshBasicMaterial({ map: cached('hl', () => tex(8, 8, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0 || x === 0 || y === 0 || x === 7 || y === 7) { g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); } })), color: col, transparent: true, opacity: 0.6, depthWrite: false });
  B.hlMats = { move: hlMat('#3a7aff'), att: hlMat('#ff4a2a'), range: hlMat('#ffb040'), peek: hlMat('#ff7a5a'), zone: hlMat('#3ae0a0'), obj: hlMat('#ffe14a') };
  cursorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cached('cur', () => tex(16, 16, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); })), color: '#ffe14a', transparent: true, depthWrite: false }));
  cursorMesh.rotation.x = -Math.PI / 2; cursorMesh.visible = false; root.add(cursorMesh);
  // start looking at the squad from the classic angle
  const ps = B.units.filter((u) => u.side === 'p');
  cam.target.set(ps.reduce((s, u) => s + u.x, 0) / ps.length + 2, 0, ps.reduce((s, u) => s + u.y, 0) / ps.length - 2);
  cam.theta = Math.PI / 4; cam.phi = 0.62; cam.zoom = VW < 700 ? 1.75 : 1.65;
  // everyone faces the other side to begin with
  const cen = (side) => { const us = B.units.filter((u) => u.side === side); return [us.reduce((s, u) => s + u.x, 0) / us.length, us.reduce((s, u) => s + u.y, 0) / us.length]; };
  const [px, py] = cen('p'), [ex, ey] = cen('e');
  for (const u of B.units) { const [tx, ty] = u.side === 'p' ? [ex, ey] : [px, py]; u.dir = Math.atan2(tx - u.x, ty - u.y); }
}
const tileH = (x, y) => heightOf(B.map[y][x]);

// ---------------------------------------------------------------- the camera
export const camera3d = cam;
export function rotate(dt, dp = 0) { cam.theta += dt; cam.phi = Math.max(0.3, Math.min(1.05, cam.phi + dp)); }
export function snap(step) { cam.want = { theta: Math.round((cam.theta + step) / (Math.PI / 4)) * (Math.PI / 4) }; }
export function zoomBy(f) { cam.zoom = Math.max(0.45, Math.min(3, cam.zoom * f)); }
// move the point we look at by a drag of (dx, dy) screen pixels
export function pan(dx, dy) {
  const s = (12 / cam.zoom) / VH, right = new THREE.Vector3(Math.cos(cam.theta), 0, -Math.sin(cam.theta)), fwd = new THREE.Vector3(Math.sin(cam.theta), 0, Math.cos(cam.theta));
  cam.target.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s / Math.sin(cam.phi));
}
export function focus(x, y) { cam.want = { ...(cam.want || {}), x, y }; }
function placeCamera(dt) {
  if (cam.want) {
    const k = Math.min(1, dt * 6);
    if (cam.want.theta != null) { cam.theta += (cam.want.theta - cam.theta) * k; if (Math.abs(cam.want.theta - cam.theta) < 0.002) { cam.theta = cam.want.theta; delete cam.want.theta; } }
    if (cam.want.x != null) { cam.target.x += (cam.want.x - cam.target.x) * k; cam.target.z += (cam.want.y - cam.target.z) * k; if (Math.hypot(cam.want.x - cam.target.x, cam.want.y - cam.target.z) < 0.02) { delete cam.want.x; delete cam.want.y; } }
    if (cam.want.theta == null && cam.want.x == null) cam.want = null;
  }
  const r = 40, halfH = 6 / cam.zoom, aspect = VW / VH;
  Object.assign(camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
  camera.position.set(cam.target.x + r * Math.cos(cam.phi) * Math.sin(cam.theta), cam.target.y + r * Math.sin(cam.phi), cam.target.z + r * Math.cos(cam.phi) * Math.cos(cam.theta));
  camera.lookAt(cam.target); camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- a frame
let last = performance.now();
export function render(hl, opt = {}) {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000), t = now / 1000; last = now;
  placeCamera(dt);
  // the units: build each machine once, then pose it every frame
  for (const u of B.units) {
    let m = mechs.get(u);
    const show = alive(u) || u.dying;
    if (!m) { m = buildMech(u); m.group.traverse((o) => { o.receiveShadow = false; }); mechs.set(u, m); root.add(m.group); }
    m.group.visible = !!show; if (!show) continue;
    const vx = u.vx ?? u.x, vy = u.vy ?? u.y, h = u.vh ?? tileH(u.x, u.y);
    m.group.position.set(vx, h + (m.air ? 0.75 + Math.sin(t * 1.7 + vx) * 0.04 : 0), vy); // helicopters fly
    // turn smoothly towards where it wants to face
    let d = (u.dir ?? 0) - m.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.group.rotation.y += d * Math.min(1, dt * 12);
    poseMech(m, u, mapPose(u, t));
    m.fade(u.dying ? Math.max(0, 1 - u.dying) : 1); m.dim(!!(u.done && u.side === 'p'));
    m.bars(u, opt.sel === u, t);
  }
  // highlights
  let n = 0;
  for (const [key, kind] of hl) {
    const x = key % B.map[0].length, y = Math.floor(key / B.map[0].length);
    let p = hlPool[n]; if (!p) { p = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), B.hlMats.move); p.rotation.x = -Math.PI / 2; p.renderOrder = 2; root.add(p); hlPool[n] = p; }
    p.material = B.hlMats[kind]; p.material.opacity = kind === 'move' || kind === 'att' ? 0.5 + Math.sin(t * 5) * 0.15 : 0.45;
    p.position.set(x, tileH(x, y) + 0.015, y); p.visible = true; n++;
  }
  for (let k = n; k < hlPool.length; k++) hlPool[k].visible = false;
  if (opt.cursor) { cursorMesh.visible = true; cursorMesh.position.set(opt.cursor.x, tileH(opt.cursor.x, opt.cursor.y) + 0.02, opt.cursor.y); cursorMesh.material.color.set(Math.floor(t * 4) % 2 ? '#ffffff' : '#ffe14a'); } else cursorMesh.visible = false;
  // labels: "Fire", damage, misses
  for (const s of labelSprites) { root.remove(s); s.material.map.dispose(); s.material.dispose(); }
  labelSprites = [];
  for (const l of opt.labels || []) { const s = bubbleSprite(l.text, l.col); s.position.set(l.u.vx ?? l.u.x, (l.u.vh ?? tileH(l.u.x, l.u.y)) + 1.45, l.u.vy ?? l.u.y); root.add(s); labelSprites.push(s); }
  renderer.render(scene, camera);
}
function bubbleSprite(text, col = '#141410') {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '8px "Press Start 2P", monospace';
  const w = Math.ceil(g.measureText(text).width) + 10; c.width = w; c.height = 14;
  g.fillStyle = '#141410'; g.fillRect(0, 0, w, 14); g.fillStyle = '#e8e4d8'; g.fillRect(1, 1, w - 2, 12); g.fillStyle = '#9a968a'; g.fillRect(1, 12, w - 2, 1);
  g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top'; g.fillStyle = col; g.fillText(text, 5, 3);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.renderOrder = 10;
  const k = 0.035 * 12 / (cam.zoom * 12) * 1.2; s.scale.set(w * k, 14 * k, 1); s.center.set(0.5, 0);
  return s;
}

// ---------------------------------------------------------------- picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function pick(cx, cy) {
  const r = glCanvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const mm = [...mechs.values()].filter((m) => m.group.visible).flatMap((m) => m.hit);
  const hit = ray.intersectObjects([...mm, ...tiles], false)[0];
  if (!hit) return null;
  const o = hit.object; if (o.userData.unit) return { x: o.userData.unit.x, y: o.userData.unit.y };
  return { x: o.userData.x, y: o.userData.y };
}
export function unitHeight(u) { return tileH(u.x, u.y); }
