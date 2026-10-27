// Wanzers in 3D: the same squat machine as the pixel sprites, built from boxes on a skeleton of pivots
// (hips, thighs, knees, ankles; shoulders, elbows) and lit with the same few hard bands of toon shading.
// poseMech() moves the joints every frame from the same pose as the sprites: the walking stride with the feet kept
// on the ground, the arm brought up to aim, the kick of the recoil, a shake when hit.
import * as THREE from './lib/three.module.min.js';
import { ITEM } from './data.js';
import { TOON } from './world3d.js';

const COL = {
  p: { paint: '#6a8a40', dark: '#4e6830', trim: '#d8b44a' },
  e: { paint: '#8a867e', dark: '#5c5a5c', trim: '#d86a2a' },
};
const M = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: TOON, transparent: true, ...extra });
const boxGeo = new Map();
const geo = (w, h, d) => { const k = `${w},${h},${d}`; if (!boxGeo.has(k)) boxGeo.set(k, new THREE.BoxGeometry(w, h, d)); return boxGeo.get(k); };

export function buildMech(u) {
  const C = COL[u.side], legs = ITEM[u.legs];
  const mats = { paint: M(C.paint), dark: M(C.dark), metal: M('#545a64'), metalD: M('#3c4048'), trim: M(C.trim), glass: M('#2c4450', { emissive: '#0e2230' }), eye: new THREE.MeshBasicMaterial({ color: '#ff4a30', transparent: true }), ink: M('#141412'), white: M('#ffffff'), dead: M('#2e2924'), jet: new THREE.MeshBasicMaterial({ color: '#6ad0f0', transparent: true }) };
  const group = new THREE.Group(), hit = [], parts = {};
  const add = (parent, w, h, d, mat, x, y, z, part) => { const m = new THREE.Mesh(geo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; m.userData = { unit: u, part, mat }; parent.add(m); hit.push(m); (parts[part] ||= []).push(m); return m; };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  // body (the hips carry everything above the legs)
  const hips = pivot(group, 0, 0.42, 0);
  add(hips, 0.44, 0.12, 0.26, mats.metal, 0, 0, 0, 'body');
  const torso = pivot(hips, 0, 0.06, 0);
  add(torso, 0.62, 0.38, 0.5, mats.paint, 0, 0.21, 0, 'body');
  add(torso, 0.6, 0.05, 0.46, mats.dark, 0, 0.42, -0.01, 'body'); // the lighter top edge sits a little proud
  add(torso, 0.28, 0.11, 0.03, mats.glass, 0.12, 0.31, 0.255, 'body'); // cockpit
  for (let k = 0; k < 3; k++) add(torso, 0.04, 0.12, 0.02, mats.dark, -0.18 + k * 0.08, 0.1, 0.255, 'body'); // vents
  add(torso, 0.6, 0.02, 0.02, mats.dark, 0, 0.2, 0.255, 'body'); // a plate seam
  add(torso, 0.02, 0.05, 0.4, mats.trim, -0.315, 0.3, 0, 'body'); add(torso, 0.02, 0.05, 0.4, mats.trim, 0.315, 0.3, 0, 'body'); // paint stripes
  const head = pivot(torso, 0, 0.44, -0.08);
  add(head, 0.2, 0.13, 0.2, mats.paint, 0, 0.07, 0, 'body');
  add(head, 0.16, 0.03, 0.02, mats.ink, 0.0, 0.08, 0.105, 'body');
  const eye = add(head, 0.04, 0.03, 0.02, mats.eye, 0.04, 0.08, 0.112, 'body');
  if (u.sh) { const L = pivot(torso, -0.16, 0.5, -0.2); add(L, 0.3, 0.18, 0.2, mats.metal, 0, 0.09, 0, 'body'); for (let k = 0; k < (u.sh === 'RK1' ? 3 : 2); k++) add(L, 0.06, 0.05, 0.02, mats.ink, -0.08 + k * 0.08, 0.1, 0.105, 'body'); add(L, 0.2, 0.02, 0.02, mats.trim, 0, 0.16, 0.105, 'body'); }
  // arms: a shoulder pad, an upper arm, an elbow, a forearm, a hand and what it holds
  const arm = (side, part, slot) => {
    const sh = pivot(torso, side * 0.42, 0.33, 0);
    add(sh, 0.26, 0.18, 0.34, mats.paint, side * 0.02, 0.04, 0, part); add(sh, 0.02, 0.04, 0.3, mats.trim, side * 0.15, 0.04, 0, part);
    const up = pivot(sh, 0, -0.06, 0); add(up, 0.1, 0.18, 0.1, mats.metal, 0, -0.09, 0, part);
    const el = pivot(up, 0, -0.18, 0); add(el, 0.17, 0.26, 0.17, mats.paint, 0, -0.13, 0, part); add(el, 0.18, 0.02, 0.18, mats.dark, 0, -0.16, 0, part);
    add(el, 0.11, 0.08, 0.11, mats.metal, 0, -0.29, 0, part);
    // the weapon points along the forearm (down when hanging, forward when the arm is raised)
    const w = u[slot] && ITEM[u[slot]];
    if (w) {
      const hand = pivot(el, 0, -0.3, 0);
      if (w.cat === 'shield') add(hand, 0.04, 0.46, 0.3, mats.metalD, side * 0.11, 0.08, 0.02, part);
      else if (w.cat === 'melee') { const rod = add(hand, 0.05, 0.05, 0.5, mats.metal, 0, 0, 0.2, part); if (w.id === 'AX1') add(hand, 0.04, 0.2, 0.14, mats.metal, 0, 0.08, 0.42, part); if (w.id === 'RD1') add(hand, 0.07, 0.07, 0.12, mats.jet, 0, 0, 0.44, part); if (w.id === 'KN1') { rod.visible = false; add(hand, 0.16, 0.14, 0.16, mats.metal, 0, -0.04, 0, part); } }
      else { const len = { MG1: 0.42, MG2: 0.46, SG1: 0.32, RF1: 0.52, RF2: 0.66 }[w.id] || 0.42; add(hand, 0.08, 0.12, 0.2, mats.metalD, 0, -0.04, 0, part); add(hand, 0.04, len, 0.04, mats.metal, 0, -0.08 - len / 2, 0, part); if (w.shots > 4) add(hand, 0.06, 0.1, 0.08, mats.metalD, 0, -0.08, 0.08, part); if (w.id === 'RF2') add(hand, 0.04, 0.16, 0.05, mats.metal, 0, -0.1, -0.07, part); }
      parts['muzzle' + slot] = pivot(hand, 0, -0.1 - ({ MG1: 0.42, MG2: 0.46, SG1: 0.32, RF1: 0.52, RF2: 0.66 }[w.id] || 0.42), 0);
    }
    return { sh, up, el, part };
  };
  const armR = arm(1, 'armR', 'wR'), armL = arm(-1, 'armL', 'wL');
  // legs, or treads, or a hover skirt
  let legL = null, legR = null;
  if (legs.tread) {
    const tr = pivot(group, 0, 0, 0);
    for (const s of [-1, 1]) { add(tr, 0.18, 0.22, 0.9, mats.metalD, s * 0.3, 0.11, 0, 'legs'); for (let k = -1; k <= 1; k++) add(tr, 0.2, 0.12, 0.12, mats.metal, s * 0.3, 0.1, k * 0.3, 'legs'); }
    add(tr, 0.5, 0.2, 0.6, mats.paint, 0, 0.3, 0, 'legs');
    hips.position.y = 0.42;
  } else if (legs.hover) {
    const hv = pivot(group, 0, 0, 0);
    add(hv, 0.7, 0.14, 0.7, mats.dark, 0, 0.14, 0, 'legs'); add(hv, 0.6, 0.03, 0.6, mats.jet, 0, 0.05, 0, 'legs'); add(hv, 0.32, 0.22, 0.32, mats.paint, 0, 0.3, 0, 'legs');
    hips.position.y = 0.44;
  } else {
    const leg = (side) => {
      const hip = pivot(group, side * 0.16, 0.42, 0);
      add(hip, 0.13, 0.24, 0.15, mats.metal, 0, -0.12, 0, 'legs');
      const knee = pivot(hip, 0, -0.24, 0);
      add(knee, 0.21, 0.32, 0.25, mats.paint, 0, -0.15, 0.01, 'legs'); add(knee, 0.22, 0.02, 0.26, mats.dark, 0, -0.14, 0.01, 'legs');
      add(knee, 0.14, 0.12, 0.08, mats.paint, 0, 0.0, 0.13, 'legs'); // knee guard
      const ank = pivot(knee, 0, -0.32, 0);
      add(ank, 0.23, 0.08, 0.4, mats.metalD, 0, -0.04, 0.06, 'legs');
      return { hip, knee, ank };
    };
    legL = leg(-1); legR = leg(1);
  }
  // a health bar, a commander's star, a marker over the selected machine
  const barC = document.createElement('canvas'); barC.width = 20; barC.height = 5;
  const barT = new THREE.CanvasTexture(barC); barT.magFilter = barT.minFilter = THREE.NearestFilter; barT.generateMipmaps = false;
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false })); bar.scale.set(0.5, 0.125, 1); bar.position.y = 1.32; bar.renderOrder = 9; group.add(bar);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd23a', depthTest: false })); star.scale.set(0.12, 0.12, 1); star.position.y = 1.48; star.visible = !!u.boss; star.renderOrder = 9; group.add(star);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffe14a', depthTest: false })); mark.scale.set(0.12, 0.16, 1); mark.position.y = 1.62; mark.visible = false; mark.renderOrder = 9; group.add(mark);
  let lastBar = -1, lastAlpha = -1;
  const m = {
    group, hit, parts, mats, hips, torso, head, eye, armR, armL, legL, legR, legsType: legs,
    fade(a) { if (a === lastAlpha) return; lastAlpha = a; for (const k in mats) mats[k].opacity = a; },
    bars(u2, sel, t) {
      const k = Math.max(0, u2.hp.body) / u2.max.body, key = Math.round(k * 18);
      if (key !== lastBar) { lastBar = key; const g = barC.getContext('2d'); g.fillStyle = '#100e0a'; g.fillRect(0, 0, 20, 5); g.fillStyle = '#3a3a30'; g.fillRect(1, 1, 18, 3); g.fillStyle = k > 0.5 ? '#9ac850' : k > 0.25 ? '#e0b030' : '#e04a30'; g.fillRect(1, 1, Math.max(1, key), 3); barT.needsUpdate = true; }
      mark.visible = sel; mark.position.y = 1.62 + (Math.floor(t * 4) % 2) * 0.04; bar.visible = alive2(u2);
    },
  };
  return m;
}
const alive2 = (u) => u.hp.body > 0;

// pose: { phase, walk, aim, recoil, muzzle, flinch, t }
export function poseMech(m, u, pose) {
  const w = pose.walk || 0, ph = pose.phase || 0, aim = pose.aim || 0, t = pose.t || 0;
  // broken parts go dark; a destroyed arm is gone; a part being hit flashes white
  for (const part of ['body', 'armL', 'armR', 'legs']) for (const mesh of m.parts[part] || []) mesh.material = u.hp[part] <= 0 ? m.mats.dead : mesh.userData.mat;
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
  if (mz) { if (!mz.flash) { mz.flash = new THREE.Mesh(geo(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffd060' })); mz.add(mz.flash); } mz.flash.visible = !!pose.muzzle; mz.flash.rotation.set(t * 9, t * 7, 0); }
  m.eye.material.color.set(Math.floor(t * 2) % 2 ? '#ff4a30' : '#ffb070');
}
