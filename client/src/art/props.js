// Props and buildings. Buildings are rasterised from a tiny 3D description
// (walls + roof heightfield) into iso pixel art, so every house is unique but consistent.
import { Pix, hash2, noise2, rng, mix, strip } from './pix.js';
import { R, INK } from './palette.js';

const c = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];

/* ======================= BUILDINGS ======================= */

/**
 * cfg: { w, d, H, roof:'gable'|'pyramid'|'flat'|'crenel', roofH, wall:'plaster'|'stone'|'plank'|'castle',
 *        roofRamp, door:true, windows:n, chimney, forge, sign, banner }
 * returns { pix, ax, ay } where (ax, ay) is the screen position of the footprint's top corner.
 */
export function building(cfg, seed = 1) {
  const { w, d, H } = cfg;
  const roofH = cfg.roofH ?? (cfg.roof === 'flat' || cfg.roof === 'crenel' ? 0 : 18);
  const ov = cfg.roof === 'crenel' || cfg.roof === 'flat' ? 0 : 0.28;
  const pad = 6;
  const top = H + roofH + 14;
  const W = Math.ceil((w + d + ov * 2) * 16) + pad * 2;
  const Hh = Math.ceil((w + d + ov * 2) * 8) + top + pad * 2;
  const p = new Pix(W, Hh);
  const ox = Math.round((d + ov) * 16) + pad, oy = top + pad + Math.round(ov * 8);
  const P = (x, y, z) => [Math.round(ox + (x - y) * 16), Math.round(oy + (x + y) * 8 - z)];
  const r = rng(seed);

  const wallRamp = cfg.wall === 'stone' ? R.stone : cfg.wall === 'plank' ? R.plank : cfg.wall === 'castle' ? R.castle : R.plaster;
  const roofRamp = cfg.roofRamp || R.thatch;

  const roofZ = (x, y) => {
    if (cfg.roof === 'gable') return H + roofH * Math.max(0, 1 - Math.abs(y - d / 2) / (d / 2 + ov));
    if (cfg.roof === 'pyramid') return H + roofH * Math.max(0, 1 - Math.max(Math.abs(x - w / 2) / (w / 2 + ov), Math.abs(y - d / 2) / (d / 2 + ov)));
    return H;
  };

  // ---- walls ----
  const wallPx = (face, along, z, len) => {
    // along: pixels along the face, z: pixels up from ground
    let k = face === 'L' ? 3 : 2;
    const ramp = wallRamp;
    let col;
    if (cfg.wall === 'stone' || cfg.wall === 'castle') {
      const row = Math.floor(z / 5), off = row % 2 ? 4 : 0;
      const b = Math.floor((along + off) / 9);
      const seam = z % 5 === 0 || (along + off) % 9 === 0;
      const t = hash2(b, row, seed + (face === 'L' ? 0 : 7));
      col = seam ? c(ramp, k - 2) : c(ramp, k + (t > 0.78 ? 1 : t < 0.18 ? -1 : 0));
    } else if (cfg.wall === 'plank') {
      const seam = z % 4 === 0;
      col = seam ? c(ramp, k - 2) : c(ramp, k + (hash2(Math.floor(along / 14), Math.floor(z / 4), seed) > 0.7 ? 1 : 0));
    } else {
      // plaster with timber frame
      col = c(ramp, k + (hash2(along, z, seed) > 0.9 ? -1 : 0));
      const beam = along < 2 || along > len - 3 || z > H - 3 || (z < 8 && z > 5) || Math.abs(along - Math.round(len / 2)) < 1;
      const diag = Math.abs((along % 24) - (z * 24) / H) < 1.2 && z > 8 && z < H - 3;
      if (beam || diag) col = c(R.wood, face === 'L' ? 2 : 1);
      if (z <= 5) col = c(R.stone, face === 'L' ? 3 : 2);
    }
    // ground AO
    if (z < 3) col = mix(col, INK, 0.35 - z * 0.1);
    return col;
  };

  // front-right face (x = w), y from 0..d
  const lenR = d * 32, lenL = w * 32;
  for (let i = 0; i <= d * 16; i++) {
    const y = i / 16;
    const zt = cfg.roof === 'gable' ? roofZ(w, y) : H;
    for (let z = 0; z <= zt; z++) {
      const [sx, sy] = P(w, y, z);
      const along = Math.round(y * 32);
      let col = wallPx('R', along, z, lenR);
      if (z > H && cfg.roof === 'gable') col = c(cfg.wall === 'stone' ? R.stone : R.plank, 2 + (z % 4 === 0 ? -1 : 0));
      p.set(sx, sy, col); p.set(sx + 1, sy, col);
    }
  }
  // front-left face (y = d), x from 0..w
  for (let i = 0; i <= w * 16; i++) {
    const x = i / 16;
    for (let z = 0; z <= H; z++) {
      const [sx, sy] = P(x, d, z);
      const col = wallPx('L', Math.round(x * 32), z, lenL);
      p.set(sx, sy, col); p.set(sx - 1, sy, col);
    }
  }
  // corner highlight
  for (let z = 0; z <= H; z++) { const [sx, sy] = P(w, d, z); p.set(sx, sy, c(wallRamp, 4)); }

  // ---- details on faces ----
  const faceRectL = (x0, x1, z0, z1, fn) => {
    for (let i = Math.round(x0 * 32); i <= Math.round(x1 * 32); i++)
      for (let z = z0; z <= z1; z++) { const [sx, sy] = P(i / 32, d, z); fn(sx, sy, i - Math.round(x0 * 32), z - z0); }
  };
  const faceRectR = (y0, y1, z0, z1, fn) => {
    for (let i = Math.round(y0 * 32); i <= Math.round(y1 * 32); i++)
      for (let z = z0; z <= z1; z++) { const [sx, sy] = P(w, i / 32, z); fn(sx, sy, i - Math.round(y0 * 32), z - z0); }
  };
  const window_ = (face, at, z0) => {
    const f = face === 'L' ? faceRectL : faceRectR;
    const ww = 7 / 32, hh = 9;
    f(at - ww / 2, at + ww / 2, z0, z0 + hh, (sx, sy, u, v) => {
      let col = (u === 0 || u >= 6 || v === 0 || v === hh) ? c(R.wood, 1) : (u === 3 || v === 5) ? c(R.wood, 2) : (v > 5 ? '#f7c35c' : '#ffe39a');
      if (cfg.dark && col.startsWith('#f')) col = '#3b3256';
      p.set(sx, sy, col);
    });
    // sill
    f(at - ww / 2 - 1 / 32, at + ww / 2 + 1 / 32, z0 - 1, z0 - 1, (sx, sy) => p.set(sx, sy, c(R.wood, 3)));
  };
  if (cfg.door !== false) {
    const at = cfg.doorAt ?? w / 2;
    const dw = (cfg.gate ? 22 : 10) / 32, dh = cfg.gate ? 26 : 14;
    faceRectL(at - dw / 2, at + dw / 2, 0, dh, (sx, sy, u, v) => {
      const uu = u / (dw * 32);
      const arch = v > dh - 3 && (uu < 0.15 || uu > 0.85);
      if (arch) return;
      let col = cfg.gate ? (v > dh - 4 ? INK : c(R.wood, 1 + ((u >> 2) % 2))) : c(R.wood, 2 + ((u % 4 === 0) ? -1 : 0));
      if (!cfg.gate && u === Math.round(dw * 32) - 3 && v === 7) col = R.gold[4];
      if (cfg.gate && v % 6 === 0) col = R.steel[2];
      p.set(sx, sy, col);
    });
  }
  const nw = cfg.windows ?? 2;
  for (let i = 0; i < nw; i++) {
    if (i % 2 === 0) window_('R', d * ((i / 2 + 1) / (Math.ceil(nw / 2) + 1)), Math.round(H * 0.42));
    else if (w >= 3) window_('L', (i < 2 ? 0.55 : w - 0.55), Math.round(H * 0.42));
  }
  if (cfg.forge) {
    faceRectR(d * 0.25, d * 0.6, 0, 12, (sx, sy, u, v) => p.set(sx, sy, v > 9 ? INK : mix('#ff8a2b', '#ffe27a', hash2(u, v, 3) * 0.6)));
  }

  // ---- roof ----
  if (cfg.roof === 'crenel' || cfg.roof === 'flat') {
    // flat top + merlons
    for (let y = 0; y <= d; y += 1 / 16) for (let x = 0; x <= w; x += 1 / 16) {
      const [sx, sy] = P(x, y, H);
      p.set(sx, sy, c(wallRamp, x < 0.15 || y < 0.15 ? 5 : 4));
    }
    if (cfg.roof === 'crenel') {
      const merlon = (x, y) => {
        for (let z = H; z <= H + 6; z++) for (let k = 0; k < 5; k++) { const [sx, sy] = P(x + k / 32, y, z); p.set(sx, sy, c(wallRamp, z === H + 6 ? 5 : 3)); p.set(sx - 1, sy, c(wallRamp, 3)); }
      };
      for (let x = 0; x <= w - 0.2; x += 0.5) merlon(x, d);
      for (let y = 0; y <= d - 0.2; y += 0.5) for (let z = H; z <= H + 6; z++) for (let k = 0; k < 5; k++) { const [sx, sy] = P(w, y + k / 32, z); p.set(sx, sy, c(wallRamp, z === H + 6 ? 4 : 2)); p.set(sx + 1, sy, c(wallRamp, 2)); }
    }
  } else {
    const step = 1 / 20;
    const cells = [];
    for (let y = -ov; y <= d + ov; y += step) for (let x = -ov; x <= w + ov; x += step) cells.push([x, y]);
    cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of cells) {
      const z = roofZ(x, y);
      const [sx, sy] = P(x, y, z);
      let k;
      let front;
      if (cfg.roof === 'gable') {
        front = y > d / 2;
        const dist = front ? (d + ov - y) : (y + ov);
        const row = Math.floor(dist * (cfg.roofRows || 5));
        const seamRow = (dist * (cfg.roofRows || 5)) % 1 < 0.18;
        k = front ? 3 : 4;
        if (cfg.shingle) {
          const off = row % 2 ? 0.5 : 0;
          if (((x * 4 + off) % 1) < 0.1) k -= 1;
        } else {
          if (hash2(Math.round(x * 30), row, seed) > 0.7) k += 1;
        }
        if (seamRow) k -= 1;
        if (Math.abs(y - d / 2) < 0.07) k = 5;
        if (x < -ov + 0.06 || x > w + ov - 0.06 || y < -ov + 0.06 || y > d + ov - 0.06) k = 1;
      } else {
        const ax = Math.abs(x - w / 2) / (w / 2 + ov), ay = Math.abs(y - d / 2) / (d / 2 + ov);
        front = ax > ay ? x > w / 2 : y > d / 2;
        k = ax > ay ? (x > w / 2 ? 2 : 4) : (y > d / 2 ? 3 : 4);
        if ((Math.max(ax, ay) * 6) % 1 < 0.15) k -= 1;
        if (Math.abs(ax - ay) < 0.03) k = 5;
      }
      const col = c(roofRamp, k);
      p.set(sx, sy, col);
      p.set(sx, sy + 1, col);
    }
    // eave shadow line
  }
  if (cfg.chimney) {
    const cx0 = w * 0.7, cy0 = d * 0.3;
    const zb = roofZ(cx0, cy0) - 4;
    for (let z = zb; z < zb + 14; z++) for (let i = 0; i < 6; i++) {
      const [sx, sy] = P(cx0 + i / 32, cy0 + 0.25, z); p.set(sx, sy, c(R.stone, (z % 4 === 0) ? 2 : 3));
      const [sx2, sy2] = P(cx0 + 6 / 32, cy0 + 0.25 - i / 32, z); p.set(sx2, sy2, c(R.stone, 2));
    }
  }
  if (cfg.banner) {
    const [sx, sy] = P(w * 0.5, d, H - 2);
    for (let j = 0; j < 12; j++) for (let i = -2; i <= 2; i++) {
      if (j > 9 && Math.abs(i) < 10 - j - 0) continue;
      p.set(sx + i, sy + j - 2 - 12 + 10, j === 0 ? R.gold[4] : c(cfg.banner, i < 0 ? 3 : 2));
    }
    p.set(sx, sy - 4 + 6, R.gold[4]);
  }
  p.outline(INK);
  return { pix: p, ax: ox, ay: oy };
}

/* ======================= NATURE ======================= */

export function tree(seed, ramp = R.leaf, opt = {}) {
  const r = rng(seed);
  const p = new Pix(48, 64);
  const cx = 24, base = 60;
  // trunk with roots
  for (let y = base - 22; y <= base; y++) {
    const w = y > base - 3 ? 4 : 2;
    for (let x = -w; x <= w; x++) p.set(cx + x, y, c(R.wood, x < 0 ? 3 : x > 0 ? 1 : 2));
  }
  p.set(cx - 5, base, R.wood[2]); p.set(cx + 5, base, R.wood[1]);
  // canopy blobs
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = r() * 9;
    blobs.push([cx + Math.cos(a) * d * 1.2, 24 + Math.sin(a) * d * 0.8 + (r() - 0.5) * 6, 7 + r() * 5]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rr] of blobs) p.ball(x, y, rr, rr * 0.85, [ramp[1], ramp[2], ramp[3], ramp[4], ramp[5]]);
  // leaf clusters highlight speckles
  for (let i = 0; i < 40; i++) {
    const x = (cx - 16 + r() * 32) | 0, y = (10 + r() * 26) | 0;
    if (p.alpha(x, y) && p.alpha(x, y - 2)) { p.set(x, y, ramp[6] || ramp[5]); p.set(x + 1, y, ramp[5]); }
  }
  // underside shadow
  for (let y = 0; y < 64; y++) for (let x = 0; x < 48; x++) {
    if (!p.alpha(x, y)) continue;
    if (y > 32 && y < 40 && p.alpha(x, y + 1) && hash2(x, y, 3) > 0.4 && !(x > cx - 3 && x < cx + 3)) p.set(x, y, ramp[1]);
  }
  if (opt.fruit) for (let i = 0; i < 5; i++) { const x = (cx - 12 + r() * 24) | 0, y = (16 + r() * 18) | 0; if (p.alpha(x, y)) { p.set(x, y, R.red[4]); p.set(x, y + 1, R.red[2]); } }
  if (opt.blossom) for (let i = 0; i < 26; i++) { const x = (cx - 14 + r() * 28) | 0, y = (12 + r() * 22) | 0; if (p.alpha(x, y)) p.set(x, y, r() < 0.5 ? R.pink[5] : R.pink[4]); }
  if (opt.vines) for (let i = 0; i < 4; i++) { const x = (cx - 12 + r() * 24) | 0; for (let j = 0; j < 10 + r() * 10; j++) p.set(x, 32 + j, j % 3 ? R.leaf[3] : R.leaf[5]); }
  p.outline(INK);
  return { pix: p, ax: cx, ay: base };
}

export function fern(seed) {
  const r = rng(seed);
  const p = new Pix(32, 24);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.1 + 0.8 * (i / 6));
    const len = 9 + r() * 5;
    for (let t = 0; t < len; t++) {
      const x = 16 + Math.cos(a) * t * 1.2, y = 22 + Math.sin(a) * t * 0.9 + (t * t) / 28;
      p.set(x, y, c(R.leaf, t > len - 3 ? 6 : 4));
      if (t % 2 === 0) { p.set(x, y + 1, R.leaf[2]); p.set(x + 1, y - 1, R.leaf[5]); }
    }
  }
  p.outline(INK);
  return { pix: p, ax: 16, ay: 22 };
}

export function bush(seed, flowers) {
  const r = rng(seed);
  const p = new Pix(28, 22);
  p.ball(9, 14, 7, 6, R.leaf.slice(1, 6));
  p.ball(19, 14, 7, 6, R.leaf.slice(1, 6));
  p.ball(14, 10, 7, 6, R.leaf.slice(2, 7));
  if (flowers) for (let i = 0; i < 6; i++) { const x = (5 + r() * 18) | 0, y = (6 + r() * 10) | 0; if (p.alpha(x, y)) p.set(x, y, flowers); }
  p.outline(INK);
  return { pix: p, ax: 14, ay: 19 };
}

export function rock(seed, ramp = R.stone) {
  const p = new Pix(24, 16);
  p.ball(11, 10, 8, 5, ramp.slice(1, 6));
  p.ball(17, 11, 5, 3.5, ramp.slice(1, 5));
  if (seed % 2) for (let x = 5; x < 14; x++) if (p.alpha(x, 6)) p.set(x, 6, R.moss[4]);
  p.outline(INK);
  return { pix: p, ax: 12, ay: 13 };
}

/* ======================= STRUCTURES ======================= */

export function pillar(seed, broken, ramp = R.ruin, moss = true) {
  const p = new Pix(20, 48);
  const h = broken ? 22 + (seed % 3) * 4 : 38;
  const base = 44;
  for (let y = base - h; y <= base; y++)
    for (let x = 4; x <= 15; x++) {
      const inBase = y > base - 4 || (y < base - h + 4 && !broken);
      if (!inBase && (x < 6 || x > 13)) continue;
      let k = x < 8 ? 4 : x > 11 ? 2 : 3;
      if (!inBase && (x === 8 || x === 11)) k -= 1; // flutes
      p.set(x, y, c(ramp, k));
    }
  if (broken) for (let x = 6; x <= 13; x++) { const jag = Math.round(hash2(x, seed, 1) * 3); for (let j = 0; j < jag; j++) p.clear(x, base - h + j); p.set(x, base - h + jag, c(ramp, 5)); }
  if (moss) for (let y = base - h; y < base; y++) for (let x = 4; x <= 15; x++) if (p.alpha(x, y) && noise2(x / 3, y / 4, seed) > 0.68) p.set(x, y, R.moss[3 + (x < 9 ? 1 : 0)]);
  if (moss && seed % 2) for (let j = 0; j < 14; j++) p.set(13, base - h + 4 + j, j % 3 ? R.leaf[3] : R.leaf[5]);
  p.outline(INK);
  return { pix: p, ax: 10, ay: 44 };
}

export function statue(seed, ramp = R.ruin) {
  const p = new Pix(24, 48);
  // plinth
  p.rect(4, 36, 16, 8, c(ramp, 2)); p.rect(4, 36, 16, 2, c(ramp, 4)); p.rect(4, 36, 3, 8, c(ramp, 3));
  // hooded robed figure
  for (let y = 12; y < 36; y++) {
    const w = 4 + Math.floor((y - 12) / 5);
    for (let x = 12 - w; x < 12 + w; x++) p.set(x, y, c(ramp, x < 11 ? 4 : x > 13 ? 2 : 3));
  }
  p.ball(12, 10, 5, 5, ramp.slice(2, 6));
  p.ellipse(12.5, 11, 2.6, 3, c(ramp, 0));
  // folds
  for (let y = 20; y < 36; y += 1) if (y % 3 === 0) p.set(10 + (y % 2), y, c(ramp, 2));
  // hands holding sword
  p.vline(12, 18, 34, c(ramp, 5)); p.hline(10, 14, 22, c(ramp, 4));
  for (let y = 4; y < 44; y++) for (let x = 0; x < 24; x++) if (p.alpha(x, y) && noise2(x / 3, y / 4, seed + 4) > 0.7) p.set(x, y, R.moss[3]);
  p.outline(INK);
  return { pix: p, ax: 12, ay: 43 };
}

export function jar(seed, ramp = R.dirt, moss = true) {
  const p = new Pix(16, 20);
  p.ball(8, 12, 6, 6, [ramp[1], ramp[2], ramp[3], ramp[4], ramp[5]]);
  p.rect(5, 4, 6, 3, c(ramp, 3)); p.hline(4, 11, 4, c(ramp, 4)); p.hline(5, 10, 6, c(ramp, 1));
  p.hline(3, 12, 11, c(ramp, 1));
  if (moss) for (let i = 0; i < 6; i++) { const x = 3 + ((seed * 7 + i * 5) % 10), y = 8 + ((i * 3) % 8); if (p.alpha(x, y)) p.set(x, y, R.moss[4]); }
  p.outline(INK);
  return { pix: p, ax: 8, ay: 18 };
}

export function crate(seed, ramp = R.plank, rot) {
  const p = new Pix(24, 24);
  // iso box 10x10x12
  const L = [[2, 8], [12, 13], [12, 23], [2, 18]], Rr = [[12, 13], [22, 8], [22, 18], [12, 23]], T = [[2, 8], [12, 3], [22, 8], [12, 13]];
  p.poly(L, c(ramp, 3)); p.poly(Rr, c(ramp, 2)); p.poly(T, c(ramp, 4));
  // planks
  p.line(2, 13, 12, 18, c(ramp, 1)); p.line(12, 18, 22, 13, c(ramp, 0));
  p.line(3, 9, 11, 21, c(ramp, 1)); p.line(13, 21, 21, 9, c(ramp, 0));
  p.line(2, 8, 12, 13, c(ramp, 5)); p.line(12, 13, 22, 8, c(ramp, 2));
  if (rot) for (let i = 0; i < 8; i++) { const x = 3 + ((seed + i * 7) % 18), y = 6 + ((i * 5) % 14); if (p.alpha(x, y)) p.set(x, y, R.moss[3]); }
  p.outline(INK);
  return { pix: p, ax: 12, ay: 22 };
}

export function chest(open, ramp = R.wood, trim = R.gold) {
  const p = new Pix(24, 22);
  const L = [[2, 10], [12, 15], [12, 21], [2, 16]], Rr = [[12, 15], [22, 10], [22, 16], [12, 21]];
  p.poly(L, c(ramp, 3)); p.poly(Rr, c(ramp, 2));
  if (!open) {
    p.poly([[2, 10], [2, 7], [12, 2], [22, 7], [22, 10], [12, 15]], c(ramp, 4));
    p.line(2, 7, 12, 12, c(ramp, 2)); p.line(12, 12, 22, 7, c(ramp, 1));
    p.line(2, 10, 12, 15, trim[3]); p.line(12, 15, 22, 10, trim[2]);
    p.rect(11, 13, 3, 3, trim[4]); p.set(12, 14, INK);
  } else {
    p.poly([[2, 10], [12, 5], [22, 10], [12, 15]], INK2());
    p.poly([[2, 10], [2, 2], [12, -3], [12, 5]], c(ramp, 2));
    for (let i = 0; i < 6; i++) p.set(9 + i, 9 + (i % 2), trim[5]);
  }
  p.vline(2, 10, 16, trim[3]); p.vline(22, 10, 16, trim[2]); p.vline(12, 15, 21, trim[3]);
  p.outline(INK);
  return { pix: p, ax: 12, ay: 19 };
}
function INK2() { return '#2b1d45'; }

export function barrel() {
  const p = new Pix(16, 20);
  for (let y = 4; y < 18; y++) {
    const w = 5 + (y > 6 && y < 16 ? 1 : 0);
    for (let x = 8 - w; x < 8 + w; x++) p.set(x, y, c(R.wood, x < 6 ? 4 : x > 10 ? 2 : 3));
  }
  p.ellipse(8, 4.5, 5, 2, R.wood[4]); p.ellipse(8, 4.5, 3.5, 1.2, R.wood[2]);
  p.hline(2, 13, 7, R.steel[3]); p.hline(2, 13, 14, R.steel[2]);
  p.outline(INK);
  return { pix: p, ax: 8, ay: 18 };
}

export function torchPost(kind = 'brazier', ramp = R.stone) {
  const p = new Pix(16, 40);
  if (kind === 'brazier') {
    p.rect(6, 22, 4, 14, c(ramp, 3)); p.set(6, 22, c(ramp, 4));
    p.rect(4, 34, 8, 3, c(ramp, 2));
    p.poly([[2, 18], [14, 18], [11, 23], [5, 23]], R.steel[2]); p.hline(2, 13, 18, R.steel[4]);
    p.hline(4, 11, 17, R.magma[3]);
  } else if (kind === 'lamp') {
    p.rect(7, 12, 2, 26, R.steel[1]); p.vline(7, 12, 37, R.steel[3]);
    p.rect(4, 4, 8, 9, R.steel[2]); p.rect(5, 6, 6, 6, '#ffe39a'); p.hline(3, 12, 4, R.steel[3]); p.rect(6, 1, 4, 3, R.steel[2]);
    p.rect(5, 36, 6, 2, R.steel[2]);
  } else if (kind === 'crypt') {
    p.rect(7, 14, 2, 24, R.crypt[3]); p.vline(7, 14, 37, R.crypt[4]);
    p.poly([[3, 10], [13, 10], [11, 15], [5, 15]], R.crypt[2]); p.hline(3, 12, 10, R.crypt[4]);
    p.rect(5, 36, 6, 2, R.crypt[2]);
  }
  p.outline(INK);
  return { pix: p, ax: 8, ay: 37 };
}

export function flame(frame, ramp = R.fire) {
  const p = new Pix(12, 16);
  const sway = [0, 1, 0, -1][frame % 4];
  for (let y = 0; y < 14; y++) {
    const t = y / 13;
    const w = Math.sin(t * Math.PI) * (2.5 + t * 1.8);
    const cx = 6 + sway * (1 - t);
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const d = Math.abs(x + 0.5 - cx) / (w + 0.01);
      const k = Math.floor((1 - d) * 3 + t * 2.5);
      p.set(x, y + 1, c(ramp, Math.min(ramp.length - 1, k + 1)));
    }
  }
  return p;
}

export function fountain() {
  const p = new Pix(80, 56);
  const cx = 40, cy = 34;
  // basin rim (iso ellipse ring)
  p.ellipse(cx, cy + 4, 34, 15, R.stone[2]);
  p.ellipse(cx, cy, 34, 15, R.stone[4]);
  p.ellipse(cx, cy, 30, 12.5, R.stone[2]);
  p.ellipse(cx, cy + 1, 29, 11.5, R.water[3]);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; p.set(cx + Math.cos(a) * 31, cy + Math.sin(a) * 13.5, R.stone[5]); }
  // ripples
  p.ellipse(cx, cy + 1, 18, 7, R.water[4]); p.ellipse(cx, cy + 1, 15, 5.5, R.water[3]);
  // central pillar + statue
  p.rect(cx - 4, cy - 22, 8, 22, R.stone[3]); p.rect(cx - 4, cy - 22, 3, 22, R.stone[4]); p.rect(cx + 2, cy - 22, 2, 22, R.stone[2]);
  p.ellipse(cx, cy - 23, 9, 3.5, R.stone[4]); p.ellipse(cx, cy - 22, 7, 2.5, R.water[4]);
  p.ball(cx, cy - 32, 4, 6, R.stone.slice(2, 6));
  p.ball(cx, cy - 39, 3, 3, R.stone.slice(2, 6));
  // heart emblem (Bright Hearts!)
  p.set(cx - 2, cy - 12, R.pink[4]); p.set(cx - 1, cy - 12, R.pink[4]); p.set(cx + 1, cy - 12, R.pink[4]); p.set(cx + 2, cy - 12, R.pink[3]);
  p.hline(cx - 2, cx + 2, cy - 11, R.pink[3]); p.hline(cx - 1, cx + 1, cy - 10, R.pink[2]); p.set(cx, cy - 9, R.pink[2]);
  p.outline(INK);
  return { pix: p, ax: cx, ay: cy + 6 };
}

export function stall(ramp) {
  const p = new Pix(48, 48);
  // counter (iso box)
  p.poly([[6, 28], [24, 37], [24, 45], [6, 36]], R.plank[3]);
  p.poly([[24, 37], [42, 28], [42, 36], [24, 45]], R.plank[2]);
  p.poly([[6, 28], [24, 19], [42, 28], [24, 37]], R.plank[4]);
  // goods
  const goods = [R.red[4], R.orange[4], R.leaf[5], R.gold[4], R.purple[4]];
  for (let i = 0; i < 9; i++) { const x = 13 + (i % 5) * 4 + (i > 4 ? 2 : 0), y = 26 + (i > 4 ? 3 : 0) + ((i % 5) >> 1); p.ellipse(x, y, 1.6, 1.3, goods[i % 5]); }
  // posts
  p.vline(7, 8, 35, R.wood[3]); p.vline(41, 8, 35, R.wood[2]); p.vline(24, 4, 20, R.wood[2]);
  // striped awning
  for (let y = 0; y < 12; y++) for (let x = 3; x < 46; x++) {
    const yy = y + Math.abs(x - 24) * 0.45;
    const stripe = Math.floor((x + 100) / 5) % 2;
    const col = stripe ? c(ramp, y < 3 ? 4 : 3) : (y < 3 ? '#fff4e0' : '#e9dcc8');
    p.set(x, Math.round(yy) + 0, col);
  }
  for (let x = 3; x < 46; x += 2) p.set(x, Math.round(12 + Math.abs(x - 24) * 0.45), c(ramp, 1));
  p.outline(INK);
  return { pix: p, ax: 24, ay: 40 };
}

export function fence(dir) {
  const p = new Pix(32, 24);
  const W = R.wood;
  if (dir === 'x') {
    for (const t of [0.1, 0.9]) { const x = Math.round(t * 32), y = Math.round(4 + t * 16); p.rect(x - 1, y, 3, 10, W[3]); p.set(x - 1, y, W[4]); }
    for (const o of [3, 7]) p.line(2, 4 + o + 2, 30, 4 + o + 16, W[o === 3 ? 4 : 3]);
  } else {
    for (const t of [0.1, 0.9]) { const x = Math.round(32 - t * 32), y = Math.round(4 + t * 16); p.rect(x - 1, y, 3, 10, W[2]); p.set(x - 1, y, W[3]); }
    for (const o of [3, 7]) p.line(30, 4 + o + 2, 2, 4 + o + 16, W[o === 3 ? 3 : 2]);
  }
  p.outline(INK);
  return { pix: p, ax: 16, ay: 20 };
}

export function anvil() {
  const p = new Pix(24, 20);
  p.rect(9, 10, 6, 7, R.wood[2]); p.rect(6, 15, 12, 3, R.wood[1]);
  p.poly([[3, 6], [20, 6], [17, 10], [6, 10]], R.steel[2]); p.hline(3, 20, 6, R.steel[5]); p.hline(1, 3, 7, R.steel[3]);
  p.outline(INK);
  return { pix: p, ax: 12, ay: 17 };
}

export function signBoard(kind) {
  const p = new Pix(36, 40);
  p.vline(5, 10, 37, R.wood[2]); p.vline(30, 10, 37, R.wood[2]); p.vline(6, 10, 37, R.wood[3]); p.vline(31, 10, 37, R.wood[3]);
  p.rect(3, 8, 30, 20, R.plank[2]); p.rect(4, 9, 28, 18, R.plank[3]);
  p.hline(2, 33, 7, R.roofRed[3]); p.hline(1, 34, 6, R.roofRed[4]); p.hline(3, 32, 5, R.roofRed[2]);
  // notes
  const cols = ['#f7f0dc', '#ffe39a', '#cdeaff', '#ffd3e0'];
  for (let i = 0; i < 6; i++) { const x = 6 + (i % 3) * 9, y = 11 + Math.floor(i / 3) * 8; p.rect(x, y, 6, 6, cols[i % 4]); p.hline(x + 1, x + 4, y + 2, '#8a7a86'); p.hline(x + 1, x + 3, y + 4, '#8a7a86'); p.set(x + 3, y, R.red[3]); }
  p.outline(INK);
  return { pix: p, ax: 18, ay: 37 };
}

export function portal(frame) {
  const p = new Pix(48, 64);
  // stone arch
  for (let a = 0; a <= 180; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let t = 0; t < 6; t++) {
      const x = 24 + Math.cos(rad) * (18 - t), y = 28 - Math.sin(rad) * (22 - t);
      p.set(x, y, c(R.stone, t < 2 ? 4 : t > 4 ? 2 : 3));
    }
  }
  p.rect(5, 28, 6, 32, R.stone[3]); p.rect(37, 28, 6, 32, R.stone[2]); p.rect(5, 28, 2, 32, R.stone[4]);
  // runes
  for (let i = 0; i < 5; i++) { p.set(8, 32 + i * 5, R.magic[4 + (frame + i) % 2]); p.set(40, 32 + i * 5, R.magic[4 + (frame + i + 1) % 2]); }
  // swirl
  for (let y = 10; y < 60; y++) for (let x = 11; x < 37; x++) {
    const dx = (x - 24) / 13, dy = (y - 32) / 26;
    if (dy < -0.45 && dx * dx + (dy + 0.1) * (dy + 0.1) * 1.2 > 0.65) continue;
    if (Math.abs(dx) > 1) continue;
    const ang = Math.atan2(dy, dx), d = Math.sqrt(dx * dx + dy * dy);
    const s = Math.sin(ang * 3 + d * 9 - frame * 1.57);
    const k = s > 0.5 ? 5 : s > 0 ? 4 : s > -0.5 ? 3 : 2;
    p.set(x, y, c(d < 0.35 ? R.pink : R.magic, k));
  }
  p.outline(INK);
  return { pix: p, ax: 24, ay: 60 };
}

export function throne() {
  const p = new Pix(32, 48);
  p.rect(6, 4, 20, 30, R.gold[3]); p.rect(8, 6, 16, 26, R.crimson[3]); p.rect(8, 6, 4, 26, R.crimson[4]);
  for (const x of [6, 25]) { p.ellipse(x + 0.5, 4, 2.5, 3, R.gold[4]); }
  p.ellipse(16, 3, 4, 4, R.gold[4]); p.set(16, 3, R.red[4]);
  p.rect(3, 26, 26, 6, R.gold[2]); p.rect(5, 24, 22, 4, R.crimson[3]); p.hline(3, 28, 26, R.gold[4]);
  p.rect(4, 32, 4, 12, R.gold[2]); p.rect(24, 32, 4, 12, R.gold[1]);
  p.outline(INK);
  return { pix: p, ax: 16, ay: 44 };
}

export function candelabra() {
  const p = new Pix(16, 36);
  p.vline(8, 10, 33, R.gold[3]); p.vline(7, 10, 33, R.gold[4]);
  p.hline(3, 12, 12, R.gold[3]); p.vline(3, 8, 12, R.gold[3]); p.vline(12, 8, 12, R.gold[2]);
  p.rect(5, 32, 6, 2, R.gold[2]);
  for (const x of [3, 8, 12]) { p.vline(x, 4, 7, R.bone[5]); }
  p.outline(INK);
  return { pix: p, ax: 8, ay: 33 };
}

export function wallBanner(ramp, emblem = 'crown') {
  const p = new Pix(14, 26);
  p.hline(0, 13, 0, R.gold[3]);
  for (let y = 1; y < 24; y++) {
    const cut = y > 19 ? Math.abs(7 - 0) - (24 - y) * 2 : -1;
    for (let x = 1; x < 13; x++) {
      if (y > 19 && Math.abs(x - 6.5) < (y - 19) * 1.3) continue;
      p.set(x, y, c(ramp, x < 4 ? 4 : x > 9 ? 2 : 3));
    }
  }
  p.vline(1, 1, 20, R.gold[4]); p.vline(12, 1, 20, R.gold[2]);
  if (emblem === 'crown') { p.hline(4, 9, 11, R.gold[4]); p.set(4, 9, R.gold[4]); p.set(6, 8, R.gold[5]); p.set(9, 9, R.gold[4]); p.hline(4, 9, 10, R.gold[3]); }
  if (emblem === 'heart') { p.set(5, 8, R.pink[4]); p.set(8, 8, R.pink[4]); p.hline(4, 9, 9, R.pink[4]); p.hline(5, 8, 10, R.pink[3]); p.hline(6, 7, 11, R.pink[3]); }
  p.outline(INK);
  return { pix: p, ax: 7, ay: 25 };
}

export function stainedGlass() {
  const p = new Pix(16, 30);
  const cols = [R.blue[4], R.red[4], R.gold[4], R.teal[4], R.purple[4]];
  for (let y = 0; y < 28; y++) for (let x = 1; x < 15; x++) {
    if (y < 6 && Math.hypot(x - 8, y - 6) > 7) continue;
    const lead = x % 5 === 0 || y % 6 === 0;
    p.set(x, y, lead ? R.stone[1] : cols[(Math.floor(x / 5) + Math.floor(y / 6)) % cols.length]);
  }
  p.outline(R.stone[1]);
  return { pix: p, ax: 8, ay: 29 };
}

export function weaponRack() {
  const p = new Pix(24, 28);
  p.hline(2, 21, 8, R.wood[3]); p.hline(2, 21, 20, R.wood[2]); p.vline(3, 6, 26, R.wood[2]); p.vline(20, 6, 26, R.wood[1]);
  for (let i = 0; i < 3; i++) { const x = 7 + i * 5; p.vline(x, 2, 22, R.steel[4]); p.set(x, 1, R.steel[6]); p.hline(x - 1, x + 1, 16, R.gold[3]); }
  p.outline(INK);
  return { pix: p, ax: 12, ay: 26 };
}

export function bones(seed) {
  const p = new Pix(20, 10);
  p.line(2, 6, 12, 3, R.bone[4]); p.set(1, 6, R.bone[5]); p.set(13, 3, R.bone[5]);
  if (seed % 2) { p.ball(15, 6, 3, 2.5, R.bone.slice(2, 6)); p.set(14, 6, INK); p.set(16, 6, INK); }
  p.outline(INK);
  return { pix: p, ax: 10, ay: 8 };
}

export function chicken(frame) {
  const p = new Pix(16, 16);
  const b = frame === 1 ? 1 : 0;
  p.ball(7, 9 + b, 4.5, 3.6, R.bone.slice(3, 6));
  p.ball(11, 6 + b, 2.4, 2.4, R.bone.slice(3, 6));
  p.set(13, 6 + b, R.orange[4]); p.set(11, 3 + b, R.red[4]); p.set(12, 4 + b, R.red[3]); p.set(11, 6 + b, INK);
  p.set(3, 6 + b, R.bone[5]); p.set(2, 7 + b, R.bone[4]);
  p.vline(6, 13, 14, R.orange[3]); p.vline(9, 13, 14 - b, R.orange[3]);
  p.outline(INK);
  return p;
}

export function crystal(seed, ramp = R.ice) {
  const p = new Pix(16, 24);
  p.poly([[8, 2], [12, 8], [10, 21], [6, 21], [4, 8]], ramp[4]);
  p.poly([[8, 2], [12, 8], [10, 21], [8, 21]], ramp[3]);
  p.line(8, 3, 7, 18, ramp[6]);
  p.poly([[3, 12], [5, 15], [4, 21], [1, 20]], ramp[3]);
  p.outline(INK);
  return { pix: p, ax: 8, ay: 21 };
}

export function grave(seed) {
  const p = new Pix(16, 22);
  p.rect(3, 5, 10, 14, R.crypt[4]); p.ellipse(8, 5.5, 5, 4, R.crypt[4]); p.rect(9, 3, 4, 16, R.crypt[3]);
  p.hline(5, 10, 9, R.crypt[2]); p.hline(5, 9, 11, R.crypt[2]);
  p.rect(2, 18, 12, 2, R.crypt[2]);
  p.outline(INK);
  return { pix: p, ax: 8, ay: 19 };
}
