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
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// the ground: one quiet colour with a few soft patches of a second, nothing more
function groundTex(ch) {
  const pal = ch === 'c' ? P.snow : ch === 'r' ? P.asph : ch === ',' || ch === 'x' ? P.conc : ch === 'f' ? P.forest : ch === 'h' || ch === 'H' ? P.dirt : P.grass;
  return pixTex(32, 32, (g, w, h) => {
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h); void hash;
  });
}
function init() {
  scn = new THREE.Scene();
  // a plain dusk sky, in a few bands, fading into haze at the horizon
  const sky = ['#1e2430', '#262c36', '#30343c', '#3c3e42', '#4a4844', '#565246'];
  scn.background = pixTex(1, 96, (g, w, h) => { for (let y = 0; y < h; y++) { const k = y / h * sky.length, i = Math.floor(k), f = k - i; g.fillStyle = sky[Math.min(sky.length - 1, i + (f > 0.8 && y % 2 ? 1 : 0))]; g.fillRect(0, y, 1, 1); } });
  scn.fog = new THREE.Fog('#565246', 9, 26);
  // a faint line of hills far behind, barely darker than the haze
  const hills = pixTex(128, 16, (g, w, h) => { for (let x = 0; x < w; x++) { const top = 8 + Math.round(Math.sin(x * 0.07) * 3 + Math.sin(x * 0.17 + 1) * 1.5); g.fillStyle = '#3e3c3a'; g.fillRect(x, top, 1, h - top); } });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60, 7.5), new THREE.MeshBasicMaterial({ map: hills, transparent: true, fog: false, depthWrite: false }));
  far.position.set(0, 1.2, -22); scn.add(far);
  scn.add(new THREE.HemisphereLight('#c8ccd4', '#3a342a', 1.25));
  sun = new THREE.DirectionalLight('#ffe8c8', 2.6); sun.position.set(-2.2, 4.2, 3.4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.012;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 }); sun.shadow.camera.updateProjectionMatrix();
  scn.add(sun);
  cmr = new THREE.PerspectiveCamera(28, 16 / 9, 1, 60);
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
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// an impulse: up fast, then dying away
const imp = (dt, rise, decay) => (dt < 0 ? 0 : dt < rise ? dt / rise : Math.exp(-(dt - rise) * decay));
// Every fight is choreographed a little differently: a camera, an entrance, each side's way of standing, and for each
// volley a way of shooting; for each blow a way of swinging; for each hit or miss a way of reacting. All of it comes
// from one random seed per fight, so a frame always looks the same for the same moment.
const STYLES = ['over', 'side', 'thrust', 'upper', 'spin', 'leap', 'double'];
function choreograph(sc) {
  if (sc.seed == null) sc.seed = Math.floor(Math.random() * 1e5);
  const R = (a, b = 0) => hash(sc.seed + a * 7, b * 13 + 3, 29);
  const plan = { cam: Math.floor(R(1) * 4), enter: ['walk', 'dash', 'ready'][Math.floor(R(2) * 3)], side: {}, volleys: [], R };
  ['L', 'R'].forEach((s, i) => { plan.side[s] = { sw: 1 + R(3, i) * 0.7, ph: R(4, i) * 6, crouch: R(5, i) * 0.08, twist: 0.24 + R(6, i) * 0.16 }; });
  // volleys: the shots of one side in a row
  for (const e of sc.events) {
    let v = plan.volleys[plan.volleys.length - 1];
    if (!v || v.from !== e.from) { v = { from: e.from, cat: e.cat, t0: e.at, t1: e.at, n: plan.volleys.length }; plan.volleys.push(v); const r = R(10, v.n);
      v.mode = e.cat === 'short' ? ['stand', 'crouch', 'advance', 'strafe', 'brace'][Math.floor(r * 5)] : e.cat === 'long' ? ['stand', 'brace', 'back'][Math.floor(r * 3)] : 'melee';
      v.dir = R(11, v.n) > 0.5 ? 1 : -1; }
    v.t1 = e.at; e.style = STYLES[Math.floor(R(12, e.n) * STYLES.length)]; e.approach = ['run', 'dash', 'leap'][Math.floor(R(13, e.n) * 3)];
  }
  sc.plan = plan;
}

// pose both machines for time sc.t, render, and hand back where things are on screen (in the renderer's pixels)
export function render(sc) {
  if (key !== sc) { start(sc); choreograph(sc); }
  const t = sc.t, { w, h } = W3.viewSize(), aspect = w / h, plan = sc.plan, R = plan.R;
  // keep both machines in frame on a tall phone too
  const dist = Math.max(6.4, 4.8 / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * aspect));
  cmr.aspect = aspect;
  const out = {};
  for (const s of ['L', 'R']) {
    const m = sideMech[s], u = sc[s], f = s === 'L' ? 1 : -1, P = plan.side[s], theirs = sc.events.filter((e) => e.from !== s);
    let x = -f * GAP, z = f * 0.22, walk = 0, phase = t * 16, crouch = P.crouch, lean = 0, roll = 0, twist = P.twist, kickR = 0, kickL = 0, headKick = 0;
    let wristL = 0, wristR = 0, aim = 0, guard = 0, armR = null, armL = null, swing = null, push = 0, muzzle = false, recoil = 0, meleeC = 0;
    // the entrance: walking in, sliding in on the jets, or already standing ready
    const enter = clamp01(t / 0.5), left = 1 - enter;
    if (plan.enter === 'walk') { x -= f * 0.7 * left * left; if (enter < 1) { walk = 1; phase = t * 13; } }
    else if (plan.enter === 'dash') { x -= f * 1.6 * left ** 3; crouch += 0.3 * left; }
    else guard = Math.max(guard, 0.6 * left);
    // my volley, if one is under way
    const V = plan.volleys.find((v) => v.from === s && t > v.t0 - 0.75 && t < v.t1 + 0.4);
    if (V) {
      const q = clamp01((t - (V.t0 - 0.75)) / (V.t1 - V.t0 + 1.15)), env = Math.sin(q * Math.PI);
      if (V.cat === 'short') {
        aim = 1;
        if (V.mode === 'crouch') crouch += 0.75 * env;
        else if (V.mode === 'advance') { x += f * 0.4 * q; walk = 0.45; phase = t * 9; }
        else if (V.mode === 'strafe') { z += V.dir * 0.4 * env; walk = 0.45; phase = t * 9; roll += V.dir * 0.05 * env; }
        else if (V.mode === 'brace') { armL = { s: -1.3 * env - 0.1, e: -0.5 * env - 0.6 * (1 - env) }; crouch += 0.25 * env; }
      } else if (V.cat === 'long') {
        if (V.mode === 'brace') crouch += 0.5 * env;
        if (V.mode === 'back') { x -= f * 0.3 * q; walk = 0.45; phase = t * 9; }
        guard = Math.max(guard, 0.4 * env);
      }
    }
    for (const e of sc.events) {
      if (e.from !== s) continue;
      const dt = t - e.at;
      // each shot: a flash and the gun kicks up
      if (e.cat === 'short' && dt > -0.16 && dt < -0.08) { muzzle = true; recoil = 1; }
      if (e.cat === 'long') { const k = imp(dt + 0.55, 0.05, 5); lean -= 0.16 * k; push -= 0.05 * k; }
      // a blow, in five beats: close in, wind up and hold, strike, hold the follow-through, step back
      if (e.cat === 'melee' && dt > -0.9 && dt < 0.75) {
        const reach = 2 * GAP - 1.0, sm = (v) => v * v * (3 - 2 * v);
        const inK = sm(clamp01((dt + 0.9) / 0.55)), outK = sm(clamp01((dt - 0.3) / 0.45)), c = inK * (1 - outK);
        const was = meleeC; meleeC = Math.max(meleeC, c); if (c > 0.02 && c < 0.98 && c >= was) { walk = 1; phase = t * (dt > 0.3 ? -14 : 16); }
        if (e.approach === 'dash' && dt < -0.35) { walk = 0; crouch += 0.3; }
        const wu = clamp01((dt + 0.32) / 0.24), st = clamp01((dt + 0.07) / 0.09), hold = dt > 0.02 && dt < 0.3;
        const arm = ITEM[u.wR]?.cat !== 'melee' && ITEM[u.wL]?.cat === 'melee' ? 'L' : 'R', set = (v) => { if (arm === 'L') armL = v; else armR = v; }, wrist = (v) => { if (arm === 'L') wristL = v; else wristR = v; };
        const mix = (a, b, k) => ({ s: a.s + (b.s - a.s) * k, e: a.e + (b.e - a.e) * k });
        const rest = { s: -0.5, e: -0.9 };
        const pose2 = (back, hit) => set(st > 0 ? mix(back, hit, st) : mix(rest, back, wu));
        if (dt > -0.35) {
          if (e.style === 'side') { twist = st > 0 ? 1.0 - 1.9 * st : 0.3 + 0.7 * wu; pose2({ s: -1.45, e: -0.25 }, { s: -1.45, e: -0.15 }); wrist(1.2 * wu); }
          else if (e.style === 'thrust') { twist = st > 0 ? 0.45 - 0.7 * st : 0.3 + 0.15 * wu; pose2({ s: -0.15, e: -1.9 }, { s: -1.6, e: 0 }); lean += 0.12 * st; wrist(1.5 * Math.max(wu, st)); }
          else if (e.style === 'upper') { crouch += 0.8 * wu * (1 - st); lean -= 0.18 * st; pose2({ s: 0.25, e: -0.5 }, { s: -2.5, e: -0.5 }); }
          else if (e.style === 'spin') { pose2({ s: -1.4, e: -0.3 }, { s: -1.5, e: -0.2 }); twist = 0.6 * wu * (1 - st); m.spin = st * Math.PI * 2 * -f; }
          else if (e.style === 'leap') { pose2({ s: -2.8, e: -0.3 }, { s: -0.5, e: -0.2 }); crouch += 0.6 * st; }
          else if (e.style === 'double') { const st2 = clamp01((dt + 0.2) / 0.08); set(st2 > 0 ? mix({ s: -2.6, e: -0.3 }, { s: -0.5, e: -0.2 }, st2) : st > 0 ? mix({ s: -1.4, e: -0.2 }, { s: -2.6, e: -0.3 }, st) : mix(rest, { s: -1.4, e: -0.2 }, wu)); twist = st > 0 ? 0.6 * (1 - st) : 0.6 * wu; }
          else { pose2({ s: -2.7, e: -0.3 }, { s: -0.6, e: -0.2 }); lean += 0.1 * st; }
          
        }
        // a leap: up into the air while closing in, down with the blow
        if (e.style === 'leap' || e.approach === 'leap') { const k = clamp01((dt + 0.75) / 0.7); m.jump = Math.max(m.jump || 0, Math.sin(k * Math.PI) * 0.55 * (dt < -0.05 ? 1 : 0)); }
      }
    }
    x += f * (2 * GAP - 1.0) * meleeC;
    // braced for what is coming: the guard goes up just before the other side fires
    if (!V && theirs.some((e) => t > e.at - 0.6 && t < e.at + 0.2)) guard = 1;
    // reactions to every shot aimed at me
    for (const e of theirs) {
      const dt = t - e.at;
      if (!e.miss) {
        if (dt < 0 || dt > 1.5) continue;
        const heavy = e.cat !== 'short', amp = (heavy ? 1 : 0.22) * (e.broke ? 1.5 : 1), I = imp(dt, heavy ? 0.06 : 0.12, heavy ? 3.2 : 2.6), r = R(31, e.n) - 0.5;
        if (e.part === 'body') { lean -= amp * 0.34 * I; headKick += amp * 0.9 * I; roll += r * amp * 0.3 * I; }
        else if (e.part === 'armR') { kickR += amp * 1.1 * I; twist += amp * 0.4 * I; roll += 0.08 * amp * I; }
        else if (e.part === 'armL') { kickL += amp * 1.1 * I; twist -= amp * 0.4 * I; roll -= 0.08 * amp * I; }
        else { crouch += amp * 0.8 * I; roll += r * amp * 0.35 * I; }
        push += amp * (heavy ? 0.32 : 0.05) * I;
        // a heavy blow sends it staggering back a step or two
        if (heavy && dt > 0.06 && dt < 0.6) { walk = Math.max(walk, 0.45); phase = dt * 9; }
      } else if (dt > -0.15 && dt < 0.5) {
        // a miss: it sidesteps or ducks
        const b = Math.sin(clamp01((dt + 0.15) / 0.65) * Math.PI), dir = R(34, e.n) > 0.5 ? 1 : -1;
        if (R(33, e.n) < 0.5) { z += dir * 0.3 * b; roll += dir * 0.12 * b; walk = Math.max(walk, 0.45); phase = t * 12; }
        else crouch += 0.65 * b;
      }
    }
    const dying = sc.dead?.[s] && t > sc.deadAt ? Math.min(1, (t - sc.deadAt) / 0.9) : 0;
    const hits = theirs.filter((e) => !e.miss && t >= e.at && t < e.at + 0.25);
    m.holder.position.set(x - f * push, -dying * 0.25 + (m.jump || 0), z);
    m.holder.rotation.y = f * (Math.PI / 2 - 0.32) + (m.spin || 0); m.jump = 0; m.spin = 0;
    m.group.rotation.x = -dying * dying * 1.1; // a destroyed machine topples backwards
    const sway = Math.sin(t * 1.25 * P.sw + P.ph);
    poseMech(m, { ...u, hp: sc['hp' + s] }, {
      t, walk, phase, aim, muzzle, recoil, flinch: 0, swing, swingL: ITEM[u.wR]?.cat !== 'melee' && ITEM[u.wL]?.cat === 'melee',
      stance: dying ? 0 : 1, sway: walk >= 0.5 ? 0 : sway, twist, look: 0, lean: lean + dying * 0.2, guard, crouch: Math.min(1, crouch), roll, kickR, kickL, headKick, armR, armL, wristL, wristR,
    });
    // the part that is hit flashes white
    const lit = {}; for (const e of hits) lit[e.part] = Math.floor((t - e.at) * 30) % 2 === 0;
    for (const p of ['body', 'armL', 'armR', 'legs']) m.flash(p, !!lit[p], sc['hp' + s][p] <= 0);
    m.fade(dying > 0.7 ? 1 - (dying - 0.7) / 0.3 * 0.6 : 1);
  }
  // the camera: one of four ways of filming the fight; it drifts, leans towards whoever is acting,
  // shakes with the heavy hits and closes in on a machine that is destroyed
  const act = sc.events.find((e) => t > e.at - 0.7 && t < e.at + 0.4);
  cam.x += (((act ? (act.from === 'L' ? -0.35 : 0.35) : 0) + Math.sin(t * 0.3) * 0.2) - cam.x) * 0.04;
  let shake = 0; for (const e of sc.events) { const dt = t - e.at; if (!e.miss && dt > 0 && dt < 0.3 && e.cat !== 'short') shake = Math.max(shake, (1 - dt / 0.3) * 0.05); }
  const deadSide = sc.dead && (sc.dead.L ? 'L' : sc.dead.R ? 'R' : null), kill = deadSide && t > sc.deadAt ? clamp01((t - sc.deadAt) / 0.8) : 0;
  if (kill && kill < 0.6) shake = Math.max(shake, 0.06);
  if (debug.pos) { cmr.position.set(...debug.pos); cmr.lookAt(...debug.look); }
  else {
    const d = dist * (1 - Math.min(1, t / 4) * 0.06) * (1 - kill * 0.15), jx = (Math.random() - 0.5) * shake, jy = (Math.random() - 0.5) * shake;
    const lx = cam.x * 0.8 + (kill ? (deadSide === 'L' ? -GAP : GAP) * 0.35 * kill : 0);
    if (plan.cam === 1) { cmr.position.set(0.5 + cam.x + jx, 0.45 + jy, d * 0.94); cmr.lookAt(lx, 1.05, 0); } // low, looking up at them
    else if (plan.cam === 2) { cmr.position.set(1.7 + cam.x + jx, 2.2 + jy, d * 1.05); cmr.lookAt(lx, 0.75, 0); } // high
    else if (plan.cam === 3) { const a = 0.4 - t * 0.09; cmr.position.set(Math.sin(a) * d + cam.x + jx, 1.15 + jy, Math.cos(a) * d); cmr.lookAt(lx, 0.88, 0); } // slowly circling
    else { cmr.position.set(1.1 + cam.x + jx, 1.0 + d * 0.05 + jy, d); cmr.lookAt(lx, 0.9, 0); }
  }
  cmr.updateProjectionMatrix();
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
