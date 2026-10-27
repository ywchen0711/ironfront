// Wanzers as jointed machines, drawn as pixel art every frame.
// A small rasteriser fills shapes on whole pixels. Every surface is shaded the way a pixel artist would: a ramp of
// seven tones per material (cool in the shadows, warm in the light), round limbs lit like cylinders with a glint,
// flat plates lit by their facing, the steps between tones broken up by ordered dithering, and contact shadows
// where one part sits behind another. No black outline: the edges come from the shading.
// The skeleton: hips, thighs, knees, shins, feet; a squat boxy torso with a cockpit; big shoulder pads, upper arms,
// forearms, hands and what they hold. The pose moves the joints; the feet stay on the ground.
import { ITEM } from './data.js?v=16';

const rgba = (h) => (255 << 24) | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16);
const ramp = (...hs) => hs.map(rgba);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
// a tone from a ramp for lightness v (0..1) at pixel (x, y), dithered between neighbouring steps
// (small sprites get clean bands instead: dithering at that size only looks like noise)
let DITHER = true;
const toneAt = (R, v, x, y) => { const f = Math.max(0, Math.min(0.999, v)) * (R.length - 1), i = Math.floor(f), k = f - i; return R[Math.min(R.length - 1, i + (k > (DITHER ? BAYER[(y & 3) * 4 + (x & 3)] : 0.5) ? 1 : 0))]; };
const LX = -0.55, LY = -0.83; // the light comes from the upper left

class Spr {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d'); this.img = this.g.createImageData(w, h); }
  clear() { this.d.fill(0); }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  // fill a polygon; c is a colour or a function of (x, y)
  poly(p, c) {
    let y0 = Infinity, y1 = -Infinity; for (const q of p) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const fn = typeof c === 'function';
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, fn ? c(x, y) : c);
    }
  }
  line(a, b, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])))); for (let i = 0; i <= n; i++) this.px(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, c); }
  disc(x, y, r, c) { for (let yy = Math.floor(-r); yy <= Math.ceil(r); yy++) for (let xx = Math.floor(-r); xx <= Math.ceil(r); xx++) if (xx * xx + yy * yy <= r * r + 0.3) this.px(x + xx, y + yy, typeof c === 'function' ? c(Math.round(x + xx), Math.round(y + yy)) : c); }
  // a ball joint, lit from the upper left with a glint
  ball(x, y, r, R) { this.disc(x, y, r, (px, py) => { const dx = (px - x) / r, dy = (py - y) / r; return toneAt(R, 0.5 - (dx * LX + dy * LY) * 0.45 - (dx * dx + dy * dy) * 0.15, px, py); }); if (r > 1.6) this.px(x - r * 0.4, y - r * 0.45, R[R.length - 1]); }
  // a round limb from a to b, wa wide at a and wb at b: lit across its width like a cylinder
  tube(a, b, wa, wb, R, base = 0.5) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, side = nx * LX + ny * LY > 0 ? -1 : 1;
    const p = [[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2], [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]];
    this.poly(p, (x, y) => {
      const rx = x + 0.5 - a[0], ry = y + 0.5 - a[1], t = Math.max(0, Math.min(1, (rx * dx + ry * dy) / (L * L))), half = (wa + (wb - wa) * t) / 2;
      const u = (rx * nx + ry * ny) / Math.max(0.5, half) * side; // -1 on the lit side, +1 on the dark side
      return toneAt(R, base + 0.38 * -u - (u > 0.75 ? 0.12 : 0) + (u > -0.75 && u < -0.35 ? 0.14 : 0), x, y);
    });
  }
  // a flat plate: its lightness falls off from the top-left of its box; a bright edge where light catches it
  plate(p, R, v, fall = 0.18) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    this.poly(p, (x, y) => toneAt(R, v - ((x - x0) / w * 0.35 + (y - y0) / h * 0.65) * fall, x, y));
    let cx = 0, cy = 0; for (const q of p) { cx += q[0] / p.length; cy += q[1] / p.length; }
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1;
      let nx = ey / L, ny = -ex / L; if (nx * (a[0] - cx) + ny * (a[1] - cy) < 0) { nx = -nx; ny = -ny; } // the outward side of this edge
      const facing = nx * LX + ny * LY;
      if (facing > 0.35) this.line(a, b, R[Math.min(R.length - 1, Math.round(v * (R.length - 1)) + 1)]);
      else if (facing < -0.45) this.line(a, b, R[Math.max(0, Math.round(v * (R.length - 1)) - 2)]);
    }
  }
  // darken what is already painted near a point: the shadow one part casts on another
  shadow(x, y, r, k = 1) { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const d = Math.hypot(xx, yy) / r; if (d > 1 || ((xx + yy) & 1 && d > 0.6)) continue; const X = Math.round(x + xx), Y = Math.round(y + yy), i = Y * this.w + X; if (X < 0 || Y < 0 || X >= this.w || Y >= this.h || !this.d[i]) continue; const c = this.d[i], f = 1 - 0.22 * k * (1 - d); this.d[i] = (255 << 24) | ((((c >> 16) & 255) * f) << 16) | ((((c >> 8) & 255) * f) << 8) | ((c & 255) * f); } }
  flip() { const W = this.w; for (let y = 0; y < this.h; y++) this.d.subarray(y * W, y * W + W).reverse(); }
  done() { new Uint32Array(this.img.data.buffer).set(this.d); this.g.putImageData(this.img, 0, 0); return this.c; }
}

// the materials: seven steps from the deepest shadow to the brightest light
const PALS = {
  p: { paint: ramp('#141c10', '#22301a', '#364a24', '#4e6830', '#6a8a40', '#90ae5a', '#c4d88e'), far: ramp('#10160c', '#1a2414', '#28381c', '#384e26', '#4c6830', '#62823c', '#86a456'), trim: ramp('#4a3410', '#7a5a1c', '#b08a2e', '#d8b44a', '#f0d478') },
  e: { paint: ramp('#1a1a1e', '#2a2a30', '#403f44', '#5c5a5c', '#7e7a76', '#a8a298', '#d8d2c4'), far: ramp('#141418', '#202024', '#302f34', '#444246', '#5c5a5c', '#7a7672', '#9a958c'), trim: ramp('#4a1a08', '#7a2e10', '#b04a1c', '#d86a2a', '#f09a50') },
};
const METAL = ramp('#121317', '#1c1e23', '#2a2d34', '#3c4048', '#545a64', '#7a808a', '#b0b6be');
const METAL_FAR = ramp('#0e0f12', '#16171b', '#202228', '#2c2f36', '#3c4048', '#545a64', '#747a84');
const DEAD = ramp('#100e0c', '#1a1714', '#24201c', '#2e2924', '#38322c', '#443c34', '#52483e');
const WHITE = ramp('#c8c8c0', '#dcdcd4', '#ecece4', '#f8f8f0', '#ffffff', '#ffffff', '#ffffff');
const GLASS = ramp('#0c141a', '#142028', '#1e3038', '#2c4450', '#466676', '#7aa2b8', '#c8e4f0');
const JETS = ramp('#1a3a4a', '#2a6a8a', '#3a9ac8', '#6ad0f0', '#b8f0ff', '#e8fcff', '#ffffff');
const INK = rgba('#0c0b08'), EYE = rgba('#ff4a30'), EYE2 = rgba('#ffb070'), FLASH = rgba('#fff2b0'), FLASH2 = rgba('#ffb040'), SPARK = rgba('#ffd040');

// pose: { phase, walk (0..1), aim (0..1), recoil, muzzle, flinch (-1..1), t (seconds), face, flash: {part: on} }
// s: size (1 on the map, about 2.4 in the battle scene). Returns a canvas with the feet at (ax, ay).
// Proportions at s = 1: feet 9 long, shins 6.5, thighs 5, hips 4, torso 8 tall and 16 wide, head 4: a squat machine.
export function drawWanzer(u, pose, s, spr) {
  const S = spr; S.clear(); DITHER = s > 1.5;
  const ax = Math.round(S.w / 2 - 3 * s), ay = S.h - Math.round(3 * s);
  const P = PALS[u.side], legs = ITEM[u.legs], t = pose.t || 0, w = pose.walk || 0, ph = pose.phase || 0, aim = pose.aim || 0;
  const broken = (p) => u.hp[p] <= 0, fl = pose.flash || {};
  const mat = (part, R) => (fl[part] ? WHITE : broken(part) ? DEAD : R);
  const breathe = Math.round(Math.sin(t * 2.2) * 0.5 * s * (1 - w));
  const fx = Math.round((pose.flinch || 0) * 1.2 * s);
  // ---- legs: angles from straight down (+ forward); the hips ride as high as the straighter leg allows
  const L1 = 5 * s, L2 = 6.5 * s, FOOT = 2.5 * s, lame = broken('legs') ? 0.35 : 1;
  const leg = (p) => { const th = 0.55 * Math.sin(p) * w * lame, bend = 0.15 + 1.05 * w * lame * Math.max(0, Math.cos(p)); return { th, sh: th - bend }; };
  const nearL = leg(ph), farL = leg(ph + Math.PI);
  const height = (l) => Math.cos(l.th) * L1 + Math.cos(l.sh) * L2 + FOOT;
  const hipX = ax + fx;
  let hipY;
  if (legs.tread) hipY = ay - 11 * s; else if (legs.hover) hipY = ay - 10 * s - Math.round(Math.sin(t * 4) * 0.6 * s); else hipY = ay - Math.max(height(nearL), height(farL)) + breathe * 0.5;
  const drawLeg = (l, dx, R, M) => {
    const hip = [hipX + dx, hipY], knee = [hip[0] + Math.sin(l.th) * L1, hip[1] + Math.cos(l.th) * L1], ank = [knee[0] + Math.sin(l.sh) * L2, knee[1] + Math.cos(l.sh) * L2];
    S.tube(hip, knee, 4 * s, 3.6 * s, M, 0.45); // the thigh: a metal strut
    S.line([hip[0] + 1.4 * s, hip[1] + 0.5 * s], [knee[0] + 1.4 * s, knee[1] - 1 * s], M[5]); // its piston
    // the shin: an armour plate wider at the top, like a greave
    const dx2 = Math.sin(l.sh), dy2 = Math.cos(l.sh), nx = -dy2, ny = dx2, k = knee, a = ank;
    const shin = [[k[0] - nx * 3.2 * s - dx2 * 1.2 * s, k[1] - ny * 3.2 * s - dy2 * 1.2 * s], [k[0] + nx * 3.4 * s - dx2 * 1.2 * s, k[1] + ny * 3.4 * s - dy2 * 1.2 * s], [a[0] + nx * 2.6 * s, a[1] + ny * 2.6 * s], [a[0] - nx * 2.4 * s, a[1] - ny * 2.4 * s]];
    S.plate(shin, R, 0.6, 0.3);
    const q = (f, o) => [k[0] + (a[0] - k[0]) * f + nx * o * s, k[1] + (a[1] - k[1]) * f + ny * o * s];
    S.line(q(0.5, -2.6), q(0.5, 2.8), R[2]); S.line(q(0.56, -2.4), q(0.56, 2.6), R[5]); // a seam across the greave
    if (s > 1.5) { S.px(...q(0.25, 1.5), R[1]); S.px(...q(0.8, 1.4), R[1]); S.px(...q(0.8, -1.2), R[1]); }
    S.ball(k[0] + 1.2 * s, k[1] - 0.2 * s, 2.2 * s, R); // knee guard
    // the foot, broad and flat; it tips while the leg swings
    const lift = Math.max(0, (ay - FOOT) - a[1]) > 0.6, tip = lift ? 0.8 * s : 0, fy = a[1];
    S.shadow(a[0], a[1], Math.round(2.5 * s), 1);
    const foot = [[a[0] - 3.5 * s, fy - 1 * s], [a[0] + 2.5 * s, fy - 1.6 * s], [a[0] + 6 * s, fy + FOOT - 0.6 - tip], [a[0] + 5.5 * s, fy + FOOT - tip * 0.2], [a[0] - 3.8 * s, fy + FOOT]];
    S.plate(foot, M, 0.55, 0.3);
    S.ball(a[0], a[1] - 0.3 * s, 1.4 * s, M);
  };
  // ---- the torso: a wide, thick box
  const lean = Math.round(w * 0.8 * s + aim * 0.5 * s), by = Math.round(hipY - 2 * s + breathe), ty = Math.round(by - 8 * s), cx = hipX + 0.5 * s + lean;
  const fl0 = cx - 4 * s, fr = cx + 7 * s, sl = cx - 9.5 * s, back = 3 * s;
  // ---- arms
  const sw = 0.45 * w;
  const armA = (p, aiming) => aiming ? { u: 1.05 + aim * 0.3, f: Math.PI / 2 - (pose.recoil || 0) * 0.3 } : { u: 0.1 + Math.sin(p) * sw, f: 0.6 + Math.sin(p) * sw * 1.3 };
  const shN = [fr - 0.5 * s, ty + 2 * s], shF = [sl + 1.5 * s, ty + 0.5 * s];
  const armJ = (sh, a, k) => { const el = [sh[0] + Math.sin(a.u) * 4.5 * s * k, sh[1] + Math.cos(a.u) * 4.5 * s * k], hd = [el[0] + Math.sin(a.f) * 6.5 * s * k, el[1] + Math.cos(a.f) * 6.5 * s * k]; return { sh, el, hd, a }; };
  const near = armJ(shN, armA(ph + Math.PI, aim > 0.05), 1), far = armJ(shF, armA(ph, false), 0.9);

  // back to front: far arm, far leg, launcher, hips, near leg, torso, head, near arm
  if (!broken('armL')) { drawArm(S, far, mat('armL', P.far), mat('armL', METAL_FAR), 0.9, s, P); holding(S, u, 'wL', far, s, true); }
  if (legs.tread) drawTread(S, hipX, ay, s, mat('legs', P.paint), t, w);
  else if (legs.hover) drawHover(S, hipX, ay, hipY, s, mat('legs', P.paint), t);
  else drawLeg(farL, -3.5 * s, mat('legs', P.far), mat('legs', METAL_FAR));
  if (u.sh) drawLauncher(S, sl, ty, back, s, mat('body', METAL), u, P);
  S.plate([[hipX - 5.5 * s, hipY - 2.5 * s], [hipX + 5.5 * s, hipY - 2.5 * s], [hipX + 4.5 * s, hipY + 2 * s], [hipX - 4.5 * s, hipY + 2 * s]], mat('body', METAL), 0.45, 0.3);
  if (!legs.tread && !legs.hover) drawLeg(nearL, 3 * s, mat('legs', P.paint), mat('legs', METAL));
  const R = mat('body', P.paint);
  const side = [[sl, ty - back], [fl0, ty], [fl0, by], [sl, by - back]];
  const front = [[fl0, ty], [fr, ty], [fr, by - 1.5 * s], [fr - 1.5 * s, by], [fl0, by]];
  const top = [[sl, ty - back], [fl0 - 1 * s, ty - back - 0.6 * s], [fr - 3.5 * s, ty - back - 0.6 * s], [fr, ty], [fl0, ty]];
  S.plate(side, R, 0.34, 0.22); S.plate(front, R, 0.66, 0.34); S.plate(top, R, 0.86, 0.12);
  // the chest: a plate line, vents, the cockpit glass, a stripe of paint, rivets
  const midY = ty + 4.5 * s;
  S.line([fl0 + 1 * s, midY], [fr - 1.5 * s, midY], R[2]); S.line([fl0 + 1 * s, midY + 1], [fr - 1.5 * s, midY + 1], R[5]);
  for (let k = 0; k < 3; k++) { const vx = fl0 + (1.5 + k * 1.7) * s; S.line([vx, midY + 1.5 * s], [vx, by - 1 * s], R[2]); if (s > 1.5) S.line([vx + 1, midY + 1.5 * s], [vx + 1, by - 1 * s], R[4]); }
  const glass = [[fr - 5 * s, ty + 1 * s], [fr - 0.6 * s, ty + 1 * s], [fr - 0.6 * s, ty + 3.6 * s], [fr - 5 * s, ty + 3.6 * s]];
  S.plate(glass, fl.body ? WHITE : GLASS, 0.55, 0.5); S.line([fr - 4.4 * s, ty + 1.5 * s], [fr - 2.6 * s, ty + 1.5 * s], GLASS[6]);
  S.poly([[sl + 1 * s, ty - back + 2 * s], [fl0 - 0.5 * s, ty + 2 * s], [fl0 - 0.5 * s, ty + 3 * s], [sl + 1 * s, ty - back + 3 * s]], (x, y) => toneAt(P.trim, 0.45, x, y));
  if (s > 1.5) { for (let k = 0; k < 4; k++) S.px(fl0 + (1 + k * 2.4) * s, by - 0.8 * s, R[1]); S.px(sl + 1.2 * s, by - back - 1.5 * s, R[1]); S.px(sl + 1.2 * s, ty - back + 1 * s, R[5]); }
  // the head: low and small, set back on the torso
  const hx = cx - 0.5 * s, hy = ty - back + 0.2 * s;
  S.plate([[hx - 2.5 * s, hy], [hx + 3 * s, hy], [hx + 3.5 * s, hy - 2.5 * s], [hx + 1 * s, hy - 3.8 * s], [hx - 2.5 * s, hy - 3 * s]], R, 0.7, 0.35);
  S.line([hx, hy - 1.7 * s], [hx + 3.2 * s, hy - 1.7 * s], INK);
  S.px(hx + 2.4 * s, hy - 1.7 * s, Math.floor(t * 2) % 2 ? EYE : EYE2); if (s > 1.5) S.px(hx + 2.4 * s + 1, hy - 1.7 * s, EYE);
  if (s > 1.5) S.line([hx - 1 * s, hy - 3.6 * s], [hx - 1.6 * s, hy - 6 * s], METAL[5]);
  // the near arm and what it holds
  if (!broken('armR')) { drawArm(S, near, mat('armR', P.paint), mat('armR', METAL), 1, s, P); holding(S, u, 'wR', near, s, false, pose); }
  else { S.ball(shN[0], shN[1] + 1 * s, 2 * s, METAL); if (Math.floor(t * 8) % 2) { S.px(shN[0] + 2 * s, shN[1], SPARK); S.px(shN[0] + 3 * s, shN[1] - 1 * s, SPARK); S.px(shN[0] + 1 * s, shN[1] + 3 * s, SPARK); } }
  if (pose.face < 0) S.flip();
  return { c: S.done(), ax: pose.face < 0 ? S.w - ax : ax, ay };
}
// an arm: a metal upper arm, an elbow, an armoured forearm, a hand, and the big shoulder pad over the top
function drawArm(S, j, R, M, k, s, P) {
  S.tube(j.sh, j.el, 2.8 * s * k, 2.6 * s * k, M, 0.45);
  S.ball(j.el[0], j.el[1], 1.6 * s * k, M);
  const dx = Math.sin(j.a.f), dy = Math.cos(j.a.f), nx = -dy, ny = dx, e = j.el, h = j.hd;
  S.tube([e[0] + dx * 0.5 * s, e[1] + dy * 0.5 * s], h, 4.6 * s * k, 4.2 * s * k, R, 0.55);
  const fb = (f, o) => [e[0] + (h[0] - e[0]) * f + nx * o * s * k, e[1] + (h[1] - e[1]) * f + ny * o * s * k];
  S.line(fb(0.55, -2.1), fb(0.55, 2.1), R[1]); S.line(fb(0.62, -2), fb(0.62, 2), R[4]);
  S.ball(h[0] + dx * 0.6 * s, h[1] + dy * 0.6 * s, 1.5 * s * k, M);
  // the shoulder pad: a broad rounded block with a stripe of paint
  const p = j.sh, pad = [[p[0] - 4 * s * k, p[1] - 2.5 * s], [p[0] + 2.5 * s * k, p[1] - 3.8 * s], [p[0] + 4.2 * s * k, p[1] + 0.3 * s], [p[0] + 3 * s * k, p[1] + 3.2 * s], [p[0] - 3.5 * s * k, p[1] + 2.8 * s]];
  S.plate(pad, R, 0.72, 0.34);
  S.poly([[p[0] - 3 * s * k, p[1] + 0.6 * s], [p[0] + 3.2 * s * k, p[1]], [p[0] + 3.2 * s * k, p[1] + 1 * s], [p[0] - 3 * s * k, p[1] + 1.6 * s]], (x, y) => toneAt(P.trim, 0.5, x, y));
}
// what the hand holds, laid along the forearm
function holding(S, u, slot, j, s, farSide, pose = {}) {
  const w = u[slot] && ITEM[u[slot]]; if (!w) return;
  const M = farSide ? METAL_FAR : METAL, a = j.a.f, dx = Math.sin(a), dy = Math.cos(a), h = j.hd;
  const at = (d, o = 0) => [h[0] + dx * d - dy * o, h[1] + dy * d + dx * o];
  if (w.cat === 'shield') { const L = (w.id === 'SH2' ? 15 : 11) * s; S.plate([at(-L * 0.5, -4 * s), at(L * 0.5, -4 * s), at(L * 0.55, 1.5 * s), at(-L * 0.55, 1.5 * s)], M, 0.6, 0.35); S.line(at(-L * 0.4, -1.2 * s), at(L * 0.4, -1.2 * s), M[2]); return; }
  if (w.cat === 'melee') {
    if (w.id === 'KN1') { S.ball(h[0] + dx * 2 * s, h[1] + dy * 2 * s, 2.8 * s, M); return; }
    const up = [h[0] + 2 * s, h[1] - 10 * s], down = [h[0] - 0.5 * s, h[1] + 3 * s];
    S.tube(down, up, 1.8 * s, 1.6 * s, M);
    if (w.id === 'AX1') S.plate([[up[0] - 0.5 * s, up[1] + 1 * s], [up[0] + 5 * s, up[1] - 1.5 * s], [up[0] + 6 * s, up[1] + 3.5 * s], [up[0] + 0.5 * s, up[1] + 4 * s]], METAL, 0.8, 0.3);
    if (w.id === 'RD1') S.tube([up[0], up[1] + 3 * s], up, 2.2 * s, 2.2 * s, JETS, 0.6);
    return;
  }
  // a gun: the body at the hand, then the barrel; a magazine beneath, a scope on the sniper rifle
  const len = { MG1: 9, MG2: 10, SG1: 7, RF1: 11, RF2: 14 }[w.id] || 9, th = (w.id === 'SG1' || w.id === 'MG2' ? 3.6 : 2.8) * s;
  S.plate([at(-2.5 * s, -th / 2 - 0.5 * s), at(4.5 * s, -th / 2 - 0.5 * s), at(4.5 * s, th / 2 + 0.5 * s), at(-2.5 * s, th / 2 + 0.5 * s)], M, 0.5, 0.3);
  S.tube(at(4.5 * s), at(len * s), th * 0.6, th * 0.5, M, 0.45);
  if (w.shots > 4) S.plate([at(0, th / 2), at(2.5 * s, th / 2), at(2 * s, th / 2 + 3 * s), at(-0.5 * s, th / 2 + 3 * s)], M, 0.35, 0.2);
  if (w.id === 'RF2') S.tube(at(0.5 * s, -th * 0.95), at(4.5 * s, -th * 0.95), 1.6 * s, 1.6 * s, M);
  if (pose.muzzle) { const m = at(len * s + 1.8 * s); S.disc(m[0], m[1], 2.4 * s, FLASH2); S.disc(m[0] + dx * s, m[1] + dy * s, 1.4 * s, FLASH); S.px(m[0] + dx * 3.6 * s, m[1] + dy * 3.6 * s, FLASH); S.px(m[0] + dx * 1.5 * s - dy * 2.5 * s, m[1] + dy * 1.5 * s + dx * 2.5 * s, FLASH2); }
}
function drawLauncher(S, sl, ty, back, s, M, u, P) {
  const x0 = sl - 1.5 * s, y0 = ty - back - 5.5 * s, wd = 9 * s, ht = 5.5 * s;
  S.tube([x0 + 2.5 * s, y0 + ht], [x0 + 3.5 * s, ty - back + 1], 1.4 * s, 1.4 * s, M);
  S.plate([[x0, y0 + 0.5 * s], [x0 + wd, y0 - 0.5 * s], [x0 + wd, y0 + ht - 0.5 * s], [x0, y0 + ht + 0.5 * s]], M, 0.55, 0.3);
  const n = u.sh === 'RK1' ? 3 : 2;
  for (let k = 0; k < n; k++) S.disc(x0 + wd - 1.3 * s, y0 + 1.5 * s + k * (ht - 2.8 * s) / Math.max(1, n - 1), 0.9 * s, INK);
  S.line([x0 + 1 * s, y0 + 1.5 * s], [x0 + 4.5 * s, y0 + 1.2 * s], P.trim[3]);
}
function drawTread(S, x, ay, s, R, t, w) {
  const y0 = ay - 6.5 * s;
  S.plate([[x - 13 * s, y0], [x + 13 * s, y0], [x + 15 * s, y0 + 3.2 * s], [x + 12 * s, ay], [x - 12 * s, ay], [x - 15 * s, y0 + 3.2 * s]], METAL, 0.4, 0.3);
  const roll = (t * 14 * (w > 0.05 ? 1 : 0)) % 3;
  for (let k = -13; k <= 13; k += 3) { S.px(x + (k + roll) * s, y0 + 0.6, METAL[5]); S.px(x + (k - roll) * s, ay - 0.6, METAL[1]); }
  for (let k = -9; k <= 9; k += 6) S.ball(x + k * s, y0 + 3.4 * s, 2.3 * s, METAL);
  S.plate([[x - 9 * s, y0 - 5 * s], [x + 9 * s, y0 - 5 * s], [x + 10 * s, y0], [x - 10 * s, y0]], R, 0.62, 0.3);
}
function drawHover(S, x, ay, hipY, s, R, t) {
  const y0 = ay - 5.5 * s;
  S.plate([[x - 12 * s, y0], [x + 12 * s, y0], [x + 10 * s, ay - 2 * s], [x - 10 * s, ay - 2 * s]], R, 0.5, 0.35);
  S.poly([[x - 9 * s, ay - 1.6 * s], [x + 9 * s, ay - 1.6 * s], [x + 8 * s, ay - 0.4 * s], [x - 8 * s, ay - 0.4 * s]], (px, py) => toneAt(JETS, 0.45 + Math.sin(t * 20 + px) * 0.2, px, py));
  S.plate([[x - 5 * s, hipY], [x + 5 * s, hipY], [x + 6 * s, y0], [x - 6 * s, y0]], R, 0.6, 0.3);
}

// every unit keeps its own drawing surfaces
const surf = new WeakMap();
export function wanzerSprite(u, s, pose) {
  const key = s > 1.5 ? 'big' : 'small';
  let m = surf.get(u); if (!m) { m = {}; surf.set(u, m); }
  if (!m[key]) m[key] = new Spr(Math.ceil(64 * s), Math.ceil(46 * s));
  return drawWanzer(u, pose, s, m[key]);
}
