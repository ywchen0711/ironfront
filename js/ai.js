// The enemy: for every square it can reach, every weapon and every target, it scores the damage it would do (and
// the damage it would take back), and picks the best. With nothing in reach it closes in — on what the mission is
// about if there is something to destroy or stop, otherwise on the nearest enemy. A commander holds its ground
// until someone comes near; artillery keeps its distance; everyone likes cover and hitting from behind.
import { reach, weaponsOf, dist, alive, expected, counterOf, canAttack, isStatic, flankOf } from './rules.js?v=15';
import { TERRAIN } from './data.js?v=15';

// opt: { prio(unit) → bonus for attacking it, goal: {x, y} to head for when nothing is in reach }
export function plan(u, units, map, opt = {}) {
  if (isStatic(u) || u.cls === 'truck') return null;
  const foes = units.filter((o) => alive(o) && o.side !== u.side);
  if (!foes.length) return null;
  const { tiles, path } = reach(u, units, map);
  const near = Math.min(...foes.map((f) => dist(u, f)));
  const hold = (u.boss || u.hold) && near > 6;
  const arty = weaponsOf(u).some((o) => o.w.indirect) && (u.cls === 'spg' || (u.cls === 'wanzer' && weaponsOf(u).every((o) => o.w.indirect || o.w.cat === 'melee')));
  let best = null;
  for (const t of hold ? [{ x: u.x, y: u.y }] : tiles) {
    const here = { ...u, x: t.x, y: t.y, moved: t.x !== u.x || t.y !== u.y };
    const danger = arty ? foes.filter((f) => !isStatic(f) && dist(here, f) <= 2).length * 25 : 0;
    for (const w of weaponsOf(u)) for (const f of foes) {
      if (!canAttack(here, w, f)) continue;
      const gain = expected(here, w, f, map), back = counterOf(f, here, w.w.cat, w);
      const loss = back ? expected(f, back, here, map) * 0.6 : 0;
      const kill = f.hp.body <= gain ? 60 : 0;
      const fl = flankOf(here, f), flank = fl === 'back' ? 8 : fl === 'side' ? 4 : 0;
      const s = gain + kill + flank - loss - danger + TERRAIN[map[t.y][t.x]].eva * 0.3 + (opt.prio ? opt.prio(f) : 0) + (w.slot === 'sh' ? -4 : 0);
      if (!best || s > best.s) best = { s, x: t.x, y: t.y, w, target: f };
    }
  }
  if (best) return { to: { x: best.x, y: best.y }, path: path(best.x, best.y), w: best.w, target: best.target };
  if (hold) return { to: { x: u.x, y: u.y }, path: [] };
  // nobody in reach: head for the goal, or the closest enemy; artillery stops at a safe distance
  const goal = opt.goal || null;
  let go = { x: u.x, y: u.y }, gd = 999;
  for (const t of tiles) {
    const dF = Math.min(...foes.map((f) => dist(t, f))), d = goal ? dist(t, goal) * 0.7 + dF * 0.3 : dF;
    const tooClose = arty && dF < 3 ? 10 : 0;
    const v = d + tooClose + TERRAIN[map[t.y][t.x]].cost * 0.01 - TERRAIN[map[t.y][t.x]].eva * 0.01;
    if (v < gd) { gd = v; go = t; }
  }
  return { to: go, path: path(go.x, go.y) };
}
