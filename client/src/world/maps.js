// Hand-built hub maps: the Village Square and the King's Castle throne room.
import { R } from '../art/palette.js';
import { NPC_LOOKS } from '../art/chars.js';
import { noise2 } from '../art/pix.js';

export function blankMap(key, theme, w, h, fill = '.') {
  const ground = [];
  for (let y = 0; y < h; y++) ground.push(new Array(w).fill(fill));
  return {
    key, theme, w, h, ground,
    walls: new Map(), props: [], buildings: [], npcs: [], lights: [], exits: [], interacts: [],
    enemies: [], breakables: [], hazards: [], rooms: [],
    spawn: { x: w / 2, y: h / 2 }, ambient: {},
  };
}

export function setG(m, x, y, c) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.ground[y][x] = c; }
export function getG(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.ground[y][x] : '.'; }
export function fillRect(m, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setG(m, x, y, c); }
export function addWall(m, x, y) { m.walls.set(x + ',' + y, 1); setG(m, x, y, 'W'); }

/* ============================ VILLAGE ============================ */

export function buildVillage() {
  const W = 32, H = 32;
  const m = blankMap('village', 'village', W, H);
  // island of grass with ragged edges
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ex = Math.min(x, W - 1 - x), ey = Math.min(y, H - 1 - y);
    const edge = Math.min(ex, ey);
    const n = noise2(x / 3, y / 3, 41);
    if (edge >= 1 || (edge === 0 && n > 0.62)) setG(m, x, y, n > 0.7 && edge > 3 ? 'y' : 'g');
  }
  fillRect(m, 10, 0, 21, 2, 'c'); // castle forecourt
  // north road (castle -> plaza -> portal) and east-west road
  for (let y = 3; y <= 29; y++) { setG(m, 15, y, 'c'); setG(m, 16, y, 'c'); if (y > 4 && y < 28 && noise2(0, y, 3) > 0.6) setG(m, 17, y, 'd'); }
  for (let x = 2; x <= 29; x++) { setG(m, x, 15, 'c'); setG(m, x, 16, 'c'); if (noise2(x, 0, 5) > 0.65) setG(m, x, 17, 'd'); }
  // plaza disk
  for (let y = 10; y <= 21; y++) for (let x = 10; x <= 21; x++) {
    const d = Math.hypot(x - 15.5, y - 15.5);
    if (d < 4.8) setG(m, x, y, 'c');
    else if (d < 5.6 && getG(m, x, y) === 'g') setG(m, x, y, 'd');
  }
  // dirt yards
  fillRect(m, 4, 12, 9, 13, 'd');
  fillRect(m, 3, 17, 9, 21, 'd'); // farm patch (chickens)
  fillRect(m, 21, 11, 26, 13, 'd'); // market ground
  // pond
  for (let y = 22; y <= 27; y++) for (let x = 25; x <= 29; x++) if (Math.hypot((x - 27) * 1.1, y - 24.5) < 2.4) setG(m, x, y, 'p');
  // plank deck by tavern
  fillRect(m, 21, 23, 24, 24, 'f');

  // ---- buildings ----
  const B = (id, x, y, cfg, label, seed) => m.buildings.push({ id, x, y, cfg, label, seed });
  B('castle', 11, 0, { w: 10, d: 2, H: 46, roof: 'crenel', wall: 'castle', gate: true, doorAt: 5, windows: 4, banner: R.red }, "King's Castle", 3);
  B('smith', 5, 9, { w: 3, d: 3, H: 22, roof: 'gable', roofRamp: R.thatch, wall: 'stone', forge: true, chimney: true, windows: 1, roofH: 16 }, 'Blacksmith', 5);
  B('store', 22, 7, { w: 3, d: 3, H: 24, roof: 'gable', roofRamp: R.roofRed, wall: 'plaster', windows: 3, shingle: true, roofH: 16 }, 'Village Store', 7);
  B('enchanter', 5, 21, { w: 2, d: 2, H: 38, roof: 'pyramid', roofRamp: R.roofPurple, wall: 'stone', windows: 2, roofH: 26 }, 'Enchanter', 9);
  B('tavern', 20, 19, { w: 4, d: 3, H: 26, roof: 'gable', roofRamp: R.roofSlate, wall: 'plaster', windows: 4, chimney: true, shingle: true, roofH: 18 }, 'Tavern', 11);
  B('guild', 3, 3, { w: 4, d: 3, H: 24, roof: 'gable', roofRamp: R.roofRed, wall: 'plank', windows: 3, banner: R.blue, roofH: 16 }, 'Adventurers Guild', 13);
  B('house1', 25, 2, { w: 3, d: 2, H: 20, roof: 'gable', roofRamp: R.thatch, wall: 'plaster', windows: 2, chimney: true, roofH: 14 }, null, 15);
  B('house2', 10, 25, { w: 3, d: 2, H: 20, roof: 'gable', roofRamp: R.roofRed, wall: 'plaster', windows: 2, roofH: 14 }, null, 17);
  B('house3', 2, 26, { w: 2, d: 2, H: 18, roof: 'gable', roofRamp: R.thatch, wall: 'plank', windows: 1, roofH: 12 }, null, 19);

  // ---- props ----
  const P = (t, x, y, o = {}) => m.props.push({ t, x, y, ...o });
  P('fountain', 16, 16, { solid: [[15, 15], [16, 15], [15, 16], [16, 16]] });
  P('board', 12.5, 11.3, { solid: [[12, 11]] });
  P('portal', 16, 29.4, { solid: [] });
  P('anvil', 8.6, 12.4, { solid: [[8, 12]] });
  P('rack', 4.4, 12.6, { solid: [[4, 12]] });
  P('barrel', 8.5, 9.4, { solid: [[8, 9]] });
  P('stall', 21.6, 12.2, { ramp: R.red, solid: [[21, 12], [21, 11]] });
  P('stall', 25.2, 12.6, { ramp: R.blue, solid: [[25, 12], [25, 11]] });
  P('barrel', 26.5, 9.5, { solid: [[26, 9]] });
  P('barrel', 25.4, 23.4, { solid: [[25, 23]] });
  P('barrel', 20.4, 22.6, { solid: [[20, 22]] });
  for (const [x, y] of [[13.2, 6], [18.8, 6], [13.2, 24], [18.8, 24], [7, 14.2], [24.5, 14.2], [24.5, 17.8], [7, 17.8]]) {
    P('lamp', x, y, { solid: [[Math.floor(x), Math.floor(y)]] });
    m.lights.push({ x, y: y - 0.01, z: 34, color: 0xffc46b, r: 70, i: 0.55, flicker: 0.05 });
  }
  // farm fence + chickens
  for (let x = 3; x <= 9; x++) { P('fence', x + 0.5, 21.6, { dir: 'x', solid: [[x, 21]] }); }
  for (let y = 17; y <= 21; y++) P('fence', 9.6, y + 0.5, { dir: 'y', solid: [[9, y]] });
  m.critters = [{ t: 'chicken', x: 5, y: 18.5 }, { t: 'chicken', x: 7, y: 19.5 }, { t: 'chicken', x: 4.5, y: 20.2 }, { t: 'chicken', x: 8, y: 18 }];
  // trees + bushes along the rim
  let s = 1;
  const treeSpots = [[1.5, 8], [1.5, 12], [2.2, 20], [1, 23], [4.5, 29.5], [8, 30.2], [20, 29.6], [23, 30], [29.8, 6], [30.2, 10], [29.6, 15], [30, 19], [29.5, 29], [9, 1.5], [6.5, 1.2], [23, 1.2], [29.2, 1.8], [13, 29], [27, 18], [12.5, 20.5], [19.5, 10.5]];
  for (const [x, y] of treeSpots) {
    if (getG(m, Math.floor(x), Math.floor(y)) === '.') continue;
    P('tree', x, y, { seed: s++, blossom: s % 4 === 0, fruit: s % 5 === 0, solid: [[Math.floor(x), Math.floor(y)]] });
  }
  for (const [x, y, f] of [[10.5, 8.5, '#ffb3c8'], [20.8, 8.4, '#ffe27a'], [2.5, 15, null], [27.5, 20.5, '#a9d8ff'], [12, 27.6, '#ffb3c8'], [18.6, 27.5, null], [26, 26.8, null], [11.8, 19.6, '#ffe27a'], [19.6, 12.3, null]]) P('bush', x, y, { flowers: f, seed: s++ });
  for (const [x, y] of [[24.2, 27.4], [28.6, 22.4], [29.4, 26.4]]) P('fern', x, y, { seed: s++ });
  P('rock', 2.5, 18.2, { seed: 1 }); P('rock', 28.5, 12.4, { seed: 2 });

  // ---- NPCs ----
  const N = (id, name, look, x, y, role, line, flip = false) => m.npcs.push({ id, name, look, x, y, role, line, flip });
  N('smith', 'Brann the Smith', NPC_LOOKS.smith, 7.8, 13.0, 'blacksmith', 'Steel never breaks for good, friend. Bring me your scraps and I will forge them into Ingots.');
  N('merchant', 'Mira', NPC_LOOKS.merchant, 23.6, 11.4, 'store', 'Vials, tonics, charms! Sell me your Treasures too, I pay top Gold.');
  N('enchanter', 'Old Ysolde', NPC_LOOKS.enchanter, 7.6, 23.6, 'enchanter', 'Gold and Ingots can whisper power into steel. Shall we roll some perks?');
  N('barkeep', 'Gus', NPC_LOOKS.barkeep, 22.5, 22.8, 'tavern', 'A full belly wins a raid. One meal per run, and it is lost if your party wipes!', true);
  N('guild', 'Captain Rhea', NPC_LOOKS.guild, 13.4, 12.6, 'guild', 'Bounties pay Gold and XP. Party up at the portal and show those ruins who is boss.');
  m.wanderers = [
    { look: NPC_LOOKS.villagerA, x: 18, y: 18, name: 'Tomas' },
    { look: NPC_LOOKS.villagerB, x: 13, y: 19, name: 'Lila' },
    { look: NPC_LOOKS.villagerC, x: 19, y: 13, name: 'Oren' },
  ];
  // ---- exits + interactables ----
  m.exits.push({ x: 16, y: 2.4, r: 0.9, to: 'castle', label: "Enter the King's Castle" });
  m.interacts.push({ x: 16, y: 28.6, r: 1.6, kind: 'portal', label: 'Dungeon Portal' });
  m.interacts.push({ x: 12.5, y: 12, r: 1.3, kind: 'guild', label: 'Guild Board' });
  m.lights.push({ x: 16, y: 29.4, z: 26, color: 0xd36cff, r: 110, i: 0.8, flicker: 0.12 });
  m.lights.push({ x: 8, y: 9, z: 6, color: 0xff8a2b, r: 80, i: 0.7, flicker: 0.2 }); // forge
  m.spawn = { x: 16.5, y: 20 };
  m.ambient = { dark: 0.0, tint: 0xfff2dc, particles: 'petals', rays: true, vignette: 0.45, music: 'village' };
  return m;
}

/* ============================ CASTLE ============================ */

export function buildCastle() {
  const W = 16, H = 26;
  const m = blankMap('castle', 'castle', W, H);
  fillRect(m, 1, 1, 14, 24, 's');
  for (let x = 0; x < W; x++) { addWall(m, x, 0); addWall(m, x, H - 1); }
  for (let y = 0; y < H; y++) { addWall(m, 0, y); addWall(m, W - 1, y); }
  // door gap in the front wall
  m.walls.delete('7,25'); m.walls.delete('8,25'); setG(m, 7, 25, 's'); setG(m, 8, 25, 's');
  // carpet runner + dais
  fillRect(m, 7, 4, 8, 25, 'r');
  fillRect(m, 5, 1, 10, 3, 'r');
  const P = (t, x, y, o = {}) => m.props.push({ t, x, y, ...o });
  P('throne', 8, 1.6, { solid: [[7, 1], [8, 1]] });
  for (const y of [5, 10, 15, 20]) {
    P('cpillar', 3.5, y + 0.5, { solid: [[3, y]] });
    P('cpillar', 12.5, y + 0.5, { solid: [[12, y]] });
  }
  for (const [x, y] of [[5.5, 4.5], [10.5, 4.5], [5.5, 12.5], [10.5, 12.5], [5.5, 21], [10.5, 21]]) {
    P('candelabra', x, y, { solid: [[Math.floor(x), Math.floor(y)]] });
    m.lights.push({ x, y, z: 30, color: 0xffcf6b, r: 64, i: 0.7, flicker: 0.12 });
  }
  // wall decor (banners on the back-right wall row y=0, stained glass on x=0 column)
  for (const x of [3, 6, 10, 13]) P('wbanner', x + 0.5, 0.98, { ramp: R.red, emblem: x % 2 ? 'crown' : 'heart', z: 26, wall: true });
  for (const y of [4, 9, 14, 19]) P('glass', 0.98, y + 0.5, { z: 26, wall: true });
  for (const y of [7, 17]) P('rack', 14.2, y + 0.5, { solid: [[14, y]] });
  const N = (id, name, look, x, y, role, line, flip = false) => m.npcs.push({ id, name, look, x, y, role, line, flip });
  N('king', 'King Aldric', NPC_LOOKS.king, 8, 2.2, 'king', 'Brave heart, the ruins swarm with serpents. Serve the Crown and you shall earn a Mastery Seal.');
  N('advisor', 'Advisor Corwin', NPC_LOOKS.advisor, 10, 2.6, 'advisor', 'Royal Decrees are personal milestones. King\'s Crusades are fought with your party.', true);
  for (const [x, y, f] of [[6.2, 8.5, false], [9.8, 8.5, true], [6.2, 16.5, false], [9.8, 16.5, true]]) N('guard', 'Royal Guard', NPC_LOOKS.guard, x, y, 'guard', 'For the Crown!', f);
  m.exits.push({ x: 8, y: 25.3, r: 1.1, to: 'village', label: 'Return to the Village' });
  m.lights.push({ x: 8, y: 1.5, z: 20, color: 0xffe0a0, r: 130, i: 0.6, flicker: 0.03 });
  m.spawn = { x: 8, y: 23 };
  m.ambient = { dark: 0.42, ambientColor: 0x7a6a8e, tint: 0xffe6cc, particles: 'dust', vignette: 0.55, music: 'castle' };
  return m;
}
