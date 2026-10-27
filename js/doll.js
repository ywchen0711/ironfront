// The hangar's paper doll: the selected wanzer in 3D on a turntable, rebuilt whenever a part, a weapon or the paint
// changes. Drag to turn it. It has its own small renderer, drawn at half size and blown up so it keeps its pixels.
import * as THREE from './lib/three.module.min.js';
import { buildMech, poseMech } from './mech3d.js';

const PXL = 1;
let renderer = null, scn, cmr, holder = null, mech = null, unit = null, canvas = null, spin = 0.6, drag = null, raf = 0;

function init() {
  canvas = document.createElement('canvas'); canvas.className = 'doll';
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  scn = new THREE.Scene();
  scn.add(new THREE.HemisphereLight('#c8ccd4', '#3a342a', 1.3));
  const sun = new THREE.DirectionalLight('#ffe8c8', 2.5); sun.position.set(-1.8, 3.6, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.012;
  Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 2, bottom: -1, near: 0.5, far: 10 }); sun.shadow.camera.updateProjectionMatrix(); scn.add(sun);
  // a round steel deck to stand on
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1, 0.08, 20), new THREE.MeshToonMaterial({ color: '#3a3832' }));
  deck.position.y = -0.04; deck.receiveShadow = true; scn.add(deck);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.02, 4, 32), new THREE.MeshBasicMaterial({ color: '#c8a040' })); ring.rotation.x = Math.PI / 2; scn.add(ring);
  cmr = new THREE.PerspectiveCamera(30, 1, 0.1, 30); cmr.position.set(0, 1.3, 3.6); cmr.lookAt(0, 0.7, 0);
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; spin += (e.clientX - drag.x) * 0.012; drag.x = e.clientX; });
  const up = () => { drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}
const sig = (u) => ['ri', 'body', 'armL', 'armR', 'legs', 'wL', 'wR', 'sh', 'paint'].map((k) => u[k] || '').join();
// put the doll into a placeholder element, showing this roster entry
export function show(host, r) {
  if (!renderer) init();
  host.appendChild(canvas);
  const want = { side: 'p', ...r, hp: { body: 1, armL: 1, armR: 1, legs: 1 } };
  if (!unit || sig(unit) !== sig(want)) {
    if (holder) scn.remove(holder);
    mech = buildMech(want); mech.bar.visible = mech.star.visible = mech.mark.visible = false;
    holder = new THREE.Group(); holder.add(mech.group); scn.add(holder);
  }
  unit = want;
  if (!raf) loop();
}
function loop() {
  raf = requestAnimationFrame(loop);
  if (!canvas.isConnected) { cancelAnimationFrame(raf); raf = 0; return; }
  const w = Math.max(1, Math.round(canvas.clientWidth / PXL)), h = Math.max(1, Math.round(canvas.clientHeight / PXL));
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); cmr.aspect = w / h; cmr.updateProjectionMatrix(); }
  const t = performance.now() / 1000;
  if (!drag) spin += 0.004;
  holder.rotation.y = spin;
  poseMech(mech, unit, { t, stance: 1, sway: Math.sin(t * 1.25), twist: 0 });
  renderer.render(scn, cmr);
}
