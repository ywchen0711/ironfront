// The enemy: for every square it can reach, every weapon and every target, it scores the damage it would do (and
// the damage it would take back), and picks the best. With nothing in reach it closes in on the nearest enemy.
// A commander holds its ground until someone comes near.
import { reach, weaponsOf, inRange, dist, alive, expected, counterOf } from './rules.js';
import { TERRAIN } from './data.js';

export function plan(u, units, map, chaseBoss = false) {
  const foes = units.filter((o) => alive(o) && o.side !== u.side);
  if (!foes.length) return null;
  const { tiles, path } = reach(u, units, map);
  const near = Math.min(...foes.map((f) => dist(u, f)));
  const hold = u.boss && near > 6;
  let best = null;
  for (const t of hold ? [{ x: u.x, y: u.y }] : tiles) {
    const here = { ...u, x: t.x, y: t.y };
    for (const w of weaponsOf(u)) for (const f of foes) {
      if (!inRange(w.w, dist(here, f))) continue;
      const gain = expected(here, w, f, map), back = counterOf(f, here, w.w.cat);
      const loss = back ? expected(f, back, here, map) * 0.6 : 0;
      const kill = f.hp.body <= gain ? 60 : 0;
      const s = gain + kill - loss + TERRAIN[map[t.y][t.x]].eva * 0.3 + (chaseBoss && f.boss ? 25 : 0);
      if (!best || s > best.s) best = { s, x: t.x, y: t.y, w, target: f };
    }
  }
  if (best) return { to: { x: best.x, y: best.y }, path: path(best.x, best.y), w: best.w, target: best.target };
  if (hold) return { to: { x: u.x, y: u.y }, path: [] };
  // nobody in reach: walk towards the closest
  let go = { x: u.x, y: u.y }, gd = 999;
  for (const t of tiles) { const d = Math.min(...foes.map((f) => dist(t, f))) + TERRAIN[map[t.y][t.x]].cost * 0.01 - TERRAIN[map[t.y][t.x]].eva * 0.01; if (d < gd) { gd = d; go = t; } }
  return { to: go, path: path(go.x, go.y) };
}
