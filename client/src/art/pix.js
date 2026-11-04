// Pixel buffer painter used to generate every sprite in the game at boot.
// All art in Bright Hearts is original and drawn by these routines.

export function hex(c) {
  if (typeof c === 'number') return c;
  if (!c) return 0;
  let s = c.replace('#', '');
  if (s.length === 3) s = s.split('').map((x) => x + x).join('');
  let a = 255;
  if (s.length === 8) { a = parseInt(s.slice(6, 8), 16); s = s.slice(0, 6); }
  const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
  // little-endian ABGR for Uint32Array over ImageData
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function rgb(c) {
  const v = hex(c);
  return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
}

export function toHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// seeded rng (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// smooth value noise in [0,1]
export function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (!this.inb(x, y) || c == null) return;
    const v = hex(c);
    const a = v >>> 24;
    if (a === 255) { this.data[y * this.w + x] = v; return; }
    if (a === 0) return;
    // alpha blend over
    const d = this.data[y * this.w + x];
    const da = (d >>> 24) / 255, sa = a / 255;
    const oa = sa + da * (1 - sa);
    const ch = (sh) => {
      const s = (v >>> sh) & 255, dd = (d >>> sh) & 255;
      return Math.round((s * sa + dd * da * (1 - sa)) / (oa || 1));
    };
    this.data[y * this.w + x] = ((Math.round(oa * 255) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
  }
  get(x, y) { return this.inb(x, y) ? this.data[(y | 0) * this.w + (x | 0)] : 0; }
  alpha(x, y) { return this.get(x, y) >>> 24; }
  clear(x, y) { if (this.inb(x, y)) this.data[y * this.w + x] = 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  // ellipse shaded with a ramp, light from top-left
  ball(cx, cy, rx, ry, ramp, lx = -0.5, ly = -0.6) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d);
        const l = Math.max(0, -(dx * lx + dy * ly) * 0.8 + nz * 0.5);
        const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length * 0.999 + (hash2(x, y, 9) - 0.5) * 0.6)));
        this.set(x, y, ramp[idx]);
      }
  }
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      const yy = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
          xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
    }
  }
  // outline every opaque region with color c (4-neighbour)
  outline(c, onlyOuter = true) {
    const src = this.data.slice();
    const v = hex(c);
    const W = this.w;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < W; x++) {
        if (src[y * W + x] >>> 24) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < this.h && (src[yy * W + xx] >>> 24) > 100;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.data[y * W + x] = v;
      }
    return this;
  }
  // darken outline-adjacent bottom pixels a bit for depth (selective outline feel)
  shadeEdges(amount = 0.25) {
    const src = this.data.slice();
    const W = this.w;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < W; x++) {
        const v = src[y * W + x];
        if (!(v >>> 24)) continue;
        const below = y + 1 < this.h ? src[(y + 1) * W + x] >>> 24 : 0;
        if (!below) {
          const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
          const k = 1 - amount;
          this.data[y * W + x] = ((v & 0xff000000) | (Math.round(b * k + 20 * amount) << 16) | (Math.round(g * k) << 8) | Math.round(r * k + 10 * amount)) >>> 0;
        }
      }
    return this;
  }
  blit(src, dx, dy, flip = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + (flip ? src.w - 1 - x : x)];
        if (v >>> 24) this.set(dx + x, dy + y, v);
      }
  }
  // recolor every pixel by a function
  map(fn) {
    for (let i = 0; i < this.data.length; i++) {
      const v = this.data[i];
      if (!(v >>> 24)) continue;
      const out = fn(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24, i % this.w, (i / this.w) | 0);
      if (out) this.data[i] = hex(out);
    }
    return this;
  }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    g.putImageData(img, 0, 0);
    return c;
  }
  dataURL() { return this.canvas().toDataURL(); }
}

// Build a horizontal frame strip from Pix frames
export function strip(frames) {
  const w = frames[0].w, h = frames[0].h;
  const out = new Pix(w * frames.length, h);
  frames.forEach((f, i) => out.blit(f, i * w, 0));
  return out;
}
