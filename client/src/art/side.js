// 2D side-view environment art: autotiled terrain, one-way platforms, parallax
// backgrounds, building facades and side-view props. 16px tiles.
import { Pix, hash2, noise2, rng, mix } from './pix.js';
import { R } from './palette.js';

export const T = 16;
const OUT = '#2b1a1c';
const c = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];

export const THEME = {
  village: {
    fill: ['#3a2622', '#523428', '#6a4632', '#82583e', '#9a6c4c'],
    top: ['#2c4a2e', '#3e6a3a', '#5a8a44', '#7eaa50', '#a8c868'],
    stone: ['#3a3236', '#54484c', '#6e6264', '#8a7e7e', '#a89c98'],
    platform: R.wood, back: null,
  },
  castle: {
    fill: ['#2a2228', '#3c3238', '#524448', '#6a5a5c', '#827070'],
    top: ['#4a3c40', '#6a5a5a', '#8a7a74', '#a8988c', '#c8b8a8'],
    stone: ['#2a2228', '#3c3238', '#524448', '#6a5a5c', '#827070'],
    platform: ['#3a2a28', '#5a4038', '#7a5a48', '#9a7a5e', '#b89a78'],
    back: ['#1e181e', '#2a222a', '#382e36', '#463a42'],
  },
  ruins: {
    fill: ['#1e2a2a', '#2c3c38', '#3e5048', '#52665a', '#6a7e6e'],
    top: ['#1e3a26', '#2c5a30', '#447a38', '#68a046', '#96c45c'],
    stone: ['#1e2a2a', '#2c3c38', '#3e5048', '#52665a', '#6a7e6e'],
    platform: ['#26302e', '#3a4844', '#52625a', '#6a7e72', '#8a9e8e'],
    back: ['#121c1c', '#1a2626', '#22302e', '#2c3c38'],
  },
};

/* ------------------------------ terrain ------------------------------ */

function solidAt(m, x, y) {
  if (x < 0 || x >= m.w) return true;
  if (y < 0) return false;
  if (y >= m.h) return true;
  const g = m.ground[y][x];
  return g === '#' || g === 'c';
}

// paint one solid tile
function solidTile(p, m, th, tx, ty) {
  const ox = tx * T, oy = ty * T;
  const code = m.ground[ty][tx];
  const ramp = code === 'c' ? th.stone : th.fill;
  // depth from the surface for darkening
  let depth = 0;
  for (let k = 1; k <= 3; k++) if (solidAt(m, tx, ty - k)) depth++; else break;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const gy = oy + y, gx = ox + x;
    const row = Math.floor(gy / 8);
    const off = row % 2 ? 6 : 0;
    const bx = Math.floor((gx + off) / 12);
    const mortar = gy % 8 === 0 || (gx + off) % 12 === 0;
    const h = hash2(bx, row, 7);
    let k = 3 - Math.min(2, depth) + (h > 0.75 ? 1 : h < 0.2 ? -1 : 0);
    if (mortar) k -= 2;
    if (noise2(gx / 9, gy / 7, 5) > 0.72) k -= 1; // cracks / grime
    p.set(gx, gy, c(ramp, k));
  }
  const L = !solidAt(m, tx - 1, ty), Rt = !solidAt(m, tx + 1, ty), U = !solidAt(m, tx, ty - 1), D = !solidAt(m, tx, ty + 1);
  if (L) for (let y = 0; y < T; y++) { p.set(ox, oy + y, OUT); p.set(ox + 1, oy + y, c(ramp, 1)); }
  if (Rt) for (let y = 0; y < T; y++) { p.set(ox + T - 1, oy + y, OUT); p.set(ox + T - 2, oy + y, c(ramp, 1)); }
  if (D) for (let x = 0; x < T; x++) { p.set(ox + x, oy + T - 1, OUT); if (hash2(ox + x, oy, 4) > 0.7) p.set(ox + x, oy + T, c(ramp, 0)); }
  if (U) {
    // surface lip
    const top = code === 'c' ? th.stone : th.top;
    for (let x = 0; x < T; x++) {
      const gx = ox + x;
      const lip = code === 'c' ? 3 : 4 + Math.round(hash2(gx, oy, 2) * 2);
      for (let y = 0; y < lip; y++) p.set(gx, oy + y, c(top, y === 0 ? 4 : y < 2 ? 3 : 2));
      p.set(gx, oy + lip, c(top, 0));
      if (code === 'c') { if (gx % 8 === 0) p.set(gx, oy + 1, c(top, 1)); continue; }
      // grass blades / moss tufts above the surface
      const hgt = hash2(gx, oy, 9);
      if (hgt > 0.45) p.set(gx, oy - 1, c(top, 3));
      if (hgt > 0.8) { p.set(gx, oy - 2, c(top, 4)); }
      // little flowers on village grass
      if (m.theme === 'village' && hgt > 0.975) { p.set(gx, oy - 3, ['#ffe27a', '#ffb3c8', '#f2f6f4'][Math.floor(hash2(gx, 1, 1) * 3)]); p.set(gx, oy - 2, c(top, 2)); }
      // hanging moss in the ruins
      if (m.theme === 'ruins' && hash2(gx, oy, 13) > 0.9) for (let y = lip; y < lip + 3 + Math.floor(hash2(gx, 2, 5) * 5); y++) p.set(gx, oy + y, c(top, 2));
    }
    for (let x = 0; x < T; x++) p.set(ox + x, oy - (hash2(ox + x, oy, 9) > 0.45 ? 2 : 1), null);
    p.hline(ox, ox + T - 1, oy - 1, null);
    // outline above lip
    for (let x = 0; x < T; x++) { const gx = ox + x; if (!(p.alpha(gx, oy - 1))) p.set(gx, oy - 1, OUT); }
  }
}

function platformTile(p, th, tx, ty, left, right, m) {
  const ox = tx * T, oy = ty * T;
  const r = th.platform;
  for (let x = 0; x < T; x++) {
    const gx = ox + x;
    p.set(gx, oy, OUT);
    for (let y = 1; y < 5; y++) p.set(gx, oy + y, c(r, y === 1 ? 4 : y < 3 ? 3 : 2));
    p.set(gx, oy + 5, c(r, 0)); p.set(gx, oy + 6, OUT);
    if (gx % 12 === 0) p.vline(gx, oy + 1, oy + 4, c(r, 1)); // plank seams
    if (m.theme === 'ruins' && hash2(gx, oy, 3) > 0.7) p.set(gx, oy + 1, c(THEME.ruins.top, 3));
  }
  if (left) { p.vline(ox, oy, oy + 6, OUT); }
  if (right) { p.vline(ox + T - 1, oy, oy + 6, OUT); }
  // brackets under the ends
  const bracket = (x, dir) => { for (let i = 0; i < 6; i++) { p.set(x + i * dir, oy + 7 + i, OUT); p.set(x + i * dir, oy + 6 + i, c(r, 1)); } };
  if (left) bracket(ox + 2, 1);
  if (right) bracket(ox + T - 3, -1);
}

function backTile(p, th, tx, ty) {
  const ox = tx * T, oy = ty * T;
  const r = th.back;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const gx = ox + x, gy = oy + y;
    const row = Math.floor(gy / 10), off = row % 2 ? 8 : 0;
    const mortar = gy % 10 === 0 || (gx + off) % 16 === 0;
    const h = hash2(Math.floor((gx + off) / 16), row, 11);
    p.set(gx, gy, c(r, mortar ? 0 : h > 0.8 ? 3 : h < 0.25 ? 1 : 2));
  }
}

// Bake a whole level into chunk canvases (max 1024px wide each)
export function bakeLevel(m) {
  const th = THEME[m.theme] || THEME.village;
  const W = m.w * T, H = m.h * T;
  const CH = 1024;
  const out = [];
  for (let cx = 0; cx < W; cx += CH) {
    const cw = Math.min(CH, W - cx);
    const back = new Pix(cw, H), front = new Pix(cw, H);
    const t0 = Math.floor(cx / T) - 1, t1 = Math.ceil((cx + cw) / T) + 1;
    // draw into a temporary full-width-offset pix by translating coordinates
    const shift = (pix) => ({ set: (x, y, col) => pix.set(x - cx, y, col), alpha: (x, y) => pix.alpha(x - cx, y), vline: (x, a, b, col) => pix.vline(x - cx, a, b, col), hline: (a, b, y, col) => pix.hline(a - cx, b - cx, y, col) });
    const F = shift(front), B = shift(back);
    for (let ty = 0; ty < m.h; ty++) for (let tx = Math.max(0, t0); tx < Math.min(m.w, t1); tx++) {
      const g = m.ground[ty][tx];
      if (th.back && m.back && m.back[ty][tx]) backTile(B, th, tx, ty);
      if (g === '#' || g === 'c') solidTile(F, m, th, tx, ty);
      else if (g === '=') {
        const left = m.ground[ty][tx - 1] !== '=', right = m.ground[ty][tx + 1] !== '=';
        platformTile(F, th, tx, ty, left, right, m);
      }
    }
    out.push({ x: cx, back: th.back ? back.canvas() : null, front: front.canvas() });
  }
  return out;
}

/* ------------------------------ parallax ------------------------------ */

function grad(g, w, h, stops) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function silhouette(p, w, h, base, amp, freq, col, seed, jag = 0) {
  for (let x = 0; x < w; x++) {
    // tileable noise via wrapping
    const t = x / w;
    const v = Math.sin(t * Math.PI * 2 * freq + seed) * 0.5 + Math.sin(t * Math.PI * 2 * (freq * 2 + 1) + seed * 2) * 0.25 + (jag ? (hash2(Math.floor(x / 3), seed, 1) - 0.5) * jag : 0);
    const top = Math.round(h - base - v * amp);
    for (let y = top; y < h; y++) p.set(x, y, col);
  }
}

// returns [{canvas, factor}] far -> near
export function parallax(theme) {
  const W = 480, H = 270;
  const layers = [];
  const sky = document.createElement('canvas'); sky.width = W; sky.height = H;
  const g = sky.getContext('2d');
  if (theme === 'village') {
    grad(g, W, H, [[0, '#2a2458'], [0.45, '#7a4a8a'], [0.75, '#d8806a'], [1, '#f4c08a']]);
    g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(360, 150, 18, 0, 7); g.fill();
    const glow = g.createRadialGradient(360, 150, 10, 360, 150, 90); glow.addColorStop(0, 'rgba(255,220,160,.5)'); glow.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) g.fillRect(hash2(i, 1, 1) * W | 0, hash2(i, 2, 1) * 90 | 0, 1, 1);
    layers.push({ canvas: sky, factor: 0.02 });
    const clouds = new Pix(W, H);
    for (let i = 0; i < 7; i++) { const x = hash2(i, 3, 2) * W, y = 40 + hash2(i, 4, 2) * 70; for (let k = 0; k < 5; k++) clouds.ellipse(x + k * 9 - 18, y + Math.abs(k - 2) * 2, 12 - Math.abs(k - 2) * 2, 5, '#f6c8b8aa'); }
    layers.push({ canvas: clouds.canvas(), factor: 0.06 });
    const far = new Pix(W, H);
    silhouette(far, W, H, 80, 34, 2, '#5a3e78', 1);
    // distant castle on the far hills
    const cx = 120; far.rect(cx, H - 150, 34, 40, '#4a3268'); for (let i = 0; i < 5; i++) far.rect(cx + i * 7, H - 154, 4, 4, '#4a3268'); far.rect(cx + 12, H - 176, 10, 30, '#4a3268'); far.poly([[cx + 10, H - 176], [cx + 24, H - 176], [cx + 17, H - 190]], '#4a3268'); far.set(cx + 17, H - 165, '#ffd27a');
    layers.push({ canvas: far.canvas(), factor: 0.12 });
    const mid = new Pix(W, H);
    silhouette(mid, W, H, 50, 18, 3, '#3a2c52', 4);
    for (let i = 0; i < 16; i++) { const x = (i * 31 + hash2(i, 9, 1) * 12) % W, top = H - 60 - hash2(i, 5, 1) * 26; mid.ball(x, top, 11, 13, ['#2c2444', '#342a4e', '#3a3058', '#423664']); mid.rect(x - 1, top + 10, 3, 40, '#2c2444'); }
    layers.push({ canvas: mid.canvas(), factor: 0.3 });
  } else if (theme === 'castle') {
    grad(g, W, H, [[0, '#120e16'], [0.6, '#2a1e28'], [1, '#3a2a30']]);
    layers.push({ canvas: sky, factor: 0.02 });
    const far = new Pix(W, H);
    for (let i = 0; i < 4; i++) {
      const x = i * 120 + 20;
      for (let y = 40; y < H; y++) for (let k = 0; k < 80; k++) { const dx = k - 40; if (y < 80 && dx * dx + (y - 80) * (y - 80) * 1.4 > 1600) continue; far.set(x + k, y, '#241a22'); }
      // stained glass window
      const cols = ['#5a7ad8', '#d85a6a', '#f2c45a', '#5ab88a', '#a86ad8'];
      for (let y = 70; y < 150; y++) for (let k = 0; k < 22; k++) { const dx = k - 11; if (y < 81 && dx * dx + (y - 81) * (y - 81) > 121) continue; const lead = k % 7 === 0 || y % 12 === 0; far.set(x + 29 + k, y, lead ? '#1a1218' : cols[(Math.floor(k / 7) + Math.floor(y / 12)) % 5] + 'cc'); }
    }
    layers.push({ canvas: far.canvas(), factor: 0.15 });
    const mid = new Pix(W, H);
    for (let i = 0; i < 6; i++) { const x = i * 80 + 30; mid.rect(x, 20, 18, H, '#2e2228'); mid.rect(x + 2, 20, 4, H, '#3a2c32'); mid.rect(x - 4, H - 40, 26, 8, '#3a2c32'); mid.rect(x - 4, 20, 26, 8, '#3a2c32'); }
    layers.push({ canvas: mid.canvas(), factor: 0.35 });
  } else {
    const boss = theme === 'boss';
    grad(g, W, H, boss ? [[0, '#140a10'], [0.55, '#3a1a1e'], [1, '#6a2a22']] : [[0, '#081414'], [0.5, '#123028'], [1, '#2e5a40']]);
    // light shafts
    for (let i = 0; i < 5; i++) { const x = 40 + i * 100; const gr = g.createLinearGradient(x, 0, x + 60, H); gr.addColorStop(0, boss ? 'rgba(255,140,90,.18)' : 'rgba(190,255,200,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 26, 0); g.lineTo(x + 90, H); g.lineTo(x + 40, H); g.fill(); }
    layers.push({ canvas: sky, factor: 0.02 });
    const far = new Pix(W, H);
    const fc = boss ? '#2a1418' : '#10241e';
    silhouette(far, W, H, 60, 20, 2, fc, 2);
    // ruined temple columns + arches
    for (let i = 0; i < 6; i++) { const x = i * 80 + 10, top = 60 + hash2(i, 2, 3) * 50; far.rect(x, top, 14, H, fc); far.rect(x - 3, top, 20, 5, fc); if (i % 2 === 0) for (let k = 0; k < 66; k++) { const a = (k / 66) * Math.PI; far.rect(x + 7 + 40 - Math.cos(a) * 40, top - Math.sin(a) * 26, 3, 3, fc); } }
    layers.push({ canvas: far.canvas(), factor: 0.12 });
    const mid = new Pix(W, H);
    const mc = boss ? '#1c0c10' : '#0a1a14';
    silhouette(mid, W, H, 30, 14, 3, mc, 7, 6);
    for (let i = 0; i < 22; i++) { const x = hash2(i, 7, 1) * W, len = 30 + hash2(i, 8, 1) * 90; for (let y = 0; y < len; y++) { mid.set(x + Math.sin(y / 9 + i) * 2, y, mc); if (y % 7 === 0) mid.set(x + 1 + Math.sin(y / 9 + i) * 2, y, mc); } }
    for (let i = 0; i < 8; i++) { const x = i * 60 + hash2(i, 3, 3) * 20; mid.ball(x, H - 36, 18, 12, [mc, mc, mc, mc]); }
    layers.push({ canvas: mid.canvas(), factor: 0.3 });
  }
  return layers;
}

/* ------------------------------ facades ------------------------------ */

/** cfg: { w, h (tiles), wall: 'plaster'|'stone'|'plank'|'castle', roof: ramp|null, roofH, door, windows, chimney, sign, banner, tower, forge, awning } */
export function facade(cfg, seed = 1) {
  const W = cfg.w * T, Hh = cfg.h * T;
  const roofH = cfg.roof ? (cfg.roofH ?? 22) : 0;
  const pad = 8;
  const p = new Pix(W + pad * 2, Hh + roofH + pad + (cfg.chimney ? 14 : 0) + (cfg.tower ? 20 : 0));
  const by = p.h - Hh; // wall top y
  const x0 = pad;
  const wallRamp = cfg.wall === 'stone' || cfg.wall === 'castle' ? (cfg.wall === 'castle' ? THEME.castle.fill : THEME.village.stone) : cfg.wall === 'plank' ? R.plank : ['#6a5a58', '#9a8478', '#c4ae98', '#e0ccb2', '#f2e4cc'];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const gx = x0 + x, gy = by + y;
    let col;
    if (cfg.wall === 'plaster') {
      col = c(wallRamp, 2 + (hash2(x, y, seed) > 0.9 ? 1 : 0));
      const beam = x < 3 || x > W - 4 || y < 3 || y === Math.floor(Hh * 0.5) || (x % 32 < 3);
      if (beam) col = c(R.wood, 2 + (x < 2 ? 1 : 0));
      if (y > Hh - 10) col = c(THEME.village.stone, 2 + ((Math.floor(x / 10) + Math.floor(y / 5)) % 2));
    } else if (cfg.wall === 'plank') {
      col = c(R.plank, 2 + (x % 12 === 0 ? -2 : hash2(Math.floor(x / 12), 0, seed) > 0.6 ? 1 : 0));
    } else {
      const row = Math.floor(y / 8), off = row % 2 ? 7 : 0;
      const m = y % 8 === 0 || (x + off) % 14 === 0;
      col = c(wallRamp, m ? 0 : 2 + (hash2(Math.floor((x + off) / 14), row, seed) > 0.75 ? 1 : 0));
    }
    // ground shadow
    if (y > Hh - 4) col = mix(col, '#1a1012', 0.35);
    p.set(gx, gy, col);
  }
  // windows
  const nw = cfg.windows ?? 2;
  for (let i = 0; i < nw; i++) {
    const wx = x0 + Math.round(((i + 1) / (nw + 1)) * W) - 6, wy = by + 10;
    if (cfg.door !== false && Math.abs(wx + 6 - (x0 + W / 2)) < 16 && Hh < 70) continue;
    for (let y = 0; y < 14; y++) for (let x = 0; x < 12; x++) {
      const frame = x === 0 || x === 11 || y === 0 || y === 13 || x === 6 || y === 7;
      p.set(wx + x, wy + y, frame ? c(R.wood, 1) : y < 7 ? '#ffe39a' : '#f2b55a');
    }
    p.hline(wx - 1, wx + 12, wy + 14, c(R.wood, 3));
  }
  // door
  if (cfg.door !== false) {
    const dw = cfg.gate ? 36 : 14, dh = cfg.gate ? 46 : 24;
    const dx = x0 + Math.round(W / 2 - dw / 2), dy = by + Hh - dh;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const ax = (x - dw / 2) / (dw / 2), ay = (dh - y) / dh;
      if (y < dw / 2 && ax * ax + ((dw / 2 - y) / (dw / 2)) ** 2 > 1) continue;
      let col = cfg.gate ? (y % 6 === 0 || x % 8 === 0 ? '#3a3036' : '#1a1418') : c(R.wood, 2 + (x % 5 === 0 ? -1 : 0));
      if (!cfg.gate && x === dw - 4 && y === Math.round(dh * 0.6)) col = R.gold[4];
      p.set(dx + x, dy + y, col);
      void ay;
    }
  }
  // forge glow
  if (cfg.forge) for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) p.set(x0 + 8 + x, by + Hh - 16 + y, y < 3 ? '#2a1a18' : mix('#ff7a2a', '#ffe08a', hash2(x, y, 3) * 0.7));
  // awning
  if (cfg.awning) for (let y = 0; y < 9; y++) for (let x = -4; x < W + 4; x++) { const s = Math.floor((x + 40) / 8) % 2; p.set(x0 + x, by + 30 + y + (y === 8 && x % 4 < 2 ? 1 : 0), s ? c(cfg.awning, y < 2 ? 4 : 3) : y < 2 ? '#fff4e0' : '#eadcc8'); }
  // roof
  if (cfg.roof) {
    const rr = cfg.roof;
    for (let y = 0; y < roofH; y++) {
      const t = y / roofH;
      const half = Math.round((W / 2 + 8) * t + 6);
      for (let x = -half; x <= half; x++) {
        const gx = x0 + W / 2 + x, gy = by - roofH + y;
        let k = 2 + (x < 0 ? 1 : 0);
        if ((y + (Math.floor((x + 200) / 6) % 2) * 2) % 4 === 0) k -= 1;
        if (Math.abs(x) >= half - 1) k = 0;
        p.set(gx, gy, c(rr, k));
      }
    }
    p.hline(x0 - 8, x0 + W + 7, by, c(rr, 0));
  }
  if (cfg.chimney) { const cx = x0 + W - 24; for (let y = 0; y < 18; y++) for (let x = 0; x < 8; x++) p.set(cx + x, by - roofH + 4 - y + 12, c(THEME.village.stone, y % 4 === 0 ? 1 : x < 3 ? 3 : 2)); }
  if (cfg.tower) { const tw = Math.round(W * 0.5), tx = x0 + Math.round(W / 4); for (let y = 0; y < 20; y++) for (let x = 0; x < tw; x++) p.set(tx + x, by - roofH - 20 + y + 6, c(wallRamp, y % 8 === 0 ? 0 : 2)); }
  if (cfg.crenel) for (let x = 0; x < W; x += 10) p.rect(x0 + x, by - 7, 6, 7, c(wallRamp, 3));
  if (cfg.banner) for (const bx of [x0 + 14, x0 + W - 24]) for (let y = 0; y < 28; y++) for (let x = 0; x < 10; x++) { if (y > 22 && Math.abs(x - 4.5) < (y - 22)) continue; p.set(bx + x, by + 8 + y, y === 0 ? R.gold[4] : c(cfg.banner, x < 3 ? 4 : 3)); }
  if (cfg.sign) { const sx = x0 + W - 18, sy = by + 6; p.hline(sx - 6, sx + 4, sy, R.wood[1]); p.rect(sx - 4, sy + 2, 14, 10, R.plank[3]); p.rect(sx - 3, sy + 3, 12, 8, R.plank[4]); p.set(sx + 3, sy + 6, cfg.sign); p.set(sx + 2, sy + 6, cfg.sign); p.set(sx + 3, sy + 7, cfg.sign); }
  p.outline(OUT);
  return { pix: p, ax: x0, ay: p.h };
}

/* ------------------------------ props ------------------------------ */

export function crateSide(seed) {
  const p = new Pix(16, 16);
  p.rect(1, 2, 14, 13, R.plank[3]);
  for (let y = 2; y < 15; y += 4) p.hline(1, 14, y, R.plank[1]);
  p.line(1, 2, 14, 14, R.plank[2]); p.rect(1, 2, 2, 13, R.plank[4]); p.rect(13, 2, 2, 13, R.plank[2]);
  if (seed % 2) for (let i = 0; i < 4; i++) p.set(3 + i * 3, 2, R.moss[4]);
  p.outline(OUT);
  return { pix: p, ax: 8, ay: 15 };
}

export function chestSide(open) {
  const p = new Pix(22, 18);
  p.rect(2, 8, 18, 9, R.wood[3]); p.rect(2, 8, 18, 2, R.wood[4]);
  if (!open) { p.rect(2, 3, 18, 6, R.wood[3]); p.ellipse(11, 4, 9, 2.5, R.wood[4]); }
  else { p.rect(2, 0, 18, 4, R.wood[2]); p.rect(4, 6, 14, 3, '#ffe27a'); p.set(8, 5, '#fff6c0'); p.set(13, 5, '#fff6c0'); }
  for (const x of [2, 19]) p.vline(x, open ? 6 : 3, 16, R.gold[3]);
  p.hline(2, 19, 8, R.gold[3]); p.rect(10, 8, 3, 3, R.gold[4]); p.set(11, 9, OUT);
  p.outline(OUT);
  return { pix: p, ax: 11, ay: 17 };
}

export function fountainSide(frame = 0) {
  const p = new Pix(64, 48);
  // basin
  p.rect(4, 32, 56, 14, THEME.village.stone[2]); p.rect(4, 32, 56, 3, THEME.village.stone[4]); p.rect(4, 44, 56, 2, THEME.village.stone[1]);
  for (let x = 8; x < 60; x += 10) p.vline(x, 35, 43, THEME.village.stone[1]);
  p.rect(6, 29, 52, 3, R.water[4]);
  // column + bowl
  p.rect(28, 12, 8, 20, THEME.village.stone[3]); p.rect(28, 12, 2, 20, THEME.village.stone[4]);
  p.ellipse(32, 12, 12, 3, THEME.village.stone[3]); p.ellipse(32, 11, 10, 2, R.water[4]);
  // heart emblem
  p.set(30, 20, R.pink[4]); p.set(31, 20, R.pink[4]); p.set(33, 20, R.pink[4]); p.set(34, 20, R.pink[3]); p.hline(30, 34, 21, R.pink[3]); p.hline(31, 33, 22, R.pink[2]); p.set(32, 23, R.pink[2]);
  // water arcs
  for (let i = 0; i < 18; i++) { const t = i / 18; const off = (frame * 3 + i) % 4 === 0 ? 1 : 0; p.set(32 - 4 - t * 16, 8 + t * t * 20 + off, R.water[5]); p.set(32 + 4 + t * 16, 8 + t * t * 20 + off, R.water[5]); }
  p.vline(32, 2, 9, R.water[6]);
  p.outline(OUT);
  return { pix: p, ax: 32, ay: 47 };
}

export function stallSide(ramp) {
  const p = new Pix(48, 40);
  p.rect(4, 24, 40, 15, R.plank[3]); p.rect(4, 24, 40, 3, R.plank[4]); for (let x = 8; x < 44; x += 8) p.vline(x, 27, 38, R.plank[1]);
  const goods = [R.red[4], R.orange[4], R.leaf[5], R.gold[4], R.purple[4]];
  for (let i = 0; i < 9; i++) p.ellipse(8 + i * 4, 22, 1.8, 1.6, goods[i % 5]);
  p.vline(5, 6, 24, R.wood[3]); p.vline(42, 6, 24, R.wood[2]);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 48; x++) { const s = Math.floor(x / 6) % 2; p.set(x, 2 + y, s ? c(ramp, y < 3 ? 4 : 3) : y < 3 ? '#fff4e0' : '#e9dcc8'); }
  for (let x = 0; x < 48; x += 3) p.set(x, 12, c(ramp, 1));
  p.outline(OUT);
  return { pix: p, ax: 24, ay: 39 };
}

export function fenceSide() {
  const p = new Pix(32, 16);
  for (const x of [2, 15, 28]) { p.rect(x, 2, 3, 14, R.wood[3]); p.set(x + 1, 1, R.wood[4]); }
  p.rect(0, 5, 32, 2, R.wood[4]); p.rect(0, 10, 32, 2, R.wood[3]);
  p.outline(OUT);
  return { pix: p, ax: 16, ay: 15 };
}

export function sealGate(frame = 0) {
  // thorny vine wall with glowing runes: blocks the way until the chamber is cleared
  const p = new Pix(20, 64);
  for (let y = 0; y < 64; y++) {
    const w = 3 + Math.round(Math.sin(y / 5 + frame) * 1.5);
    for (let x = 10 - w; x <= 10 + w; x++) p.set(x, y, c(R.leaf, 2 + ((x + y) % 3 === 0 ? 1 : 0)));
    if (y % 6 === 0) { p.set(10 - w - 2, y, R.bone[4]); p.set(10 + w + 2, y + 3, R.bone[4]); }
  }
  for (let i = 0; i < 4; i++) { const y = 10 + i * 14; p.ellipse(10, y, 2.5, 3, (i + frame) % 2 ? '#8dffb4' : '#c8ffd8'); }
  p.outline(OUT);
  return p;
}

export function windowGlow() {
  const p = new Pix(18, 30);
  const cols = ['#5a7ad8', '#d85a6a', '#f2c45a', '#5ab88a', '#a86ad8'];
  for (let y = 0; y < 30; y++) for (let x = 0; x < 18; x++) {
    if (y < 9 && (x - 9) * (x - 9) + (y - 9) * (y - 9) > 81) continue;
    p.set(x, y, x % 6 === 0 || y % 8 === 0 ? '#2a1e24' : cols[(Math.floor(x / 6) + Math.floor(y / 8)) % 5]);
  }
  p.outline(OUT);
  return { pix: p, ax: 9, ay: 29 };
}

export function rubble(seed) {
  const p = new Pix(24, 12);
  const r = rng(seed);
  for (let i = 0; i < 5; i++) p.ball(4 + r() * 16, 8 + r() * 2, 3 + r() * 2, 2.5, THEME.ruins.fill.slice(1, 5));
  p.outline(OUT);
  return { pix: p, ax: 12, ay: 11 };
}
