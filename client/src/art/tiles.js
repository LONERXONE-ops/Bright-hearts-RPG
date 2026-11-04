// Isometric tiles: 32x16 diamonds, cliff edges, walls, liquids.
import { Pix, hash2, noise2, rng, mix } from './pix.js';
import { R, INK } from './palette.js';

export const TW = 32, TH = 16;
export const EDGE_D = 16;   // cliff face depth under floors that border the void
export const WALL_H = 30;   // tall wall height

export function inDiamond(x, y) {
  if (y < 0 || y > 15) return false;
  const hw = y < 8 ? 2 * y + 2 : 2 * (15 - y) + 2;
  return x >= 16 - hw && x <= 15 + hw;
}

// tile-local iso coordinates (u along +x axis, v along +y axis), both 0..1
export function isoUV(x, y) {
  const a = (x + 0.5 - 16) / 16, b = (y + 0.5) / 8;
  return [(b + a) / 2, (b - a) / 2];
}

function pick(ramp, t) {
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))];
}

function diamond(fn) {
  const p = new Pix(TW, TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (inDiamond(x, y)) { const c = fn(x, y); if (c) p.set(x, y, c); }
  return p;
}

/* ---------- ground painters ---------- */

function grass(seed, ramp = R.grass, flowers = true, dense = 1) {
  const r = rng(seed);
  const p = diamond((x, y) => {
    const n = noise2(x / 5 + seed * 3.1, y / 3, 3) * 0.6 + hash2(x, y, seed) * 0.4;
    return n > 0.62 ? ramp[4] : n < 0.3 ? ramp[2] : ramp[3];
  });
  // blades
  for (let i = 0; i < 22 * dense; i++) {
    const x = (r() * 30 + 1) | 0, y = (r() * 13 + 2) | 0;
    if (!inDiamond(x, y) || !inDiamond(x, y - 1)) continue;
    p.set(x, y, ramp[5]);
    if (r() < 0.6) p.set(x, y - 1, ramp[6] || ramp[5]);
    p.set(x, y + 1, ramp[2]);
  }
  // little 4-point flowers (a nod to Hyper Light Drifter's fields)
  if (flowers && r() < 0.45) {
    const cols = ['#ffe27a', '#ffb3c8', '#f2f6f4', '#a9d8ff'];
    const c = cols[(r() * cols.length) | 0];
    const x = (r() * 20 + 6) | 0, y = (r() * 6 + 5) | 0;
    if (inDiamond(x - 1, y) && inDiamond(x + 1, y)) {
      p.set(x, y - 1, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y + 1, c); p.set(x, y, '#f6c445');
    }
  }
  return p;
}

function dirt(seed, ramp = R.dirt) {
  const r = rng(seed);
  const p = diamond((x, y) => {
    const n = noise2(x / 4 + seed, y / 2.5, 7) * 0.7 + hash2(x, y, seed + 1) * 0.3;
    return n > 0.66 ? ramp[4] : n < 0.32 ? ramp[2] : ramp[3];
  });
  for (let i = 0; i < 7; i++) {
    const x = (r() * 28 + 2) | 0, y = (r() * 12 + 2) | 0;
    if (!inDiamond(x, y) || !inDiamond(x + 1, y + 1)) continue;
    p.set(x, y, ramp[5]); p.set(x + 1, y, ramp[4]); p.set(x, y + 1, ramp[1]); p.set(x + 1, y + 1, ramp[1]);
  }
  return p;
}

function cobble(seed, ramp = R.cobble) {
  const r = rng(seed);
  const p = diamond(() => ramp[1]);
  // stones placed on an iso-skewed jittered grid
  for (let gu = 0; gu < 4; gu++)
    for (let gv = 0; gv < 4; gv++) {
      const u = (gu + 0.5 + (r() - 0.5) * 0.35) / 4, v = (gv + 0.5 + (r() - 0.5) * 0.35) / 4;
      const cx = 16 + (u - v) * 16, cy = (u + v) * 8;
      const rx = 2.6 + r() * 1.4, ry = 1.5 + r() * 0.8;
      const shift = r() < 0.3 ? 1 : 0;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d > 1 || !inDiamond(x, y)) continue;
          let c = ramp[3 + shift];
          if (dy < -0.35 && dx < 0.4) c = ramp[4 + shift];
          if (dy > 0.45) c = ramp[2];
          p.set(x, y, c);
        }
    }
  return p;
}

function slabs(seed, ramp, opt = {}) {
  const r = rng(seed);
  const n = opt.n || 2;
  const tints = [0, 0, 0, 1, -1].map(() => (r() < 0.3 ? 1 : r() < 0.3 ? -1 : 0));
  const p = diamond((x, y) => {
    const [u, v] = isoUV(x, y);
    const su = Math.min(n - 1, Math.floor(u * n)), sv = Math.min(n - 1, Math.floor(v * n));
    const fu = u * n - su, fv = v * n - sv;
    const t = tints[(su * n + sv) % tints.length];
    let base = 3 + t;
    const nn = hash2(x, y, seed);
    let c = ramp[Math.max(1, Math.min(ramp.length - 2, base + (nn > 0.86 ? 1 : nn < 0.1 ? -1 : 0)))];
    // seams
    if (fu < 0.07 || fv < 0.07) c = ramp[1];
    else if (fu < 0.14 || fv < 0.14) c = ramp[Math.min(ramp.length - 1, base + 1)];
    if (opt.moss) {
      const m = noise2(x / 6 + seed * 1.7, y / 3 + seed, 11);
      if (m > 0.66) c = m > 0.76 ? R.moss[3] : R.moss[2];
    }
    if (opt.wet && noise2(x / 5 + seed, y / 3, 5) < 0.18) c = mix(c, '#1d5470', 0.35);
    return c;
  });
  // cracks
  if (opt.cracks !== false && r() < 0.6) {
    let x = (r() * 20 + 6) | 0, y = (r() * 8 + 4) | 0;
    for (let i = 0; i < 6; i++) {
      if (inDiamond(x, y)) p.set(x, y, ramp[0]);
      x += r() < 0.5 ? 1 : -1; y += r() < 0.5 ? 1 : 0;
    }
  }
  if (opt.weeds && r() < 0.5) {
    for (let i = 0; i < 4; i++) {
      const x = (r() * 26 + 3) | 0, y = (r() * 10 + 3) | 0;
      if (inDiamond(x, y)) { p.set(x, y, R.grass[4]); p.set(x, y - 1, R.grass[5]); }
    }
  }
  return p;
}

function carpet(mask) {
  // mask bits: 1 = edge at u=0 (NW side), 2 = u=1 (SE side), 4 = v=0 (NE side), 8 = v=1 (SW side)
  return diamond((x, y) => {
    const [u, v] = isoUV(x, y);
    const e = 0.13;
    if ((mask & 1 && u < e) || (mask & 2 && u > 1 - e) || (mask & 4 && v < e) || (mask & 8 && v > 1 - e)) return R.gold[4];
    if ((mask & 1 && u < e * 1.7) || (mask & 2 && u > 1 - e * 1.7) || (mask & 4 && v < e * 1.7) || (mask & 8 && v > 1 - e * 1.7)) return R.red[1];
    const k = (Math.floor(u * 6) + Math.floor(v * 6)) % 2;
    const h = hash2(x, y, 4);
    return h > 0.93 ? R.red[4] : k ? R.red[3] : R.red[2];
  });
}

function liquid(ramp, frame, seed, opt = {}) {
  const r = rng(seed * 31 + 7);
  const p = diamond((x, y) => {
    const [u, v] = isoUV(x, y);
    const w = Math.sin((u * 6 + v * 3) * Math.PI + frame * Math.PI / 2 + seed) * 0.5 + 0.5;
    const n = noise2(x / 6 + frame * 0.6, y / 3 + seed, 2);
    let t = 0.35 + n * 0.3 + w * 0.15;
    if (opt.lava) t = 0.45 + n * 0.35 + w * 0.2;
    return pick(ramp, Math.min(0.92, t));
  });
  // glints
  for (let i = 0; i < 4; i++) {
    const x = ((r() * 26 + 3 + frame * 3) % 28 + 2) | 0, y = (r() * 10 + 3) | 0;
    if (inDiamond(x, y) && inDiamond(x + 2, y)) {
      p.set(x, y, ramp[ramp.length - 1]); p.set(x + 1, y, ramp[ramp.length - 2]);
    }
  }
  if (opt.lava) {
    for (let i = 0; i < 3; i++) {
      const x = (r() * 24 + 4) | 0, y = (r() * 8 + 4) | 0;
      for (let k = 0; k < 4; k++) if (inDiamond(x + k, y)) p.set(x + k, y, R.magma[2 + (k % 2)]);
    }
  }
  if (opt.lily && seed % 3 === 0) {
    const x = (r() * 14 + 9) | 0, y = (r() * 4 + 6) | 0;
    p.ellipse(x, y, 3, 1.6, R.leaf[4]);
    p.set(x, y - 1, R.leaf[6]); p.set(x + 1, y, R.leaf[2]);
    if (seed % 2) { p.set(x - 1, y - 1, '#ffb3c8'); p.set(x - 2, y - 1, '#f27aa4'); }
  }
  return p;
}

/* ---------- edges & walls ---------- */

function strata(ramp, x, y, depth, seed) {
  const band = Math.floor((y + hash2(x >> 2, 0, seed) * 3) / 4);
  const n = hash2(x, y, seed);
  let idx = 3 - Math.floor((y / depth) * 3.2);
  if (band % 2) idx -= 0;
  if (n > 0.85) idx += 1;
  if ((y + (x % 7 === 0 ? 1 : 0)) % 4 === 0) idx -= 1;
  return ramp[Math.max(0, Math.min(ramp.length - 1, idx))];
}

function edgeFace(side, ramp, depth, seed, topRamp) {
  const p = new Pix(16, 8 + depth);
  for (let x = 0; x < 16; x++) {
    const top = side === 'sw' ? Math.floor(x / 2) : 8 - Math.ceil((x + 1) / 2);
    for (let y = 0; y < depth; y++) {
      let c = strata(ramp, x + (side === 'se' ? 16 : 0), y, depth, seed);
      if (side === 'se') c = mix(c, INK, 0.18);
      if (y === 0 && topRamp) c = topRamp[2];
      if (y === 1 && topRamp && hash2(x, 1, seed) > 0.5) c = topRamp[1];
      p.set(x, top + y, c);
    }
    // dripping fade into the void
    for (let y = depth; y < depth + 3; y++) if (hash2(x, y, seed + 3) > 0.55 + (y - depth) * 0.15) p.set(x, top + y, mix(ramp[0], INK, 0.5));
  }
  return p;
}

function wallBlock(theme, h, seed, opt = {}) {
  const ramp = theme.wall;
  const p = new Pix(TW, TH + h);
  const r = rng(seed);
  const brickH = opt.brickH || 5, brickW = opt.brickW || 8;
  // faces
  for (let x = 0; x < 32; x++) {
    const left = x < 16;
    const yTop = left ? 8 + Math.floor(x / 2) : 16 - Math.floor((x - 16) / 2);
    for (let vy = 0; vy < h; vy++) {
      const y = yTop + vy;
      const along = left ? x : x - 16;
      const row = Math.floor(vy / brickH);
      const off = row % 2 ? brickW / 2 : 0;
      const bx = Math.floor((along + off) / brickW);
      const seamY = vy % brickH === 0;
      const seamX = (along + off) % brickW === 0;
      const bt = hash2(bx, row, seed + (left ? 0 : 50));
      let idx = left ? 3 : 2;
      if (bt > 0.75) idx += 1;
      if (bt < 0.15) idx -= 1;
      let c = ramp[Math.max(0, Math.min(ramp.length - 1, idx))];
      if (seamY || seamX) c = ramp[Math.max(0, (left ? 1 : 0))];
      // ambient occlusion at the base
      if (vy > h - 4) c = mix(c, INK, (vy - (h - 4)) * 0.12);
      if (opt.moss && noise2(along / 5 + (left ? 0 : 9), vy / 4 + seed, 13) > 0.68) c = left ? R.moss[3] : R.moss[2];
      if (opt.frost && vy < 4 && hash2(x, vy, seed) > 0.3) c = R.ice[5 - (vy >> 1)];
      p.set(x, y, c);
    }
  }
  // top cap
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inDiamond(x, y)) continue;
    const [u, v] = isoUV(x, y);
    let c = ramp[4];
    if (u < 0.12 || v < 0.12) c = ramp[5] || ramp[4];
    if (u > 0.9 || v > 0.9) c = ramp[3];
    if (opt.moss && noise2(x / 5 + seed, y / 3, 17) > 0.45) c = noise2(x / 3, y / 2, 19) > 0.5 ? R.moss[4] : R.moss[3];
    if (opt.frost) c = u < 0.2 || v < 0.2 ? R.ice[6] : R.ice[5];
    p.set(x, y, c);
  }
  // hanging vines (ruins)
  if (opt.vines) {
    const n = 2 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const x = (r() * 30 + 1) | 0;
      const left = x < 16;
      const yTop = left ? 8 + Math.floor(x / 2) : 16 - Math.floor((x - 16) / 2);
      const len = 6 + ((r() * (h - 6)) | 0);
      for (let vy = 0; vy < len; vy++) {
        const sway = Math.round(Math.sin(vy / 3 + i) * 0.6);
        p.set(x + sway, yTop + vy, vy % 3 === 0 ? R.leaf[5] : R.leaf[3]);
        if (vy % 4 === 2) p.set(x + sway + 1, yTop + vy, R.leaf[4]);
      }
    }
  }
  if (opt.candles) {
    // little wall sconce
    const x = 8, y = 8 + 4 + 8;
    p.set(x, y, R.gold[3]); p.set(x, y - 1, R.bone[5]); p.set(x, y - 2, '#ffe27a');
  }
  return p;
}

/* ---------- themes ---------- */

export const THEMES = {
  village: {
    wall: R.stone, cliff: R.dirt, cliffTop: R.grass,
    ground: { g: (s) => grass(s), d: (s) => dirt(s), c: (s) => cobble(s), s: (s) => slabs(s, R.stone, { cracks: false }), y: (s) => grass(s, R.grassDry, false), f: (s) => slabs(s, R.plank, { n: 3, cracks: false }) },
  },
  castle: {
    wall: R.castle, cliff: R.castle, cliffTop: null,
    ground: { s: (s) => slabs(s, R.castle, { cracks: s % 3 === 0 }), c: (s) => cobble(s, R.castle) },
    wallOpt: { brickH: 6, brickW: 10 },
  },
  ruins: {
    wall: R.ruin, cliff: R.ruin, cliffTop: R.moss,
    ground: { g: (s) => grass(s, R.grass, true, 1.2), s: (s) => slabs(s, R.ruin, { moss: true, weeds: true }), d: (s) => dirt(s, R.dirt), m: (s) => slabs(s, R.ruin, { moss: true, wet: true }), b: (s) => slabs(s, R.stone, { n: 3, weeds: true }) },
    wallOpt: { moss: true, vines: true },
  },
  crypt: {
    wall: R.crypt, cliff: R.crypt, cliffTop: null,
    ground: { s: (s) => slabs(s, R.crypt, {}), d: (s) => dirt(s, R.magma), c: (s) => cobble(s, R.crypt) },
    wallOpt: { brickH: 5, brickW: 9 },
  },
  magma: {
    wall: R.magma, cliff: R.magma, cliffTop: null,
    ground: { s: (s) => slabs(s, R.magma, {}), d: (s) => dirt(s, R.magma) },
  },
};

// Register every tile texture for a theme into a Phaser scene.
export function buildTileTextures(scene, themeKey) {
  const theme = THEMES[themeKey];
  const tex = scene.textures;
  const add = (key, pix) => { if (!tex.exists(key)) tex.addCanvas(key, pix.canvas()); };
  for (const [code, fn] of Object.entries(theme.ground)) {
    for (let v = 0; v < 6; v++) add(`t_${themeKey}_${code}_${v}`, fn(v * 97 + code.charCodeAt(0) * 13 + themeKey.length));
  }
  for (let v = 0; v < 4; v++) {
    add(`e_${themeKey}_sw_${v}`, edgeFace('sw', theme.cliff, EDGE_D, v + 1, theme.cliffTop));
    add(`e_${themeKey}_se_${v}`, edgeFace('se', theme.cliff, EDGE_D, v + 5, theme.cliffTop));
    add(`es_${themeKey}_sw_${v}`, edgeFace('sw', theme.cliff, 6, v + 9, theme.cliffTop));
    add(`es_${themeKey}_se_${v}`, edgeFace('se', theme.cliff, 6, v + 13, theme.cliffTop));
  }
  const wo = theme.wallOpt || {};
  for (let v = 0; v < 4; v++) {
    add(`w_${themeKey}_${v}`, wallBlock(theme, WALL_H, v * 7 + 3, { ...wo, vines: wo.vines && v % 2 === 0 }));
    add(`wl_${themeKey}_${v}`, wallBlock(theme, 8, v * 7 + 5, { ...wo, vines: false }));
  }
  // liquids (4 animation frames)
  for (let f = 0; f < 4; f++) {
    for (let v = 0; v < 3; v++) {
      add(`water_${v}_${f}`, liquid(R.water, f, v + 1, { lily: false }));
      add(`pond_${v}_${f}`, liquid(R.pond, f, v + 1, { lily: true }));
      add(`lava_${v}_${f}`, liquid(R.lava, f, v + 1, { lava: true }));
    }
  }
  for (let m = 0; m < 16; m++) add(`carpet_${m}`, carpet(m));
}
