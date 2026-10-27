// The side-on battle scene in 3D: the two wanzers from the map, face to face on a calm, open stretch of ground,
// lit low from the front so their arms and pauldrons throw shadows across their own armour.
// Shots, explosions and numbers are drawn flat on top (render.js drawBattleFx) at points projected from here.
import * as THREE from './lib/three.module.min.js';
import { buildMech, poseMech } from './mech3d.js';
import * as W3 from './world3d.js';
import { P, hash } from './render.js';
import { ITEM } from './data.js';

const cam = { x: 0 };
let scn = null, cmr = null, sun = null, groundMesh = null, groundKey = '', sideMech = {}, key = null;
export const debug = {}; // a test can point the camera anywhere
const GAP = 1.3; // each machine stands this far from the middle

function pixTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// the ground: one quiet colour with a few soft patches of a second, nothing more
function groundTex(ch) {
  const pal = ch === 'c' ? P.snow : ch === 'r' ? P.asph : ch === ',' || ch === 'x' ? P.conc : ch === 'f' ? P.forest : ch === 'h' || ch === 'H' ? P.dirt : P.grass;
  return pixTex(32, 32, (g, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = hash(x >> 2, y >> 2, 7), d = hash(x, y, 8); g.fillStyle = v > 0.8 && d > 0.3 ? pal[1] : d > 0.985 ? pal[2] : pal[0]; g.fillRect(x, y, 1, 1); }
  });
}
function init() {
  scn = new THREE.Scene();
  // a plain dusk sky, in a few bands, fading into haze at the horizon
  const sky = ['#1e2430', '#262c36', '#30343c', '#3c3e42', '#4a4844', '#565246'];
  scn.background = pixTex(1, 96, (g, w, h) => { for (let y = 0; y < h; y++) { const k = y / h * sky.length, i = Math.floor(k), f = k - i; g.fillStyle = sky[Math.min(sky.length - 1, i + (f > 0.8 && y % 2 ? 1 : 0))]; g.fillRect(0, y, 1, 1); } });
  scn.fog = new THREE.Fog('#565246', 9, 26);
  // a faint line of hills far behind, barely darker than the haze
  const hills = pixTex(128, 16, (g, w, h) => { for (let x = 0; x < w; x++) { const top = 6 + Math.round(Math.sin(x * 0.09) * 3 + Math.sin(x * 0.23 + 1) * 2 + hash(x >> 3, 1, 3) * 2); g.fillStyle = '#3e3c3a'; g.fillRect(x, top, 1, h - top); } });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60, 7.5), new THREE.MeshBasicMaterial({ map: hills, transparent: true, fog: false, depthWrite: false }));
  far.position.set(0, 1.2, -22); scn.add(far);
  scn.add(new THREE.HemisphereLight('#c8ccd4', '#3a342a', 1.25));
  sun = new THREE.DirectionalLight('#ffe8c8', 2.6); sun.position.set(-2.2, 4.2, 3.4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0015;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 }); sun.shadow.camera.updateProjectionMatrix();
  scn.add(sun);
  cmr = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 80);
}

// a new fight: build the two machines once and keep them until the next one
export function start(sc) {
  if (!scn) init();
  if (groundKey !== sc.ground) {
    groundKey = sc.ground; if (groundMesh) scn.remove(groundMesh);
    const t = groundTex(sc.ground); t.repeat.set(14, 14);
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshToonMaterial({ map: t, gradientMap: W3.TOON }));
    groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scn.add(groundMesh);
  }
  for (const s of ['L', 'R']) {
    if (sideMech[s]) scn.remove(sideMech[s].holder);
    const m = buildMech(sc[s]), holder = new THREE.Group();
    holder.add(m.group); m.holder = holder; m.bar.visible = m.star.visible = m.mark.visible = false;
    holder.rotation.y = s === 'L' ? Math.PI / 2 : -Math.PI / 2; holder.position.x = s === 'L' ? -GAP : GAP;
    scn.add(holder); sideMech[s] = m;
  }
  key = sc; cam.x = 0;
}

const v3 = new THREE.Vector3();
// pose both machines for time sc.t, render, and hand back where things are on screen (in the renderer's pixels)
export function render(sc) {
  if (key !== sc) start(sc);
  const t = sc.t, { w, h } = W3.viewSize(), aspect = w / h;
  // keep both machines in frame on a tall phone too
  const dist = Math.max(6.4, 4.8 / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * aspect));
  cmr.aspect = aspect; cmr.position.set(1.1, 1.0 + dist * 0.05, dist); cmr.lookAt(0, 0.9, 0);
  if (debug.pos) { cmr.position.set(...debug.pos); cmr.lookAt(...debug.look); }
  cmr.updateProjectionMatrix();
  const out = {};
  for (const s of ['L', 'R']) {
    const m = sideMech[s], u = sc[s], f = s === 'L' ? 1 : -1, mine = sc.events.filter((e) => e.from === s), theirs = sc.events.filter((e) => e.from !== s);
    const busy = mine.filter((e) => t > e.at - 0.5 && t < e.at + 0.3), guns = busy.some((e) => e.cat === 'short');
    const melee = mine.find((e) => e.cat === 'melee' && t > e.at - 0.35 && t < e.at + 0.3);
    const shot = mine.some((e) => e.cat === 'short' && t > e.at - 0.16 && t < e.at - 0.08);
    const launch = mine.find((e) => e.cat === 'long' && t > e.at - 0.6 && t < e.at - 0.35);
    const hits = theirs.filter((e) => !e.miss && t >= e.at && t < e.at + 0.25);
    // braced for what is coming: the guard goes up just before the other side fires
    const incoming = !busy.length && theirs.some((e) => t > e.at - 0.6 && t < e.at + 0.2);
    // they walk in from either side at the start
    const enter = Math.min(1, t / 0.5), walkIn = enter < 1;
    let x = -f * (GAP + 0.7 * (1 - (1 - (1 - enter) ** 2))), swing = null;
    if (melee) {
      const k = 1 - Math.abs(t - melee.at) / 0.35; x += f * (2 * GAP - 1.0) * Math.min(1, k * 1.6);
      const q = Math.max(0, Math.min(1, (t - (melee.at - 0.3)) / 0.4)); swing = q < 0.7 ? -0.4 - 2.2 * (q / 0.7) : -2.6 + 1.9 * ((q - 0.7) / 0.3);
    }
    // each hit shoves it back and rocks the torso, heavier blows more
    let push = 0;
    for (const e of theirs) { const dt = t - e.at; if (e.miss || dt < 0 || dt > 1.2) continue; const amp = e.cat === 'long' ? 0.24 : e.cat === 'melee' ? 0.2 : 0.035; push += amp * (dt < 0.06 ? dt / 0.06 : Math.exp(-(dt - 0.06) * 4)); }
    const dying = sc.dead?.[s] && t > sc.deadAt ? Math.min(1, (t - sc.deadAt) / 0.9) : 0;
    const jolt = hits.length ? Math.sin(t * 70) * 0.02 : 0;
    // feet a little apart in depth and turned a little towards us; the shoulders turn back to face the enemy
    m.holder.position.set(x - f * (jolt + push * 0.6), -dying * 0.25, f * 0.22);
    m.holder.rotation.y = f * (Math.PI / 2 - 0.32);
    m.group.rotation.x = -dying * dying * 1.1; // a destroyed machine topples backwards
    const sway = Math.sin(t * 1.25 + (s === 'L' ? 0 : 2.1));
    poseMech(m, { ...u, hp: sc['hp' + s] }, {
      t, walk: melee || walkIn ? 1 : 0, phase: t * (walkIn ? 13 : 16), aim: guns ? 1 : 0, muzzle: shot, recoil: shot ? 1 : 0,
      flinch: hits.length ? Math.sin(t * 60) : 0, swing, swingL: ITEM[u.wR]?.cat !== 'melee' && ITEM[u.wL]?.cat === 'melee',
      stance: dying ? 0 : 1, sway: walkIn ? 0 : sway, twist: 0.32 * (melee ? 0.3 : 1), look: 0,
      lean: -push * 1.3 + (launch ? -0.1 : 0) + (melee ? 0.12 : 0) + dying * 0.2, guard: incoming ? 1 : 0,
    });
    // the part that is hit flashes white
    const lit = {}; for (const e of hits) lit[e.part] = Math.floor((t - e.at) * 30) % 2 === 0;
    for (const p of ['body', 'armL', 'armR', 'legs']) m.flash(p, !!lit[p], sc['hp' + s][p] <= 0);
    m.fade(dying > 0.7 ? 1 - (dying - 0.7) / 0.3 * 0.6 : 1);
  }
  // the camera drifts, leans towards whoever is acting and shakes with the heavy hits
  const act = sc.events.find((e) => t > e.at - 0.7 && t < e.at + 0.4);
  cam.x += (((act ? (act.from === 'L' ? -0.35 : 0.35) : 0) + Math.sin(t * 0.3) * 0.2) - cam.x) * 0.04;
  let shake = 0; for (const e of sc.events) { const dt = t - e.at; if (!e.miss && dt > 0 && dt < 0.3 && e.cat !== 'short') shake = Math.max(shake, (1 - dt / 0.3) * 0.05); }
  if (sc.dead && (sc.dead.L || sc.dead.R) && t > sc.deadAt && t < sc.deadAt + 0.6) shake = Math.max(shake, 0.06);
  if (!debug.pos) {
    const d = dist * (1 - Math.min(1, t / 4) * 0.06);
    cmr.position.set(1.1 + cam.x + (Math.random() - 0.5) * shake, 1.0 + d * 0.05 + (Math.random() - 0.5) * shake, d); cmr.lookAt(cam.x * 0.8, 0.9, 0); cmr.updateProjectionMatrix();
  }
  W3.renderWith(scn, cmr);
  // where everything is on screen
  const proj = (obj, dx = 0, dy = 0, dz = 0) => { obj.updateWorldMatrix(true, false); v3.set(dx, dy, dz).applyMatrix4(obj.matrixWorld).project(cmr); return { x: Math.round((v3.x + 1) / 2 * w), y: Math.round((1 - v3.y) / 2 * h) }; };
  for (const s of ['L', 'R']) {
    const m = sideMech[s];
    out[s] = {
      f: s === 'L' ? 1 : -1,
      muzzle: m.parts.muzzlewR ? proj(m.parts.muzzlewR) : proj(m.armR.el, 0, -0.3, 0),
      launcher: m.parts.launcher ? proj(m.parts.launcher, 0, 0.12, 0.14) : proj(m.torso, 0, 0.5, 0),
      body: proj(m.torso, 0, 0.22, 0.25), armL: proj(m.armL.el, 0, -0.14, 0), armR: proj(m.armR.el, 0, -0.14, 0),
      legs: m.legL ? proj(m.legL.knee, 0, -0.1, 0.1) : proj(m.group, 0, 0.2, 0.3),
      miss: proj(m.torso, 0, 0.75, -0.9), head: proj(m.head, 0, 0.3, 0), ground: proj(m.holder),
    };
  }
  // one scene unit in screen pixels at the machines, so the flat effects scale with the view
  out.unit = Math.abs(out.R.ground.x - out.L.ground.x) / (2 * GAP);
  return out;
}
