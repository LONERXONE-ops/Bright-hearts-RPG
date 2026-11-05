// Effects + lights. Lights are smooth hi-res gradients over pixel art
// (the Children of Morta / Octopath trick).
import { Pix, strip } from './pix.js';
import { R, INK } from './palette.js';

export function lightCanvas(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

export function vignetteCanvas(w = 256, h = 160) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  grd.addColorStop(0, 'rgba(10,6,24,0)');
  grd.addColorStop(1, 'rgba(10,6,24,0.75)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  return c;
}

export function shadow() {
  const p = new Pix(20, 8);
  p.ellipse(10, 4, 9, 3.2, '#1b123066');
  p.ellipse(10, 4, 6, 2.2, '#1b123044');
  return p;
}

export function slash(frame) {
  const p = new Pix(40, 32);
  const a0 = -1.2 + frame * 0.5, a1 = a0 + 1.6;
  for (let a = a0; a < a1; a += 0.02) {
    const t = (a - a0) / (a1 - a0);
    for (let r = 10; r < 16; r++) {
      const x = 14 + Math.cos(a) * r * 1.3, y = 16 + Math.sin(a) * r * 0.8;
      const edge = r > 14;
      p.set(x, y, edge ? '#ffffff' : t > 0.7 ? '#fff1a8' : t > 0.35 ? '#ffd27acc' : '#ffa25a66');
    }
  }
  return p;
}

export function orb(ramp, size = 6) {
  const p = new Pix(size * 2 + 4, size * 2 + 4);
  const cc = size + 2;
  p.ellipse(cc, cc, size + 1, size + 1, ramp[2] + '88');
  p.ellipse(cc, cc, size, size, ramp[3]);
  p.ellipse(cc, cc, size * 0.65, size * 0.65, ramp[4]);
  p.ellipse(cc - 1, cc - 1, size * 0.35, size * 0.35, ramp[5] || '#ffffff');
  return p;
}

export function bullet() {
  const p = new Pix(10, 4);
  p.hline(0, 6, 1, '#ffc34a'); p.hline(2, 9, 2, '#fff1a8'); p.hline(0, 4, 2, '#ff8a2b88');
  return p;
}

export function puff(frame, ramp) {
  const p = new Pix(32, 32);
  const r = 4 + frame * 3;
  const a = Math.max(0, 1 - frame / 5);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + frame * 0.3;
    const x = 16 + Math.cos(ang) * r, y = 16 + Math.sin(ang) * r * 0.75;
    p.ellipse(x, y, 3.5 - frame * 0.4, 3 - frame * 0.4, ramp[Math.min(ramp.length - 1, 4 - Math.min(3, frame))]);
  }
  if (frame < 2) p.ellipse(16, 16, 6 - frame * 2, 5 - frame * 2, ramp[ramp.length - 1]);
  void a;
  return p;
}

export function ring(frame, ramp) {
  const p = new Pix(64, 32);
  const r = 8 + frame * 5;
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    const x = 32 + Math.cos(a) * r * 1.6, y = 16 + Math.sin(a) * r * 0.8;
    p.set(x, y, ramp[5 - Math.min(3, frame)] || ramp[3]);
    p.set(x, y + 1, ramp[3]);
  }
  return p;
}

export function puddle(seed, ramp = R.toxic) {
  const p = new Pix(48, 24);
  p.ellipse(24, 12, 20, 8, ramp[1] + 'cc');
  p.ellipse(22, 11, 15, 6, ramp[2] + 'dd');
  p.ellipse(28, 13, 9, 3.5, ramp[3] + 'dd');
  for (let i = 0; i < 6; i++) p.ellipse(10 + i * 6, 9 + (i % 3) * 2, 1.3, 1, ramp[5]);
  return p;
}

export function spark() {
  const p = new Pix(5, 5);
  p.set(2, 0, '#ffffff'); p.set(2, 4, '#ffffff'); p.set(0, 2, '#ffffff'); p.set(4, 2, '#ffffff'); p.set(2, 2, '#ffffff');
  p.set(1, 2, '#fff1a8'); p.set(3, 2, '#fff1a8'); p.set(2, 1, '#fff1a8'); p.set(2, 3, '#fff1a8');
  return p;
}

export function dot(col) {
  const p = new Pix(2, 2);
  p.rect(0, 0, 2, 2, col);
  return p;
}

export function coin(frame) {
  const p = new Pix(8, 8);
  const w = [3, 2, 1, 2][frame % 4];
  p.ellipse(4, 4, w + 0.5, 3.5, R.gold[3]);
  if (w > 1) p.ellipse(4 - 0.5, 3.5, w - 0.5, 2.5, R.gold[4]);
  p.set(4, 2, R.gold[5]);
  p.outline(INK);
  return p;
}

export function sentry(frame) {
  const p = new Pix(24, 28);
  // tripod
  p.line(12, 18, 5, 26, R.steel[2]); p.line(12, 18, 19, 26, R.steel[2]); p.line(12, 18, 12, 26, R.steel[3]);
  // body
  p.ball(12, 13, 6, 5, R.teal.slice(1, 6));
  p.hline(12, 22, 12, R.steel[4]); p.hline(12, 22, 13, R.steel[2]);
  p.set(9, 11, frame ? '#ff5050' : '#ffd23f');
  if (frame) { p.set(23, 12, '#fff1a8'); p.set(23, 13, '#ffc34a'); }
  p.outline(INK);
  return p;
}

export function snare() {
  const p = new Pix(24, 12);
  for (let a = 0; a < Math.PI * 2; a += 0.05) p.set(12 + Math.cos(a) * 9, 6 + Math.sin(a) * 4, R.steel[3]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.set(12 + Math.cos(a) * 7, 6 + Math.sin(a) * 3, R.steel[5]); }
  p.ellipse(12, 6, 2, 1, R.orange[4]);
  return p;
}

export function arrow() {
  const p = new Pix(14, 5);
  p.hline(1, 10, 2, R.wood[4]); p.set(0, 1, R.red[4]); p.set(0, 3, R.red[4]); p.set(1, 1, R.red[3]); p.set(1, 3, R.red[3]);
  p.set(11, 1, R.steel[4]); p.set(11, 3, R.steel[4]); p.hline(11, 13, 2, R.steel[6]);
  return p;
}
