// Wanzers as jointed machines, drawn as pixel art every frame.
// A small rasteriser fills polygons on whole pixels (no blurred edges), so a limb can turn at any angle and still
// come out as crisp pixels; then every sprite gets a dark outline. The skeleton: hips, thighs, knees, shins, feet;
// a boxy torso with a cockpit; shoulders, upper arms, forearms, hands and what they hold. The pose (walking stride,
// aiming, recoil, a flinch) moves the joints; the feet are kept on the ground.
import { ITEM } from './data.js';

const rgba = (h, a = 255) => (a << 24) | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16);
class Spr {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d'); this.img = this.g.createImageData(w, h); }
  clear() { this.d.fill(0); }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  poly(p, c) {
    let y0 = Infinity, y1 = -Infinity; for (const q of p) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, c);
    }
  }
  line(a, b, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])))); for (let i = 0; i <= n; i++) this.px(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, c); }
  // a checker of colour c over the pixels already painted inside a rectangle [x0, y0, x1, y1]
  dither(r, c) { for (let y = Math.ceil(r[1]); y < r[3]; y++) for (let x = Math.ceil(r[0]); x < r[2]; x++) { const i = y * this.w + x; if (x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[i] && (x + y) % 2 === 0) this.d[i] = c; } }
  stroke(p, c) { for (let i = 0; i < p.length; i++) this.line(p[i], p[(i + 1) % p.length], c); }
  disc(x, y, r, c) { for (let yy = Math.floor(-r); yy <= Math.ceil(r); yy++) for (let xx = Math.floor(-r); xx <= Math.ceil(r); xx++) if (xx * xx + yy * yy <= r * r + 0.3) this.px(x + xx, y + yy, c); }
  // a limb: a band from a to b, wa wide at a and wb at b, lit along its upper edge and shaded along the lower
  seg(a, b, wa, wb, C) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const p = [[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2], [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]];
    this.poly(p, C.base);
    const up = ny < 0 || (ny === 0 && nx < 0) ? 1 : -1; // the side facing up and left catches the light
    const k1 = (wa / 2 - 0.6), k2 = (wb / 2 - 0.6);
    this.line([a[0] + nx * k1 * up, a[1] + ny * k1 * up], [b[0] + nx * k2 * up, b[1] + ny * k2 * up], C.lite);
    this.line([a[0] - nx * k1 * up, a[1] - ny * k1 * up], [b[0] - nx * k2 * up, b[1] - ny * k2 * up], C.shade);
  }
  outline(c) {
    const W = this.w, H = this.h, d = this.d, o = new Uint32Array(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (d[i]) continue; if ((x > 0 && d[i - 1]) || (x < W - 1 && d[i + 1]) || (y > 0 && d[i - W]) || (y < H - 1 && d[i + W])) o[i] = c; }
    this.d = o;
  }
  flip() { const W = this.w; for (let y = 0; y < this.h; y++) { const r = this.d.subarray(y * W, y * W + W); r.reverse(); } }
  done() { new Uint32Array(this.img.data.buffer).set(this.d); this.g.putImageData(this.img, 0, 0); return this.c; }
}

// palettes: each tone set has dark, shade, base, lite, hi
const tone = (dark, shade, base, lite, hi) => ({ dark: rgba(dark), shade: rgba(shade), base: rgba(base), lite: rgba(lite), hi: rgba(hi) });
const PALS = {
  p: { body: tone('#26301a', '#3e4e26', '#627a38', '#88a250', '#b4cc7a'), far: tone('#1e2614', '#2e3a1c', '#4a5c2a', '#627a38', '#88a250'), trim: rgba('#d8b040') },
  e: { body: tone('#2c2a26', '#4c4a44', '#76736a', '#a29e94', '#cecbc2'), far: tone('#22201c', '#36342f', '#58564e', '#76736a', '#a29e94'), trim: rgba('#d06a28') },
};
const METAL = tone('#1c1d20', '#2e3034', '#46484e', '#686a72', '#9a9ca4'), METAL_FAR = tone('#161719', '#24262a', '#36383c', '#4e5056', '#686a72');
const DEAD = tone('#1a1816', '#262420', '#34302c', '#3e3a34', '#4a4640');
const WHITE = tone('#c8c8c8', '#e0e0e0', '#ffffff', '#ffffff', '#ffffff');
const INK = rgba('#0c0b08'), GLASS = rgba('#1e2c36'), GLASS_HI = rgba('#7aa2bc'), EYE = rgba('#ff4a30'), EYE2 = rgba('#ff9a60'), FLASH = rgba('#fff2b0'), FLASH2 = rgba('#ffb040'), SPARK = rgba('#ffd040'), JET = rgba('#6ad0f0');

// pose: { phase, walk (0..1), aim (0..1), recoil, muzzle, flinch (-1..1), t (seconds), face, flash: {part: on} }
// s: size (1 on the map, about 2.4 in the battle scene). Returns a canvas with the feet at (ax, ay).
// Proportions (at s = 1): feet 8 long, shins 9, thighs 7, hips 3, torso 9 tall, head 4; big shoulder pads either side.
export function drawWanzer(u, pose, s, spr) {
  const S = spr; S.clear(); S.trim = PALS[u.side].trim;
  const ax = S.w / 2 - 3 * s, ay = S.h - 3 * s;
  const P = PALS[u.side], legs = ITEM[u.legs], t = pose.t || 0, w = pose.walk || 0, ph = pose.phase || 0, aim = pose.aim || 0;
  const broken = (p) => u.hp[p] <= 0, fl = pose.flash || {};
  const col = (part, C) => (fl[part] ? WHITE : broken(part) ? DEAD : C);
  const breathe = Math.round(Math.sin(t * 2.2) * 0.5 * s * (1 - w));
  const fx = (pose.flinch || 0) * 1.2 * s;
  const box = (p, C, edge = true) => { S.poly(p, C.base); if (edge) S.stroke(p, C.dark); };
  // ---- legs. Angles from straight down, + is forward. The hips sit as high as the straighter leg allows, so the
  //      foot that bears the weight stays on the ground while the other swings through.
  const L1 = 7 * s, L2 = 9 * s, FOOT = 2.5 * s;
  const lame = broken('legs') ? 0.35 : 1;
  const leg = (p) => { const th = 0.5 * Math.sin(p) * w * lame, bend = 0.12 + 1.0 * w * lame * Math.max(0, Math.cos(p)); return { th, sh: th - bend }; };
  const nearL = leg(ph), farL = leg(ph + Math.PI);
  const height = (l) => Math.cos(l.th) * L1 + Math.cos(l.sh) * L2 + FOOT;
  const hipX = ax + fx;
  let hipY;
  if (legs.tread) hipY = ay - 13 * s; else if (legs.hover) hipY = ay - 12 * s - Math.round(Math.sin(t * 4) * 0.6 * s); else hipY = ay - Math.max(height(nearL), height(farL)) + breathe * 0.5;
  const LC = (C) => col('legs', C);
  const drawLeg = (l, dx, C, M) => {
    const hip = [hipX + dx, hipY], knee = [hip[0] + Math.sin(l.th) * L1, hip[1] + Math.cos(l.th) * L1], ank = [knee[0] + Math.sin(l.sh) * L2, knee[1] + Math.cos(l.sh) * L2];
    S.seg(hip, knee, 3.6 * s, 3.2 * s, LC(M)); // thigh: a bare metal frame
    S.disc(hip[0], hip[1], 1.6 * s, LC(M).lite);
    S.line([hip[0] + 1.6 * s, hip[1] + 1 * s], [knee[0] + 1.6 * s, knee[1] - 1.5 * s], LC(M).hi); // a hydraulic piston
    // the shin: an armour plate, wide at the top
    const dx2 = Math.sin(l.sh), dy2 = Math.cos(l.sh), nx = -dy2, ny = dx2, k = knee, a = ank;
    const shin = [[k[0] - nx * 2.8 * s - dx2 * 1.2 * s, k[1] - ny * 2.8 * s - dy2 * 1.2 * s], [k[0] + nx * 2.8 * s - dx2 * 1.2 * s, k[1] + ny * 2.8 * s - dy2 * 1.2 * s], [a[0] + nx * 2 * s, a[1] + ny * 2 * s], [a[0] - nx * 2 * s, a[1] - ny * 2 * s]];
    box(shin, LC(C)); S.line(shin[0], shin[3], LC(C).lite);
    const q = (f, o) => [k[0] + (a[0] - k[0]) * f + nx * o * s, k[1] + (a[1] - k[1]) * f + ny * o * s];
    S.line(q(0.42, -2.2), q(0.42, 2.2), LC(C).dark); S.line(q(0.46, -2), q(0.46, 2), LC(C).lite); // an armour seam
    S.px(...q(0.2, 1.2), LC(C).dark); if (s > 1.5) { S.px(...q(0.75, 1.1), LC(C).dark); S.px(...q(0.75, -1.1), LC(C).dark); }
    // knee guard
    const kg = [[k[0] + 0.5 * s, k[1] - 2.2 * s], [k[0] + 3 * s, k[1] - 1.4 * s], [k[0] + 3 * s, k[1] + 1.4 * s], [k[0] + 0.5 * s, k[1] + 2 * s]];
    box(kg, LC(C)); S.px(kg[0][0] + 0.5, kg[0][1] + 0.5, LC(C).hi);
    // the foot: toe forward, heel back; it tips up a little while the leg swings
    const lift = Math.max(0, (ay - FOOT) - a[1]) > 0.6, tip = lift ? 0.8 * s : 0, fy = a[1];
    const foot = [[a[0] - 3 * s, fy - 1.2 * s], [a[0] + 2.5 * s, fy - 1.6 * s], [a[0] + 5.5 * s, fy + FOOT - 0.6 - tip], [a[0] + 5 * s, fy + FOOT - tip * 0.2], [a[0] - 3.2 * s, fy + FOOT]];
    box(foot, LC(M)); S.line(foot[0], foot[1], LC(M).lite);
    S.disc(a[0], a[1] - 0.4 * s, 1.2 * s, LC(M).shade);
  };
  // ---- torso
  const lean = Math.round(w * 1 * s + aim * 0.5 * s), by = hipY - 2.5 * s + breathe, ty = by - 9 * s, cx = hipX + 0.5 * s + lean;
  const fl0 = cx - 3 * s, fr = cx + 6 * s, sl = cx - 7 * s, back = 2.5 * s;
  // ---- arms
  const sw = 0.42 * w;
  const armA = (p, aiming) => aiming ? { u: 1.05 + aim * 0.3, f: Math.PI / 2 - (pose.recoil || 0) * 0.3 } : { u: 0.08 + Math.sin(p) * sw, f: 0.55 + Math.sin(p) * sw * 1.3 };
  const shN = [fr - 0.5 * s, ty + 2 * s], shF = [sl + 1.5 * s, ty + 0.5 * s];
  const armJ = (sh, a, k) => { const el = [sh[0] + Math.sin(a.u) * 6 * s * k, sh[1] + Math.cos(a.u) * 6 * s * k], hd = [el[0] + Math.sin(a.f) * 7 * s * k, el[1] + Math.cos(a.f) * 7 * s * k]; return { sh, el, hd, a }; };
  const near = armJ(shN, armA(ph + Math.PI, aim > 0.05), 1), far = armJ(shF, armA(ph, false), 0.9);

  // back to front: far arm, far leg, launcher, hips, near leg, torso, head, near arm
  if (!broken('armL')) { drawArm(S, far, col('armL', P.far), col('armL', METAL_FAR), 0.9, s, box); holding(S, u, 'wL', far, s, true); }
  if (legs.tread) drawTread(S, hipX, ay, s, LC(P.body), t, w, box);
  else if (legs.hover) drawHover(S, hipX, ay, hipY, s, LC(P.body), t, box);
  else drawLeg(farL, -3.5 * s, P.far, METAL_FAR);
  if (u.sh) drawLauncher(S, sl, ty, back, s, col('body', METAL), u, box);
  box([[hipX - 5 * s, hipY - 2.5 * s], [hipX + 5 * s, hipY - 2.5 * s], [hipX + 4 * s, hipY + 2 * s], [hipX - 4 * s, hipY + 2 * s]], METAL);
  if (!legs.tread && !legs.hover) drawLeg(nearL, 3 * s, P.body, METAL);
  const C = col('body', P.body);
  // the torso box: its left side in shade, the front, the top in light
  const side = [[sl, ty - back], [fl0, ty], [fl0, by], [sl, by - back]], front = [[fl0, ty], [fr, ty], [fr, by - 1.5 * s], [fr - 1.5 * s, by], [fl0, by]], top = [[sl, ty - back], [fl0 - 1 * s, ty - back - 0.5 * s], [fr - 3 * s, ty - back - 0.5 * s], [fr, ty], [fl0, ty]];
  S.poly(side, C.shade); S.poly(front, C.base); S.poly(top, C.lite);
  S.dither([fl0, by - 3 * s, fr, by], C.shade); S.dither([sl, by - back - 3 * s, fl0, by], C.dark);
  S.stroke(side, C.dark); S.stroke(front, C.dark); S.stroke(top, C.dark);
  S.line([fl0 + 1, ty + 1], [fr - 1, ty + 1], C.hi);
  // chest plate, vents, the cockpit glass, a stripe of paint, rivets
  const midY = ty + 5 * s;
  S.line([fl0 + 1 * s, midY], [fr - 1.5 * s, midY], C.dark);
  for (let k = 0; k < 3; k++) S.line([fl0 + (1.4 + k * 1.5) * s, midY + 1.3 * s], [fl0 + (1.4 + k * 1.5) * s, by - 1 * s], C.shade);
  const glass = [[fr - 4.5 * s, ty + 1.2 * s], [fr - 0.6 * s, ty + 1.2 * s], [fr - 0.6 * s, ty + 3.8 * s], [fr - 4.5 * s, ty + 3.8 * s]];
  S.poly(glass, fl.body ? WHITE.base : GLASS); S.line([fr - 4 * s, ty + 1.7 * s], [fr - 2.2 * s, ty + 1.7 * s], GLASS_HI);
  S.line([sl + 1 * s, ty + 2 * s], [fl0 - 1 * s, ty + 3 * s], P.trim); S.line([sl + 1 * s, ty + 2 * s + 1], [fl0 - 1 * s, ty + 3 * s + 1], P.trim);
  if (s > 1.5) { for (let k = 0; k < 4; k++) S.px(fl0 + (1 + k * 2.2) * s, by - 0.8 * s, C.dark); S.px(sl + 1.2 * s, by - back - 1.5 * s, C.dark); S.px(sl + 1.2 * s, ty - back + 2 * s, C.dark); }
  // the head, on a short neck, set back a little
  const hx = cx - 0.5 * s, hy = ty - back - 0.5 * s;
  S.seg([hx, hy + 1 * s], [hx, hy - 1 * s], 2 * s, 2 * s, METAL);
  const head = [[hx - 2.5 * s, hy - 1 * s], [hx + 3 * s, hy - 1 * s], [hx + 3.5 * s, hy - 3.5 * s], [hx + 1 * s, hy - 5 * s], [hx - 2.5 * s, hy - 4 * s]];
  box(head, C); S.line(head[4], head[3], C.hi);
  S.line([hx, hy - 2.6 * s], [hx + 3.2 * s, hy - 2.6 * s], INK);
  S.px(hx + 2.4 * s, hy - 2.6 * s, Math.floor(t * 2) % 2 ? EYE : EYE2); if (s > 1.5) S.px(hx + 2.4 * s + 1, hy - 2.6 * s, EYE);
  if (s > 1.5) S.line([hx - 1 * s, hy - 5 * s], [hx - 1.5 * s, hy - 7.5 * s], METAL.lite); // an antenna
  // the near arm and what it holds
  if (!broken('armR')) { drawArm(S, near, col('armR', P.body), col('armR', METAL), 1, s, box); holding(S, u, 'wR', near, s, false, pose); }
  else { S.disc(shN[0], shN[1] + 1 * s, 2 * s, METAL.shade); if (Math.floor(t * 8) % 2) { S.px(shN[0] + 2 * s, shN[1], SPARK); S.px(shN[0] + 3 * s, shN[1] - 1 * s, SPARK); S.px(shN[0] + 1 * s, shN[1] + 3 * s, SPARK); } }
  S.outline(INK);
  if (pose.face < 0) S.flip();
  return { c: S.done(), ax: pose.face < 0 ? S.w - ax : ax, ay };
}
// an arm: a bare upper arm, an elbow, an armoured forearm, a hand, and the big shoulder pad over the top
function drawArm(S, j, C, M, k, s, box) {
  S.seg(j.sh, j.el, 2.6 * s * k, 2.4 * s * k, M);
  S.disc(j.el[0], j.el[1], 1.5 * s * k, M.lite);
  const dx = Math.sin(j.a.f), dy = Math.cos(j.a.f), nx = -dy, ny = dx, e = j.el, h = j.hd;
  const fore = [[e[0] - nx * 2 * s * k, e[1] - ny * 2 * s * k], [e[0] + nx * 2 * s * k, e[1] + ny * 2 * s * k], [h[0] + nx * 2.2 * s * k, h[1] + ny * 2.2 * s * k], [h[0] - nx * 2.2 * s * k, h[1] - ny * 2.2 * s * k]];
  box(fore, C); S.line(fore[0], fore[3], C.lite);
  const fb = (f, o) => [e[0] + (h[0] - e[0]) * f + nx * o * s * k, e[1] + (h[1] - e[1]) * f + ny * o * s * k];
  S.line(fb(0.55, -2), fb(0.55, 2), C.dark); S.line(fb(0.62, -2), fb(0.62, 2), C.shade);
  S.disc(h[0] + dx * 0.8 * s, h[1] + dy * 0.8 * s, 1.5 * s * k, M.base);
  const p = j.sh, pad = [[p[0] - 3.5 * s * k, p[1] - 2.5 * s], [p[0] + 2.5 * s * k, p[1] - 3.5 * s], [p[0] + 3.8 * s * k, p[1] + 0.5 * s], [p[0] + 2.5 * s * k, p[1] + 3 * s], [p[0] - 3 * s * k, p[1] + 2.5 * s]];
  box(pad, C); S.line(pad[0], pad[1], C.hi); S.line(pad[4], pad[3], C.shade);
  S.line([p[0] - 2.5 * s * k, p[1] + 0.8 * s], [p[0] + 2.8 * s * k, p[1] + 0.2 * s], S.trim);
  if (s > 1.5) S.px(p[0] - 1.5 * s, p[1], C.dark);
}
// what the hand holds, laid along the forearm
function holding(S, u, slot, j, s, farSide, pose = {}) {
  const w = u[slot] && ITEM[u[slot]]; if (!w) return;
  const M = farSide ? METAL_FAR : METAL, a = j.a.f, dx = Math.sin(a), dy = Math.cos(a), h = j.hd;
  const at = (d, o = 0) => [h[0] + dx * d - dy * o, h[1] + dy * d + dx * o];
  if (w.cat === 'shield') { const L = (w.id === 'SH2' ? 15 : 11) * s, p = [at(-L * 0.5, -3.5 * s), at(L * 0.5, -3.5 * s), at(L * 0.55, 1.5 * s), at(-L * 0.55, 1.5 * s)]; S.poly(p, M.base); S.stroke(p, M.dark); S.line(p[0], p[1], M.lite); S.line(at(-L * 0.4, -1 * s), at(L * 0.4, -1 * s), M.shade); return; }
  if (w.cat === 'melee') {
    if (w.id === 'KN1') { S.disc(h[0] + dx * 2 * s, h[1] + dy * 2 * s, 2.6 * s, M.lite); S.disc(h[0] + dx * 2 * s, h[1] + dy * 2 * s, 1.6 * s, M.base); return; }
    const up = [h[0] + 2 * s, h[1] - 10 * s], down = [h[0] - 0.5 * s, h[1] + 3 * s];
    S.seg(down, up, 1.6 * s, 1.4 * s, M);
    if (w.id === 'AX1') { const p = [[up[0] - 0.5 * s, up[1] + 1 * s], [up[0] + 5 * s, up[1] - 1.5 * s], [up[0] + 6 * s, up[1] + 3.5 * s], [up[0] + 0.5 * s, up[1] + 4 * s]]; S.poly(p, METAL.lite); S.stroke(p, METAL.dark); S.line(p[1], p[2], METAL.hi); }
    if (w.id === 'RD1') S.seg([up[0], up[1] + 3 * s], up, 2 * s, 2 * s, { base: JET, lite: rgba('#c8f4ff'), shade: rgba('#3a9ac8') });
    return;
  }
  // a gun: the body at the hand, then the barrel; a magazine underneath, a scope on the sniper rifle
  const len = { MG1: 9, MG2: 10, SG1: 7, RF1: 11, RF2: 14 }[w.id] || 9, th = (w.id === 'SG1' || w.id === 'MG2' ? 3.4 : 2.6) * s;
  const body = [at(-2.5 * s, -th / 2 - 0.5 * s), at(4.5 * s, -th / 2 - 0.5 * s), at(4.5 * s, th / 2 + 0.5 * s), at(-2.5 * s, th / 2 + 0.5 * s)];
  S.poly(body, M.base); S.stroke(body, M.dark); S.line(body[0], body[1], M.lite);
  S.seg(at(4.5 * s), at(len * s), th * 0.6, th * 0.5, M);
  if (w.shots > 4) { const mg = [at(0, th / 2), at(2.5 * s, th / 2), at(2 * s, th / 2 + 3 * s), at(-0.5 * s, th / 2 + 3 * s)]; S.poly(mg, M.shade); S.stroke(mg, M.dark); }
  if (w.id === 'RF2') S.seg(at(0.5 * s, -th * 0.9), at(4.5 * s, -th * 0.9), 1.4 * s, 1.4 * s, M);
  if (pose.muzzle) { const m = at(len * s + 1.8 * s); S.disc(m[0], m[1], 2.4 * s, FLASH2); S.disc(m[0] + dx * s, m[1] + dy * s, 1.4 * s, FLASH); S.px(m[0] + dx * 3.6 * s, m[1] + dy * 3.6 * s, FLASH); S.px(m[0] + dx * 1.5 * s - dy * 2.5 * s, m[1] + dy * 1.5 * s + dx * 2.5 * s, FLASH2); }
}
function drawLauncher(S, sl, ty, back, s, C, u, box) {
  const x0 = sl - 1.5 * s, y0 = ty - back - 6 * s, wd = 8 * s, ht = 5.5 * s;
  S.line([x0 + 2 * s, y0 + ht], [x0 + 3 * s, ty - back + 1], C.dark);
  const p = [[x0, y0 + 0.5 * s], [x0 + wd, y0 - 0.5 * s], [x0 + wd, y0 + ht - 0.5 * s], [x0, y0 + ht + 0.5 * s]];
  box(p, C); S.line(p[0], p[1], C.lite);
  const n = u.sh === 'RK1' ? 3 : 2;
  for (let k = 0; k < n; k++) S.disc(x0 + wd - 1.2 * s, y0 + 1.4 * s + k * (ht - 2.6 * s) / Math.max(1, n - 1), 0.9 * s, INK);
  S.line([x0 + 1 * s, y0 + 1.5 * s], [x0 + 4 * s, y0 + 1.2 * s], P_YEL);
}
const P_YEL = rgba('#c8a838');
function drawTread(S, x, ay, s, C, t, w, box) {
  const y0 = ay - 7 * s, base = [[x - 12 * s, y0], [x + 12 * s, y0], [x + 14 * s, y0 + 3.5 * s], [x + 11 * s, ay], [x - 11 * s, ay], [x - 14 * s, y0 + 3.5 * s]];
  S.poly(base, METAL.shade); S.stroke(base, METAL.dark);
  const roll = (t * 14 * (w > 0.05 ? 1 : 0)) % 3;
  for (let k = -12; k <= 12; k += 3) { S.px(x + (k + roll) * s, y0 + 0.6, METAL.lite); S.px(x + (k - roll) * s, ay - 0.6, METAL.dark); }
  for (let k = -9; k <= 9; k += 6) { S.disc(x + k * s, y0 + 3.6 * s, 2.3 * s, METAL.base); S.disc(x + k * s, y0 + 3.6 * s, 0.9 * s, METAL.dark); }
  const top = [[x - 8 * s, y0 - 6 * s], [x + 8 * s, y0 - 6 * s], [x + 9 * s, y0], [x - 9 * s, y0]];
  box(top, C); S.line(top[0], top[1], C.lite);
}
function drawHover(S, x, ay, hipY, s, C, t, box) {
  const y0 = ay - 6 * s, skirt = [[x - 11 * s, y0], [x + 11 * s, y0], [x + 9 * s, ay - 2 * s], [x - 9 * s, ay - 2 * s]];
  S.poly(skirt, C.shade); S.stroke(skirt, C.dark); S.line(skirt[0], skirt[1], C.lite);
  if (Math.floor(t * 12) % 2) S.line([x - 8 * s, ay - 1 * s], [x + 8 * s, ay - 1 * s], JET);
  const col = [[x - 5 * s, hipY], [x + 5 * s, hipY], [x + 6 * s, y0], [x - 6 * s, y0]];
  box(col, C); S.line(col[0], col[3], C.lite);
}

// every unit keeps its own drawing surface, and an animation clock
const surf = new WeakMap();
export function wanzerSprite(u, s, pose) {
  const key = s > 1.5 ? 'big' : 'small';
  let m = surf.get(u); if (!m) { m = {}; surf.set(u, m); }
  if (!m[key]) m[key] = new Spr(Math.ceil(64 * s), Math.ceil(54 * s));
  return drawWanzer(u, pose, s, m[key]);
}
