// The rules: building a wanzer from its parts, where it can walk, what it can hit, and how a fight goes.
import { ITEM, TERRAIN, PILOTS, FIST } from './data.js';

export const PARTS = ['body', 'armL', 'armR', 'legs'];
export const SLOTS = ['wL', 'wR', 'sh'];
const rnd = Math.random;

// a unit on the map, from a loadout ({pilot, body, armL, armR, legs, wL, wR, sh}); hp per part
export function makeUnit(k, side, x, y, extra = {}) {
  const u = { side, pilot: k.pilot, lv: k.lv ?? PILOTS[k.pilot].lv, exp: k.exp || 0, x, y, done: false, moved: false, ...extra };
  for (const p of PARTS) u[p] = k[p];
  for (const s of SLOTS) u[s] = k[s] || null;
  u.paint = k.paint || null;
  u.hp = {}; for (const p of PARTS) u.hp[p] = ITEM[u[p]].hp;
  u.max = { ...u.hp };
  u.ammo = u.sh ? ITEM[u.sh].ammo : 0;
  u.kits = side === 'p' ? 2 : 0; // field repairs
  return u;
}
export const alive = (u) => u.hp.body > 0;
export function weight(k) { return ['armL', 'armR', 'legs', 'wL', 'wR', 'sh'].reduce((s, p) => s + (k[p] ? ITEM[k[p]].w : 0), 0); }
export const power = (k) => ITEM[k.body].power;
export function moveOf(u) { return u.hp.legs > 0 ? ITEM[u.legs].move : 1; }
export function evadeOf(u, map) { const t = TERRAIN[map[u.y][u.x]]; return (u.hp.legs > 0 ? ITEM[u.legs].eva : 0) + t.eva + u.lv; }
export const heightAt = (map, x, y) => Math.max(0, TERRAIN[map[y][x]].h);
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// the weapons a unit can fire right now: the hand weapons of arms still working, its fists, the shoulder if it has ammo
export function weaponsOf(u) {
  const out = [];
  for (const [slot, arm] of [['wR', 'armR'], ['wL', 'armL']]) {
    if (u.hp[arm] <= 0) continue;
    const w = u[slot] && ITEM[u[slot]];
    if (w && w.cat !== 'shield') out.push({ slot, arm, w });
  }
  if (u.sh && u.ammo > 0) out.push({ slot: 'sh', arm: null, w: ITEM[u.sh] });
  const armUp = u.hp.armR > 0 ? 'armR' : u.hp.armL > 0 ? 'armL' : null;
  if (armUp && !out.some((o) => o.w.cat === 'melee')) out.push({ slot: 'fist', arm: armUp, w: { ...FIST, dmg: ITEM[u[armUp]].punch } });
  return out;
}
export const inRange = (w, d) => d >= w.rmin && d <= w.rmax;

// every square a unit can walk to this turn (Dijkstra over move costs), with the path to each
export function reach(u, units, map) {
  const H = map.length, W = map[0].length, best = new Map(), from = new Map(), k = (x, y) => y * W + x;
  const hover = ITEM[u.legs].hover && u.hp.legs > 0, mv = moveOf(u);
  const foe = new Set(units.filter((o) => alive(o) && o.side !== u.side).map((o) => k(o.x, o.y)));
  const friend = new Set(units.filter((o) => alive(o) && o !== u && o.side === u.side).map((o) => k(o.x, o.y)));
  const q = [[u.x, u.y, 0]]; best.set(k(u.x, u.y), 0);
  while (q.length) {
    q.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = q.shift();
    if (c > best.get(k(x, y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = TERRAIN[map[ny][nx]]; if (t.block) continue;
      let cost = t.water ? (hover ? 2 : 99) : hover && t.cost > 1 ? Math.max(1, t.cost - 1) : t.cost;
      const climb = heightAt(map, nx, ny) - heightAt(map, x, y); if (climb > 0 && !hover) cost += climb;
      const nc = c + cost; if (nc > mv || foe.has(k(nx, ny))) continue;
      if (nc < (best.get(k(nx, ny)) ?? 99)) { best.set(k(nx, ny), nc); from.set(k(nx, ny), k(x, y)); q.push([nx, ny, nc]); }
    }
  }
  const tiles = [];
  for (const [key, c] of best) { if (friend.has(key)) continue; tiles.push({ x: key % W, y: Math.floor(key / W), c }); }
  const path = (x, y) => { const p = []; let key = k(x, y); while (key != null && key !== k(u.x, u.y)) { p.unshift({ x: key % W, y: Math.floor(key / W) }); key = from.get(key); } return p; };
  return { tiles, path };
}

// the chance one shot hits, and what it does
export function hitChance(att, w, def, map) {
  const arm = w.slot === 'sh' || !att[w.arm] ? 0 : ITEM[att[w.arm]].acc;
  const high = heightAt(map, att.x, att.y) - heightAt(map, def.x, def.y);
  const c = w.w.acc + arm + att.lv * 2 + high * 5 - evadeOf(def, map) - (w.w.cat === 'long' && dist(att, def) > 4 ? 5 : 0);
  return Math.max(10, Math.min(95, Math.round(c)));
}
// the weapon the defender answers with: the same kind, if it can reach
export function counterOf(def, att, kind) {
  if (!alive(def)) return null;
  const d = dist(att, def);
  return weaponsOf(def).filter((o) => o.w.cat === kind && inRange(o.w, d)).sort((a, b) => b.w.dmg * b.w.shots - a.w.dmg * a.w.shots)[0] || null;
}
const PART_ODDS = [['body', 0.4], ['armL', 0.19], ['armR', 0.19], ['legs', 0.22]];
function pickPart(u) {
  const ok = PART_ODDS.filter(([p]) => u.hp[p] > 0 || p === 'body'), sum = ok.reduce((s, [, k]) => s + k, 0);
  let r = rnd() * sum; for (const [p, k] of ok) { r -= k; if (r <= 0) return p; } return 'body';
}
// one volley: every shot is rolled; returns the hits so the battle scene can show them
export function volley(att, w, def, map) {
  const pct = hitChance(att, w, def, map), hits = [];
  const shield = ['wL', 'wR'].map((s) => def[s] && ITEM[def[s]].cat === 'shield' && def.hp[s === 'wL' ? 'armL' : 'armR'] > 0 ? ITEM[def[s]] : null).find(Boolean);
  if (w.slot === 'sh') att.ammo--;
  for (let i = 0; i < w.w.shots; i++) {
    if (!alive(def)) break;
    if (rnd() * 100 >= pct) { hits.push({ miss: true }); continue; }
    const part = pickPart(def);
    let dmg = Math.round(w.w.dmg * (0.9 + rnd() * 0.2) * (w.w.cat === 'melee' ? 1 + att.lv * 0.03 : 1));
    if (shield && w.w.cat !== 'long' && part !== 'legs') dmg = Math.round(dmg * (1 - shield.guard));
    const before = def.hp[part];
    def.hp[part] = Math.max(0, before - dmg);
    hits.push({ part, dmg, broke: before > 0 && def.hp[part] === 0 });
    att.exp += dmg;
  }
  if (!alive(def)) att.exp += 60;
  return { pct, hits };
}
// a fight: the attack, then the answer if the defender can make one
export function fight(att, w, def, map) {
  const first = volley(att, w, def, map);
  const cw = counterOf(def, att, w.w.cat), second = cw ? volley(def, cw, att, map) : null;
  return { att, def, w, first, cw, second };
}
// a field repair: every part gets back 35% of its full strength (a broken arm or leg works again); not the dead
export function repair(u) {
  if (!alive(u) || u.kits <= 0) return null;
  u.kits--; const got = {};
  for (const p of PARTS) { const before = u.hp[p]; u.hp[p] = Math.min(u.max[p], u.hp[p] + Math.round(u.max[p] * 0.35)); got[p] = u.hp[p] - before; }
  return got;
}
export const hurtOf = (u) => PARTS.reduce((s, p) => s + (u.max[p] - u.hp[p]) / u.max[p], 0) / 4;
// pilots learn: returns the new level if one was reached
export function learn(u) { let up = 0; while (u.exp >= u.lv * 100) { u.exp -= u.lv * 100; u.lv++; up = u.lv; } return up; }
// a quick guess of the damage a weapon does, for the computer and the preview
export function expected(att, w, def, map) { return hitChance(att, w, def, map) / 100 * w.w.dmg * w.w.shots; }
