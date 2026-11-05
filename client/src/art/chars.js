// Character sprites: chibi 16-bit proportions (big head, 3-tone hue-shifted shading,
// indigo outline). 32x32 frames, feet at y=30, centre x=16.
import { Pix, strip, mix } from './pix.js';
import { R, INK } from './palette.js';

export const FW = 32, FH = 32;

export const HAIR = {
  brown: R.wood, black: ['#141024', '#211a36', '#2f2649', '#41375e', '#5a5178'], blonde: R.thatch,
  red: R.red, white: R.bone, pink: R.pink, blue: R.blue, green: R.teal,
};
export const SKIN = [R.skin, R.skin2, R.skin3];

// ---------- class looks ----------
export const CLASS_LOOK = {
  // Looks follow LONERXONE's character sheets
  warrior: { topStyle: 'tunic', top: R.sky, trim: R.bone, strap: true, gloves: R.darkcloth, pants: R.darkcloth, boots: R.wood, bootTrim: R.bone, scarf: R.red, cape: R.crimson, torn: true, weapon: 'sword', eyes: '#4b3f9a', hairRamp: R.hairBrown, hairStyle: 'messy' },
  engineer: { topStyle: 'coat', top: R.teal, trim: R.gold, coatLong: true, strap: true, belts: true, gloves: R.leather, pants: R.darkcloth, boots: R.leather, bootTrim: R.teal, hat: 'goggles', weapon: 'wrench', eyes: '#8a6a1c', hairRamp: R.hairBrown, hairStyle: 'spiky' },
  gunman: { topStyle: 'coat', top: R.blue, trim: R.bone, coatLong: true, inner: R.darkcloth, strap: true, gloves: R.darkcloth, pants: R.darkcloth, boots: R.leather, bootTrim: R.gold, hat: 'brim', hatRamp: R.leather, weapon: 'revolver', scarf: R.orange, eyes: '#5a2a3a', hairRamp: R.hairBrown, hairStyle: 'messy' },
  mage: { topStyle: 'robe', top: R.purple, trim: R.gold, frill: true, boots: R.purple, hat: 'wizard', hatRamp: R.purple, hatStar: true, weapon: 'staff', eyes: '#8a3fd0', lashes: true, hairRamp: R.hairBrown, hairStyle: 'long' },
  savage: { topStyle: 'crop', top: R.leather, mantle: true, skirt: R.fur, gloves: R.leather, pants: null, boots: R.leather, bootFur: true, hat: 'horned', helmRamp: R.helm, helmHair: true, weapon: 'bow', quiver: true, eyes: '#8a5a1c', lashes: true, hairRamp: R.blonde, hairStyle: 'long' },
};

function rampC(r, i) { return r[Math.max(0, Math.min(r.length - 1, i))]; }

// shaded vertical block: left col light, right cols dark
function shadedRect(p, x, y, w, h, ramp, base = 3) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let k = base;
      if (i === 0) k = base + 1;
      if (i >= w - 1) k = base - 1;
      if (i >= w - 2 && w > 4) k = Math.min(k, base - 1);
      if (j === h - 1) k -= 1;
      p.set(x + i, y + j, rampC(ramp, k));
    }
}

function drawWeapon(p, kind, hx, hy, pose, back) {
  const S = R.steel, W = R.wood, G = R.gold;
  if (kind === 'sword') {
    let pts;
    if (pose === 'a0') pts = [[hx, hy], [hx + 3, hy - 10]];
    else if (pose === 'a1') pts = [[hx, hy], [hx + 11, hy + 2]];
    else pts = [[hx, hy], [hx + 4, hy - 9]];
    const [[x0, y0], [x1, y1]] = pts;
    // blade
    p.line(x0, y0, x1, y1, S[5]);
    p.line(x0 + 1, y0, x1 + 1, y1, S[3]);
    p.set(x1, y1, S[6]);
    // guard + grip
    p.set(x0 - 1, y0, G[4]); p.set(x0 + 1, y0 + (pose === 'a1' ? -1 : 0), G[3]); p.set(x0 + 2, y0, G[3]);
    p.set(x0, y0 + 1, W[2]);
    return;
  }
  if (kind === 'staff') {
    const top = pose === 'a0' || pose === 'a1' ? hy - 16 : hy - 13;
    const x = hx + (pose === 'a1' ? 2 : 1);
    p.vline(x, top + 3, hy + 6, W[3]);
    p.vline(x + 1, top + 3, hy + 6, W[1]);
    // crescent head + gem
    p.set(x - 1, top + 2, G[4]); p.set(x + 2, top + 2, G[3]); p.set(x - 1, top + 1, G[4]); p.set(x + 2, top + 1, G[3]);
    p.set(x, top, R.magic[4]); p.set(x + 1, top, R.magic[3]); p.set(x, top + 1, R.magic[5]); p.set(x + 1, top + 1, R.magic[4]);
    if (pose === 'a1') { p.set(x, top - 1, '#ffffff'); p.set(x - 2, top, R.magic[5]); p.set(x + 3, top, R.magic[5]); }
    return;
  }
  if (kind === 'axe') {
    const up = pose === 'a0' ? -7 : pose === 'a1' ? 3 : -3;
    const fx = pose === 'a1' ? 6 : 1;
    const x0 = hx, y0 = hy + 3, x1 = hx + fx + 2, y1 = hy + up - 6;
    p.line(x0, y0, x1, y1, W[2]);
    p.line(x0 + 1, y0, x1 + 1, y1, W[4]);
    // axe head
    const ax = x1, ay = y1;
    for (let j = -3; j <= 3; j++) {
      const w = 4 - Math.abs(j) / 1.5;
      for (let i = 1; i <= w; i++) p.set(ax + i, ay + j, i >= w - 0.5 ? S[6] : j < 0 ? S[4] : S[3]);
    }
    p.set(ax, ay - 1, S[2]); p.set(ax, ay + 1, S[2]);
    return;
  }
  if (kind === 'rifle') {
    const y = pose === 'a1' || pose === 'a0' ? hy - 2 : hy;
    const len = 12;
    p.hline(hx - 3, hx + len, y, S[4]);
    p.hline(hx - 3, hx + len, y + 1, S[2]);
    p.set(hx + len, y, S[6]);
    p.rect(hx - 5, y, 3, 3, W[3]); p.set(hx - 5, y + 2, W[1]);
    p.set(hx + 3, y - 1, S[3]);
    if (pose === 'a1') { p.set(hx + len + 1, y, '#fff1a8'); p.set(hx + len + 2, y, '#ffc34a'); p.set(hx + len + 1, y - 1, '#ffc34a'); p.set(hx + len + 1, y + 1, '#ff8a2b'); }
    return;
  }
  if (kind === 'wrench') {
    const up = pose === 'a0' ? -6 : pose === 'a1' ? 2 : -3;
    const x1 = hx + (pose === 'a1' ? 6 : 2), y1 = hy + up - 3;
    p.line(hx, hy, x1, y1, S[3]);
    p.line(hx + 1, hy, x1 + 1, y1, S[4]);
    p.set(x1 - 1, y1 - 1, S[5]); p.set(x1 + 2, y1 - 1, S[5]); p.set(x1 - 1, y1 - 2, S[4]); p.set(x1 + 2, y1 - 2, S[4]);
    return;
  }
  if (kind === 'revolver') {
    const up = pose === 'a0' ? -3 : 0;
    const x = pose === 'a1' ? hx + 1 : hx, y = hy - 1 + up;
    p.hline(x, x + 5, y, S[5]); p.hline(x, x + 5, y + 1, S[3]);
    p.rect(x, y, 2, 2, S[4]); p.set(x + 1, y + 1, S[2]);
    p.set(x - 1, y + 1, W[3]); p.set(x - 1, y + 2, W[2]); p.set(x, y + 2, W[3]);
    if (pose === 'a1') { p.set(x + 6, y, '#fff1a8'); p.set(x + 7, y, '#ffc34a'); p.set(x + 6, y - 1, '#ffc34a'); p.set(x + 6, y + 1, '#ff8a2b'); p.set(x + 8, y, '#ff8a2b'); }
    return;
  }
  if (kind === 'bow') {
    const x = hx + 1, y = hy - 1;
    // limbs (curved), grip, string
    for (let j = -8; j <= 8; j++) {
      const bend = Math.round(3 - (j * j) / 22);
      p.set(x + bend, y + j, Math.abs(j) > 6 ? R.bone[4] : W[3]);
      if (Math.abs(j) < 7) p.set(x + bend + 1, y + j, W[1]);
    }
    p.set(x + 3, y, R.leather[1]); p.set(x + 3, y + 1, R.leather[1]);
    const pull = pose === 'a0' ? -3 : 0;
    p.line(x, y - 8, x + pull, y, R.bone[5]); p.line(x + pull, y, x, y + 8, R.bone[5]);
    if (pose === 'a0' || pose === 'a1') { p.hline(x + pull, x + 9, y, R.wood[4]); p.set(x + 10, y, S[6]); p.set(x + 9, y - 1, S[4]); p.set(x + 9, y + 1, S[4]); p.set(x + pull + 1, y - 1, R.red[4]); }
    return;
  }
  if (kind === 'spear') {
    p.vline(hx + 1, hy - 18, hy + 7, W[3]);
    p.vline(hx + 2, hy - 18, hy + 7, W[1]);
    p.set(hx + 1, hy - 21, S[6]); p.set(hx + 1, hy - 20, S[5]); p.set(hx + 2, hy - 20, S[3]); p.set(hx, hy - 19, S[4]); p.set(hx + 3, hy - 19, S[3]); p.set(hx + 1, hy - 19, S[5]); p.set(hx + 2, hy - 19, S[4]);
    p.set(hx + 1, hy - 17, R.red[3]); p.set(hx + 2, hy - 17, R.red[2]);
    return;
  }
  if (kind === 'hammer') {
    p.line(hx, hy, hx + 2, hy - 7, W[3]);
    p.rect(hx, hy - 10, 5, 3, S[3]); p.hline(hx, hx + 4, hy - 10, S[5]);
  }
}

function drawHair(p, o, cx, top, back) {
  const H = o.hairRamp || HAIR.brown;
  const st = o.hairStyle || 'short';
  // base cap
  for (let y = top; y < top + 6; y++)
    for (let x = cx - 6; x <= cx + 5; x++) {
      const edge = (y === top && (x < cx - 4 || x > cx + 3)) || (y === top + 1 && (x < cx - 5 || x > cx + 4));
      if (edge) continue;
      let k = 3;
      if (x < cx - 2 && y < top + 3) k = 4;
      if (x > cx + 2) k = 2;
      if (y === top) k = 4;
      p.set(x, y, rampC(H, k));
    }
  if (!back) {
    // fringe
    for (let x = cx - 5; x <= cx + 4; x++) {
      const d = (x + 1000) % 3;
      p.set(x, top + 6, rampC(H, d === 0 ? 2 : 3));
      if (d !== 1) p.set(x, top + 7, rampC(H, 2));
    }
    // sideburns
    for (let y = top + 5; y < top + 9; y++) { p.set(cx - 6, y, rampC(H, 3)); p.set(cx + 5, y, rampC(H, 2)); }
  } else {
    for (let y = top + 5; y < top + 11; y++) for (let x = cx - 6; x <= cx + 5; x++) p.set(x, y, rampC(H, x < cx - 2 ? 3 : x > cx + 2 ? 1 : 2));
  }
  if (st === 'messy') {
    for (const [dx, dy] of [[-6, 0], [-4, -1], [-2, -2], [0, -1], [2, -2], [4, -1], [6, 1]]) { p.set(cx + dx, top + dy, rampC(H, 4)); p.set(cx + dx, top + dy + 1, rampC(H, 3)); }
    if (!back) { p.set(cx - 2, top + 8, rampC(H, 2)); p.set(cx + 1, top + 8, rampC(H, 2)); p.set(cx - 1, top + 9, rampC(H, 1)); }
    p.set(cx - 7, top + 4, rampC(H, 3)); p.set(cx + 6, top + 5, rampC(H, 2)); p.set(cx - 7, top + 7, rampC(H, 2)); p.set(cx + 6, top + 8, rampC(H, 1));
  } else if (st === 'spiky') {
    for (let i = 0; i < 5; i++) { const x = cx - 5 + i * 2 + 1; p.set(x, top - 1, rampC(H, 4)); p.set(x, top - 2, rampC(H, 5)); }
    p.set(cx - 7, top + 2, rampC(H, 3)); p.set(cx + 6, top + 2, rampC(H, 2));
  } else if (st === 'long') {
    for (let y = top + 6; y < top + 15; y++) { p.set(cx - 7, y, rampC(H, 3)); p.set(cx - 6, y, rampC(H, 2)); p.set(cx + 5, y, rampC(H, 2)); p.set(cx + 6, y, rampC(H, 1)); }
  } else if (st === 'pony') {
    if (back) for (let y = top + 3; y < top + 14; y++) { p.set(cx - 1, y, rampC(H, 3)); p.set(cx, y, rampC(H, 2)); }
    else for (let y = top + 2; y < top + 11; y++) p.set(cx + 6 + (y > top + 6 ? 1 : 0), y, rampC(H, 2));
    p.set(cx, top - 1, R.pink[4]); p.set(cx - 1, top - 1, R.pink[3]);
  } else if (st === 'bob') {
    for (let y = top + 6; y < top + 11; y++) { p.set(cx - 7, y, rampC(H, 3)); p.set(cx + 6, y, rampC(H, 1)); }
  } else if (st === 'bald') {
    // skin top drawn later
  }
}

function drawHat(p, o, cx, top, back) {
  const hat = o.hat;
  if (!hat) return false;
  if (hat === 'wizard') {
    const Hr = o.hatRamp || R.purple;
    for (let x = cx - 8; x <= cx + 7; x++) { p.set(x, top + 4, rampC(Hr, x < cx ? 3 : 2)); p.set(x, top + 5, rampC(Hr, 1)); }
    for (let j = 0; j < 9; j++) {
      const w = Math.max(1, 5 - Math.floor(j / 1.8));
      const sx = cx - w + Math.floor(j / 3);
      for (let i = 0; i < w * 2; i++) p.set(sx + i, top + 3 - j, rampC(Hr, i < w ? 4 : 2));
    }
    p.hline(cx - 5, cx + 4, top + 3, R.gold[4]);
    p.set(cx + 2, top - 6, R.gold[5]);
    if (o.hatStar) {
      const sx = back ? cx - 5 : cx + 4, sy = top + 1;
      p.set(sx, sy - 1, R.gold[5]); p.set(sx - 1, sy, R.gold[4]); p.set(sx, sy, R.gold[5]); p.set(sx + 1, sy, R.gold[4]); p.set(sx, sy + 1, R.gold[3]);
      p.set(sx - 2, sy + 1, R.purple[5]); p.set(sx - 2, sy + 2, R.purple[4]); p.set(sx + 2, sy + 1, R.purple[4]);
    }
    return 'cover';
  }
  if (hat === 'brim') {
    const Hr = o.hatRamp || R.leather;
    for (let x = cx - 9; x <= cx + 8; x++) { p.set(x, top + 4, rampC(Hr, 3)); p.set(x, top + 5, rampC(Hr, 1)); }
    for (let y = top - 1; y < top + 4; y++) for (let x = cx - 5; x <= cx + 4; x++) p.set(x, y, rampC(Hr, x < cx - 2 ? 4 : x > cx + 1 ? 2 : 3));
    p.hline(cx - 5, cx + 4, top + 3, R.red[3]);
    return 'brim';
  }
  if (hat === 'horned') {
    const B = R.bone, S = o.helmRamp || R.steel;
    for (let y = top; y < top + 5; y++) for (let x = cx - 6; x <= cx + 5; x++) {
      if (y === top && (x < cx - 4 || x > cx + 3)) continue;
      p.set(x, y, rampC(S, x < cx - 2 ? 4 : x > cx + 2 ? 2 : 3));
    }
    p.hline(cx - 6, cx + 5, top + 5, R.gold[3]);
    // horns
    const horn = [[0, 0], [-1, -1], [-2, -2], [-2, -3], [-3, -4], [-3, -5]];
    for (const [dx, dy] of horn) { p.set(cx - 7 + dx, top + 3 + dy, rampC(B, 4)); p.set(cx - 6 + dx, top + 3 + dy, rampC(B, 3)); p.set(cx + 6 - dx, top + 3 + dy, rampC(B, 3)); p.set(cx + 5 - dx, top + 3 + dy, rampC(B, 2)); }
    if (!back && !o.helmHair) { p.vline(cx - 1, top + 2, top + 5, S[2]); }
    return 'helm';
  }
  if (hat === 'goggles') {
    if (!back) {
      p.hline(cx - 6, cx + 5, top + 4, R.leather[2]);
      p.rect(cx - 5, top + 3, 4, 3, R.gold[3]); p.rect(cx, top + 3, 4, 3, R.gold[3]);
      p.rect(cx - 4, top + 4, 2, 1, R.teal[5]); p.rect(cx + 1, top + 4, 2, 1, R.teal[5]);
      p.set(cx - 4, top + 4, '#ffffff');
    } else p.hline(cx - 6, cx + 5, top + 4, R.leather[2]);
    return 'band';
  }
  if (hat === 'crown') {
    const G = R.gold;
    p.hline(cx - 5, cx + 4, top + 1, G[3]); p.hline(cx - 5, cx + 4, top + 2, G[2]);
    for (let i = 0; i < 4; i++) { const x = cx - 5 + i * 3; p.set(x, top, G[4]); p.set(x, top - 1, G[5]); }
    p.set(cx - 1, top + 1, R.red[4]); p.set(cx + 2, top + 1, R.blue[5]);
    return 'band';
  }
  if (hat === 'knight') {
    const S = R.steel;
    for (let y = top - 1; y < top + 11; y++) for (let x = cx - 6; x <= cx + 5; x++) {
      if (y === top - 1 && (x < cx - 3 || x > cx + 2)) continue;
      p.set(x, y, rampC(S, x < cx - 2 ? 5 : x > cx + 2 ? 3 : 4));
    }
    if (!back) { p.hline(cx - 4, cx + 3, top + 6, INK); p.hline(cx - 4, cx + 3, top + 7, S[1]); p.vline(cx - 1, top + 8, top + 10, S[2]); }
    // plume
    for (let i = 0; i < 6; i++) { p.set(cx - 1 + (i >> 1), top - 2 - (i < 3 ? i : 5 - i), R.red[4 - (i % 2)]); p.set(cx + 1 + i, top - 3 + (i >> 1), R.red[3]); }
    return 'full';
  }
  if (hat === 'hood') {
    const Hr = o.hatRamp || R.cloth;
    for (let y = top - 1; y < top + 12; y++) for (let x = cx - 7; x <= cx + 6; x++) {
      const inner = !back && y > top + 4 && x > cx - 6 && x < cx + 5;
      if (inner) continue;
      if (y === top - 1 && (x < cx - 4 || x > cx + 3)) continue;
      p.set(x, y, rampC(Hr, x < cx - 2 ? 3 : 2));
    }
    return 'hood';
  }
  if (hat === 'bandana') {
    p.hline(cx - 6, cx + 5, top + 3, R.red[3]); p.hline(cx - 6, cx + 5, top + 4, R.red[2]);
    return 'band';
  }
  return false;
}

/**
 * Draw one human frame.
 * pose: 'idle0','idle1','w0'..'w3','a0','a1','hurt','down'
 */
export function drawHuman(o, pose, back = false) {
  const p = new Pix(FW, FH);
  const cx = 16;
  const skin = o.skin || R.skin;
  const big = !!o.big;
  let bob = 0, lL = 0, lR = 0, aL = 0, aR = 0;
  if (pose === 'idle1') bob = 1;
  if (pose === 'w0') { lL = -1; aR = 1; aL = -1; }
  if (pose === 'w1') { bob = -1; }
  if (pose === 'w2') { lR = -1; aL = 1; aR = -1; }
  if (pose === 'w3') { bob = -1; }
  if (pose === 'a0') { bob = 0; }
  if (pose === 'a1') { bob = 1; }
  if (pose === 'hurt') bob = 1;

  if (pose === 'down') {
    // lying on the ground, drawn sideways
    const q = drawHuman(o, 'idle0', false);
    const out = new Pix(FW, FH);
    // rotate 90deg (head to the left), then squash vertically so it reads as lying down
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const v = q.get(x, y);
      if (!(v >>> 24)) continue;
      const nx = y, ny = 31 - x;
      const sy = 30 - Math.round((31 - ny) * 0.55);
      out.set(nx, sy, v);
    }
    return out;
  }

  const legTop = 24, footY = 30;
  const tw = big ? 10 : 8;
  const tx = cx - tw / 2;
  const torsoTop = 17 + bob;
  const headTop = 5 + bob;

  // back items (drawn first)
  if (o.cape && !back) {
    // a glimpse of cape behind legs
    for (let y = torsoTop + 2; y < torsoTop + 12; y++) for (let x = tx - 2; x <= tx + tw + 1; x++) {
      if (o.torn && y > torsoTop + 8 && (x * 7 + y) % 4 === 0) continue;
      p.set(x, y, o.cape[y > torsoTop + 8 ? 1 : 2]);
    }
  }
  if (o.pack && !back) {
    p.rect(cx - 7, torsoTop + 1, 2, 6, R.leather[2]); p.rect(cx + 5, torsoTop + 1, 2, 6, R.leather[1]);
  }

  // legs
  const robe = o.topStyle === 'robe';
  const coat = o.topStyle === 'coat';
  const legW = big ? 3 : 2;
  const lx = cx - (big ? 4 : 3), rx = cx + (big ? 1 : 1);
  if (!robe) {
    for (const [x, lift, side] of [[lx, lL, 0], [rx, lR, 1]]) {
      for (let y = legTop + bob; y <= footY + lift; y++) {
        const bootTop = footY - (o.bootFur ? 4 : 3) + lift;
        const boot = y >= bootTop;
        let ramp = boot ? o.boots || R.wood : o.pants || skin;
        if (boot && y === bootTop && (o.bootTrim || o.bootFur)) ramp = o.bootFur ? R.fur.slice(2) : o.bootTrim;
        for (let i = 0; i < legW; i++) p.set(x + i, y, rampC(ramp, (i === 0 ? 3 - side : 2 - side) + (boot && y === bootTop ? 1 : 0)));
      }
      if (lift) p.hline(x, x + legW - 1, footY, null);
    }
  }

  // torso
  const T = o.top || R.cloth;
  if (robe) {
    for (let y = torsoTop; y <= footY; y++) {
      const flare = Math.max(0, Math.floor((y - torsoTop - 4) / 3));
      const x0 = tx - flare, x1 = tx + tw - 1 + flare;
      for (let x = x0; x <= x1; x++) {
        let k = x < cx - 2 ? 4 : x > cx + 1 ? 2 : 3;
        if (x === x1) k = 1;
        if (y === footY) k = 1;
        p.set(x, y, rampC(T, k));
      }
      if (o.frill && (y === footY - 3 || y === footY - 2)) { for (let x = x0; x <= x1; x++) if (y === footY - 3 || x % 2) p.set(x, y, x % 3 ? '#f2eafc' : '#cdbfe6'); }
      if (o.trim && y >= footY - 1) p.hline(x0, x1, y, rampC(o.trim, y === footY ? 2 : 4));
    }
    if (o.trim) p.vline(cx - 1, torsoTop + 2, footY - 2, rampC(o.trim, 4));
    // feet peek
    p.set(cx - 3 + (lL ? 1 : 0), footY, (o.boots || R.cloth)[2]); p.set(cx + 2, footY, (o.boots || R.cloth)[1]);
  } else {
    shadedRect(p, tx, torsoTop, tw, 8, T, 3);
    if (coat) {
      // coat tails
      for (let y = torsoTop + 7; y < torsoTop + 11; y++) { p.set(tx - 1, y, rampC(T, 3)); p.set(tx, y, rampC(T, 2)); p.set(tx + tw - 1, y, rampC(T, 1)); p.set(tx + tw, y, rampC(T, 1)); }
      if (!back) { p.vline(cx - 1, torsoTop + 1, torsoTop + 7, rampC(o.trim || R.gold, 4)); p.vline(cx, torsoTop + 1, torsoTop + 7, rampC(T, 1)); }
    }
    if (o.topStyle === 'plate') {
      p.hline(tx, tx + tw - 1, torsoTop, T[5]);
      if (!back) { p.set(cx - 2, torsoTop + 2, T[6]); p.set(cx - 1, torsoTop + 3, T[5]); p.hline(tx + 1, tx + tw - 2, torsoTop + 4, T[2]); }
      // pauldrons
      p.rect(tx - 2, torsoTop - 1, 3, 3, T[5]); p.set(tx - 2, torsoTop + 1, T[3]);
      p.rect(tx + tw - 1, torsoTop - 1, 3, 3, T[3]); p.set(tx + tw + 1, torsoTop + 1, T[2]);
    }
    if (o.topStyle === 'fur') {
      // bare chest + fur mantle
      if (!back) { for (let y = torsoTop + 3; y < torsoTop + 7; y++) for (let x = tx + 2; x < tx + tw - 2; x++) p.set(x, y, rampC(skin, x < cx ? 3 : 2)); p.set(cx - 1, torsoTop + 5, skin[1]); }
      for (let x = tx - 3; x <= tx + tw + 2; x++) { p.set(x, torsoTop - 1, rampC(R.fur, 4)); p.set(x, torsoTop, rampC(R.fur, 3 + ((x & 1) ? 0 : 1))); p.set(x, torsoTop + 1, rampC(R.fur, 2 + (x & 1))); if (x % 2) p.set(x, torsoTop + 2, R.fur[2]); }
    }
    if (o.topStyle === 'jumpsuit') {
      if (!back) { p.vline(cx - 1, torsoTop + 1, torsoTop + 6, (o.trim || R.orange)[3]); p.set(cx - 3, torsoTop + 2, R.gold[4]); }
      p.hline(tx, tx + tw - 1, torsoTop + 6, R.leather[2]);
      p.set(tx + 1, torsoTop + 6, R.gold[4]); p.set(tx + tw - 2, torsoTop + 7, R.steel[4]);
    }
    if (o.topStyle === 'apron') {
      if (!back) for (let y = torsoTop + 1; y < torsoTop + 11; y++) for (let x = tx + 1; x < tx + tw - 1; x++) p.set(x, y, rampC(R.leather, x < cx ? 3 : 2));
    }
    if (o.topStyle === 'tunic' && o.trim) {
      // tunic skirt below belt + white trim like the Hero sheet
      for (let y = torsoTop + 8; y <= torsoTop + 9; y++) for (let x = tx; x < tx + tw; x++) p.set(x, y, rampC(T, x < cx ? 3 : 2));
      p.hline(tx, tx + tw - 1, torsoTop + 9, rampC(o.trim, 4));
      if (!back) { p.vline(cx - 2, torsoTop + 1, torsoTop + 9, rampC(o.trim, 4)); p.vline(cx + 1, torsoTop + 1, torsoTop + 9, rampC(o.trim, 3)); }
      p.set(tx, torsoTop, rampC(o.trim, 4)); p.set(tx + tw - 1, torsoTop, rampC(o.trim, 3));
    }
    if (o.coatLong) {
      for (let y = torsoTop + 8; y <= torsoTop + 12; y++) {
        const fl = y > torsoTop + 10 ? 1 : 0;
        p.set(tx - 1 - fl, y, rampC(T, 3)); p.set(tx - fl, y, rampC(T, 3)); p.set(tx + tw - 1 + fl, y, rampC(T, 1)); p.set(tx + tw + fl, y, rampC(T, 1));
        if (y === torsoTop + 12) { p.set(tx - 1 - fl, y, rampC(o.trim, 4)); p.set(tx - fl, y, rampC(o.trim, 4)); p.set(tx + tw - 1 + fl, y, rampC(o.trim, 3)); p.set(tx + tw + fl, y, rampC(o.trim, 3)); }
      }
      if (!back) { p.vline(tx, torsoTop, torsoTop + 11, rampC(o.trim, 4)); p.vline(tx + tw - 1, torsoTop, torsoTop + 11, rampC(o.trim, 3)); }
    }
    if (o.inner && !back) for (let y = torsoTop + 1; y <= torsoTop + 6; y++) for (let x = cx - 2; x <= cx + 1; x++) p.set(x, y, rampC(o.inner, x < cx ? 3 : 2));
    if (o.topStyle === 'crop') {
      if (!back) {
        for (let x = tx + 1; x < tx + tw - 1; x++) { p.set(x, torsoTop, rampC(skin, x < cx ? 3 : 2)); p.set(x, torsoTop + 1, rampC(skin, x < cx ? 3 : 2)); }
        p.hline(cx - 2, cx + 1, torsoTop, R.leather[1]); p.set(cx - 1, torsoTop + 1, R.bone[5]);
        for (let y = torsoTop + 5; y <= torsoTop + 6; y++) for (let x = tx + 1; x < tx + tw - 1; x++) p.set(x, y, rampC(skin, x < cx ? 3 : 2));
        p.set(cx - 1, torsoTop + 6, skin[2]);
      }
    }
    if (o.strap) p.line(tx, torsoTop + 1, tx + tw - 1, torsoTop + 6, back ? R.leather[1] : R.leather[2]);
    // belt
    p.hline(tx, tx + tw - 1, torsoTop + 7, R.leather[1]);
    if (!back) { p.set(cx - 1, torsoTop + 7, R.gold[4]); p.set(cx, torsoTop + 7, R.gold[3]); }
    if (o.belts && !back) { p.rect(tx - 1, torsoTop + 8, 2, 2, R.leather[3]); p.rect(tx + tw - 1, torsoTop + 8, 2, 2, R.leather[2]); p.set(cx + 2, torsoTop + 8, R.teal[5]); }
    if (o.skirt) {
      for (let y = torsoTop + 8; y <= torsoTop + 11; y++) for (let x = tx - 1; x <= tx + tw; x++) {
        if (y === torsoTop + 11 && (x + (back ? 1 : 0)) % 2) continue;
        p.set(x, y, rampC(o.skirt, x < cx ? 4 : 3) );
      }
      if (!back) { p.set(cx - 3, torsoTop + 9, R.bone[5]); p.set(cx, torsoTop + 10, R.bone[5]); p.set(cx + 2, torsoTop + 9, R.bone[5]); }
    }
  }
  if (o.mantle) {
    // fur pauldrons on the shoulders (kept off the face)
    for (const x0 of [tx - 3, tx + tw - 1]) for (let x = x0; x < x0 + 4; x++) { p.set(x, torsoTop, rampC(R.fur, 5)); p.set(x, torsoTop + 1, rampC(R.fur, 4 - (x & 1))); if (x % 2) p.set(x, torsoTop + 2, R.fur[3]); }
    if (back) for (let y = torsoTop + 1; y < torsoTop + 12; y++) for (let x = tx - 1; x <= tx + tw; x++) { if (y === torsoTop + 11 && x % 2) continue; p.set(x, y, rampC(R.fur, x < cx ? 4 : 3)); }
  }

  // scarf
  if (o.scarf) {
    p.hline(cx - 4, cx + 3, torsoTop, o.scarf[4]); p.hline(cx - 4, cx + 3, torsoTop + 1, o.scarf[3]);
    if (back) { p.rect(cx - 1, torsoTop + 2, 2, 5, o.scarf[3]); p.set(cx, torsoTop + 7, o.scarf[2]); }
    else { p.set(cx + 3, torsoTop + 2, o.scarf[2]); p.set(cx + 4, torsoTop + 3, o.scarf[2]); }
  }
  // cape from behind
  if (o.cape && back) {
    for (let y = torsoTop; y < torsoTop + 12; y++) {
      const fl = Math.floor((y - torsoTop) / 4);
      for (let x = tx - fl; x <= tx + tw - 1 + fl; x++) {
        if (o.torn && y > torsoTop + 9 && ((x * 7 + y) % 5 === 0 || (y === torsoTop + 11 && x % 2))) continue;
        p.set(x, y, rampC(o.cape, x < cx - 1 ? 3 : 2));
      }
    }
  }
  if (o.quiver) {
    if (back) { p.rect(cx + 1, torsoTop - 2, 3, 9, R.leather[2]); for (const x of [cx + 1, cx + 2, cx + 3]) { p.set(x, torsoTop - 3, R.wood[4]); p.set(x, torsoTop - 4, R.bone[5]); } }
    else { p.set(cx - 5, torsoTop - 2, R.bone[5]); p.set(cx - 6, torsoTop - 3, R.bone[5]); p.set(cx - 4, torsoTop - 2, R.wood[3]); }
  }
  if (o.pack && back) {
    p.rect(cx - 5, torsoTop - 1, 10, 9, R.leather[3]);
    p.rect(cx - 5, torsoTop + 7, 10, 1, R.leather[1]);
    p.hline(cx - 5, cx + 4, torsoTop - 1, R.leather[4]);
    // gear
    p.ellipse(cx + 1, torsoTop + 3, 2.4, 2.4, R.gold[3]); p.set(cx + 1, torsoTop + 3, R.gold[1]);
    p.vline(cx - 3, torsoTop - 4, torsoTop, R.steel[4]); p.set(cx - 3, torsoTop - 5, R.orange[4]);
  }

  // arms
  const armW = big ? 3 : 2;
  const al = tx - armW, ar = tx + tw;
  const sleeve = o.topStyle === 'fur' ? skin : T;
  for (const [x, sw, side] of [[al, aL, 0], [ar, aR, 1]]) {
    let y0 = torsoTop + 1, y1 = torsoTop + 5 + sw;
    if (side === 1 && (pose === 'a0')) { y1 = torsoTop + 2; }
    for (let y = y0; y <= y1; y++) for (let i = 0; i < armW; i++) p.set(x + i, y, rampC(sleeve, (side ? 2 : 3) + (i === 0 ? 1 : 0) - (y === y1 ? 1 : 0)));
    for (let i = 0; i < armW; i++) p.set(x + i, y1 + 1, rampC(o.gloves || skin, side ? 2 : 3));
    if (o.gloves) for (let i = 0; i < armW; i++) p.set(x + i, y1, rampC(o.gloves, side ? 1 : 2));
  }
  // extended attack arm
  if (pose === 'a1' && !back) { p.hline(ar, ar + 3, torsoTop + 4, rampC(sleeve, 3)); p.set(ar + 4, torsoTop + 4, skin[3]); }

  // head
  for (let y = headTop + 2; y < headTop + 12; y++)
    for (let x = cx - 6; x <= cx + 5; x++) {
      if ((y === headTop + 11) && (x < cx - 4 || x > cx + 3)) continue;
      if ((y === headTop + 10) && (x < cx - 5 || x > cx + 4)) continue;
      let k = 3;
      if (x > cx + 2) k = 2;
      if (x < cx - 3) k = 4;
      p.set(x, y, rampC(skin, k));
    }
  const hatKind = drawHat(p, o, cx, headTop, back);
  if (hatKind !== 'full' && hatKind !== 'helm' && hatKind !== 'hood') {
    if (o.hairStyle !== 'bald') drawHair(p, o, cx, headTop + (hatKind === 'brim' || hatKind === 'cover' ? 1 : 0), back);
    if (hatKind) drawHat(p, o, cx, headTop, back); // redraw hat over hair
  } else if (hatKind === 'helm' && !back) {
    // face below helm
  }
  if (back && hatKind === 'helm') {
    const H = o.hairRamp || HAIR.brown;
    for (let y = headTop + 5; y < headTop + (o.helmHair ? 17 : 11); y++) for (let x = cx - 6; x <= cx + 5; x++) p.set(x, y, rampC(H, x < cx - 2 ? 4 : x > cx + 2 ? 2 : 3));
  } else if (hatKind === 'helm' && o.helmHair) {
    const H = o.hairRamp;
    for (let y = headTop + 5; y < headTop + 17; y++) { p.set(cx - 7, y, rampC(H, 4)); p.set(cx - 6, y, rampC(H, 3)); p.set(cx + 5, y, rampC(H, 3)); p.set(cx + 6, y, rampC(H, 2)); }
    for (let x = cx - 5; x <= cx + 4; x++) { p.set(x, headTop + 6, rampC(H, x % 3 ? 4 : 3)); if (x % 2) p.set(x, headTop + 7, rampC(H, 3)); }
  }

  // face
  if (!back && hatKind !== 'full') {
    const ey = headTop + 8;
    const eyeC = o.eyes || INK;
    if (pose === 'hurt') {
      p.set(cx - 3, ey, eyeC); p.set(cx - 2, ey + 1, eyeC); p.set(cx + 2, ey + 1, eyeC); p.set(cx + 1, ey, eyeC);
    } else {
      p.set(cx - 3, ey, eyeC); p.set(cx - 3, ey + 1, eyeC); p.set(cx + 2, ey, eyeC); p.set(cx + 2, ey + 1, eyeC);
      p.set(cx - 4, ey + 1, eyeC); p.set(cx + 1, ey + 1, eyeC);
      p.set(cx - 4, ey, '#ffffff'); p.set(cx + 1, ey, '#ffffff');
    }
    if (o.lashes && pose !== 'hurt') { p.set(cx - 5, ey, INK); p.set(cx + 3, ey, INK); }
    p.set(cx - 5, ey + 2, R.pink[4]); p.set(cx + 4, ey + 2, R.pink[3]);
    p.set(cx - 1, ey + 3, skin[1]);
    if (o.beard) {
      for (let y = ey + 2; y < headTop + 15; y++) {
        const w = y < ey + 4 ? 5 : 4 - (y - ey - 4);
        for (let x = cx - w; x < cx + w; x++) p.set(x, y, rampC(o.beard, x < cx - 1 ? 4 : 3));
      }
      p.set(cx - 1, ey + 3, o.beard[1]);
    }
  }

  // weapon in right hand (front) / slung (back)
  const hx = ar + (armW > 2 ? 1 : 0), hy = torsoTop + 6 + aR;
  if (o.weapon) {
    if (!back) drawWeapon(p, o.weapon, pose === 'a1' ? ar + 4 : hx, pose === 'a1' ? torsoTop + 4 : hy, pose, false);
    else drawWeapon(p, o.weapon, hx, hy, pose, true);
  }

  p.outline(INK);
  return p;
}

export const POSES = ['idle0', 'idle1', 'w0', 'w1', 'w2', 'w3', 'a0', 'a1', 'hurt', 'down'];

// Returns Pix strip: front poses then back poses (20 frames)
export function humanSheet(o) {
  const frames = [];
  for (const back of [false, true]) for (const pose of POSES) frames.push(drawHuman(o, pose, back));
  return strip(frames);
}

export function lookFor(cls) {
  // each class is a fixed character (see the character sheets)
  return { skin: R.skin, ...(CLASS_LOOK[cls] || CLASS_LOOK.warrior) };
}

// NPC presets
export const NPC_LOOKS = {
  king: { topStyle: 'robe', top: R.red, trim: R.gold, hat: 'crown', beard: R.bone, hairRamp: R.bone, hairStyle: 'short', skin: R.skin, cape: R.red },
  advisor: { topStyle: 'robe', top: R.cloth, trim: R.blue, hairStyle: 'bald', beard: R.bone, skin: R.skin, hairRamp: R.bone },
  guard: { topStyle: 'plate', top: R.steel, pants: R.steel, boots: R.steel, hat: 'knight', weapon: 'spear', skin: R.skin, cape: R.red },
  smith: { topStyle: 'apron', top: R.red, pants: R.leather, boots: R.wood, hairStyle: 'short', hairRamp: HAIR.black, beard: HAIR.black, skin: R.skin2, weapon: 'hammer', big: true },
  merchant: { topStyle: 'tunic', top: R.orange, pants: R.cloth, boots: R.wood, hat: 'bandana', hairStyle: 'short', hairRamp: HAIR.brown, skin: R.skin, scarf: R.teal },
  enchanter: { topStyle: 'robe', top: R.teal, trim: R.magic, hat: 'hood', hatRamp: R.purple, skin: R.skin3, hairRamp: HAIR.white },
  guild: { topStyle: 'coat', top: R.leather, trim: R.gold, pants: R.cloth, boots: R.wood, hairStyle: 'pony', hairRamp: HAIR.red, skin: R.skin, scarf: R.blue },
  villagerA: { topStyle: 'tunic', top: R.teal, pants: R.leather, boots: R.wood, hairStyle: 'short', hairRamp: HAIR.blonde, skin: R.skin },
  villagerB: { topStyle: 'tunic', top: R.pink, pants: R.cloth, boots: R.wood, hairStyle: 'long', hairRamp: HAIR.brown, skin: R.skin2 },
  villagerC: { topStyle: 'tunic', top: R.blue, pants: R.leather, boots: R.wood, hairStyle: 'bob', hairRamp: HAIR.black, skin: R.skin3 },
  barkeep: { topStyle: 'apron', top: R.cloth, pants: R.cloth, boots: R.wood, hairStyle: 'bald', beard: HAIR.red, skin: R.skin, hairRamp: HAIR.red, big: true },
};
