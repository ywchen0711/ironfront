// 鋼魂戰線 / Iron Front: the game. Title → briefing → battle (your turn, the enemy's turn) → debriefing → base
// (hangar and shop) → the next mission.
import { START, PILOTS, ITEM, TERRAIN, TXT, SKILLS, ALL_ITEMS } from './data.js?v=16';
import { makeUnit, alive, reach, weaponsOf, inRange, dist, hitChance, hitDamage, counterOf, fight, learn, weight, power, moveOf, evadeOf, PARTS, repair, canAttack, tickStatus, FIELD, fits, clsOf, isAir, isStatic, isVehicle, flankOf } from './rules.js?v=16';
import { CAMPAIGN, CHAPTERS, FACTIONS, JOINERS, scaleOf, patrol } from './campaign.js?v=16';
import { buildMission, OBJ_LOADOUT } from './mapgen.js?v=16';
import { STORY } from './story/index.js?v=16';
import { plan } from './ai.js?v=16';
import { drawBattleFx, flyOf } from './render.js?v=16';
import * as B3 from './battle3d.js?v=16';
import * as Doll from './doll.js?v=16';
import { SCHEMES, schemeColour } from './mech3d.js?v=16';
import * as W3 from './world3d.js?v=16';
import { sfx, setMute, muted } from './sfx.js?v=16';

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
let curPx = 0, VW = 960, VH = 600, PX = 3, mode = 'title', B = null, scene = null;
const gl = $('#gl');
const fx = document.createElement('canvas'), fxg = fx.getContext('2d'); // shots and explosions over the 3D battle scene
const PL = { body: 'BODY', armL: 'ARM L', armR: 'ARM R', legs: 'LEGS' };
// short part names for the hit-point bars: a vehicle's are its hull, turret, mount and drive
const partLabels = (u) => (isVehicle(u) ? (prefs.lang === 'en' ? { body: 'HULL', armR: 'TURRET', armL: 'MOUNT', legs: isAir(u) ? 'ROTOR' : 'DRIVE' } : { body: '車體', armR: '砲塔', armL: '掛架', legs: isAir(u) ? '旋翼' : '驅動' }) : PL);
W3.init(gl);
function resize() {
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  VW = r.width; VH = r.height; cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
  PX = 1; // one scene pixel per screen pixel, so the machines show all their detail
  W3.resize(VW, VH, PX); curPx = PX;
}
const screenToTile = (cx, cy) => W3.pick(cx, cy);
// a word over a unit on the map, like the "Fire" when it shoots
function label(u, text, ms = 700, col) { B.labels.push({ u, text, col, until: performance.now() + ms }); }

// ---------------------------------------------------------------- the loop
function frame() {
  // whatever goes wrong in one frame, the next one still comes
  try { drawFrame(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function drawFrame() {
  if ((mode === 'battle' || mode === 'scene') && B) {
    const now = performance.now(); B.labels = B.labels.filter((l) => now < l.until);
    if (!scene) W3.render(highlights(), { sel: B.sel, cursor: B.hover, labels: B.labels });
    // the battle scene is drawn finer than the map, one scene pixel per screen pixel
    const wantPx = scene ? 1 : PX; if (curPx !== wantPx) { W3.resize(VW, VH, wantPx); curPx = wantPx; }
    if (scene) {
      // the battle scene takes over the 3D view; the effects go on a canvas of the same small size, blown up
      scene.t = (now - scene.t0) / 1000; const A = B3.render(scene); panels();
      const { w, h } = W3.viewSize(); if (fx.width !== w || fx.height !== h) { fx.width = w; fx.height = h; }
      drawBattleFx(fxg, scene, A);
      g.clearRect(0, 0, VW, VH); g.imageSmoothingEnabled = false; g.drawImage(fx, 0, 0, w * curPx, h * curPx);
      cv.style.pointerEvents = 'auto';
    } else { g.clearRect(0, 0, VW, VH); cv.style.pointerEvents = 'none'; }
  } else { g.fillStyle = '#100e0c'; g.fillRect(0, 0, VW, VH); }
}
function highlights() {
  const h = new Map(), W = B.map[0].length;
  if (B.step === 'move' && B.reach) for (const t of B.reach.tiles) h.set(t.y * W + t.x, 'move');
  if (B.step === 'target' && B.wsel) { for (let y = 0; y < B.map.length; y++) for (let x = 0; x < W; x++) if (inRange(B.wsel.w, Math.abs(x - B.sel.x) + Math.abs(y - B.sel.y))) h.set(y * W + x, 'range'); for (const e of targets(B.sel, B.wsel)) h.set(e.y * W + e.x, 'att'); }
  if (B.peek) for (const t of B.peek.tiles) h.set(t.y * W + t.x, 'peek');
  for (const [x, y] of B.zone || []) if (!h.has(y * W + x)) h.set(y * W + x, 'zone');
  return h;
}

// ---------------------------------------------------------------- the campaign
const THEME_OF = { m1: 'plains', m2: 'harbor', m3: 'forest', m4: 'snow', m5: 'city', m6: 'fortress' };
const WX_OF = { m1: 'clear', m2: 'dusk', m3: 'dusk', m4: 'snow', m5: 'dusk', m6: 'dusk' };
const curTier = () => Math.max(1, ...CAMPAIGN.slice(0, Math.min(S.mi, CAMPAIGN.length - 1) + 1).map((m) => m.tier || 1));
// a mission, ready to fight: the map, where everyone starts, what has to be done
function prepare(M) {
  if (M.drawn) return { map: M.map, p: M.p, foes: M.foes, objs: [], zone: [], reinf: [], win: { type: M.win, turns: 0 }, weather: WX_OF[M.id] || 'dusk', theme: THEME_OF[M.id] || 'hills' };
  const fac = FACTIONS[M.faction || 'alliance'];
  const built = buildMission({ ...M, paint: fac.paint, pilot: (cls, R) => fac.pilot(R) });
  return { ...built, weather: M.weather || 'clear', theme: M.theme };
}
const storyOf = (M) => ({ brief: STORY.m[M.id]?.brief || M.brief, after: STORY.m[M.id]?.after || M.after });
const lines = (o) => (o ? L(o) || [] : []);
function objText(win) {
  const t = T();
  switch (win.type) {
    case 'boss': { const b = B?.units.find((u) => u.boss) || null; return t.winBoss(b ? pname(b) : t.boss); }
    case 'defend': return t.objDefend(win.turns);
    case 'survive': return t.objSurvive(win.turns);
    case 'escort': return t.objEscort;
    case 'reach': return t.objReach;
    case 'destroy': return t.objDestroy(B ? B.units.filter((u) => u.side === 'e' && u.obj).length : '');
    default: return t.objAll;
  }
}
function title() {
  mode = 'title'; hideAll(); const t = T(), sv = loadSave();
  const M = sv && CAMPAIGN[Math.min(sv.mi, CAMPAIGN.length - 1)];
  $('#screen').innerHTML = `<div class="title"><div class="logo">${t.title}</div><p>${t.sub}</p>
    ${sv ? `<button class="big" data-act="continue">${t.cont}<small>${esc(L(CHAPTERS[M.ch]))}・${t.mission} ${Math.min(sv.mi + 1, CAMPAIGN.length)}・${esc(L(M))}</small></button>` : ''}
    <button class="big ${sv ? 'ghost' : ''}" data-act="new">${t.start}</button><button class="small" data-act="lang">🌐 ${t.lang}</button></div>`;
  $('#screen').hidden = false;
}
function newGame() { S = { mi: 0, money: START.money, roster: START.roster.map((r) => ({ ...r, lv: PILOTS[r.pilot].lv, exp: 0 })), inv: { ...START.inv }, patrols: 0, chSeen: -1 }; save(); briefing(); }

// ---------------------------------------------------------------- the story between battles
async function story(ls) {
  const box = $('#story');
  for (const line of ls) {
    const [who, said] = line.includes('|') ? line.split('|') : [null, line];
    box.innerHTML = `<div class="talk">${who ? `<b>${esc(who)}</b>` : ''}<p class="${who ? '' : 'narr'}">${esc(said)}</p><small>${T().tap} ▶</small></div>`; box.hidden = false;
    await new Promise((r) => { box.onclick = r; });
  }
  box.hidden = true;
}
async function chapterCard(ch) {
  hideAll(); mode = 'brief';
  $('#screen').innerHTML = `<div class="brief chap"><h1>${esc(L(CHAPTERS[ch]))}</h1></div>`; $('#screen').hidden = false;
  await wait(400); await story(lines(STORY.intro[ch]));
}
function addPilot(id) {
  if (S.roster.some((r) => r.pilot === id) || !JOINERS[id]) return;
  S.roster.push({ ...JOINERS[id], lv: Math.max(PILOTS[id].lv, scaleOf(S.mi).lv + 3), exp: 0 }); save();
  banner(T().joined(L(PILOTS[id])));
}
function removePilot(id) {
  const i = S.roster.findIndex((r) => r.pilot === id); if (i < 0) return;
  const r = S.roster[i];
  for (const s of ['body', 'armL', 'armR', 'legs', 'wL', 'wR', 'sh', 'acc']) if (r[s] && ITEM[r[s]]?.price) S.inv[r[s]] = (S.inv[r[s]] || 0) + 1;
  S.roster.splice(i, 1); S.deploy = null; hsel = 0; save();
  banner(T().left(L(PILOTS[id])));
}
async function briefing() {
  const M = CAMPAIGN[S.mi];
  // a new chapter opens with its title and a page from the war
  if (M.ch !== S.chSeen) { S.chSeen = M.ch; save(); await chapterCard(M.ch); }
  for (const id of M.joinBefore || []) addPilot(id);
  hideAll(); mode = 'brief';
  $('#screen').innerHTML = `<div class="brief"><small>${esc(L(CHAPTERS[M.ch]))}・${T().mission} ${S.mi + 1}</small><h1>${esc(L(M))}</h1></div>`; $('#screen').hidden = false;
  await story(lines(storyOf(M).brief));
  base();
}

// ---------------------------------------------------------------- the base: hangar and shop
let baseTab = 'hangar', hsel = 0, shopCat = 'hand', shopPage = 0;
const slotsOf = (M) => M.slots || (M.p ? M.p.length : 6);
function deployList(M) {
  const n = Math.min(slotsOf(M), S.roster.length);
  let d = (S.deploy || []).filter((i) => i < S.roster.length);
  if (d.length < n) for (let i = 0; i < S.roster.length && d.length < n; i++) if (!d.includes(i)) d.push(i);
  return d.slice(0, n);
}
const SLOT_ORDER = ['body', 'armR', 'armL', 'legs', 'wR', 'wL', 'sh', 'acc'];
const slotName = (r, s) => (s === 'acc' ? T().acc : clsOf(r) === 'wanzer' ? T()[s] : T().vs[s]);
function base() {
  mode = 'base'; hideAll(); const t = T(), M = CAMPAIGN[Math.min(S.mi, CAMPAIGN.length - 1)];
  const over = S.roster.filter((r) => weight(r) > power(r));
  let body = '';
  if (baseTab === 'hangar') {
    const r = S.roster[hsel] || S.roster[0], cls = clsOf(r), d = deployList(M);
    body = `<div class="roster">${S.roster.map((x, i) => `<button class="pilot ${i === hsel ? 'on' : ''} ${weight(x) > power(x) ? 'warn' : ''}" data-h="${i}"><b>${esc(L(PILOTS[x.pilot]))}</b><small>${t.lv}${x.lv}・${t.cls[clsOf(x)]}</small></button>`).join('')}</div>
      ${S.roster.length > slotsOf(M) ? `<div class="deploy"><span>${t.deploy}${colon()}<small>${t.deployHint(slotsOf(M))}</small></span>${S.roster.map((x, i) => `<button class="dp ${d.includes(i) ? 'on' : ''}" data-dp="${i}">${d.includes(i) ? '✔' : '・'} ${esc(L(PILOTS[x.pilot]))}</button>`).join('')}</div>` : ''}
      <div class="bay"><div class="dollbox"><div id="doll"></div><div class="paints"><span>${t.paint}</span>${SCHEMES.map((k) => `<button class="sw ${(r.paint || 'olive') === k ? 'on' : ''}" data-paint="${k}" title="${esc(L(PAINT_NAMES[k]))}" style="background:${schemeColour(k)}"></button>`).join('')}</div></div>
      <div class="slots">${SLOT_ORDER.filter((s) => !(cls === 'spg' && s === 'wL')).map((s) => slotRow(r, s)).join('')}</div></div>
      <div class="wbar ${weight(r) > power(r) ? 'bad' : ''}">${t.weight} ${weight(r)} / ${t.power} ${power(r)}${weight(r) > power(r) ? ' — ' + t.overweight : ''}<i style="width:${Math.min(100, weight(r) / power(r) * 100)}%"></i></div>
      <div class="stats">${t.cls[cls]}・${t.armour} ${t.arm3[ITEM[r.body].armour || 'M']}・${t.moveN} ${ITEM[r.legs].move + (r.acc ? ITEM[r.acc].move || 0 : 0)}・${t.eva} ${ITEM[r.legs].eva}・HP ${PARTS.map((p) => ITEM[r[p]].hp).join(' / ')}${(PILOTS[r.pilot].skills || []).length ? `・★ ${PILOTS[r.pilot].skills.map((k) => `${L(SKILLS[k])}${r.lv < SKILLS[k].lv ? `(${t.lv}${SKILLS[k].lv})` : ''}`).join(' ')}` : ''}</div>`;
  } else {
    const cats = Object.keys(t.shopCats), tier = curTier();
    const inCat = (x) => ({ body: x.kind === 'body' && x.cls === 'wanzer', arm: x.kind === 'arm', legs: x.kind === 'legs', hand: x.kind === 'weapon' && x.cat !== 'long' && !x.veh, shoulder: x.kind === 'weapon' && x.cat === 'long' && !x.veh,
      vbody: x.kind === 'body' && x.cls !== 'wanzer', vpart: x.kind === 'drive' || x.kind === 'mount', vweapon: x.kind === 'weapon' && x.veh, acc: x.kind === 'acc' })[shopCat];
    const list = ALL_ITEMS.filter((x) => inCat(x) && ((x.tier || 1) <= tier || S.inv[x.id])).sort((a, b) => (b.tier || 1) - (a.tier || 1) || b.price - a.price);
    const per = 24, pages = Math.max(1, Math.ceil(list.length / per)); shopPage = Math.min(shopPage, pages - 1);
    body = `<div class="scats">${cats.map((c) => `<button class="${c === shopCat ? 'on' : ''}" data-scat="${c}">${t.shopCats[c]}</button>`).join('')}</div>
      <div class="shop">${list.slice(shopPage * per, shopPage * per + per).map((x) => { const n = S.inv[x.id] || 0; return `<div class="ware"><b>${esc(iname(x.id))} <em class="tier">${t.tier}${x.tier || 1}</em></b><small>${describe(x.id)}</small><span>💰 ${x.price.toLocaleString()}</span>
      <button data-buy="${x.id}" ${S.money < x.price ? 'disabled' : ''}>${t.buy}</button>${n ? `<button class="ghost" data-sell="${x.id}">${t.sell} ${Math.floor(x.price / 2).toLocaleString()}</button><em>${t.owned} ${n}</em>` : ''}</div>`; }).join('') || '<p>—</p>'}</div>
      ${pages > 1 ? `<div class="pager"><button class="small" data-spage="-1" ${shopPage ? '' : 'disabled'}>◀ ${t.prev}</button><span>${shopPage + 1} / ${pages}</span><button class="small" data-spage="1" ${shopPage < pages - 1 ? '' : 'disabled'}>${t.nextP} ▶</button></div>` : ''}`;
  }
  const P = M.drawn ? { win: { type: M.win, turns: 0 } } : { win: { type: M.obj || 'all', turns: M.turns || 0 } };
  $('#screen').innerHTML = `<div class="base"><header><h2>${t.base}</h2><span class="money">💰 ${S.money.toLocaleString()}</span><button class="small" data-act="lang">🌐 ${t.lang}</button></header>
    <div class="next">${esc(L(CHAPTERS[M.ch]))}・${t.mission} ${S.mi + 1}${colon()}<b>${esc(L(M))}</b> — ${esc(M.drawn && M.win === 'boss' ? t.winBoss(L(PILOTS[M.foes.find((f) => f.boss).pilot])) : M.obj === 'boss' ? t.winBoss(L(PILOTS[M.boss.pilot])) : objText(P.win))}${M.weather || WX_OF[M.id] ? `・${t.wx[M.weather || WX_OF[M.id]]}` : ''}</div>
    <div class="tabs"><button class="${baseTab === 'hangar' ? 'on' : ''}" data-tab="hangar">🔧 ${t.hangar}</button><button class="${baseTab === 'shop' ? 'on' : ''}" data-tab="shop">🛒 ${t.shop}</button></div>
    ${body}<div class="go"><button class="big" data-act="sortie" ${over.length ? 'disabled' : ''}>▶ ${t.sortie}${over.length ? `<small>${over.map((x) => L(PILOTS[x.pilot])).join(', ')}${colon()}${t.overweight}</small>` : ''}</button>
    <button class="big ghost" data-act="patrol" ${over.length ? 'disabled' : ''}>🧭 ${t.patrol}<small>${t.patrolHint}</small></button></div></div>`;
  $('#screen').hidden = false;
  if (baseTab === 'hangar') Doll.show($('#doll'), { ...(S.roster[hsel] || S.roster[0]), ri: S.roster[hsel] ? hsel : 0 });
}
const PAINT_NAMES = { olive: { zh: '橄欖綠', en: 'Olive' }, desert: { zh: '沙漠', en: 'Desert' }, navy: { zh: '海軍藍', en: 'Navy' }, arctic: { zh: '雪地灰', en: 'Arctic' }, crimson: { zh: '赤紅', en: 'Crimson' }, black: { zh: '暗夜黑', en: 'Night' } };
// a one-line summary of what an item does
function describe(id) {
  const x = ITEM[id], t = T(), st = t.stat, out = [];
  if (!x) return '';
  if (x.kind === 'body') { out.push(`${st.hp} ${x.hp}`, `${st.power} ${x.power}`, `${t.armour} ${t.arm3[x.armour || 'M']}`); if (x.cls !== 'wanzer') out.unshift(t.cls[x.cls]); }
  else if (x.kind === 'arm' || x.kind === 'mount') { out.push(`${st.hp} ${x.hp}`); if (x.acc) out.push(`${st.acc} +${x.acc}`); if (x.punch) out.push(`${st.punch} ${x.punch}`); out.push(`${t.weight} ${x.w}`); }
  else if (x.kind === 'legs' || x.kind === 'drive') { out.push(`${st.hp} ${x.hp}`, `${st.move} ${x.move}`, `${st.eva} ${x.eva}`, `${t.weight} ${x.w}`); if (x.air) out.push('✈'); if (x.hover) out.push('≈'); }
  else if (x.kind === 'acc') { for (const k of ['acc', 'hpBody', 'move', 'eva', 'ecm', 'ammo', 'still', 'kits', 'melee', 'crit', 'resist', 'camo']) if (x[k] != null) out.push(`${k === 'ammo' ? t.ammo : st[k]} ${k === 'melee' ? '+' + Math.round(x[k] * 100) + '%' : k === 'resist' ? '-' + Math.round((1 - x[k]) * 100) + '%' : '+' + x[k]}`); out.push(`${t.weight} ${x.w}`); }
  else if (x.cat === 'shield') out.push(`${st.guard} ${Math.round(x.guard * 100)}%`, `${t.weight} ${x.w}`);
  else {
    out.push(`${t.cats[x.cat]}${x.dt ? '/' + t.dt[x.dt] : ''}`, `${x.dmg}×${x.shots}`, `${t.range} ${x.rmin}-${x.rmax}`, `${t.hit} ${x.acc}%`);
    if (x.ammo) out.push(`${t.ammo} ${x.ammo}`);
    if (x.ap) out.push(`${st.ap} ${Math.round(x.ap * 100)}%`); if (x.aa) out.push(st.aa); if (x.indirect) out.push(st.indirect); if (x.burn) out.push(st.burn); if (x.stun) out.push(st.stun); if (x.crit) out.push(`${st.crit} +${x.crit}`);
    out.push(`${t.weight} ${x.w}`);
  }
  return out.join('・');
}
function slotRow(r, s) {
  const t = T(), cur = r[s], must = s === 'body' || s === 'armL' || s === 'armR' || s === 'legs';
  const opts = [cur, ...Object.keys(S.inv).filter((id) => S.inv[id] > 0 && id !== cur && fits(r, s, id))].filter((v, i, a) => v && a.indexOf(v) === i);
  return `<label class="slot"><span>${slotName(r, s)}</span><select data-slot="${s}">${must ? '' : `<option value="" ${!cur ? 'selected' : ''}>${t.none}</option>`}${opts.map((id) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(iname(id))} ${t.tier}${ITEM[id].tier || 1}${id !== cur ? ` (${S.inv[id]})` : ''}</option>`).join('')}</select><small>${cur ? describe(cur) : ''}</small></label>`;
}
function equip(s, id) {
  const r = S.roster[hsel], old = r[s];
  if (old) S.inv[old] = (S.inv[old] || 0) + 1;
  if (id) { S.inv[id]--; if (!S.inv[id]) delete S.inv[id]; }
  r[s] = id || null; save(); sfx('click'); base();
}

// ---------------------------------------------------------------- a battle
function sortie(patrolSpec) {
  const M = patrolSpec || CAMPAIGN[S.mi], P = prepare(M);
  FIELD.weather = P.weather;
  B = { M, P, map: P.map, units: [], turn: 1, step: 'idle', sel: null, labels: [], win: P.win, zone: P.zone || [], reinf: (P.reinf || []).slice() };
  const team = deployList(M);
  team.forEach((ri, k) => { const at = P.p[k]; if (!at) return; const u = makeUnit(S.roster[ri], 'p', at[0], at[1], { ri, face: 1 }); u.dir = Math.PI; B.units.push(u); });
  for (const o of P.objs || []) { const u = makeUnit({ pilot: o.kind === 'truck' ? 'elise' : 'grunt', lv: 1, ...OBJ_LOADOUT[o.kind] }, o.side, o.x, o.y, { obj: true, objTier: M.tier || 1, objMul: o.side === 'p' ? (o.kind === 'truck' ? 1.5 : 1.8) : 1 }); u.dir = o.side === 'p' ? Math.PI : 0; B.units.push(u); }
  for (const f of P.foes) { const u = makeUnit(f, 'e', f.x, f.y, { boss: !!f.boss, hold: !!f.hold, face: -1 }); u.dir = 0; B.units.push(u); }
  hideAll(); mode = 'battle'; resize(); W3.load(B);
  $('#hud').hidden = false; hud(); sfx('start');
  banner(`${T().phaseP}${P.weather && P.weather !== 'clear' && P.weather !== 'dusk' ? '・' + T().wx[P.weather] : ''}`);
}
function hud() {
  const t = T(), M = B.M, wx = B.P.weather;
  $('#hud').innerHTML = `<div class="hl"><b>${esc(L(M))}</b><span>${B.win.turns ? t.turnOf(B.turn, B.win.turns) : t.turn(B.turn)}・${B.phase === 'e' ? t.theirs : t.yours}・${t.wx[wx] || ''}</span><small>${esc(objText(B.win))}${t.wxNote[wx] ? `<br>${t.wxNote[wx]}` : ''}</small></div>
    <div class="hr"><button data-act="anim">🎬 ${t.anim}${colon()}${prefs.anim ? t.on : t.off}</button><button data-act="rotl" title="⟲">⟲</button><button data-act="rotr" title="⟳">⟳</button><button data-act="zin">＋</button><button data-act="zout">－</button><button data-act="mute">${muted() ? '🔇' : '🔊'}</button><button data-act="quit">${t.quit}</button><button class="end" data-act="end" ${B.phase === 'e' || B.busy ? 'disabled' : ''}>${t.endTurn} ▶</button></div>`;
}
function card(u) {
  const el = $('#card'); if (!u) { el.hidden = true; return; }
  const t = T(), ws = weaponsOf(u), st = [u.st?.burn ? `🔥${t.burnT}` : '', u.st?.stun ? `⚡${t.stunT}` : ''].filter(Boolean).join(' ');
  const plabel = partLabels(u);
  el.innerHTML = `<div class="ch ${u.side}"><b>${esc(u.obj ? t.cls[u.cls] : pname(u))}</b> <small>${u.obj ? '' : `${t.lv}${u.lv}・`}${t.cls[u.cls]}${u.boss ? ' ★' + t.boss : ''}</small><span>${isStatic(u) ? '' : `${t.moveN} ${moveOf(u)}・${t.eva} ${evadeOf(u, B.map)}%・`}${t.armour} ${t.arm3[ITEM[u.body].armour || 'M']}${u.side === 'p' && u.kits ? `・🔧${u.kits}` : ''}${st ? `・${st}` : ''}</span></div>
    <div class="rin">${(isStatic(u) ? ['body'] : PARTS).map((p) => { const k = Math.max(0, u.hp[p]) / u.max[p]; return `<div class="hp"><span>${plabel[p]}</span><i><s style="width:${k * 100}%"></s></i><em>${u.hp[p]}</em></div>`; }).join('')}</div>
    <div class="ws">${ws.map((o) => `<span>${esc(o.slot === 'fist' ? L(o.w) : iname(o.w.id))} <small>${o.w.dmg}×${o.w.shots}・${o.w.rmin}-${o.w.rmax}${o.slot === 'sh' ? `・${u.ammo}` : ''}</small></span>`).join('')}${(u.skills || []).length ? `<span class="sk">★ ${u.skills.map((k) => L(SKILLS[k])).join(' ')}</span>` : ''}</div>`;
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
    if (u && u.side === 'p' && !u.done && !isStatic(u)) { B.sel = u; B.step = 'move'; B.reach = reach(u, B.units, B.map); B.from = { x: u.x, y: u.y }; card(u); menu(actionMenu(u, true)); sfx('click'); return; }
    if (B.step === 'move' && p && B.reach.tiles.some((t) => t.x === p.x && t.y === p.y)) { walk(B.sel, B.reach.path(p.x, p.y)).then(() => { B.step = 'act'; menu(actionMenu(B.sel)); const o = over(); if (o) endBattle(o); }); B.step = 'walking'; menu(null); return; }
    if (u) { card(u); if (u.side === 'e' && !isStatic(u)) B.peek = reach(u, B.units, B.map); }
    else { B.sel = null; B.step = 'idle'; card(null); menu(null); }
    return;
  }
  if (B.step === 'target') {
    if (u && u.side === 'e' && canAttack(B.sel, B.wsel, u)) { B.target = u; card(u); preview(); sfx('click'); }
  }
}
const targets = (u, w) => B.units.filter((o) => alive(o) && o.side !== u.side && canAttack(u, w, o));
function actionMenu(u, before) {
  const t = T(), ws = weaponsOf(u);
  return `<div class="acts">${ws.map((o, i) => { const n = targets(u, o).length; return `<button data-w="${i}" ${n ? '' : 'disabled'}>${o.w.cat === 'long' ? '🚀' : o.w.cat === 'melee' ? '👊' : '🔫'} ${esc(o.slot === 'fist' ? L(o.w) : iname(o.w.id))}<small>${o.w.rmin}-${o.w.rmax}${o.slot === 'sh' ? `・${t.ammo} ${u.ammo}` : ''}${o.w.aa ? '・' + t.stat.aa : ''}${o.w.indirect ? '・' + t.stat.indirect : ''}</small></button>`; }).join('')}
    ${u.kits > 0 ? `<button data-act="repair" ${PARTS.some((p) => u.hp[p] < u.max[p]) ? '' : 'disabled'}>🔧 ${t.repair}<small>${t.kits} ${u.kits}</small></button>` : ''}
    <button data-act="wait">⏸ ${t.wait}</button><button class="ghost" data-act="cancel">${t.cancel}</button></div>${before ? `<p class="hint">${t.moveHint}</p>` : ''}`;
}
function preview() {
  const t = T(), a = B.sel, w = B.wsel, d = B.target, pct = hitChance(a, w, d, B.map), cw = counterOf(d, a, w.w.cat, w);
  const fl = flankOf(a, d), est = Math.round(hitDamage(a, w, d, 'body'));
  menu(`<div class="pv"><div><b>${esc(pname(a))}</b> → <b class="e">${esc(d.obj ? t.cls[d.cls] : pname(d))}</b>${fl !== 'front' ? ` <em class="fl">${fl === 'back' ? t.flankBack : t.flankSide}</em>` : ''}</div>
    <div>${esc(w.slot === 'fist' ? L(w.w) : iname(w.w.id))}${colon()}${t.hit} <b>${pct}%</b>・${t.dmg} ${t.est} ${est}×${w.w.shots}${isAir(d) ? `・${t.stat.aa}${w.w.aa ? ' ✔' : ' -20'}` : ''}</div>
    <div class="c">${cw ? `${t.counter}${colon()}${esc(cw.slot === 'fist' ? L(cw.w) : iname(cw.w.id))} ${t.hit} ${hitChance(d, cw, a, B.map)}%` : t.noCounter}</div>
    <button class="fire" data-act="fire">💥 ${t.fire}</button><button class="ghost" data-act="untarget">${t.back}</button></div>`);
}
function walk(u, path) {
  return new Promise(async (res) => {
    const A = u.anim || (u.anim = { phase: 0, walk: 0 }); A.moving = true; let n = 0;
    if (path.length) u.moved = true;
    for (const s of path) {
      const fx2 = u.x, fy = u.y, fh = W3.heightOf(B.map[fy][fx2]), th = W3.heightOf(B.map[s.y][s.x]);
      u.dir = Math.atan2(s.x - fx2, s.y - fy);
      const t0 = performance.now(), dur = 230, ph0 = A.phase;
      u.x = s.x; u.y = s.y;
      // one step per square; the legs make half a stride in that time, so the feet keep pace with the ground
      await new Promise((r) => { const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); u.vx = fx2 + (s.x - fx2) * k; u.vy = fy + (s.y - fy) * k; u.vh = fh + (th - fh) * Math.min(1, k * 1.6); A.phase = ph0 + k * Math.PI; if (k < 1) requestAnimationFrame(tick); else r(); }; tick(); });
      if (n++ % 1 === 0) sfx('step');
    }
    u.vx = u.vy = u.vh = undefined; A.moving = false; res();
  });
}
async function dyingAnim(u) { u.dying = 0.01; sfx('boom'); const t0 = performance.now(); await new Promise((res) => { const tick = () => { u.dying = (performance.now() - t0) / 600; if (u.dying < 1) requestAnimationFrame(tick); else { u.dying = 0; res(); } }; tick(); }); }
async function attack(a, w, d) {
  B.busy = true; hud(); menu(null);
  a.dir = Math.atan2(d.x - a.x, d.y - a.y); W3.focus((a.x + d.x) / 2, (a.y + d.y) / 2);
  const hpA = { ...a.hp }, hpD = { ...d.hp };
  const A = a.anim || (a.anim = { phase: 0, walk: 0 }), now = performance.now();
  A.aimUntil = now + 900; A.fireFrom = now + 380; label(a, 'Fire', 650); sfx('click'); await wait(600);
  const r = fight(a, w, d, B.map);
  if (!isStatic(d)) d.dir = Math.atan2(a.x - d.x, a.y - d.y); // whoever is attacked turns to face it
  await battleScene(r, hpA, hpD);
  if (!prefs.anim) { const sum = (v) => v.hits.reduce((s2, h) => s2 + (h.dmg || 0), 0); label(d, sum(r.first) ? `-${sum(r.first)}` : 'Miss', 900, sum(r.first) ? '#a02010' : '#141410'); if (r.second) { await wait(450); label(a, sum(r.second) ? `-${sum(r.second)}` : 'Miss', 900, sum(r.second) ? '#a02010' : '#141410'); } await wait(700); }
  for (const u of [a, d]) if (!alive(u)) await dyingAnim(u);
  for (const u of [a, d]) { const up = u.side === 'p' && !u.obj && learn(u); if (up) banner(T().expUp(pname(u), up)); }
  B.busy = false; hud();
  return r;
}
// the side-on battle: every shot becomes an event on a little timeline
function battleScene(r, hpA, hpD) {
  if (!prefs.anim) return Promise.resolve();
  const left = r.att.side === 'p' ? 'att' : 'def', Ls = left === 'att' ? 'L' : 'R', Rs = left === 'att' ? 'R' : 'L';
  // each volley starts with a pause to aim, or to close in and wind up, so the attack can be seen
  const ev = []; let t = 0.4, n = 0;
  const add = (vol, from, w) => {
    const W2 = w.w, fx2 = W2.fx || (W2.cat === 'long' ? 'missile' : W2.cat === 'melee' ? 'melee' : 'bullet'), probe = { fx: fx2, cat: W2.cat };
    t += (W2.cat === 'melee' ? 0.9 : 0.6) + flyOf(probe);
    vol.hits.forEach((h, i) => {
      const e = { at: t, from, cat: W2.cat, fx: fx2, ...h, n: n++ };
      if (i === 0) { if (vol.skill) e.callA = L(SKILLS[vol.skill]); if (vol.dskill) e.callD = L(SKILLS[vol.dskill]); if (vol.flank && vol.flank !== 'front') e.callF = vol.flank === 'back' ? T().flankBack : T().flankSide; }
      ev.push(e);
      t += W2.cat === 'long' ? 0.8 : W2.cat === 'melee' ? 1.0 : fx2 === 'flame' ? 0.2 : fx2 === 'shell' ? 0.6 : 0.13;
    });
    t += 0.35;
  };
  add(r.first, Ls, r.w);
  if (r.second) add(r.second, Rs, r.cw);
  const sc = { L: left === 'att' ? r.att : r.def, R: left === 'att' ? r.def : r.att, events: ev, t: 0, t0: performance.now(), ground: B.map[r.def.y][r.def.x], weather: B.P.weather, theme: B.P.theme };
  const nm = (u) => (u.obj ? T().cls[u.cls] : `${pname(u)} ${T().lv}${u.lv}`);
  sc.nameL = nm(sc.L); sc.nameR = nm(sc.R);
  const startL = left === 'att' ? hpA : hpD, startR = left === 'att' ? hpD : hpA; sc.hpL = { ...startL }; sc.hpR = { ...startR };
  sc.dead = { L: !alive(sc.L), R: !alive(sc.R) }; sc.deadAt = t;
  const wn = (o) => (o ? (o.slot === 'fist' ? L(o.w) : iname(o.w.id)) : '');
  sc.wL = left === 'att' ? wn(r.w) : wn(r.cw); sc.wR = left === 'att' ? wn(r.cw) : wn(r.w);
  const end = t + (sc.dead.L || sc.dead.R ? 1.4 : 0.5);
  mode = 'scene'; scene = sc;
  const shown = ['#hud', '#card', '#menu'].filter((id) => !$(id).hidden); shown.forEach((id) => { $(id).hidden = true; });
  buildPanels(sc);
  return new Promise((res) => {
    let done = false; const fired = new Set();
    const finish = () => { if (done) return; done = true; scene = null; mode = 'battle'; $('#bpan').hidden = true; shown.forEach((id) => { if (id === '#hud') $(id).hidden = false; }); cv.removeEventListener('pointerdown', finish); res(); };
    cv.addEventListener('pointerdown', finish);
    const tick = () => {
      if (done) return;
      const tt = (performance.now() - sc.t0) / 1000;
      for (const e of ev) if (tt >= e.at && !fired.has(e.n)) { fired.add(e.n); if (!e.miss) { const side = e.from === 'L' ? 'hpR' : 'hpL'; sc[side][e.part] = Math.max(0, sc[side][e.part] - e.dmg); if (e.crash) sc[side].body = 0; sfx(e.cat === 'long' || e.fx === 'shell' || e.fx === 'artillery' || e.fx === 'rocket' ? 'boom' : e.cat === 'melee' ? 'clang' : 'hit'); } else sfx('miss'); }
      for (const e of ev) if (!fired.has('s' + e.n) && e.cat !== 'melee' && tt >= e.at - flyOf(e)) { fired.add('s' + e.n); sfx(['missile', 'rocket', 'artillery', 'grenade'].includes(e.fx) ? 'launch' : 'shot'); }
      if (tt >= end) finish(); else requestAnimationFrame(tick);
    };
    tick();
  });
}
function buildPanels(sc) {
  const lab = partLabels;
  const one = (s) => `<div class="rp ${sc[s].side}"><div class="rt">${esc(s === 'L' ? sc.nameL : sc.nameR)}</div><div class="rin">${(isStatic(sc[s]) ? ['body'] : PARTS).map((p) => `<div class="hp" data-p="${s}${p}"><span>${lab(sc[s])[p]}</span><i><s></s></i><em></em></div>`).join('')}</div><div class="rw">${esc(sc['w' + s] || '—')}</div></div>`;
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
const inZone = (u) => B.zone.some(([x, y]) => x === u.x && y === u.y);
function over() {
  const W = B.win.type, ps = B.units.filter((u) => u.side === 'p' && !u.obj), es = B.units.filter((u) => u.side === 'e' && !u.obj);
  const objP = B.units.filter((u) => u.side === 'p' && u.obj), objE = B.units.filter((u) => u.side === 'e' && u.obj);
  if (ps.every((u) => !alive(u))) return 'lose';
  if ((W === 'defend' || W === 'escort') && objP.some((u) => !alive(u))) return 'lose';
  const cleared = es.every((u) => !alive(u)) && !B.reinf.length;
  if (W === 'boss') return es.some((u) => u.boss && !alive(u)) ? 'win' : null;
  if (W === 'destroy') return objE.length && objE.every((u) => !alive(u)) ? 'win' : null;
  if (W === 'escort') return objP.some((u) => alive(u) && inZone(u)) ? 'win' : null;
  if (W === 'reach') return ps.some((u) => alive(u) && inZone(u)) ? 'win' : null;
  if (W === 'defend' || W === 'survive') return B.turn > B.win.turns || cleared ? 'win' : null;
  return cleared ? 'win' : null;
}
async function afterAction(u) {
  u.done = true; B.sel = null; B.step = 'idle'; menu(null); card(null);
  const o = over(); if (o) return endBattle(o);
  if (B.units.filter((x) => x.side === 'p' && alive(x) && !isStatic(x)).every((x) => x.done)) await enemyTurn();
}
// the start of a side's turn: fires burn, stuns wear off
async function statusTick(side) {
  for (const u of B.units.filter((x) => x.side === side && alive(x))) {
    u.moved = false;
    const r = tickStatus(u);
    if (r.burn) { label(u, `-${r.burn}`, 900, '#c04010'); centreOn(u); await wait(450); if (!alive(u)) await dyingAnim(u); }
  }
}
function aiOpt() {
  const goalU = B.units.find((u) => u.side === 'p' && u.obj && alive(u));
  return { prio: (f) => (f.obj ? (B.win.type === 'escort' ? 25 : 20) : 0), goal: goalU ? { x: goalU.x, y: goalU.y } : null };
}
function spawnReinforcements() {
  const due = B.reinf.filter((r) => r.turn <= B.turn); if (!due.length) return false;
  B.reinf = B.reinf.filter((r) => r.turn > B.turn);
  const H = B.map.length, W = B.map[0].length, taken = new Set(B.units.filter(alive).map((u) => u.y * W + u.x));
  for (const r of due) for (const k of r.units) {
    let at = null;
    for (let tries = 0; tries < 200 && !at; tries++) { const x = Math.floor(Math.random() * W), y = Math.floor(Math.random() * Math.min(3, H)); const c = B.map[y][x]; if (!TERRAIN[c].block && !TERRAIN[c].water && !taken.has(y * W + x)) at = [x, y]; }
    if (!at) continue; taken.add(at[1] * W + at[0]);
    const u = makeUnit(k, 'e', at[0], at[1], { face: -1 }); u.dir = 0; B.units.push(u);
  }
  return true;
}
async function enemyTurn() {
  B.phase = 'e'; B.busy = true; hud(); banner(T().phaseE); await wait(900);
  if (spawnReinforcements()) { banner(T().reinf); sfx('start'); await wait(1000); }
  await statusTick('e');
  let o = over(); if (o) { B.busy = false; return endBattle(o); }
  for (const e of B.units.filter((u) => u.side === 'e' && alive(u) && !u.obj)) {
    if (!alive(e)) continue;
    const pl = plan(e, B.units, B.map, aiOpt()); if (!pl) continue;
    centreOn(e); await wait(250);
    if (pl.path.length) await walk(e, pl.path);
    if (pl.w && alive(pl.target) && weaponsOf(e).some((x) => x.slot === pl.w.slot)) { const w = weaponsOf(e).find((x) => x.slot === pl.w.slot); if (canAttack(e, w, pl.target)) { await wait(200); await attack(e, w, pl.target); } }
    o = over(); if (o) { B.busy = false; return endBattle(o); }
    await wait(150);
  }
  B.turn++; B.phase = 'p'; for (const u of B.units) if (u.side === 'p') u.done = false;
  await statusTick('p');
  B.busy = false;
  o = over(); if (o) return endBattle(o);
  hud(); banner(T().phaseP); sfx('start');
}
function centreOn(u) { W3.focus(u.x, u.y); }
// salvage: now and then a part or weapon of a destroyed enemy is worth taking home
function salvage() {
  const got = [];
  for (const u of B.units.filter((x) => x.side === 'e' && !x.obj && !alive(x))) {
    if (Math.random() > (u.boss ? 0.8 : 0.22)) continue;
    const pool = ['wR', 'wL', 'sh', 'acc', 'armL', 'armR', 'legs', 'body'].map((s) => u[s]).filter((id) => id && ITEM[id]?.price);
    if (!pool.length) continue;
    const id = pool[Math.floor(Math.random() * pool.length)]; S.inv[id] = (S.inv[id] || 0) + 1; got.push(id);
  }
  return got;
}
async function endBattle(o) {
  if (B.phase === 'over') return;
  B.phase = 'over'; B.busy = true; menu(null); card(null);
  const t = T(), M = B.M;
  if (o === 'win') {
    sfx('win'); S.money += M.reward;
    for (const u of B.units.filter((x) => x.side === 'p' && !x.obj)) { const r = S.roster[u.ri]; if (r) { r.lv = u.lv; r.exp = u.exp; } }
    const got = salvage();
    const loot = got.length ? `<p class="loot">${t.salvage}${colon()}${got.map((id) => esc(iname(id))).join('、')}</p>` : '';
    if (M.patrol) { S.patrols = (S.patrols || 0) + 1; save(); await resultBox(`<h1>${t.victory}</h1><p>${t.reward(M.reward.toLocaleString())}</p>${loot}`, t.toBase); $('#hud').hidden = true; B = null; base(); return; }
    S.mi++; save();
    await resultBox(`<h1>${t.victory}</h1><p>${t.reward(M.reward.toLocaleString())}</p>${loot}`, t.next);
    $('#hud').hidden = true; mode = 'brief'; hideAll(); $('#screen').innerHTML = `<div class="brief"><h1>${esc(L(M))}</h1></div>`; $('#screen').hidden = false;
    await story(lines(storyOf(M).after));
    for (const id of M.join || []) addPilot(id);
    for (const id of M.leave || []) removePilot(id);
    if (S.mi >= CAMPAIGN.length) { $('#screen').innerHTML = `<div class="title"><div class="logo">${t.title}</div><p>${t.theEnd}</p><button class="big" data-act="title">OK</button></div>`; return; }
    briefing();
  } else {
    sfx('lose');
    const lostObj = B.units.some((u) => u.side === 'p' && u.obj && !alive(u));
    const again = await resultBox(`<h1 class="bad">${t.defeat}</h1>${lostObj ? `<p>${t.objLost}</p>` : ''}`, t.retry, t.toBase);
    $('#hud').hidden = true; if (again) sortie(M.patrol ? M : undefined); else { B = null; base(); }
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
  else if (a === 'continue') { S = loadSave(); if (S.chSeen == null) S.chSeen = CAMPAIGN[Math.min(S.mi, CAMPAIGN.length - 1)].ch; base(); }
  else if (a === 'title') title();
  else if (a === 'lang') { prefs.lang = prefs.lang === 'en' ? 'zh' : 'en'; savePrefs(); document.documentElement.lang = prefs.lang === 'en' ? 'en' : 'zh-Hant'; mode === 'base' ? base() : title(); }
  else if (b.dataset.tab) { baseTab = b.dataset.tab; base(); }
  else if (b.dataset.scat) { shopCat = b.dataset.scat; shopPage = 0; base(); }
  else if (b.dataset.spage) { shopPage = Math.max(0, shopPage + +b.dataset.spage); base(); }
  else if (b.dataset.dp != null) { const M = CAMPAIGN[Math.min(S.mi, CAMPAIGN.length - 1)], i = +b.dataset.dp; let d = deployList(M); if (d.includes(i)) d = d.filter((x) => x !== i); else if (d.length < slotsOf(M)) d.push(i); else { d.pop(); d.push(i); } S.deploy = d.length ? d : null; save(); sfx('click'); base(); }
  else if (a === 'patrol') sortie(patrol(S.mi, S.patrols || 0));
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
window.IF = { W3, B3, weaponsOf, endBattle, get B() { return B; }, get S() { return S; }, set S(v) { S = v; }, sortie, tapTile, enemyTurn, attack, prefs, CAMPAIGN, prepare, patrol, over: () => over(), base };
