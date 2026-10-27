// node tools/test.mjs — checks the maps and loadouts, then plays every mission with the computer on both sides
import { MISSIONS, START, JOIN, ITEM, TERRAIN, PILOTS, TXT } from '../js/data.js';
import { makeUnit, alive, fight, weaponsOf, inRange, dist, weight, power, learn, repair, hurtOf } from '../js/rules.js';
import { plan } from '../js/ai.js';
let bad = 0; const no = (m) => { console.log('BAD', m); bad++; };
const kits = [];
for (const [i, M] of MISSIONS.entries()) {
  const W = M.map[0].length;
  M.map.forEach((r, y) => { if (r.length !== W) no(`${M.id} row ${y} is ${r.length} wide, not ${W}`); for (const c of r) if (!TERRAIN[c]) no(`${M.id} unknown terrain ${c}`); });
  const at = (x, y) => TERRAIN[M.map[y]?.[x]];
  for (const [x, y] of M.p) if (!at(x, y) || at(x, y).cost >= 99) no(`${M.id} start ${x},${y} blocked`);
  for (const f of M.foes) { if (!at(f.x, f.y) || at(f.x, f.y).cost >= 99) no(`${M.id} foe ${f.pilot} at ${f.x},${f.y} blocked`); kits.push(f); if (!PILOTS[f.pilot]) no('pilot ' + f.pilot); }
  for (const id of M.shop) if (!ITEM[id]) no('shop item ' + id);
  if (M.win === 'boss' && !M.foes.some((f) => f.boss)) no(M.id + ' has no boss');
  for (const l of ['zh', 'en']) if (!M.brief[l]?.length || !M.after[l]?.length) no(M.id + ' story ' + l);
}
for (const k of [...START.roster, ...Object.values(JOIN), ...kits]) { for (const s of ['body', 'armL', 'armR', 'legs', 'wL', 'wR', 'sh']) if (k[s] && !ITEM[k[s]]) no('item ' + k[s]); if (weight(k) > power(k)) no(`overweight ${k.pilot} ${weight(k)}/${power(k)}`); }
for (const key of Object.keys(TXT.zh)) if (!(key in TXT.en)) no('english text missing ' + key);

// the computer plays both sides
function play(mi, roster) {
  const M = MISSIONS[mi], units = [];
  M.p.forEach(([x, y], i) => roster[i] && units.push(makeUnit(roster[i], 'p', x, y)));
  for (const f of M.foes) units.push(makeUnit(f, 'e', f.x, f.y, { boss: !!f.boss }));
  const over = () => { const es = units.filter((u) => u.side === 'e'), ps = units.filter((u) => u.side === 'p'); if (M.win === 'boss' ? es.some((u) => u.boss && !alive(u)) : es.every((u) => !alive(u))) return 'win'; if (ps.every((u) => !alive(u))) return 'lose'; return null; };
  for (let turn = 1; turn <= 40; turn++) for (const side of ['p', 'e']) for (const u of units.filter((x) => x.side === side && alive(x))) {
    if (!alive(u)) continue;
    if (side === 'p' && u.kits > 0 && (u.hp.body < u.max.body * 0.45 || hurtOf(u) > 0.5)) { repair(u); continue; }
    const pl = plan(u, units, M.map, side === 'p'); if (!pl) continue;
    if (pl.path.length) { const end = pl.path[pl.path.length - 1]; u.x = end.x; u.y = end.y; }
    if (pl.w && alive(pl.target) && inRange(pl.w.w, dist(u, pl.target))) { const w = weaponsOf(u).find((o) => o.slot === pl.w.slot); if (w) fight(u, w, pl.target, M.map); }
    const o = over(); if (o) { units.filter((x) => x.side === 'p').forEach(learn); return { o, turn, left: units.filter((x) => x.side === 'p' && alive(x)).length }; }
  }
  return { o: 'draw', turn: 40 };
}
const roster = START.roster.map((r) => ({ ...r, lv: PILOTS[r.pilot].lv }));
for (const [i] of MISSIONS.entries()) {
  if (JOIN[i]) roster.push({ ...JOIN[i], lv: PILOTS[JOIN[i].pilot].lv });
  const res = []; for (let k = 0; k < 20; k++) res.push(play(i, roster.map((r) => ({ ...r }))));
  const wins = res.filter((r) => r.o === 'win').length, draws = res.filter((r) => r.o === 'draw').length;
  console.log(MISSIONS[i].id, `win ${wins}/20 draw ${draws}`, 'turns', Math.round(res.reduce((s, r) => s + r.turn, 0) / 20));
  roster.forEach((r) => { r.lv += 1; });
}
console.log(bad ? 'FAILED' : 'all ok');
