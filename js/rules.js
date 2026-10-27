// The rules: building a machine from its parts, where it can go, what it can hit, and how a fight goes.
// A machine is a wanzer, a vehicle (tank, APC, artillery, anti-air) or a helicopter; all of them have four parts
// (body/hull, two arms or mounts, legs or drive) and up to three weapons and an accessory.
// What decides a fight: the damage type against the armour, where it is hit from (front, side, back), the height,
// the terrain, the weather, the pilot's level and skills, air against ground, and luck.
import { ITEM, TERRAIN, PILOTS, FIST, SKILLS } from './data.js?v=16';

export const PARTS = ['body', 'armL', 'armR', 'legs'];
export const SLOTS = ['wL', 'wR', 'sh', 'acc'];
let rnd = Math.random;
export const setRandom = (f) => { rnd = f || Math.random; };
// the battlefield's conditions, set when a battle starts: { weather: clear | rain | fog | night | snow | sand }
export const FIELD = { weather: 'clear' };

export const clsOf = (k) => ITEM[k.body]?.cls || 'wanzer';
export const isVehicle = (k) => clsOf(k) !== 'wanzer';
export const isAir = (u) => !!ITEM[u.legs]?.air;
export const isStatic = (u) => ['tower', 'depot'].includes(clsOf(u));
const accOf = (u) => (u.acc && ITEM[u.acc]) || {};

// a unit on the map, from a loadout ({pilot, body, armL, armR, legs, wL, wR, sh, acc}); hp per part
export function makeUnit(k, side, x, y, extra = {}) {
  const u = { side, pilot: k.pilot, lv: k.lv ?? PILOTS[k.pilot]?.lv ?? 1, exp: k.exp || 0, x, y, done: false, moved: false, st: {}, ...extra };
  for (const p of PARTS) u[p] = k[p];
  for (const s of SLOTS) u[s] = k[s] || null;
  u.paint = k.paint || null; u.cls = clsOf(u);
  u.hp = {}; for (const p of PARTS) u.hp[p] = ITEM[u[p]].hp;
  u.hp.body += accOf(u).hpBody || 0;
  if (extra.objTier) for (const p of PARTS) u.hp[p] = Math.round(u.hp[p] * (1 + 0.32 * (extra.objTier - 1)) * (extra.objMul || 1)); // the things missions are about get tougher with the war
  u.max = { ...u.hp };
  u.ammo = u.sh ? ITEM[u.sh].ammo + (accOf(u).ammo || 0) : 0;
  u.kits = side === 'p' && !isStatic(u) && u.cls !== 'truck' ? 2 + (accOf(u).kits || 0) : 0; // field repairs
  u.skills = (k.skills || PILOTS[k.pilot]?.skills || []).filter((s) => SKILLS[s] && (!SKILLS[s].lv || u.lv >= SKILLS[s].lv));
  return u;
}
export const alive = (u) => u.hp.body > 0;
export function weight(k) { return ['armL', 'armR', 'legs', 'wL', 'wR', 'sh', 'acc'].reduce((s, p) => s + (k[p] ? ITEM[k[p]].w || 0 : 0), 0); }
export const power = (k) => ITEM[k.body].power;
export function moveOf(u) {
  if (isStatic(u)) return 0;
  const base = u.hp.legs > 0 ? ITEM[u.legs].move + (accOf(u).move || 0) : 1;
  return Math.max(1, base - (u.st?.stun ? 2 : 0));
}
export function evadeOf(u, map) {
  if (isStatic(u)) return 0;
  const t = TERRAIN[map[u.y][u.x]], a = accOf(u), air = isAir(u);
  let e = (u.hp.legs > 0 ? ITEM[u.legs].eva : 0) + (air ? 0 : t.eva) + u.lv + (a.eva || 0) + (a.camo && t.eva > 0 ? a.camo : 0);
  if (FIELD.weather === 'sand') e += 5;
  if (u.st?.stun) e -= 10;
  return Math.round(e);
}
export const heightAt = (map, x, y) => Math.max(0, TERRAIN[map[y][x]].h);
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// the weapons a unit can fire right now: the hand weapons of arms still working, its fists, the shoulder if it has ammo
export function weaponsOf(u) {
  const out = [];
  if (isStatic(u) || u.cls === 'truck') return out;
  for (const [slot, arm] of [['wR', 'armR'], ['wL', 'armL']]) {
    if (u.hp[arm] <= 0) continue;
    const w = u[slot] && ITEM[u[slot]];
    if (w && w.cat !== 'shield') out.push({ slot, arm, w });
  }
  if (u.sh && u.ammo > 0) out.push({ slot: 'sh', arm: null, w: ITEM[u.sh] });
  if (u.cls === 'wanzer') {
    const armUp = u.hp.armR > 0 ? 'armR' : u.hp.armL > 0 ? 'armL' : null;
    if (armUp && !out.some((o) => o.w.cat === 'melee')) out.push({ slot: 'fist', arm: armUp, w: { ...FIST, dmg: ITEM[u[armUp]].punch } });
  }
  return out;
}
export const inRange = (w, d) => d >= w.rmin && d <= w.rmax;
// can this weapon be used on that target at all (ignoring range)?
export function canHit(att, w, def) {
  const W = w.w || w;
  if (isAir(def) && (W.cat === 'melee' || W.noAir || W.indirect)) return false;
  if (isAir(att) && W.cat === 'melee') return false;
  return true;
}
export const canAttack = (att, w, def) => canHit(att, w, def) && inRange(w.w || w, dist(att, def));

// every square a unit can go to this turn (Dijkstra over move costs), with the path to each
export function reach(u, units, map) {
  const H = map.length, W = map[0].length, best = new Map(), from = new Map(), k = (x, y) => y * W + x;
  const legs = ITEM[u.legs], hover = legs.hover && u.hp.legs > 0, air = isAir(u), wheels = legs.drive === 'wheels', mv = moveOf(u);
  const foe = new Set(units.filter((o) => alive(o) && o.side !== u.side && !isAir(o)).map((o) => k(o.x, o.y)));
  const taken = new Set(units.filter((o) => alive(o) && o !== u).map((o) => k(o.x, o.y)));
  const q = [[u.x, u.y, 0]]; best.set(k(u.x, u.y), 0);
  while (q.length) {
    q.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = q.shift();
    if (c > best.get(k(x, y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ch = map[ny][nx], t = TERRAIN[ch];
      let cost;
      if (air) cost = 1; // over everything
      else {
        if (t.block) continue;
        cost = t.water ? (hover ? 2 : 99) : hover && t.cost > 1 ? Math.max(1, t.cost - 1) : t.cost;
        if (wheels && !'r,.'.includes(ch)) cost += 1; // wheels are quick on roads, slow off them
        const climb = heightAt(map, nx, ny) - heightAt(map, x, y); if (climb > 0 && !hover) cost += climb;
      }
      const nc = c + cost; if (nc > mv || (!air && foe.has(k(nx, ny)))) continue;
      if (nc < (best.get(k(nx, ny)) ?? 99)) { best.set(k(nx, ny), nc); from.set(k(nx, ny), k(x, y)); q.push([nx, ny, nc]); }
    }
  }
  const tiles = [];
  for (const [key, c] of best) { if (taken.has(key)) continue; tiles.push({ x: key % W, y: Math.floor(key / W), c }); }
  const path = (x, y) => { const p = []; let key = k(x, y); while (key != null && key !== k(u.x, u.y)) { p.unshift({ x: key % W, y: Math.floor(key / W) }); key = from.get(key); } return p; };
  return { tiles, path };
}

// where an attack comes from, seen by the one attacked: front, side or back (it faces u.dir)
export function flankOf(att, def) {
  if (def.dir == null || isStatic(def)) return 'front';
  const a = Math.atan2(att.x - def.x, att.y - def.y); let d = Math.abs(a - def.dir) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d;
  return d > Math.PI * 0.7 ? 'back' : d > Math.PI * 0.35 ? 'side' : 'front';
}
const FLANK = { front: { acc: 0, dmg: 1 }, side: { acc: 10, dmg: 1.1 }, back: { acc: 20, dmg: 1.25 } };
// how much of each damage type gets through each armour
export const ARMOUR = { kin: { L: 1, M: 0.85, H: 0.65 }, exp: { L: 1.1, M: 1, H: 0.9 }, imp: { L: 1, M: 0.9, H: 0.85 }, fire: { L: 1.15, M: 1, H: 0.8 } };
export function armourOf(u) { return ITEM[u.body].armour || 'M'; }
export function armourMult(w, def) {
  let k = ARMOUR[w.dt || 'kin'][armourOf(def)] ?? 1;
  if (w.ap && k < 1) k += (1 - k) * w.ap;
  return k;
}

// the chance one shot hits
export function hitChance(att, w, def, map) {
  const W = w.w, a = accOf(att), d = dist(att, def), air = isAir(def);
  if (isStatic(def)) return 85;
  const arm = w.slot === 'sh' || w.slot === 'fist' || !w.arm || !att[w.arm] ? 0 : ITEM[att[w.arm]].acc || 0;
  const high = W.indirect || isAir(att) || air ? 0 : heightAt(map, att.x, att.y) - heightAt(map, def.x, def.y);
  let c = W.acc + arm + att.lv * 2 + high * 5 - evadeOf(def, map) - (W.cat === 'long' && d > 4 ? 5 : 0);
  c += (a.acc || 0) + (a.still && !att.moved ? a.still : 0) + FLANK[flankOf(att, def)].acc;
  if (air) c += W.aa ? 15 : (W.aaBonus || 0) - 20;
  if (W.cat === 'long' && accOf(def).ecm) c -= accOf(def).ecm;
  const wx = FIELD.weather;
  if (wx === 'rain') c -= 5; else if (wx === 'night') c -= a.acc ? 4 : 10; else if (wx === 'fog' && d > 3) c -= 15; else if (wx === 'sand') c -= 8;
  return Math.max(5, Math.min(98, Math.round(c)));
}
// the damage of one hit before luck
export function hitDamage(att, w, def, part, opt = {}) {
  const W = w.w, a = accOf(att), fl = FLANK[flankOf(att, def)];
  let dmg = W.dmg;
  if (W.cat === 'melee') dmg *= 1 + att.lv * 0.03 + (a.melee || 0);
  dmg *= opt.pierce ? 1 : armourMult(W, def);
  dmg *= fl.dmg;
  if (isAir(def) && W.aa) dmg *= 1.25;
  if (!isAir(def) && W.aa && W.cat === 'long') dmg *= 0.6;
  if (W.dt === 'exp' && accOf(def).resist) dmg *= accOf(def).resist;
  if (W.dt === 'fire' && FIELD.weather === 'rain') dmg *= 0.7;
  if (opt.shield && W.cat !== 'long' && !W.indirect && part !== 'legs') dmg *= 1 - opt.shield.guard;
  if (opt.guard) dmg *= 0.6;
  if (opt.fury && W.cat === 'melee') dmg *= 1.5;
  return dmg;
}
// the weapon the defender answers with: the same kind, if it can reach (not against artillery, not while stunned)
export function counterOf(def, att, kind, w) {
  if (!alive(def) || def.st?.stun || (w && w.w.indirect)) return null;
  const d = dist(att, def);
  return weaponsOf(def).filter((o) => o.w.cat === kind && inRange(o.w, d) && canHit(def, o, att) && !o.w.indirect).sort((a, b) => b.w.dmg * b.w.shots - a.w.dmg * a.w.shots)[0] || null;
}
const PART_ODDS = [['body', 0.4], ['armL', 0.19], ['armR', 0.19], ['legs', 0.22]];
function pickPart(u) {
  if (isStatic(u)) return 'body';
  const ok = PART_ODDS.filter(([p]) => u.hp[p] > 0 || p === 'body'), sum = ok.reduce((s, [, k]) => s + k, 0);
  let r = rnd() * sum; for (const [p, k] of ok) { r -= k; if (r <= 0) return p; } return 'body';
}
// a pilot skill fires now and then: the attacker's on its attack, the defender's against it
const skillRoll = (u) => Math.min(0.4, 0.12 + u.lv * 0.012);
function pickSkill(u, role, w) {
  const can = (u.skills || []).filter((s) => SKILLS[s].role === role && (!SKILLS[s].only || SKILLS[s].only(w.w)));
  if (!can.length || rnd() > skillRoll(u)) return null;
  return can[Math.floor(rnd() * can.length)];
}
// one volley: every shot is rolled; returns the hits so the battle scene can show them
export function volley(att, w, def, map) {
  const skill = pickSkill(att, 'att', w), dskill = pickSkill(def, 'def', w);
  let pct = hitChance(att, w, def, map); if (skill === 'eagle') pct = Math.min(98, pct + 25);
  const hits = [], flank = flankOf(att, def);
  const shield = ['wL', 'wR'].map((s) => def[s] && ITEM[def[s]].cat === 'shield' && def.hp[s === 'wL' ? 'armL' : 'armR'] > 0 ? ITEM[def[s]] : null).find(Boolean);
  if (w.slot === 'sh') att.ammo--;
  const shots = w.w.shots * (skill === 'double' ? 2 : 1);
  const crit0 = 4 + (w.w.crit || 0) + (accOf(att).crit || 0) + (skill === 'pierce' ? 10 : 0);
  for (let i = 0; i < shots; i++) {
    if (!alive(def)) break;
    if (rnd() * 100 >= pct || (dskill === 'dodge' && rnd() < 0.35)) { hits.push({ miss: true }); continue; }
    const part = pickPart(def), crit = rnd() * 100 < crit0;
    let dmg = hitDamage(att, w, def, part, { shield, guard: dskill === 'guard', fury: skill === 'fury', pierce: skill === 'pierce' }) * (0.9 + rnd() * 0.2) * (crit ? 1.5 : 1);
    dmg = Math.max(1, Math.round(dmg));
    const before = def.hp[part];
    def.hp[part] = Math.max(0, before - dmg);
    const h = { part, dmg, broke: before > 0 && def.hp[part] === 0, crit };
    // a helicopter that loses its rotor comes down
    if (h.broke && part === 'legs' && isAir(def)) { def.hp.body = 0; h.crash = true; }
    if (w.w.burn && rnd() < w.w.burn) { def.st.burn = 2; h.burn = true; }
    if (w.w.stun && rnd() < w.w.stun && !isStatic(def)) { def.st.stun = 1; h.stun = true; }
    hits.push(h);
    att.exp += Math.min(dmg, before) / def.max.body * 60; // experience: the share of a machine knocked out
  }
  if (!alive(def)) att.exp += 40;
  att.exp = Math.round(att.exp);
  return { pct, hits, skill, dskill, flank };
}
// a fight: the attack, then the answer if the defender can make one
export function fight(att, w, def, map) {
  const first = volley(att, w, def, map);
  const cw = counterOf(def, att, w.w.cat, w), second = cw ? volley(def, cw, att, map) : null;
  return { att, def, w, first, cw, second };
}
// at the start of a side's turn: burning machines burn, stuns wear off
export function tickStatus(u) {
  const out = {};
  if (u.st?.burn && alive(u)) { const d = Math.max(4, Math.round(u.max.body * 0.07)); u.hp.body = Math.max(0, u.hp.body - d); out.burn = d; u.st.burn--; if (!u.st.burn) delete u.st.burn; }
  if (u.st?.stun) { u.st.stun--; if (!u.st.stun) delete u.st.stun; }
  return out;
}
// a field repair: every part gets back 35% of its full strength (a broken arm or leg works again); not the dead
export function repair(u) {
  if (!alive(u) || u.kits <= 0) return null;
  u.kits--; const got = {};
  for (const p of PARTS) { const before = u.hp[p]; u.hp[p] = Math.min(u.max[p], u.hp[p] + Math.round(u.max[p] * 0.35)); got[p] = u.hp[p] - before; }
  delete u.st.burn;
  return got;
}
export const hurtOf = (u) => PARTS.reduce((s, p) => s + (u.max[p] - u.hp[p]) / u.max[p], 0) / 4;
// pilots learn: returns the new level if one was reached
export const expNeed = (lv) => 30 + lv * 11;
export function learn(u) { let up = 0; while (u.exp >= expNeed(u.lv)) { u.exp -= expNeed(u.lv); u.lv++; up = u.lv; } return up; }
// a quick guess of the damage a weapon does, for the computer and the preview
export function expected(att, w, def, map) {
  if (!canHit(att, w, def)) return 0;
  return hitChance(att, w, def, map) / 100 * hitDamage(att, w, def, 'body') * w.w.shots;
}

// ---------------------------------------------------------------- what may go in each slot
// wanzers carry hand weapons and shields, shoulder weapons and any accessory; each vehicle its own kinds of guns
export const VSLOT = {
  tank: { wR: ['cannon', 'autocannon'], wL: ['mg', 'hmg'], sh: ['missile', 'rocket', 'atgm'] },
  apc: { wR: ['autocannon', 'mg', 'hmg'], wL: ['mg', 'smg'], sh: ['rocket', 'missile', 'atgm'] },
  heli: { wR: ['chaingun', 'autocannon'], wL: ['rocketpod'], sh: ['atgm', 'aamissile', 'missile'] },
  spg: { wR: ['mg', 'hmg'], wL: [], sh: ['howitzer', 'mortar'] },
  aa: { wR: ['flak', 'autocannon'], wL: ['mg'], sh: ['sam', 'aamissile'] },
};
export const DRIVE_OF = { tank: 'tracks', spg: 'tracks', apc: 'wheels', aa: 'wheels', heli: 'rotor', truck: 'wheels' };
export function fits(k, slot, id) {
  const it = ITEM[id]; if (!it) return false;
  const cls = clsOf(k);
  if (slot === 'body') return it.kind === 'body' && it.cls === cls;
  if (slot === 'acc') return it.kind === 'acc';
  if (cls === 'wanzer') {
    if (slot === 'armL' || slot === 'armR') return it.kind === 'arm';
    if (slot === 'legs') return it.kind === 'legs';
    if (slot === 'sh') return it.kind === 'weapon' && it.cat === 'long' && !it.veh;
    return it.kind === 'weapon' && ['short', 'melee', 'shield'].includes(it.cat) && !it.veh;
  }
  if (slot === 'legs') return it.kind === 'drive' && it.drive === DRIVE_OF[cls];
  if (slot === 'armR') return it.kind === 'mount' && it.mount === 'turret';
  if (slot === 'armL') return it.kind === 'mount' && it.mount === 'pylon';
  return it.kind === 'weapon' && (VSLOT[cls]?.[slot] || []).includes(it.fam);
}
