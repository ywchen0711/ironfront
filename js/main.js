// 鋼魂戰線 / Iron Front: the game. Title → briefing → battle (your turn, the enemy's turn) → debriefing → base
// (hangar and shop) → the next mission.
import { MISSIONS, START, JOIN, PILOTS, ITEM, BODIES, ARMS, LEGS, WEAPONS, TERRAIN, TXT } from './data.js';
import { makeUnit, alive, reach, weaponsOf, inRange, dist, hitChance, counterOf, fight, learn, weight, power, moveOf, evadeOf, PARTS, expected, repair } from './rules.js';
import { plan } from './ai.js';
import { drawBattleFx } from './render.js';
import * as B3 from './battle3d.js';
import * as Doll from './doll.js';
import { SCHEMES, schemeColour } from './mech3d.js';
import * as W3 from './world3d.js';
import { sfx, setMute, muted } from './sfx.js';

const $ = (s) => document.querySelector(s), cv = $('#cv'), g = cv.getContext('2d');
const KEY = 'ironfront.save', GAME = 'ironfront';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let S = null; // the saved game
const loadSave = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
let prefs = Object.assign({ lang: /^zh/i.test(navigator.language || '') ? 'zh' : 'en', anim: true }, (() => { try { return JSON.parse(localStorage.getItem('ironfront.prefs')) || {}; } catch (e) { return {}; } })());
const savePrefs = () => { try { localStorage.setItem('ironfront.prefs', JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
let cloud = null;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); cloud?.touch(GAME, KEY); } catch (e) { /* ignore */ } };
const T = () => TXT[prefs.lang], L = (o) => (prefs.lang === 'en' ? o.en : o.zh);
const pname = (u) => L(PILOTS[u.pilot]);
const iname = (id) => { const x = ITEM[id]; return x ? (x.zh ? L(x) : x.name) : T().none; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const colon = () => (prefs.lang === 'en' ? ': ' : '：');

// ---------------------------------------------------------------- canvas and camera
// The battlefield is a 3D scene (world3d.js) rendered small and blown up PX times, so it keeps its pixels.
// The 2D canvas on top only shows the side-on battle scene.
let VW = 960, VH = 600, PX = 3, mode = 'title', B = null, scene = null;
const gl = $('#gl');
const fx = document.createElement('canvas'), fxg = fx.getContext('2d'); // shots and explosions over the 3D battle scene
const PL = { body: 'BODY', armL: 'ARM L', armR: 'ARM R', legs: 'LEGS' };
W3.init(gl);
function resize() {
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  VW = r.width; VH = r.height; cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
  PX = 2; // every pixel of the scene is 2 x 2 screen pixels: crisp, but fine enough to show the detail
  W3.resize(VW, VH, PX);
}
const screenToTile = (cx, cy) => W3.pick(cx, cy);
// a word over a unit on the map, like the "Fire" when it shoots
function label(u, text, ms = 700, col) { B.labels.push({ u, text, col, until: performance.now() + ms }); }

// ---------------------------------------------------------------- the loop
function frame() {
  if ((mode === 'battle' || mode === 'scene') && B) {
    const now = performance.now(); B.labels = B.labels.filter((l) => now < l.until);
    if (!scene) W3.render(highlights(), { sel: B.sel, cursor: B.hover, labels: B.labels });
    if (scene) {
      // the battle scene takes over the 3D view; the effects go on a canvas of the same small size, blown up
      scene.t = (now - scene.t0) / 1000; const A = B3.render(scene); panels();
      const { w, h } = W3.viewSize(); if (fx.width !== w || fx.height !== h) { fx.width = w; fx.height = h; }
      drawBattleFx(fxg, scene, A);
      g.clearRect(0, 0, VW, VH); g.imageSmoothingEnabled = false; g.drawImage(fx, 0, 0, w * PX, h * PX);
      cv.style.pointerEvents = 'auto';
    } else { g.clearRect(0, 0, VW, VH); cv.style.pointerEvents = 'none'; }
  } else { g.fillStyle = '#100e0c'; g.fillRect(0, 0, VW, VH); }
  requestAnimationFrame(frame);
}
function highlights() {
  const h = new Map(), W = B.map[0].length;
  if (B.step === 'move' && B.reach) for (const t of B.reach.tiles) h.set(t.y * W + t.x, 'move');
  if (B.step === 'target' && B.wsel) { for (let y = 0; y < B.map.length; y++) for (let x = 0; x < W; x++) if (inRange(B.wsel.w, Math.abs(x - B.sel.x) + Math.abs(y - B.sel.y))) h.set(y * W + x, 'range'); for (const e of targets(B.sel, B.wsel)) h.set(e.y * W + e.x, 'att'); }
  if (B.peek) for (const t of B.peek.tiles) h.set(t.y * W + t.x, 'peek');
  return h;
}
const targets = (u, w) => B.units.filter((o) => alive(o) && o.side !== u.side && inRange(w.w, dist(u, o)));

// ---------------------------------------------------------------- title
function title() {
  mode = 'title'; hideAll(); const t = T(), sv = loadSave();
  $('#screen').innerHTML = `<div class="title"><div class="logo">${t.title}</div><p>${t.sub}</p>
    ${sv ? `<button class="big" data-act="continue">${t.cont}<small>${t.mission} ${Math.min(sv.mi + 1, MISSIONS.length)}・${L(MISSIONS[Math.min(sv.mi, MISSIONS.length - 1)])}</small></button>` : ''}
    <button class="big ${sv ? 'ghost' : ''}" data-act="new">${t.start}</button><button class="small" data-act="lang">🌐 ${t.lang}</button></div>`;
  $('#screen').hidden = false;
}
function newGame() { S = { mi: 0, money: START.money, roster: START.roster.map((r) => ({ ...r, lv: PILOTS[r.pilot].lv, exp: 0 })), inv: { ...START.inv } }; save(); briefing(); }

// ---------------------------------------------------------------- the story between battles
async function story(lines) {
  const box = $('#story');
  for (const line of lines) {
    const [who, said] = line.includes('|') ? line.split('|') : [null, line];
    box.innerHTML = `<div class="talk">${who ? `<b>${esc(who)}</b>` : ''}<p class="${who ? '' : 'narr'}">${esc(said)}</p><small>${T().tap} ▶</small></div>`; box.hidden = false;
    await new Promise((r) => { box.onclick = r; });
  }
  box.hidden = true;
}
async function briefing() {
  const M = MISSIONS[S.mi];
  if (JOIN[S.mi] && !S.roster.some((r) => r.pilot === JOIN[S.mi].pilot)) { S.roster.push({ ...JOIN[S.mi], lv: PILOTS[JOIN[S.mi].pilot].lv, exp: 0 }); save(); }
  hideAll(); mode = 'brief';
  $('#screen').innerHTML = `<div class="brief"><small>${T().mission} ${S.mi + 1}</small><h1>${esc(L(M))}</h1></div>`; $('#screen').hidden = false;
  await story(L(M.brief));
  base();
}

// ---------------------------------------------------------------- the base: hangar and shop
let baseTab = 'hangar', hsel = 0;
function base() {
  mode = 'base'; hideAll(); const t = T(), M = MISSIONS[S.mi];
  const over = S.roster.filter((r) => weight(r) > power(r));
  const shopIds = [...new Set(MISSIONS.slice(0, S.mi + 1).flatMap((m) => m.shop))];
  let body = '';
  if (baseTab === 'hangar') {
    const r = S.roster[hsel] || S.roster[0];
    body = `<div class="roster">${S.roster.map((x, i) => `<button class="pilot ${i === hsel ? 'on' : ''} ${weight(x) > power(x) ? 'warn' : ''}" data-h="${i}"><b>${esc(L(PILOTS[x.pilot]))}</b><small>${t.lv}${x.lv}</small></button>`).join('')}</div>
      <div class="bay"><div class="dollbox"><div id="doll"></div><div class="paints"><span>${t.paint}</span>${SCHEMES.map((k) => `<button class="sw ${(r.paint || 'olive') === k ? 'on' : ''}" data-paint="${k}" title="${esc(L(PAINT_NAMES[k]))}" style="background:${schemeColour(k)}"></button>`).join('')}</div></div>
      <div class="slots">${['body', 'armL', 'armR', 'legs', 'wR', 'wL', 'sh'].map((s) => slotRow(r, s)).join('')}</div></div>
      <div class="wbar ${weight(r) > power(r) ? 'bad' : ''}">${t.weight} ${weight(r)} / ${t.power} ${power(r)}${weight(r) > power(r) ? ' — ' + t.overweight : ''}<i style="width:${Math.min(100, weight(r) / power(r) * 100)}%"></i></div>
      <div class="stats">${t.moveN} ${ITEM[r.legs].move}・${t.eva} ${ITEM[r.legs].eva}・HP ${PARTS.map((p) => ITEM[r[p]].hp).join(' / ')}</div>`;
  } else {
    body = `<div class="shop">${shopIds.map((id) => { const x = ITEM[id], n = S.inv[id] || 0; return `<div class="ware"><b>${esc(iname(id))}</b><small>${describe(id)}</small><span>💰 ${x.price}</span>
      <button data-buy="${id}" ${S.money < x.price ? 'disabled' : ''}>${t.buy}</button>${n ? `<button class="ghost" data-sell="${id}">${t.sell} ${Math.floor(x.price / 2)}</button><em>${t.owned} ${n}</em>` : ''}</div>`; }).join('') || '<p>—</p>'}</div>`;
  }
  $('#screen').innerHTML = `<div class="base"><header><h2>${t.base}</h2><span class="money">💰 ${S.money.toLocaleString()}</span><button class="small" data-act="lang">🌐 ${t.lang}</button></header>
    <div class="next">${t.mission} ${S.mi + 1}${colon()}<b>${esc(L(M))}</b> — ${M.win === 'boss' ? t.winBoss(L(PILOTS[M.foes.find((f) => f.boss).pilot])) : t.winAll}</div>
    <div class="tabs"><button class="${baseTab === 'hangar' ? 'on' : ''}" data-tab="hangar">🔧 ${t.hangar}</button><button class="${baseTab === 'shop' ? 'on' : ''}" data-tab="shop">🛒 ${t.shop}</button></div>
    ${body}<button class="big" data-act="sortie" ${over.length ? 'disabled' : ''}>▶ ${t.sortie}${over.length ? `<small>${over.map((x) => L(PILOTS[x.pilot])).join(', ')}${colon()}${t.overweight}</small>` : ''}</button></div>`;
  $('#screen').hidden = false;
  if (baseTab === 'hangar') Doll.show($('#doll'), S.roster[hsel] || S.roster[0]);
}
const PAINT_NAMES = { olive: { zh: '橄欖綠', en: 'Olive' }, desert: { zh: '沙漠', en: 'Desert' }, navy: { zh: '海軍藍', en: 'Navy' }, arctic: { zh: '雪地灰', en: 'Arctic' }, crimson: { zh: '赤紅', en: 'Crimson' }, black: { zh: '暗夜黑', en: 'Night' } };
function describe(id) {
  const x = ITEM[id], t = T();
  if (x.power) return `HP ${x.hp}・${t.power} ${x.power}`;
  if (x.punch) return `HP ${x.hp}・${t.weight} ${x.w}${x.acc ? `・+${x.acc}%` : ''}`;
  if (x.move) return `HP ${x.hp}・${t.moveN} ${x.move}・${t.eva} ${x.eva}・${t.weight} ${x.w}`;
  if (x.cat === 'shield') return `−${Math.round(x.guard * 100)}%・${t.weight} ${x.w}`;
  return `${t.cats[x.cat]}・${x.dmg}×${x.shots}・${t.range} ${x.rmin}-${x.rmax}・${t.hit} ${x.acc}%${x.ammo ? `・${t.ammo} ${x.ammo}` : ''}・${t.weight} ${x.w}`;
}
function slotRow(r, s) {
  const t = T(), kind = { body: BODIES, armL: ARMS, armR: ARMS, legs: LEGS }[s], cur = r[s];
  const fits = (id) => (kind ? kind.some((k) => k.id === id) : s === 'sh' ? ITEM[id]?.cat === 'long' : ['short', 'melee', 'shield'].includes(ITEM[id]?.cat));
  const opts = [cur, ...Object.keys(S.inv).filter((id) => S.inv[id] > 0 && id !== cur && fits(id))].filter((v, i, a) => a.indexOf(v) === i);
  return `<label class="slot"><span>${t[s]}</span><select data-slot="${s}">${kind ? '' : `<option value="" ${!cur ? 'selected' : ''}>${t.none}</option>`}${opts.filter(Boolean).map((id) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(iname(id))}${id !== cur ? ` (${S.inv[id]})` : ''}</option>`).join('')}</select><small>${cur ? describe(cur) : ''}</small></label>`;
}
function equip(s, id) {
  const r = S.roster[hsel], old = r[s];
  if (old) S.inv[old] = (S.inv[old] || 0) + 1;
  if (id) { S.inv[id]--; if (!S.inv[id]) delete S.inv[id]; }
  r[s] = id || null; save(); sfx('click'); base();
}

// ---------------------------------------------------------------- a battle
function sortie() {
  const M = MISSIONS[S.mi];
  B = { M, map: M.map, units: [], turn: 1, step: 'idle', sel: null, labels: [] };
  M.p.forEach(([x, y], i) => { const r = S.roster[i]; if (r) B.units.push(makeUnit(r, 'p', x, y, { ri: i, face: 1 })); });
  for (const f of M.foes) B.units.push(makeUnit(f, 'e', f.x, f.y, { boss: !!f.boss, face: -1 }));
  hideAll(); mode = 'battle'; resize(); W3.load(B);
  $('#hud').hidden = false; hud(); sfx('start');
  banner(T().phaseP);
}
function hud() {
  const t = T(), M = B.M;
  $('#hud').innerHTML = `<div class="hl"><b>${esc(L(M))}</b><span>${t.turn(B.turn)}・${B.phase === 'e' ? t.theirs : t.yours}</span><small>${M.win === 'boss' ? t.winBoss(L(PILOTS[M.foes.find((f) => f.boss).pilot])) : t.winAll}</small></div>
    <div class="hr"><button data-act="anim">🎬 ${t.anim}${colon()}${prefs.anim ? t.on : t.off}</button><button data-act="rotl" title="⟲">⟲</button><button data-act="rotr" title="⟳">⟳</button><button data-act="zin">＋</button><button data-act="zout">－</button><button data-act="mute">${muted() ? '🔇' : '🔊'}</button><button data-act="quit">${t.quit}</button><button class="end" data-act="end" ${B.phase === 'e' || B.busy ? 'disabled' : ''}>${t.endTurn} ▶</button></div>`;
}
function card(u) {
  const el = $('#card'); if (!u) { el.hidden = true; return; }
  const t = T(), ws = weaponsOf(u);
  el.innerHTML = `<div class="ch ${u.side}"><b>${esc(pname(u))}</b> <small>${t.lv}${u.lv}${u.boss ? ' ★' + t.boss : ''}</small><span>${t.moveN} ${moveOf(u)}・${t.eva} ${evadeOf(u, B.map)}%${u.side === 'p' ? `・🔧${u.kits}` : ''}</span></div>
    <div class="rin">${PARTS.map((p) => { const k = Math.max(0, u.hp[p]) / u.max[p]; return `<div class="hp"><span>${PL[p]}</span><i><s style="width:${k * 100}%"></s></i><em>${u.hp[p]}</em></div>`; }).join('')}</div>
    <div class="ws">${ws.map((o) => `<span>${esc(o.slot === 'fist' ? L(o.w) : iname(o.w.id))} <small>${o.w.dmg}×${o.w.shots}・${o.w.rmin}-${o.w.rmax}${o.slot === 'sh' ? `・${u.ammo}` : ''}</small></span>`).join('')}</div>`;
  el.hidden = false;
}
function menu(html) { const m = $('#menu'); if (!html) { m.hidden = true; return; } m.innerHTML = html; m.hidden = false; }
function banner(s) { const b = $('#banner'); b.textContent = s; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

// player input on the map
function tapTile(p) {
  if (!B || B.phase === 'e' || B.busy || mode !== 'battle') return;
  const u = p && B.units.find((o) => alive(o) && o.x === p.x && o.y === p.y);
  B.peek = null;
  if (B.step === 'idle' || B.step === 'move') {
    if (u && u.side === 'p' && !u.done) { B.sel = u; B.step = 'move'; B.reach = reach(u, B.units, B.map); B.from = { x: u.x, y: u.y }; card(u); menu(actionMenu(u, true)); sfx('click'); return; }
    if (B.step === 'move' && p && B.reach.tiles.some((t) => t.x === p.x && t.y === p.y)) { walk(B.sel, B.reach.path(p.x, p.y)).then(() => { B.step = 'act'; menu(actionMenu(B.sel)); }); B.step = 'walking'; menu(null); return; }
    if (u) { card(u); if (u.side === 'e') B.peek = reach(u, B.units, B.map); }
    else { B.sel = null; B.step = 'idle'; card(null); menu(null); }
    return;
  }
  if (B.step === 'target') {
    if (u && u.side === 'e' && inRange(B.wsel.w, dist(B.sel, u))) { B.target = u; card(u); preview(); sfx('click'); }
  }
}
function actionMenu(u, before) {
  const t = T(), ws = weaponsOf(u);
  return `<div class="acts">${ws.map((o, i) => { const n = targets(u, o).length; return `<button data-w="${i}" ${n ? '' : 'disabled'}>${o.w.cat === 'long' ? '🚀' : o.w.cat === 'melee' ? '👊' : '🔫'} ${esc(o.slot === 'fist' ? L(o.w) : iname(o.w.id))}<small>${o.w.rmin}-${o.w.rmax}${o.slot === 'sh' ? `・${t.ammo} ${u.ammo}` : ''}</small></button>`; }).join('')}
    ${u.kits > 0 ? `<button data-act="repair" ${PARTS.some((p) => u.hp[p] < u.max[p]) ? '' : 'disabled'}>🔧 ${t.repair}<small>${t.kits} ${u.kits}</small></button>` : ''}
    <button data-act="wait">⏸ ${t.wait}</button><button class="ghost" data-act="cancel">${t.cancel}</button></div>${before ? `<p class="hint">${t.moveHint}</p>` : ''}`;
}
function preview() {
  const t = T(), a = B.sel, w = B.wsel, d = B.target, pct = hitChance(a, w, d, B.map), cw = counterOf(d, a, w.w.cat);
  menu(`<div class="pv"><div><b>${esc(pname(a))}</b> → <b class="e">${esc(pname(d))}</b></div>
    <div>${esc(w.slot === 'fist' ? L(w.w) : iname(w.w.id))}${colon()}${t.hit} <b>${pct}%</b>・${t.dmg} ${w.w.dmg}×${w.w.shots}</div>
    <div class="c">${cw ? `${t.counter}${colon()}${esc(cw.slot === 'fist' ? L(cw.w) : iname(cw.w.id))} ${t.hit} ${hitChance(d, cw, a, B.map)}%` : t.noCounter}</div>
    <button class="fire" data-act="fire">💥 ${t.fire}</button><button class="ghost" data-act="untarget">${t.back}</button></div>`);
}
function walk(u, path) {
  return new Promise(async (res) => {
    const A = u.anim || (u.anim = { phase: 0, walk: 0 }); A.moving = true; let n = 0;
    for (const s of path) {
      const fx = u.x, fy = u.y, fh = W3.heightOf(B.map[fy][fx]), th = W3.heightOf(B.map[s.y][s.x]);
      u.dir = Math.atan2(s.x - fx, s.y - fy);
      const t0 = performance.now(), dur = 230, ph0 = A.phase;
      u.x = s.x; u.y = s.y;
      // one step per square; the legs make half a stride in that time, so the feet keep pace with the ground
      await new Promise((r) => { const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); u.vx = fx + (s.x - fx) * k; u.vy = fy + (s.y - fy) * k; u.vh = fh + (th - fh) * Math.min(1, k * 1.6); A.phase = ph0 + k * Math.PI; if (k < 1) requestAnimationFrame(tick); else r(); }; tick(); });
      if (n++ % 1 === 0) sfx('step');
    }
    u.vx = u.vy = u.vh = undefined; A.moving = false; res();
  });
}
async function attack(a, w, d) {
  B.busy = true; hud(); menu(null);
  a.dir = Math.atan2(d.x - a.x, d.y - a.y); d.dir = Math.atan2(a.x - d.x, a.y - d.y); W3.focus((a.x + d.x) / 2, (a.y + d.y) / 2);
  const hpA = { ...a.hp }, hpD = { ...d.hp };
  const A = a.anim || (a.anim = { phase: 0, walk: 0 }), now = performance.now();
  A.aimUntil = now + 900; A.fireFrom = now + 380; label(a, 'Fire', 650); sfx('click'); await wait(600);
  const r = fight(a, w, d, B.map);
  await battleScene(r, hpA, hpD);
  for (const [u, v] of [[d, r.first], [a, r.second]]) if (v && v.hits.some((h) => !h.miss)) (u.anim || (u.anim = { phase: 0, walk: 0 })).hitUntil = performance.now() + 450;
  if (!prefs.anim) { const sum = (v) => v.hits.reduce((s2, h) => s2 + (h.dmg || 0), 0); label(d, sum(r.first) ? `-${sum(r.first)}` : 'Miss', 900, sum(r.first) ? '#a02010' : '#141410'); if (r.second) { await wait(450); label(a, sum(r.second) ? `-${sum(r.second)}` : 'Miss', 900, sum(r.second) ? '#a02010' : '#141410'); } await wait(700); }
  for (const u of [a, d]) if (!alive(u)) { u.dying = 0.01; sfx('boom'); const t0 = performance.now(); await new Promise((res) => { const tick = () => { u.dying = (performance.now() - t0) / 600; if (u.dying < 1) requestAnimationFrame(tick); else { u.dying = 0; res(); } }; tick(); }); }
  for (const u of [a, d]) { const up = u.side === 'p' && learn(u); if (up) banner(T().expUp(pname(u), up)); }
  B.busy = false; hud();
  return r;
}
// the side-on battle: every shot becomes an event on a little timeline
function battleScene(r, hpA, hpD) {
  if (!prefs.anim) return Promise.resolve();
  const left = r.att.side === 'p' ? 'att' : 'def', Ls = left === 'att' ? 'L' : 'R', Rs = left === 'att' ? 'R' : 'L';
  const ev = []; let t = 0.5, n = 0;
  const add = (vol, from, w) => { for (const h of vol.hits) { ev.push({ at: t, from, cat: w.w.cat, ...h, n: n++ }); t += w.w.cat === 'long' ? 0.6 : w.w.cat === 'melee' ? 0.5 : 0.13; } t += 0.5; };
  add(r.first, Ls, r.w);
  if (r.second) add(r.second, Rs, r.cw);
  const sc = { L: left === 'att' ? r.att : r.def, R: left === 'att' ? r.def : r.att, events: ev, t: 0, t0: performance.now(), ground: B.map[r.def.y][r.def.x] };
  sc.nameL = `${pname(sc.L)} ${T().lv}${sc.L.lv}`; sc.nameR = `${pname(sc.R)} ${T().lv}${sc.R.lv}`;
  const startL = left === 'att' ? hpA : hpD, startR = left === 'att' ? hpD : hpA; sc.hpL = { ...startL }; sc.hpR = { ...startR };
  sc.dead = { L: !alive(sc.L), R: !alive(sc.R) }; sc.deadAt = t;
  const wn = (o) => (o ? (o.slot === 'fist' ? L(o.w) : iname(o.w.id)) : '');
  sc.wL = left === 'att' ? wn(r.w) : wn(r.cw); sc.wR = left === 'att' ? wn(r.cw) : wn(r.w);
  const end = t + (sc.dead.L || sc.dead.R ? 1.4 : 0.5);
  mode = 'scene'; scene = sc;
  const shown = ['#hud', '#card', '#menu'].filter((id) => !$(id).hidden); shown.forEach((id) => { $(id).hidden = true; });
  buildPanels(sc);
  return new Promise((res) => {
    let done = false, fired = new Set();
    const finish = () => { if (done) return; done = true; scene = null; mode = 'battle'; $('#bpan').hidden = true; shown.forEach((id) => { if (id === '#hud') $(id).hidden = false; }); cv.removeEventListener('pointerdown', finish); res(); };
    cv.addEventListener('pointerdown', finish);
    const tick = () => {
      if (done) return;
      const tt = (performance.now() - sc.t0) / 1000;
      for (const e of ev) if (tt >= e.at && !fired.has(e.n)) { fired.add(e.n); if (!e.miss) { const side = e.from === 'L' ? 'hpR' : 'hpL'; sc[side][e.part] = Math.max(0, sc[side][e.part] - e.dmg); sfx(e.cat === 'long' ? 'boom' : e.cat === 'melee' ? 'clang' : 'hit'); } else sfx('miss'); }
      for (const e of ev) if (!fired.has('s' + e.n) && tt >= e.at - (e.cat === 'long' ? 0.55 : 0.16) && e.cat !== 'melee') { fired.add('s' + e.n); sfx(e.cat === 'long' ? 'launch' : 'shot'); }
      if (tt >= end) finish(); else requestAnimationFrame(tick);
    };
    tick();
  });
}
function buildPanels(sc) {
  const one = (s) => `<div class="rp ${sc[s].side}"><div class="rt">${esc(s === 'L' ? sc.nameL : sc.nameR)}</div><div class="rin">${PARTS.map((p) => `<div class="hp" data-p="${s}${p}"><span>${PL[p]}</span><i><s></s></i><em></em></div>`).join('')}</div><div class="rw">${esc(sc['w' + s] || '—')}</div></div>`;
  $('#bpan').innerHTML = one('L') + one('R'); $('#bpan').hidden = false; panels();
}
function panels() {
  if (!scene) return;
  for (const s of ['L', 'R']) for (const p of PARTS) {
    const el = document.querySelector(`[data-p="${s}${p}"]`); if (!el) continue;
    const v = Math.max(0, Math.round(scene['hp' + s][p])), k = v / scene[s].max[p];
    const bar = el.querySelector('s'), num = el.querySelector('em');
    if (num.textContent !== String(v)) { num.textContent = v; bar.style.width = k * 100 + '%'; el.classList.toggle('dead', v <= 0); }
  }
}
function over() {
  const ps = B.units.filter((u) => u.side === 'p'), es = B.units.filter((u) => u.side === 'e');
  const won = B.M.win === 'boss' ? es.some((u) => u.boss && !alive(u)) : es.every((u) => !alive(u));
  const lost = ps.every((u) => !alive(u));
  return won ? 'win' : lost ? 'lose' : null;
}
async function afterAction(u) {
  u.done = true; B.sel = null; B.step = 'idle'; menu(null); card(null);
  const o = over(); if (o) return endBattle(o);
  if (B.units.filter((x) => x.side === 'p' && alive(x)).every((x) => x.done)) await enemyTurn();
}
async function enemyTurn() {
  B.phase = 'e'; B.busy = true; hud(); banner(T().phaseE); await wait(900);
  for (const e of B.units.filter((u) => u.side === 'e' && alive(u))) {
    if (!alive(e)) continue;
    const pl = plan(e, B.units, B.map); if (!pl) continue;
    centreOn(e); await wait(250);
    if (pl.path.length) await walk(e, pl.path);
    if (pl.w && alive(pl.target) && inRange(pl.w.w, dist(e, pl.target)) && weaponsOf(e).some((o) => o.slot === pl.w.slot)) { await wait(200); await attack(e, weaponsOf(e).find((o) => o.slot === pl.w.slot), pl.target); }
    const o = over(); if (o) { B.busy = false; return endBattle(o); }
    await wait(150);
  }
  B.turn++; B.phase = 'p'; B.busy = false; for (const u of B.units) if (u.side === 'p') u.done = false;
  hud(); banner(T().phaseP); sfx('start');
}
function centreOn(u) { W3.focus(u.x, u.y); }
async function endBattle(o) {
  B.phase = 'over'; B.busy = true; menu(null); card(null);
  const t = T(), M = B.M;
  if (o === 'win') {
    sfx('win'); S.money += M.reward;
    for (const u of B.units.filter((x) => x.side === 'p')) { const r = S.roster[u.ri]; r.lv = u.lv; r.exp = u.exp; }
    S.mi++; save();
    await resultBox(`<h1>${t.victory}</h1><p>${t.reward(M.reward.toLocaleString())}</p>`, t.next);
    $('#hud').hidden = true; mode = 'brief'; hideAll(); $('#screen').innerHTML = `<div class="brief"><h1>${esc(L(M))}</h1></div>`; $('#screen').hidden = false;
    await story(L(M.after));
    if (S.mi >= MISSIONS.length) { $('#screen').innerHTML = `<div class="title"><div class="logo">${t.title}</div><p>${t.theEnd}</p><button class="big" data-act="title">OK</button></div>`; return; }
    briefing();
  } else {
    sfx('lose');
    const again = await resultBox(`<h1 class="bad">${t.defeat}</h1>`, t.retry, t.toBase);
    $('#hud').hidden = true; if (again) sortie(); else base();
  }
}
function resultBox(html, yes, no) {
  return new Promise((res) => {
    const m = $('#result'); m.innerHTML = `<div class="rb">${html}<button class="big" data-r="1">${yes}</button>${no ? `<button class="big ghost" data-r="0">${no}</button>` : ''}</div>`; m.hidden = false;
    m.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; m.hidden = true; res(b.dataset.r === '1'); };
  });
}
function hideAll() { for (const id of ['#screen', '#hud', '#card', '#menu', '#story', '#result']) $(id).hidden = true; }

// ---------------------------------------------------------------- input
let drag = null; const touches = new Map();
gl.addEventListener('contextmenu', (e) => e.preventDefault());
gl.addEventListener('pointerdown', (e) => {
  if (mode !== 'battle') return; gl.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  drag = { x: e.clientX, y: e.clientY, moved: false, pan: e.button === 2 || e.button === 1 || e.shiftKey || touches.size > 1, n: touches.size };
});
gl.addEventListener('pointermove', (e) => {
  if (B && mode === 'battle' && e.pointerType === 'mouse' && !drag) B.hover = screenToTile(e.clientX, e.clientY);
  if (!drag || !touches.has(e.pointerId)) return;
  const prev = touches.get(e.pointerId), dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  if (touches.size >= 2) { // two fingers: move together to pan, apart to zoom
    const [a, b] = [...touches.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [c, d] = [...touches.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y); if (d0 > 0) W3.zoomBy(d1 / d0); W3.pan(dx / 2, dy / 2); drag.moved = true; return;
  }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
  if (!drag.moved) return;
  if (drag.pan) W3.pan(dx, dy); else W3.rotate(-dx * 0.008, dy * 0.003);
});
const up = (e) => {
  if (!drag) return; touches.delete(e.pointerId);
  if (!drag.moved && drag.n === 1 && touches.size === 0) tapTile(screenToTile(e.clientX, e.clientY));
  if (touches.size === 0) drag = null;
};
gl.addEventListener('pointerup', up); gl.addEventListener('pointercancel', up);
gl.addEventListener('wheel', (e) => { if (mode !== 'battle') return; e.preventDefault(); W3.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
document.addEventListener('keydown', (e) => { if (mode !== 'battle') return; if (e.key === 'q' || e.key === 'Q') W3.snap(-Math.PI / 4); if (e.key === 'e' || e.key === 'E') W3.snap(Math.PI / 4); });
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const a = b.dataset.act;
  if (a === 'new') { if (!loadSave() || confirm(T().newGame)) newGame(); }
  else if (a === 'continue') { S = loadSave(); base(); }
  else if (a === 'title') title();
  else if (a === 'lang') { prefs.lang = prefs.lang === 'en' ? 'zh' : 'en'; savePrefs(); document.documentElement.lang = prefs.lang === 'en' ? 'en' : 'zh-Hant'; mode === 'base' ? base() : title(); }
  else if (b.dataset.tab) { baseTab = b.dataset.tab; base(); }
  else if (b.dataset.h) { hsel = +b.dataset.h; base(); }
  else if (b.dataset.paint) { (S.roster[hsel] || S.roster[0]).paint = b.dataset.paint; save(); sfx('click'); base(); }
  else if (b.dataset.buy) { const x = ITEM[b.dataset.buy]; if (S.money >= x.price) { S.money -= x.price; S.inv[x.id] = (S.inv[x.id] || 0) + 1; save(); sfx('buy'); base(); } }
  else if (b.dataset.sell) { const x = ITEM[b.dataset.sell]; S.inv[x.id]--; if (!S.inv[x.id]) delete S.inv[x.id]; S.money += Math.floor(x.price / 2); save(); sfx('buy'); base(); }
  else if (a === 'sortie') sortie();
  else if (a === 'anim') { prefs.anim = !prefs.anim; savePrefs(); hud(); }
  else if (a === 'mute') { setMute(!muted()); hud(); }
  else if (a === 'zin' || a === 'zout') W3.zoomBy(a === 'zin' ? 1.25 : 0.8);
  else if (a === 'rotl' || a === 'rotr') W3.snap(a === 'rotl' ? -Math.PI / 4 : Math.PI / 4);
  else if (a === 'quit') { if (confirm(T().quit + '?')) { B = null; base(); } }
  else if (a === 'end') { if (B && B.phase === 'p' && !B.busy) { B.sel = null; B.step = 'idle'; menu(null); card(null); await enemyTurn(); } }
  else if (b.dataset.w != null && B?.sel) { B.wsel = weaponsOf(B.sel)[+b.dataset.w]; B.step = 'target'; menu(`<p class="hint">${T().targetHint}</p><div class="acts"><button class="ghost" data-act="untarget">${T().back}</button></div>`); }
  else if (a === 'untarget') { B.step = 'act'; B.target = null; menu(actionMenu(B.sel)); card(B.sel); }
  else if (a === 'wait' && B?.sel) afterAction(B.sel);
  else if (a === 'repair' && B?.sel) { const u = B.sel; if (repair(u)) { sfx('buy'); banner(`🔧 ${pname(u)} ${T().repaired}`); card(u); await wait(500); afterAction(u); } }
  else if (a === 'cancel' && B?.sel) { const u = B.sel; if (B.from) { u.x = B.from.x; u.y = B.from.y; } B.sel = null; B.step = 'idle'; menu(null); card(null); }
  else if (a === 'fire' && B?.sel && B.target) { const u = B.sel; await attack(u, B.wsel, B.target); afterAction(u); }
});
document.addEventListener('change', (e) => { const s = e.target.closest('select[data-slot]'); if (s) equip(s.dataset.slot, s.value || null); });

// ---------------------------------------------------------------- start
new ResizeObserver(resize).observe($('#stage'));
document.documentElement.lang = prefs.lang === 'en' ? 'en' : 'zh-Hant';
resize(); title(); requestAnimationFrame(frame);
(async () => { try { cloud = await import('/save.js'); if (await cloud.pull(GAME, KEY) && mode === 'title') title(); } catch (e) { cloud = null; } })();
window.IF = { W3, B3, weaponsOf, endBattle, get B() { return B; }, get S() { return S; }, set S(v) { S = v; }, sortie, tapTile, enemyTurn, attack, prefs, MISSIONS };
