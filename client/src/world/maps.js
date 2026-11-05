// Side-view hub maps. Coordinates are in 16px tiles; x grows right, y grows DOWN.
// An entity's (x, y) is its feet. ground codes: '.' air, '#' solid, 'c' cobble (solid), '=' one-way platform.
import { R } from '../art/palette.js';
import { NPC_LOOKS } from '../art/chars.js';

export function blankMap(key, theme, w, h) {
  const ground = [], back = [];
  for (let y = 0; y < h; y++) { ground.push(new Array(w).fill('.')); back.push(new Array(w).fill(0)); }
  return {
    key, theme, w, h, ground, back,
    props: [], buildings: [], npcs: [], lights: [], exits: [], interacts: [],
    enemies: [], breakables: [], hazards: [], pools: [], rooms: [], critters: [],
    spawn: { x: 4, y: h - 4 }, ambient: {},
  };
}
export function setG(m, x, y, c) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.ground[y][x] = c; }
export function getG(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.ground[y][x] : '#'; }
export function fillRect(m, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x < x1 + 1; x++) setG(m, x, y, c); }
export function backRect(m, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.back[y][x] = 1; }
export function platform(m, x0, x1, y) { for (let x = x0; x <= x1; x++) if (getG(m, x, y) === '.') setG(m, x, y, '='); }
// surface y (top of the ground) at column x, scanning down from y0
export function surfaceY(m, x, y0 = 0) {
  for (let y = Math.max(0, y0); y < m.h; y++) { const g = getG(m, Math.floor(x), y); if (g !== '.') return y; }
  return m.h - 1;
}

/* ============================ VILLAGE ============================ */

export function buildVillage() {
  const W = 124, H = 16, G = 14;
  const m = blankMap('village', 'village', W, H);
  fillRect(m, 0, G, W - 1, H - 1, '#');
  fillRect(m, 0, 0, 1, H - 1, '#'); fillRect(m, W - 2, 0, W - 1, H - 1, '#');
  // cobbled market street through the middle of town
  fillRect(m, 30, G, 82, G, 'c');
  // raised hill on the way to the portal (a first jump)
  fillRect(m, 104, G - 1, W - 3, G - 1, '#');
  fillRect(m, 110, G - 2, W - 3, G - 2, '#');
  // a market balcony + crates to hop on
  platform(m, 44, 47, G - 3);
  platform(m, 96, 99, G - 3);

  const B = (id, x, w, h, cfg, label, seed) => m.buildings.push({ id, x, y: G, w, h, cfg: { w, h, ...cfg }, label, seed });
  B('castle', 3, 15, 9, { wall: 'castle', gate: true, crenel: true, windows: 3, banner: R.red, door: true }, "King's Castle", 3);
  B('guild', 20, 9, 5, { wall: 'plank', roof: R.roofRed, roofH: 20, windows: 2, banner: R.blue }, 'Adventurers Guild', 13);
  B('smith', 33, 7, 4, { wall: 'stone', roof: R.thatch, roofH: 18, forge: true, chimney: true, windows: 1, door: false }, 'Blacksmith', 5);
  B('store', 57, 8, 5, { wall: 'plaster', roof: R.roofRed, roofH: 20, windows: 2, awning: R.red, sign: R.gold[4] }, 'Village Store', 7);
  B('tavern', 69, 10, 5, { wall: 'plaster', roof: R.roofSlate, roofH: 22, windows: 3, chimney: true, sign: R.orange[4] }, 'Tavern', 11);
  B('enchanter', 84, 5, 9, { wall: 'stone', roof: R.roofPurple, roofH: 26, windows: 2, tower: true }, 'Enchanter', 9);
  B('house1', 91, 6, 4, { wall: 'plaster', roof: R.thatch, roofH: 16, windows: 1, chimney: true }, null, 15);

  const P = (t, x, o = {}) => m.props.push({ t, x, y: o.y ?? G, ...o });
  P('board', 30); P('anvil', 41); P('barrel', 42.6); P('rack', 31.6);
  P('fountain', 51);
  P('stall', 66, { ramp: R.red });
  P('crate', 45); P('crate', 46.1); P('crate', 45.5, { y: G - 1 });
  P('barrel', 80); P('barrel', 81.1);
  P('portal', 116, { y: G - 2 });
  m.critters = [{ t: 'chicken', x: 24 }, { t: 'chicken', x: 26 }, { t: 'chicken', x: 100 }];
  for (const x of [19, 32, 48, 56, 68, 83, 101, 113]) { P('lamp', x); m.lights.push({ x, y: G - 2.1, color: 0xffc46b, r: 70, i: 0.55, flicker: 0.05 }); }
  for (const [x, s] of [[2.5, 1], [29, 2], [55, 3], [90, 4], [103, 5], [108, 6], [121, 7]]) P('tree', x, { seed: s, bg: true, y: x > 104 ? (x > 110 ? G - 2 : G - 1) : G });
  for (const [x, f] of [[19.5, '#ffb3c8'], [43, null], [67.8, '#ffe27a'], [92, null], [106, '#a9d8ff']]) P('bush', x, { flowers: f, y: x > 104 ? G - 1 : G });
  for (let x = 22; x < 28; x += 2) P('fence', x + 1);

  const N = (id, name, look, x, role, line, o = {}) => m.npcs.push({ id, name, look, x, y: G, role, line, ...o });
  N('guild', 'Captain Rhea', NPC_LOOKS.guild, 29, 'guild', 'Bounties pay Gold and XP. Party up at the portal at the end of the road and show those ruins who is boss.', { pack: 'banner' });
  N('smith', 'Brann the Smith', NPC_LOOKS.smith, 39.5, 'blacksmith', 'Steel never breaks for good, friend. Bring me your scraps and I will forge them into Ingots.');
  N('merchant', 'Mira', NPC_LOOKS.merchant, 64, 'store', 'Vials, tonics, charms! Sell me your Treasures too, I pay top Gold.');
  N('barkeep', 'Gus', NPC_LOOKS.barkeep, 78, 'tavern', 'A full belly wins a raid. One meal per run, and it is lost if your party wipes!');
  N('enchanter', 'Old Ysolde', NPC_LOOKS.enchanter, 89.5, 'enchanter', 'Gold and Ingots can whisper power into steel. Shall we roll some perks?');
  // adventurers from the asset pack hanging around town
  N('adv1', 'Sir Kael', null, 53.5, 'flavor', 'The snakes in the ruins hate fire. Just saying.', { pack: 'npc_warrior' });
  N('adv2', 'Wren', null, 49, 'flavor', 'Jump onto ledges to dodge the tail sweep. Trust me.', { pack: 'npc_mage', flip: true });
  N('adv3', 'Dusty', null, 74, 'flavor', 'Hit them from behind and their armor cracks.', { pack: 'npc_gunman' });
  N('adv4', 'Cog', null, 36.5, 'flavor', 'Crates and jars give Scrap. Engineers need lots of it!', { pack: 'npc_engineer' });
  N('adv5', 'Thorn', null, 101, 'flavor', 'Beyond that hill is the portal. Bring vials.', { pack: 'npc_savage', y: G });
  for (const x of [8, 13]) N('guardx' + x, 'Royal Guard', null, x, 'guard', 'For the Crown!', { pack: 'guardian' });

  m.exits.push({ x: 10.5, y: G, r: 1.4, to: 'castle', label: "Enter the King's Castle", door: true });
  m.interacts.push({ x: 116, y: G - 2, r: 2, kind: 'portal', label: 'Dungeon Portal' });
  m.interacts.push({ x: 30, y: G, r: 1.4, kind: 'guild', label: 'Guild Board' });
  m.lights.push({ x: 116, y: G - 3.5, color: 0xd36cff, r: 110, i: 0.8, flicker: 0.12 });
  m.lights.push({ x: 34.5, y: G - 1, color: 0xff8a2b, r: 80, i: 0.7, flicker: 0.2 });
  m.spawn = { x: 50, y: G };
  m.ambient = { dark: 0, parallax: 'village', particles: 'petals', vignette: 0.35, music: 'village' };
  return m;
}

/* ============================ CASTLE ============================ */

export function buildCastle() {
  const W = 64, H = 15, G = 13;
  const m = blankMap('castle', 'castle', W, H);
  fillRect(m, 0, G, W - 1, H - 1, '#');
  fillRect(m, 0, 0, W - 1, 1, '#');
  fillRect(m, 0, 0, 1, H - 1, '#'); fillRect(m, W - 2, 0, W - 1, H - 1, '#');
  backRect(m, 2, 2, W - 3, G - 1);
  // throne dais: stone steps you jump up
  fillRect(m, 50, G - 1, W - 3, G - 1, '#');
  fillRect(m, 53, G - 2, W - 3, G - 2, '#');
  platform(m, 20, 25, G - 4); platform(m, 34, 39, G - 4); // balconies
  const P = (t, x, o = {}) => m.props.push({ t, x, y: o.y ?? G, ...o });
  P('throne', 58, { y: G - 2 });
  for (const x of [8, 16, 30, 44]) { P('glass', x, { y: G - 5, bg: true }); }
  for (const x of [12, 24, 36, 48]) { P('cpillar', x, { bg: true }); }
  for (const x of [6, 18, 28, 40]) P('wbanner_crown', x, { y: G - 6, bg: true });
  for (const x of [10, 22, 34, 46, 56]) { P('candelabra', x, { y: x === 56 ? G - 2 : G }); m.lights.push({ x, y: (x === 56 ? G - 2 : G) - 2.2, color: 0xffcf6b, r: 64, i: 0.7, flicker: 0.12 }); }
  P('rack', 27); P('rack', 41);
  const N = (id, name, look, x, role, line, o = {}) => m.npcs.push({ id, name, look, x, y: G, role, line, ...o });
  N('king', 'King Aldric', NPC_LOOKS.king, 58, 'king', 'Brave heart, the ruins swarm with serpents. Serve the Crown and you shall earn a Mastery Seal.', { y: G - 2 });
  N('advisor', 'Advisor Corwin', NPC_LOOKS.advisor, 54.5, 'advisor', "Royal Decrees are personal milestones. King's Crusades are fought with your party.", { y: G - 2, flip: true });
  for (const x of [15, 31, 45]) N('guard' + x, 'Royal Guard', null, x, 'guard', 'For the Crown!', { pack: 'guardian' });
  m.exits.push({ x: 3.5, y: G, r: 1.2, to: 'village', label: 'Return to the Village', door: true });
  P('door', 3.5);
  m.lights.push({ x: 58, y: G - 5, color: 0xffe0a0, r: 130, i: 0.6, flicker: 0.03 });
  m.spawn = { x: 6, y: G };
  m.ambient = { dark: 0.4, ambientColor: 0x8a7a9a, parallax: 'castle', particles: 'dust', vignette: 0.55, music: 'castle' };
  return m;
}
