/* global Phaser */
// 2D side-view world: autotiled terrain, parallax, platformer physics, side-scrolling
// camera, NPCs, critters and other players. Positions are in 16px tiles; (x, y) = feet.
import { G } from './state.js';
import { net } from '../net.js';
import { buildVillage, buildCastle, getG, surfaceY } from '../world/maps.js';
import { generateDungeon, DUNGEONS, DIFFICULTY, bracket } from '../world/dungeon.js';
import { bakeLevel, parallax, facade } from '../art/side.js';
import { anchorOf, ensureHeroSide, ensureHuman, addSheet } from './assets.js';
import { hash2 } from '../art/pix.js';
import { CLASSES, derive } from '../data/classes.js';
import { ZOOM_TARGET_H } from '../config.js';
import { playMusic, sfx } from '../audio.js';
import { Combat } from './combat.js';
import { gearTotals } from './progress.js';

import { TS, iso, depthOf, CHEST, PHYS } from './space.js';
export { TS, iso, depthOf, CHEST, PHYS };

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }

  init(data) { this.zoneKey = data.zone || 'village'; this.zoneData = data; }

  create() {
    G.scene = this;
    G.zone = this.zoneKey;
    this.t = 0;
    this.remotes = new Map();
    this.enemies = new Map();
    this.projectiles = [];
    this.particles = [];
    this.flickers = [];
    this.npcs = [];
    this.critters = [];
    this.blockers = new Set();
    this.stTimer = 0;
    this.exitLock = 0.6;
    this.isHost = true;

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
    this.cameras.main.setBackgroundColor('#0b0916');
    this.setupParallax();
    this.renderLevel();
    this.setupLighting();
    this.setupParticles();

    const spawn = this.zoneData.spawn || this.arrivalSpawn() || m.spawn;
    this.me = this.makeHero(G.save, spawn.x, spawn.y);
    this.combat = new Combat(this);
    if (this.zoneKey === 'dungeon') this.combat.setupDungeon();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, m.w * TS, m.h * TS);
    this.camPos = { x: this.me.x * TS, y: (this.me.y - 2) * TS };
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.applyZoom, this);
      for (const k of ['roster', 'pj', 'pl', 'st', 'chat', 'ev']) net.off(k);
    });
    if (!location.search.includes('auto=')) cam.fadeIn(400, 10, 6, 24);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,SHIFT,Q,E,I,ENTER');
    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));

    this.bindNet();
    const room = this.zoneKey === 'dungeon' ? null : this.zoneKey;
    if (room) net.join(room);
    else if (this.run && this.run.online) net.send({ t: 'enter' });

    G.ui.enterZone(this.zoneKey, this.zoneKey === 'dungeon' ? DUNGEONS[this.run.dungeon].name + ' · ' + DIFFICULTY[this.run.diff].name : (this.zoneKey === 'village' ? 'Brightheart Village' : "King's Castle"));
    playMusic(m.ambient.music || 'village');
  }

  arrivalSpawn() {
    const from = this.zoneData.from;
    if (this.zoneKey === 'village' && from === 'castle') return { x: 10.5, y: 14 };
    if (this.zoneKey === 'village' && from === 'dungeon') return { x: 112, y: 12 };
    return null;
  }

  /* ======================== COLLISION / PHYSICS ======================== */

  tileAt(x, y) { return getG(this.map, Math.floor(x), Math.floor(y)); }
  solidTile(tx, ty) {
    const g = getG(this.map, tx, ty);
    return g === '#' || g === 'c' || this.blockers.has(tx + ',' + ty);
  }
  // point test used by projectiles
  isSolid(x, y) { return this.solidTile(Math.floor(x), Math.floor(y)); }
  setSolid() { /* breakables no longer block movement in side view */ }

  boxHits(x, y, w, h) {
    const x0 = Math.floor(x - w / 2), x1 = Math.floor(x + w / 2 - 0.001);
    const y0 = Math.floor(y - h), y1 = Math.floor(y - 0.001);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
    return false;
  }

  // horizontal move with collision (combat uses this for dashes, knockback, enemy steps)
  moveEntity(e, dx) {
    if (!dx) return false;
    const w = e.bw || 0.5, h = e.bh || 1.8;
    const steps = Math.ceil(Math.abs(dx) / 0.25);
    const s = dx / steps;
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (this.boxHits(e.x + s, e.y, w, h)) {
        // small step-up (half-tile ledges)
        if (e.onGround && !this.boxHits(e.x + s, e.y - 0.5, w, h)) { e.y -= 0.5; e.x += s; moved = true; continue; }
        e.blocked = true;
        break;
      }
      e.x += s; moved = true;
    }
    return moved;
  }

  // gravity + vertical collision with one-way platforms
  phys(e, dt) {
    const w = e.bw || 0.5, h = e.bh || 1.8;
    if (!e.noGrav) e.vy = Math.min(PHYS.maxFall, (e.vy || 0) + PHYS.grav * dt);
    const dy = (e.vy || 0) * dt;
    const wasGround = e.onGround;
    e.onGround = false;
    if (dy > 0) {
      const steps = Math.ceil(dy / 0.25), s = dy / steps;
      for (let i = 0; i < steps; i++) {
        const ny = e.y + s;
        const x0 = Math.floor(e.x - w / 2 + 0.02), x1 = Math.floor(e.x + w / 2 - 0.02);
        const row = Math.floor(ny - 0.001);
        let land = false;
        if (row > Math.floor(e.y - 0.001)) {
          for (let tx = x0; tx <= x1; tx++) {
            const g = getG(this.map, tx, row);
            if (g === '#' || g === 'c' || this.blockers.has(tx + ',' + row)) land = true;
            else if (g === '=' && !e.dropThrough && e.y <= row + 0.05) land = true;
          }
        }
        if (land) { e.y = row; e.vy = 0; e.onGround = true; break; }
        e.y = ny;
      }
    } else if (dy < 0) {
      const ny = e.y + dy;
      if (this.boxHits(e.x, ny, w, h)) { e.vy = 0; e.y = Math.floor(ny - h) + 1 + h; }
      else e.y = ny;
    }
    if (!e.onGround && (e.vy || 0) >= 0) {
      // standing exactly on a surface
      const row = Math.floor(e.y + 0.001);
      if (Math.abs(e.y - row) < 0.002) {
        const x0 = Math.floor(e.x - w / 2 + 0.02), x1 = Math.floor(e.x + w / 2 - 0.02);
        for (let tx = x0; tx <= x1; tx++) { const g = getG(this.map, tx, row); if (g === '#' || g === 'c' || (g === '=' && !e.dropThrough)) e.onGround = true; }
      }
    }
    if (e.onGround) e.coyote = PHYS.coyote; else e.coyote = Math.max(0, (e.coyote || 0) - dt);
    if (e.onGround && !wasGround && e.landFx) e.landFx();
    if (e.y > this.map.h + 4) { e.y = 2; e.vy = 0; } // safety net
  }

  groundBelow(x, y) { return surfaceY(this.map, x, Math.floor(y)); }

  /* ======================== RENDERING ======================== */

  setupParallax() {
    const key = this.map.ambient.parallax || 'village';
    this.pLayers = [];
    parallax(key).forEach((L, i) => {
      const tk = `px_${key}_${i}`;
      if (!this.textures.exists(tk)) this.textures.addCanvas(tk, L.canvas);
      const ts = this.add.tileSprite(0, 0, 10, 270, tk).setOrigin(0, 0).setDepth(-100 + i);
      this.pLayers.push({ ts, f: L.factor });
    });
  }

  updateParallax() {
    const v = this.cameras.main.worldView;
    const mapH = this.map.h * TS;
    for (const L of this.pLayers) {
      L.ts.setPosition(v.x, v.y + v.height - 270 + (mapH - (v.y + v.height)) * L.f * 0.5);
      L.ts.setSize(Math.ceil(v.width) + 2, 270);
      L.ts.tilePositionX = v.x * L.f;
    }
  }

  renderLevel() {
    const m = this.map;
    for (const ch of bakeLevel(m)) {
      const k = `lvl_${m.key}_${ch.x}_${this.t}_${Math.random().toString(36).slice(2, 6)}`;
      if (ch.back) { this.textures.addCanvas(k + 'b', ch.back); this.add.image(ch.x, 0, k + 'b').setOrigin(0, 0).setDepth(-60); }
      this.textures.addCanvas(k, ch.front);
      this.add.image(ch.x, 0, k).setOrigin(0, 0).setDepth(-20);
    }
    // poison pools
    this.poolGfx = this.add.graphics().setDepth(-18);
    this.hazards = [];
    for (const pl of m.pools) {
      this.hazards.push({ t: 'pool', x: (pl.x0 + pl.x1) / 2, y: pl.y + 1, r: (pl.x1 - pl.x0) / 2 + 0.2, pool: pl });
    }
    // buildings
    for (const b of m.buildings) {
      const res = facade(b.cfg, b.seed || 1);
      const key = 'fac_' + m.key + '_' + b.id;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, res.pix.canvas());
      this.add.image(b.x * TS - res.ax, b.y * TS, key).setOrigin(0, 1).setDepth(-30);
      if (b.label) this.makeLabel(b.label, '#fde3a0', 7).setPosition((b.x + b.w / 2) * TS, (b.y - b.h) * TS - (b.cfg.roof ? 14 : 4)).setDepth(-29).setAlpha(0.9);
    }
    for (const pr of m.props) this.addProp(pr);
    // breakables
    this.breakables = new Map();
    for (const b of m.breakables) {
      const key = b.t === 'chest' ? 'chest_c' : b.t === 'crate' ? 'crate_side' : b.t === 'totem' ? 'pk_totem' : 'pk_jar';
      const a = anchorOf(key);
      const img = this.add.image(b.x * TS, b.y * TS + 1, key).setOrigin(a.x, a.y).setDepth(depthOf(b.x, b.y, -5));
      this.breakables.set(b.id, { ...b, img, hp: b.t === 'chest' ? 3 : 1 });
    }
    // hazards (puddles)
    for (const h of m.hazards) {
      const img = this.add.image(h.x * TS, h.y * TS - 1, 'puddle_side').setDepth(-10).setScale(h.r, 1).setAlpha(0.95);
      this.tweens.add({ targets: img, alpha: 0.7, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1 });
      this.hazards.push({ ...h, img });
      m.lights.push({ x: h.x, y: h.y - 0.3, color: 0x8dff4a, r: 40, i: 0.35, flicker: 0.15, soft: true });
    }
    // NPCs
    for (const n of m.npcs) {
      let spr;
      if (n.pack) {
        spr = this.add.image(n.x * TS, n.y * TS + 1, 'pk_' + n.pack).setOrigin(0.5, 1);
      } else {
        const key = 'npc_' + n.id;
        ensureHuman(this, key, n.look);
        spr = this.add.sprite(n.x * TS, n.y * TS + 2, key).setOrigin(0.5, 1);
        spr.play({ key: `${key}_idle_f`, startFrame: Math.floor(Math.random() * 2) });
      }
      spr.setDepth(depthOf(n.x, n.y, -3)).setFlipX(!!n.flip);
      this.tweens.add({ targets: spr, scaleY: 1.03, duration: 900 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const label = this.makeLabel(n.name, '#ffe39a').setPosition(n.x * TS, n.y * TS - spr.height - 4).setDepth(90000).setAlpha(0);
      let mark = null;
      if (['blacksmith', 'store', 'enchanter', 'tavern', 'guild', 'king'].includes(n.role)) {
        mark = this.makeLabel('!', '#ffcf4a', 10).setPosition(n.x * TS, n.y * TS - spr.height - 10).setDepth(90001);
        this.tweens.add({ targets: mark, y: mark.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.add.image(n.x * TS, n.y * TS, 'shadow').setDepth(depthOf(n.x, n.y, -4)).setScale(0.9, 0.7);
      this.npcs.push({ ...n, spr, label, mark });
    }
    for (const c of m.critters || []) {
      const spr = this.add.sprite(0, 0, 'chicken').setOrigin(0.5, 1).play({ key: 'chicken', startFrame: Math.floor(Math.random() * 2) });
      this.critters.push({ x: c.x, y: surfaceY(m, c.x), home: c.x, tx: c.x, wait: Math.random() * 2, spr });
    }
  }

  addProp(pr) {
    let key;
    const v = (pr.seed ?? Math.floor(hash2(pr.x * 3, pr.y * 7, 2) * 6)) % 6;
    switch (pr.t) {
      case 'tree': key = 'tree_' + (v % 6); break;
      case 'jtree': key = 'jtree_' + v; break;
      case 'fern': key = 'fern_' + v; break;
      case 'bush': key = 'bush_' + (pr.flowers ? 1 + (v % 3) : 0); break;
      case 'pillar': key = (pr.broken ? 'pillarb_' : 'pillar_') + (v % 3); break;
      case 'statue': key = 'statue_' + (v % 3); break;
      case 'rubble': key = 'rubble_' + (v % 3); break;
      case 'stall': key = 'stall_side'; break;
      case 'crate': key = 'crate_side'; break;
      case 'fence': key = 'fence_side'; break;
      case 'fountain': key = 'fountain_0'; break;
      case 'portal': key = 'portal_0'; break;
      case 'door': key = 'door_side'; break;
      default: key = pr.t;
    }
    if (!this.textures.exists(key)) return null;
    const a = anchorOf(key);
    const img = this.add.image(pr.x * TS, pr.y * TS + (pr.bg ? 2 : 1), key).setOrigin(a.x, a.y);
    img.setDepth(pr.bg ? -25 : depthOf(pr.x, pr.y, -10));
    if (pr.bg) img.setTint(this.theme === 'village' ? 0xd8d0e0 : 0xb0b8b4);
    if (pr.t === 'tree' || pr.t === 'jtree') this.tweens.add({ targets: img, scaleX: 1.02, duration: 1800 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (pr.t === 'portal') { let f = 0; this.time.addEvent({ delay: 120, loop: true, callback: () => { f = (f + 1) % 4; img.setTexture('portal_' + f); } }); }
    if (pr.t === 'fountain') { let f = 0; this.time.addEvent({ delay: 160, loop: true, callback: () => { f = (f + 1) % 4; img.setTexture('fountain_' + f); } }); }
    const flame = (dx, dy, s = 1) => this.add.sprite(pr.x * TS + dx, pr.y * TS + dy, 'flame').setOrigin(0.5, 1).play({ key: 'flame', startFrame: Math.floor(Math.random() * 4) }).setDepth(85200).setScale(s).setBlendMode(Phaser.BlendModes.ADD);
    if (pr.t === 'brazier') flame(0, -20);
    if (pr.t === 'candelabra') { flame(-5, -29, 0.45); flame(0, -29, 0.45); flame(4, -29, 0.45); }
    if (pr.t === 'lamp') { const g = this.add.image(pr.x * TS, pr.y * TS - 33, 'light').setScale(0.12).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setDepth(85200); void g; }
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
      const g = this.add.image(L.x * TS, L.y * TS, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(L.color).setDepth(85300);
      g.setScale((L.r * 0.7) / 64, (L.r * 0.7) / 64).setAlpha(L.i * 0.4);
      this.glows.push({ L, g, base: L.i * 0.4, ph: Math.random() * 10 });
    }
    if (amb.dark > 0) {
      this.lightRT = this.add.renderTexture(0, 0, 64, 64).setOrigin(0, 0).setDepth(85000);
      this.lightRT.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(86000).setAlpha(amb.vignette ?? 0.45);
  }

  updateLighting(dt) {
    const view = this.cameras.main.worldView;
    for (const gl of this.glows) {
      const f = gl.L.flicker || 0;
      gl.ph += dt * (6 + f * 20);
      gl.g.setAlpha(gl.base * (1 - f + Math.sin(gl.ph) * f * 0.5 + Math.sin(gl.ph * 2.7) * f * 0.5));
    }
    if (this.lightRT) {
      const rt = this.lightRT;
      const W = Math.ceil(view.width) + 2, H = Math.ceil(view.height) + 2;
      if (rt.width !== W || rt.height !== H) rt.resize(W, H);
      rt.setPosition(view.x - 1, view.y - 1);
      rt.clear();
      rt.fill(this.map.ambient.ambientColor ?? 0x404060, 1);
      const st = this.lightStamp;
      const drawLight = (wx, wy, rad, alpha) => {
        const sx = wx - view.x + 1, sy = wy - view.y + 1;
        if (sx < -rad || sy < -rad || sx > W + rad || sy > H + rad) return;
        st.setScale((rad * 2) / 128).setAlpha(alpha);
        rt.erase(st, sx, sy);
      };
      for (const gl of this.glows) drawLight(gl.L.x * TS, gl.L.y * TS, gl.L.r * 1.3, Math.min(1, gl.g.alpha / gl.base) * (gl.L.soft ? 0.6 : 0.95));
      drawLight(this.me.x * TS, (this.me.y - 1.2) * TS, 110, 0.9);
      for (const r of this.remotes.values()) drawLight(r.x * TS, (r.y - 1.2) * TS, 80, 0.6);
      for (const pr of this.projectiles) if (pr.light) drawLight(pr.x * TS, (pr.y - CHEST) * TS, 40, 0.7);
    }
    this.vignette.setPosition(view.x, view.y).setDisplaySize(view.width, view.height);
  }

  setupParticles() {
    const kind = this.map.ambient.particles;
    const n = G.settings.lowFx ? 14 : 30;
    const tex = { petals: 'dot_petal', fireflies: 'dot_firefly', dust: 'dot_dust' }[kind];
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
      p.img.setAlpha(p.kind === 'fireflies' ? 0.35 + Math.sin(p.ph * 3) * 0.35 : p.kind === 'dust' ? 0.25 + Math.sin(p.ph) * 0.15 : 0.85);
    }
  }

  updatePools() {
    const g = this.poolGfx;
    g.clear();
    for (const pl of this.map.pools) {
      const x = pl.x0 * TS, w = (pl.x1 - pl.x0) * TS, y = pl.y * TS + 4;
      g.fillStyle(0x3d7a1e, 0.85).fillRect(x, y, w, TS * 2);
      g.fillStyle(0xa1d22f, 0.9);
      for (let i = 0; i < w; i += 4) g.fillRect(x + i, y + Math.round(Math.sin(this.t * 3 + i * 0.3) * 1.2), 3, 2);
    }
  }

  /* ======================== HERO ======================== */

  makeHero(save, x, y) {
    const key = ensureHeroSide(this, save.cls);
    const cls = CLASSES[save.cls];
    const stats = derive(save.cls, save.level, gearTotals(save), { meal: this.zoneKey === 'dungeon' ? save.meal : null, banquet: this.run?.banquet });
    const hero = {
      id: net.id || 0, local: true, name: save.name, cls: save.cls, key,
      x, y, vx: 0, vy: 0, bw: 0.6, bh: 2.2, onGround: false, coyote: 0, jumpBuf: 0,
      face: { x: 1, y: 0 }, state: 'idle', anim: '',
      stats, hp: stats.maxHp, mp: cls.resource === 'scrap' ? 40 : stats.maxMp,
      maxMp: stats.maxMp, resource: cls.resource,
      cds: [0, 0], atkCd: 0, dodgeCd: 0, potCd: 0, iframes: 0,
      status: {}, down: false, bleed: 0, downs: 0, dead: false,
    };
    hero.landFx = () => { if (this.combat) this.combat.puff(hero.x, hero.y, 'puff_dust', 0.45); };
    hero.shadow = this.add.image(x * TS, y * TS, 'shadow').setScale(1, 0.8);
    hero.spr = this.add.sprite(x * TS, y * TS, key).setOrigin(0.5, 46 / 48);
    hero.spr.play(`${key}_idle`);
    hero.tag = this.makeLabel(save.name, '#ffffff', 7).setAlpha(0.9);
    return hero;
  }

  // side view: one anim set, flipped by facing
  heroAnim(e, state) {
    const map = { walk: 'run', run: 'run', idle: 'idle', atk: 'atk', jump: 'jump', fall: 'fall', hurt: 'hurt', cast: 'cast' };
    const k = `${e.key}_${map[state] || 'idle'}`;
    if (e.anim !== k) { e.anim = k; e.spr.play(k, true); }
    e.spr.setFlipX((e.face.x || 1) < 0);
  }

  applyZoom() {
    const cam = this.cameras.main;
    cam.setZoom(Math.max(1, Math.round(this.scale.height / ZOOM_TARGET_H)));
    cam.setRoundPixels(true);
  }

  onKey(ev) {
    if (G.ui.typing()) return;
    const k = ev.key.toLowerCase();
    if (k === ' ' || k === 'w' || k === 'arrowup') this.combat.jump(this.keys.S.isDown || this.keys.DOWN.isDown);
    else if (k === 'j') this.combat.attack();
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

    let mx = G.input.mx, my = G.input.my;
    if (!G.ui.typing()) {
      const K = this.keys;
      if (K.A.isDown || K.LEFT.isDown) mx -= 1;
      if (K.D.isDown || K.RIGHT.isDown) mx += 1;
      if (K.S.isDown || K.DOWN.isDown) my += 1;
      this.combat.holdJump = K.SPACE.isDown || K.W.isDown || K.UP.isDown || G.input.jumpHeld;
    } else this.combat.holdJump = G.input.jumpHeld;
    mx = Math.max(-1, Math.min(1, mx));
    this.combat.updateHero(me, dt, mx, my);

    // camera: lead in the facing direction, smooth follow
    const tx = me.x * TS + (me.face.x || 1) * 28;
    const ty = (me.y - 2.2) * TS;
    this.camPos.x += (tx - this.camPos.x) * Math.min(1, dt * 5);
    this.camPos.y += (ty - this.camPos.y) * Math.min(1, dt * 6);
    const cam = this.cameras.main;
    cam.centerOn(Math.round(this.camPos.x + (this.shakeX || 0)), Math.round(this.camPos.y + (this.shakeY || 0)));
    if (this.shakeT > 0) { this.shakeT -= dt; const s = this.shakeAmt; this.shakeX = (Math.random() - 0.5) * s; this.shakeY = (Math.random() - 0.5) * s; }
    else { this.shakeX = 0; this.shakeY = 0; }

    this.updateParallax();
    this.updatePools();
    this.updateCritters(dt);
    this.updateNpcs(dt);
    this.combat.update(dt);
    this.updateRemotes(dt);
    this.updateLighting(dt);
    this.updateParticles(dt);

    this.stTimer -= dt;
    if (this.stTimer <= 0 && net.connected) {
      this.stTimer = 0.1;
      const s = [+me.x.toFixed(2), +me.y.toFixed(2), me.face.x < 0 ? -1 : 1, 0, me.state, Math.round(me.hp), me.stats.maxHp, me.down ? 1 : 0, me.dead ? 1 : 0];
      const sig = s.join(',');
      if (sig !== this.lastSig || this.t - (this.lastStT || 0) > 1) { this.lastSig = sig; this.lastStT = this.t; net.send({ t: 'st', s }); }
    }
    G.ui.updateHud(me, this);
  }

  shake(amount = 3, dur = 0.15) { if (!G.settings.shake) return; this.shakeAmt = amount; this.shakeT = dur; }

  updateCritters(dt) {
    for (const c of this.critters) {
      c.wait -= dt;
      const d = c.tx - c.x;
      if (c.wait <= 0 && Math.abs(d) > 0.05) { c.x += Math.sign(d) * Math.min(Math.abs(d), 1.4 * dt); c.spr.setFlipX(d > 0); }
      else if (c.wait <= 0) { c.wait = 1.5 + Math.random() * 3; c.tx = c.home + (Math.random() - 0.5) * 4; }
      c.y = surfaceY(this.map, c.x, Math.floor(c.y) - 1);
      c.spr.setPosition(c.x * TS, c.y * TS + 1).setDepth(depthOf(c.x, c.y, -2));
    }
  }

  updateNpcs() {
    const me = this.me;
    let best = null, bd = 99;
    const near = (x, y, r) => { const dx = Math.abs(x - me.x), dy = Math.abs(y - me.y); return dx < r && dy < 2.5 ? dx : 99; };
    for (const n of this.npcs) {
      const d = near(n.x, n.y, 2.2);
      n.label.setAlpha(d < 99 ? 1 : 0);
      if (d < bd && n.role !== 'guard') { bd = d; best = { kind: 'npc', npc: n, label: 'Talk to ' + n.name.split(' ')[0] }; }
      if (!n.pack && d < 5) n.spr.setFlipX(me.x < n.x);
    }
    for (const it of this.map.interacts) { const d = near(it.x, it.y, it.r + 0.6); if (d < bd) { bd = d; best = { kind: it.kind, label: it.label, it }; } }
    for (const ex of this.map.exits) { const d = near(ex.x, ex.y, ex.r + 0.4); if (d < bd) { bd = d; best = { kind: 'exit', label: ex.label, ex }; } }
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
    else if (n.kind === 'exit') { if (this.exitLock > 0) return; this.exitLock = 99; sfx.door(); this.travel(n.ex.to, { from: this.zoneKey }); }
    else if (n.kind === 'leave' && this.combat.victory) this.combat.endRun('victory');
    else if (n.kind === 'leave') G.ui.confirm('Leave the dungeon?', 'You keep what you have picked up, but the run ends.', () => this.combat.endRun('leave'));
  }

  travel(zone, data = {}) {
    if (location.search.includes('auto=')) { this.scene.start('world', { zone, ...data }); return; }
    this.cameras.main.fadeOut(300, 10, 6, 24);
    this.time.delayedCall(310, () => this.scene.start('world', { zone, ...data }));
  }

  /* ======================== NETWORK ======================== */

  bindNet() {
    const on = (t, fn) => { net.handlers[t] = [fn]; };
    on('roster', (m) => { for (const r of this.remotes.values()) this.removeRemote(r.id); for (const p of m.players) this.addRemote(p); G.ui.setOnlineCount(m.players.length + 1); });
    on('pj', (m) => { this.addRemote(m.p); G.ui.setOnlineCount(this.remotes.size + 1); });
    on('pl', (m) => { this.removeRemote(m.id); G.ui.setOnlineCount(this.remotes.size + 1); });
    on('st', (m) => { const r = this.remotes.get(m.id); if (r && m.s) this.applyRemoteState(r, m.s); });
    on('chat', (m) => { G.ui.chatLine(m.name, m.m, m.id === net.id); const who = m.id === net.id ? this.me : this.remotes.get(m.id); if (who) this.bubble(who, m.m); });
    on('ev', (m) => this.combat.onEvent(m.from, m.e));
  }

  addRemote(p) {
    if (p.id === net.id || this.remotes.has(p.id)) return;
    const key = ensureHeroSide(this, p.cls || 'warrior');
    const s = p.s || [this.map.spawn.x, this.map.spawn.y, 1, 0, 'idle', 1, 1, 0, 0];
    const r = { id: p.id, name: p.name, cls: p.cls, key, x: s[0], y: s[1], tx: s[0], ty: s[1], face: { x: s[2], y: 0 }, state: s[4], hp: s[5], maxHp: s[6], down: !!s[7], dead: !!s[8], anim: '' };
    r.shadow = this.add.image(r.x * TS, r.y * TS, 'shadow').setScale(1, 0.8);
    r.spr = this.add.sprite(r.x * TS, r.y * TS, key).setOrigin(0.5, 46 / 48);
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
    r.tx = s[0]; r.ty = s[1]; r.face = { x: s[2], y: 0 };
    if (s[4] === 'atk' && r.state !== 'atk') r.anim = '';
    r.state = s[4]; r.hp = s[5]; r.maxHp = s[6]; r.down = !!s[7]; r.dead = !!s[8];
  }

  updateRemotes(dt) {
    for (const r of this.remotes.values()) {
      const d = Math.hypot(r.tx - r.x, r.ty - r.y);
      if (d > 5) { r.x = r.tx; r.y = r.ty; } else { r.x += (r.tx - r.x) * Math.min(1, dt * 12); r.y += (r.ty - r.y) * Math.min(1, dt * 12); }
      if (r.down) { r.spr.anims.stop(); r.spr.setFrame(11); r.anim = 'down'; }
      else this.heroAnim(r, r.state);
      r.spr.setVisible(!r.dead).setPosition(r.x * TS, r.y * TS + 1).setDepth(depthOf(r.x, r.y));
      const gy = this.groundBelow(r.x, r.y);
      r.shadow.setPosition(r.x * TS, gy * TS).setDepth(depthOf(r.x, r.y, -2)).setAlpha(Math.max(0.2, 1 - (gy - r.y) * 0.25));
      r.tag.setPosition(r.x * TS, (r.y - 2.6) * TS).setDepth(90000);
      r.hpBar.clear();
      if (this.zoneKey === 'dungeon') {
        const f = Math.max(0, r.hp / (r.maxHp || 1));
        const px = r.x * TS, py = (r.y - 2.55) * TS;
        r.hpBar.fillStyle(0x1b1230, 1).fillRect(px - 9, py, 18, 3);
        r.hpBar.fillStyle(r.down ? 0xffb13b : 0x7ee07a, 1).fillRect(px - 8, py + 1, 16 * f, 1);
      }
      if (r.bubble) r.bubble.setPosition(r.x * TS, (r.y - 2.9) * TS);
    }
  }

  bubble(who, text) {
    if (who.bubble) who.bubble.destroy();
    const b = this.add.text(who.x * TS, (who.y - 2.9) * TS, text.length > 40 ? text.slice(0, 40) + '…' : text, {
      fontFamily: '"Pixelify Sans", monospace', fontSize: '7px', color: '#1b1230', backgroundColor: '#fff6e8', padding: { x: 3, y: 2 }, resolution: 4, wordWrap: { width: 110 },
    }).setOrigin(0.5, 1).setDepth(95000);
    who.bubble = b;
    this.time.delayedCall(4200, () => { if (who.bubble === b) { b.destroy(); who.bubble = null; } });
  }
}

export { DUNGEONS, DIFFICULTY, bracket, addSheet };
