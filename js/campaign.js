// The campaign: ten chapters, a hundred missions. The first six are drawn by hand (data.js); the rest are laid out
// here — the setting, the weather, what has to be done, who is in the way — and built from a seed by mapgen.js.
// The words (briefings, debriefings, chapter openings) are in story/*.js.
// Difficulty follows the mission's place: the gear tier rises one per chapter, the enemy pilots a level every
// two or three missions, the pay with both.
import { MISSIONS as FIRST } from './data.js?v=17';

// chapter: [zh, en]
export const CHAPTERS = [
  { zh: '第一章　邊境烽火', en: 'Chapter 1 — Border Fires' },
  { zh: '第二章　海峽之風', en: 'Chapter 2 — Strait Winds' },
  { zh: '第三章　鋼鐵洪流', en: 'Chapter 3 — Steel Tide' },
  { zh: '第四章　焦土', en: 'Chapter 4 — Scorched Earth' },
  { zh: '第五章　謊言之城', en: 'Chapter 5 — City of Lies' },
  { zh: '第六章　雙面刃', en: 'Chapter 6 — Double Edge' },
  { zh: '第七章　沙海', en: 'Chapter 7 — Sea of Sand' },
  { zh: '第八章　深淵', en: 'Chapter 8 — The Deep' },
  { zh: '第九章　黎明之前', en: 'Chapter 9 — Before Dawn' },
  { zh: '第十章　鋼魂', en: 'Chapter 10 — Iron Souls' },
];
// factions: their pilots and their paint
export const FACTIONS = {
  alliance: { paint: null, pilot: (R) => (R() < 0.3 ? 'vet' : 'grunt') },
  merc: { paint: 'desert', pilot: () => 'merc' },
  union: { paint: 'navy', pilot: () => 'hunter' },
  orrin: { paint: 'black', pilot: () => 'guard' },
};
// one mission: id, chapter, title, then the spec (see mapgen.buildMission) and who joins or leaves after it
const S = (id, zh, en, spec) => ({ id, zh, en, ...spec });
const SPECS = [
  // ---- chapter 1 (after the six drawn by hand)
  S('c1m7', '停火之夜', 'Ceasefire Night', { theme: 'plains', weather: 'night', obj: 'survive', turns: 6, mix: 'wz4', reinf: [[2, 'wz2'], [4, 'wz3']], faction: 'merc' }),
  S('c1m8', '塞林港慘案', 'The Selin Massacre', { theme: 'harbor', weather: 'rain', obj: 'defend', turns: 7, mix: 'wz5', reinf: [[3, 'wz2 apc1']], faction: 'merc' }),
  S('c1m9', '無標誌的敵人', 'The Unmarked', { theme: 'industrial', weather: 'dusk', obj: 'destroy', targets: 3, mix: 'wz5 apc1', faction: 'merc' }),
  S('c1m10', '灰燼中的旗', 'A Flag in the Ashes', { theme: 'plains', weather: 'clear', obj: 'boss', mix: 'wz5 apc2', boss: { pilot: 'rask' }, faction: 'alliance' }),
  // ---- chapter 2: across the strait; helicopters
  S('c2m1', '灘頭', 'The Beachhead', { theme: 'coast', weather: 'clear', obj: 'reach', mix: 'wz5 apc1', reinf: [[3, 'wz2']], faction: 'alliance' }),
  S('c2m2', '燈塔', 'The Lighthouse', { theme: 'coast', weather: 'fog', obj: 'defend', turns: 7, mix: 'wz3 heli1', reinf: [[3, 'wz2']], faction: 'alliance', join: ['sora'] }),
  S('c2m3', '鹽田', 'The Salt Flats', { theme: 'coast', weather: 'clear', obj: 'all', mix: 'wz4 tank1 heli1', faction: 'alliance' }),
  S('c2m4', '漁村', 'The Fishing Village', { theme: 'harbor', weather: 'rain', obj: 'escort', mix: 'wz5 apc1', reinf: [[4, 'wz2']], faction: 'alliance' }),
  S('c2m5', '鑽油平台', 'The Oil Platform', { theme: 'harbor', weather: 'night', obj: 'destroy', targets: 3, mix: 'wz4 heli1 apc1', faction: 'alliance' }),
  S('c2m6', '海峽機場', 'Strait Airfield', { theme: 'airfield', weather: 'clear', obj: 'all', mix: 'heli2 wz4 apc1', faction: 'alliance' }),
  S('c2m7', '暴風雨', 'Into the Storm', { theme: 'coast', weather: 'rain', obj: 'survive', turns: 7, mix: 'wz4', reinf: [[2, 'wz2 heli1'], [4, 'wz2 apc1'], [6, 'wz2']], faction: 'alliance' }),
  S('c2m8', '雙子島', 'The Twin Isles', { theme: 'river', weather: 'dusk', obj: 'all', mix: 'wz5 heli1 tank1', named: [{ pilot: 'vet', cls: 'heli' }], faction: 'alliance' }),
  S('c2m9', '運輸船團', 'The Convoy', { theme: 'plains', weather: 'clear', obj: 'escort', size: [16, 16], mix: 'wz4 heli2', reinf: [[3, 'wz2']], faction: 'alliance' }),
  S('c2m10', '幽靈', 'Wraith', { theme: 'coast', weather: 'dusk', obj: 'boss', mix: 'heli3 wz3', boss: { pilot: 'wraith', cls: 'heli' }, faction: 'alliance' }),
  // ---- chapter 3: the armoured war on the plains
  S('c3m1', '平原之門', 'Gate of the Plains', { theme: 'plains', weather: 'clear', obj: 'all', mix: 'tank2 wz4 apc1', faction: 'alliance' }),
  S('c3m2', '第七裝甲', 'The Seventh Armoured', { theme: 'plains', weather: 'dusk', obj: 'defend', turns: 7, mix: 'tank1 wz4', reinf: [[3, 'tank1 wz1']], faction: 'alliance', join: ['greta'] }),
  S('c3m3', '麥田', 'The Wheatfields', { theme: 'plains', weather: 'clear', obj: 'all', mix: 'wz5 apc2 tank1', faction: 'alliance' }),
  S('c3m4', '新兵', 'The Recruit', { theme: 'forest', weather: 'clear', obj: 'escort', mix: 'wz5 apc1', reinf: [[3, 'wz2 heli1']], faction: 'alliance', joinBefore: ['pip'] }),
  S('c3m5', '拉文河', 'The Raven River', { theme: 'river', weather: 'rain', obj: 'reach', mix: 'wz5 tank1 heli1', faction: 'alliance' }),
  S('c3m6', '砲兵陣地', 'The Gun Line', { theme: 'hills', weather: 'clear', obj: 'destroy', targets: 3, mix: 'spg2 wz4 aa1', faction: 'alliance' }),
  S('c3m7', '夜襲', 'Night Raid', { theme: 'forest', weather: 'night', obj: 'all', mix: 'wz5 tank1 spg1', faction: 'alliance', joinBefore: ['ivo'] }),
  S('c3m8', '鐵橋', 'The Iron Bridge', { theme: 'river', weather: 'dusk', obj: 'defend', turns: 8, mix: 'tank2 wz3', reinf: [[2, 'wz2'], [4, 'tank1 heli1'], [6, 'wz3']], faction: 'alliance' }),
  S('c3m9', '焦土前夜', 'Before the Burning', { theme: 'city', weather: 'dusk', obj: 'all', mix: 'wz5 tank1 apc1 spg1', faction: 'alliance' }),
  S('c3m10', '鐵公爵', 'The Iron Duke', { theme: 'plains', weather: 'clear', obj: 'boss', size: [18, 13], mix: 'tank3 spg1 wz3', boss: { pilot: 'brann', cls: 'tank' }, faction: 'alliance' }),
  // ---- chapter 4: the winter in the mountains
  S('c4m1', '第一場雪', 'First Snow', { theme: 'snow', weather: 'snow', obj: 'all', mix: 'wz5 tank1 apc1', faction: 'alliance' }),
  S('c4m2', '燃燒的村莊', 'The Burning Villages', { theme: 'snow', weather: 'dusk', obj: 'defend', turns: 7, mix: 'wz5', reinf: [[3, 'wz3 apc1']], faction: 'alliance' }),
  S('c4m3', '山口', 'The Pass', { theme: 'mountain', weather: 'fog', obj: 'reach', mix: 'wz5 spg1 heli1', faction: 'alliance' }),
  S('c4m4', '雪崩', 'Avalanche', { theme: 'snow', weather: 'snow', obj: 'survive', turns: 6, mix: 'wz4 tank1', reinf: [[2, 'wz3'], [4, 'heli2']], faction: 'alliance' }),
  S('c4m5', '戰俘營', 'The Camp', { theme: 'snow', weather: 'night', obj: 'destroy', targets: 3, mix: 'wz5 apc1 aa1', faction: 'alliance' }),
  S('c4m6', '補給斷絕', 'Cut Off', { theme: 'snow', weather: 'snow', obj: 'escort', size: [16, 13], mix: 'wz4 tank1', reinf: [[3, 'wz2']], faction: 'alliance' }),
  S('c4m7', '皮普', 'Pip', { theme: 'forest', weather: 'snow', obj: 'all', mix: 'wz6 tank1 heli1', faction: 'alliance', leave: ['pip'] }),
  S('c4m8', '白色地獄', 'White Hell', { theme: 'mountain', weather: 'snow', obj: 'all', mix: 'wz5 tank2 aa1 heli1', faction: 'alliance' }),
  S('c4m9', '長夜', 'The Long Night', { theme: 'snow', weather: 'night', obj: 'survive', turns: 8, mix: 'wz4', reinf: [[2, 'wz2 tank1'], [4, 'wz3'], [6, 'heli2 wz1']], faction: 'alliance' }),
  S('c4m10', '黑犬歸來', 'The Hound Returns', { theme: 'mountain', weather: 'clear', obj: 'boss', size: [18, 13], mix: 'wz5 tank1 heli1', boss: { pilot: 'hound', role: 'brawler', tierUp: 1, lvUp: 7 }, faction: 'alliance' }),
  // ---- chapter 5: the capital
  S('c5m1', '維爾格勒', 'Velgrad', { theme: 'city', weather: 'clear', obj: 'all', mix: 'wz6 tank1 apc1', faction: 'alliance' }),
  S('c5m2', '記者', 'The Correspondent', { theme: 'city', weather: 'rain', obj: 'escort', mix: 'wz5 apc1', reinf: [[3, 'wz2 heli1']], faction: 'alliance' }),
  S('c5m3', '地下鐵', 'The Underground', { theme: 'industrial', weather: 'dusk', obj: 'reach', mix: 'wz6 apc1', faction: 'alliance' }),
  S('c5m4', '電視台', 'The Broadcast Tower', { theme: 'city', weather: 'clear', obj: 'defend', turns: 7, mix: 'wz5 heli1', reinf: [[2, 'wz2'], [4, 'tank1 heli1']], faction: 'union' }),
  S('c5m5', '十三號倉庫', 'Warehouse Thirteen', { theme: 'industrial', weather: 'night', obj: 'destroy', targets: 3, mix: 'wz5 apc1 aa1', faction: 'merc' }),
  S('c5m6', '議會廣場', 'Parliament Square', { theme: 'city', weather: 'clear', obj: 'all', size: [18, 13], mix: 'wz6 tank2 heli1', faction: 'alliance' }),
  S('c5m7', '雙面', 'Two Faces', { theme: 'city', weather: 'fog', obj: 'all', mix: 'wz6 apc1 heli1', faction: 'union' }),
  S('c5m8', '逃離首都', 'Out of the Capital', { theme: 'city', weather: 'night', obj: 'reach', mix: 'wz6 tank1', reinf: [[3, 'heli2']], faction: 'union' }),
  S('c5m9', '斷橋', 'The Broken Bridge', { theme: 'river', weather: 'rain', obj: 'all', mix: 'wz5 tank2 heli1', faction: 'union' }),
  S('c5m10', '蝰蛇', 'The Viper', { theme: 'city', weather: 'dusk', obj: 'boss', size: [18, 13], mix: 'wz5 heli2 tank1', boss: { pilot: 'viper', role: 'scout', tierUp: 1, lvUp: 6 }, faction: 'union' }),
  // ---- chapter 6: hunted by both sides
  S('c6m1', '通緝', 'Wanted', { theme: 'plains', weather: 'clear', obj: 'all', mix: 'wz6 apc1 heli1', faction: 'union' }),
  S('c6m2', '荒野', 'The Badlands', { theme: 'desert', weather: 'clear', obj: 'reach', mix: 'wz5 tank1 heli1', faction: 'union' }),
  S('c6m3', '老戰友', 'An Old Comrade', { theme: 'desert', weather: 'dusk', obj: 'defend', turns: 7, mix: 'wz5 apc1', reinf: [[3, 'wz2 heli1'], [5, 'tank1']], faction: 'alliance', join: ['anya'] }),
  S('c6m4', '綠洲', 'The Oasis', { theme: 'coast', weather: 'clear', obj: 'all', mix: 'wz6 tank1 aa1', faction: 'merc' }),
  S('c6m5', '沙暴', 'Sandstorm', { theme: 'desert', weather: 'sand', obj: 'survive', turns: 7, mix: 'wz4 tank1', reinf: [[2, 'wz3'], [4, 'tank1 apc1'], [6, 'wz3']], faction: 'union' }),
  S('c6m6', '追獵者', 'The Hunters', { theme: 'desert', weather: 'clear', obj: 'all', mix: 'wz5 heli2 tank1', faction: 'union' }),
  S('c6m7', '叛逃者', 'Deserters', { theme: 'desert', weather: 'dusk', obj: 'escort', mix: 'wz5 apc1 heli1', faction: 'union' }),
  S('c6m8', '峽谷', 'The Canyon', { theme: 'mountain', weather: 'sand', obj: 'reach', mix: 'wz6 spg1', faction: 'union' }),
  S('c6m9', '蝰蛇之巢', "The Viper's Nest", { theme: 'airfield', weather: 'night', obj: 'destroy', targets: 3, mix: 'wz5 heli2 aa1', faction: 'union' }),
  S('c6m10', '賽爾', 'Sayer', { theme: 'fortress', weather: 'dusk', obj: 'boss', size: [18, 14], mix: 'wz6 tank2 spg1', boss: { pilot: 'sayer', role: 'heavy', tierUp: 1, lvUp: 7 }, faction: 'union' }),
  // ---- chapter 7: Orrin's proving grounds
  S('c7m1', '試驗場', 'The Proving Ground', { theme: 'desert', weather: 'clear', obj: 'all', mix: 'wz6 tank1 heli1', faction: 'orrin' }),
  S('c7m2', '天空之眼', 'Eyes in the Sky', { theme: 'desert', weather: 'clear', obj: 'defend', turns: 7, mix: 'heli3 wz2', reinf: [[2, 'heli2'], [4, 'heli2 wz2']], faction: 'orrin', join: ['tomas'] }),
  S('c7m3', '鐵軌', 'The Railway', { theme: 'desert', weather: 'dusk', obj: 'escort', size: [16, 16], mix: 'wz5 apc2', reinf: [[3, 'heli1 wz2']], faction: 'orrin' }),
  S('c7m4', '試作機', 'The Prototype', { theme: 'desert', weather: 'sand', obj: 'boss', mix: 'wz5 tank1', boss: { pilot: 'proto', role: 'rail', tierUp: 1, lvUp: 5 }, faction: 'orrin' }),
  S('c7m5', '地下基地入口', 'The Gate Below', { theme: 'industrial', weather: 'dusk', obj: 'reach', mix: 'wz6 tank1 aa1', faction: 'orrin' }),
  S('c7m6', '雷達站', 'The Radar Station', { theme: 'desert', weather: 'night', obj: 'destroy', targets: 3, mix: 'wz5 heli1 aa1 spg1', faction: 'orrin' }),
  S('c7m7', '鏡湖', 'Mirror Lake', { theme: 'coast', weather: 'clear', obj: 'all', mix: 'wz6 heli2', faction: 'orrin' }),
  S('c7m8', '誘惑', 'The Offer', { theme: 'industrial', weather: 'rain', obj: 'all', mix: 'wz6 tank1 apc1', faction: 'orrin' }),
  S('c7m9', '熱浪', 'Heatwave', { theme: 'desert', weather: 'clear', obj: 'all', size: [18, 13], mix: 'wz6 tank2 spg1', faction: 'orrin' }),
  S('c7m10', '利維坦', 'Leviathan', { theme: 'industrial', weather: 'dusk', obj: 'boss', size: [18, 14], mix: 'wz5 tank2 heli1', boss: { pilot: 'kessler', role: 'heavy', tierUp: 1, lvUp: 6 }, named: [{ pilot: 'proto', role: 'rail' }], faction: 'orrin' }),
  // ---- chapter 8: underground, and the coastal fortress
  S('c8m1', '熔爐', 'The Foundry', { theme: 'industrial', weather: 'dusk', obj: 'all', mix: 'wz6 tank1 apc1', faction: 'orrin' }),
  S('c8m2', '冷卻塔', 'The Cooling Towers', { theme: 'industrial', weather: 'night', obj: 'destroy', targets: 4, mix: 'wz6 aa1', faction: 'orrin' }),
  S('c8m3', '地底河', 'The River Below', { theme: 'river', weather: 'night', obj: 'reach', mix: 'wz6 heli1', faction: 'orrin' }),
  S('c8m4', '實驗室', 'The Laboratory', { theme: 'industrial', weather: 'dusk', obj: 'escort', mix: 'wz6 apc1', reinf: [[3, 'wz3']], faction: 'orrin' }),
  S('c8m5', '杜克', 'Duke', { theme: 'fortress', weather: 'rain', obj: 'all', mix: 'wz6 tank1 spg1', faction: 'orrin', leave: ['duke'] }),
  S('c8m6', '海岸要塞', 'The Coastal Fortress', { theme: 'fortress', weather: 'rain', obj: 'all', size: [18, 14], mix: 'wz5 tank2 spg1', faction: 'orrin' }),
  S('c8m7', '潛艦船塢', 'The Submarine Pens', { theme: 'harbor', weather: 'night', obj: 'destroy', targets: 4, mix: 'wz6 heli1 apc1', faction: 'orrin' }),
  S('c8m8', '圍城', 'Besieged', { theme: 'fortress', weather: 'dusk', obj: 'survive', turns: 8, mix: 'wz5', reinf: [[2, 'wz3 tank1'], [4, 'heli2 wz2'], [6, 'tank2 wz2']], faction: 'orrin' }),
  S('c8m9', '熄燈', 'Lights Out', { theme: 'city', weather: 'night', obj: 'all', mix: 'wz7 heli1', faction: 'orrin' }),
  S('c8m10', '舊友', 'An Old Friend', { theme: 'fortress', weather: 'dusk', obj: 'boss', size: [18, 14], mix: 'wz5 tank2 spg1', boss: { pilot: 'duke', role: 'heavy', tierUp: 1, lvUp: 8 }, faction: 'orrin' }),
  // ---- chapter 9: the coalition
  S('c9m1', '和談', 'The Parley', { theme: 'plains', weather: 'clear', obj: 'defend', turns: 7, mix: 'wz6', reinf: [[2, 'wz2 heli1'], [4, 'tank2'], [6, 'wz3']], faction: 'orrin' }),
  S('c9m2', '刺客', 'Assassins', { theme: 'city', weather: 'fog', obj: 'all', mix: 'wz7 heli1', faction: 'orrin' }),
  S('c9m3', '黑犬', 'The Hound', { theme: 'mountain', weather: 'clear', obj: 'all', mix: 'wz6 tank1 heli1', faction: 'orrin', join: ['hound'] }),
  S('c9m4', '聯軍', 'The Coalition', { theme: 'plains', weather: 'clear', obj: 'all', size: [20, 14], slots: 8, mix: 'wz5 tank2 heli1 spg1', faction: 'orrin' }),
  S('c9m5', '空中走廊', 'The Air Corridor', { theme: 'coast', weather: 'clear', obj: 'all', mix: 'heli4 aa1 wz3', faction: 'orrin' }),
  S('c9m6', '生命線', 'Lifeline', { theme: 'snow', weather: 'snow', obj: 'escort', size: [16, 16], mix: 'wz6 tank1', reinf: [[3, 'heli2 wz1']], faction: 'orrin' }),
  S('c9m7', '方舟之影', 'Shadow of the Ark', { theme: 'mountain', weather: 'fog', obj: 'reach', mix: 'wz6 spg1 aa1', faction: 'orrin' }),
  S('c9m8', '最後的工廠', 'The Last Factory', { theme: 'industrial', weather: 'dusk', obj: 'destroy', targets: 3, mix: 'wz6 tank1 aa1', faction: 'orrin' }),
  S('c9m9', '雷鳴', 'Thunder', { theme: 'hills', weather: 'rain', obj: 'survive', turns: 8, mix: 'wz5', reinf: [[2, 'wz3 heli1'], [4, 'tank2 wz2'], [6, 'wz3 spg1']], faction: 'orrin' }),
  S('c9m10', '凱斯勒', 'Kessler', { theme: 'fortress', weather: 'night', obj: 'boss', size: [18, 14], mix: 'wz6 tank2 heli1', boss: { pilot: 'kessler', role: 'rail', tierUp: 1, lvUp: 4 }, faction: 'orrin' }),
  // ---- chapter 10: the Ark
  S('c10m1', '塞薩山', 'Mount Thessa', { theme: 'mountain', weather: 'clear', obj: 'all', size: [18, 13], mix: 'wz7 tank1 heli1', faction: 'orrin' }),
  S('c10m2', '雪線', 'The Snowline', { theme: 'snow', weather: 'snow', obj: 'reach', mix: 'wz7 aa1', faction: 'orrin' }),
  S('c10m3', '外牆', 'The Outer Wall', { theme: 'fortress', weather: 'dusk', obj: 'destroy', targets: 3, mix: 'wz5 tank1 spg1', faction: 'orrin' }),
  S('c10m4', '方舟甲板', 'The Deck of the Ark', { theme: 'industrial', weather: 'clear', obj: 'all', size: [18, 14], mix: 'wz6 tank1 heli1', faction: 'orrin' }),
  S('c10m5', '防空網', 'The Flak Net', { theme: 'airfield', weather: 'night', obj: 'destroy', targets: 3, mix: 'aa2 wz3 heli1', faction: 'orrin' }),
  S('c10m6', '引擎室', 'The Engine Room', { theme: 'industrial', weather: 'dusk', obj: 'survive', turns: 7, mix: 'wz6', reinf: [[2, 'wz3'], [4, 'tank2 wz2'], [6, 'wz4']], faction: 'orrin' }),
  S('c10m7', '艾莉絲的廣播', "Elise's Broadcast", { theme: 'city', weather: 'rain', obj: 'defend', turns: 7, mix: 'wz5 heli1', reinf: [[3, 'wz2'], [5, 'heli1 tank1']], faction: 'orrin' }),
  S('c10m8', '最後的衝鋒', 'The Last Charge', { theme: 'fortress', weather: 'clear', obj: 'all', size: [20, 15], slots: 8, mix: 'wz6 tank2 heli2 spg1', faction: 'orrin' }),
  S('c10m9', '核心', 'The Core', { theme: 'industrial', weather: 'night', obj: 'reach', size: [18, 14], mix: 'wz8 aa1', faction: 'orrin' }),
  S('c10m10', '鋼魂', 'Iron Souls', { theme: 'industrial', weather: 'dusk', obj: 'boss', size: [20, 15], slots: 8, mix: 'wz4 tank1 heli1', boss: { pilot: 'halden', role: 'rail', tierUp: 1, lvUp: 6 }, named: [{ pilot: 'proto', role: 'heavy' }], faction: 'orrin' }),
];

// the machines new squad members bring with them (tiers are the campaign's at the time they join)
export const JOINERS = {
  lena: { pilot: 'lena', body: 'B4', armL: 'A4', armR: 'A4', legs: 'L4', wL: null, wR: 'RF2', sh: null },
  duke: { pilot: 'duke', body: 'B3', armL: 'A3', armR: 'A3', legs: 'L3', wL: 'SH2', wR: 'MG2', sh: 'MS1' },
  sora: { pilot: 'sora', body: 'H-heli2', legs: 'D-rotor2', armR: 'M-turret2', armL: 'M-pylon2', wR: 'W-chaingun1', wL: 'W-rocketpod1', sh: 'W-atgm1' },
  greta: { pilot: 'greta', body: 'H-tank3', legs: 'D-tracks3', armR: 'M-turret3', armL: 'M-pylon3', wR: 'W-cannon2', wL: 'W-mg3', sh: null },
  pip: { pilot: 'pip', body: 'B-KA3', armL: 'A-KA3', armR: 'A-KA3', legs: 'L-KA3', wR: 'W-smg3', wL: 'W-blade2', sh: 'W-rocket3' },
  ivo: { pilot: 'ivo', body: 'H-spg3', legs: 'D-tracks3', armR: 'M-turret3', armL: 'M-pylon3', wR: 'W-hmg2', wL: null, sh: 'W-howitzer1' },
  anya: { pilot: 'anya', body: 'B-KA6', armL: 'A-KA6', armR: 'A-KA6', legs: 'L-KA6', wR: 'W-sniper5', wL: 'W-shieldL5', sh: 'W-missile6', acc: 'X-sensor5' },
  tomas: { pilot: 'tomas', body: 'H-aa7', legs: 'D-wheels6', armR: 'M-turret6', armL: 'M-pylon6', wR: 'W-flak5', wL: 'W-mg7', sh: 'W-sam4', acc: 'X-plate6' },
  hound: { pilot: 'hound', body: 'B-GH9', armL: 'A-GH9', armR: 'A-GH9', legs: 'L-KA9', wR: 'W-hmg8', wL: 'W-axe8', sh: 'W-hmissile7', acc: 'X-servo8', paint: 'black' },
};
// how hard a mission is, from its place in the campaign
export function scaleOf(i) {
  const ch = Math.min(9, Math.floor(i / 10));
  return { ch, tier: Math.min(10, 1 + ch), lv: 1 + Math.round(i * 0.2), reward: Math.round((3000 * Math.pow(1.36, ch) * (1 + (i % 10) * 0.05)) / 100) * 100 };
}
// the whole list, in order: the drawn missions first, then the built ones
export const CAMPAIGN = [
  ...FIRST.map((m, i) => ({ ...m, ch: 0, drawn: true, ...(i === 2 ? { joinBefore: ['lena'] } : i === 4 ? { joinBefore: ['duke'] } : {}) })),
  ...SPECS.map((m, k) => { const i = FIRST.length + k, sc = scaleOf(i); return { ch: sc.ch, tier: sc.tier, lv: sc.lv, reward: sc.reward, seed: 1000 + i * 37, size: m.size || [14 + Math.min(4, sc.ch), 11 + Math.min(3, Math.floor(sc.ch / 2))], slots: m.slots || (sc.ch >= 2 ? 7 : 6), ...m }; }),
];
// a patrol: an extra fight, built fresh each time, as hard as where the campaign stands
export function patrol(mi, n) {
  const i = Math.max(0, Math.min(CAMPAIGN.length - 1, mi)), sc = scaleOf(i), seed = 50000 + mi * 101 + n * 7919;
  const themes = ['plains', 'forest', 'hills', 'city', 'snow', 'desert', 'river', 'industrial', 'coast', 'mountain'], objs = ['all', 'all', 'destroy', 'survive', 'reach'];
  const th = themes[seed % themes.length], obj = objs[(seed >> 3) % objs.length], wx = ['clear', 'dusk', 'rain', 'night', 'fog'][(seed >> 5) % 5];
  const mix = sc.ch >= 2 ? `wz${4 + (seed % 3)} ${['tank1', 'heli1', 'apc1 heli1', 'tank1 spg1'][seed % 4]}` : `wz${4 + (seed % 2)}`;
  return { id: 'patrol', patrol: true, zh: '巡邏任務', en: 'Patrol', ch: sc.ch, tier: sc.tier, lv: Math.max(1, sc.lv - 1), reward: Math.round(sc.reward * 0.45 / 100) * 100, seed, size: [14, 11], slots: 6,
    theme: th, weather: th === 'snow' ? 'snow' : th === 'desert' && wx === 'rain' ? 'sand' : wx, obj, turns: 6, targets: 3, mix, reinf: obj === 'survive' ? [[2, 'wz2'], [4, 'wz2']] : [], faction: sc.ch >= 6 ? 'orrin' : 'alliance' };
}
