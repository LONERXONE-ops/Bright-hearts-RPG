// Side-view class sprites in the style of the Bright Hearts asset pack:
// muted sepia palette, big messy hair, chunky round boots, soft 4-tone shading,
// dark brown outline. 48x48 frames, feet on y=46, facing RIGHT (flip for left).
import { Pix, strip, hash2 } from './pix.js';

export const SIDE_POSES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'atk0', 'atk1', 'jump', 'fall', 'hurt', 'down', 'cast'];
export const FS = 48;

const OUT = '#2b1a1c';
const P = {
  skin: ['#9c5f55', '#c98676', '#e8ab94', '#f6cdb5'],
  hair: ['#4a302e', '#6e4a44', '#8f6a5f', '#ad8a7c', '#c7a698'],
  steel: ['#4a3e44', '#6e6268', '#91868a', '#b6aeae', '#ddd6d0'],
  copper: ['#6b3a26', '#9a5a36', '#c98450', '#ecb27a'],
  leather: ['#4f3029', '#74483a', '#9a6a52', '#bf8f70'],
  cream: ['#7d6a66', '#ad9a90', '#d6c7b6', '#f2e9da'],
  rose: ['#5e2a30', '#8a3e42', '#b65a5a', '#d88478'],
  grey: ['#3e3640', '#5e5462', '#82788a', '#a69eae'],
  dark: ['#241a22', '#352832', '#4a3a46', '#5e4c58'],
  bone: ['#7a6a5e', '#a8968a', '#d2c4b4', '#f0e6d6'],
  boot: ['#4a2e2a', '#70483e', '#9c7060', '#c8a08a'],
  violet: ['#3a2450', '#64409a', '#9a6ad6', '#d6b6ff'],
  ember: ['#7a1e18', '#c2401e', '#f07a2e', '#ffd07a'],
  green: ['#2a3a30', '#3e5a44', '#5e8060'],
};
const c = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];

// class designs (pack style)
export const SIDE_LOOKS = {
  warrior: { body: 'plate', top: P.steel, trim: P.copper, pants: P.steel, boots: P.steel, hair: 'spiky', weapon: 'greatsword', tabard: P.grey, pauldron: true },
  mage: { body: 'robe', top: P.cream, trim: P.copper, inner: P.dark, collar: P.cream, boots: P.boot, hair: 'soft', weapon: 'staff' },
  gunman: { body: 'coat', top: P.rose, trim: P.copper, inner: P.dark, collar: P.cream, sleeve: P.grey, pants: P.grey, boots: P.boot, hair: 'spiky', weapon: 'revolver' },
  engineer: { body: 'jacket', top: P.leather, trim: P.copper, collar: P.cream, pants: P.grey, baggy: true, boots: P.boot, hair: 'shaggy', goggles: true, weapon: 'wrench', pouches: true },
  savage: { body: 'spikes', top: P.dark, trim: P.bone, pants: P.dark, boots: P.steel, hair: 'long', weapon: 'bow', spikes: true },
};

function shadeBox(p, x0, y0, w, h, ramp, lightRight = true) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const t = (x - x0) / Math.max(1, w - 1);
    let k = lightRight ? (t > 0.7 ? 3 : t > 0.3 ? 2 : 1) : (t < 0.3 ? 3 : t < 0.7 ? 2 : 1);
    if (y === y0) k = Math.min(3, k + 1);
    if (y === y0 + h - 1) k = Math.max(0, k - 1);
    p.set(x, y, c(ramp, k));
  }
}

function boot(p, x, y, ramp, front) {
  // chunky rounded boot pointing right
  p.ball(x + 2, y, 4.2, 3.2, front ? [ramp[0], ramp[1], ramp[2], ramp[3]] : [ramp[0], ramp[0], ramp[1], ramp[2]], 0.6, -0.6);
  p.hline(x - 2, x + 6, y + 3, ramp[0]);
}

function hairBlob(p, o, hx, hy, pose) {
  const H = P.hair;
  // main mass (behind face, over top/back of head)
  p.ball(hx, hy, 9, 8, [H[0], H[1], H[2], H[3]], 0.4, -0.8);
  // spikes
  const spikes = o.hair === 'spiky' ? [[-9, -3, -4, -6], [-6, -8, -2, -12], [-1, -9, 3, -13], [4, -8, 8, -11], [8, -4, 12, -6], [-10, 2, -14, 1]]
    : o.hair === 'shaggy' ? [[-9, -2, -12, -3], [-5, -8, -6, -11], [1, -9, 2, -12], [6, -7, 9, -9], [-10, 4, -13, 5]]
      : o.hair === 'long' ? [[-8, -6, -10, -9], [0, -9, 1, -12], [6, -7, 9, -9]]
        : [[-8, -5, -10, -7], [-2, -9, -2, -11], [5, -8, 7, -10]];
  for (const [x0, y0, x1, y1] of spikes) {
    p.poly([[hx + x0 - 2, hy + y0], [hx + x0 + 2, hy + y0], [hx + x1, hy + y1]], H[2]);
    p.line(hx + x0, hy + y0, hx + x1, hy + y1, H[3]);
  }
  if (o.hair === 'long') {
    const sway = pose.startsWith('run') ? 2 : 0;
    for (let y = hy; y < hy + 18; y++) for (let x = hx - 10 - sway; x < hx - 3; x++) {
      if ((x + y) % 7 === 0) continue;
      p.set(x, y, c(H, x < hx - 7 - sway ? 1 : 2));
    }
  }
  // soft highlight arc
  for (let i = -4; i <= 3; i++) p.set(hx + i, hy - 7 + Math.round((i * i) / 8), H[4]);
}

function weapon(p, kind, hx, hy, pose) {
  const atk = pose === 'atk1', wind = pose === 'atk0' || pose === 'cast';
  if (kind === 'greatsword') {
    const blade = (x0, y0, x1, y1) => {
      p.line(x0, y0, x1, y1, '#3a2a30'); p.line(x0 + 1, y0, x1 + 1, y1, '#5a444c'); p.line(x0, y0 + 1, x1, y1 + 1, '#3a2a30');
      // glowing ember edge
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      p.line(x0 - 1, y0, x1 - 1, y1, '#3a2a30');
      for (let i = 3; i < n; i++) { const t = i / n; const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0); p.set(x + (horiz ? 0 : 2), y + (horiz ? 2 : 0), c(P.ember, i % 5 === 0 ? 3 : 2)); }
    };
    if (atk) { blade(hx + 2, hy - 1, hx + 20, hy - 1); p.vline(hx + 1, hy - 4, hy + 2, P.copper[2]); }
    else if (wind) { blade(hx, hy, hx - 9, hy - 17); p.hline(hx - 2, hx + 2, hy + 1, P.copper[2]); }
    else { blade(hx, hy, hx + 7, hy + 14); p.hline(hx - 2, hx + 3, hy, P.copper[2]); p.set(hx - 1, hy - 1, P.copper[3]); }
    return;
  }
  if (kind === 'staff') {
    const x = hx + (atk ? 4 : 1), top = hy - (wind ? 22 : 19);
    p.vline(x, top + 4, hy + 10, P.leather[2]); p.vline(x + 1, top + 4, hy + 10, P.leather[0]);
    p.ball(x + 0.5, top + 2, 3.2, 3.2, [P.copper[0], P.copper[1], P.copper[2], P.copper[3]]);
    p.ball(x + 0.5, top + 2, 1.8, 1.8, [P.violet[1], P.violet[2], P.violet[3], '#ffffff']);
    if (atk || wind) for (const [dx, dy] of [[5, -2], [-4, 1], [1, -6], [4, 4]]) p.set(x + dx, top + 2 + dy, P.violet[3]);
    return;
  }
  if (kind === 'bow') {
    const x = hx + 3, y = hy - 2;
    for (let j = -12; j <= 12; j++) { const b = Math.round(5 - (j * j) / 30); p.set(x + b, y + j, Math.abs(j) > 9 ? P.bone[3] : P.bone[2]); p.set(x + b + 1, y + j, P.bone[0]); }
    const pull = wind ? -7 : 0;
    p.line(x, y - 12, x + pull, y, P.cream[3]); p.line(x + pull, y, x, y + 12, P.cream[3]);
    if (wind || atk) { p.hline(x + pull, x + 13, y, P.leather[3]); p.set(x + 14, y, P.steel[4]); p.set(x + 13, y - 1, P.steel[3]); p.set(x + 13, y + 1, P.steel[3]); }
    return;
  }
  if (kind === 'revolver') {
    const y = hy - (wind ? 3 : 0), x = hx + (atk ? 3 : 0);
    p.rect(x, y - 1, 9, 2, P.steel[3]); p.hline(x, x + 8, y - 1, P.steel[4]); p.rect(x + 1, y, 3, 3, P.steel[2]);
    p.rect(x - 1, y + 1, 2, 4, P.leather[2]);
    if (atk) { p.ball(x + 11, y - 1, 2.5, 2, [P.ember[1], P.ember[2], P.ember[3], '#fff4c0']); }
    return;
  }
  if (kind === 'wrench') {
    if (atk) { p.rect(hx, hy - 1, 11, 2, P.steel[3]); p.hline(hx, hx + 10, hy - 1, P.steel[4]); p.rect(hx + 10, hy - 4, 3, 2, P.steel[3]); p.rect(hx + 10, hy + 1, 3, 2, P.steel[2]); }
    else { const tx = wind ? hx - 5 : hx + 5, ty = hy - 11; p.line(hx, hy, tx, ty, P.steel[3]); p.line(hx + 1, hy, tx + 1, ty, P.steel[1]); p.rect(tx - 2, ty - 2, 2, 3, P.steel[4]); p.rect(tx + 2, ty - 2, 2, 3, P.steel[3]); }
  }
}

export function drawSideHero(cls, pose) {
  const o = SIDE_LOOKS[cls] || SIDE_LOOKS.warrior;
  const p = new Pix(FS, FS);
  if (pose === 'down') {
    const q = drawSideHero(cls, 'idle0');
    for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) { const v = q.get(x, y); if (v >>> 24) p.set(y, 46 - Math.round((47 - x) * 0.5), v); }
    return p;
  }
  let bob = 0, lean = 0, legs = [0, 0, 0, 0], armF = 0;
  switch (pose) {
    case 'idle1': bob = 1; break;
    case 'run0': legs = [-5, 1, 5, 0]; armF = -2; break;
    case 'run1': legs = [-2, 0, 2, 3]; bob = -1; break;
    case 'run2': legs = [5, 0, -5, 1]; armF = 2; break;
    case 'run3': legs = [2, 3, -2, 0]; bob = -1; break;
    case 'atk0': lean = -2; legs = [-3, 0, 4, 0]; break;
    case 'atk1': lean = 2; legs = [-5, 0, 5, 0]; break;
    case 'cast': legs = [-3, 0, 3, 0]; break;
    case 'jump': legs = [-3, 5, 3, 6]; bob = -2; armF = -4; break;
    case 'fall': legs = [-5, 1, 5, 0]; armF = -5; break;
    case 'hurt': lean = -3; bob = 1; break;
    default: break;
  }
  const cx = 22 + lean;
  const foot = 44;
  const torsoTop = 22 + bob, torsoBot = 34 + bob;
  const robe = o.body === 'robe', coat = o.body === 'coat';

  // ---- back layer: long hair handled in hairBlob; back spikes
  if (o.spikes) for (const [x, y] of [[cx - 7, torsoTop + 1], [cx - 8, torsoTop + 6], [cx - 7, torsoTop + 11]]) p.poly([[x + 2, y], [x + 2, y + 4], [x - 4, y + 2]], P.bone[2]);

  // ---- back leg + boot
  const legRamp = o.pants || P.grey;
  const drawLeg = (ox, lift, front) => {
    const top = torsoBot - 1;
    const bot = foot - 3 - lift;
    const w = o.baggy ? 5 : 4;
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / Math.max(1, bot - top);
      const x = cx - 2 + Math.round(ox * t) - (front ? 0 : 1);
      for (let i = 0; i < w; i++) p.set(x + i, y, c(legRamp, front ? (i > w - 2 ? 3 : 2) : 1));
    }
    boot(p, cx - 2 + ox - (front ? 0 : 1), foot - lift, o.boots || P.boot, front);
  };
  if (!robe) drawLeg(legs[0], legs[1], false);

  // ---- back arm
  const sleeve = o.sleeve || o.top;
  shadeBox(p, cx - 7, torsoTop + 2, 3, 9, [sleeve[0], sleeve[0], sleeve[1], sleeve[1]]);

  // ---- torso
  if (robe || coat) {
    // long coat/robe flaring to the ankles
    const bottom = robe ? foot - 2 : foot - 7;
    for (let y = torsoTop; y <= bottom + bob; y++) {
      const fl = Math.max(0, Math.floor((y - torsoBot + 3) / 2));
      const swing = pose.startsWith('run') && y > torsoBot ? 2 : 0;
      for (let x = cx - 6 - fl - swing; x <= cx + 5 + Math.floor(fl / 2); x++) {
        const t = (x - (cx - 6 - fl)) / (11 + fl * 1.5);
        let k = t > 0.72 ? 3 : t > 0.35 ? 2 : 1;
        if (y >= bottom + bob - 1) k = 0;
        p.set(x, y, c(o.top, k));
      }
      p.set(cx + 5 + Math.floor(fl / 2), y, c(o.trim, 2));
      if (y >= bottom + bob - 1) for (let x = cx - 6 - fl - swing; x <= cx + 5 + Math.floor(fl / 2); x++) p.set(x, y, c(o.trim, y === bottom + bob ? 1 : 2));
    }
    if (o.inner) for (let y = torsoTop + 2; y < torsoBot + (robe ? 8 : 0); y++) { p.set(cx + 3, y, c(o.inner, 2)); p.set(cx + 4, y, c(o.inner, 1)); }
    if (robe) { boot(p, cx + 1 + legs[2] / 2, foot, o.boots, true); }
  } else {
    shadeBox(p, cx - 6, torsoTop, 12, torsoBot - torsoTop, o.top);
    if (o.body === 'plate') {
      for (let x = cx - 6; x < cx + 6; x++) p.set(x, torsoTop + 5, c(o.top, 0));
      p.vline(cx + 5, torsoTop, torsoBot - 1, c(o.trim, 2));
      p.hline(cx - 6, cx + 5, torsoTop, c(o.trim, 3));
    }
    if (o.pouches) { p.rect(cx - 1, torsoTop + 5, 4, 4, P.leather[3]); p.rect(cx - 1, torsoTop + 5, 4, 1, P.copper[2]); p.rect(cx + 3, torsoTop + 3, 3, 3, P.leather[2]); p.rect(cx - 5, torsoTop + 7, 3, 4, P.leather[1]); }
    if (o.spikes) { for (let x = cx - 6; x < cx + 6; x += 3) p.set(x + 1, torsoTop + 4, P.bone[3]); p.hline(cx - 6, cx + 5, torsoTop + 8, P.leather[2]); }
  }
  // belt
  if (!robe) { p.hline(cx - 6, cx + 5, torsoBot - 2, P.leather[0]); p.rect(cx + 2, torsoBot - 3, 3, 3, P.copper[2]); }
  if (o.tabard) { for (let y = torsoBot - 1; y < torsoBot + 8; y++) { const w = y > torsoBot + 5 ? 3 : 4; for (let x = cx + 1; x < cx + 1 + w; x++) p.set(x, y, c(o.tabard, x > cx + 2 ? 3 : 2)); p.set(cx + w, y, c(o.trim, 2)); } }

  // ---- front leg
  if (!robe) drawLeg(legs[2], legs[3], true);

  // ---- collar / scarf
  if (o.collar) p.ball(cx, torsoTop + 1, 7, 3.2, [o.collar[0], o.collar[1], o.collar[2], o.collar[3]], 0.5, -0.8);

  // ---- head
  const hx = cx + 1, hy = torsoTop - 9;
  // hair mass behind, then the face in profile, then the fringe on top
  hairBlob(p, o, hx - 3, hy - 3, pose);
  p.ball(hx + 3, hy + 2, 5.5, 6, [P.skin[1], P.skin[2], P.skin[2], P.skin[3]], 0.5, -0.4);
  for (let x = hx - 1; x <= hx + 8; x++) {
    const drop = (x * 5) % 3 === 0 ? 2 : (x * 7) % 4 === 0 ? 1 : 0;
    for (let y = hy - 5; y <= hy - 3 + drop; y++) p.set(x, y, c(P.hair, x > hx + 5 ? 3 : 2));
  }
  for (let y = hy - 2; y <= hy + 5; y++) { p.set(hx - 2, y, P.hair[1]); p.set(hx - 1, y, P.hair[2]); }
  // eye (big brown eye with a green glint, like the pack)
  const ey = hy + 1;
  if (pose === 'hurt') { p.set(hx + 5, ey, OUT); p.set(hx + 6, ey + 1, OUT); p.set(hx + 7, ey, OUT); }
  else { p.rect(hx + 5, ey - 1, 2, 4, '#3a2420'); p.set(hx + 6, ey - 1, '#6a4030'); p.set(hx + 5, ey + 2, '#5a9a7a'); }
  p.set(hx + 8, ey + 4, P.skin[3]); // nose tip highlight
  p.hline(hx + 6, hx + 7, ey + 5, P.skin[0]); // mouth
  p.set(hx + 3, ey + 3, '#e88a8a'); // blush
  if (o.goggles) { p.ball(hx + 4, hy - 5, 3.4, 3.4, [P.copper[0], P.copper[1], P.copper[2], P.copper[3]]); p.ball(hx + 4.4, hy - 5, 2, 2, [P.grey[1], P.grey[2], P.cream[2], '#ffffff']); p.hline(hx - 8, hx + 1, hy - 5, P.leather[0]); }

  // ---- shoulder armor + front arm + weapon
  let hand;
  const armRamp = o.sleeve || o.top;
  if (pose === 'atk1') { shadeBox(p, cx + 1, torsoTop + 3, 8, 3, armRamp); hand = [cx + 9, torsoTop + 4]; }
  else if (pose === 'atk0' || pose === 'cast') { shadeBox(p, cx - 1, torsoTop - 3, 3, 7, armRamp); hand = [cx, torsoTop - 4]; }
  else { shadeBox(p, cx + 1 + Math.round(armF / 2), torsoTop + 2, 3, 9, armRamp); hand = [cx + 2 + Math.round(armF / 2), torsoTop + 11]; }
  p.ball(hand[0], hand[1], 1.8, 1.8, [P.skin[0], P.skin[1], P.skin[2], P.skin[3]]);
  if (o.pauldron) { p.ball(cx + 1, torsoTop + 2, 5, 3.5, [o.top[1], o.top[2], o.top[3], o.top[4]], 0.5, -0.8); p.hline(cx - 3, cx + 5, torsoTop + 5, c(o.trim, 2)); }
  if (o.spikes) { p.ball(cx, torsoTop + 2, 5, 3.5, [P.dark[1], P.dark[2], P.dark[3], P.grey[3]]); for (const [dx, dy] of [[-3, -3], [0, -5], [3, -3]]) p.poly([[cx + dx - 1, torsoTop + 1], [cx + dx + 2, torsoTop + 1], [cx + dx, torsoTop + 1 + dy]], P.bone[3]); }
  weapon(p, o.weapon, hand[0] + 1, hand[1], pose);

  p.outline(OUT);
  // soft texture dither like the pack's painted look
  p.map((r, g, b, a, x, y) => { const h = hash2(x, y, 3); if (h > 0.93) return `rgba(${Math.min(255, r + 14)},${Math.min(255, g + 12)},${Math.min(255, b + 10)},1)`.replace(/rgba\((\d+),(\d+),(\d+),1\)/, (m, R1, G1, B1) => '#' + [R1, G1, B1].map((n) => (+n).toString(16).padStart(2, '0')).join('')); return null; });
  return p;
}

export function sideSheet(cls) {
  return strip(SIDE_POSES.map((pose) => drawSideHero(cls, pose)));
}
