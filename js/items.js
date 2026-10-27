// Every part and weapon in the game, generated: each family (a kind of gun, a kind of body…) comes in ten marks,
// one per tier of the campaign, each made by one of the makers below, who give it their own character —
// heavier and tougher, lighter and more accurate, cheaper and rougher, faster-firing and weaker.
// The first wanzer parts and weapons (B1, MG1…) are kept as they were; everything else is built here.

// makers: what they do to what they build
export const MAKERS = {
  PW: { zh: '帕拉斯', en: 'Pallas', armour: 'M' },
  BI: { zh: '堡壘', en: 'Bastion', armour: 'H', hp: 1.15, dmg: 1.08, acc: -3, w: 1.15, eva: -3 },
  KA: { zh: '隼航', en: 'Kestrel', armour: 'L', hp: 0.9, acc: 4, eva: 4, w: 0.88, price: 1.15 },
  GH: { zh: '歌利亞', en: 'Goliath', armour: 'H', hp: 1.3, power: 1.15, w: 1.3, eva: -6, dmg: 1.12, acc: -4 },
  ZK: { zh: '札卡', en: 'Zakar', armour: 'M', price: 0.7, acc: -4, hp: 0.95, ammo: 1 },
  OD: { zh: '奧林', en: 'Orrin', armour: 'M', hp: 1.1, acc: 3, dmg: 1.08, price: 1.55 },
  HS: { zh: '赫爾辛', en: 'Helsing', armour: 'M', acc: 6, dmg: 1.04, price: 1.2 },
  VK: { zh: '維瑟', en: 'Visser', armour: 'M', shots: 1, dmg: 0.85 },
  TR: { zh: '天龍', en: 'Tenryu', armour: 'L', acc: 3, melee: 1.15, price: 1.1 },
  MR: { zh: '蜃樓', en: 'Mirage', armour: 'L', price: 1.1 },
};
const m = (k, key, d = 1) => MAKERS[k][key] ?? d;
const round = (v, n = 1) => Math.round(v / n) * n;
const price = (base, t, mk) => Math.max(100, round(base * Math.pow(1.36, t - 1) * m(mk, 'price'), 50));
const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ---------------------------------------------------------------- wanzer frames
const BODY_LINE = [
  ['PW', 'PW'], ['BI', 'BT'], ['KA', 'KS'], ['GH', 'GL'], ['ZK', 'ZB'], ['OD', 'OX'],
];
const ARM_LINE = BODY_LINE;
const LEG_LINE = [['PW', 'PW'], ['BI', 'BT'], ['KA', 'KS'], ['GH', 'GL']];
// the look of each maker's parts in 3D (see mech3d.js): bodies B1-B4, arms A1-A4, legs L1-L5
const LOOK_B = { PW: 'B1', BI: 'B2', KA: 'B4', GH: 'B3', ZK: 'B2', OD: 'B4' };
const LOOK_A = { PW: 'A1', BI: 'A2', KA: 'A4', GH: 'A3', ZK: 'A1', OD: 'A4' };
const LOOK_L = { PW: 'L1', BI: 'L2', KA: 'L4', GH: 'L2' };

function frames() {
  const out = [];
  for (const [mk, code] of BODY_LINE) for (let t = 1; t <= 10; t++) {
    out.push({ id: `B-${mk}${t}`, kind: 'body', cls: 'wanzer', tier: t, maker: mk, look: LOOK_B[mk], armour: m(mk, 'armour', 'M'),
      zh: `${MAKERS[mk].zh} ${code}-${t * 10 + 5} 機身`, en: `${MAKERS[mk].en} ${code}-${t * 10 + 5} body`,
      hp: round(90 * (1 + 0.15 * (t - 1)) * m(mk, 'hp')), power: round(120 * (1 + 0.1 * (t - 1)) * m(mk, 'power')), price: price(700, t, mk) });
  }
  for (const [mk, code] of ARM_LINE) for (let t = 1; t <= 10; t++) {
    out.push({ id: `A-${mk}${t}`, kind: 'arm', tier: t, maker: mk, look: LOOK_A[mk],
      zh: `${MAKERS[mk].zh} ${code}-${t * 10 + 5}A 手臂`, en: `${MAKERS[mk].en} ${code}-${t * 10 + 5}A arm`,
      hp: round(60 * (1 + 0.14 * (t - 1)) * m(mk, 'hp')), acc: Math.max(0, round(t * 0.8 + m(mk, 'acc', 0) * 0.6)), punch: round(12 * (1 + 0.1 * (t - 1)) * m(mk, 'dmg')),
      w: round(14 * (1 + 0.04 * (t - 1)) * m(mk, 'w')), price: price(450, t, mk) });
  }
  for (const [mk, code] of LEG_LINE) for (let t = 1; t <= 10; t++) {
    const move = mk === 'KA' ? (t >= 5 ? 6 : 5) : mk === 'GH' ? 3 : mk === 'PW' && t >= 6 ? 5 : 4;
    out.push({ id: `L-${mk}${t}`, kind: 'legs', tier: t, maker: mk, look: LOOK_L[mk],
      zh: `${MAKERS[mk].zh} ${code}-${t * 10 + 5}L 腿部`, en: `${MAKERS[mk].en} ${code}-${t * 10 + 5}L legs`,
      hp: round(80 * (1 + 0.14 * (t - 1)) * m(mk, 'hp')), move, eva: Math.max(0, round(12 + t * 0.7 + m(mk, 'eva', 0))), w: round(22 * (1 + 0.04 * (t - 1)) * m(mk, 'w')), price: price(550, t, mk) });
  }
  for (let t = 1; t <= 10; t++) {
    out.push({ id: `L-TR${t}`, kind: 'legs', tier: t, maker: 'GH', look: 'L3', tread: true, zh: `歌利亞 GT-${t * 10 + 5} 履帶`, en: `Goliath GT-${t * 10 + 5} treads`,
      hp: round(150 * (1 + 0.14 * (t - 1))), move: 3, eva: 0, w: round(36 * (1 + 0.04 * (t - 1))), price: price(1200, t, 'GH') });
    out.push({ id: `L-HV${t}`, kind: 'legs', tier: t, maker: 'KA', look: 'L5', hover: true, zh: `隼航 SH-${t * 10 + 5} 氣墊`, en: `Kestrel SH-${t * 10 + 5} hover`,
      hp: round(95 * (1 + 0.14 * (t - 1))), move: t >= 6 ? 6 : 5, eva: round(15 + t), w: round(30 * (1 + 0.04 * (t - 1))), price: price(1500, t, 'KA') });
  }
  return out;
}

// ---------------------------------------------------------------- vehicles: hulls, drives, mounts
// a vehicle is built like a wanzer: a hull (body), a drive (legs), a main mount (right arm) and a side mount (left)
export const VCLASS = {
  tank: { zh: '戰車', en: 'Tank', drive: 'tracks', armour: 'H', hp: 220, power: 230, price: 3800, from: 2 },
  apc: { zh: '裝甲車', en: 'APC', drive: 'wheels', armour: 'M', hp: 150, power: 170, price: 2600, from: 1 },
  heli: { zh: '攻擊直升機', en: 'Attack helicopter', drive: 'rotor', armour: 'L', hp: 120, power: 160, price: 4200, from: 2 },
  spg: { zh: '自走砲', en: 'Self-propelled gun', drive: 'tracks', armour: 'M', hp: 160, power: 230, price: 4400, from: 3 },
  aa: { zh: '防空車', en: 'Anti-air vehicle', drive: 'wheels', armour: 'L', hp: 130, power: 180, price: 3200, from: 3 },
};
function vehicles() {
  const out = [];
  for (const [cls, c] of Object.entries(VCLASS)) for (let k = 0; k < 6; k++) {
    const t = Math.min(10, c.from + k), mk = ['PW', 'BI', 'ZK', 'OD', 'GH', 'OD'][k];
    out.push({ id: `H-${cls}${t}`, kind: 'body', cls, tier: t, maker: mk, armour: c.armour, zh: `${MAKERS[mk].zh} ${c.zh} ${roman[k + 1]}型`, en: `${MAKERS[mk].en} ${c.en} Mk ${roman[k + 1]}`,
      hp: round(c.hp * (1 + 0.15 * (t - 1)) * m(mk, 'hp')), power: round(c.power * (1 + 0.1 * (t - 1))), price: price(c.price, t, mk) });
  }
  const DR = { tracks: { zh: '履帶', en: 'tracks', hp: 140, move: 4, eva: 0, w: 30 }, wheels: { zh: '輪組', en: 'wheels', hp: 100, move: 6, eva: 6, w: 20 }, rotor: { zh: '旋翼', en: 'rotor', hp: 80, move: 7, eva: 22, w: 18, air: true } };
  for (const [d, c] of Object.entries(DR)) for (let t = 1; t <= 8; t++) {
    const mk = ['PW', 'BI', 'KA', 'ZK', 'GH', 'OD', 'KA', 'OD'][t - 1];
    out.push({ id: `D-${d}${t}`, kind: 'drive', drive: d, tier: t, maker: mk, air: !!c.air, zh: `${MAKERS[mk].zh} ${c.zh} ${roman[t]}`, en: `${MAKERS[mk].en} ${c.en} ${roman[t]}`,
      hp: round(c.hp * (1 + 0.14 * (t - 1)) * m(mk, 'hp')), move: c.move + (t >= 6 ? 1 : 0), eva: Math.max(0, round(c.eva + t * 0.6 + m(mk, 'eva', 0))), w: round(c.w * (1 + 0.04 * (t - 1))), price: price(c.w * 40, t, mk) });
  }
  const MO = { turret: { zh: '砲塔', en: 'turret', hp: 110, acc: 2, w: 20 }, pylon: { zh: '掛架', en: 'pylon', hp: 80, acc: 0, w: 10 } };
  for (const [k2, c] of Object.entries(MO)) for (let t = 1; t <= 8; t++) {
    const mk = ['PW', 'BI', 'HS', 'ZK', 'GH', 'OD', 'HS', 'OD'][t - 1];
    out.push({ id: `M-${k2}${t}`, kind: 'mount', mount: k2, tier: t, maker: mk, zh: `${MAKERS[mk].zh} ${c.zh} ${roman[t]}`, en: `${MAKERS[mk].en} ${c.en} ${roman[t]}`,
      hp: round(c.hp * (1 + 0.14 * (t - 1)) * m(mk, 'hp')), acc: Math.max(0, round(c.acc + t * 0.8 + m(mk, 'acc', 0) * 0.5)), punch: 0, w: round(c.w * (1 + 0.04 * (t - 1))), price: price(c.w * 45, t, mk) });
  }
  return out;
}

// ---------------------------------------------------------------- weapons
// cat: short (hand guns, vehicle guns), melee, shield, long (shoulder: needs ammo)
// dt: damage type — kin(etic), exp(losive), imp(act), fire.  fx: how the battle scene draws it
// from: the first tier it appears at; makers: who makes the marks, in turn
const FAM = {
  mg: { zh: '機槍', en: 'machine gun', code: 'MG', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 9, shots: 6, rmin: 1, rmax: 3, acc: 62, w: 10, price: 700, makers: ['ZK', 'PW', 'VK', 'HS', 'OD'] },
  smg: { zh: '衝鋒槍', en: 'SMG', code: 'SM', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 6, shots: 8, rmin: 1, rmax: 2, acc: 70, w: 7, price: 500, makers: ['VK', 'ZK', 'KA', 'VK', 'OD'] },
  hmg: { zh: '重機槍', en: 'heavy MG', code: 'HM', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 12, shots: 6, rmin: 1, rmax: 3, acc: 58, w: 15, price: 1300, from: 2, makers: ['BI', 'GH', 'VK', 'ZK', 'OD'] },
  rifle: { zh: '步槍', en: 'rifle', code: 'RF', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 30, shots: 2, rmin: 1, rmax: 3, acc: 72, w: 13, price: 1200, makers: ['HS', 'PW', 'KA', 'ZK', 'OD'] },
  sniper: { zh: '狙擊步槍', en: 'sniper rifle', code: 'SR', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 52, shots: 1, rmin: 2, rmax: 4, acc: 78, w: 16, price: 2400, from: 2, crit: 10, makers: ['HS', 'KA', 'HS', 'OD'] },
  amr: { zh: '反器材步槍', en: 'anti-materiel rifle', code: 'AM', cat: 'short', dt: 'kin', fx: 'shell', dmg: 70, shots: 1, rmin: 2, rmax: 5, acc: 70, ap: 0.5, w: 22, price: 3600, from: 3, makers: ['BI', 'HS', 'GH', 'OD'] },
  shotgun: { zh: '霰彈槍', en: 'shotgun', code: 'SG', cat: 'short', dt: 'kin', fx: 'pellets', dmg: 12, shots: 5, rmin: 1, rmax: 2, acc: 80, w: 12, price: 900, makers: ['ZK', 'BI', 'PW', 'VK', 'OD'] },
  bazooka: { zh: '火箭筒', en: 'bazooka', code: 'BZ', cat: 'short', dt: 'exp', fx: 'rocket', dmg: 55, shots: 1, rmin: 1, rmax: 3, acc: 65, w: 16, price: 1800, from: 2, makers: ['ZK', 'BI', 'GH', 'OD'] },
  grenade: { zh: '榴彈發射器', en: 'grenade launcher', code: 'GL', cat: 'short', dt: 'exp', fx: 'grenade', dmg: 28, shots: 2, rmin: 2, rmax: 3, acc: 68, w: 12, price: 1400, from: 2, makers: ['PW', 'ZK', 'VK', 'OD'] },
  flamer: { zh: '火焰噴射器', en: 'flamethrower', code: 'FT', cat: 'short', dt: 'fire', fx: 'flame', dmg: 10, shots: 4, rmin: 1, rmax: 2, acc: 85, w: 14, price: 1500, from: 3, burn: 0.5, noAir: true, makers: ['ZK', 'GH', 'BI', 'OD'] },
  rail: { zh: '電磁步槍', en: 'railgun', code: 'RG', cat: 'short', dt: 'kin', fx: 'rail', dmg: 62, shots: 2, rmin: 2, rmax: 4, acc: 80, ap: 0.7, w: 24, price: 9000, from: 7, makers: ['OD', 'HS', 'OD'] },
  rod: { zh: '電磁棍', en: 'shock rod', code: 'SR', cat: 'melee', dt: 'imp', fx: 'melee', dmg: 38, shots: 1, rmin: 1, rmax: 1, acc: 85, w: 8, price: 900, stun: 0.3, makers: ['PW', 'TR', 'ZK', 'TR', 'OD'] },
  knuckle: { zh: '衝擊拳套', en: 'impact knuckle', code: 'IK', cat: 'melee', dt: 'imp', fx: 'melee', dmg: 28, shots: 2, rmin: 1, rmax: 1, acc: 82, w: 9, price: 1100, makers: ['TR', 'BI', 'TR', 'GH'] },
  axe: { zh: '重斧', en: 'heavy axe', code: 'AX', cat: 'melee', dt: 'imp', fx: 'melee', dmg: 60, shots: 1, rmin: 1, rmax: 1, acc: 72, w: 14, price: 2200, ap: 0.3, from: 2, makers: ['GH', 'TR', 'BI', 'OD'] },
  blade: { zh: '戰刀', en: 'combat blade', code: 'CB', cat: 'melee', dt: 'imp', fx: 'melee', dmg: 24, shots: 3, rmin: 1, rmax: 1, acc: 84, w: 11, price: 1600, crit: 10, from: 2, makers: ['TR', 'KA', 'TR', 'OD'] },
  hammer: { zh: '戰鎚', en: 'war hammer', code: 'WH', cat: 'melee', dt: 'imp', fx: 'melee', dmg: 70, shots: 1, rmin: 1, rmax: 1, acc: 70, w: 18, price: 2600, stun: 0.25, from: 3, makers: ['GH', 'BI', 'TR'] },
  pile: { zh: '打樁機', en: 'pile bunker', code: 'PB', cat: 'melee', dt: 'imp', fx: 'melee', dmg: 90, shots: 1, rmin: 1, rmax: 1, acc: 62, w: 20, price: 4000, ap: 0.8, from: 4, makers: ['GH', 'TR', 'OD'] },
  shieldL: { zh: '輕盾', en: 'light shield', code: 'LS', cat: 'shield', guard: 0.3, w: 10, price: 1000, makers: ['PW', 'KA', 'ZK', 'OD'] },
  shieldH: { zh: '重盾', en: 'heavy shield', code: 'HS', cat: 'shield', guard: 0.45, w: 16, price: 2500, from: 2, makers: ['BI', 'GH', 'BI', 'OD'] },
  // shoulder
  rocket: { zh: '火箭', en: 'rockets', code: 'RK', cat: 'long', dt: 'exp', fx: 'rocket', dmg: 26, shots: 2, rmin: 2, rmax: 5, acc: 65, ammo: 6, w: 12, price: 1500, makers: ['ZK', 'PW', 'VK', 'OD'] },
  missile: { zh: '飛彈', en: 'missile', code: 'MS', cat: 'long', dt: 'exp', fx: 'missile', dmg: 42, shots: 1, rmin: 3, rmax: 6, acc: 72, ammo: 4, w: 14, price: 2000, makers: ['PW', 'HS', 'ZK', 'OD'] },
  hmissile: { zh: '重飛彈', en: 'heavy missile', code: 'HX', cat: 'long', dt: 'exp', fx: 'missile', dmg: 65, shots: 1, rmin: 3, rmax: 7, acc: 70, ammo: 3, w: 20, price: 4200, from: 3, makers: ['GH', 'HS', 'OD'] },
  aamissile: { zh: '防空飛彈', en: 'AA missile', code: 'AA', cat: 'long', dt: 'exp', fx: 'missile', dmg: 40, shots: 1, rmin: 2, rmax: 6, acc: 70, ammo: 4, w: 12, price: 1800, aa: true, from: 2, makers: ['HS', 'KA', 'ZK', 'OD'] },
  mortar: { zh: '迫擊砲', en: 'mortar', code: 'MT', cat: 'long', dt: 'exp', fx: 'artillery', dmg: 35, shots: 2, rmin: 3, rmax: 6, acc: 55, ammo: 4, w: 16, price: 2200, indirect: true, from: 2, makers: ['ZK', 'BI', 'GH', 'OD'] },
  cluster: { zh: '集束火箭', en: 'cluster rockets', code: 'CR', cat: 'long', dt: 'exp', fx: 'rocket', dmg: 14, shots: 6, rmin: 2, rmax: 5, acc: 60, ammo: 3, w: 15, price: 2600, from: 3, makers: ['VK', 'ZK', 'OD'] },
  // vehicles
  cannon: { zh: '戰車砲', en: 'tank cannon', code: 'TC', cat: 'short', dt: 'kin', fx: 'shell', dmg: 70, shots: 1, rmin: 1, rmax: 4, acc: 70, ap: 0.4, w: 30, price: 3200, from: 2, veh: true, makers: ['BI', 'GH', 'HS', 'OD'] },
  autocannon: { zh: '機砲', en: 'autocannon', code: 'AC', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 18, shots: 4, rmin: 1, rmax: 3, acc: 66, aaBonus: 10, w: 20, price: 2200, veh: true, makers: ['ZK', 'VK', 'BI', 'OD'] },
  chaingun: { zh: '鏈砲', en: 'chain gun', code: 'CG', cat: 'short', dt: 'kin', fx: 'bullet', dmg: 10, shots: 8, rmin: 1, rmax: 3, acc: 60, w: 14, price: 1800, from: 2, veh: true, makers: ['VK', 'ZK', 'OD'] },
  rocketpod: { zh: '火箭莢艙', en: 'rocket pod', code: 'RP', cat: 'short', dt: 'exp', fx: 'rocket', dmg: 22, shots: 4, rmin: 1, rmax: 3, acc: 60, w: 16, price: 2200, from: 2, veh: true, makers: ['ZK', 'PW', 'OD'] },
  atgm: { zh: '反戰車飛彈', en: 'ATGM', code: 'AT', cat: 'long', dt: 'exp', fx: 'missile', dmg: 75, shots: 1, rmin: 2, rmax: 6, acc: 74, ap: 0.5, ammo: 3, w: 18, price: 4000, from: 2, veh: true, makers: ['HS', 'BI', 'OD'] },
  howitzer: { zh: '榴彈砲', en: 'howitzer', code: 'HW', cat: 'long', dt: 'exp', fx: 'artillery', dmg: 80, shots: 1, rmin: 3, rmax: 8, acc: 60, ammo: 4, w: 40, price: 5200, indirect: true, from: 3, veh: true, makers: ['GH', 'BI', 'OD'] },
  flak: { zh: '高射砲', en: 'flak cannon', code: 'FK', cat: 'short', dt: 'exp', fx: 'flak', dmg: 14, shots: 6, rmin: 1, rmax: 4, acc: 66, aa: true, w: 24, price: 3000, from: 3, veh: true, makers: ['ZK', 'VK', 'OD'] },
  sam: { zh: '地對空飛彈', en: 'SAM', code: 'SA', cat: 'long', dt: 'exp', fx: 'missile', dmg: 60, shots: 1, rmin: 2, rmax: 8, acc: 78, ammo: 4, aa: true, w: 18, price: 4200, from: 3, veh: true, makers: ['HS', 'OD'] },
};
export const FAMILIES = FAM;
function weapons() {
  const out = [];
  for (const [fam, f] of Object.entries(FAM)) {
    const from = f.from || 1;
    for (let k = 0; k < 10; k++) {
      const t = Math.min(10, from + k), mk = f.makers[k % f.makers.length], g = 1 + 0.12 * (t - 1);
      const it = { id: `W-${fam}${k + 1}`, kind: 'weapon', fam, tier: t, maker: mk, cat: f.cat, w: round(f.w * (1 + 0.03 * (t - 1)) * Math.min(1.15, m(mk, 'w'))), price: price(f.price, t, mk) };
      const num = (f.code === 'SR' && f.cat === 'melee' ? 'R' : '') + (k * 4 + (f.cat === 'melee' ? 3 : 7));
      it.zh = `${MAKERS[mk].zh} ${f.code}-${num} ${f.zh}`; it.en = `${MAKERS[mk].en} ${f.code}-${num} ${f.en}`;
      if (f.cat === 'shield') { it.guard = Math.min(0.62, +(f.guard + 0.015 * (t - from) + (mk === 'BI' || mk === 'GH' ? 0.03 : 0)).toFixed(2)); out.push(it); continue; }
      const dmgK = m(mk, 'dmg') * (f.cat === 'melee' ? m(mk, 'melee') : 1);
      Object.assign(it, { dt: f.dt, fx: f.fx, dmg: round(f.dmg * g * dmgK), shots: Math.max(1, f.shots + (f.shots >= 4 ? m(mk, 'shots', 0) : 0)), rmin: f.rmin, rmax: f.rmax + (t >= 7 && f.cat !== 'melee' && f.rmax >= 3 ? 1 : 0),
        acc: Math.min(95, round(f.acc + 1.5 * (t - from) + m(mk, 'acc', 0))) });
      for (const k2 of ['ap', 'aa', 'aaBonus', 'indirect', 'burn', 'stun', 'noAir', 'crit', 'veh']) if (f[k2] != null) it[k2] = f[k2];
      if (f.ammo) it.ammo = f.ammo + m(mk, 'ammo', 0) + (t >= 6 ? 1 : 0);
      out.push(it);
    }
  }
  return out;
}

// ---------------------------------------------------------------- accessories (one per machine)
const ACC = {
  sensor: { zh: '感測器', en: 'sensor', code: 'SN', mk: ['MR', 'HS', 'MR', 'OD'], f: (t) => ({ acc: 4 + Math.floor(t * 0.8) }), w: 3, price: 600 },
  plate: { zh: '追加裝甲', en: 'armour plate', code: 'AP', mk: ['BI', 'GH', 'ZK', 'OD'], f: (t) => ({ hpBody: round(14 * (1 + 0.15 * (t - 1))) }), w: 8, price: 700 },
  booster: { zh: '推進器', en: 'booster', code: 'BS', mk: ['KA', 'PW', 'KA', 'OD'], f: (t) => ({ move: t >= 6 ? 2 : 1, eva: 2 + Math.floor(t / 2) }), w: 6, price: 1100 },
  ecm: { zh: '干擾器', en: 'ECM pod', code: 'EC', mk: ['MR', 'OD', 'MR'], f: (t) => ({ ecm: 8 + t * 1.5 | 0 }), w: 4, price: 1200 },
  ammo: { zh: '彈藥架', en: 'ammo rack', code: 'AR', mk: ['ZK', 'PW', 'BI'], f: (t) => ({ ammo: 2 + Math.floor(t / 3) }), w: 5, price: 500 },
  gyro: { zh: '陀螺穩定器', en: 'gyro stabiliser', code: 'GY', mk: ['HS', 'KA', 'OD'], f: (t) => ({ still: 8 + t }), w: 4, price: 900 },
  kit: { zh: '維修套件', en: 'repair pack', code: 'RK', mk: ['PW', 'ZK', 'BI'], f: (t) => ({ kits: t >= 5 ? 2 : 1 }), w: 5, price: 800 },
  servo: { zh: '格鬥伺服', en: 'melee servo', code: 'MS', mk: ['TR', 'GH', 'TR'], f: (t) => ({ melee: 0.1 + t * 0.02 }), w: 5, price: 900 },
  fcs: { zh: '射控電腦', en: 'fire control', code: 'FC', mk: ['HS', 'MR', 'OD'], f: (t) => ({ crit: 5 + t }), w: 3, price: 1000 },
  reactive: { zh: '反應裝甲', en: 'reactive armour', code: 'RA', mk: ['BI', 'GH', 'OD'], f: (t) => ({ resist: +(0.86 - t * 0.012).toFixed(3) }), w: 9, price: 1200 },
  camo: { zh: '偽裝網', en: 'camouflage net', code: 'CN', mk: ['ZK', 'MR', 'KA'], f: (t) => ({ camo: 8 + t }), w: 3, price: 700 },
};
function accessories() {
  const out = [];
  for (const [k, a] of Object.entries(ACC)) for (let t = 1; t <= 10; t++) {
    const mk = a.mk[(t - 1) % a.mk.length];
    out.push({ id: `X-${k}${t}`, kind: 'acc', acc2: k, tier: t, maker: mk, zh: `${MAKERS[mk].zh} ${a.code}-${t} ${a.zh}`, en: `${MAKERS[mk].en} ${a.code}-${t} ${a.en}`, w: a.w, price: price(a.price, t, mk), ...a.f(t) });
  }
  return out;
}

export const GENERATED = [...frames(), ...vehicles(), ...weapons(), ...accessories()];
