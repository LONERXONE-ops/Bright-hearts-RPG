// Procedural dungeon: stitches 5-8 room templates (from a pool of 12) into a chain of
// floating ruins connected by stone bridges, ending at a fixed Boss Arena.
import { rng } from '../art/pix.js';
import { blankMap, setG, getG, fillRect, addWall } from './maps.js';

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

const RS = 11;       // room interior size
const GAP = 4;       // bridge length between room blocks

function inCross(lx, ly, size) {
  const c = Math.floor(size / 2);
  return Math.abs(lx - c) <= 1 || Math.abs(ly - c) <= 1;
}

// Each template decorates a room. (ox, oy) = interior origin. Returns preferred enemy mix.
const TEMPLATES = {
  courtyard(m, ox, oy, r, add) {
    for (const [lx, ly] of [[2, 2], [8, 2], [2, 8], [8, 8]]) add.prop('pillar', ox + lx + 0.5, oy + ly + 0.5, { broken: r() < 0.5, solid: [[ox + lx, oy + ly]] });
    patch(m, ox, oy, 'g', r, 0.35);
    scatterBreakables(add, ox, oy, r, 4);
    return ['viper', 'viper', 'spitter'];
  },
  pond(m, ox, oy, r, add) {
    for (let ly = 2; ly <= 8; ly++) for (let lx = 2; lx <= 8; lx++) if (!inCross(lx, ly, RS)) setG(m, ox + lx, oy + ly, 'p');
    for (const [lx, ly] of [[1, 1], [9, 9], [1, 9], [9, 1]]) add.prop('fern', ox + lx + 0.5, oy + ly + 0.5, {});
    scatterBreakables(add, ox, oy, r, 2, true);
    return ['spitter', 'viper', 'viper'];
  },
  colonnade(m, ox, oy, r, add) {
    for (let i = 1; i <= 9; i += 2) {
      add.prop('pillar', ox + 3 + 0.5, oy + i + 0.5, { broken: r() < 0.35, solid: [[ox + 3, oy + i]] });
      add.prop('pillar', ox + 7 + 0.5, oy + i + 0.5, { broken: r() < 0.35, solid: [[ox + 7, oy + i]] });
    }
    scatterBreakables(add, ox, oy, r, 3);
    return ['viper', 'spitter', 'tortoise'];
  },
  garden(m, ox, oy, r, add) {
    patch(m, ox, oy, 'g', r, 0.85);
    for (const [lx, ly] of [[2, 2], [8, 3], [2, 8], [8, 8]]) add.prop('jtree', ox + lx + 0.5, oy + ly + 0.5, { solid: [[ox + lx, oy + ly]] });
    for (let i = 0; i < 5; i++) { const [lx, ly] = freeSpot(r); add.prop('bush', ox + lx + 0.5, oy + ly + 0.5, {}); }
    return ['mandrake', 'viper', 'viper', 'spitter'];
  },
  toxic(m, ox, oy, r, add) {
    patch(m, ox, oy, 'm', r, 0.7);
    for (const [lx, ly] of [[2.5, 2.5], [8, 2.5], [2.5, 8], [8, 8.2]]) add.hazard('poison', ox + lx, oy + ly, 1.2);
    scatterBreakables(add, ox, oy, r, 3);
    return ['spitter', 'spitter', 'viper', 'mandrake'];
  },
  shrine(m, ox, oy, r, add) {
    for (const [lx, ly] of [[2, 2], [8, 2], [2, 8]]) add.prop('statue', ox + lx + 0.5, oy + ly + 0.5, { solid: [[ox + lx, oy + ly]] });
    add.breakable('chest', ox + 8.5, oy + 8.5);
    for (const [lx, ly] of [[1, 5], [9, 5]]) add.light(ox + lx + 0.5, oy + ly + 0.5);
    return ['tortoise', 'viper', 'mandrake'];
  },
  rubble(m, ox, oy, r, add) {
    for (const [lx, ly] of [[2, 2], [3, 2], [2, 3], [8, 7], [8, 8], [7, 8], [8, 2], [2, 8]]) addWall(m, ox + lx, oy + ly);
    scatterBreakables(add, ox, oy, r, 4);
    return ['viper', 'viper', 'spitter', 'tortoise'];
  },
  moat(m, ox, oy, r, add) {
    for (let ly = 1; ly <= 9; ly++) for (let lx = 1; lx <= 9; lx++) {
      const ring = lx === 1 || lx === 9 || ly === 1 || ly === 9;
      if (ring && !inCross(lx, ly, RS)) setG(m, ox + lx, oy + ly, 'p');
    }
    add.breakable('chest', ox + 3.5, oy + 3.5);
    return ['spitter', 'tortoise', 'viper'];
  },
  overgrowth(m, ox, oy, r, add) {
    patch(m, ox, oy, 'g', r, 0.6);
    for (let i = 0; i < 7; i++) { const [lx, ly] = freeSpot(r); add.prop('fern', ox + lx + 0.5, oy + ly + 0.5, {}); }
    add.prop('jtree', ox + 1.5, oy + 1.5, { solid: [[ox + 1, oy + 1]] });
    add.prop('jtree', ox + 9.5, oy + 9.5, { solid: [[ox + 9, oy + 9]] });
    scatterBreakables(add, ox, oy, r, 3);
    return ['mandrake', 'mandrake', 'viper'];
  },
  cistern(m, ox, oy, r, add) {
    for (const [x0, y0] of [[1, 1], [7, 1], [1, 7], [7, 7]]) fillRect(m, ox + x0, oy + y0, ox + x0 + 2, oy + y0 + 2, 'w');
    scatterBreakables(add, ox, oy, r, 5);
    return ['spitter', 'spitter', 'viper'];
  },
  den(m, ox, oy, r, add) {
    patch(m, ox, oy, 'g', r, 0.5);
    for (let i = 0; i < 4; i++) { const [lx, ly] = freeSpot(r); add.prop('rock', ox + lx + 0.5, oy + ly + 0.5, { solid: [[ox + lx, oy + ly]] }); }
    return ['tortoise', 'tortoise', 'viper'];
  },
  nest(m, ox, oy, r, add) {
    patch(m, ox, oy, 'd', r, 0.4);
    scatterBreakables(add, ox, oy, r, 6);
    return ['viper', 'viper', 'viper', 'viper', 'spitter'];
  },
};

function freeSpot(r) {
  for (;;) {
    const lx = 1 + Math.floor(r() * (RS - 2)), ly = 1 + Math.floor(r() * (RS - 2));
    if (!inCross(lx, ly, RS)) return [lx, ly];
  }
}
function patch(m, ox, oy, code, r, amount) {
  for (let ly = 0; ly < RS; ly++) for (let lx = 0; lx < RS; lx++) {
    const v = Math.sin((lx + ox) * 0.9 + r() * 0.5) + Math.cos((ly + oy) * 0.8) + r() * 0.8;
    if (v > 2.2 - amount * 2.4 && getG(m, ox + lx, oy + ly) === 's') setG(m, ox + lx, oy + ly, code);
  }
}
function scatterBreakables(add, ox, oy, r, n, noCrate) {
  for (let i = 0; i < n; i++) {
    const [lx, ly] = freeSpot(r);
    add.breakable(noCrate || r() < 0.6 ? 'jar' : 'crate', ox + lx + 0.5, oy + ly + 0.5);
  }
}

export function generateDungeon(seed, dungeonKey = 'ruins', partySize = 1) {
  const r = rng(seed);
  const info = DUNGEONS[dungeonKey];
  const br = bracket(partySize);
  const nRooms = 5 + Math.floor(r() * 4); // 5..8 combat rooms
  // layout positions (block coordinates)
  const blocks = [];
  let bx = 2, by = 2;
  const dirs = [];
  for (let i = 0; i < nRooms + 2; i++) {
    const big = i === nRooms + 1;
    blocks.push({ bx, by, size: big ? 15 : RS, kind: i === 0 ? 'start' : big ? 'boss' : 'room' });
    const d = r() < 0.5 ? 'x' : 'y';
    dirs.push(d);
    const step = (big ? 15 : RS) + 2 + GAP;
    if (d === 'x') bx += RS + 2 + GAP; else by += RS + 2 + GAP;
    void step;
  }
  // boss arena is bigger: shift so the shared side centres line up
  const last = blocks[blocks.length - 1];
  if (dirs[dirs.length - 2] === 'x') last.by -= 2; else last.bx -= 2;
  let W = 0, H = 0;
  for (const b of blocks) { W = Math.max(W, b.bx + b.size + 4); H = Math.max(H, b.by + b.size + 4); }
  const m = blankMap('dungeon', info.theme, W, H);
  m.dungeon = dungeonKey;
  m.seed = seed;
  let eid = 1, bid = 1;
  const templateKeys = Object.keys(TEMPLATES);
  const pool = templateKeys.slice().sort(() => r() - 0.5);

  blocks.forEach((b, i) => {
    const ox = b.bx + 1, oy = b.by + 1, S = b.size;
    fillRect(m, ox, oy, ox + S - 1, oy + S - 1, 's');
    for (let k = -1; k <= S; k++) { addWall(m, ox + k, oy - 1); addWall(m, ox + k, oy + S); addWall(m, ox - 1, oy + k); addWall(m, ox + S, oy + k); }
    const room = { i, kind: b.kind, x0: ox, y0: oy, x1: ox + S - 1, y1: oy + S - 1, cleared: b.kind === 'start', enemies: [] };
    m.rooms.push(room);
    const add = {
      prop: (t, x, y, o) => m.props.push({ t, x, y, ...o }),
      breakable: (t, x, y) => m.breakables.push({ id: bid++, t, x, y, room: i }),
      hazard: (t, x, y, rad) => m.hazards.push({ t, x, y, r: rad }),
      light: (x, y) => { m.props.push({ t: 'brazier', x, y, solid: [[Math.floor(x), Math.floor(y)]] }); m.lights.push({ x, y, z: 22, color: 0xff9a40, r: 90, i: 0.9, flicker: 0.18 }); },
    };
    if (b.kind === 'start') {
      patch(m, ox, oy, 'g', r, 0.5);
      add.prop('portal', ox + 5.5, oy + 2.5, { solid: [] });
      m.interacts.push({ x: ox + 5.5, y: oy + 3, r: 1.4, kind: 'leave', label: 'Return to Village' });
      m.lights.push({ x: ox + 5.5, y: oy + 2.5, z: 26, color: 0xd36cff, r: 100, i: 0.8, flicker: 0.1 });
      add.light(ox + 1.5, oy + 9.5); add.light(ox + 9.5, oy + 1.5);
      m.spawn = { x: ox + 5.5, y: oy + 6.5 };
      scatterBreakables(add, ox, oy, r, 2);
    } else if (b.kind === 'boss') {
      patch(m, ox, oy, 'g', r, 0.4);
      patch(m, ox, oy, 'm', r, 0.3);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = ox + 7 + Math.cos(a) * 6, y = oy + 7 + Math.sin(a) * 6;
        add.prop('pillar', Math.floor(x) + 0.5, Math.floor(y) + 0.5, { broken: k % 3 === 0, solid: [[Math.floor(x), Math.floor(y)]] });
      }
      add.light(ox + 1.5, oy + 1.5); add.light(ox + 13.5, oy + 1.5); add.light(ox + 1.5, oy + 13.5); add.light(ox + 13.5, oy + 13.5);
      m.boss = { id: eid++, t: info.boss, x: ox + 7.5, y: oy + 6.5, room: i };
      room.enemies.push(m.boss.id);
      m.bossRoom = room;
    } else {
      const key = pool[(i - 1) % pool.length];
      room.template = key;
      const mix = TEMPLATES[key](m, ox, oy, r, add);
      // corner braziers in most rooms (moody lighting)
      if (r() < 0.7) add.light(ox + 0.5, oy + 0.5);
      if (r() < 0.5) add.light(ox + S - 0.5, oy + S - 0.5);
      const budget = Math.round((3 + i * 0.7) * br.mobs);
      for (let k = 0; k < budget; k++) {
        const t = mix[k % mix.length];
        let lx, ly, tries = 0;
        do { lx = 1 + r() * (S - 2); ly = 1 + r() * (S - 2); tries++; } while (tries < 30 && !['s', 'g', 'm', 'd'].includes(getG(m, Math.floor(ox + lx), Math.floor(oy + ly))));
        const e = { id: eid++, t, x: ox + lx, y: oy + ly, room: i };
        m.enemies.push(e);
        room.enemies.push(e.id);
      }
    }
  });

  // bridges between consecutive rooms + gates
  for (let i = 0; i < blocks.length - 1; i++) {
    const a = blocks[i], b = blocks[i + 1];
    const d = dirs[i];
    if (d === 'x') {
      const cy = a.by + 1 + Math.floor(a.size / 2);
      const xs = a.bx + a.size + 1, xe = b.bx;
      for (let x = xs; x <= xe; x++) for (let y = cy - 1; y <= cy + 1; y++) { m.walls.delete(x + ',' + y); setG(m, x, y, 'b'); }
      m.rooms[i].gate = { tiles: [[xs, cy - 1], [xs, cy], [xs, cy + 1]], dir: 'x' };
    } else {
      const cx = a.bx + 1 + Math.floor(a.size / 2);
      const ys = a.by + a.size + 1, ye = b.by;
      for (let y = ys; y <= ye; y++) for (let x = cx - 1; x <= cx + 1; x++) { m.walls.delete(x + ',' + y); setG(m, x, y, 'b'); }
      m.rooms[i].gate = { tiles: [[cx - 1, ys], [cx, ys], [cx + 1, ys]], dir: 'y' };
    }
  }
  m.ambient = { dark: 0.5, ambientColor: 0x5a7a70, tint: 0xd8ffe0, particles: 'fireflies', vignette: 0.6, music: 'ruins', fog: 0x0a1814 };
  m.difficultyTag = info.name;
  return m;
}
