// Enemy sprites for Dungeon 1 (Overgrown Ruins) plus the Three-Headed Snake boss.
import { Pix, strip, mix } from './pix.js';
import { R, INK } from './palette.js';

const c = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];

// coiled snake: frames idle0, idle1, move0, move1, attack, hurt
function viper(frame, ramp = R.snake, belly = R.snakeBelly, hood = false) {
  const p = new Pix(32, 32);
  const t = frame;
  const lift = t === 4 ? -5 : t === 1 ? -1 : 0;
  const slide = t === 2 ? 1 : t === 3 ? -1 : 0;
  // coil body (two stacked rings)
  p.ball(16 + slide, 26, 9, 4.2, [ramp[1], ramp[2], ramp[3], ramp[4]]);
  p.ball(15 - slide, 23, 6.5, 3.4, [ramp[2], ramp[3], ramp[4], ramp[5]]);
  // pattern diamonds on coil
  for (let i = -6; i <= 6; i += 4) { p.set(16 + i + slide, 25, ramp[0]); p.set(16 + i + slide + 1, 26, ramp[0]); }
  // neck rising
  const nx = 14 - slide, ny = 21;
  const hx = 18 + (t === 4 ? 5 : 0), hy = 9 + lift + (t === 1 ? 1 : 0);
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const x = Math.round(nx + (hx - nx) * k + Math.sin(k * 3) * 2);
    const y = Math.round(ny + (hy + 3 - ny) * k);
    p.set(x, y, ramp[3]); p.set(x + 1, y, ramp[4]); p.set(x + 2, y, belly[3]); p.set(x - 1, y, ramp[2]);
  }
  if (hood) {
    p.ellipse(hx, hy + 6, 5, 4.5, ramp[2]);
    p.ellipse(hx, hy + 6, 3, 3, belly[2]);
    p.set(hx - 1, hy + 6, ramp[0]); p.set(hx + 1, hy + 6, ramp[0]);
  }
  // head
  p.ball(hx, hy + 2, 3.6, 2.8, [ramp[2], ramp[3], ramp[4], ramp[5]]);
  p.set(hx + 3, hy + 3, ramp[3]); p.set(hx + 4, hy + 3, ramp[3]);
  // eyes (glowing amber)
  p.set(hx - 1, hy + 1, '#ffd23f'); p.set(hx + 2, hy + 1, '#ffd23f');
  // tongue
  if (t === 4 || t === 1) { p.set(hx + 5, hy + 3, R.red[4]); p.set(hx + 6, hy + 2, R.red[4]); p.set(hx + 6, hy + 4, R.red[4]); }
  // frame 5 flash is done at runtime with setTintFill
  p.outline(INK);
  return p;
}

function tortoise(frame) {
  const p = new Pix(40, 32);
  const bob = frame === 1 ? 1 : 0;
  const S = R.shell;
  // legs
  for (const [x, y] of [[9, 26], [28, 26], [13, 28], [24, 28]]) p.rect(x + (frame === 2 && x < 20 ? 1 : 0), y, 4, 3, R.mandrake[2]);
  // head
  const hx = frame === 4 ? 35 : 33;
  p.ball(hx, 22 + bob, 4, 3, [R.mandrake[1], R.mandrake[2], R.mandrake[3]]);
  p.set(hx + 1, 21 + bob, '#ffd23f');
  // shell
  p.ball(19, 19 + bob, 14, 9, [S[1], S[2], S[3], S[4]]);
  // hex plates
  for (const [x, y] of [[13, 16], [21, 14], [18, 21], [26, 19]]) {
    p.ellipse(x, y + bob, 3, 2, S[4]); p.set(x - 1, y - 1 + bob, S[4]);
    p.set(x, y + 2 + bob, S[1]);
  }
  // brambles / thorns
  for (const [x, y] of [[8, 13], [14, 9], [22, 8], [29, 11], [32, 16]]) {
    p.line(x, y + bob, x - 1, y - 3 + bob, R.wood[2]); p.set(x - 1, y - 4 + bob, R.leaf[5]);
    p.set(x + 1, y - 1 + bob, R.leaf[4]);
  }
  // shell rim
  for (let x = 6; x < 33; x++) p.set(x, 25 + bob, S[0]);
  if (frame === 5) p.map(() => '#f6f0e0');
  p.outline(INK);
  return p;
}

function mandrake(frame) {
  const p = new Pix(32, 32);
  const M = R.mandrake;
  const bob = frame === 1 ? 1 : 0;
  // root legs
  p.line(13, 24, 11, 30, M[2]); p.line(18, 24, 21, 30, M[1]); p.line(15, 25, 16, 30, M[2]);
  // body (bulb)
  p.ball(16, 20 + bob, 6, 6.5, [M[1], M[2], M[3], M[4]]);
  // arms
  const up = frame === 4 ? -5 : 0;
  p.line(10, 19 + bob, 7, 16 + up + bob, M[2]); p.line(22, 19 + bob, 25, 16 + up + bob, M[2]);
  // face
  p.set(13, 18 + bob, INK); p.set(18, 18 + bob, INK);
  if (frame === 4) { p.ellipse(15.5, 22 + bob, 2, 2.4, INK); p.set(15, 21 + bob, R.red[3]); }
  else { p.hline(14, 17, 22 + bob, M[0]); }
  // leaf crown
  const L = R.leaf;
  for (const [dx, h] of [[-4, 6], [-1, 9], [2, 8], [5, 5]]) {
    for (let j = 0; j < h; j++) {
      const x = 16 + dx + Math.round(Math.sin(j / 2 + dx) * 1), y = 13 + bob - j;
      p.set(x, y, j > h - 3 ? L[6] : L[4]); p.set(x + 1, y, L[3]);
    }
  }
  p.set(16, 5 + bob, '#ffb3c8'); p.set(17, 4 + bob, '#f27aa4'); p.set(15, 4 + bob, '#f27aa4');
  if (frame === 5) p.map(() => '#fff0f0');
  p.outline(INK);
  return p;
}

export function enemySheet(kind) {
  const frames = [0, 1, 2, 3, 4, 5];
  if (kind === 'viper') return strip(frames.map((f) => viper(f)));
  if (kind === 'spitter') return strip(frames.map((f) => viper(f, R.venom, R.toxic, true)));
  if (kind === 'tortoise') return strip(frames.map((f) => tortoise(f)));
  if (kind === 'mandrake') return strip(frames.map((f) => mandrake(f)));
  return strip(frames.map((f) => viper(f)));
}

// Boss: big coiled body + separate head sprites (heads are independent targets)
export function bossBody() {
  const p = new Pix(96, 64);
  const S = R.snake;
  p.ball(48, 48, 40, 14, [S[0], S[1], S[2], S[3]]);
  p.ball(46, 40, 30, 11, [S[1], S[2], S[3], S[4]]);
  p.ball(48, 32, 20, 8, [S[2], S[3], S[4], S[5]]);
  // belly scutes facing camera
  for (let x = 20; x < 76; x += 3) { p.set(x, 56, R.snakeBelly[2]); p.set(x + 1, 57, R.snakeBelly[1]); }
  // diamond pattern
  for (let i = 0; i < 18; i++) {
    const x = 14 + i * 4, y = 46 + Math.round(Math.sin(i) * 3);
    p.set(x, y, S[0]); p.set(x + 1, y - 1, S[0]); p.set(x + 2, y, S[0]); p.set(x + 1, y + 1, R.gold[3]);
  }
  // mossy growth and runes (ancient guardian)
  for (let i = 0; i < 26; i++) { const x = 12 + ((i * 37) % 72), y = 30 + ((i * 13) % 20); p.set(x, y, R.moss[4]); }
  p.outline(INK);
  return p;
}

export function bossHead(variant, frame) {
  const p = new Pix(32, 28);
  const S = variant === 1 ? R.venom : variant === 2 ? R.teal : R.snake;
  const open = frame === 1;
  p.ball(15, 13, 9, 7, [S[1], S[2], S[3], S[4], S[5]]);
  // snout
  p.ball(22, 15, 6, 4, [S[2], S[3], S[4]]);
  // horns/crest
  for (let j = 0; j < 6; j++) { p.set(9 - (j >> 1), 6 - j, R.bone[4]); p.set(10 - (j >> 1), 6 - j, R.bone[3]); }
  for (let j = 0; j < 4; j++) { p.set(14 + (j >> 1), 5 - j, R.bone[3]); }
  // eye
  p.rect(16, 10, 3, 2, '#ffe27a'); p.set(17, 10, INK); p.set(16, 9, S[0]); p.set(17, 9, S[0]); p.set(18, 9, S[0]);
  if (open) {
    p.poly([[18, 17], [29, 15], [28, 23], [18, 21]], R.crimson[2]);
    p.set(20, 17, '#ffffff'); p.set(24, 16, '#ffffff'); p.set(21, 21, '#ffffff'); p.set(25, 21, '#ffffff');
    p.set(27, 19, R.toxic[4]);
  } else {
    p.hline(19, 27, 17, S[0]);
  }
  if (frame === 2) p.map(() => '#fff6e8');
  p.outline(INK);
  return p;
}
