// Drawing: the battlefield in isometric view (raised tiles for hills and buildings), the wanzers both as small map
// figures and as big side-on machines for the battle scene, and the battle scene itself.
import { TERRAIN, ITEM } from './data.js';
import { alive } from './rules.js';

export const TW = 64, TH = 32, HZ = 14;
export const iso = (x, y, h = 0) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - h * HZ });
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const SIDE = { p: { main: '#5a7ea8', dark: '#34506e', trim: '#c8d8e8' }, e: { main: '#a86048', dark: '#6a3428', trim: '#e8c8a8' } };

// ---------------------------------------------------------------- the map
export function drawMap(g, M, cam, hl, units, opt = {}) {
  const map = M.map, H = map.length, W = map[0].length, t = performance.now() / 1000;
  g.save(); g.translate(cam.x, cam.y); g.scale(cam.z, cam.z);
  for (let s = 0; s < W + H - 1; s++) for (let x = 0; x <= s; x++) {
    const y = s - x; if (x >= W || y >= H) continue;
    const T = TERRAIN[map[y][x]], h = T.h, p = iso(x, y, Math.max(h, 0));
    tile(g, p.x, p.y, T, h, x, y, t);
    const mark = hl.get(y * W + x);
    if (mark) { g.fillStyle = mark; diamond(g, p.x, p.y); g.fill(); g.strokeStyle = '#ffffffaa'; g.lineWidth = 1.5; g.stroke(); }
    if (opt.cursor && opt.cursor.x === x && opt.cursor.y === y) { g.strokeStyle = '#ffe14a'; g.lineWidth = 3; diamond(g, p.x, p.y); g.stroke(); }
    for (const u of units) if (u.x === x && u.y === y && (alive(u) || u.dying)) drawMapUnit(g, u, p.x + (u.ox || 0), p.y + (u.oy || 0), t, opt);
  }
  g.restore();
}
function diamond(g, x, y) { g.beginPath(); g.moveTo(x, y - TH / 2); g.lineTo(x + TW / 2, y); g.lineTo(x, y + TH / 2); g.lineTo(x - TW / 2, y); g.closePath(); }
function tile(g, x, y, T, h, tx, ty, t) {
  const top = T.water ? shade(T.c, 0.95 + Math.sin(t * 2 + tx + ty) * 0.05) : T.c;
  const depth = (Math.max(0, h) + 1) * HZ * (T.water ? 0.4 : 1);
  // the two sides of the raised block
  g.fillStyle = shade(T.c, 0.62); g.beginPath(); g.moveTo(x - TW / 2, y); g.lineTo(x, y + TH / 2); g.lineTo(x, y + TH / 2 + depth); g.lineTo(x - TW / 2, y + depth); g.fill();
  g.fillStyle = shade(T.c, 0.78); g.beginPath(); g.moveTo(x + TW / 2, y); g.lineTo(x, y + TH / 2); g.lineTo(x, y + TH / 2 + depth); g.lineTo(x + TW / 2, y + depth); g.fill();
  g.fillStyle = top; diamond(g, x, y); g.fill(); g.strokeStyle = '#00000022'; g.lineWidth = 1; g.stroke();
  const r = (k) => { const v = Math.sin(tx * 12.9 + ty * 78.2 + k) * 43758.5; return v - Math.floor(v); };
  if (T === TERRAIN.f) for (let k = 0; k < 3; k++) { const fx = x + (r(k) - 0.5) * 30, fy = y + (r(k + 9) - 0.5) * 12; g.fillStyle = '#2f5e2a'; g.beginPath(); g.moveTo(fx, fy - 22); g.lineTo(fx + 9, fy); g.lineTo(fx - 9, fy); g.fill(); g.fillStyle = '#3f7a36'; g.beginPath(); g.moveTo(fx, fy - 28); g.lineTo(fx + 6, fy - 12); g.lineTo(fx - 6, fy - 12); g.fill(); }
  else if (T === TERRAIN.b) { g.fillStyle = '#c8d8e8'; for (let k = 0; k < 3; k++) { g.fillRect(x - 24 + k * 9, y + 10 + 4 * k * 0.5, 5, 7); g.fillRect(x + 6 + k * 9, y + 14 - 4 * k * 0.5, 5, 7); } }
  else if (T === TERRAIN.x) { g.fillStyle = '#5a5248'; for (let k = 0; k < 4; k++) { g.fillRect(x + (r(k) - 0.5) * 36, y + (r(k + 4) - 0.5) * 14 - 3, 7, 5); } }
  else if (T === TERRAIN.r) { g.strokeStyle = '#e8e4d0aa'; g.setLineDash([5, 6]); g.beginPath(); g.moveTo(x - 14, y - 7); g.lineTo(x + 14, y + 7); g.stroke(); g.setLineDash([]); }
  else if (T === TERRAIN.c) { g.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (r(k) - 0.5) * 34, y + (r(k + 3) - 0.5) * 12, 2.5, 0, 7); g.fill(); } }
  else if (T === TERRAIN['.'] && r(1) < 0.3) { g.fillStyle = '#5f9a44'; g.fillRect(x + (r(2) - 0.5) * 30, y + (r(3) - 0.5) * 10, 2, 5); }
}
// a small wanzer standing on its square
function drawMapUnit(g, u, x, y, t, opt) {
  const C = SIDE[u.side], f = u.face || (u.side === 'p' ? 1 : -1), bob = Math.sin(t * 3 + x) * 0.8;
  g.save(); g.translate(x, y + bob);
  g.fillStyle = '#0005'; g.beginPath(); g.ellipse(0, 4, 18, 7, 0, 0, 7); g.fill();
  if (u.done && u.side === 'p' && alive(u)) g.globalAlpha = 0.6;
  if (u.dying) g.globalAlpha = Math.max(0, 1 - u.dying);
  g.scale(f * 0.42, 0.42);
  mech(g, u, C, 0, { small: true });
  g.restore();
  if (alive(u)) { // a bar of the body's health and a ring for the commander
    const k = u.hp.body / u.max.body; g.fillStyle = '#000a'; g.fillRect(x - 16, y - 58, 32, 5); g.fillStyle = k > 0.5 ? '#5ad05a' : k > 0.25 ? '#f0c040' : '#f05040'; g.fillRect(x - 15, y - 57, 30 * k, 3);
    if (u.boss) { g.font = '900 12px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd23a'; g.fillText('★', x, y - 62); }
    if (opt.sel === u) { g.strokeStyle = '#ffe14a'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 4, 22, 9, 0, 0, 7); g.stroke(); }
  }
}

// ---------------------------------------------------------------- a wanzer, side on (facing right). scale by the caller.
// flash: { part: amount } makes a part glow white when it is hit
export function mech(g, u, C, t, o = {}) {
  const fl = o.flash || {}, broken = (p) => u.hp[p] <= 0;
  const col = (p, c) => (fl[p] > 0 ? mix(c, '#ffffff', fl[p]) : broken(p) ? '#3a3a3a' : c);
  const legs = ITEM[u.legs], walk = o.walk || 0;
  // the far arm and its weapon
  arm(g, u, 'armL', 'wL', C, col, -8, -116, 0.9, o.aim || 0);
  // legs
  if (legs.tread) { g.fillStyle = col('legs', C.dark); g.beginPath(); g.roundRect(-46, -40, 92, 40, 14); g.fill(); g.fillStyle = col('legs', '#2a2a2a'); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(-34 + k * 14, -14, 7, 0, 7); g.fill(); } g.fillStyle = col('legs', C.main); g.fillRect(-26, -62, 52, 24); }
  else if (legs.hover) { g.fillStyle = col('legs', C.dark); g.beginPath(); g.moveTo(-40, -24); g.lineTo(40, -24); g.lineTo(30, -8); g.lineTo(-30, -8); g.closePath(); g.fill(); g.fillStyle = col('legs', C.main); g.fillRect(-20, -64, 40, 42); g.fillStyle = '#7cd0ff88'; g.beginPath(); g.ellipse(0, -4, 34, 6, 0, 0, 7); g.fill(); }
  else { for (const [dx, ph, sh] of [[-12, 0, 0.75], [12, Math.PI, 1]]) { const sw = Math.sin(walk + ph) * 0.35; g.save(); g.translate(dx, -66); g.rotate(sw); g.fillStyle = col('legs', shade(C.dark, sh)); g.fillRect(-9, 0, 18, 34); g.translate(0, 32); g.rotate(-Math.abs(sw) * 0.8); g.fillStyle = col('legs', shade(C.main, sh)); g.fillRect(-8, 0, 16, 32); g.fillStyle = col('legs', shade(C.dark, sh)); g.fillRect(-12, 30, 30, 8); g.restore(); } }
  // body
  g.fillStyle = col('body', C.main); g.beginPath(); g.moveTo(-30, -70); g.lineTo(30, -70); g.lineTo(38, -128); g.lineTo(-34, -132); g.closePath(); g.fill();
  g.fillStyle = col('body', C.dark); g.fillRect(-30, -78, 60, 10);
  g.fillStyle = col('body', C.trim); g.beginPath(); g.moveTo(10, -122); g.lineTo(36, -122); g.lineTo(32, -104); g.lineTo(10, -104); g.closePath(); g.fill(); // cockpit glass
  g.fillStyle = '#1a2a3a'; g.fillRect(16, -118, 14, 8);
  g.fillStyle = col('body', C.dark); g.fillRect(-8, -146, 26, 16); g.fillStyle = '#ff5a3a'; g.fillRect(12, -142, 6, 4); // head and eye
  // shoulder launcher
  if (u.sh) { const w = ITEM[u.sh]; g.fillStyle = col('body', '#4a4f5a'); g.fillRect(-36, -152, 34, 22); g.fillStyle = '#2a2d33'; for (let k = 0; k < (w.id === 'RK1' ? 3 : 2); k++) { g.beginPath(); g.arc(-4, -146 + k * 8 - (w.id === 'RK1' ? 2 : 0), 3, 0, 7); g.fill(); } }
  // the near arm and its weapon
  arm(g, u, 'armR', 'wR', C, col, 8, -118, 1, o.aim || 0);
}
function arm(g, u, part, slot, C, col, x, y, sh, aim) {
  if (u.hp[part] <= 0) { g.fillStyle = '#2a2a2a'; g.fillRect(x - 6, y, 12, 10); return; } // a stump
  g.save(); g.translate(x, y);
  g.fillStyle = col(part, shade(C.main, sh)); g.beginPath(); g.roundRect(-14, -8, 28, 22, 6); g.fill(); // shoulder
  g.rotate(-0.2 + aim); g.fillStyle = col(part, shade(C.dark, sh)); g.fillRect(-7, 8, 14, 30);
  g.translate(0, 36); g.rotate(-1.3); g.fillStyle = col(part, shade(C.main, sh)); g.fillRect(-7, -2, 14, 30);
  g.translate(0, 28); g.fillStyle = col(part, shade(C.dark, sh)); g.fillRect(-8, -2, 16, 10);
  const w = u[slot] && ITEM[u[slot]];
  if (w) {
    g.fillStyle = '#2f3238'; g.strokeStyle = '#15171a'; g.lineWidth = 1;
    if (w.cat === 'shield') { g.fillStyle = col(part, '#6a7078'); g.beginPath(); g.roundRect(-26, -36, 16, w.id === 'SH2' ? 76 : 58, 5); g.fill(); }
    else if (w.cat === 'melee') { g.save(); g.rotate(1.3); if (w.id === 'AX1') { g.fillRect(-3, -8, 6, 56); g.fillStyle = '#8a9098'; g.beginPath(); g.moveTo(-2, 44); g.lineTo(22, 34); g.lineTo(22, 62); g.closePath(); g.fill(); } else if (w.id === 'KN1') { g.fillStyle = '#8a9098'; g.fillRect(-10, 0, 20, 14); } else { g.fillRect(-3, -4, 6, 54); g.fillStyle = '#7cd0ff'; g.fillRect(-4, 40, 8, 12); } g.restore(); }
    else { const long = w.id === 'RF2' ? 64 : w.id === 'RF1' ? 52 : w.id === 'SG1' ? 32 : 44, thick = w.id === 'SG1' || w.id === 'MG2' ? 12 : 9; g.save(); g.rotate(1.3); g.fillRect(-6, -4, 16, 18); g.fillRect(-thick / 2 + 2, 10, thick, long); if (w.id === 'RF2') { g.fillRect(-1, 18, 10, 6); } if (w.cat === 'short' && w.shots > 4) { g.fillStyle = '#4a4e56'; g.fillRect(4, 14, 10, 16); } g.restore(); }
  }
  g.restore();
}
const mix = (a, b, k) => { const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; const A = a.startsWith('#') && a.length === 7 ? p(a) : [80, 80, 80], B = p(b); return `rgb(${A.map((c, i) => Math.round(c + (B[i] - c) * k)).join(',')})`; };

// ---------------------------------------------------------------- the battle scene
// sc: { L, R (the two units, L on the left), events: [{ at, from: 'L'|'R', cat, hit, part, dmg, broke }], hpL, hpR (shown hp), t, ground }
export function drawBattle(g, W, H, sc, txt) {
  const t = sc.t, skyG = g.createLinearGradient(0, 0, 0, H);
  skyG.addColorStop(0, '#2a3a5a'); skyG.addColorStop(0.6, '#8aa0b8'); skyG.addColorStop(1, '#c8d0d8'); g.fillStyle = skyG; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5a6a7a'; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(k * W / 6 - 80, H * 0.62); g.lineTo(k * W / 6, H * 0.44 + (k % 2) * 30); g.lineTo(k * W / 6 + 90, H * 0.62); g.fill(); }
  g.fillStyle = sc.ground || '#7fae5a'; g.fillRect(0, H * 0.62, W, H); g.fillStyle = '#0002'; for (let k = 0; k < 12; k++) g.fillRect(((k * 137 + t * 0) % W), H * 0.66 + (k % 4) * 30, 60, 3);
  const base = H * 0.86, scale = Math.min(1.6, H / 420, W / 600), lx = W * 0.27, rx = W * 0.73;
  const pos = { L: { x: lx, y: base, f: 1 }, R: { x: rx, y: base, f: -1 } };
  // melee lunges: the striker slides across, then back
  for (const e of sc.events) if (e.cat === 'melee' && t > e.at - 0.35 && t < e.at + 0.35) { const k = 1 - Math.abs(t - e.at) / 0.35, me = pos[e.from], d = (rx - lx - 170 * scale) * Math.min(1, k * 1.6); me.x += me.f * d; }
  const flash = { L: {}, R: {} }, shake = { L: 0, R: 0 };
  for (const e of sc.events) { const tgt = e.from === 'L' ? 'R' : 'L'; if (!e.miss && t >= e.at && t < e.at + 0.18) { flash[tgt][e.part] = 1 - (t - e.at) / 0.18; shake[tgt] = 5; } }
  for (const s of ['L', 'R']) {
    const u = sc[s], p = pos[s], dying = sc.dead?.[s] && t > sc.deadAt ? Math.min(1, (t - sc.deadAt) / 0.8) : 0;
    g.save(); g.translate(p.x + (Math.random() - 0.5) * shake[s], p.y + dying * 30); g.scale(p.f * scale, scale); g.rotate(dying * 0.25);
    g.fillStyle = '#0004'; g.beginPath(); g.ellipse(0, 2, 60, 10, 0, 0, 7); g.fill();
    // the arm comes up to aim while this side is firing
    const busy = sc.events.filter((e) => e.from === s && t > e.at - 0.45 && t < e.at + 0.25), melee = busy.some((e) => e.cat === 'melee');
    const aim = busy.length ? (melee ? -1.6 + Math.min(1, Math.max(0, (t - busy[0].at + 0.1) * 6)) * 1.4 : -0.95) : 0;
    mech(g, { ...u, hp: sc['hp' + s] }, SIDE[u.side], t, { flash: flash[s], walk: 0, aim });
    g.restore();
  }
  // shots in flight
  for (const e of sc.events) {
    const a = pos[e.from], b = pos[e.from === 'L' ? 'R' : 'L'], dt = e.at - t; if (e.cat === 'melee') continue;
    const fly = e.cat === 'long' ? 0.55 : 0.16; if (dt < 0 || dt > fly) continue;
    const k = 1 - dt / fly, sx = a.x + a.f * 60 * scale, sy = a.y - (e.cat === 'long' ? 150 : 100) * scale, ex = b.x - b.f * (e.miss ? -120 : 10) * scale, ey = b.y - (PART_Y[e.part] || 100) * scale + (e.miss ? -40 : 0);
    const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k - (e.cat === 'long' ? Math.sin(k * Math.PI) * 120 : 0);
    if (e.cat === 'long') { g.fillStyle = '#ddd'; g.save(); g.translate(x, y); g.rotate(Math.atan2(ey - sy - Math.cos(k * Math.PI) * 120 * Math.PI, (ex - sx))); g.fillRect(-12, -3, 24, 6); g.restore(); g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(x - a.f * 14, y, 5, 0, 7); g.fill(); }
    else { g.strokeStyle = '#ffe98a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (ex - sx) * 0.06, y - (ey - sy) * 0.06); g.stroke(); }
    if (k < 0.2) { g.fillStyle = '#fff6a0'; g.beginPath(); g.arc(sx, sy, 12 * (1 - k * 4), 0, 7); g.fill(); } // muzzle flash
  }
  // hits, misses and the numbers
  for (const e of sc.events) {
    const dt = t - e.at; if (dt < 0 || dt > 0.9) continue;
    const b = pos[e.from === 'L' ? 'R' : 'L'], x = b.x + ((e.n % 5) - 2) * 34, y = b.y - (e.miss ? 150 : PART_Y[e.part]) * scale - (e.n % 2) * 22 - dt * 50;
    if (!e.miss && dt < 0.25) { g.fillStyle = `rgba(255,${180 - dt * 400},60,${1 - dt * 4})`; g.beginPath(); g.arc(b.x - b.f * 10, b.y - PART_Y[e.part] * scale, (e.cat === 'long' ? 50 : 22) * (0.5 + dt * 3), 0, 7); g.fill(); }
    g.globalAlpha = Math.min(1, (0.9 - dt) * 3); g.font = `900 ${e.broke ? 26 : 22}px "Arial Black", sans-serif`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#111';
    const s = e.miss ? txt.miss : `${txt[e.part]} ${e.dmg}${e.broke ? ' ' + txt.destroyed : ''}`; g.strokeText(s, x, y); g.fillStyle = e.miss ? '#c8d8e8' : e.broke ? '#ff6a3a' : '#ffe14a'; g.fillText(s, x, y); g.globalAlpha = 1;
  }
  // explosions for the destroyed
  for (const s of ['L', 'R']) if (sc.dead?.[s] && t > sc.deadAt) { const k = t - sc.deadAt, p = pos[s]; for (let j = 0; j < 5; j++) { const r = (30 + j * 14) * Math.min(1, k * 2) * scale; g.fillStyle = `rgba(255,${120 + j * 25},40,${Math.max(0, 0.8 - k * 0.6)})`; g.beginPath(); g.arc(p.x + Math.sin(j * 2.1) * 40 * scale, p.y - (70 + Math.cos(j * 1.7) * 40) * scale, r, 0, 7); g.fill(); } }
  // the two panels of part health
  const pw = Math.min(220, W / 2 - 18); panel(g, 10, 50, sc.L, sc.hpL, txt, sc.nameL, pw); panel(g, W - pw - 10, 50, sc.R, sc.hpR, txt, sc.nameR, pw);
  if (sc.label) { g.font = `700 ${W < 500 ? 14 : 18}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#0008'; g.lineWidth = 4; g.strokeText(sc.label, W / 2, 30); g.fillText(sc.label, W / 2, 30); }
}
const PART_Y = { body: 110, armL: 120, armR: 100, legs: 40 };
function panel(g, x, y, u, hp, txt, name, pw = 220) {
  const bw = pw - 110; g.fillStyle = '#0a1018cc'; g.beginPath(); g.roundRect(x, y, pw, 112, 10); g.fill();
  g.font = '700 15px sans-serif'; g.textAlign = 'left'; g.fillStyle = u.side === 'p' ? '#8ac8ff' : '#ff9a7a'; g.fillText(name, x + 10, y + 21);
  ['body', 'armL', 'armR', 'legs'].forEach((p, i) => {
    const yy = y + 36 + i * 19, k = Math.max(0, hp[p]) / u.max[p];
    g.fillStyle = '#c8d0d8'; g.font = '12px sans-serif'; g.fillText(txt[p], x + 10, yy + 9);
    g.fillStyle = '#000'; g.fillRect(x + 62, yy, bw, 10); g.fillStyle = k <= 0 ? '#555' : k > 0.5 ? '#5ad05a' : k > 0.25 ? '#f0c040' : '#f05040'; g.fillRect(x + 62, yy, bw * k, 10);
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(Math.max(0, Math.round(hp[p])), x + pw - 10, yy + 9); g.textAlign = 'left';
  });
}
