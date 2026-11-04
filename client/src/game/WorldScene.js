/* global Phaser */
// The world: renders a map in isometric pixel art, lights it, runs the player,
// NPCs, critters, and syncs other players.
import { G } from './state.js';
import { net } from '../net.js';
import { buildVillage, buildCastle, getG } from '../world/maps.js';
import { generateDungeon, DUNGEONS, DIFFICULTY, bracket } from '../world/dungeon.js';
import { building } from '../art/props.js';
import { WALL_H } from '../art/tiles.js';
import { anchorOf, ensurePlayerSprite, ensureHuman, addSheet } from './assets.js';
import { hash2, noise2 } from '../art/pix.js';
import { CLASSES, derive } from '../data/classes.js';
import { ZOOM_TARGET_H } from '../config.js';
import { sfx, playMusic } from '../audio.js';
import { Combat } from './combat.js';
import { gearTotals } from './progress.js';

export const iso = (x, y) => ({ x: (x - y) * 16, y: (x + y) * 8 });
export const depthOf = (x, y, bias = 0) => 1000 + (x + y) * 50 + bias;
const LIQUID = { p: 'pond', w: 'water', l: 'lava' };

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }

  init(data) {
    this.zoneKey = data.zone || 'village';
    this.zoneData = data;
  }

  create() {
    G.scene = this;
    G.zone = this.zoneKey;
    this.t = 0;
    this.remotes = new Map();
    this.enemies = new Map();
    this.projectiles = [];
    this.devices = [];
    this.fxList = [];
    this.pickups = [];
    this.particles = [];
    this.liquids = [];
    this.flickers = [];
    this.npcs = [];
    this.critters = [];
    this.blockers = new Set();
    this.stTimer = 0;
    this.exitLock = 0.8;
    this.isHost = true;

    // ---- build map ----
    if (this.zoneKey === 'village') this.map = buildVillage();
    else if (this.zoneKey === 'castle') this.map = buildCastle();
    else {
      const r = this.zoneData.run;
      this.run = r;
      this.map = generateDungeon(r.seed, r.dungeon, r.size);
      this.isHost = !r.online || r.host === net.id;
    }
    const m = this.map;
    this.theme = m.theme;
    this.solid = new Uint8Array(m.w * m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const c = m.ground[y][x];
      if (c === '.' || c === 'W' || LIQUID[c]) this.solid[y * m.w + x] = 1;
    }
    for (const p of m.props) for (const [x, y] of p.solid || []) this.setSolid(x, y);
    for (const b of m.buildings) for (let y = b.y; y < b.y + b.cfg.d; y++) for (let x = b.x; x < b.x + b.cfg.w; x++) this.setSolid(x, y);

    this.cameras.main.setBackgroundColor(m.theme === 'village' ? '#16142a' : '#0b0916');
    this.renderMap();
    this.setupLighting();
    this.setupParticles();

    // ---- player ----
    const save = G.save;
    const spawn = this.zoneData.spawn || this.arrivalSpawn() || m.spawn;
    this.me = this.makeHero(save, spawn.x, spawn.y);
    this.combat = new Combat(this);
    if (this.zoneKey === 'dungeon') this.combat.setupDungeon();

    // ---- camera ----
    this.camPos = { ...iso(this.me.x, this.me.y) };
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.applyZoom, this);
      for (const k of ['roster', 'pj', 'pl', 'st', 'chat', 'ev']) net.off(k);
    });
    if (!location.search.includes('auto=')) this.cameras.main.fadeIn(450, 10, 6, 24);

    // ---- input ----
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,SHIFT,Q,E,I,ENTER');
    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));

    // ---- network ----
    this.bindNet();
    const room = this.zoneKey === 'dungeon' ? null : this.zoneKey;
    if (room) net.join(room);
    else if (this.run && this.run.online) net.send({ t: 'enter' });

    // ---- UI ----
    G.ui.enterZone(this.zoneKey, this.zoneKey === 'dungeon' ? DUNGEONS[this.run.dungeon].name + ' · ' + DIFFICULTY[this.run.diff].name : (this.zoneKey === 'village' ? 'Brightheart Village' : "King's Castle"));
    playMusic(m.ambient.music || 'village');
  }

  arrivalSpawn() {
    const from = this.zoneData.from;
    if (this.zoneKey === 'village' && from === 'castle') return { x: 16, y: 3.6 };
    if (this.zoneKey === 'village' && from === 'dungeon') return { x: 16, y: 27 };
    return null;
  }

  setSolid(x, y, v = 1) { if (x >= 0 && y >= 0 && x < this.map.w && y < this.map.h) this.solid[y * this.map.w + x] = v; }
  isSolid(x, y) {
    const m = this.map;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    return this.solid[ty * m.w + tx] === 1 || this.blockers.has(tx + ',' + ty);
  }
  freeAt(x, y, r) {
    return !this.isSolid(x - r, y - r) && !this.isSolid(x + r, y - r) && !this.isSolid(x - r, y + r) && !this.isSolid(x + r, y + r);
  }
  moveEntity(e, dx, dy, r = 0.26) {
    let moved = false;
    if (dx && this.freeAt(e.x + dx, e.y, r)) { e.x += dx; moved = true; }
    if (dy && this.freeAt(e.x, e.y + dy, r)) { e.y += dy; moved = true; }
    return moved;
  }

  /* ======================== MAP RENDERING ======================== */

  renderMap() {
    const m = this.map;
    const T = this.theme;
    const isLand = (c) => c !== '.' && !LIQUID[c];
    this.bakeList = [];
    const edge = (x, y, key) => this.bakeList.push(this.add.image(x, y, key).setOrigin(0, 0).setDepth(-15));
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const c = m.ground[y][x];
      if (c === '.') continue;
      const p = iso(x, y);
      const v = Math.floor(hash2(x, y, 7) * 6);
      if (LIQUID[c]) {
        const lv = Math.floor(hash2(x, y, 3) * 3);
        const img = this.add.image(p.x - 16, p.y + 3, `${LIQUID[c]}_${lv}_0`).setOrigin(0, 0).setDepth(-30);
        this.liquids.push({ img, base: `${LIQUID[c]}_${lv}_`, ph: Math.floor(hash2(x, y, 5) * 4) });
        if (c === 'l') this.map.lights.push({ x: x + 0.5, y: y + 0.5, z: 0, color: 0xff6a1a, r: 50, i: 0.35, flicker: 0.1, soft: true });
      } else if (c !== 'W') {
        let key;
        if (c === 'r') {
          let mask = 0;
          if (getG(m, x - 1, y) !== 'r') mask |= 1;
          if (getG(m, x + 1, y) !== 'r') mask |= 2;
          if (getG(m, x, y - 1) !== 'r') mask |= 4;
          if (getG(m, x, y + 1) !== 'r') mask |= 8;
          key = 'carpet_' + mask;
        } else {
          key = `t_${T}_${c}_${v}`;
          if (!this.textures.exists(key)) key = `t_${T}_s_${v}`;
          if (!this.textures.exists(key)) key = `t_${T}_${Object.keys({ g: 1, c: 1, s: 1 }).find((k) => this.textures.exists(`t_${T}_${k}_0`))}_${v}`;
        }
        const img = this.add.image(p.x - 16, p.y, key).setOrigin(0, 0).setDepth(-20);
        this.bakeList.push(img);
        // large-scale colour variation (keeps big fields from looking tiled)
        const n = noise2(x / 7, y / 7, 77);
        const k = 0.86 + n * 0.16;
        img.setTint(Phaser.Display.Color.GetColor(Math.min(255, 255 * k), Math.min(255, 255 * (k + 0.02)), Math.min(255, 255 * (k - 0.03))));
      }
      // cliff faces where land meets void or liquid
      const self = c;
      const sw = getG(m, x, y + 1), se = getG(m, x + 1, y);
      const vv = Math.floor(hash2(x, y, 11) * 4);
      if (self === '.' || LIQUID[self]) {
        if (LIQUID[self]) {
          if (sw === '.') edge(p.x - 16, p.y + 8, `e_${T}_sw_${vv}`);
          if (se === '.') edge(p.x, p.y + 8, `e_${T}_se_${vv}`);
        }
        continue;
      }
      if (sw === '.') edge(p.x - 16, p.y + 8, `e_${T}_sw_${vv}`);
      else if (LIQUID[sw]) edge(p.x - 16, p.y + 8, `es_${T}_sw_${vv}`);
      if (se === '.') edge(p.x, p.y + 8, `e_${T}_se_${vv}`);
      else if (LIQUID[se]) edge(p.x, p.y + 8, `es_${T}_se_${vv}`);
      void isLand;
    }
    this.bakeGround();
    // walls
    for (const key of m.walls.keys()) {
      const [x, y] = key.split(',').map(Number);
      if (getG(m, x, y) !== 'W') continue;
      const floorBehind = (c) => c !== '.' && c !== 'W';
      const low = floorBehind(getG(m, x - 1, y)) || floorBehind(getG(m, x, y - 1));
      const p = iso(x, y);
      const v = Math.floor(hash2(x, y, 13) * 4);
      const h = low ? 8 : WALL_H;
      this.add.image(p.x - 16, p.y - h, `${low ? 'wl' : 'w'}_${T}_${v}`).setOrigin(0, 0).setDepth(low ? depthOf(x + 1, y + 1, -1) : depthOf(x, y, -40));
    }
    // buildings
    for (const b of m.buildings) {
      const key = 'bld_' + m.key + '_' + b.id;
      if (!this.textures.exists(key)) {
        const res = building(b.cfg, b.seed || 1);
        this.textures.addCanvas(key, res.pix.canvas());
        this.bAnchors = this.bAnchors || {};
        this.bAnchors[key] = res;
      }
      const res = this.bAnchors?.[key] || building(b.cfg, b.seed || 1);
      const p = iso(b.x, b.y);
      const img = this.add.image(p.x, p.y, key).setOrigin(res.ax / res.pix.w, res.ay / res.pix.h);
      img.setDepth(depthOf(b.x + Math.min(b.cfg.w, b.cfg.d) * 0.5, b.y + Math.min(b.cfg.w, b.cfg.d) * 0.5, 0) + Math.min(b.cfg.w, b.cfg.d) * 25);
      b.img = img;
      if (b.cfg.chimney) this.flickers.push({ smoke: true, x: b.x + b.cfg.w * 0.72 + 0.1, y: b.y + b.cfg.d * 0.3 + 0.3, z: b.cfg.H + (b.cfg.roofH || 16) + 6, t: 0 });
      if (b.label) {
        const lp = iso(b.x + b.cfg.w, b.y + b.cfg.d);
        void lp;
      }
    }
    // props
    for (const pr of m.props) this.addProp(pr);
    // breakables
    this.breakables = new Map();
    for (const b of m.breakables) {
      const key = b.t === 'chest' ? 'chest_c' : b.t === 'crate' ? 'crate_' + (b.id % 3) : 'jar_' + (b.id % 3);
      const p = iso(b.x, b.y);
      const a = anchorOf(key);
      const img = this.add.image(p.x, p.y, key).setOrigin(a.x, a.y).setDepth(depthOf(b.x, b.y));
      this.breakables.set(b.id, { ...b, img, hp: b.t === 'chest' ? 3 : 1 });
      this.setSolid(Math.floor(b.x), Math.floor(b.y));
    }
    // hazards
    this.hazards = [];
    for (const h of m.hazards) {
      const p = iso(h.x, h.y);
      const img = this.add.image(p.x, p.y, 'puddle_' + (this.hazards.length % 2)).setDepth(-5).setScale(h.r * 0.9).setAlpha(0.95);
      this.tweens.add({ targets: img, alpha: 0.7, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1 });
      this.hazards.push({ ...h, img });
      if (Math.random() < 0.7) this.map.lights.push({ x: h.x, y: h.y, z: 0, color: 0x8dff4a, r: 40, i: 0.3, flicker: 0.15, soft: true });
    }
    // NPCs
    for (const n of m.npcs) {
      const key = 'npc_' + n.id;
      ensureHuman(this, key, n.look);
      const p = iso(n.x, n.y);
      const shadow = this.add.image(p.x, p.y, 'shadow').setDepth(depthOf(n.x, n.y, -2));
      const spr = this.add.sprite(p.x, p.y + 2, key).setOrigin(0.5, 1).setDepth(depthOf(n.x, n.y));
      spr.play({ key: `${key}_idle_f`, startFrame: Math.floor(Math.random() * 2) });
      spr.setFlipX(!!n.flip);
      const label = this.makeLabel(n.name, '#ffe39a').setPosition(p.x, p.y - 30).setDepth(90000).setAlpha(0);
      let mark = null;
      if (['blacksmith', 'store', 'enchanter', 'tavern', 'guild', 'king'].includes(n.role)) {
        mark = this.makeLabel('!', '#ffcf4a', 10).setPosition(p.x, p.y - 38).setDepth(90001);
        this.tweens.add({ targets: mark, y: p.y - 41, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.npcs.push({ ...n, spr, label, shadow, mark });
      this.setSolid(Math.floor(n.x), Math.floor(n.y));
    }
    for (const w of m.wanderers || []) {
      const key = 'npc_w_' + w.name;
      ensureHuman(this, key, w.look);
      const spr = this.add.sprite(0, 0, key).setOrigin(0.5, 1);
      const shadow = this.add.image(0, 0, 'shadow');
      this.critters.push({ kind: 'villager', key, x: w.x, y: w.y, tx: w.x, ty: w.y, wait: Math.random() * 3, spr, shadow, speed: 1.1, name: w.name });
    }
    for (const c of m.critters || []) {
      const spr = this.add.sprite(0, 0, 'chicken').setOrigin(0.5, 1).play({ key: 'chicken', startFrame: Math.floor(Math.random() * 2) });
      this.critters.push({ kind: 'chicken', x: c.x, y: c.y, tx: c.x, ty: c.y, wait: Math.random() * 2, spr, speed: 1.4, home: { x: c.x, y: c.y } });
    }
  }

  // Bake static ground + cliff tiles into a few chunk textures (far fewer draw objects on phones)
  bakeGround() {
    const list = this.bakeList;
    if (!list.length) return;
    const CH = 512;
    const chunks = new Map();
    for (const img of list) {
      const cx = Math.floor(img.x / CH), cy = Math.floor(img.y / CH);
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        // an image may straddle chunk borders: add it to every chunk it touches
        const kx = Math.floor((img.x + ox * (img.width - 1)) / CH), ky = Math.floor((img.y + oy * (img.height - 1)) / CH);
        const k = kx + ',' + ky;
        if (!chunks.has(k)) chunks.set(k, new Set());
        chunks.get(k).add(img);
      }
      void cx; void cy;
    }
    for (const [k, set] of chunks) {
      const [kx, ky] = k.split(',').map(Number);
      const rt = this.add.renderTexture(kx * CH, ky * CH, CH, CH).setOrigin(0, 0).setDepth(-20);
      const sorted = [...set].sort((a, b) => a.depth - b.depth);
      for (const img of sorted) rt.draw(img, img.x - kx * CH, img.y - ky * CH);
    }
    for (const img of list) img.destroy();
    this.bakeList = [];
  }

  addProp(pr) {
    const p = iso(pr.x, pr.y);
    let key;
    const v = (pr.seed ?? Math.floor(hash2(pr.x * 3, pr.y * 7, 2) * 6)) % 6;
    switch (pr.t) {
      case 'tree': key = 'tree_' + (pr.blossom ? 4 : pr.fruit ? 5 : v % 4); break;
      case 'jtree': key = 'jtree_' + v; break;
      case 'fern': key = 'fern_' + v; break;
      case 'bush': key = 'bush_' + (pr.flowers ? ['#ffb3c8', '#ffe27a', '#a9d8ff', '#f2f6f4'].indexOf(pr.flowers) + 1 || 1 : 0); break;
      case 'pillar': key = (pr.broken ? 'pillarb_' : 'pillar_') + (v % 3); break;
      case 'cpillar': key = 'cpillar_0'; break;
      case 'statue': key = 'statue_' + (v % 3); break;
      case 'rock': key = 'rock_' + (v % 3); break;
      case 'stall': key = pr.ramp && pr.ramp[3] === '#3967bb' ? 'stall_b' : 'stall_r'; break;
      case 'fence': key = 'fence_' + pr.dir; break;
      case 'wbanner': key = 'wbanner_' + (pr.emblem || 'crown'); break;
      case 'portal': key = 'portal_0'; break;
      default: key = pr.t;
    }
    if (!this.textures.exists(key)) return;
    const a = anchorOf(key);
    const img = this.add.image(p.x, p.y - (pr.z || 0), key).setOrigin(a.x, a.y);
    img.setDepth(pr.wall ? depthOf(pr.x, pr.y, -30) : depthOf(pr.x, pr.y));
    if (pr.t === 'tree' || pr.t === 'jtree') {
      // gentle sway
      this.tweens.add({ targets: img, scaleX: 1.02, duration: 1800 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.image(p.x, p.y, 'shadow').setScale(1.6, 1.4).setDepth(-4).setAlpha(0.8);
    }
    if (pr.t === 'portal') {
      let f = 0;
      this.time.addEvent({ delay: 120, loop: true, callback: () => { f = (f + 1) % 4; img.setTexture('portal_' + f); } });
      this.portalImg = img;
    }
    // flames
    const flame = (dx, dy, purple, s = 1) => {
      const fl = this.add.sprite(p.x + dx, p.y + dy, purple ? 'flame_purple' : 'flame').setOrigin(0.5, 1).play({ key: purple ? 'flame_purple' : 'flame', startFrame: Math.floor(Math.random() * 4) }).setDepth(85200).setScale(s);
      fl.setBlendMode(Phaser.BlendModes.ADD);
      return fl;
    };
    if (pr.t === 'brazier') flame(0, -20, false, 1);
    if (pr.t === 'candelabra') { flame(-5, -29, false, 0.45); flame(0, -29, false, 0.45); flame(4, -29, false, 0.45); }
    return img;
  }

  makeLabel(text, color = '#ffffff', size = 8) {
    return this.add.text(0, 0, text, {
      fontFamily: '"Pixelify Sans", monospace', fontSize: size + 'px', color, stroke: '#1b1230', strokeThickness: 3, resolution: 4,
    }).setOrigin(0.5, 1);
  }

  /* ======================== LIGHT + ATMOSPHERE ======================== */

  setupLighting() {
    const amb = this.map.ambient;
    this.lightStamp = this.make.image({ key: 'light', add: false }).setOrigin(0.5);
    this.glows = [];
    for (const L of this.map.lights) {
      const p = iso(L.x, L.y);
      const g = this.add.image(p.x, p.y - L.z, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(L.color).setDepth(85300);
      g.setScale((L.r * (L.soft ? 1.0 : 0.7)) / 64, (L.r * (L.soft ? 0.6 : 0.55)) / 64);
      g.setAlpha(L.i * 0.42);
      this.glows.push({ L, g, base: L.i * 0.42, ph: Math.random() * 10 });
    }
    if (amb.dark > 0) {
      this.lightRT = this.add.renderTexture(0, 0, 64, 64).setOrigin(0.5).setScrollFactor(0).setDepth(85000);
      this.lightRT.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    if (amb.tint && amb.tint !== 0xffffff) {
      this.tintRect = this.add.rectangle(0, 0, 10, 10, amb.tint).setOrigin(0.5).setScrollFactor(0).setDepth(85001).setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0.5).setScrollFactor(0).setDepth(86000).setAlpha(amb.vignette ?? 0.5);
    if (amb.rays) {
      this.rays = [];
      for (let i = 0; i < 4; i++) {
        const r = this.add.image(0, 0, 'light').setScrollFactor(0).setDepth(85500).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe6b0).setAlpha(0.07).setAngle(-28);
        this.rays.push({ r, ph: i * 1.7, off: -0.4 + i * 0.32 });
      }
    }
  }

  updateLighting(dt) {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const view = cam.worldView;
    for (const gl of this.glows) {
      const f = gl.L.flicker || 0;
      gl.ph += dt * (6 + f * 20);
      gl.g.setAlpha(gl.base * (1 - f + Math.sin(gl.ph) * f * 0.5 + Math.sin(gl.ph * 2.7) * f * 0.5));
    }
    if (this.lightRT) {
      const rt = this.lightRT;
      const W = Math.ceil(vw) + 2, H = Math.ceil(vh) + 2;
      if (rt.width !== W || rt.height !== H) rt.resize(W, H);
      rt.setPosition(cam.width / 2, cam.height / 2);
      rt.clear();
      rt.fill(this.map.ambient.ambientColor ?? 0x404060, 1);
      const st = this.lightStamp;
      const drawLight = (wx, wy, rad, alpha) => {
        const sx = wx - view.x, sy = wy - view.y;
        if (sx < -rad || sy < -rad || sx > W + rad || sy > H + rad) return;
        st.setScale((rad * 2) / 128, (rad * 1.35) / 128).setAlpha(alpha);
        rt.erase(st, sx, sy);
      };
      for (const gl of this.glows) {
        const p = iso(gl.L.x, gl.L.y);
        drawLight(p.x, p.y - gl.L.z * 0.4, gl.L.r * 1.3, Math.min(1, gl.g.alpha / gl.base) * (gl.L.soft ? 0.6 : 0.95));
      }
      // the hero carries a soft light, so dark dungeons stay readable
      const mp = iso(this.me.x, this.me.y);
      drawLight(mp.x, mp.y - 10, 120, 0.9);
      for (const r of this.remotes.values()) { const p = iso(r.x, r.y); drawLight(p.x, p.y - 10, 70, 0.6); }
      for (const pr of this.projectiles) if (pr.light) { const p = iso(pr.x, pr.y); drawLight(p.x, p.y - 8, 40, 0.7); }
    }
    if (this.tintRect) { this.tintRect.setPosition(cam.width / 2, cam.height / 2).setSize(vw + 4, vh + 4); }
    this.vignette.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(vw + 4, vh + 4);
    if (this.rays) for (const ry of this.rays) {
      ry.ph += dt * 0.25;
      ry.r.setPosition(cam.width / 2 + (ry.off + Math.sin(ry.ph) * 0.05) * vw, cam.height / 2 - vh * 0.1).setDisplaySize(vw * 0.18, vh * 2.2);
      ry.r.setAlpha(0.05 + Math.sin(ry.ph * 1.3) * 0.025);
    }
  }

  setupParticles() {
    const kind = this.map.ambient.particles;
    const n = G.settings.lowFx ? 14 : 34;
    const tex = { petals: 'dot_petal', fireflies: 'dot_firefly', dust: 'dot_dust', embers: 'dot_ember' }[kind];
    if (!tex) return;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(0, 0, i % 3 === 0 && kind === 'petals' ? 'dot_leaf' : tex).setDepth(84000);
      if (kind === 'fireflies') img.setBlendMode(Phaser.BlendModes.ADD);
      this.particles.push({ img, kind, x: Math.random(), y: Math.random(), ph: Math.random() * 10, sp: 0.5 + Math.random() });
    }
  }

  updateParticles(dt) {
    const view = this.cameras.main.worldView;
    for (const p of this.particles) {
      p.ph += dt * p.sp;
      if (p.kind === 'petals') { p.x += dt * 0.03 * p.sp; p.y += dt * 0.025 * p.sp; }
      else if (p.kind === 'fireflies') { p.x += Math.sin(p.ph) * dt * 0.01; p.y += Math.cos(p.ph * 0.7) * dt * 0.01 - dt * 0.004; }
      else { p.x += Math.sin(p.ph * 0.3) * dt * 0.004; p.y -= dt * 0.006 * p.sp; }
      p.x = ((p.x % 1) + 1) % 1; p.y = ((p.y % 1) + 1) % 1;
      p.img.setPosition(view.x + p.x * view.width, view.y + p.y * view.height);
      if (p.kind === 'fireflies') p.img.setAlpha(0.35 + Math.sin(p.ph * 3) * 0.35);
      else if (p.kind === 'dust') p.img.setAlpha(0.25 + Math.sin(p.ph) * 0.15);
      else p.img.setAlpha(0.85);
    }
  }

  /* ======================== HERO ======================== */

  makeHero(save, x, y) {
    const key = ensurePlayerSprite(this, save.cls, save.look);
    const cls = CLASSES[save.cls];
    const stats = derive(save.cls, save.level, gearTotals(save), { meal: this.zoneKey === 'dungeon' ? save.meal : null, banquet: this.run?.banquet });
    const hero = {
      id: net.id || 0, local: true, name: save.name, cls: save.cls, key,
      x, y, face: { x: 1, y: 1 }, state: 'idle', anim: '',
      stats, hp: stats.maxHp, mp: cls.resource === 'scrap' ? 40 : stats.maxMp,
      maxMp: stats.maxMp, resource: cls.resource,
      cds: [0, 0], atkCd: 0, dodgeCd: 0, potCd: 0, iframes: 0,
      status: {}, down: false, bleed: 0, downs: 0, dead: false,
    };
    const p = iso(x, y);
    hero.shadow = this.add.image(p.x, p.y, 'shadow');
    hero.spr = this.add.sprite(p.x, p.y, key).setOrigin(0.5, 1);
    hero.spr.play(`${key}_idle_f`);
    hero.tag = this.makeLabel(save.name, '#ffffff', 7).setAlpha(0.9);
    return hero;
  }

  heroAnim(e, state) {
    const side = e.face.y >= 0 ? 'f' : 'b';
    const k = `${e.key}_${state}_${side}`;
    if (e.anim !== k) {
      e.anim = k;
      e.spr.play(k, state === 'atk' ? false : true);
    }
    e.spr.setFlipX(e.face.x < 0);
  }

  applyZoom() {
    const cam = this.cameras.main;
    const h = this.scale.height;
    const z = Math.max(1, Math.round(h / ZOOM_TARGET_H));
    cam.setZoom(z);
    cam.setRoundPixels(true);
  }

  onKey(ev) {
    if (G.ui.typing()) return;
    const k = ev.key.toLowerCase();
    if (k === ' ' || k === 'j') this.combat.attack();
    else if (k === 'k') this.combat.skill(0);
    else if (k === 'l') this.combat.skill(1);
    else if (k === 'shift') this.combat.dodge();
    else if (k === 'q') this.combat.potion();
    else if (k === 'e') this.interact();
    else if (k === 'i') G.ui.openPanel('character');
    else if (k === 'enter') G.ui.openChat();
  }

  /* ======================== UPDATE ======================== */

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    const me = this.me;
    this.exitLock = Math.max(0, this.exitLock - dt);

    // --- input -> movement
    let mx = G.input.mx, my = G.input.my;
    if (!G.ui.typing()) {
      const K = this.keys;
      if (K.A.isDown || K.LEFT.isDown) mx -= 1;
      if (K.D.isDown || K.RIGHT.isDown) mx += 1;
      if (K.W.isDown || K.UP.isDown) my -= 1;
      if (K.S.isDown || K.DOWN.isDown) my += 1;
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    this.combat.updateHero(me, dt, mx, my);

    // --- camera
    const target = iso(me.x, me.y - 0.0);
    this.camPos.x += (target.x - this.camPos.x) * Math.min(1, dt * 7);
    this.camPos.y += (target.y - 14 - this.camPos.y) * Math.min(1, dt * 7);
    const cam = this.cameras.main;
    cam.centerOn(Math.round(this.camPos.x + (this.shakeX || 0)), Math.round(this.camPos.y + (this.shakeY || 0)));
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeAmt * (this.shakeT > 0 ? 1 : 0);
      this.shakeX = (Math.random() - 0.5) * s; this.shakeY = (Math.random() - 0.5) * s;
    } else { this.shakeX = 0; this.shakeY = 0; }

    // --- world animation
    if (Math.floor(this.t * 4) !== this.liqFrame) {
      this.liqFrame = Math.floor(this.t * 4);
      for (const l of this.liquids) l.img.setTexture(l.base + ((this.liqFrame + l.ph) % 4));
    }
    this.updateCritters(dt);
    this.updateNpcs(dt);
    this.updateFlickers(dt);
    this.combat.update(dt);
    this.updateRemotes(dt);
    this.updateLighting(dt);
    this.updateParticles(dt);
    this.checkExits();

    // --- net state
    this.stTimer -= dt;
    if (this.stTimer <= 0 && net.connected) {
      this.stTimer = 0.1;
      const s = [+me.x.toFixed(2), +me.y.toFixed(2), Math.sign(me.face.x) || 1, Math.sign(me.face.y) || 1, me.state, Math.round(me.hp), me.stats.maxHp, me.down ? 1 : 0, me.dead ? 1 : 0];
      const sig = s.join(',');
      if (sig !== this.lastSig || this.t - (this.lastStT || 0) > 1) {
        this.lastSig = sig; this.lastStT = this.t;
        net.send({ t: 'st', s });
      }
    }
    G.ui.updateHud(me, this);
  }

  shake(amount = 3, dur = 0.15) {
    if (!G.settings.shake) return;
    this.shakeAmt = amount; this.shakeT = dur;
  }

  updateFlickers(dt) {
    for (const f of this.flickers) {
      if (!f.smoke) continue;
      f.t -= dt;
      if (f.t <= 0) {
        f.t = 0.5 + Math.random() * 0.4;
        const p = iso(f.x, f.y);
        const img = this.add.image(p.x, p.y - f.z, 'dot_dust').setDepth(70000).setAlpha(0.5).setScale(2);
        this.tweens.add({ targets: img, y: img.y - 26, x: img.x + 8 + Math.random() * 6, alpha: 0, scale: 4, duration: 2200, onComplete: () => img.destroy() });
      }
    }
  }

  updateCritters(dt) {
    for (const c of this.critters) {
      c.wait -= dt;
      const dx = c.tx - c.x, dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      let moving = false;
      if (c.wait <= 0 && d > 0.05) {
        const step = Math.min(d, c.speed * dt);
        const ox = c.x, oy = c.y;
        this.moveEntity(c, (dx / d) * step, (dy / d) * step, 0.2);
        moving = true;
        if (Math.hypot(c.x - ox, c.y - oy) < step * 0.3) { c.tx = c.x; c.ty = c.y; }
        const sx = (dx - dy), sy = (dx + dy);
        if (c.kind === 'villager') {
          const side = sy >= 0 ? 'f' : 'b';
          const k = `${c.key}_walk_${side}`;
          if (c.anim !== k) { c.anim = k; c.spr.play(k); }
        }
        c.spr.setFlipX(c.kind === 'chicken' ? sx > 0 : sx < 0);
      } else if (c.wait <= 0) {
        c.wait = 1.5 + Math.random() * 4;
        const home = c.home || { x: c.x, y: c.y };
        const rad = c.kind === 'chicken' ? 1.8 : 3.5;
        c.tx = home.x + (Math.random() - 0.5) * rad * 2;
        c.ty = home.y + (Math.random() - 0.5) * rad * 2;
        if (c.kind === 'villager' && !c.home) c.home = { x: c.x, y: c.y };
        if (this.isSolid(c.tx, c.ty)) { c.tx = c.x; c.ty = c.y; }
      }
      if (!moving && c.kind === 'villager') {
        const k = `${c.key}_idle_f`;
        if (c.anim !== k) { c.anim = k; c.spr.play(k); }
      }
      const p = iso(c.x, c.y);
      c.spr.setPosition(p.x, p.y + 2).setDepth(depthOf(c.x, c.y));
      if (c.shadow) c.shadow.setPosition(p.x, p.y).setDepth(depthOf(c.x, c.y, -2));
    }
  }

  updateNpcs() {
    const me = this.me;
    let best = null, bd = 99;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - me.x, n.y - me.y);
      const near = d < 2.2;
      n.label.setAlpha(near ? 1 : 0);
      if (near && d < bd && n.role !== 'guard') { bd = d; best = { kind: 'npc', npc: n, label: 'Talk to ' + n.name.split(' ')[0] }; }
      // face the player when close
      if (d < 3) n.spr.setFlipX(me.x - me.y < n.x - n.y);
    }
    for (const it of this.map.interacts) {
      const d = Math.hypot(it.x - me.x, it.y - me.y);
      if (d < it.r + 0.6 && d < bd) { bd = d; best = { kind: it.kind, label: it.label, it }; }
    }
    // reviving downed teammates is automatic while standing close (handled in combat)
    this.nearest = best;
    G.ui.setInteract(best && !me.down ? best.label : null);
  }

  interact() {
    const n = this.nearest;
    if (!n || this.me.down) return;
    sfx.ui();
    if (n.kind === 'npc') G.ui.talkTo(n.npc);
    else if (n.kind === 'portal') G.ui.openPanel('portal');
    else if (n.kind === 'guild') G.ui.openPanel('guild');
    else if (n.kind === 'leave' && this.combat.victory) this.combat.endRun('victory');
    else if (n.kind === 'leave') G.ui.confirm('Leave the dungeon?', 'You keep what you have picked up, but the run ends.', () => this.combat.endRun('leave'));
  }

  checkExits() {
    if (this.exitLock > 0) return;
    for (const ex of this.map.exits) {
      if (Math.hypot(ex.x - this.me.x, ex.y - this.me.y) < ex.r) {
        this.exitLock = 99;
        sfx.door();
        this.travel(ex.to, { from: this.zoneKey });
        return;
      }
    }
  }

  travel(zone, data = {}) {
    if (location.search.includes('auto=')) { this.scene.start('world', { zone, ...data }); return; }
    this.cameras.main.fadeOut(350, 10, 6, 24);
    this.time.delayedCall(360, () => this.scene.start('world', { zone, ...data }));
  }

  /* ======================== NETWORK ======================== */

  bindNet() {
    // scene-scoped handlers are replaced whenever the scene restarts
    const on = (t, fn) => { net.handlers[t] = [fn]; };
    on('roster', (m) => {
      for (const r of this.remotes.values()) this.removeRemote(r.id);
      for (const p of m.players) this.addRemote(p);
      G.ui.setOnlineCount(m.players.length + 1);
    });
    on('pj', (m) => { this.addRemote(m.p); G.ui.setOnlineCount(this.remotes.size + 1); });
    on('pl', (m) => { this.removeRemote(m.id); G.ui.setOnlineCount(this.remotes.size + 1); });
    on('st', (m) => {
      const r = this.remotes.get(m.id);
      if (r && m.s) this.applyRemoteState(r, m.s);
    });
    on('chat', (m) => {
      G.ui.chatLine(m.name, m.m, m.id === net.id);
      const who = m.id === net.id ? this.me : this.remotes.get(m.id);
      if (who) this.bubble(who, m.m);
    });
    on('ev', (m) => this.combat.onEvent(m.from, m.e));
  }

  addRemote(p) {
    if (p.id === net.id || this.remotes.has(p.id)) return;
    const look = p.look || {};
    const key = ensurePlayerSprite(this, p.cls || 'warrior', look);
    const s = p.s || [this.map.spawn.x, this.map.spawn.y, 1, 1, 'idle', 1, 1, 0, 0];
    const r = {
      id: p.id, name: p.name, cls: p.cls, key, x: s[0], y: s[1], tx: s[0], ty: s[1],
      face: { x: s[2], y: s[3] }, state: s[4], hp: s[5], maxHp: s[6], down: !!s[7], dead: !!s[8], anim: '',
    };
    const pp = iso(r.x, r.y);
    r.shadow = this.add.image(pp.x, pp.y, 'shadow');
    r.spr = this.add.sprite(pp.x, pp.y, key).setOrigin(0.5, 1);
    r.tag = this.makeLabel(p.name + (p.lvl ? ' · ' + p.lvl : ''), '#9fe0ff', 7);
    r.hpBar = this.add.graphics().setDepth(90000);
    this.remotes.set(p.id, r);
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.spr.destroy(); r.shadow.destroy(); r.tag.destroy(); r.hpBar.destroy();
    if (r.bubble) r.bubble.destroy();
    this.remotes.delete(id);
  }

  applyRemoteState(r, s) {
    r.tx = s[0]; r.ty = s[1];
    r.face = { x: s[2], y: s[3] };
    if (s[4] === 'atk' && r.state !== 'atk') r.anim = '';
    r.state = s[4]; r.hp = s[5]; r.maxHp = s[6]; r.down = !!s[7]; r.dead = !!s[8];
  }

  updateRemotes(dt) {
    for (const r of this.remotes.values()) {
      const d = Math.hypot(r.tx - r.x, r.ty - r.y);
      if (d > 4) { r.x = r.tx; r.y = r.ty; }
      else { r.x += (r.tx - r.x) * Math.min(1, dt * 12); r.y += (r.ty - r.y) * Math.min(1, dt * 12); }
      const p = iso(r.x, r.y);
      if (r.down) {
        r.spr.setFrame((r.face.y >= 0 ? 0 : 10) + 9); r.anim = 'down';
        r.spr.anims.stop();
      } else {
        const st = r.state === 'walk' || r.state === 'dodge' ? 'walk' : r.state === 'atk' ? 'atk' : 'idle';
        this.heroAnim(r, st);
      }
      r.spr.setVisible(!r.dead);
      r.spr.setPosition(p.x, p.y + 2).setDepth(depthOf(r.x, r.y));
      r.shadow.setPosition(p.x, p.y).setDepth(depthOf(r.x, r.y, -2));
      r.tag.setPosition(p.x, p.y - 30).setDepth(90000);
      r.hpBar.clear();
      if (this.zoneKey === 'dungeon') {
        const f = Math.max(0, r.hp / (r.maxHp || 1));
        r.hpBar.fillStyle(0x1b1230, 1).fillRect(p.x - 9, p.y - 29, 18, 3);
        r.hpBar.fillStyle(r.down ? 0xffb13b : 0x7ee07a, 1).fillRect(p.x - 8, p.y - 28, 16 * f, 1);
      }
      if (r.bubble) r.bubble.setPosition(p.x, p.y - 38);
    }
  }

  bubble(who, text) {
    if (who.bubble) who.bubble.destroy();
    const p = iso(who.x, who.y);
    const b = this.add.text(p.x, p.y - 38, text.length > 40 ? text.slice(0, 40) + '…' : text, {
      fontFamily: '"Pixelify Sans", monospace', fontSize: '7px', color: '#1b1230', backgroundColor: '#fff6e8',
      padding: { x: 3, y: 2 }, resolution: 4, wordWrap: { width: 110 },
    }).setOrigin(0.5, 1).setDepth(95000);
    who.bubble = b;
    this.time.delayedCall(4200, () => { if (who.bubble === b) { b.destroy(); who.bubble = null; } });
  }
}

export { DUNGEONS, DIFFICULTY, bracket, addSheet };
