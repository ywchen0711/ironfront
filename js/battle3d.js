// The side-on battle scene in 3D: the two wanzers from the map, face to face on a calm, open stretch of ground,
// lit low from the front so their arms and pauldrons throw shadows across their own armour.
// Shots, explosions and numbers are drawn flat on top (render.js drawBattleFx) at points projected from here.
import * as THREE from './lib/three.module.min.js';
import { buildMech, poseMech } from './mech3d.js?v=15';
import * as W3 from './world3d.js?v=15';
import { P, hash, flyOf } from './render.js?v=15';
import { ITEM } from './data.js?v=15';

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
  const pal = ch === 'd' ? P.sand : ch === 'c' ? P.snow : ch === 'r' ? P.asph : ch === ',' || ch === 'x' ? P.conc : ch === 'f' ? P.forest : ch === 'h' || ch === 'H' ? P.dirt : P.grass;
  return pixTex(32, 32, (g, w, h) => {
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h); void hash;
  });
}
const SKY = {
  clear: { sky: ['#4e6e96', '#5e7ea4', '#7090b2', '#86a2c0', '#a0b6cc', '#bccad4'], fog: '#b4c2ca', near: 12, far: 34, hemi: 1.45, sun: 2.7, col: '#fff4e0' },
  dusk: { sky: ['#1e2430', '#262c36', '#30343c', '#3c3e42', '#4a4844', '#565246'], fog: '#565246', near: 9, far: 26, hemi: 1.25, sun: 2.6, col: '#ffe8c8' },
  night: { sky: ['#05070c', '#080c14', '#0c111c', '#111724', '#171d2c', '#1e2434'], fog: '#1a2030', near: 7, far: 22, hemi: 0.75, sun: 1.3, col: '#a8b8e0', stars: true },
  rain: { sky: ['#363c44', '#40464e', '#4a5058', '#545a62', '#5e646a', '#686e74'], fog: '#5e646a', near: 6, far: 20, hemi: 1.1, sun: 1.4, col: '#d8dce0' },
  fog: { sky: ['#6e7274', '#767a7c', '#7e8284', '#868a8c', '#8e9292', '#969a9a'], fog: '#909494', near: 3.5, far: 12, hemi: 1.3, sun: 1.2, col: '#e8e8e4' },
  snow: { sky: ['#848c96', '#929aa2', '#a0a8ae', '#aeb4ba', '#bcc2c6', '#cacfd2'], fog: '#c4c8cc', near: 6, far: 22, hemi: 1.5, sun: 1.8, col: '#f4f6f8' },
  sand: { sky: ['#84643c', '#947244', '#a4804e', '#b48e58', '#c29c64', '#cea870'], fog: '#c2a06a', near: 5, far: 18, hemi: 1.3, sun: 2.2, col: '#ffe0b0' },
};
const shadeHex = (c, k) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
let hemi = null, far = null, skyKey = '';
function init() {
  scn = new THREE.Scene();
  hemi = new THREE.HemisphereLight('#c8ccd4', '#3a342a', 1.25); scn.add(hemi);
  sun = new THREE.DirectionalLight('#ffe8c8', 2.6); sun.position.set(-2.2, 4.2, 3.4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.012;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 }); sun.shadow.camera.updateProjectionMatrix();
  scn.add(sun);
  cmr = new THREE.PerspectiveCamera(28, 16 / 9, 1, 60);
}
// the far scenery: a line of hills, a city's skyline, a forest, dunes, mountains, or the sea's flat edge
function farTex(theme, col) {
  return pixTex(160, 24, (g, w, h) => {
    g.fillStyle = col;
    for (let x = 0; x < w; x++) {
      let top;
      if (theme === 'city') { const b = x >> 3; top = 6 + Math.round(hash(b, 1, 4) * 12) * (hash(b, 2, 4) > 0.25 ? 1 : 0.4); }
      else if (theme === 'forest') top = 12 - Math.round(Math.abs(((x % 7) - 3)) * -1.4 + 4 + hash(x >> 3, 3, 5) * 3);
      else if (theme === 'desert') top = 16 + Math.round(Math.sin(x * 0.05) * 2 + Math.sin(x * 0.11 + 2) * 1.2);
      else if (theme === 'snow' || theme === 'mountain') top = 4 + Math.round(Math.abs(Math.sin(x * 0.045)) * 8 + Math.abs(Math.sin(x * 0.12 + 1)) * 5);
      else if (theme === 'sea') top = 19;
      else top = 10 + Math.round(Math.sin(x * 0.07) * 3 + Math.sin(x * 0.17 + 1) * 1.5);
      top = Math.max(1, Math.min(h - 1, top));
      g.fillRect(x, top, 1, h - top);
      if ((theme === 'snow' || theme === 'mountain') && top < 9) { g.fillStyle = '#e8ecee'; g.fillRect(x, top, 1, 2); g.fillStyle = col; }
    }
    if (theme === 'city') { g.fillStyle = shadeHex(col, 1.6); for (let j = 0; j < 40; j++) g.fillRect(Math.floor(hash(j, 5, 6) * w), 10 + Math.floor(hash(j, 6, 6) * 12), 1, 1); }
  });
}
function setSky(weather, theme) {
  const key = weather + theme; if (key === skyKey) return; skyKey = key;
  const S = SKY[weather] || SKY.dusk, sky = S.sky;
  scn.background = pixTex(1, 96, (g, w, h) => { for (let y = 0; y < h; y++) { const k = y / h * sky.length, i = Math.floor(k), f = k - i; g.fillStyle = sky[Math.min(sky.length - 1, i + (f > 0.8 && y % 2 ? 1 : 0))]; g.fillRect(0, y, 1, 1); } });
  if (S.stars) { const st = pixTex(256, 64, (g, w, h) => { for (let j = 0; j < 90; j++) { g.fillStyle = hash(j, 2, 3) > 0.7 ? '#e8ecff' : '#8890a8'; g.fillRect(Math.floor(hash(j, 0, 3) * w), Math.floor(hash(j, 1, 3) * h * 0.8), 1, 1); } }); scn.background = st; scn.background.repeat.set(1, 1); scn.userData.night = true; }
  scn.fog = new THREE.Fog(S.fog, S.near, S.far);
  hemi.intensity = S.hemi; sun.intensity = S.sun; sun.color.set(S.col);
  if (far) scn.remove(far);
  far = new THREE.Mesh(new THREE.PlaneGeometry(64, 9.6), new THREE.MeshBasicMaterial({ map: farTex(theme, shadeHex(S.fog, 0.72)), transparent: true, fog: false, depthWrite: false }));
  far.position.set(0, 1.4, -22); scn.add(far);
}

// a new fight: build the two machines once and keep them until the next one
export function start(sc) {
  if (!scn) init();
  setSky(sc.weather || 'dusk', sc.theme || 'hills');
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
    v.t1 = e.at; if (v.lead == null) v.lead = 0.6 + flyOf(e); e.style = STYLES[Math.floor(R(12, e.n) * STYLES.length)]; e.approach = ['run', 'dash', 'leap'][Math.floor(R(13, e.n) * 3)];
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
    const V = plan.volleys.find((v) => v.from === s && t > v.t0 - v.lead && t < v.t1 + 0.4);
    if (V) {
      const q = clamp01((t - (V.t0 - V.lead)) / (V.t1 - V.t0 + V.lead + 0.4)), env = Math.sin(q * Math.PI);
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
      const fl = flyOf(e);
      if (e.cat === 'short' && (e.fx === 'flame' ? dt > -fl && dt < 0 : dt > -fl - 0.02 && dt < -fl + 0.06)) { muzzle = true; recoil = e.fx === 'flame' ? 0.3 : 1; }
      if (e.cat === 'long' || e.fx === 'shell') { const k = imp(dt + fl, 0.05, 5); lean -= (e.fx === 'artillery' ? 0.22 : 0.16) * k; push -= 0.05 * k; }
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
    // a helicopter hovers (and spins down when it is shot down); a vehicle sinks and tilts; a wanzer topples backwards
    const hy = m.air ? 1.05 + Math.sin(t * 1.7 + f) * 0.05 - dying * 1.0 : 0;
    m.holder.position.set(x - f * push, -dying * (m.vehicle ? 0.12 : 0.25) + (m.jump || 0) + hy, z);
    m.holder.rotation.y = f * (Math.PI / 2 - 0.32) + (m.spin || 0) + (m.air ? dying * dying * 5 : 0); m.jump = 0; m.spin = 0;
    m.group.rotation.x = m.air ? dying * 0.5 : m.vehicle ? -dying * 0.12 : -dying * dying * 1.1;
    m.group.rotation.z = m.vehicle && !m.air ? dying * 0.1 * f : 0;
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
      legs: m.legL ? proj(m.legL.knee, 0, -0.1, 0.1) : m.rotor ? proj(m.rotor) : proj(m.group, 0, 0.15, 0.3),
      miss: proj(m.torso, 0, 0.75, -0.9), head: proj(m.head, 0, 0.3, 0), ground: proj(m.holder),
    };
  }
  // one scene unit in screen pixels at the machines, so the flat effects scale with the view
  out.unit = Math.abs(out.R.ground.x - out.L.ground.x) / (2 * GAP);
  return out;
}
