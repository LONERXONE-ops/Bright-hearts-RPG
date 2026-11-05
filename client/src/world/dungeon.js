// Procedural side-view dungeon: a start hall, 5-8 combat chambers (picked from a pool
// of 12 templates) and the fixed Boss Arena, chained left to right. Each chamber is
// sealed by a thorn gate that opens when its enemies are cleared.
import { rng } from '../art/pix.js';
import { blankMap, setG, getG, fillRect, backRect, platform } from './maps.js';

export const DUNGEONS = {
  ruins: { name: 'Overgrown Ruins', theme: 'ruins', boss: 'hydra', set: 'viper', level: 1, unlocked: true },
  crypt: { name: "Knight's Crypt", theme: 'crypt', boss: 'armor', level: 10, unlocked: false },
  magma: { name: 'Magma Caverns', theme: 'magma', boss: 'dragon', level: 20, unlocked: false },
};

export const DIFFICULTY = {
  normal: { name: 'Normal', hp: 1, atk: 1, minLevel: 1 },
  nightmare: { name: 'Nightmare', hp: 2.4, atk: 1.8, minLevel: 12 },
  hell: { name: 'Hell', hp: 5, atk: 3.2, minLevel: 22 },
};

// party bracket scaling (guide section 10)
export function bracket(size) {
  if (size <= 1) return { hp: 1, poise: 1, mobs: 1, name: 'Solo', bossTurn: 0.6 };
  if (size <= 3) return { hp: 2.2, poise: 2, mobs: 1.25, name: 'Small Squad', bossTurn: 1 };
  if (size <= 6) return { hp: 4.5, poise: 3.8, mobs: 1.6, name: 'Mid Party', bossTurn: 1 };
  return { hp: 8, poise: 6.5, mobs: 2, name: 'Full Guild Raid', bossTurn: 1, bossAoe: 1.2 };
}

const H = 17, G = 14; // map height, floor row
const RW = 30;        // chamber width

// Each template sculpts a chamber in [ox, ox+RW) and returns its enemy mix.
// add.spot(x) gives a standing y for column x.
const TEMPLATES = {
  courtyard(m, ox, r, add) {
    platform(m, ox + 5, ox + 10, G - 4); platform(m, ox + 19, ox + 24, G - 4); platform(m, ox + 12, ox + 17, G - 7);
    add.prop('pillar', ox + 3, G, { bg: true }); add.prop('pillar', ox + 26, G, { bg: true, broken: true });
    add.brk(ox + 14, G - 7, 'chest'); add.brk(ox + 8, G); add.brk(ox + 22, G);
    return ['viper', 'viper', 'spitter'];
  },
  pond(m, ox, r, add) {
    fillRect(m, ox + 9, G, ox + 20, G + 1, '.'); add.pool(ox + 9, ox + 20, G + 1);
    platform(m, ox + 11, ox + 13, G - 2); platform(m, ox + 16, ox + 18, G - 2);
    add.prop('fern', ox + 6, G); add.prop('fern', ox + 23, G);
    add.brk(ox + 4, G); add.brk(ox + 25, G);
    return ['spitter', 'viper', 'viper'];
  },
  colonnade(m, ox, r, add) {
    for (let i = 0; i < 4; i++) platform(m, ox + 4 + i * 6, ox + 7 + i * 6, G - 3 - (i % 2) * 3);
    for (const x of [6, 12, 18, 24]) add.prop('pillar', ox + x, G, { bg: true, broken: r() < 0.4 });
    add.brk(ox + 20, G - 6); add.brk(ox + 10, G);
    return ['viper', 'spitter', 'tortoise'];
  },
  garden(m, ox, r, add) {
    fillRect(m, ox + 11, G - 1, ox + 18, G - 1, '#');
    platform(m, ox + 4, ox + 8, G - 4); platform(m, ox + 21, ox + 25, G - 4);
    add.prop('jtree', ox + 6, G, { bg: true }); add.prop('jtree', ox + 23, G, { bg: true });
    for (const x of [9, 14, 20]) add.prop('bush', ox + x, x === 14 ? G - 1 : G);
    return ['mandrake', 'viper', 'viper', 'spitter'];
  },
  toxic(m, ox, r, add) {
    for (const x of [7, 15, 23]) add.hazard('poison', ox + x, G, 1.4);
    platform(m, ox + 3, ox + 6, G - 3); platform(m, ox + 11, ox + 13, G - 5); platform(m, ox + 18, ox + 20, G - 3); platform(m, ox + 24, ox + 27, G - 5);
    add.brk(ox + 12, G - 5); add.brk(ox + 25, G - 5);
    return ['spitter', 'spitter', 'viper', 'mandrake'];
  },
  shrine(m, ox, r, add) {
    fillRect(m, ox + 12, G - 2, ox + 17, G - 1, '#');
    platform(m, ox + 13, ox + 16, G - 6);
    add.brk(ox + 14.5, G - 6, 'chest');
    add.prop('statue', ox + 5, G, { bg: true }); add.prop('statue', ox + 24, G, { bg: true });
    add.light(ox + 8, G); add.light(ox + 21, G);
    return ['tortoise', 'viper', 'mandrake'];
  },
  rubble(m, ox, r, add) {
    fillRect(m, ox + 7, G - 2, ox + 9, G - 1, '#'); fillRect(m, ox + 18, G - 3, ox + 20, G - 1, '#'); fillRect(m, ox + 13, G - 1, ox + 14, G - 1, '#');
    add.prop('rubble', ox + 4, G); add.prop('rubble', ox + 25, G);
    add.brk(ox + 8, G - 2); add.brk(ox + 19, G - 3); add.brk(ox + 24, G);
    return ['viper', 'viper', 'spitter', 'tortoise'];
  },
  moat(m, ox, r, add) {
    fillRect(m, ox + 6, G, ox + 23, G + 1, '.'); add.pool(ox + 6, ox + 23, G + 1);
    platform(m, ox + 6, ox + 23, G - 2);
    add.brk(ox + 15, G - 2, 'chest');
    return ['spitter', 'tortoise', 'viper'];
  },
  overgrowth(m, ox, r, add) {
    for (let i = 0; i < 6; i++) platform(m, ox + 2 + i * 4 + Math.floor(r() * 2), ox + 4 + i * 4, G - 3 - Math.floor(r() * 4));
    for (const x of [5, 11, 17, 23]) add.prop('fern', ox + x, G);
    add.prop('jtree', ox + 27, G, { bg: true });
    add.brk(ox + 9, G); add.brk(ox + 20, G);
    return ['mandrake', 'mandrake', 'viper'];
  },
  cistern(m, ox, r, add) {
    fillRect(m, ox + 4, G - 2, ox + 9, G - 1, '#'); fillRect(m, ox + 20, G - 2, ox + 25, G - 1, '#');
    platform(m, ox + 12, ox + 17, G - 5);
    for (const x of [6, 8, 22, 24]) add.brk(ox + x, G - 2);
    add.brk(ox + 14, G - 5);
    return ['spitter', 'spitter', 'viper'];
  },
  den(m, ox, r, add) {
    for (const x of [6, 14, 22]) fillRect(m, ox + x, G - 1, ox + x + 1, G - 1, '#');
    add.prop('rubble', ox + 10, G); add.prop('rubble', ox + 18, G);
    platform(m, ox + 9, ox + 12, G - 5); platform(m, ox + 17, ox + 20, G - 5);
    return ['tortoise', 'tortoise', 'viper'];
  },
  nest(m, ox, r, add) {
    platform(m, ox + 3, ox + 12, G - 4); platform(m, ox + 17, ox + 26, G - 4);
    for (let i = 0; i < 6; i++) add.brk(ox + 4 + i * 4, i % 2 ? G - 4 : G);
    return ['viper', 'viper', 'viper', 'viper', 'spitter'];
  },
};

export function generateDungeon(seed, dungeonKey = 'ruins', partySize = 1) {
  const r = rng(seed);
  const info = DUNGEONS[dungeonKey];
  const br = bracket(partySize);
  const nRooms = 5 + Math.floor(r() * 4);
  const START_W = 20, BOSS_W = 38;
  const W = START_W + nRooms * RW + BOSS_W + 2;
  const m = blankMap('dungeon', info.theme, W, H);
  m.dungeon = dungeonKey;
  m.seed = seed;
  fillRect(m, 0, G, W - 1, H - 1, '#');
  fillRect(m, 0, 0, W - 1, 1, '#');
  fillRect(m, 0, 0, 1, H - 1, '#'); fillRect(m, W - 2, 0, W - 1, H - 1, '#');
  backRect(m, 2, 2, W - 3, G + 1);
  // crumbling holes in the back wall reveal the jungle beyond
  for (let x = 6; x < W - 10; x += 9 + Math.floor(r() * 8)) {
    const w = 4 + Math.floor(r() * 5), top = 2 + Math.floor(r() * 2), bot = top + 3 + Math.floor(r() * 4);
    for (let y = top; y <= bot; y++) for (let k = 0; k < w; k++) {
      const edge = (k === 0 || k === w - 1) && r() < 0.5;
      if (!edge) m.back[y][x + k] = 0;
    }
  }
  let eid = 1, bid = 1;
  const pool = Object.keys(TEMPLATES).sort(() => r() - 0.5);

  const makeAdd = (roomIndex) => ({
    prop: (t, x, y, o = {}) => m.props.push({ t, x, y, ...o }),
    brk: (x, y, t) => m.breakables.push({ id: bid++, t: t || (r() < 0.45 ? 'jar' : r() < 0.6 ? 'crate' : 'totem'), x, y, room: roomIndex }),
    hazard: (t, x, y, rad) => m.hazards.push({ t, x, y, r: rad }),
    pool: (x0, x1, y) => m.pools.push({ x0, x1: x1 + 1, y }),
    light: (x, y) => { m.props.push({ t: 'brazier', x, y }); m.lights.push({ x, y: y - 2.4, color: 0xff9a40, r: 90, i: 0.9, flicker: 0.18 }); },
  });
  const wallWithDoor = (x) => { fillRect(m, x, 2, x + 1, G - 4, '#'); };

  // ---- start hall
  const start = { i: 0, kind: 'start', x0: 2, x1: START_W - 1, cleared: true, enemies: [] };
  m.rooms.push(start);
  m.props.push({ t: 'portal', x: 5, y: G });
  m.interacts.push({ x: 5, y: G, r: 1.6, kind: 'leave', label: 'Return to Village' });
  m.lights.push({ x: 5, y: G - 3, color: 0xd36cff, r: 100, i: 0.8, flicker: 0.1 });
  makeAdd(0).light(10, G); makeAdd(0).light(16, G);
  m.breakables.push({ id: bid++, t: 'jar', x: 13, y: G, room: 0 });
  m.spawn = { x: 8, y: G };
  wallWithDoor(START_W - 1);
  start.gate = null;

  // ---- combat chambers
  let ox = START_W + 1;
  for (let i = 1; i <= nRooms; i++) {
    const room = { i, kind: 'room', x0: ox, x1: ox + RW - 2, cleared: false, enemies: [] };
    const key = pool[(i - 1) % pool.length];
    room.template = key;
    const add = makeAdd(i);
    const mix = TEMPLATES[key](m, ox, r, add);
    if (r() < 0.7) add.light(ox + 2, G);
    if (r() < 0.6) add.light(ox + RW - 4, G);
    const budget = Math.round((3 + i * 0.7) * br.mobs);
    for (let k = 0; k < budget; k++) {
      const t = mix[k % mix.length];
      const x = ox + 4 + r() * (RW - 9);
      const e = { id: eid++, t, x, y: 3, room: i, drop: true };
      m.enemies.push(e);
      room.enemies.push(e.id);
    }
    m.rooms.push(room);
    // the doorway into this chamber is sealed until the PREVIOUS chamber is cleared
    const wallX = ox + RW - 1;
    wallWithDoor(wallX);
    room.gate = { tiles: [[wallX, G - 3], [wallX, G - 2], [wallX, G - 1], [wallX + 1, G - 3], [wallX + 1, G - 2], [wallX + 1, G - 1]], x: wallX + 1 };
    ox += RW + 1;
  }

  // ---- boss arena
  const arena = { i: nRooms + 1, kind: 'boss', x0: ox, x1: W - 3, cleared: false, enemies: [] };
  platform(m, ox + 5, ox + 10, G - 4); platform(m, ox + 13, ox + 17, G - 7);
  for (const x of [3, 12, 21, 30]) m.props.push({ t: 'pillar', x: ox + x, y: G, bg: true, broken: x % 2 === 0 });
  const add = makeAdd(arena.i);
  add.light(ox + 2, G); add.light(ox + 20, G); add.light(W - 4, G);
  m.boss = { id: eid++, t: info.boss, x: W - 10, y: G, room: arena.i };
  arena.enemies.push(m.boss.id);
  m.rooms.push(arena);
  m.bossRoom = arena;
  m.ambient = { dark: 0.5, ambientColor: 0x6a8a80, parallax: 'ruins', particles: 'fireflies', vignette: 0.6, music: 'ruins' };
  m.difficultyTag = info.name;
  return m;
}

export { getG, setG };
