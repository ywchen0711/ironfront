// Battlefields for the campaign, made from a seed: each setting has its own ground, cover and landmarks, laid down
// as soft blobs of noise, roads that join the two sides, a river with bridges, a town of blocks, a fortress wall.
// Every map is checked: the squad's corner and the enemy's are clear, and a ground machine can get from one to
// the other. Then the enemy, the things to protect or destroy, and the reinforcements are placed.
import { ITEM, ALL_ITEMS, TERRAIN, PILOTS } from './data.js?v=17';
import { VSLOT, DRIVE_OF } from './rules.js?v=17';

export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pick = (R, a) => a[Math.floor(R() * a.length)];

// ---------------------------------------------------------------- terrain
// for each setting: the ground, and how much of each feature (0-1)
const THEME = {
  plains: { base: '.', forest: 0.12, hills: 0.1, rubble: 0.012, road: 1, town: 0.15 },
  forest: { base: '.', forest: 0.42, hills: 0.12, rubble: 0.008, road: 0.6 },
  hills: { base: '.', forest: 0.1, hills: 0.35, high: 0.12, road: 0.7 },
  city: { base: ',', town: 1, rubble: 0.025, road: 1.4 },
  harbor: { base: ',', sea: 'top', town: 0.5, rubble: 0.015, road: 1 },
  coast: { base: '.', sea: 'side', forest: 0.1, hills: 0.1, road: 0.6, sand: 0.18 },
  snow: { base: 'c', forest: 0.12, hills: 0.25, high: 0.08, road: 0.5 },
  desert: { base: 'd', hills: 0.18, rubble: 0.02, road: 0.5, sandy: true },
  river: { base: '.', river: true, forest: 0.18, hills: 0.08, road: 0.8 },
  fortress: { base: '.', walls: true, hills: 0.14, forest: 0.06, road: 1 },
  airfield: { base: ',', strip: true, rubble: 0.015, town: 0.2, road: 0.8 },
  mountain: { base: '.', hills: 0.6, high: 0.3, forest: 0.12, road: 0.5 },
  industrial: { base: ',', town: 0.6, rubble: 0.035, road: 1.2 },
};
export const THEMES = Object.keys(THEME);
// smooth noise: a few random bumps added up
function field(R, W, H, n, r) {
  const b = Array.from({ length: n }, () => [R() * W, R() * H, r * (0.6 + R() * 0.8)]);
  return (x, y) => b.reduce((s, [bx, by, br]) => s + Math.max(0, 1 - Math.hypot(x - bx, (y - by) * 1.1) / br), 0);
}
export function makeMap(theme, W, H, seed) {
  for (let tryN = 0; tryN < 12; tryN++) {
    const R = rng(seed + tryN * 977), T = THEME[theme] || THEME.plains, m = Array.from({ length: H }, () => Array(W).fill(T.base));
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = c; };
    const blob = (amount, ch, r, onlyOn = null) => { if (!amount) return; const f = field(R, W, H, Math.max(1, Math.round(W * H * amount / (r * r * 0.7))), r); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y) > 0.55 && (!onlyOn || onlyOn.includes(m[y][x]))) m[y][x] = ch; };
    if (T.sand) blob(T.sand, 'd', 2.5);
    blob(T.hills, 'h', 2.6, [T.base, 'd', 'c']);
    if (T.high) blob(T.high, 'H', 1.8, ['h']);
    blob(T.forest, 'f', 2.2, [T.base, 'd']);
    blob(T.rubble, 'x', 1.2, [T.base, ',', 'd']);
    // the sea along the top or a side, the river across the middle
    if (T.sea === 'top') for (let x = 0; x < W; x++) { const d = 1 + Math.round(1 + Math.sin(x * 0.7 + seed) * 0.8); for (let y = 0; y < d; y++) set(x, y, 'w'); }
    if (T.sea === 'side') { const side = R() < 0.5; for (let y = 0; y < H; y++) { const d = 2 + Math.round(Math.sin(y * 0.5 + seed) * 1.2); for (let k = 0; k < d; k++) set(side ? k : W - 1 - k, y, 'w'); set(side ? d : W - 1 - d, y, 'd'); } }
    let bridges = [];
    if (T.river) {
      let y = Math.floor(H * 0.45 + R() * H * 0.1);
      for (let x = 0; x < W; x++) { set(x, y, 'w'); set(x, y + 1, 'w'); if (R() < 0.25) y = Math.max(3, Math.min(H - 5, y + (R() < 0.5 ? -1 : 1))); if (x > 0) { set(x, y, 'w'); set(x, y + 1, 'w'); } }
      const nb = W > 15 ? 3 : 2; for (let k = 0; k < nb; k++) bridges.push(Math.floor((k + 0.5) * W / nb + (R() - 0.5) * 2));
    }
    // a town: blocks of buildings between streets
    if (T.town) {
      const n = Math.round(T.town * W * H / 22);
      for (let k = 0; k < n; k++) { const x = Math.floor(R() * (W - 2)), y = Math.floor(2 + R() * (H - 6)), w = 1 + Math.floor(R() * 2), h = 1 + Math.floor(R() * 2); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (m[yy]?.[xx] && m[yy][xx] !== 'w') set(xx, yy, 'b'); if (R() < 0.4) set(x + w, y, 'x'); }
    }
    // a fortress: a wall across with gates, and a keep behind it
    if (T.walls) {
      const y = Math.floor(H * 0.35); for (let x = 1; x < W - 1; x++) set(x, y, '#');
      for (let k = 0; k < 3; k++) { const gx = Math.floor((k + 0.5) * W / 3); set(gx, y, 'r'); set(gx + 1, y, 'r'); }
      for (let x = 2; x < W - 2; x++) for (let yy = 1; yy < y; yy++) if (m[yy][x] === T.base && R() < 0.3) set(x, yy, ',');
    }
    // an airstrip: a long concrete band
    if (T.strip) { const y = Math.floor(H * 0.3); for (let x = 1; x < W - 1; x++) for (let yy = y; yy < y + 2; yy++) set(x, yy, ','); for (let x = 2; x < W - 2; x += 4) set(x, y + 2, 'r'); }
    // roads from the squad's side to the enemy's, crossing the river by the bridges
    const roads = Math.max(1, Math.round(T.road * 2));
    for (let k = 0; k < roads; k++) {
      let x = bridges[k % Math.max(1, bridges.length)] ?? Math.floor(W * (0.2 + R() * 0.6)), y = H - 1;
      while (y >= 0) { if (m[y][x] !== 'w' || T.river) set(x, y, m[y][x] === 'w' && !T.river ? 'w' : 'r'); if (R() < 0.3 && y > 1 && y < H - 2 && !(T.river && (m[y - 1][x] === 'w' || m[y + 1]?.[x] === 'w'))) { x = Math.max(1, Math.min(W - 2, x + (R() < 0.5 ? -1 : 1))); set(x, y, 'r'); } y--; }
    }
    if (T.sandy) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y][x] === 'r' && R() < 0.5) m[y][x] = 'd';
    // the squad's corner and the enemy's are kept clear of walls and water
    for (const [y0, y1] of [[H - 2, H], [0, 2]]) for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) if (TERRAIN[m[y][x]].block || (TERRAIN[m[y][x]].water && T.sea !== 'top')) m[y][x] = T.base === 'h' ? '.' : T.base;
    const rows = m.map((r) => r.join(''));
    if (connected(rows)) return rows;
  }
  // a last resort that is always fine: open ground
  return Array.from({ length: H }, () => (THEME[theme]?.base || '.').repeat(W));
}
// can a ground machine get from the bottom rows to the top half?
function connected(map) {
  const H = map.length, W = map[0].length, ok = (x, y) => !TERRAIN[map[y][x]].block && !TERRAIN[map[y][x]].water;
  const seen = new Set(), q = [];
  for (let x = 0; x < W; x++) if (ok(x, H - 1)) { q.push([x, H - 1]); seen.add((H - 1) * W + x); }
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx) || !ok(nx, ny)) continue; seen.add(ny * W + nx); q.push([nx, ny]); } }
  let top = 0; for (let y = 0; y < Math.ceil(H / 3); y++) for (let x = 0; x < W; x++) if (seen.has(y * W + x)) top++;
  return top >= W;
}

// ---------------------------------------------------------------- the enemy's machines
// the best item of a kind at or under a tier, by a filter, picked with a little luck among the close ones
function best(R, tier, f) {
  const c = ALL_ITEMS.filter((x) => f(x) && (x.tier || 1) <= tier).sort((a, b) => (b.tier || 1) - (a.tier || 1));
  if (!c.length) return null;
  const top = c.filter((x) => (x.tier || 1) >= (c[0].tier || 1) - 1);
  return pick(R, top).id;
}
const ROLES = {
  assault: { wR: ['rifle', 'mg'], wL: ['shieldL', 'rod', null], sh: ['rocket', 'missile', null] },
  heavy: { wR: ['hmg', 'shotgun', 'bazooka'], wL: ['shieldH', 'axe', 'hammer'], sh: ['missile', 'hmissile'] },
  sniper: { wR: ['sniper', 'amr'], wL: [null, 'shieldL'], sh: ['missile', null] },
  scout: { wR: ['smg', 'shotgun'], wL: ['blade', 'knuckle'], sh: [null, 'rocket'] },
  burner: { wR: ['flamer'], wL: ['knuckle', 'shieldL'], sh: ['cluster', null] },
  support: { wR: ['grenade', 'mg'], wL: ['shieldL', null], sh: ['mortar', 'aamissile'] },
  brawler: { wR: ['shotgun', 'smg'], wL: ['pile', 'hammer', 'axe'], sh: [null] },
  rail: { wR: ['rail', 'amr'], wL: ['blade', 'shieldH'], sh: ['hmissile', 'cluster'] },
};
export function enemyKit(cls, tier, R, role) {
  tier = Math.max(1, Math.min(10, tier));
  const fam = (f) => (x) => x.kind === 'weapon' && x.fam === f;
  if (cls === 'wanzer') {
    role = role || pick(R, tier >= 7 ? Object.keys(ROLES) : Object.keys(ROLES).filter((r) => r !== 'rail' && (tier >= 3 || !['burner', 'brawler'].includes(r))));
    const ro = ROLES[role], mk = pick(R, ['PW', 'BI', 'KA', 'GH', 'ZK', 'OD'].slice(0, tier >= 5 ? 6 : 5));
    const part = (kind, m2) => best(R, tier, (x) => x.kind === kind && x.cls !== 'tower' && (!m2 || x.maker === m2) && !x.tread && !x.hover && (kind !== 'body' || x.cls === 'wanzer')) || best(R, tier, (x) => x.kind === kind && (kind !== 'body' || x.cls === 'wanzer'));
    const k = { body: part('body', mk), armL: part('arm', mk), armR: part('arm', mk), legs: R() < 0.12 && tier >= 2 ? best(R, tier, (x) => x.kind === 'legs' && (x.tread || x.hover)) : part('legs', ['PW', 'BI', 'KA', 'GH'].includes(mk) ? mk : null), role };
    for (const s of ['wR', 'wL', 'sh']) { const f = pick(R, ro[s]); k[s] = f ? best(R, tier, fam(f)) : null; }
    if (tier >= 3 && R() < 0.4) k.acc = best(R, tier, (x) => x.kind === 'acc');
    return k;
  }
  const k = { body: best(R, Math.max(tier, ITEM[`H-${cls}${Math.min(10, tier)}`] ? tier : 10), (x) => x.kind === 'body' && x.cls === cls) || `H-${cls}3`,
    legs: best(R, tier, (x) => x.kind === 'drive' && x.drive === DRIVE_OF[cls]), armR: best(R, tier, (x) => x.kind === 'mount' && x.mount === 'turret'), armL: best(R, tier, (x) => x.kind === 'mount' && x.mount === 'pylon') };
  for (const s of ['wR', 'wL', 'sh']) { const fs = VSLOT[cls][s] || []; if (!fs.length) { k[s] = null; continue; } const f = pick(R, fs); k[s] = best(R, tier, fam(f)) || best(R, 10, fam(f)); }
  if (cls === 'tank' && tier < 3 && R() < 0.5) k.sh = null;
  return k;
}
// the classes a mix string asks for, e.g. "wz4 tank2 heli1"
export function parseMix(s) { const out = []; for (const tok of (s || '').split(/\s+/).filter(Boolean)) { const m = tok.match(/^([a-z]+)(\d+)$/); if (!m) continue; for (let i = 0; i < +m[2]; i++) out.push(m[1] === 'wz' ? 'wanzer' : m[1]); } return out; }

// ---------------------------------------------------------------- a whole mission, ready to play
// spec: { theme, size:[W,H], seed, tier, lv, n, mix, boss, named, obj, turns, reinf, slots, paint, faction }
export function buildMission(spec) {
  const [W, H] = spec.size || [16, 12], R = rng(spec.seed || 1), map = spec.map || makeMap(spec.theme || 'plains', W, H, spec.seed || 1);
  const free = (x, y, taken) => map[y]?.[x] && !TERRAIN[map[y][x]].block && !TERRAIN[map[y][x]].water && !taken.has(y * W + x);
  const taken = new Set();
  const spot = (y0, y1, x0 = 0, x1 = W) => { for (let k = 0; k < 400; k++) { const x = Math.floor(x0 + R() * (x1 - x0)), y = Math.floor(y0 + R() * (y1 - y0)); if (free(x, y, taken)) { taken.add(y * W + x); return [x, y]; } } for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (free(x, y, taken)) { taken.add(y * W + x); return [x, y]; } return null; };
  // the squad starts along the bottom, around the middle
  const slots = spec.slots || 6, p = [];
  for (let k = 0; k < slots; k++) { const s = spot(H - 2, H, Math.max(0, Math.floor(W / 2 - slots)), Math.min(W, Math.ceil(W / 2 + slots))); if (s) p.push(s); }
  const lv = spec.lv || 1, tier = spec.tier || 1, paint = spec.paint || null;
  const foe = (cls, y0, y1, o = {}) => { const s = spot(y0, y1); if (!s) return null; const kit = enemyKit(cls, o.tier || tier, R, o.role); return { pilot: o.pilot || (R() < 0.25 ? 'vet' : 'grunt'), ...kit, x: s[0], y: s[1], lv: o.lv ?? Math.max(1, lv + (R() < 0.25 ? 2 : 0) - 1 + Math.floor(R() * 3)), paint, ...o.extra }; };
  const pil = spec.pilot || ((cls) => 'grunt');
  const foes = [];
  const mix = parseMix(spec.mix || `wz${spec.n || 5}`);
  for (const cls of mix) { const f = foe(cls, 0, Math.ceil(H * 0.45), { pilot: typeof pil === 'function' ? pil(cls, R) : pil }); if (f) foes.push(f); }
  // a commander, and other named officers
  if (spec.boss) { const b = spec.boss, f = foe(b.cls || 'wanzer', 0, Math.max(2, Math.ceil(H * 0.25)), { pilot: b.pilot, tier: Math.min(10, tier + (b.tierUp ?? 1)), lv: lv + (b.lvUp ?? 5), role: b.role, extra: { boss: true, paint: b.paint || paint || null, hold: b.hold !== false } }); if (f) foes.push(f); }
  for (const nm of spec.named || []) { const f = foe(nm.cls || 'wanzer', 0, Math.ceil(H * 0.4), { pilot: nm.pilot, tier: Math.min(10, tier + 1), lv: lv + 3, role: nm.role }); if (f) foes.push(f); }
  // what the mission is about
  const objs = [], zone = [];
  const obj = spec.obj || 'all';
  if (obj === 'defend') { const s = spot(Math.floor(H * 0.62), H - 2, Math.floor(W * 0.3), Math.ceil(W * 0.7)); if (s) objs.push({ kind: pick(R, ['tower', 'depot']), side: 'p', x: s[0], y: s[1] }); }
  if (obj === 'escort') { const s = spot(H - 2, H, Math.floor(W * 0.3), Math.ceil(W * 0.7)) || p.pop(); if (s) objs.push({ kind: 'truck', side: 'p', x: s[0], y: s[1] }); }
  if (obj === 'destroy') { const n = spec.targets || 3; for (let k = 0; k < n; k++) { const s = spot(0, Math.ceil(H * 0.4)); if (s) objs.push({ kind: pick(R, ['depot', 'tower']), side: 'e', x: s[0], y: s[1] }); } }
  if (obj === 'escort' || obj === 'reach') for (let y = 0; y < 2; y++) for (let x = 0; x < W; x++) if (!TERRAIN[map[y][x]].block && !TERRAIN[map[y][x]].water) zone.push([x, y]);
  // reinforcements: [[turn, mix], ...] arriving along the top edge
  const reinf = (spec.reinf || []).map(([turn, m2]) => ({ turn, units: parseMix(m2).map((cls) => { const kit = enemyKit(cls, tier, R); return { pilot: typeof pil === 'function' ? pil(cls, R) : pil, ...kit, lv: lv + Math.floor(R() * 2), paint }; }) }));
  return { map, p, foes, objs, zone, reinf, win: { type: obj, turns: spec.turns || 0 } };
}
export const OBJ_LOADOUT = {
  tower: { body: 'S-tower', legs: 'S-base', armL: 'S-base', armR: 'S-base' },
  depot: { body: 'S-depot', legs: 'S-base', armL: 'S-base', armR: 'S-base' },
  truck: { body: 'S-truck', legs: 'D-wheels1', armL: 'M-pylon1', armR: 'M-turret1' },
};
