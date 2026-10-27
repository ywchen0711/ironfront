// Drawing, in the manner of the 16-bit tactics games: everything is painted at low resolution, pixel by pixel, and
// scaled up without smoothing. A muted palette of rust, concrete, olive and steel; mottled textures; outlined
// sprites with three tones of shading.
//   prepare(map)          paints a sprite for every square (ground, raised blocks, warehouses, trees, props)
//   drawMap(...)          the battlefield, back to front, with the units standing among the buildings
//   drawBattle(...)       the side-on battle scene
import { TERRAIN, ITEM } from './data.js?v=16';
import { alive } from './rules.js?v=16';
import { wanzerSprite } from './mech.js?v=16';

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
  sand: ['#c8ae7a', '#bca270', '#d4ba86', '#b09464', '#dcc496'],
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

// ---------------------------------------------------------------- how a unit on the map is moving right now
// u.anim: { moving, phase (set by the walk), aimUntil, fireFrom, hitUntil }; walk eases in and out
export function mapPose(u, t) {
  const A = u.anim || (u.anim = { phase: 0, walk: 0, last: t });
  const dt = Math.min(0.1, t - (A.last || t)); A.last = t;
  A.walk += ((A.moving ? 1 : 0) - A.walk) * Math.min(1, dt * 10);
  if (!A.moving && A.walk < 0.02) A.walk = 0;
  const ms = t * 1000, aimK = A.aimUntil && ms < A.aimUntil ? Math.min(1, (A.aimUntil - ms) / 150, (ms - (A.aimUntil - 900)) / 200) : 0;
  const firing = A.fireFrom && ms > A.fireFrom && ms < A.aimUntil;
  return { phase: A.phase, walk: A.walk, aim: Math.max(0, aimK), muzzle: firing && Math.floor(ms / 60) % 2 === 0, recoil: firing ? (Math.floor(ms / 60) % 2 ? 1 : 0) : 0,
    flinch: A.hitUntil && ms < A.hitUntil ? Math.sin(ms / 25) : 0, t, face: u.face || (u.side === 'p' ? 1 : -1) };
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
  const spr = wanzerSprite(u, 1, mapPose(u, t));
  g.fillStyle = '#0008'; for (let k = -1; k <= 1; k++) g.fillRect(x - 10 + Math.abs(k) * 3, y + k, 20 - Math.abs(k) * 6, 1);
  if (u.dying) g.globalAlpha = Math.max(0, 1 - u.dying);
  else if (u.done && u.side === 'p') g.globalAlpha = 0.6;
  g.drawImage(spr.c, Math.round(x - spr.ax), Math.round(y - spr.ay + 1));
  g.globalAlpha = 1;
  if (u.dying) for (let k = 0; k < 6; k++) { g.fillStyle = ['#ffe070', '#ff9a30', '#d04020'][k % 3]; const a = k * 1.1 + u.dying * 4, r = 4 + u.dying * 12; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 14 + Math.sin(a) * r * 0.6), 3, 3); }
  if (!alive(u)) return;
  // a small health bar, a star for a commander, a bobbing arrow over the selected one
  const k = u.hp.body / u.max.body, bx = x - 7, by = y - 42;
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
const PART_Y = { body: 50, armL: 56, armR: 46, legs: 18 };
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
    const mine = sc.events.filter((e) => e.from === s), busy = mine.filter((e) => t > e.at - 0.5 && t < e.at + 0.3);
    const guns = busy.filter((e) => e.cat === 'short'), melee = busy.some((e) => e.cat === 'melee');
    const lunging = sc.events.some((e) => e.cat === 'melee' && e.from === s && t > e.at - 0.35 && t < e.at + 0.3);
    const shot = mine.some((e) => e.cat === 'short' && t > e.at - 0.16 && t < e.at - 0.08);
    const hit = sc.events.some((e) => e.from !== s && !e.miss && t >= e.at && t < e.at + 0.25);
    const pose = { t, face: p.f, walk: lunging ? 1 : 0, phase: t * 16, aim: guns.length ? 1 : melee ? 0.6 : 0, muzzle: shot, recoil: shot ? 1 : 0, flinch: hit ? Math.sin(t * 60) : 0, flash: flash[s] };
    g.fillStyle = '#0007'; for (let k = -2; k <= 2; k++) g.fillRect(p.x - 34 + Math.abs(k) * 7, base + k, 68 - Math.abs(k) * 14, 1);
    const spr = wanzerSprite({ ...u, hp: sc['hp' + s] }, 2.4, pose);
    if (dying) g.globalAlpha = 1 - dying * 0.6;
    g.drawImage(spr.c, Math.round(p.x - spr.ax), Math.round(base - spr.ay + dying * 8));
    g.globalAlpha = 1;
  }
  // shots in flight, muzzle flashes
  for (const e of sc.events) {
    if (e.cat === 'melee') continue;
    const a = pos[e.from], b = pos[e.from === 'L' ? 'R' : 'L'], fly = e.cat === 'long' ? 0.55 : 0.14, dt = e.at - t; if (dt < 0 || dt > fly) continue;
    const k = 1 - dt / fly, sx = a.x + a.f * (e.cat === 'long' ? -8 : 62), sy = base - (e.cat === 'long' ? 78 : 52), ex = b.x - b.f * (e.miss ? -70 : 8), ey = base - (e.miss ? 74 : PART_Y[e.part]);
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
    const b = pos[e.from === 'L' ? 'R' : 'L'], hx = b.x - b.f * 6, hy = base - (e.miss ? 74 : PART_Y[e.part]);
    if (!e.miss && dt < 0.3) boom(g, hx + (e.n % 3 - 1) * 4, hy + (e.n % 2) * 4, e.cat === 'long' ? 16 : 7, dt / 0.3);
    const tx = b.x + ((e.n % 5) - 2) * 18, ty = hy - 20 - (e.n % 2) * 10 - Math.round(dt * 24), s = e.miss ? 'MISS' : `${e.dmg}`;
    g.fillStyle = '#100e0a'; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(s, tx + dx, ty + dy);
    g.fillStyle = e.miss ? '#c8d0d8' : e.broke ? '#ff7040' : '#ffe070'; g.fillText(s, tx, ty);
  }
  for (const s of ['L', 'R']) if (sc.dead?.[s] && t > sc.deadAt) { const k = t - sc.deadAt, p = pos[s]; for (let j = 0; j < 7; j++) boom(g, p.x + Math.round(Math.sin(j * 2.3) * 22), base - 30 - Math.round(Math.cos(j * 1.7) * 30), 10 + j * 2, Math.min(1, Math.max(0, (k - j * 0.08) / 0.7))); }
  g.textAlign = 'left';
}
// how long each kind of shot is in the air before it lands (the scene and the sounds share these)
export const FLY = { bullet: 0.14, pellets: 0.12, shell: 0.12, rocket: 0.32, missile: 0.55, grenade: 0.45, flame: 0.22, artillery: 0.75, flak: 0.2, rail: 0.06, melee: 0 };
export const flyOf = (e) => FLY[e.fx] ?? (e.cat === 'long' ? 0.55 : 0.14);
// the same effects over the 3D battle scene. A: screen points from battle3d.render; g: a transparent canvas
// the size of the 3D view. k scales the effects with how big the machines are on screen.
export function drawBattleFx(g, sc, A) {
  const t = sc.t, k = A.unit / 68, z = (v) => Math.max(1, Math.round(v * k)), W = g.canvas.width, H = g.canvas.height;
  g.clearRect(0, 0, W, H);
  const dot = (x, y, r, c) => { g.fillStyle = c; g.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), r, r); };
  const flash = (x, y, dx, big = 1) => { g.fillStyle = '#fff4b0'; g.fillRect(x - z(2 * big), y - z(2 * big), z(5 * big), z(5 * big)); g.fillStyle = '#ffb040'; g.fillRect(x + dx * z(3 * big), y - z(1 * big), z(4 * big), z(3 * big)); g.fillRect(x - z(1), y - z(4 * big), z(3), z(1)); g.fillRect(x - z(1), y + z(3 * big), z(3), z(1)); };
  for (const e of sc.events) {
    if (e.cat === 'melee') continue;
    const fly = flyOf(e), dt = e.at - t;
    const a = A[e.from], b = A[e.from === 'L' ? 'R' : 'L'], s0 = e.cat === 'long' ? a.launcher : a.muzzle, e0 = e.miss ? b.miss : b[e.part];
    const dx = Math.sign(e0.x - s0.x) || a.f;
    // artillery: the gun fires, then the shell comes down out of the sky on the target
    if (e.fx === 'artillery') {
      if (dt > fly - 0.12 && dt < fly + 0.02) { flash(s0.x, s0.y, dx, 1.6); for (let j = 0; j < 5; j++) dot(s0.x + dx * z(4 + j * 3), s0.y - z(j * 2), z(4), '#8a847c'); }
      if (dt >= 0 && dt < fly * 0.55) { const q = 1 - dt / (fly * 0.55), y = -z(20) + (e0.y + z(20)) * q, x = e0.x - z(30) * (1 - q); for (let j = 0; j < 6; j++) dot(x - z(5) * j * 0.6, y - z(8) * j, z(j < 2 ? 3 : 2), j < 2 ? '#fff4b0' : '#c8b8a0'); }
      continue;
    }
    if (dt < 0 || dt > fly) continue;
    const q = 1 - dt / fly;
    const arc = e.fx === 'missile' ? 50 : e.fx === 'grenade' ? 70 : e.fx === 'rocket' ? 10 : 0;
    const at = (q2) => [Math.round(s0.x + (e0.x - s0.x) * q2), Math.round(s0.y + (e0.y - s0.y) * q2 - Math.sin(q2 * Math.PI) * arc * k)];
    const [x, y] = at(q);
    if (e.fx === 'missile' || e.fx === 'rocket') {
      // a missile or rocket with a smoke trail that thins out behind it
      const n = e.fx === 'rocket' ? 7 : 10;
      for (let j = n; j >= 1; j--) { const [tx, ty] = at(Math.max(0, q - j * 0.03)), r = z(j < 3 ? 3 : j < 6 ? 2.5 : 2); dot(tx, ty, r, j < 2 ? '#ffd040' : j < 4 ? '#c8b8a0' : j < 7 ? '#8a847c' : '#5a5650'); }
      const L2 = e.fx === 'rocket' ? 7 : 11;
      g.fillStyle = '#100e0a'; g.fillRect(x - z(L2 / 2), y - z(2), z(L2), z(5)); g.fillStyle = '#c8c4b8'; g.fillRect(x - z(L2 / 2 - 1), y - z(1), z(L2 - 2), z(3)); g.fillStyle = '#e04030'; g.fillRect(x + a.f * z(L2 / 2 - 1), y - z(1), z(1), z(3));
      if (q < 0.25) flash(s0.x, s0.y, dx, 0.8);
    } else if (e.fx === 'grenade') {
      dot(x, y, z(4), '#2a2a26'); dot(x - z(1), y - z(1), z(2), '#6a6a60');
      if (q < 0.2) flash(s0.x, s0.y, dx, 0.8);
    } else if (e.fx === 'flame') {
      // a stream of fire, licking along the line and spreading out towards the end
      for (let j = 0; j < 14; j++) { const q2 = Math.max(0, q - j * 0.05); if (q2 <= 0) break; const [fx2, fy] = at(q2), sp = z(2 + q2 * 6), jx = (hash(j, e.n, Math.floor(t * 30)) - 0.5) * sp, jy = (hash(e.n, j, Math.floor(t * 30)) - 0.5) * sp; dot(fx2 + jx, fy + jy, z(3 + q2 * 5), j < 3 ? '#fff0a0' : j < 7 ? '#ffb040' : j < 11 ? '#e06020' : '#7a4030'); }
    } else if (e.fx === 'rail') {
      // a slug too fast to see: a white line, then a blue afterglow
      g.fillStyle = q < 0.5 ? '#ffffff' : '#8ad8ff'; const n = 24;
      for (let j = 0; j <= n; j++) { const [lx, ly] = at(j / n); g.fillRect(lx - z(1), ly - z(1), z(2), z(2)); }
      flash(s0.x, s0.y, dx, 1.2);
    } else if (e.fx === 'pellets') {
      for (let j = -1; j <= 1; j++) { g.fillStyle = '#fff4b0'; g.fillRect(x - z(3), y + j * z(4) * q, z(6), z(1)); }
      if (q < 0.4) flash(s0.x, s0.y, dx, 1.1);
    } else {
      // a tracer (a shell is thicker and brighter); flak bursts into puffs near the target
      const th = e.fx === 'shell' ? 2 : 1;
      g.fillStyle = '#fff4b0'; g.fillRect(x - z(4), y, z(8), z(th)); g.fillStyle = '#ffb040'; g.fillRect(x - dx * z(10), y, z(6), z(th));
      if (q < 0.35) flash(s0.x, s0.y, dx, e.fx === 'shell' ? 1.8 : 1);
      if (e.fx === 'shell' && q < 0.6) for (let j = 0; j < 4; j++) dot(s0.x + dx * z(6 + j * 4), s0.y - z(2 + j), z(5 - j), '#9a948a');
    }
  }
  // flak: dark puffs of smoke where the shells burst, hit or miss
  for (const e of sc.events) if (e.fx === 'flak') { const dt = t - e.at; if (dt < 0 || dt > 0.5) continue; const b = A[e.from === 'L' ? 'R' : 'L'], p = e.miss ? b.miss : b[e.part]; const r = z(6 + dt * 14); dot(p.x + (e.n % 3 - 1) * z(8), p.y - (e.n % 2) * z(6), r, dt < 0.08 ? '#ffd060' : '#4a4842'); }
  // sparks and explosions where it hits, then the numbers
  const fs = 8 * Math.max(1, Math.round(k * 0.6)); g.font = `${fs}px "Press Start 2P", monospace`; g.textBaseline = 'top'; g.textAlign = 'center';
  const outline = (s2, x, y, col, o = Math.max(1, Math.round(fs / 8))) => { g.fillStyle = '#100e0a'; for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) g.fillText(s2, x + ox, y + oy); g.fillStyle = col; g.fillText(s2, x, y); };
  for (const e of sc.events) {
    const dt = t - e.at; if (dt < 0 || dt > 0.9) continue;
    const b = A[e.from === 'L' ? 'R' : 'L'], p = e.miss ? b.miss : b[e.part];
    const big = e.fx === 'shell' || e.fx === 'artillery' || e.cat === 'long' ? 16 : e.fx === 'rocket' || e.fx === 'grenade' ? 12 : e.cat === 'melee' ? 11 : 7;
    if (!e.miss && dt < 0.3) boom(g, p.x + (e.n % 3 - 1) * z(4), p.y + (e.n % 2) * z(4), z(big * (e.crit ? 1.3 : 1)), dt / 0.3);
    if (e.miss && (e.fx === 'artillery' || e.fx === 'grenade') && dt < 0.3) boom(g, p.x, p.y + z(20), z(10), dt / 0.3);
    if (!e.miss && dt < 0.4) sparks(g, p.x, p.y, z(1), dt / 0.4, e.n);
    const tx = b.head.x + ((e.n % 3) - 1) * z(10), ty = b.head.y + z(4) - (e.n % 3) * z(9) - Math.round(dt * 24 * k), s2 = e.miss ? 'MISS' : `${e.dmg}`;
    outline(s2, tx, ty, e.miss ? '#c8d0d8' : e.crit ? '#ff5030' : e.broke ? '#ff7040' : '#ffe070');
    if (e.crit && dt < 0.7) outline('CRITICAL', tx, ty - fs - z(2), '#ff9a40');
    if ((e.burn || e.stun) && dt > 0.15) outline(e.burn ? 'BURN' : 'STUN', b.head.x, b.head.y - fs * 3, e.burn ? '#ff7a30' : '#8ad8ff');
  }
  // callouts: a pilot's skill as the volley starts, the defender's as it answers, an attack from the side or the back
  for (const e of sc.events) {
    if (e.callA) { const dt = t - (e.at - 0.65); if (dt > 0 && dt < 0.9) { const a = A[e.from]; outline('★ ' + e.callA, a.head.x, a.head.y - fs * 3 - Math.round(dt * 10 * k), '#ffd040'); } }
    if (e.callD) { const dt = t - e.at; if (dt > -0.1 && dt < 0.8) { const b = A[e.from === 'L' ? 'R' : 'L']; outline('★ ' + e.callD, b.head.x, b.head.y - fs * 4.5, '#8ad8ff'); } }
    if (e.callF) { const dt = t - (e.at - 0.65); if (dt > 0 && dt < 0.9) { const b = A[e.from === 'L' ? 'R' : 'L']; outline(e.callF, b.head.x, b.head.y - fs * 6, '#ff8a60'); } }
  }
  for (const s3 of ['L', 'R']) if (sc.dead?.[s3] && t > sc.deadAt) { const q = t - sc.deadAt, p = A[s3].body; for (let j = 0; j < 8; j++) boom(g, p.x + Math.round(Math.sin(j * 2.3) * 24 * k), p.y + z(10) - Math.round(Math.cos(j * 1.7) * 30 * k), z(10 + j * 2), Math.min(1, Math.max(0, (q - j * 0.08) / 0.7))); }
  // the weather, falling past the camera
  const wx = sc.weather;
  if (wx === 'rain') { g.fillStyle = '#a8b8c8'; for (let j = 0; j < 90; j++) { const x = (hash(j, 1, 7) * W + t * 60) % W, y = (hash(j, 2, 7) * H + t * 700 * (0.7 + hash(j, 3, 7) * 0.5)) % H; g.fillRect(x, y, 1, z(6)); } }
  else if (wx === 'snow') { g.fillStyle = '#eef2f4'; for (let j = 0; j < 70; j++) { const x = (hash(j, 1, 8) * W + Math.sin(t + j) * 12 * k + t * 20) % W, y = (hash(j, 2, 8) * H + t * 60 * (0.6 + hash(j, 3, 8))) % H; g.fillRect(x, y, z(2), z(2)); } }
  else if (wx === 'sand') { g.fillStyle = '#d8b878'; for (let j = 0; j < 60; j++) { const x = (hash(j, 1, 9) * W + t * 500 * (0.6 + hash(j, 3, 9))) % W, y = hash(j, 2, 9) * H; g.fillRect(x, y, z(7), 1); } }
  g.textAlign = 'left';
}
// hot fragments flying out of a hit
function sparks(g, x, y, s, q, n) {
  for (let j = 0; j < 7; j++) { const a = hash(j, n, 3) * Math.PI * 2, r = (6 + hash(n, j, 4) * 16) * s * q * 1.6; g.fillStyle = j % 2 ? '#ffe070' : '#ff9a30'; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8 + q * q * 6 * s), s, s); }
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

// shared with the 3D battlefield, so both are painted from the same palettes
export { P, hash, pickPal, shade, pine, crates, wreck };
