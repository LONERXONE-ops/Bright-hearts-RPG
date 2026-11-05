// Builds every texture at boot from the procedural art modules.
import { buildTileTextures } from '../art/tiles.js';
import { humanSheet, lookFor, NPC_LOOKS, FW, FH, POSES } from '../art/chars.js';
import { enemySheet, bossBody, bossHead } from '../art/enemies.js';
import * as P from '../art/props.js';
import * as FX from '../art/fx.js';
import { strip } from '../art/pix.js';
import { R } from '../art/palette.js';

export function addSheet(scene, key, pix, fw, fh) {
  const tex = scene.textures;
  if (tex.exists(key)) tex.remove(key);
  const t = tex.addCanvas(key, pix.canvas());
  const n = Math.floor(pix.w / fw);
  for (let i = 0; i < n; i++) t.add(i, 0, i * fw, 0, fw, fh);
  return t;
}
function addImg(scene, key, pix) {
  if (scene.textures.exists(key)) return;
  scene.textures.addCanvas(key, pix.canvas());
}
const anchors = {};
export function anchorOf(key) { return anchors[key] || { x: 0.5, y: 1 }; }
function addProp(scene, key, res) {
  addImg(scene, key, res.pix);
  anchors[key] = { x: res.ax / res.pix.w, y: res.ay / res.pix.h };
}

// Human sheet: 20 frames (10 front, 10 back)
export function ensureHuman(scene, key, look) {
  if (scene.textures.exists(key)) return key;
  addSheet(scene, key, humanSheet(look), FW, FH);
  const A = scene.anims;
  const f = (b, pose) => (b ? 10 : 0) + POSES.indexOf(pose);
  for (const [b, side] of [[0, 'f'], [1, 'b']]) {
    A.create({ key: `${key}_idle_${side}`, frames: [f(b, 'idle0'), f(b, 'idle1')].map((frame) => ({ key, frame })), frameRate: 2.2, repeat: -1 });
    A.create({ key: `${key}_walk_${side}`, frames: ['w0', 'w1', 'w2', 'w3'].map((p) => ({ key, frame: f(b, p) })), frameRate: 9, repeat: -1 });
    A.create({ key: `${key}_atk_${side}`, frames: ['a0', 'a1', 'a1'].map((p) => ({ key, frame: f(b, p) })), frameRate: 14, repeat: 0 });
  }
  return key;
}

export function playerKey(cls, look) {
  void look;
  return `pc_${cls}`;
}
export function ensurePlayerSprite(scene, cls, look) {
  return ensureHuman(scene, playerKey(cls, look), lookFor(cls, look));
}

export function buildAll(scene, lowFx) {
  for (const t of ['village', 'castle', 'ruins']) buildTileTextures(scene, t);

  // enemies
  for (const k of ['viper', 'spitter', 'tortoise', 'mandrake']) {
    const pix = enemySheet(k);
    const fw = k === 'tortoise' ? 40 : 32;
    addSheet(scene, 'en_' + k, pix, fw, 32);
  }
  addImg(scene, 'boss_body', bossBody());
  for (let v = 0; v < 3; v++) addSheet(scene, 'boss_head' + v, strip([bossHead(v, 0), bossHead(v, 1), bossHead(v, 2)]), 32, 28);

  // NPCs
  for (const [k, look] of Object.entries(NPC_LOOKS)) ensureHuman(scene, 'npc_' + k, look);

  // props
  for (let i = 0; i < 6; i++) {
    addProp(scene, 'tree_' + i, P.tree(i * 11 + 3, R.leaf, { blossom: i === 4, fruit: i === 5 }));
    addProp(scene, 'jtree_' + i, P.tree(i * 13 + 7, R.leaf, { vines: true }));
    addProp(scene, 'fern_' + i, P.fern(i + 1));
    addProp(scene, 'bush_' + i, P.bush(i + 1, [null, '#ffb3c8', '#ffe27a', '#a9d8ff', null, '#f2f6f4'][i]));
  }
  for (let i = 0; i < 3; i++) {
    addProp(scene, 'pillar_' + i, P.pillar(i + 1, false));
    addProp(scene, 'pillarb_' + i, P.pillar(i + 1, true));
    addProp(scene, 'statue_' + i, P.statue(i + 1));
    addProp(scene, 'rock_' + i, P.rock(i + 1));
    addProp(scene, 'jar_' + i, P.jar(i + 1));
    addProp(scene, 'crate_' + i, P.crate(i + 1, R.plank, true));
  }
  addProp(scene, 'cpillar_0', P.pillar(1, false, R.castle, false));
  addProp(scene, 'chest_c', P.chest(false));
  addProp(scene, 'chest_o', P.chest(true));
  addProp(scene, 'barrel', P.barrel());
  addProp(scene, 'brazier', P.torchPost('brazier', R.ruin));
  addProp(scene, 'lamp', P.torchPost('lamp'));
  addProp(scene, 'fountain', P.fountain());
  addProp(scene, 'stall_r', P.stall(R.red));
  addProp(scene, 'stall_b', P.stall(R.blue));
  addProp(scene, 'fence_x', P.fence('x'));
  addProp(scene, 'fence_y', P.fence('y'));
  addProp(scene, 'anvil', P.anvil());
  addProp(scene, 'board', P.signBoard());
  addProp(scene, 'throne', P.throne());
  addProp(scene, 'candelabra', P.candelabra());
  addProp(scene, 'wbanner_crown', P.wallBanner(R.red, 'crown'));
  addProp(scene, 'wbanner_heart', P.wallBanner(R.red, 'heart'));
  addProp(scene, 'glass', P.stainedGlass());
  addProp(scene, 'rack', P.weaponRack());
  for (let f = 0; f < 4; f++) { addProp(scene, 'portal_' + f, P.portal(f)); }
  addSheet(scene, 'flame', strip([0, 1, 2, 3].map((f) => P.flame(f))), 12, 16);
  addSheet(scene, 'flame_purple', strip([0, 1, 2, 3].map((f) => P.flame(f, R.magic))), 12, 16);
  addSheet(scene, 'chicken', strip([P.chicken(0), P.chicken(1)]), 16, 16);

  // fx
  scene.textures.addCanvas('light', FX.lightCanvas(128));
  scene.textures.addCanvas('vignette', FX.vignetteCanvas());
  addImg(scene, 'shadow', FX.shadow());
  addSheet(scene, 'slash', strip([0, 1, 2].map((f) => FX.slash(f))), 40, 32);
  addImg(scene, 'orb_magic', FX.orb(R.magic, 4));
  addImg(scene, 'orb_fire', FX.orb(R.fire, 5));
  addImg(scene, 'orb_venom', FX.orb(R.toxic, 3));
  addImg(scene, 'orb_heal', FX.orb(R.heal, 4));
  addImg(scene, 'orb_beam', FX.orb(R.ice, 5));
  addImg(scene, 'orb_wrench', FX.orb(R.steel, 3));
  addImg(scene, 'bullet', FX.bullet());
  addImg(scene, 'arrow', FX.arrow());
  addSheet(scene, 'puff_fire', strip([0, 1, 2, 3, 4].map((f) => FX.puff(f, R.fire))), 32, 32);
  addSheet(scene, 'puff_dust', strip([0, 1, 2, 3, 4].map((f) => FX.puff(f, R.bone))), 32, 32);
  addSheet(scene, 'puff_venom', strip([0, 1, 2, 3, 4].map((f) => FX.puff(f, R.toxic))), 32, 32);
  addSheet(scene, 'puff_magic', strip([0, 1, 2, 3, 4].map((f) => FX.puff(f, R.magic))), 32, 32);
  addSheet(scene, 'ring_heal', strip([0, 1, 2, 3].map((f) => FX.ring(f, R.heal))), 64, 32);
  addSheet(scene, 'ring_slam', strip([0, 1, 2, 3].map((f) => FX.ring(f, R.orange))), 64, 32);
  addSheet(scene, 'ring_taunt', strip([0, 1, 2, 3].map((f) => FX.ring(f, R.red))), 64, 32);
  for (let i = 0; i < 2; i++) addImg(scene, 'puddle_' + i, FX.puddle(i));
  addImg(scene, 'spark', FX.spark());
  addSheet(scene, 'coin', strip([0, 1, 2, 3].map((f) => FX.coin(f))), 8, 8);
  addSheet(scene, 'sentry', strip([FX.sentry(0), FX.sentry(1)]), 24, 28);
  addImg(scene, 'snare', FX.snare());
  for (const [k, c] of [['dot_firefly', '#d6ff7a'], ['dot_petal', '#ffb3c8'], ['dot_dust', '#f6e6c8'], ['dot_white', '#ffffff'], ['dot_ember', '#ffb13b'], ['dot_spore', '#b9f5c6'], ['dot_leaf', '#8cc251']]) addImg(scene, k, FX.dot(c));

  // simple anims
  const A = scene.anims;
  A.create({ key: 'flame', frames: A.generateFrameNumbers('flame', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
  A.create({ key: 'flame_purple', frames: A.generateFrameNumbers('flame_purple', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
  A.create({ key: 'chicken', frames: A.generateFrameNumbers('chicken', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
  A.create({ key: 'slash', frames: A.generateFrameNumbers('slash', { start: 0, end: 2 }), frameRate: 22, repeat: 0 });
  A.create({ key: 'coin', frames: A.generateFrameNumbers('coin', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
  for (const k of ['puff_fire', 'puff_dust', 'puff_venom', 'puff_magic']) A.create({ key: k, frames: A.generateFrameNumbers(k, { start: 0, end: 4 }), frameRate: 16, repeat: 0 });
  for (const k of ['ring_heal', 'ring_slam', 'ring_taunt']) A.create({ key: k, frames: A.generateFrameNumbers(k, { start: 0, end: 3 }), frameRate: 14, repeat: 0 });
  A.create({ key: 'sentry', frames: A.generateFrameNumbers('sentry', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
  for (const k of ['viper', 'spitter', 'tortoise', 'mandrake']) {
    A.create({ key: `en_${k}_idle`, frames: A.generateFrameNumbers('en_' + k, { frames: [0, 1] }), frameRate: 3, repeat: -1 });
    A.create({ key: `en_${k}_move`, frames: A.generateFrameNumbers('en_' + k, { frames: [2, 3] }), frameRate: 7, repeat: -1 });
    A.create({ key: `en_${k}_atk`, frames: A.generateFrameNumbers('en_' + k, { frames: [4, 4, 0] }), frameRate: 8, repeat: 0 });
  }
  void lowFx;
}
