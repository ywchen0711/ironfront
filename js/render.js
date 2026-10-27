// Drawing, in the manner of the 16-bit tactics games: everything is painted at low resolution, pixel by pixel, and
// scaled up without smoothing. A muted palette of rust, concrete, olive and steel; mottled textures; outlined
// sprites with three tones of shading.
//   prepare(map)          paints a sprite for every square (ground, raised blocks, warehouses, trees, props)
//   drawMap(...)          the battlefield, back to front, with the units standing among the buildings
//   drawBattle(...)       the side-on battle scene
import { TERRAIN, ITEM } from './data.js';
import { alive } from './rules.js';

export const TW = 32, TH = 16, HZ = 8;
export const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });
// how high each kind of square stands, in pixels (water sits a little lower)
const RAISE = { h: 8, H: 16, b: 34, '#': 14, w: -3 };
export const raise = (c) => RAISE[c] || 0;
const UP = 40; // room above a square's top for trees, poles and roofs

// ---------------------------------------------------------------- helpers
function hash(x, y, s = 0) { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// pick from a palette by noise: mostly the first colours, now and then the others
const pickPal = (pal, n) => pal[Math.min(pal.length - 1, Math.floor(Math.pow(n, 1.6) * pal.length))];
function shade(h, k) { const c = hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * k)))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
// paint every pixel of a diamond top and its two side faces through colour functions
function paintBlock(c, top, left, right, depth) {
  const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const put = (x, y, col) => { if (x < 0 || y < 0 || x >= c.width || y >= c.height || !col) return; const i = (y * c.width + x) * 4, [r, gg, b] = hex(col); d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; };
  for (let py = 0; py < 16; py++) { const hw = py < 8 ? (py + 1) * 2 : (16 - py) * 2; for (let px = 16 - hw; px < 16 + hw; px++) put(px, UP - 8 + py, top(px, py)); }
  if (depth > 0) for (let px = 0; px < 32; px++) {
    const ey = px < 16 ? UP + Math.floor(px / 2) : UP + 8 - Math.floor((px - 16) / 2) - 1;
    for (let k = 1; k <= depth; k++) put(px, ey + k, px < 16 ? left(px, k, depth) : right(px - 16, k, depth));
  }
  g.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- palettes
const P = {
  grass: ['#56602e', '#4c5628', '#626c36', '#3e4822', '#6e7a40'], dirt: ['#5e4e34', '#524430', '#6a583a', '#44382a'],
  conc: ['#5a544a', '#524c42', '#625c52', '#4a443c', '#6c665a'], asph: ['#48443e', '#423e38', '#4e4a42', '#3a3632', '#56524a'],
  snow: ['#d6dce2', '#ccd2d8', '#e2e8ec', '#bcc4cc', '#eef2f4'], water: ['#24404c', '#203a46', '#2a4854', '#1c3440'],
  forest: ['#3a4a22', '#34421e', '#42522a', '#2c381a'], rubble: ['#5a544a', '#4e483e', '#665e52', '#3c3630', '#76705e'],
  wallTop: ['#8a847a', '#827c72', '#929086'], wallSide: ['#6a665e', '#625e56', '#726e64'],
  roof: ['#5a2c1c', '#3e1c12'], roofEdge: '#7a3a24', wallA: ['#9a8a68', '#7e6e50'], wallB: ['#b0a080', '#948464'],
};
const side = (pal, k, light) => (x, y, depth) => (y === depth ? '#1a1612' : shade(pickPal(pal, hash(x * 7 + k, y * 13 + k, 3)), light));

// ---------------------------------------------------------------- squares
// one sprite per square, so the units can be drawn in among them
export function prepare(map) {
  const H = map.length, W = map[0].length, out = [];
  const at = (x, y) => map[y]?.[x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.push(tileSprite(map[y][x], x, y, at));
  return { W, H, tiles: out, hl: { move: hlSprite('#3a7aff'), att: hlSprite('#ff5a3a'), range: hlSprite('#ffb040', true), peek: hlSprite('#ff7a5a', true) } };
}
function hlSprite(col, faint) {
  const c = canvas(32, 16), g = c.getContext('2d'); g.fillStyle = col;
  for (let py = 0; py < 16; py++) { const hw = py < 8 ? (py + 1) * 2 : (16 - py) * 2; for (let px = 16 - hw; px < 16 + hw; px++) if ((px + py) % 2 === 0 || (!faint && (px === 16 - hw || px === 16 + hw - 1))) g.fillRect(px, py, 1, 1); }
  return c;
}
function tileSprite(ch, tx, ty, at) {
  const r = raise(ch), depth = Math.max(0, r) + 4, c = canvas(32, UP + 8 + depth + 2), g = c.getContext('2d');
  const n = (px, py, s = 0) => hash(tx * 32 + px, ty * 16 + py, s);
  const roadAt = (dx, dy) => at(tx + dx, ty + dy) === 'r';
  let top, left, right;
  if (ch === '.') top = (px, py) => pickPal(P.grass, n(px, py));
  else if (ch === ',') top = (px, py) => { const v = n(px, py); return (px + py * 2) % 16 === 0 && v < 0.6 ? '#4a443a' : pickPal(P.conc, v); };
  else if (ch === 'r') {
    const alongX = roadAt(1, 0) || roadAt(-1, 0), alongY = roadAt(0, 1) || roadAt(0, -1);
    top = (px, py) => {
      const u = px / 2 + py - 8, v = px / 2 - py; // the square's two axes, in pixels
      if (alongX && !alongY && Math.abs(v) < 1 && Math.floor(u + 20) % 6 < 3) return '#8a7a3a';
      if (alongY && !alongX && Math.abs(u) < 1 && Math.floor(v + 20) % 6 < 3) return '#8a7a3a';
      return pickPal(P.asph, n(px, py));
    };
  } else if (ch === 'f') top = (px, py) => pickPal(P.forest, n(px, py));
  else if (ch === 'x') top = (px, py) => pickPal(P.rubble, n(px, py));
  else if (ch === 'c') top = (px, py) => pickPal(P.snow, n(px, py));
  else if (ch === 'w') top = (px, py) => { const v = n(px, py); return v > 0.93 ? '#4a7484' : pickPal(P.water, v); };
  else if (ch === 'h' || ch === 'H') top = (px, py) => pickPal(ch === 'H' ? P.dirt.concat(P.grass.slice(0, 2)) : P.grass, n(px, py));
  else if (ch === '#') top = (px, py) => (py === 0 || px === 0 ? '#a8a296' : pickPal(P.wallTop, n(px, py)));
  else if (ch === 'b') top = (px, py) => (py < 1 ? P.roofEdge : (((px + py * 2) >> 1) % 2 ? P.roof[1] : n(px, py) > 0.9 ? '#6a341f' : P.roof[0]));
  // the sides of the block
  if (ch === 'b') {
    left = (x, y, d) => (y === d ? '#14100c' : y < 3 ? '#5a2c1c' : (x >> 1) % 2 ? P.wallA[0] : P.wallA[1]);
    right = (x, y, d) => (y === d ? '#14100c' : y < 3 ? '#6a341f' : (x >> 1) % 2 ? P.wallB[0] : P.wallB[1]);
  } else if (ch === '#') { left = side(P.wallSide, 1, 0.8); right = side(P.wallSide, 2, 1); }
  else if (ch === 'h' || ch === 'H') { left = side(P.dirt, 1, 0.75); right = side(P.dirt, 2, 0.95); }
  else if (ch === 'w') { left = () => '#16262e'; right = () => '#1a2c34'; }
  else if (ch === 'c') { left = side(P.snow, 1, 0.78); right = side(P.snow, 2, 0.9); }
  else { const pal = { '.': P.dirt, ',': P.conc, r: P.asph, f: P.dirt, x: P.rubble }[ch] || P.dirt; left = side(pal, 1, 0.62); right = side(pal, 2, 0.78); }
  // the shadow of a tall neighbour falls across this square
  const tall = (q) => q === 'b' || q === '#';
  if (!tall(ch) && ch !== 'w') { const sh = (at(tx - 1, ty) === 'b' ? 2 : 0) + (at(tx, ty - 1) === 'b' ? 1 : 0) + (at(tx - 1, ty) === '#' || at(tx, ty - 1) === '#' ? 1 : 0); if (sh) { const base = top; top = (px, py) => { const col = base(px, py), dx = at(tx - 1, ty) && tall(at(tx - 1, ty)) ? px / 32 : 1, dy = at(tx, ty - 1) && tall(at(tx, ty - 1)) ? (32 - px) / 32 : 1; const inside = (tall(at(tx - 1, ty)) && py < 10 - px / 4) || (tall(at(tx, ty - 1)) && py < 10 - (32 - px) / 4); return inside && (px + py) % 2 === 0 ? shade(col, 0.55) : inside ? shade(col, 0.7) : col; }; } }
  paintBlock(c, top, left, right, depth);
  // things standing on the square
  const cy = UP, rr = (k) => hash(tx, ty, 50 + k);
  if (ch === 'f') for (const [ox, oy] of [[-7, -1], [6, 1], [-1, 4]].filter((p, k) => k < 2 + (rr(1) > 0.4))) pine(g, 16 + ox + Math.round(rr(ox + 9) * 3), cy + oy, 14 + Math.round(rr(oy + 3) * 6));
  if (ch === 'x') wreck(g, 16 + Math.round((rr(2) - 0.5) * 8), cy + 1);
  if (ch === 'b') warehouseDetail(g, cy, depth, tx, ty, at);
  if (ch === '#') { g.fillStyle = '#4a463e'; for (let k = 2; k < 16; k += 5) { g.fillRect(k, cy + Math.floor(k / 2) + 3, 1, depth - 4); g.fillRect(16 + k, cy + 8 - Math.floor(k / 2) + 2, 1, depth - 4); } g.fillStyle = '#c8a040'; g.fillRect(4, cy + depth - 4, 2, 2); }
  if (ch === ',') { const v = rr(5); if (v < 0.18) crates(g, 14 + Math.round(rr(6) * 6), cy + 2); else if (v < 0.3) { g.fillStyle = '#2e2a26'; ellipsePx(g, 16 + Math.round((rr(7) - 0.5) * 12), cy + Math.round((rr(8) - 0.5) * 6), 5, 2); } else if (v < 0.38) { g.fillStyle = '#2a2622'; g.fillRect(14, cy - 1, 5, 3); g.fillStyle = '#5e584e'; g.fillRect(15, cy, 3, 1); } }
  if (ch === '.' && rr(9) < 0.08) pole(g, 16 + Math.round((rr(10) - 0.5) * 10), cy + 2);
  if (ch === 'r' && rr(11) < 0.06) { g.fillStyle = '#2a2622'; ellipsePx(g, 16, cy, 4, 2); }
  if (ch === 'H' || ch === 'h') { g.fillStyle = '#3a3226'; for (let k = 0; k < 3; k++) g.fillRect(8 + Math.round(rr(20 + k) * 16), cy - 3 + Math.round(rr(30 + k) * 6), 2, 1); }
  if (ch === 'c' && rr(12) < 0.25) pine(g, 16 + Math.round((rr(13) - 0.5) * 14), cy + 1, 13, true);
  return { c, r };
}
function ellipsePx(g, cx, cy, rx, ry) { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01)))); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); } }
// a pixel pine tree, outlined
function pine(g, x, base, h, snowy) {
  const dark = '#141c0c', mid = snowy ? '#3c5030' : '#2c4420', lite = snowy ? '#dfe6ea' : '#4a6a2c';
  g.fillStyle = '#2a1e12'; g.fillRect(x - 1, base - 3, 2, 4);
  for (let k = 0; k < h; k++) {
    const y = base - 3 - k, w = Math.max(1, Math.round(((k % 5) + 1) * 0.9 + (h - k) * 0.32));
    g.fillStyle = dark; g.fillRect(x - w - 1, y, w * 2 + 2, 1);
    g.fillStyle = mid; g.fillRect(x - w, y, w * 2, 1);
    g.fillStyle = lite; g.fillRect(x - w, y, Math.max(1, Math.floor(w / 2)), 1);
  }
  g.fillStyle = dark; g.fillRect(x, base - 3 - h, 1, 1);
}
function wreck(g, x, y) {
  g.fillStyle = '#1a1612'; g.fillRect(x - 6, y - 4, 12, 5); g.fillStyle = '#3e3a34'; g.fillRect(x - 5, y - 4, 10, 3); g.fillStyle = '#5a3a22'; g.fillRect(x - 2, y - 6, 5, 2); g.fillStyle = '#2a2622'; g.fillRect(x + 3, y - 7, 2, 3);
  g.fillStyle = '#7a4a26'; g.fillRect(x - 4, y - 3, 2, 1); g.fillRect(x + 1, y - 2, 1, 1);
}
function crates(g, x, y) {
  for (const [dx, dy, w, h] of [[0, 0, 7, 5], [3, -4, 6, 4]]) { g.fillStyle = '#1a140c'; g.fillRect(x + dx - 1, y + dy - h - 1, w + 2, h + 2); g.fillStyle = '#8a6a3a'; g.fillRect(x + dx, y + dy - h, w, h); g.fillStyle = '#a8824a'; g.fillRect(x + dx, y + dy - h, w, 1); g.fillStyle = '#5e4626'; g.fillRect(x + dx + Math.floor(w / 2), y + dy - h, 1, h); }
}
function pole(g, x, y) { g.fillStyle = '#1a1612'; g.fillRect(x - 1, y - 30, 3, 31); g.fillStyle = '#8a8478'; g.fillRect(x, y - 30, 1, 30); g.fillStyle = '#c8b040'; for (let k = 0; k < 3; k++) g.fillRect(x, y - 6 + k * 2, 1, 1); g.fillStyle = '#1a1612'; g.fillRect(x - 4, y - 28, 9, 2); g.fillStyle = '#9a9488'; g.fillRect(x - 3, y - 28, 7, 1); }
// doors and vents on the warehouse walls that face us
function warehouseDetail(g, cy, depth, tx, ty, at) {
  const openL = at(tx, ty + 1) !== 'b', openR = at(tx + 1, ty) !== 'b', v = hash(tx, ty, 77);
  if (openL && v < 0.6) for (let k = 0; k < 6; k++) { const ex = 5 + k; g.fillStyle = k === 0 || k === 5 ? '#5a2c1c' : '#2a2018'; g.fillRect(ex, cy + Math.floor(ex / 2) + depth - 12, 1, 11); }
  if (openR && v > 0.35) for (let k = 0; k < 8; k++) { const ex = 20 + k; g.fillStyle = k === 0 || k === 7 ? '#5a2c1c' : '#2a2018'; g.fillRect(ex, cy + 8 - Math.floor((ex - 16) / 2) + depth - 14, 1, 13); }
  if (openR && v < 0.3) { g.fillStyle = '#3a2a1a'; for (let k = 0; k < 9; k++) { const ex = 19 + k; g.fillRect(ex, cy + 8 - Math.floor((ex - 16) / 2) + 6, 1, 3); } }
}

// ---------------------------------------------------------------- wanzers on the map
const PAL = {
  p: { lite: '#aec27a', base: '#7c944e', shade: '#56683a', dark: '#36421f', trim: '#c8b040', glass: '#2a3a48' },
  e: { lite: '#c8c4ba', base: '#9a968c', shade: '#6c685e', dark: '#403e38', trim: '#d0702e', glass: '#3a2a2a' },
};
const cache = new Map();
function outline(c, col = '#100e0a') {
  const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data, W = c.width, H = c.height, out = new Uint8ClampedArray(d);
  const [r, gg, b] = hex(col);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (d[i + 3]) continue;
    if ((x > 0 && d[i - 1]) || (x < W - 1 && d[i + 7]) || (y > 0 && d[i - W * 4 + 3]) || (y < H - 1 && d[i + W * 4 + 3])) { out[i] = r; out[i + 1] = gg; out[i + 2] = b; out[i + 3] = 255; }
  }
  g.putImageData(new ImageData(out, W, H), 0, 0);
}
// a little machine, 3/4 view, facing right: 30 x 36 pixels, feet at (15, 33)
function mapMech(u) {
  const key = ['m', u.side, u.legs, u.wL, u.wR, u.sh, u.hp.armL > 0, u.hp.armR > 0, u.hp.legs > 0].join('|');
  if (cache.has(key)) return cache.get(key);
  const c = canvas(30, 36), g = c.getContext('2d'), C = PAL[u.side], L = ITEM[u.legs];
  const box = (x, y, w, h, base, lite, dark) => { g.fillStyle = base; g.fillRect(x, y, w, h); if (lite) { g.fillStyle = lite; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h); } if (dark) { g.fillStyle = dark; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h); } };
  const legC = u.hp.legs > 0 ? C : { base: '#4a4640', lite: '#5a564e', shade: '#3a3630', dark: '#2a2622' };
  // the far arm, and a shield on it
  if (u.hp.armL > 0) { box(5, 14, 4, 7, C.shade, C.base, C.dark); if (u.wL && ITEM[u.wL].cat === 'shield') box(2, 12, 3, 12, '#6a6c70', '#8a8c90', '#3a3c40'); }
  // legs
  if (L.tread) { box(4, 25, 21, 7, legC.shade, legC.base, legC.dark); g.fillStyle = '#1a1814'; for (let k = 5; k < 24; k += 3) g.fillRect(k, 29, 1, 2); box(8, 21, 13, 5, legC.base, legC.lite, legC.dark); }
  else if (L.hover) { box(5, 27, 19, 4, legC.shade, legC.base, legC.dark); g.fillStyle = '#5ab4d8'; g.fillRect(7, 31, 15, 1); box(9, 21, 11, 7, legC.base, legC.lite, legC.dark); }
  else { box(8, 21, 5, 6, legC.shade, legC.base, legC.dark); box(8, 26, 4, 5, legC.shade, legC.base, legC.dark); box(6, 31, 8, 2, legC.dark, legC.shade); box(14, 21, 6, 6, legC.base, legC.lite, legC.dark); box(15, 26, 5, 5, legC.base, legC.lite, legC.dark); box(14, 31, 9, 2, legC.dark, legC.shade); }
  // a launcher on the back
  if (u.sh) { box(6, 4, 8, 6, '#5a5c58', '#7a7c76', '#34362f'); g.fillStyle = '#1a1814'; g.fillRect(12, 5, 2, 2); g.fillRect(12, 8, 2, 1); }
  // the body: a box with a lit top and the cockpit glass in front
  box(7, 10, 15, 11, C.base, C.lite, C.dark); g.fillStyle = C.lite; g.fillRect(8, 10, 13, 2); g.fillStyle = C.shade; g.fillRect(7, 18, 15, 3);
  g.fillStyle = C.glass; g.fillRect(15, 13, 6, 3); g.fillStyle = '#7a9ab0'; g.fillRect(16, 13, 3, 1);
  box(11, 6, 6, 5, C.shade, C.base, C.dark); g.fillStyle = '#e04030'; g.fillRect(15, 8, 1, 1);
  g.fillStyle = C.trim; g.fillRect(8, 16, 2, 1);
  // the near shoulder, arm and weapon
  if (u.hp.armR > 0) {
    box(18, 11, 6, 5, C.base, C.lite, C.dark); box(19, 16, 4, 6, C.shade, C.base, C.dark);
    const w = u.wR && ITEM[u.wR];
    if (w && w.cat === 'short') { const len = w.id === 'RF2' ? 9 : w.id === 'SG1' ? 4 : 6; box(20, 20, len, 3, '#3a3c40', '#5e6066', '#1c1d20'); if (w.shots > 4) box(21, 22, 3, 3, '#4a4c50', '#62646a'); }
    else if (w && w.cat === 'melee') { box(22, 12, 2, 11, '#4a4c50', '#7a7c82'); if (w.id === 'AX1') box(23, 10, 5, 5, '#8a8c90', '#b0b2b6', '#4a4c50'); if (w.id === 'RD1') { g.fillStyle = '#6ac8ff'; g.fillRect(22, 11, 2, 2); } }
    else if (w && w.cat === 'shield') box(22, 13, 4, 11, '#6a6c70', '#8a8c90', '#3a3c40');
  } else { g.fillStyle = '#ffb030'; g.fillRect(20, 13, 1, 1); g.fillRect(21, 12, 1, 1); }
  outline(c);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- the battlefield
// g: the low-resolution canvas; cam: where the map's origin sits on it
export function drawMap(g, B, art, cam, hl, opt = {}) {
  const { W, H, tiles } = art, t = performance.now() / 1000;
  g.fillStyle = '#100e0c'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  for (let s = 0; s < W + H - 1; s++) for (let x = 0; x <= s; x++) {
    const y = s - x; if (x >= W || y >= H) continue;
    const T = tiles[y * W + x], p = iso(x, y), sx = Math.round(cam.x + p.x), sy = Math.round(cam.y + p.y);
    g.drawImage(T.c, sx - 16, sy - T.r - UP);
    const mark = hl.get(y * W + x);
    if (mark) { g.globalAlpha = mark === 'move' || mark === 'att' ? 0.55 + Math.sin(t * 5) * 0.2 : 0.6; g.drawImage(art.hl[mark], sx - 16, sy - T.r - 8); g.globalAlpha = 1; }
    if (opt.cursor && opt.cursor.x === x && opt.cursor.y === y) cursorAt(g, sx, sy - T.r, t);
    for (const u of B.units) if (u.x === x && u.y === y && (alive(u) || u.dying)) unitAt(g, u, sx + Math.round(u.ox || 0), sy - T.r + Math.round(u.oy || 0), t, opt);
  }
  // little labels over the units: "Fire", damage and misses
  for (const l of opt.labels || []) bubble(g, Math.round(cam.x + l.x), Math.round(cam.y + l.y), l.text, l.col);
}
export const heightPx = (art, x, y) => art.tiles[y * art.W + x].r;
function cursorAt(g, x, y, t) {
  g.fillStyle = Math.floor(t * 4) % 2 ? '#ffffff' : '#ffe14a';
  for (let k = 0; k < 16; k++) { const w = k < 8 ? (k + 1) * 2 : (16 - k) * 2; g.fillRect(x - w, y - 8 + k, 1, 1); g.fillRect(x + w - 1, y - 8 + k, 1, 1); }
}
function unitAt(g, u, x, y, t, opt) {
  const spr = mapMech(u), f = u.face || (u.side === 'p' ? 1 : -1);
  g.fillStyle = '#0008'; for (let k = -1; k <= 1; k++) g.fillRect(x - 9 + Math.abs(k) * 3, y + k, 18 - Math.abs(k) * 6, 1);
  if (u.dying) g.globalAlpha = Math.max(0, 1 - u.dying);
  else if (u.done && u.side === 'p') g.globalAlpha = 0.55;
  g.save(); g.translate(x, y - 33); if (f < 0) g.scale(-1, 1); g.drawImage(spr, -15, 0); g.restore();
  g.globalAlpha = 1;
  if (u.dying) for (let k = 0; k < 6; k++) { g.fillStyle = ['#ffe070', '#ff9a30', '#d04020'][k % 3]; const a = k * 1.1 + u.dying * 4, r = 4 + u.dying * 12; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 14 + Math.sin(a) * r * 0.6), 3, 3); }
  if (!alive(u)) return;
  // a small health bar, a star for a commander, a bobbing arrow over the selected one
  const k = u.hp.body / u.max.body, bx = x - 7, by = y - 39;
  g.fillStyle = '#100e0a'; g.fillRect(bx - 1, by - 1, 16, 4); g.fillStyle = '#3a3a30'; g.fillRect(bx, by, 14, 2); g.fillStyle = k > 0.5 ? '#9ac850' : k > 0.25 ? '#e0b030' : '#e04a30'; g.fillRect(bx, by, Math.max(1, Math.round(14 * k)), 2);
  if (u.boss) { g.fillStyle = '#ffd23a'; g.fillRect(x - 1, by - 5, 3, 3); g.fillRect(x, by - 6, 1, 5); g.fillRect(x - 2, by - 4, 5, 1); }
  if (opt.sel === u) { const b = Math.floor(t * 4) % 2; g.fillStyle = b ? '#ffe14a' : '#ffffff'; g.fillRect(x - 2, by - 9 - b, 5, 2); g.fillRect(x - 1, by - 7 - b, 3, 1); g.fillRect(x, by - 6 - b, 1, 1); }
}
// a little white box with a black border and pixel letters, like the "Fire" over a firing unit
export function bubble(g, x, y, text, col = '#141410') {
  g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top'; g.textAlign = 'left';
  const w = Math.ceil(g.measureText(text).width) + 8, bx = x - Math.floor(w / 2), by = y - 12;
  g.fillStyle = '#141410'; g.fillRect(bx - 1, by - 1, w + 2, 13); g.fillStyle = '#e8e4d8'; g.fillRect(bx, by, w, 11); g.fillStyle = '#9a968a'; g.fillRect(bx, by + 10, w, 1); g.fillRect(bx + w - 1, by, 1, 11);
  g.fillStyle = col; g.fillText(text, bx + 4, by + 2);
}

// ---------------------------------------------------------------- the battle scene
// drawn on a 400 x 225 canvas. sc: { L, R, events, hpL, hpR, t, ground, dead, deadAt }
const BW = 400, BH = 225;
export const BATTLE_SIZE = { w: BW, h: BH };
let backdrop = null, backKey = '';
function paintBackdrop(ground) {
  const c = canvas(BW, BH), g = c.getContext('2d');
  // a dusky sky in bands, dithered where they meet
  const bands = ['#2a2230', '#3a2c34', '#4e3a38', '#62483c', '#76563e'];
  bands.forEach((col, k) => { g.fillStyle = col; g.fillRect(0, k * 24, BW, 24); });
  for (let y = 0; y < 120; y++) if (y % 24 > 19) for (let x = y % 2; x < BW; x += 2) { g.fillStyle = bands[Math.min(4, Math.floor(y / 24) + 1)]; g.fillRect(x, y, 1, 1); }
  // factories and warehouses on the horizon
  for (let k = 0; k < 10; k++) {
    const x = k * 44 - 10 + Math.round(hash(k, 1) * 12), w = 30 + Math.round(hash(k, 2) * 22), h = 20 + Math.round(hash(k, 3) * 34), base = 122;
    g.fillStyle = '#2a201c'; g.fillRect(x, base - h, w, h); g.fillStyle = '#34281f'; for (let s = 0; s < w; s += 3) g.fillRect(x + s, base - h, 1, h);
    g.fillStyle = '#1a1412'; g.fillRect(x - 2, base - h - 3, w + 4, 4);
    if (hash(k, 4) > 0.5) { g.fillStyle = '#241a16'; g.fillRect(x + w - 9, base - h - 20, 5, 20); g.fillStyle = '#3a2c26'; g.fillRect(x + w - 9, base - h - 20, 1, 20); }
    g.fillStyle = '#c8a040'; for (let s = 0; s < 3; s++) if (hash(k, 10 + s) > 0.55) g.fillRect(x + 4 + s * 9, base - h + 6, 2, 2);
  }
  for (let x = 6; x < BW; x += 28) { g.fillStyle = '#1a1412'; g.fillRect(x, 92, 2, 30); g.fillRect(x - 4, 92, 10, 2); }
  // the ground, in rows that grow coarser towards us
  const pal = ground === 'c' ? P.snow : ground === 'r' ? P.asph : ground === ',' || ground === 'x' ? P.conc : ground === 'f' ? P.forest : ground === 'w' ? P.water : ground === 'h' || ground === 'H' ? P.dirt : P.grass;
  for (let y = 122; y < BH; y++) { const sc = 1 + (y - 122) / 18; for (let x = 0; x < BW; x++) { const v = hash(Math.floor(x / (sc * 2)), Math.floor((y - 122) / sc), 9); g.fillStyle = pal[v < 0.62 ? 0 : v < 0.82 ? 1 : v < 0.94 ? 2 : 3]; g.fillRect(x, y, 1, 1); } }
  // a few seams across the ground, to give it depth
  g.fillStyle = '#0003'; for (const yy of [132, 146, 166, 194]) g.fillRect(0, yy, BW, 1);
  g.fillStyle = '#0006'; g.fillRect(0, 122, BW, 3);
  return c;
}
// a big machine, side on, facing right, feet at (0, 0): about 60 x 100 pixels
function bigMech(g, u, C, o = {}) {
  const fl = o.flash || {}, L = ITEM[u.legs], now = performance.now();
  const col = (part, c) => (fl[part] > 0 && Math.floor(fl[part] * 10) % 2 ? '#ffffff' : u.hp[part] <= 0 ? '#3a3632' : c);
  const box = (part, x, y, w, h, base, lite, dark) => { g.fillStyle = '#100e0a'; g.fillRect(x - 1, y - 1, w + 2, h + 2); g.fillStyle = col(part, base); g.fillRect(x, y, w, h); if (lite) { g.fillStyle = col(part, lite); g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h); } if (dark) { g.fillStyle = col(part, dark); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h); } };
  const rivets = (x, y, n, dx) => { g.fillStyle = '#100e0a'; for (let k = 0; k < n; k++) g.fillRect(x + k * dx, y, 1, 1); };
  // the far arm
  if (u.hp.armL > 0) {
    box('armL', -14, -74, 12, 10, C.shade, C.base, C.dark); box('armL', -12, -64, 8, 16, C.dark, C.shade);
    const w = u.wL && ITEM[u.wL];
    if (w && w.cat === 'shield') { box('armL', 2, -76, 8, w.id === 'SH2' ? 44 : 34, '#5e6064', '#84868a', '#36383c'); rivets(4, -70, 3, 2); }
    else if (w) box('armL', -6, -50, w.cat === 'melee' ? 4 : 18, w.cat === 'melee' ? 22 : 5, '#34363a', '#56585e');
  }
  // legs
  if (L.tread) { box('legs', -30, -20, 60, 20, C.dark, C.shade); g.fillStyle = '#1a1814'; for (let k = -26; k < 28; k += 6) g.fillRect(k, -12, 3, 8); for (let k = -24; k < 26; k += 12) box('legs', k, -16, 8, 8, '#4a4840', '#6a6860'); box('legs', -16, -36, 32, 16, C.base, C.lite, C.dark); }
  else if (L.hover) { box('legs', -26, -14, 52, 10, C.dark, C.shade); g.fillStyle = Math.floor(now / 80) % 2 ? '#7ad0f0' : '#4aa0d0'; g.fillRect(-22, -4, 44, 2); box('legs', -12, -38, 24, 24, C.base, C.lite, C.dark); }
  else for (const [dx, back] of [[-10, true], [6, false]]) { const pal = back ? [C.shade, C.base, C.dark] : [C.base, C.lite, C.dark]; box('legs', dx, -44, 11, 20, ...pal); box('legs', dx - 1, -26, 13, 6, ...pal); box('legs', dx, -22, 10, 18, ...pal); box('legs', dx - 3, -5, 18, 5, C.dark, C.shade); rivets(dx + 2, -38, 3, 3); }
  // hip, body, cockpit, head
  box('body', -14, -50, 28, 8, C.dark, C.shade);
  box('body', -20, -84, 40, 36, C.base, C.lite, C.dark);
  g.fillStyle = col('body', C.lite); g.fillRect(-18, -82, 36, 4); g.fillStyle = col('body', C.shade); g.fillRect(-20, -56, 40, 8);
  g.fillStyle = col('body', C.dark); g.fillRect(-8, -78, 1, 22); g.fillRect(-20, -66, 40, 1); rivets(-16, -60, 6, 6);
  box('body', 6, -76, 14, 9, C.glass, '#4a6a80', '#1a2228'); g.fillStyle = '#8ab0c8'; g.fillRect(8, -75, 6, 1);
  g.fillStyle = col('body', C.trim); g.fillRect(-18, -72, 6, 2);
  box('body', -6, -94, 16, 11, C.shade, C.base, C.dark); g.fillStyle = Math.floor(now / 300) % 2 ? '#ff5a3a' : '#c03020'; g.fillRect(6, -90, 3, 2);
  if (u.sh) { box('body', -26, -100, 22, 14, '#56584f', '#7a7c72', '#34362e'); g.fillStyle = '#100e0a'; for (let k = 0; k < 3; k++) g.fillRect(-8, -97 + k * 4, 4, 3); g.fillStyle = '#c8b040'; g.fillRect(-24, -90, 4, 1); }
  // the near arm, brought up to aim when it fires
  if (u.hp.armR > 0) {
    box('armR', 12, -82, 16, 14, C.base, C.lite, C.dark); rivets(14, -72, 4, 3);
    g.save(); g.translate(20, -68); g.rotate(o.aim || 0);
    box('armR', -5, 0, 10, 16, C.shade, C.base, C.dark); box('armR', -6, 14, 12, 14, C.base, C.lite, C.dark);
    const w = u.wR && ITEM[u.wR];
    if (w && w.cat === 'short') { const len = w.id === 'RF2' ? 46 : w.id === 'RF1' ? 36 : w.id === 'SG1' ? 24 : 30, th = w.id === 'SG1' || w.id === 'MG2' ? 7 : 5; box('armR', 4, 18, 8, 12, '#2a2c30', '#4a4c52', '#141518'); box('armR', 6, 24, th, len, '#34363a', '#5a5c62', '#1c1d20'); if (w.shots > 4) box('armR', 12, 30, 6, 9, '#3e4046', '#5e6066'); if (w.id === 'RF2') box('armR', 1, 30, 4, 10, '#2a2c30', '#4a4c52'); }
    else if (w && w.cat === 'melee') { box('armR', 2, 4, 4, 34, '#44464c', '#70727a'); if (w.id === 'AX1') box('armR', 4, -2, 14, 12, '#8a8c90', '#b8babe', '#4a4c50'); else if (w.id === 'RD1') { g.fillStyle = Math.floor(now / 60) % 2 ? '#8ae0ff' : '#4ab0e0'; g.fillRect(2, 2, 4, 6); } else box('armR', 0, 26, 12, 8, '#8a8c90', '#b0b2b6'); }
    else if (w && w.cat === 'shield') box('armR', 4, 2, 9, 38, '#5e6064', '#84868a', '#36383c');
    g.restore();
  } else { g.fillStyle = '#100e0a'; g.fillRect(12, -80, 10, 8); if (Math.floor(now / 90) % 2) { g.fillStyle = '#ffd040'; g.fillRect(18, -78, 2, 2); g.fillRect(21, -81, 1, 1); } }
}
const PART_Y = { body: 66, armL: 66, armR: 72, legs: 22 };
export function drawBattle(g, sc) {
  const t = sc.t;
  if (backKey !== sc.ground || !backdrop) { backdrop = paintBackdrop(sc.ground); backKey = sc.ground; }
  g.drawImage(backdrop, 0, 0);
  const base = 204, lx = 112, rx = 288, pos = { L: { x: lx, f: 1 }, R: { x: rx, f: -1 } };
  for (const e of sc.events) if (e.cat === 'melee' && t > e.at - 0.35 && t < e.at + 0.3) { const k = 1 - Math.abs(t - e.at) / 0.35, me = pos[e.from]; me.x += me.f * Math.round((rx - lx - 70) * Math.min(1, k * 1.6)); }
  const flash = { L: {}, R: {} }, shake = { L: 0, R: 0 };
  for (const e of sc.events) { const tgt = e.from === 'L' ? 'R' : 'L'; if (!e.miss && t >= e.at && t < e.at + 0.25) { flash[tgt][e.part] = 1 - (t - e.at) / 0.25; shake[tgt] = 2; } }
  for (const s of ['L', 'R']) {
    const u = sc[s], p = pos[s], dying = sc.dead?.[s] && t > sc.deadAt ? Math.min(1, (t - sc.deadAt) / 0.9) : 0;
    const busy = sc.events.filter((e) => e.from === s && t > e.at - 0.45 && t < e.at + 0.25), melee = busy.some((e) => e.cat === 'melee');
    const aim = busy.length && !busy.every((e) => e.cat === 'long') ? (melee ? -2.6 + Math.min(1, Math.max(0, (t - busy[0].at + 0.1) * 6)) * 2.2 : -1.5) : -0.35;
    g.fillStyle = '#0007'; for (let k = -2; k <= 2; k++) g.fillRect(p.x - 30 + Math.abs(k) * 6, base + k, 60 - Math.abs(k) * 12, 1);
    g.save(); g.translate(Math.round(p.x + (shake[s] ? (Math.floor(t * 40) % 2 ? 2 : -2) : 0)), base + Math.round(dying * 8)); g.scale(p.f, 1);
    if (dying) g.globalAlpha = 1 - dying * 0.6;
    bigMech(g, { ...u, hp: sc['hp' + s] }, PAL[u.side], { flash: flash[s], aim });
    g.restore(); g.globalAlpha = 1;
  }
  // shots in flight, muzzle flashes
  for (const e of sc.events) {
    if (e.cat === 'melee') continue;
    const a = pos[e.from], b = pos[e.from === 'L' ? 'R' : 'L'], fly = e.cat === 'long' ? 0.55 : 0.14, dt = e.at - t; if (dt < 0 || dt > fly) continue;
    const k = 1 - dt / fly, sx = a.x + a.f * (e.cat === 'long' ? -2 : 50), sy = base - (e.cat === 'long' ? 96 : 70), ex = b.x - b.f * (e.miss ? -70 : 8), ey = base - (e.miss ? 92 : PART_Y[e.part]);
    const at = (q) => [Math.round(sx + (ex - sx) * q), Math.round(sy + (ey - sy) * q - (e.cat === 'long' ? Math.sin(q * Math.PI) * 50 : 0))];
    const [x, y] = at(k);
    if (e.cat === 'long') { for (let j = 6; j >= 1; j--) { const [tx, ty] = at(Math.max(0, k - j * 0.035)); g.fillStyle = j < 2 ? '#ffd040' : j < 3 ? '#c8b8a0' : '#6a6460'; g.fillRect(tx - 1, ty - 1, j < 3 ? 3 : 2, j < 3 ? 3 : 2); } g.fillStyle = '#100e0a'; g.fillRect(x - 5, y - 2, 11, 5); g.fillStyle = '#c8c4b8'; g.fillRect(x - 4, y - 1, 9, 3); g.fillStyle = '#e04030'; g.fillRect(x + a.f * 4, y - 1, 1, 3); }
    else { g.fillStyle = '#fff4b0'; g.fillRect(x - 3, y, 6, 1); g.fillStyle = '#ffb040'; g.fillRect(x - 6 * a.f, y, 3, 1); }
    if (k < 0.3 && e.cat !== 'long') { g.fillStyle = '#fff4b0'; g.fillRect(sx - 2, sy - 2, 5, 5); g.fillStyle = '#ffb040'; g.fillRect(sx + a.f * 3, sy - 1, 3, 3); g.fillRect(sx - 1, sy - 4, 3, 1); g.fillRect(sx - 1, sy + 3, 3, 1); }
  }
  // sparks, explosions, and the numbers in pixel letters
  g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top'; g.textAlign = 'center';
  for (const e of sc.events) {
    const dt = t - e.at; if (dt < 0 || dt > 0.9) continue;
    const b = pos[e.from === 'L' ? 'R' : 'L'], hx = b.x - b.f * 6, hy = base - (e.miss ? 92 : PART_Y[e.part]);
    if (!e.miss && dt < 0.3) boom(g, hx + (e.n % 3 - 1) * 4, hy + (e.n % 2) * 4, e.cat === 'long' ? 16 : 7, dt / 0.3);
    const tx = b.x + ((e.n % 5) - 2) * 18, ty = hy - 20 - (e.n % 2) * 10 - Math.round(dt * 24), s = e.miss ? 'MISS' : `${e.dmg}`;
    g.fillStyle = '#100e0a'; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(s, tx + dx, ty + dy);
    g.fillStyle = e.miss ? '#c8d0d8' : e.broke ? '#ff7040' : '#ffe070'; g.fillText(s, tx, ty);
  }
  for (const s of ['L', 'R']) if (sc.dead?.[s] && t > sc.deadAt) { const k = t - sc.deadAt, p = pos[s]; for (let j = 0; j < 7; j++) boom(g, p.x + Math.round(Math.sin(j * 2.3) * 22), base - 30 - Math.round(Math.cos(j * 1.7) * 30), 10 + j * 2, Math.min(1, Math.max(0, (k - j * 0.08) / 0.7))); }
  g.textAlign = 'left';
}
// a pixel explosion: rings of hot colours that cool and break up
function boom(g, x, y, r, k) {
  if (k <= 0 || k >= 1) return;
  const R = Math.round(r * (0.4 + k));
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const d = Math.sqrt(xx * xx + yy * yy) / R; if (d > 1) continue;
    if (hash(xx + Math.floor(k * 8), yy, 5) < k * 0.8 * d) continue;
    g.fillStyle = d < 0.35 - k * 0.2 ? '#fff4c0' : d < 0.6 ? '#ffc040' : d < 0.85 ? '#e06020' : '#6a3020';
    g.fillRect(x + xx, y + yy, 1, 1);
  }
}
