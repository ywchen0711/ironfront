// Plays the campaign headless, the computer on both sides, to see how hard each mission is.
// The squad keeps its pilots' levels from mission to mission, and is kitted out with gear of the mission's tier
// (as a player who spends their pay would be). For each mission it reports the win rate, the turns it took and
// how many machines were lost.   node tools/sim.mjs [from] [to] [runs]
import { CAMPAIGN, FACTIONS, JOINERS, scaleOf } from '../js/campaign.js';
import { buildMission, enemyKit, rng, OBJ_LOADOUT } from '../js/mapgen.js';
import { makeUnit, alive, reach, weaponsOf, fight, learn, canAttack, tickStatus, FIELD, isStatic, dist, hurtOf, repair, setRandom } from '../js/rules.js';
import { plan } from '../js/ai.js';
import { START, PILOTS, ITEM } from '../js/data.js';

const [from = 0, to = CAMPAIGN.length - 1, runs = 6] = process.argv.slice(2).map(Number);
// who is in the squad at mission i
function rosterAt(i, lv) {
  const out = START.roster.map((r) => r.pilot);
  for (let k = 0; k <= i; k++) { const M = CAMPAIGN[k]; for (const id of M.joinBefore || []) out.push(id); if (k < i) { for (const id of M.join || []) out.push(id); for (const id of M.leave || []) out.splice(out.indexOf(id), 1); } }
  return [...new Set(out)];
}
const CLS = { sora: 'heli', greta: 'tank', ivo: 'spg', tomas: 'aa' };
const ROLE = { ron: 'assault', mia: 'sniper', karl: 'heavy', lena: 'sniper', duke: 'heavy', pip: 'scout', anya: 'sniper', hound: 'brawler' };
function kitFor(id, tier, R) { const cls = CLS[id] || 'wanzer'; if (tier <= 1 && JOINERS[id]) return JOINERS[id]; if (tier <= 1 && START.roster.find((r) => r.pilot === id)) return START.roster.find((r) => r.pilot === id); return enemyKit(cls, tier, R, ROLE[id]); }

function prepare(M, seed) {
  if (M.drawn) return { map: M.map, p: M.p, foes: M.foes, objs: [], zone: [], reinf: [], win: { type: M.win, turns: 0 }, weather: 'clear' };
  const fac = FACTIONS[M.faction || 'alliance'];
  return { ...buildMission({ ...M, seed: seed ?? M.seed, paint: fac.paint, pilot: (cls, R) => fac.pilot(R) }), weather: M.weather || 'clear' };
}
function over(B) {
  const W = B.win.type, ps = B.units.filter((u) => u.side === 'p' && !u.obj), es = B.units.filter((u) => u.side === 'e' && !u.obj);
  const objP = B.units.filter((u) => u.side === 'p' && u.obj), objE = B.units.filter((u) => u.side === 'e' && u.obj);
  const inZone = (u) => B.zone.some(([x, y]) => x === u.x && y === u.y);
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
function act(B, u, opt) {
  if (!alive(u)) return;
  if (u.cls === 'truck' || (opt.zoneGoal && u.side === 'p' && B.win.type === 'reach')) {
    // head for the zone
    const { tiles } = reach(u, B.units, B.map); let best = null, bd = 1e9;
    const foes = B.units.filter((o) => o.side !== u.side && alive(o) && !o.obj);
    for (const t of [{ x: u.x, y: u.y }, ...tiles]) { const d = Math.min(...B.zone.map(([x, y]) => Math.abs(x - t.x) + Math.abs(y - t.y))) + (u.cls === 'truck' && foes.some((f) => dist(f, t) <= 3) ? 50 : 0); if (d < bd) { bd = d; best = t; } }
    if (best) { u.x = best.x; u.y = best.y; u.moved = true; }
    if (u.cls === 'truck') return;
  }
  if (u.side === 'p' && u.kits > 0 && hurtOf(u) > 0.45) { repair(u); return; }
  const pl = plan(u, B.units, B.map, opt); if (!pl) return;
  if (pl.path.length) { const last = pl.path[pl.path.length - 1]; u.dir = Math.atan2(last.x - u.x, last.y - u.y); u.x = pl.to.x; u.y = pl.to.y; u.moved = true; }
  if (pl.w && alive(pl.target)) { const w = weaponsOf(u).find((o) => o.slot === pl.w.slot); if (w && canAttack(u, w, pl.target)) { u.dir = Math.atan2(pl.target.x - u.x, pl.target.y - u.y); fight(u, w, pl.target, B.map); pl.target.dir = Math.atan2(u.x - pl.target.x, u.y - pl.target.y); } }
}
function battle(M, squad, seed) {
  const P = prepare(M, seed); FIELD.weather = P.weather;
  const B = { map: P.map, units: [], turn: 1, win: P.win, zone: P.zone || [], reinf: (P.reinf || []).slice() };
  squad.slice(0, Math.min(P.p.length, M.slots || P.p.length)).forEach((k, i) => { const u = makeUnit(k, 'p', P.p[i][0], P.p[i][1], { ri: i }); u.dir = Math.PI; B.units.push(u); });
  for (const o of P.objs || []) { const u = makeUnit({ pilot: 'elise', lv: 1, ...OBJ_LOADOUT[o.kind] }, o.side, o.x, o.y, { obj: true, objTier: M.tier || 1, objMul: o.side === 'p' ? (o.kind === 'truck' ? 1.5 : 1.8) : 1 }); B.units.push(u); }
  for (const f of P.foes) { const u = makeUnit(f, 'e', f.x, f.y, { boss: !!f.boss, hold: !!f.hold }); u.dir = 0; B.units.push(u); }
  const zc = B.zone.length ? { x: B.zone[Math.floor(B.zone.length / 2)][0], y: 0 } : null;
  const enemyObj = () => B.units.find((u) => u.side === 'e' && u.obj && alive(u));
  for (let turn = 1; turn <= 30; turn++) {
    B.turn = turn;
    for (const u of B.units.filter((x) => x.side === 'p')) { u.moved = false; tickStatus(u); }
    let o = over(B); if (o) return { o, B };
    const pOpt = { prio: (f) => (f.obj ? 40 : f.boss && B.win.type === 'boss' ? 25 : 0), goal: B.win.type === 'destroy' ? enemyObj() : B.win.type === 'boss' ? B.units.find((u) => u.boss && alive(u)) : zc, zoneGoal: B.win.type === 'reach' };
    for (const u of B.units.filter((x) => x.side === 'p' && alive(x) && !isStatic(x))) { act(B, u, { ...pOpt, zoneGoal: pOpt.zoneGoal && u === B.units.find((x) => x.side === 'p' && !x.obj && alive(x)) }); o = over(B); if (o) return { o, B }; }
    const due = B.reinf.filter((r) => r.turn <= turn); B.reinf = B.reinf.filter((r) => r.turn > turn);
    const W = B.map[0].length;
    for (const r of due) for (const k of r.units) { for (let t2 = 0; t2 < 100; t2++) { const x = Math.floor(Math.random() * W), y = Math.floor(Math.random() * 2); if (!B.units.some((u) => alive(u) && u.x === x && u.y === y) && !'#bw'.includes(B.map[y][x])) { const u = makeUnit(k, 'e', x, y); u.dir = 0; B.units.push(u); break; } } }
    for (const u of B.units.filter((x) => x.side === 'e')) { u.moved = false; tickStatus(u); }
    const goalU = B.units.find((u) => u.side === 'p' && u.obj && alive(u));
    const eOpt = { prio: (f) => (f.obj ? (B.win.type === 'escort' ? 25 : 20) : 0), goal: goalU ? { x: goalU.x, y: goalU.y } : null };
    for (const u of B.units.filter((x) => x.side === 'e' && alive(x) && !x.obj)) { act(B, u, eOpt); o = over(B); if (o) return { o, B }; }
    B.turn = turn + 1; o = over(B); if (o) return { o, B };
  }
  return { o: 'lose', B, timeout: true };
}

// the campaign, start to finish; pilots keep their levels
const lv = {}; for (const r of START.roster) lv[r.pilot] = PILOTS[r.pilot].lv;
const rows = [];
for (let i = 0; i <= to; i++) {
  const M = CAMPAIGN[i], sc = scaleOf(i), R = rng(i + 3), ids = rosterAt(i);
  for (const id of ids) if (lv[id] == null) lv[id] = Math.max(PILOTS[id].lv, sc.lv + 1);
  if (i < from) continue;
  let wins = 0, turns = 0, lost = 0, timeouts = 0, exp = {};
  for (let k = 0; k < runs; k++) {
    const squad = ids.map((id) => ({ pilot: id, ...kitFor(id, M.tier || 1, R), lv: lv[id], exp: 0 }));
    const { o, B, timeout } = battle(M, squad, (M.seed || 1) + k * 13);
    if (o === 'win') wins++; if (timeout) timeouts++;
    turns += B.turn; lost += B.units.filter((u) => u.side === 'p' && !u.obj && !alive(u)).length;
    for (const u of B.units.filter((x) => x.side === 'p' && !x.obj)) exp[u.pilot] = (exp[u.pilot] || 0) + u.exp / runs;
  }
  // pilots learn from the average fight
  for (const [id, e] of Object.entries(exp)) { const u = { lv: lv[id], exp: e }; learn(u); lv[id] = u.lv; }
  const row = `${String(i + 1).padStart(3)} ${M.id.padEnd(7)} ${(M.obj || M.win || 'all').padEnd(8)} T${M.tier || 1} eLv${String(M.lv || '-').padEnd(3)} win ${Math.round(wins / runs * 100)}%  turns ${(turns / runs).toFixed(1)}  lost ${(lost / runs).toFixed(1)}${timeouts ? '  timeouts ' + timeouts : ''}  squad lv ${Math.round(Object.values(lv).reduce((a, b) => a + b, 0) / Object.values(lv).length)}`;
  rows.push(row); console.log(row);
}
