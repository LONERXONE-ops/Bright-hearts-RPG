/* global Phaser */
// Combat, enemies, boss, loot and co-op sync.
// Co-op model: the party host simulates enemy AI and sends snapshots; every client
// resolves damage against its own hero, and each player rolls their own private loot.
import { G } from './state.js';
import { net } from '../net.js';
import { iso, depthOf, CHEST, PHYS } from './space.js';
import { CLASSES, derive } from '../data/classes.js';
import { ENEMIES, BOSSES } from './enemydefs.js';
import { DIFFICULTY, bracket, DUNGEONS } from '../world/dungeon.js';
import { rollGear, rollTreasure, RARITY_NAME } from '../data/items.js';
import { sfx, playMusic } from '../audio.js';
import { addXp, addGold, addItem, stat, gearTotals, bestVial, useItem, countItem, wear, save, hasPerk } from './progress.js';
import { anchorOf } from './assets.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const CH = CHEST * 16; // chest height in pixels
// side-view hit test: point (px, py=feet line) against target t; targets are ~2 tiles tall
function hits(t, px, py, rx, ry = 1.4) {
  const top = t.head ? t.y - 1.4 : t.y - (t.h || 1.6);
  return Math.abs(t.x - px) < rx + t.r && py > top - ry * 0.5 && py < t.y + ry;
}

export class Combat {
  constructor(scene) {
    this.s = scene;
    this.runTime = 0;
    this.kills = 0;
    this.lootLog = [];
    this.snapT = 0;
    this.hostCheckT = 0;
    this.telegraphs = [];
    this.dynHazards = [];
    this.revive = null;
    this.ended = false;
    this.projectiles = [];
    this.devices = [];
    this.pickups = [];
  }

  get me() { return this.s.me; }

  /* ======================== HERO ======================== */

  refreshStats(full) {
    const me = this.me;
    const old = me.stats;
    me.stats = derive(G.save.cls, G.save.level, gearTotals(G.save), { meal: this.s.zoneKey === 'dungeon' ? G.save.meal : null, banquet: this.s.run?.banquet });
    if (full) { me.hp = me.stats.maxHp; if (me.resource === 'mana') me.mp = me.stats.maxMp; }
    else me.hp = Math.min(me.stats.maxHp, me.hp * (me.stats.maxHp / (old.maxHp || 1)));
    me.maxMp = me.stats.maxMp;
  }

  updateHero(me, dt, mx, my) {
    const S = this.s;
    me.atkCd = Math.max(0, me.atkCd - dt);
    me.dodgeCd = Math.max(0, me.dodgeCd - dt);
    me.potCd = Math.max(0, me.potCd - dt);
    me.iframes = Math.max(0, me.iframes - dt);
    me.lock = Math.max(0, (me.lock || 0) - dt);
    me.atkAnimT = Math.max(0, (me.atkAnimT || 0) - dt);
    const cdRate = me.status.haste > 0 ? 1.6 : 1;
    me.cds = me.cds.map((c) => Math.max(0, c - dt * cdRate * (G.save.meal === 'broth' && S.zoneKey === 'dungeon' ? 1.15 : 1)));
    for (const k of Object.keys(me.status)) { me.status[k] -= dt; if (me.status[k] <= 0) delete me.status[k]; }

    if (me.dead) { me.spr.setVisible(false); me.shadow.setVisible(false); me.tag.setVisible(false); return; }

    if (!me.down) {
      me.hp = Math.min(me.stats.maxHp, me.hp + me.stats.hpRegen * dt);
      if (me.resource === 'mana') me.mp = Math.min(me.stats.maxMp, me.mp + me.stats.mpRegen * dt);
      if (me.status.poison) this.hurtMe(me.stats.maxHp * 0.025 * dt * (1 - me.stats.poisonRes), 'poison', true);
      for (const h of S.hazards || []) if (Math.abs(h.x - me.x) < h.r && Math.abs(h.y - me.y) < 0.9) me.status.poison = 2;
      for (const h of this.dynHazards) if (Math.abs(h.x - me.x) < h.r && Math.abs(h.y - me.y) < 0.9) me.status.poison = 2;
    }

    // downed / bleed-out
    if (me.down) {
      me.bleed -= dt;
      G.ui.setDowned(true, me.bleed);
      if (me.bleed <= 0) {
        me.dead = true;
        G.ui.setDowned(false);
        G.ui.toast('You are spectating until your party clears the room.', 'warn');
        this.checkWipe();
      }
    }

    // ---- side-view platformer movement
    let moving = false;
    me.jumpBuf = Math.max(0, (me.jumpBuf || 0) - dt);
    me.dropT = Math.max(0, (me.dropT || 0) - dt);
    me.dropThrough = me.dropT > 0;
    if (me.down) {
      me.vx = 0;
    } else if (me.dodge) {
      const d = me.dodge;
      S.moveEntity(me, d.x * d.speed * dt);
      me.vy = 0;
      d.t -= dt;
      if (d.dmg) this.sweepHit(me, d);
      if (d.t <= 0) me.dodge = null;
      moving = true;
    } else {
      let sp = me.stats.speed * 1.45 * (me.status.haste ? 1.25 : 1) * (me.status.slow ? 0.6 : 1);
      if (me.status.taunt && me.cls === 'savage') sp *= 0.9;
      const want = me.lock > 0 || me.status.root ? 0 : mx;
      // snappy acceleration with a little slide
      const target = want * sp;
      const acc = me.onGround ? 40 : 22;
      if (Math.abs(target - (me.vx || 0)) < acc * dt) me.vx = target; else me.vx += Math.sign(target - (me.vx || 0)) * acc * dt;
      if (me.vx) moving = S.moveEntity(me, me.vx * dt) && Math.abs(me.vx) > 0.5;
      if (me.blocked) { me.vx = 0; me.blocked = false; }
      if (Math.abs(mx) > 0.15 && me.lock <= 0) me.face = { x: Math.sign(mx), y: 0 };
      // buffered jump + coyote time
      if (me.jumpBuf > 0 && (me.onGround || me.coyote > 0) && !me.status.root) {
        if ((my > 0.5 || this.jumpDown) && S.tileAt(me.x, me.y + 0.1) === '=') { me.dropT = 0.25; me.dropThrough = true; me.y += 0.05; }
        else { me.vy = -PHYS.jump; sfx.dash(); this.puff(me.x, me.y, 'puff_dust', 0.4); }
        me.jumpBuf = 0; me.coyote = 0; me.onGround = false;
      }
      // short hop when the jump button is released early
      if (!this.holdJump && me.vy < -7) me.vy = -7;
    }
    if (!me.dodge) S.phys(me, dt);
    me.state = me.down ? 'down' : me.atkAnimT > 0 ? 'atk' : me.dodge ? 'dodge' : !me.onGround ? (me.vy < 0 ? 'jump' : 'fall') : moving ? 'walk' : 'idle';
    if (me.down) {
      me.spr.anims.stop();
      me.spr.setFrame(11);
      me.anim = 'down';
    } else S.heroAnim(me, me.state === 'dodge' ? 'run' : me.state);

    const p = iso(me.x, me.y);
    me.spr.setPosition(p.x, p.y + 1).setDepth(depthOf(me.x, me.y, 1));
    me.spr.setAlpha(me.iframes > 0 && Math.floor(S.t * 20) % 2 ? 0.55 : 1);
    if (me.flashT > 0) { me.flashT -= dt; me.spr.setTintFill(0xff5050); if (me.flashT <= 0) me.spr.clearTint(); }
    const gy = S.groundBelow(me.x, me.y);
    me.shadow.setPosition(p.x, gy * 16).setDepth(depthOf(me.x, me.y, -2)).setAlpha(Math.max(0.2, 1 - (gy - me.y) * 0.25));
    me.tag.setPosition(p.x, p.y - 44).setDepth(90000);
    if (me.bubble) me.bubble.setPosition(p.x, p.y - 48);

    this.updateRevive(dt);
  }

  faceTo(e, x) {
    if (Math.abs(x - e.x) > 0.05) e.face = { x: Math.sign(x - e.x), y: 0 };
  }
  faceDir(e) { return { x: (e.face.x || 1) < 0 ? -1 : 1, y: 0 }; }

  jump(down) {
    const me = this.me;
    if (me.down || me.dead) return;
    me.jumpBuf = PHYS.buffer;
    this.jumpDown = !!down;
  }

  targets() {
    const list = [];
    for (const e of this.s.enemies.values()) if (e.alive) list.push({ x: e.x, y: e.y, r: e.def.radius, h: e.bh || 1.1, e });
    if (this.boss && this.boss.alive) for (const h of this.boss.heads) if (h.alive) list.push({ x: h.x, y: h.y, r: 1, h: 1.8, e: this.boss, head: h });
    return list;
  }
  autoTarget(range) {
    const me = this.me;
    let best = null, bd = range;
    for (const t of this.targets()) {
      const behind = Math.sign(t.x - me.x) !== Math.sign(me.face.x || 1) ? 1.5 : 0;
      const d = Math.hypot(t.x - me.x, (t.y - me.y) * 1.3) - t.r + behind;
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) {
      for (const b of this.s.breakables?.values() || []) {
        const d = Math.hypot(b.x - me.x, b.y - me.y);
        if (d < Math.min(range, 2.2) && d < bd) { bd = d; best = { x: b.x, y: b.y, r: 0.3, brk: b }; }
      }
    }
    return best;
  }

  attack() {
    const me = this.me;
    if (me.down || me.dead || me.atkCd > 0 || me.dodge) return;
    if (this.s.zoneKey !== 'dungeon') { this.s.interact(); return; }
    const cls = CLASSES[me.cls];
    me.atkCd = cls.atkSpeed * (me.status.haste ? 0.8 : 1);
    const tgt = this.autoTarget(cls.range + 2.5);
    if (tgt) this.faceTo(me, tgt.x, tgt.y);
    me.lock = cls.melee ? 0.16 : 0.12;
    me.atkAnimT = 0.24;
    me.anim = '';
    const dir = this.faceDir(me);
    const crit = Math.random() < me.stats.crit;
    const base = (cls.melee ? me.stats.atk : me.cls === 'mage' ? me.stats.spell : me.stats.atk) * rand(0.9, 1.1);
    const dmg = base * (crit ? me.stats.critDmg : 1);
    if (cls.melee) {
      sfx.swing();
      this.slashFx(me.x + dir.x * 0.9, me.y, me.face.x < 0, 1.25);
      this.meleeHit(me, cls.range, 1.3, dmg, { crit, poise: me.cls === 'savage' ? 30 : 12, kb: me.cls === 'savage' ? 0.6 : 0.3 });
      this.netFx({ k: 'slash', x: me.x + dir.x * 0.9, y: me.y, f: me.face.x < 0 ? 1 : 0 });
    } else {
      const kind = { mage: 'magic', gunman: 'bullet', engineer: 'wrench', savage: 'arrow' }[me.cls];
      if (kind === 'bullet') sfx.shoot(); else if (kind === 'arrow') sfx.swing(); else sfx.magic();
      const flat = kind === 'bullet' || kind === 'arrow';
      let ax = dir.x, ay = 0;
      if (tgt) { const tx = tgt.x - me.x, ty = tgt.y - me.y, l = Math.hypot(tx, ty) || 1; ax = tx / l; ay = ty / l; }
      const proj = { x: me.x + dir.x * 0.4, y: me.y, dx: ax, dy: ay, speed: flat ? 14 : 9, range: cls.range + 1, dmg, crit, owner: 'me', tex: flat ? kind : 'orb_' + kind, light: kind === 'magic' };
      this.spawnProj(proj);
      this.netFx({ k: 'proj', x: proj.x, y: proj.y, dx: ax, dy: ay, sp: proj.speed, r: proj.range, tex: proj.tex });
    }
  }

  meleeHit(me, range, arc, dmg, o) {
    const dir = this.faceDir(me);
    let hitAny = false;
    for (const t of this.targets()) {
      const dx = (t.x - me.x) * dir.x;
      if (dx < -0.5 || dx > range + t.r + 0.3) continue;
      if (!hits(t, me.x, me.y - 0.6, range + 1, 1.6)) continue;
      this.damageTarget(t, dmg, { ...o, from: me });
      hitAny = true;
    }
    for (const b of [...(this.s.breakables?.values() || [])]) {
      const dx = (b.x - me.x) * dir.x;
      if (dx > -0.4 && dx < range + 0.7 && Math.abs(b.y - me.y) < 1.6) { this.hitBreakable(b); hitAny = true; }
    }
    if (hitAny) { this.s.shake(2, 0.08); this.hitstop(0.05); }
  }

  // tiny freeze-frame on impact (Darkrise-style juice)
  hitstop(t) {
    const S = this.s;
    if (S.run?.online || this._hs) return;
    this._hs = true;
    S.time.timeScale = 0.05; S.tweens.timeScale = 0.05;
    setTimeout(() => { S.time.timeScale = 1; S.tweens.timeScale = 1; this._hs = false; }, t * 1000);
  }

  sweepHit(me, d) {
    d.hit = d.hit || new Set();
    for (const t of this.targets()) {
      const key = t.head ? 'h' + t.head.i : t.e.id;
      if (d.hit.has(key)) continue;
      if (hits(t, me.x, me.y, 0.9)) { d.hit.add(key); this.damageTarget(t, d.dmg, { from: me, kb: 0.3 }); }
    }
  }

  skill(i) {
    const me = this.me;
    if (me.down || me.dead) return;
    const sk = CLASSES[me.cls].skills[i];
    if (!sk) return;
    if (this.s.zoneKey !== 'dungeon') { G.ui.toast(sk.name + ' can only be used in dungeons.', 'info'); return; }
    if (me.cds[i] > 0) return;
    if (me.mp < sk.cost) { G.ui.toast(me.resource === 'scrap' ? 'Not enough Scrap! Smash crates and jars.' : 'Not enough Mana', 'warn'); sfx.uiBack(); return; }
    const tgt = this.autoTarget(8);
    if (tgt && !['blink', 'taunt', 'heal', 'slam'].includes(sk.id)) this.faceTo(me, tgt.x, tgt.y);
    const dir = this.faceDir(me);
    me.mp -= sk.cost;
    me.cds[i] = sk.cd;
    me.atkAnimT = 0.3; me.anim = '';
    const crit = Math.random() < me.stats.crit;
    const cm = crit ? me.stats.critDmg : 1;
    const S = this.s;
    switch (sk.id) {
      case 'beam': {
        sfx.magic();
        this.spawnProj({ x: me.x, y: me.y, dx: dir.x, dy: 0, speed: 12, range: 7.5, dmg: me.stats.atk * 1.7 * cm, crit, owner: 'me', tex: 'orb_beam', pierce: true, light: true, scale: 1.3 });
        this.netFx({ k: 'proj', x: me.x, y: me.y, dx: dir.x, dy: 0, sp: 12, r: 7.5, tex: 'orb_beam' });
        break;
      }
      case 'blink': {
        sfx.dash();
        me.dodge = { x: dir.x, y: 0, speed: 15, t: 0.28, dmg: me.stats.atk * 1.3 * cm };
        me.iframes = 0.35;
        this.puff(me.x, me.y, 'puff_magic');
        break;
      }
      case 'firestorm': {
        sfx.magic();
        const tx = tgt ? tgt.x : me.x + dir.x * 3, ty = tgt ? tgt.y : me.y;
        this.storm(tx, ty, me.stats.spell * 0.75, true);
        this.netFx({ k: 'storm', x: tx, y: ty });
        break;
      }
      case 'heal': {
        sfx.heal();
        const amt = 0.3 * (hasPerk(G.save, 'mend') ? 1.15 : 1);
        this.healMe(amt);
        this.ring(me.x, me.y, 'ring_heal');
        net.ev({ k: 'heal', x: me.x, y: me.y, r: 4.5, a: amt });
        break;
      }
      case 'volley': {
        sfx.swing();
        const tx = tgt ? tgt.x : me.x + dir.x * 3, ty = tgt ? tgt.y : me.y;
        this.storm(tx, ty, me.stats.atk * 0.8 * cm, true, 'arrow');
        this.netFx({ k: 'storm', x: tx, y: ty, a: 'arrow' });
        break;
      }
      case 'taunt': {
        sfx.roar();
        me.status.taunt = 5;
        this.ring(me.x, me.y, 'ring_taunt');
        this.floatText(me.x, me.y, 'TAUNT!', '#ff9a7a', 9);
        this.applyTaunt(net.id || 0, 5);
        net.ev({ k: 'taunt', d: 5 });
        break;
      }
      case 'slam': {
        sfx.boom();
        S.shake(4, 0.25);
        this.ring(me.x, me.y, 'ring_slam');
        this.puff(me.x, me.y, 'puff_dust', 1.4);
        for (const t of this.targets()) if (hits(t, me.x, me.y, 2.6, 1.2)) this.damageTarget(t, me.stats.atk * 1.5 * cm, { crit, stun: 1.5, poise: 60, from: me, kb: 0.5 });
        for (const b of [...(S.breakables?.values() || [])]) if (Math.hypot(b.x - me.x, b.y - me.y) < 2.4) this.hitBreakable(b);
        this.netFx({ k: 'ring', x: me.x, y: me.y, a: 'ring_slam' });
        break;
      }
      case 'snipe': {
        sfx.crit();
        const sl = tgt ? Math.hypot(tgt.x - me.x, tgt.y - me.y) || 1 : 1;
        this.spawnProj({ x: me.x, y: me.y, dx: tgt ? (tgt.x - me.x) / sl : dir.x, dy: tgt ? (tgt.y - me.y) / sl : 0, speed: 24, range: 10, dmg: me.stats.atk * 2.3 * cm, crit, owner: 'me', tex: 'bullet', pierce: true, bossMult: 3, scale: 1.5, light: true });
        this.netFx({ k: 'proj', x: me.x, y: me.y, dx: dir.x, dy: 0, sp: 24, r: 10, tex: 'bullet' });
        break;
      }
      case 'grenade': {
        const tx = tgt ? tgt.x : me.x + dir.x * 3.5, ty = tgt ? tgt.y : this.s.groundBelow(me.x + dir.x * 3.5, me.y - 1);
        this.lob(me.x, me.y, tx, ty, 'pk_sphere', 0.55, () => this.explode(tx, ty, 1.9, me.stats.atk * 1.8 * cm, crit));
        this.netFx({ k: 'lob', x: me.x, y: me.y, tx, ty });
        break;
      }
      case 'sentry': {
        sfx.door();
        const x = me.x + dir.x * 0.9, y = me.y;
        this.addDevice('sentry', x, y, true);
        this.netFx({ k: 'dev', d: 'sentry', x, y });
        break;
      }
      case 'snare': {
        const x = me.x + dir.x * 1.2, y = me.y;
        this.addDevice('snare', x, y, true);
        this.netFx({ k: 'dev', d: 'snare', x, y });
        break;
      }
      default: break;
    }
  }

  dodge() {
    const me = this.me;
    if (me.down || me.dead || me.dodgeCd > 0 || me.status.root) return;
    let mx = G.input.mx;
    if (Math.abs(mx) < 0.2) mx = me.face.x || 1;
    const dir = Math.sign(mx);
    me.dodge = { x: dir, y: 0, speed: 13 * (hasPerk(G.save, 'fleet') ? 1.1 : 1), t: 0.24 };
    me.iframes = 0.36;
    me.dodgeCd = 1.1;
    me.face = { x: dir, y: 0 };
    sfx.dash();
    this.puff(me.x, me.y, 'puff_dust', 0.6);
  }

  potion() {
    const me = this.me;
    if (me.down || me.dead) return;
    if (me.potCd > 0) { G.ui.toast('Potion cooldown ' + Math.ceil(me.potCd) + 's', 'info'); return; }
    // poison first if a tonic is available
    if (me.status.poison && countItem('purge') > 0) {
      useItem('purge'); delete me.status.poison; delete me.status.root; me.potCd = 15;
      sfx.heal(); this.floatText(me.x, me.y, 'Cleansed', '#b2ecc0'); G.ui.refresh(); return;
    }
    const v = bestVial();
    if (!v) { G.ui.toast('No Crimson Vials. Buy some at the Village Store.', 'warn'); return; }
    useItem(v);
    const amt = { vial1: 0.3, vial2: 0.5, vial3: 0.75 }[v];
    this.healMe(amt);
    me.potCd = 15;
    sfx.heal();
    G.ui.refresh();
  }

  healMe(frac, silent) {
    const me = this.me;
    if (me.down || me.dead) return;
    const amt = me.stats.maxHp * frac;
    me.hp = Math.min(me.stats.maxHp, me.hp + amt);
    delete me.status.poison;
    if (!silent) this.floatText(me.x, me.y, '+' + Math.round(amt), '#7ee07a');
  }

  hurtMe(dmg, kind, quiet) {
    const me = this.me;
    if (me.down || me.dead || this.ended) return;
    if (!quiet && me.iframes > 0) { this.floatText(me.x, me.y, 'DODGE', '#cdeaff', 7); return; }
    let d = dmg;
    if (!quiet) d *= 1 - me.stats.mitigation;
    if (me.status.taunt) d *= 0.5;
    if (kind === 'poison' && !quiet) d *= 1 - me.stats.poisonRes;
    me.hp -= d;
    if (!quiet) {
      me.flashT = 0.12;
      sfx.hurt();
      this.s.shake(2.5, 0.12);
      this.floatText(me.x, me.y, '-' + Math.round(d), '#ff6a6a');
      G.ui.hurtFlash();
    }
    if (me.hp <= 0) this.goDown();
  }

  goDown() {
    const me = this.me;
    me.hp = 0;
    const solo = this.s.zoneKey === 'dungeon' && this.alivePartners() === 0;
    if (solo && countItem('phoenix') > 0) {
      useItem('phoenix');
      me.hp = me.stats.maxHp * 0.5; me.iframes = 2.5;
      sfx.level(); this.ring(me.x, me.y, 'ring_heal'); this.floatText(me.x, me.y, 'PHOENIX!', '#ffcf4a', 10);
      G.ui.toast('Your Phoenix Charm burns away... and you rise again!', 'gold');
      return;
    }
    me.down = true;
    me.bleed = Math.max(5, 30 - me.downs * 5);
    me.downs++;
    sfx.down();
    if (this.s.zoneKey !== 'dungeon') { me.down = false; me.hp = me.stats.maxHp; return; }
    if (solo) {
      this.s.time.delayedCall(2200, () => this.endRun('wipe'));
    } else this.checkWipe();
  }

  alivePartners() {
    let n = 0;
    for (const r of this.s.remotes.values()) if (!r.down && !r.dead) n++;
    return n;
  }

  checkWipe() {
    const me = this.me;
    const anyAlive = (!me.down && !me.dead) || this.alivePartners() > 0;
    if (!anyAlive && !this.ended) {
      net.ev({ k: 'wipe' });
      this.endRun('wipe');
    }
  }

  updateRevive(dt) {
    const me = this.me;
    if (me.down || me.dead || this.s.zoneKey !== 'dungeon') { G.ui.setRevive(null); return; }
    const reach = me.cls === 'mage' ? 5 : 1.4;
    let target = null;
    for (const r of this.s.remotes.values()) {
      if (r.down && !r.dead && Math.hypot(r.x - me.x, r.y - me.y) < reach) { target = r; break; }
    }
    if (!target) { this.revive = null; G.ui.setRevive(null); return; }
    if (!this.revive || this.revive.id !== target.id) this.revive = { id: target.id, t: 0 };
    const need = me.cls === 'mage' ? 2.5 : 4;
    this.revive.t += dt;
    G.ui.setRevive({ name: target.name, p: this.revive.t / need });
    if (this.revive.t >= need) {
      net.ev({ k: 'rev' }, target.id);
      this.floatText(target.x, target.y, 'REVIVED', '#7ee07a', 9);
      sfx.heal();
      this.revive = null;
    }
  }

  /* ======================== DAMAGE ======================== */

  damageTarget(t, dmg, o = {}) {
    if (t.brk) { this.hitBreakable(t.brk); return; }
    let d = dmg;
    if (hasPerk(G.save, 'bane') && (t.e.def?.snake || t.head)) d *= 1.2;
    if (hasPerk(G.save, 'exec') && t.e.hp < t.e.maxHp * 0.3) d *= 1.25;
    if (t.head) {
      if (o.bossMult) d *= o.bossMult;
      this.hitHead(t.e, t.head, d, o);
      return;
    }
    const e = t.e;
    // Bramble Tortoise blocks frontal damage
    if (e.def.frontal && o.from) {
      const fx = e.face.x, fy = e.face.y;
      const ax = o.from.x - e.x, ay = o.from.y - e.y;
      const cos = (fx * ax + fy * ay) / ((Math.hypot(fx, fy) || 1) * (Math.hypot(ax, ay) || 1));
      if (cos > 0.35 && !o.aoe) { d *= 1 - e.def.frontal; this.floatText(e.x, e.y, 'BLOCK', '#cdeaff', 7); }
    }
    // Warrior Sunder: hits from behind shred defense
    if (o.from && o.from.cls === 'warrior') {
      const ax = o.from.x - e.x, ay = o.from.y - e.y;
      const cos = (e.face.x * ax + e.face.y * ay) / ((Math.hypot(e.face.x, e.face.y) || 1) * (Math.hypot(ax, ay) || 1));
      if (cos < -0.3) { e.sunder = 5; }
    }
    if (e.sunder > 0) d *= 1.3;
    const lif = G.save && this.me.stats.lifesteal;
    if (lif) this.me.hp = Math.min(this.me.stats.maxHp, this.me.hp + d * lif);
    this.floatText(e.x, e.y, Math.round(d) + (o.crit ? '!' : ''), o.crit ? '#ffcf4a' : '#ffffff', o.crit ? 10 : 8);
    if (o.crit) sfx.crit(); else sfx.hit();
    e.flash = 0.1;
    if (o.kb && o.from) {
      const ax = e.x - o.from.x, ay = e.y - o.from.y, l = Math.hypot(ax, ay) || 1;
      e.kb = { x: Math.sign(ax || 1) * o.kb * 7, y: 0, t: 0.14 };
      if (e.onGround) e.vy = -4 * o.kb;
    }
    if (this.s.isHost) this.applyEnemyDamage(e, d, o, net.id || 0);
    else {
      e.hp -= d;
      net.ev({ k: 'hit', id: e.id, d: Math.round(d), st: o.stun || 0, rt: o.root || 0, p: o.poise || 0 });
    }
  }

  applyEnemyDamage(e, d, o, by) {
    if (!e.alive) return;
    e.hp -= d;
    e.flash = 0.1;
    if (o.stun) e.stun = Math.max(e.stun, o.stun);
    if (o.root) e.root = Math.max(e.root, o.root);
    if (o.poise) {
      e.poise -= o.poise;
      if (e.poise <= 0) { e.stun = Math.max(e.stun, 0.7); e.poise = e.def.poise * e.poiseMult; this.floatText(e.x, e.y, 'STAGGER', '#ffd27a', 7); }
    }
    if (!e.target || Math.random() < 0.3) e.aggroOn = by;
    if (e.hp <= 0) {
      this.killEnemy(e, by);
      net.ev({ k: 'kill', id: e.id, by });
    }
  }

  killEnemy(e, by) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    this.puff(e.x, e.y, e.def.snake ? 'puff_venom' : 'puff_dust');
    this.s.tweens.add({ targets: e.spr, alpha: 0, scaleY: 0.2, duration: 220, onComplete: () => { e.spr.destroy(); e.shadow.destroy(); e.bar.destroy(); } });
    this.kills++;
    this.grantKill(e, by);
    this.checkRooms();
  }

  grantKill(e, by) {
    const run = this.s.run;
    const dm = DIFFICULTY[run.diff];
    addXp(e.def.xp * (dm.hp > 1 ? 1.6 : 1));
    const g = Math.round(rand(e.def.gold[0], e.def.gold[1]) * (hasPerk(G.save, 'prospect') ? 1.15 : 1) * (run.diff === 'hell' ? 3 : run.diff === 'nightmare' ? 1.8 : 1));
    addGold(g);
    this.coins(e.x, e.y, Math.min(6, 1 + Math.floor(g / 4)));
    if (e.def.snake) stat('snakes');
    if (e.t === 'mandrake') stat('mandrakes');
    if (run.size > 1) stat('partyMobs');
    if (this.me.resource === 'scrap') this.me.mp = Math.min(100, this.me.mp + 4);
    if (Math.random() < 0.05) this.giveGear(e.x, e.y, false);
    if (Math.random() < 0.2) this.giveTreasure(e.x, e.y);
    void by;
  }

  giveGear(x, y, boss) {
    const item = rollGear(G.save.cls, Math.max(1, G.save.level), this.s.run.diff, boss);
    if (boss) {
      if (G.save.pity >= 5 && (item.rarity === 'common' || item.rarity === 'uncommon')) {
        const bump = (G.save.pity - 4) * 0.04;
        if (Math.random() < bump) { item.rarity = 'epic'; item.atk && (item.atk = Math.round(item.atk * 1.4)); item.def && (item.def = Math.round(item.def * 1.4)); }
      }
      if (item.rarity === 'epic' || item.rarity === 'gold') G.save.pity = 0; else G.save.pity++;
    }
    if (addItem(item)) {
      this.lootLog.push(item);
      this.lootPop(x, y, item);
      G.ui.toast(`${RARITY_NAME[item.rarity]}: ${item.name}`, item.rarity);
      if (item.rarity === 'epic' || item.rarity === 'gold') sfx.epic(); else sfx.loot();
    }
  }

  giveTreasure(x, y) {
    const t = rollTreasure(this.s.run.diff);
    if (addItem(t)) {
      this.lootLog.push(t);
      this.lootPop(x, y, t);
      stat('treasures');
      G.ui.toast(`Treasure: ${t.name} (${t.value}g)`, t.rarity);
      sfx.coin();
    }
  }

  hitBreakable(b, remote) {
    if (!this.s.breakables.has(b.id)) return;
    b.hp--;
    if (b.hp > 0 && !remote) { b.img.setTintFill(0xffffff); this.s.time.delayedCall(70, () => b.img.clearTint()); sfx.hit(); return; }
    this.s.breakables.delete(b.id);
    this.s.setSolid(Math.floor(b.x), Math.floor(b.y), 0);
    sfx.break();
    if (b.t === 'chest') { b.img.setTexture('chest_o'); const a = anchorOf('chest_o'); b.img.setOrigin(a.x, a.y); }
    else { this.puff(b.x, b.y, 'puff_dust', 0.8); b.img.destroy(); }
    if (remote) return;
    net.ev({ k: 'brk', id: b.id });
    stat('breakables');
    if (this.me.resource === 'scrap') { this.me.mp = Math.min(100, this.me.mp + 8); this.floatText(b.x, b.y, '+8 Scrap', '#b9d6c8', 7); }
    addGold(Math.round(rand(1, 4)));
    this.coins(b.x, b.y, 2);
    const chance = b.t === 'chest' ? 1 : 0.25;
    if (Math.random() < chance) this.giveTreasure(b.x, b.y);
    if (b.t === 'chest' && Math.random() < 0.35) this.giveGear(b.x, b.y, false);
  }

  /* ======================== DUNGEON SETUP ======================== */

  setupDungeon() {
    const S = this.s;
    const run = S.run;
    const br = bracket(run.size);
    const dm = DIFFICULTY[run.diff];
    this.br = br;
    for (const sp of S.map.enemies) this.spawnEnemy(sp, br, dm);
    if (S.map.boss) this.spawnBoss(S.map.boss, br, dm);
    // gates
    this.gates = [];
    for (const room of S.map.rooms) {
      if (!room.gate) continue;
      const gate = { room, imgs: [], open: false };
      for (const [x, y] of room.gate.tiles) S.blockers.add(x + ',' + y);
      {
        const gx = room.gate.x * 16, gy = 14 * 16;
        const seal = S.add.sprite(gx, gy, 'seal_0').setOrigin(0.5, 1).setDepth(depthOf(room.gate.x, 14, 2)).setScale(1, 0.75);
        let f = 0; S.time.addEvent({ delay: 260, loop: true, callback: () => { if (seal.active) seal.setTexture('seal_' + ((f = 1 - f))); } });
        const g = S.add.image(gx, gy - 24, 'light').setTint(0x6dffb0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35, 0.6).setAlpha(0.7).setDepth(85300);
        S.tweens.add({ targets: g, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
        gate.imgs.push(seal, g);
      }
      this.gates.push(gate);
      if (room.cleared) this.openGate(gate, true);
    }
    this.curRoom = -1;
    G.ui.runStart(run);
    this.refreshStats(true);
  }

  spawnEnemy(sp, br, dm) {
    const S = this.s;
    const def = ENEMIES[sp.t];
    const p = iso(sp.x, sp.y);
    const e = {
      id: sp.id, t: sp.t, def, x: sp.x, y: sp.y, tx: sp.x, ty: sp.y, room: sp.room,
      hp: def.hp * br.hp * dm.hp, maxHp: def.hp * br.hp * dm.hp, atk: def.atk * dm.atk,
      poise: def.poise * br.poise, poiseMult: br.poise,
      alive: true, state: 'idle', cd: rand(0.5, 1.5), wind: 0, stun: 0, root: 0, sunder: 0, flash: 0,
      face: { x: Math.random() < 0.5 ? -1 : 1, y: 0 }, anim: '', wander: rand(0, 3),
      vx: 0, vy: 0, bw: Math.max(0.6, def.radius * 2), bh: sp.t === 'tortoise' ? 1.3 : 1.1, onGround: false,
    };
    e.shadow = S.add.image(p.x, p.y, 'shadow').setScale(def.radius * 3, 1);
    e.spr = S.add.sprite(p.x, p.y, 'en_' + sp.t).setOrigin(0.5, 0.92);
    e.spr.play({ key: `en_${sp.t}_idle`, startFrame: Math.floor(Math.random() * 2) });
    e.bar = S.add.graphics();
    S.enemies.set(e.id, e);
  }

  spawnBoss(b, br, dm) {
    const S = this.s;
    const def = BOSSES[b.t];
    const boss = {
      id: b.id, def, x: b.x, y: b.y, alive: true, room: b.room, cd: 3, turn: 0, awake: false,
      heads: def.heads.map((h, i) => ({ i, ...h, hp: def.headHp * br.hp * dm.hp, maxHp: def.headHp * br.hp * dm.hp, alive: true, x: b.x + h.sx / 16, y: b.y - 3, lunge: 0, open: 0, flash: 0 })),
      atk: def.atk * dm.atk, solo: br.bossTurn < 1,
    };
    const p = iso(b.x, b.y);
    boss.shadow = S.add.image(p.x, p.y, 'shadow').setScale(6, 1.6).setAlpha(0.8);
    boss.body = S.add.image(p.x, p.y + 4, 'boss_body').setOrigin(0.5, 1).setDepth(depthOf(b.x, b.y, -1)).setScale(1.4);
    boss.necks = S.add.graphics().setDepth(depthOf(b.x, b.y, 2));
    for (const h of boss.heads) {
      h.spr = S.add.sprite(0, 0, 'boss_head' + h.i, 0).setOrigin(0.5, 0.6).setDepth(depthOf(b.x, b.y, 5)).setScale(1.35);
      if (h.sx < 0) h.spr.setFlipX(true);
    }
    this.boss = boss;
  }

  openGate(gate, silent) {
    if (gate.open) return;
    gate.open = true;
    for (const [x, y] of gate.room.gate.tiles) this.s.blockers.delete(x + ',' + y);
    for (const img of gate.imgs) this.s.tweens.add({ targets: img, alpha: 0, scaleY: 0, duration: 450, onComplete: () => img.destroy() });
    if (!silent) {
      sfx.door();
      G.ui.banner('Room cleared', 'The seal fades. Onward!');
    }
  }

  checkRooms() {
    for (const gate of this.gates || []) {
      if (gate.open) continue;
      const room = gate.room;
      const alive = room.enemies.some((id) => this.s.enemies.get(id)?.alive);
      if (!alive) { room.cleared = true; this.openGate(gate); }
    }
    // spectators come back when the room is cleared
    const me = this.me;
    if (me.dead && !this.ended) {
      const r = this.roomAt(me.x, me.y);
      if (!r || r.cleared) { me.dead = false; me.down = false; me.hp = me.stats.maxHp * 0.3; me.spr.setVisible(true); me.shadow.setVisible(true); me.tag.setVisible(true); G.ui.toast('You return to the fight!', 'info'); }
    }
  }

  roomAt(x, y) {
    for (const r of this.s.map.rooms) if (x >= r.x0 - 0.2 && x <= r.x1 + 1.2) return r;
    void y;
    return null;
  }

  /* ======================== FRAME UPDATE ======================== */

  update(dt) {
    const S = this.s;
    this.updateProjectiles(dt);
    this.updateDevices(dt);
    this.updateFloaters(dt);
    this.updatePickups(dt);
    if (S.zoneKey !== 'dungeon') return;
    if (!this.ended) this.runTime += dt;
    // host may change mid-run
    const run = S.run;
    if (run.online) S.isHost = !G.party || G.party.host === net.id;
    for (const h of this.dynHazards) { h.t -= dt; if (h.t <= 0) h.img.destroy(); }
    this.dynHazards = this.dynHazards.filter((h) => h.t > 0);
    this.updateTelegraphs(dt);

    // room tracking (boss music, banners)
    const room = this.roomAt(this.me.x, this.me.y);
    if (room && room.i !== this.curRoom) {
      this.curRoom = room.i;
      if (room.kind === 'boss' && this.boss?.alive) {
        G.ui.banner(this.boss.def.name, this.boss.def.title, true);
        playMusic('boss');
        sfx.roar();
        S.shake(5, 0.5);
      }
    }

    for (const e of S.enemies.values()) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.sunder = Math.max(0, (e.sunder || 0) - dt);
      if (S.isHost) this.enemyAI(e, dt);
      else {
        e.x += (e.tx - e.x) * Math.min(1, dt * 10);
        e.y += (e.ty - e.y) * Math.min(1, dt * 10);
      }
      this.drawEnemy(e);
    }
    if (this.boss) this.updateBoss(dt);

    if (S.isHost) {
      this.snapT -= dt;
      if (this.snapT <= 0 && run.online) {
        this.snapT = 0.12;
        const list = [];
        for (const e of S.enemies.values()) if (e.alive) list.push([e.id, +e.x.toFixed(2), +e.y.toFixed(2), Math.round(e.hp), e.state === 'move' ? 1 : e.state === 'atk' ? 2 : 0, e.face.x < 0 ? 1 : 0, e.stun > 0 ? 1 : 0]);
        const b = this.boss ? this.boss.heads.map((h) => [Math.round(h.hp), h.alive ? 1 : 0]) : null;
        net.ev({ k: 'snap', l: list, b });
      }
      this.hostCheckT -= dt;
      if (this.hostCheckT <= 0) { this.hostCheckT = 1; if (this.me.down || this.me.dead) this.checkWipe(); }
    }
  }

  pickTarget(e) {
    const S = this.s;
    const cands = [];
    if (!this.me.down && !this.me.dead) cands.push({ id: net.id || 0, x: this.me.x, y: this.me.y, local: true });
    for (const r of S.remotes.values()) if (!r.down && !r.dead) cands.push({ id: r.id, x: r.x, y: r.y });
    if (this.tauntBy && this.tauntT > 0) { const t = cands.find((c) => c.id === this.tauntBy); if (t) return t; }
    if (e.aggroOn !== undefined) { const t = cands.find((c) => c.id === e.aggroOn); if (t && Math.hypot(t.x - e.x, t.y - e.y) < 9) return t; }
    let best = null, bd = 1e9;
    for (const c of cands) { const d = Math.hypot(c.x - e.x, c.y - e.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  roomActive(i) {
    const S = this.s;
    const r = S.map.rooms[i];
    const inR = (x) => x >= r.x0 - 0.5 && x <= r.x1 + 1.5;
    if (inR(this.me.x, this.me.y) && !this.me.dead) return true;
    for (const rr of S.remotes.values()) if (!rr.dead && inR(rr.x, rr.y)) return true;
    return false;
  }

  enemyAI(e, dt) {
    const S = this.s;
    const def = e.def;
    e.cd -= dt;
    S.phys(e, dt);
    if (e.kb) { S.moveEntity(e, e.kb.x * dt); e.kb.t -= dt; if (e.kb.t <= 0) e.kb = null; }
    if (e.stun > 0) { e.stun -= dt; e.state = 'idle'; e.wind = 0; return; }
    if (e.root > 0) e.root -= dt;
    // snares
    for (const d of this.devices) if (d.kind === 'snare' && d.owner && Math.abs(d.x - e.x) < 0.8 && Math.abs(d.y - e.y) < 1 && !d.used) { d.used = true; d.t = Math.min(d.t, 0.5); e.root = 3; this.floatText(e.x, e.y, 'ROOTED', '#cdeaff', 7); }
    const active = this.roomActive(e.room);
    const tgt = active ? this.pickTarget(e) : null;
    if (!tgt) {
      e.state = 'idle';
      e.wander -= dt;
      if (e.wander <= 0) { e.wander = rand(2, 5); e.wx = e.x + rand(-1, 1); e.wy = e.y + rand(-1, 1); }
      return;
    }
    const dx = tgt.x - e.x, dy = tgt.y - e.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (e.wind > 0) {
      e.wind -= dt;
      e.state = 'atk';
      if (e.wind <= 0) {
        if (def.kind === 'melee') {
          if (d < def.range + 0.45) this.enemyHits(tgt, e.atk, e);
          e.cd = def.cd;
        }
      }
      return;
    }
    this.faceTo(e, tgt.x);
    let move = 0;
    const sp = def.speed * (e.root > 0 ? 0 : 1);
    if (def.kind === 'melee') {
      if (d > def.range) move = 1;
      else if (e.cd <= 0) { e.wind = 0.38; e.anim = ''; }
    } else {
      const keep = def.keep || 3;
      if (d > def.range) move = 1;
      else if (d < keep - 1) move = -1;
      if (e.cd <= 0 && d < def.range + 0.5) {
        e.cd = def.cd * rand(0.85, 1.2);
        e.anim = '';
        e.state = 'atk';
        e.atkT = 0.3;
        if (def.kind === 'healer') {
          // heal a hurt snake nearby, otherwise lob a spore
          let ally = null;
          for (const o of S.enemies.values()) if (o.alive && o !== e && o.def.snake && o.hp < o.maxHp * 0.85 && Math.hypot(o.x - e.x, o.y - e.y) < 4.5) { ally = o; break; }
          if (ally) {
            ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.18);
            this.floatText(ally.x, ally.y, '+heal', '#b2ecc0', 7);
            this.ring(ally.x, ally.y, 'ring_heal');
            net.ev({ k: 'fx', f: { k: 'ring', x: ally.x, y: ally.y, a: 'ring_heal' } });
          } else {
            const lx = tgt.x + rand(-0.5, 0.5);
            const lob = { x: e.x, y: e.y, tx: lx, ty: S.groundBelow(lx, tgt.y - 0.5), dmg: e.atk };
            this.enemyLob(lob);
            net.ev({ k: 'elob', ...lob });
          }
        } else {
          const l = { x: e.x, y: e.y, dx: dx / d, dy: dy / d, dmg: e.atk };
          this.enemyShot(l);
          net.ev({ k: 'eproj', ...l });
        }
      }
    }
    if (move && sp > 0) {
      // walk toward/away horizontally, spread out a little, hop up ledges
      let sx = Math.sign(dx) * move;
      for (const o of S.enemies.values()) {
        if (o === e || !o.alive) continue;
        const ox = e.x - o.x;
        if (Math.abs(ox) < 0.6 && Math.abs(e.y - o.y) < 1) sx += Math.sign(ox || 1) * 0.5;
      }
      if (Math.abs(dx) < 0.3 && move > 0) sx = 0;
      e.blocked = false;
      if (sx) S.moveEntity(e, Math.sign(sx) * sp * dt);
      if ((e.blocked || dy < -1.5) && e.onGround && Math.random() < 0.04) e.vy = -11;
      e.state = 'move';
    } else if (!e.atkT || e.atkT <= 0) e.state = 'idle';
    if (e.atkT > 0) e.atkT -= dt;
  }

  enemyHits(tgt, dmg, e) {
    if (tgt.local) this.hurtMe(dmg, 'melee');
    else net.ev({ k: 'eatk', d: dmg }, tgt.id);
    if (e && e.def.snake && Math.random() < 0.25 && tgt.local) this.me.status.poison = 2.5;
  }

  enemyShot(l) {
    sfx.shoot();
    this.spawnProj({ x: l.x, y: l.y, dx: l.dx, dy: l.dy, speed: 6, range: 9, dmg: l.dmg, owner: 'enemy', tex: 'orb_venom', poison: true, light: true, lift: l.lift ?? 0.55 });
  }

  enemyLob(l) {
    this.lob(l.x, l.y, l.tx, l.ty, 'orb_venom', 0.8, () => {
      this.puff(l.tx, l.ty, 'puff_venom');
      this.addPuddle(l.tx, l.ty, 0.9, 4);
      if (Math.abs(this.me.x - l.tx) < 0.9 && Math.abs(this.me.y - l.ty) < 1) this.hurtMe(l.dmg, 'poison');
    });
  }

  addPuddle(x, y, r, t) {
    const p = iso(x, y);
    const img = this.s.add.image(p.x, p.y, 'puddle_side').setOrigin(0.5, 1).setDepth(-10).setScale(r, 1).setAlpha(0.9);
    this.dynHazards.push({ x, y, r, t, img });
  }

  drawEnemy(e) {
    const p = iso(e.x, e.y);
    const k = e.state === 'move' ? 'move' : e.state === 'atk' ? 'atk' : 'idle';
    const ak = `en_${e.t}_${k}`;
    if (e.anim !== ak) { e.anim = ak; e.spr.play(ak); }
    e.spr.setPosition(p.x, p.y + 2).setDepth(depthOf(e.x, e.y));
    const gy = this.s.groundBelow(e.x, e.y) * 16;
    e.spr.setFlipX(e.face.x < 0);
    if (e.flash > 0) e.spr.setTintFill(0xffffff);
    else if (e.wind > 0) e.spr.setTint(0xffb0a0);
    else if (e.stun > 0) e.spr.setTint(0xb0b0ff);
    else if (e.sunder > 0) e.spr.setTint(0xffd0d0);
    else e.spr.clearTint();
    e.shadow.setPosition(p.x, gy).setDepth(depthOf(e.x, e.y, -2));
    e.bar.clear();
    if (e.hp < e.maxHp) {
      const f = Math.max(0, e.hp / e.maxHp);
      const w = e.t === 'tortoise' ? 22 : 16;
      e.bar.setDepth(90000);
      e.bar.fillStyle(0x1b1230, 0.9).fillRect(p.x - w / 2 - 1, p.y - 31, w + 2, 4);
      e.bar.fillStyle(0xef6550, 1).fillRect(p.x - w / 2, p.y - 30, w * f, 2);
    }
  }

  /* ======================== BOSS ======================== */

  updateBoss(dt) {
    const S = this.s;
    const b = this.boss;
    const tt = S.t;
    // visuals
    b.necks.clear();
    const bp = iso(b.x, b.y);
    const alive = b.heads.filter((h) => h.alive);
    for (const h of b.heads) {
      h.flash = Math.max(0, h.flash - dt);
      h.lunge = Math.max(0, h.lunge - dt * 2.5);
      h.open = Math.max(0, h.open - dt);
      const bob = Math.sin(tt * 2 + h.i * 2.1) * 3;
      // heads sway low enough to slash; they dip further while recovering from a bite
      h.rest = Math.max(0, (h.rest || 0) - dt);
      const lift = h.alive ? 36 + bob - h.sy * 0.8 - h.lunge * 22 - (h.rest > 0 ? 14 : 0) : 14;
      const hx = bp.x + h.sx * 0.9 - 30 - h.lunge * 46, hy = bp.y - lift;
      // feet-equivalent position used for targeting
      h.x = hx / 16; h.y = hy / 16 + CHEST;
      h.spr.setFlipX(true);
      // neck: chain of circles from body to head
      const sx = bp.x + h.sx * 0.35, sy = bp.y - 26;
      const segs = 9;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = sx + (hx - sx) * t + Math.sin(t * 3 + tt * 2 + h.i) * 3 * (1 - t);
        const y = sy + (hy + 8 - sy) * t - Math.sin(t * Math.PI) * 10;
        const r = 9 - t * 3;
        if (!h.alive && t > 0.45) break;
        const col = h.i === 1 ? 0x5c2a84 : h.i === 2 ? 0x1a615c : 0x2e6a2b;
        b.necks.fillStyle(0x1b1230, 1).fillCircle(x, y, r + 1);
        b.necks.fillStyle(col, 1).fillCircle(x, y, r);
        b.necks.fillStyle(0xcdb64d, 1).fillCircle(x + 1, y + 1, r * 0.45);
      }
      h.spr.setVisible(h.alive);
      h.spr.setPosition(hx, hy);
      h.spr.setFrame(h.flash > 0 ? 2 : h.open > 0 ? 1 : 0);
    }
    b.body.setTint(b.alive ? 0xffffff : 0x888888);
    if (!b.alive) return;

    if (!S.isHost) return;
    // AI
    const room = S.map.rooms[b.room];
    if (!this.roomActive(room.i)) return;
    if (!b.awake) { b.awake = true; b.cd = 2.2; }
    b.cd -= dt;
    if (b.cd > 0 || !alive.length) return;
    const enraged = alive.length === 1;
    b.cd = (enraged ? 1.5 : 2.3) * (b.solo ? 1.3 : 1);
    const h = alive[b.turn % alive.length];
    b.turn++;
    const tgt = this.pickTarget(b);
    if (!tgt) return;
    if (h.attack === 'spit') {
      h.open = 0.6;
      const dx = tgt.x - h.x, dy = tgt.y - h.y, base = Math.atan2(dy, dx);
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.16;
        const l = { x: h.x, y: h.y, dx: Math.cos(a), dy: Math.sin(a), dmg: b.atk * 0.7, lift: CHEST };
        this.enemyShot(l);
        net.ev({ k: 'eproj', ...l });
      }
    } else if (h.attack === 'bite') {
      const tel = { kind: 'band', x: tgt.x, y: S.groundBelow(tgt.x, tgt.y - 0.5), r: 1.4, t: 0.85, dmg: b.atk * 1.4, head: h.i };
      this.telegraph(tel);
      net.ev({ k: 'tele', ...tel });
    } else {
      const r = 7 * (this.br.bossAoe || 1);
      const tel = { kind: 'band', x: b.x - r + 1, y: b.y, r, t: 1.3, dmg: b.atk * 1.1, head: h.i, sweep: true };
      this.telegraph(tel);
      net.ev({ k: 'tele', ...tel });
    }
    net.ev({ k: 'bfx', h: h.i });
  }

  hitHead(b, h, d, o) {
    this.floatText(h.x, h.y - 2.5, Math.round(d) + (o.crit ? '!' : ''), o.crit ? '#ffcf4a' : '#ffffff', o.crit ? 11 : 9);
    if (o.crit) sfx.crit(); else sfx.hit();
    h.flash = 0.12;
    if (this.s.isHost) this.applyHeadDamage(b, h.i, d);
    else { h.hp -= d; net.ev({ k: 'hhit', h: h.i, d: Math.round(d) }); }
  }

  applyHeadDamage(b, i, d) {
    const h = b.heads[i];
    if (!h.alive) return;
    h.hp -= d;
    h.flash = 0.12;
    if (h.hp <= 0) this.severHead(b, i, true);
  }

  severHead(b, i, broadcast) {
    const h = b.heads[i];
    if (!h.alive) return;
    h.alive = false; h.hp = 0;
    const p = iso(h.x, h.y);
    this.s.shake(6, 0.4);
    sfx.roar();
    for (let k = 0; k < 4; k++) this.s.time.delayedCall(k * 90, () => this.puff(h.x + rand(-0.5, 0.5), h.y + rand(-0.5, 0.5), 'puff_venom', 1.3));
    G.ui.banner(h.name + ' severed!', h.attack === 'spit' ? 'No more venom barrages.' : h.attack === 'bite' ? 'The fangs fall silent.' : 'The tail sweep is broken.');
    if (broadcast) net.ev({ k: 'sever', h: i });
    void p;
    if (b.heads.every((x) => !x.alive)) this.bossDefeated(b, broadcast);
  }

  bossDefeated(b, broadcast) {
    if (!b.alive) return;
    b.alive = false;
    this.kills++;
    const S = this.s;
    S.shake(8, 0.8);
    sfx.epic();
    for (let k = 0; k < 10; k++) S.time.delayedCall(k * 110, () => this.puff(b.x + rand(-2, 2), b.y + rand(-1.5, 1.5), k % 2 ? 'puff_fire' : 'puff_venom', 1.5));
    S.tweens.add({ targets: [b.body], alpha: 0.35, duration: 1200 });
    if (broadcast) net.ev({ k: 'bossdown' });
    // rewards: guaranteed gear roll + treasures
    addXp(b.def.xp * (DIFFICULTY[S.run.diff].hp > 1 ? 1.6 : 1));
    addGold(Math.round(rand(b.def.gold[0], b.def.gold[1])));
    this.coins(b.x, b.y, 12);
    this.giveGear(b.x, b.y, true);
    this.giveTreasure(b.x, b.y);
    this.giveTreasure(b.x + 0.5, b.y);
    stat('bosses');
    if (this.runTime < 600) stat('fastClear');
    // exit portal
    S.time.delayedCall(1400, () => {
      const px = b.x - 9;
      S.addProp({ t: 'portal', x: px, y: b.y });
      S.map.interacts.push({ x: px, y: b.y, r: 1.8, kind: 'leave', label: 'Return Victorious' });
      const gl = S.add.image(px * 16, (b.y - 2) * 16, 'light').setTint(0xd36cff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0.5).setDepth(85300); void gl;
      G.ui.banner('VICTORY', 'The Warden falls. Step into the portal to return.', true);
      this.victory = true;
      playMusic('village');
    });
  }

  telegraph(tel) {
    const S = this.s;
    const g = S.add.graphics().setDepth(-4);
    this.telegraphs.push({ ...tel, g, t0: tel.t });
    if (tel.sweep) G.ui.toast('TAIL SWEEP! Jump onto a ledge or dodge-roll through it!', 'warn');
  }

  updateTelegraphs(dt) {
    for (const tl of this.telegraphs) {
      tl.t -= dt;
      const p = iso(tl.x, tl.y);
      const f = 1 - tl.t / tl.t0;
      tl.g.clear();
      // ground band warning (side view)
      const w = tl.r * 32;
      tl.g.fillStyle(0xff3030, 0.12 + f * 0.18).fillRect(p.x - w / 2, p.y - 26, w, 26);
      tl.g.fillStyle(0xff3030, 0.5 + f * 0.4).fillRect(p.x - (w / 2) * f, p.y - 3, w * f, 3);
      tl.g.lineStyle(1, 0xff6a5a, 0.9).strokeRect(p.x - w / 2, p.y - 26, w, 26);
      if (tl.t <= 0) {
        tl.g.destroy();
        const me = this.me;
        // only grounded heroes inside the band are hit: jumping clears it
        if (Math.abs(me.x - tl.x) < tl.r && me.y > tl.y - 0.9) this.hurtMe(tl.dmg, 'boss');
        if (tl.sweep) { this.s.shake(5, 0.3); this.ring(tl.x, tl.y, 'ring_slam', 2.2); sfx.boom(); }
        else { this.puff(tl.x, tl.y, 'puff_venom'); if (this.boss) { const h = this.boss.heads[tl.head]; if (h) { h.lunge = 1; h.open = 0.4; h.rest = 1.6; } } sfx.hit(); }
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t > 0);
  }

  applyTaunt(id, d) { this.tauntBy = id; this.tauntT = d; this.s.time.delayedCall(d * 1000, () => { if (this.tauntBy === id) this.tauntBy = null; }); }

  /* ======================== PROJECTILES & FX ======================== */

  spawnProj(o) {
    const S = this.s;
    const p = iso(o.x, o.y);
    o.lift = o.lift ?? CHEST;
    o.img = S.add.image(p.x, p.y - o.lift * 16, o.tex).setScale(o.scale || 1);
    if (o.tex === 'bullet' || o.tex === 'arrow') o.img.setRotation(Math.atan2(o.dy, o.dx));
    if (o.light || o.tex.startsWith('orb')) o.img.setBlendMode(Phaser.BlendModes.ADD);
    o.dist = 0;
    o.hit = new Set();
    this.projectiles.push(o);
    S.projectiles = this.projectiles;
    return o;
  }

  updateProjectiles(dt) {
    const S = this.s;
    for (const pr of this.projectiles) {
      const step = pr.speed * dt;
      pr.x += pr.dx * step; pr.y += pr.dy * step; pr.dist += step;
      const p = iso(pr.x, pr.y);
      pr.img.setPosition(p.x, p.y - pr.lift * 16).setDepth(depthOf(pr.x, pr.y, 3));
      let dead = pr.dist > pr.range || S.isSolid(pr.x, pr.y - pr.lift);
      if (pr.owner === 'me') {
        for (const t of this.targets()) {
          const key = t.head ? 'h' + t.head.i : t.e.id;
          if (pr.hit.has(key)) continue;
          if (hits(t, pr.x, pr.y - pr.lift + 0.6, 0.3, 0.7)) {
            pr.hit.add(key);
            this.damageTarget(t, pr.dmg, { crit: pr.crit, from: this.me, kb: 0.15, bossMult: pr.bossMult });
            if (!pr.pierce) { dead = true; break; }
          }
        }
        for (const b of [...(S.breakables?.values() || [])]) if (Math.abs(b.x - pr.x) < 0.5 && pr.y - pr.lift < b.y && pr.y - pr.lift > b.y - 1.2) { this.hitBreakable(b); if (!pr.pierce) dead = true; }
      } else if (pr.owner === 'enemy') {
        const me = this.me;
        if (!me.down && !me.dead && Math.abs(me.x - pr.x) < 0.45 && Math.abs((me.y - CHEST) - (pr.y - pr.lift)) < 1.1) {
          this.hurtMe(pr.dmg, 'poison');
          if (pr.poison && me.iframes <= 0) me.status.poison = 2.5;
          dead = true;
        }
      }
      if (dead) { pr.dead = true; pr.img.destroy(); if (pr.owner !== 'remote' || true) this.puff(pr.x, pr.y, pr.tex === 'orb_venom' ? 'puff_venom' : 'puff_magic', 0.45); }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    S.projectiles = this.projectiles;
  }

  lob(x0, y0, x1, y1, tex, dur, done) {
    const S = this.s;
    const img = S.add.image(0, 0, tex).setDepth(95000);
    if (tex === 'arrow') img.setRotation(Math.PI / 2); else if (tex.startsWith('orb')) img.setBlendMode(Phaser.BlendModes.ADD);
    const o = { t: 0 };
    S.tweens.add({
      targets: o, t: 1, duration: dur * 1000,
      onUpdate: () => {
        const x = x0 + (x1 - x0) * o.t, y = y0 + (y1 - y0) * o.t;
        const p = iso(x, y);
        img.setPosition(p.x, p.y - 12 * (1 - o.t) - Math.sin(o.t * Math.PI) * 40);
      },
      onComplete: () => { img.destroy(); done && done(); },
    });
  }

  explode(x, y, r, dmg, crit) {
    sfx.boom();
    this.s.shake(4, 0.2);
    this.puff(x, y, 'puff_fire', 1.6);
    this.ring(x, y, 'ring_slam');
    for (const t of this.targets()) if (hits(t, x, y, r, 2)) this.damageTarget(t, dmg, { crit, aoe: true, from: { x, y, cls: 'gunman' }, kb: 0.4 });
    for (const b of [...(this.s.breakables?.values() || [])]) if (Math.hypot(b.x - x, b.y - y) < r) this.hitBreakable(b);
  }

  storm(x, y, dmg, mine, kind = 'fire') {
    const S = this.s;
    const arrows = kind === 'arrow';
    for (let k = 0; k < (arrows ? 10 : 7); k++) {
      S.time.delayedCall(150 + k * (arrows ? 90 : 160), () => {
        const px = x + rand(-1.6, 1.6), py = S.groundBelow(px, y - 1.5);
        this.lob(px - 0.6, py - 5, px, py, arrows ? 'arrow' : 'orb_fire', arrows ? 0.18 : 0.22, () => {
          this.puff(px, py, arrows ? 'puff_dust' : 'puff_fire', arrows ? 0.6 : 1.1);
          if (arrows) sfx.hit(); else sfx.boom();
          if (!mine) return;
          for (const t of this.targets()) if (hits(t, px, py, 1.1, 3)) this.damageTarget(t, dmg, { aoe: true, from: this.me });
          for (const b of [...(S.breakables?.values() || [])]) if (Math.hypot(b.x - px, b.y - py) < 1) this.hitBreakable(b);
        });
      });
    }
  }

  addDevice(kind, x, y, owner) {
    const S = this.s;
    const p = iso(x, y);
    const d = { kind, x, y, owner, t: kind === 'sentry' ? 15 : 20, cd: 0.4 };
    if (kind === 'sentry') { d.img = S.add.image(p.x, p.y + 1, 'pk_turret').setOrigin(0.5, 1).setDepth(depthOf(x, y)); S.tweens.add({ targets: d.img, y: p.y - 1, duration: 500, yoyo: true, repeat: -1 }); }
    else d.img = S.add.image(p.x, p.y + 2, 'pk_snare').setOrigin(0.5, 1).setDepth(depthOf(x, y, -3));
    this.devices.push(d);
  }

  updateDevices(dt) {
    for (const d of this.devices) {
      d.t -= dt;
      if (d.kind === 'sentry' && d.owner) {
        d.cd -= dt;
        if (d.cd <= 0) {
          let best = null, bd = 6.5;
          for (const t of this.targets()) { const dd = Math.hypot(t.x - d.x, (t.y - d.y) * 0.6); if (dd < bd) { bd = dd; best = t; } }
          if (best) {
            d.cd = 0.55;
            const dx = best.x - d.x, dy = best.y - d.y, l = Math.hypot(dx, dy) || 1;
            this.spawnProj({ x: d.x, y: d.y, dx: dx / l, dy: dy / l, speed: 13, range: 8, dmg: this.me.stats.spell * 0.55, owner: 'me', tex: 'bullet', lift: 1.2 });
            d.img.setFlipX(dx > 0);
          }
        }
      }
      if (d.t <= 0) { this.puff(d.x, d.y, 'puff_dust', 0.6); d.img.destroy(); }
    }
    this.devices = this.devices.filter((d) => d.t > 0);
  }

  slashFx(x, y, flip, scale = 1) {
    const p = iso(x, y);
    const s = this.s.add.sprite(p.x, p.y - CH, 'slash').setDepth(depthOf(x, y, 4)).setFlipX(flip).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    s.play('slash');
    s.once('animationcomplete', () => s.destroy());
  }

  puff(x, y, key, scale = 1) {
    const p = iso(x, y);
    const s = this.s.add.sprite(p.x, p.y - 8, key).setDepth(depthOf(x, y, 6)).setScale(scale);
    if (key === 'puff_fire' || key === 'puff_magic') s.setBlendMode(Phaser.BlendModes.ADD);
    s.play(key);
    s.once('animationcomplete', () => s.destroy());
  }

  ring(x, y, key, scale = 1) {
    const p = iso(x, y);
    const s = this.s.add.sprite(p.x, p.y, key).setDepth(-2).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    s.play(key);
    s.once('animationcomplete', () => s.destroy());
  }

  floatText(x, y, text, color = '#ffffff', size = 8) {
    const p = iso(x, y);
    const t = this.s.add.text(p.x + rand(-4, 4), p.y - 40, text, {
      fontFamily: '"Pixelify Sans", monospace', fontSize: size + 'px', color, stroke: '#1b1230', strokeThickness: 3, resolution: 4,
    }).setOrigin(0.5).setDepth(99000);
    this.s.tweens.add({ targets: t, y: t.y - 16, alpha: { from: 1, to: 0 }, duration: 750, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  coins(x, y, n) {
    const S = this.s;
    for (let i = 0; i < n; i++) {
      const p = iso(x, y);
      const c = S.add.sprite(p.x, p.y - 6, 'coin').play({ key: 'coin', startFrame: i % 4 }).setDepth(96000);
      const ang = Math.random() * TAU;
      this.pickups.push({ img: c, vx: (Math.random() - 0.5) * 120, vy: -70 - Math.random() * 40, t: 0, x: p.x, y: p.y - 10, ground: p.y - 2 });
      void ang;
    }
    if (n) S.time.delayedCall(350, () => sfx.coin());
  }

  lootPop(x, y, item) {
    const S = this.s;
    const p = iso(x, y);
    const key = 'lootIcon_' + item.icon + '_' + item.rarity;
    if (!S.textures.exists(key)) {
      const img = new Image();
      img.src = G.ui.iconFor(item);
      img.onload = () => { if (!S.textures.exists(key)) S.textures.addImage(key, img); spawn(); };
    } else spawn();
    function spawn() {
      if (!S.sys.isActive()) return;
      const glow = S.add.image(p.x, p.y - 14, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setTint(G.ui.rarityColorInt(item.rarity)).setDepth(96999);
      const im = S.add.image(p.x, p.y - 14, key).setDepth(97000);
      S.tweens.add({ targets: [im, glow], y: p.y - 34, duration: 500, ease: 'Back.easeOut' });
      S.tweens.add({ targets: [im, glow], alpha: 0, delay: 1100, duration: 400, onComplete: () => { im.destroy(); glow.destroy(); } });
    }
  }

  updatePickups(dt) {
    const me = this.me;
    const mp = iso(me.x, me.y);
    for (const c of this.pickups) {
      c.t += dt;
      if (c.t < 0.45) {
        c.vy += 260 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > c.ground) { c.y = c.ground; c.vy *= -0.4; c.vx *= 0.6; }
      } else {
        const dx = mp.x - c.x, dy = mp.y - CH - c.y;
        const d = Math.hypot(dx, dy);
        const sp = 140 + c.t * 300;
        c.x += (dx / (d || 1)) * Math.min(d, sp * dt); c.y += (dy / (d || 1)) * Math.min(d, sp * dt);
        if (d < 4) { c.dead = true; c.img.destroy(); }
      }
      if (!c.dead) c.img.setPosition(c.x, c.y);
    }
    this.pickups = this.pickups.filter((c) => !c.dead);
  }

  updateFloaters() { /* tweens handle floaters */ }

  netFx(f) { if (this.s.run?.online) net.ev({ k: 'fx', f }); }

  /* ======================== NETWORK EVENTS ======================== */

  onEvent(from, e) {
    if (!e || this.s.zoneKey !== 'dungeon') return;
    const S = this.s;
    switch (e.k) {
      case 'snap': {
        if (S.isHost) return;
        const seen = new Set();
        for (const [id, x, y, hp, st, fl, stun] of e.l) {
          const en = S.enemies.get(id);
          if (!en || !en.alive) continue;
          seen.add(id);
          en.tx = x; en.ty = y; en.hp = hp;
          en.state = st === 1 ? 'move' : st === 2 ? 'atk' : 'idle';
          en.face = { x: fl ? -1 : 1, y: 1 }; en.stun = stun ? 0.2 : 0;
        }
        if (e.b && this.boss) e.b.forEach(([hp, al], i) => { const h = this.boss.heads[i]; h.hp = hp; if (!al && h.alive) this.severHead(this.boss, i, false); });
        break;
      }
      case 'hit': {
        if (!S.isHost) return;
        const en = S.enemies.get(e.id);
        if (en) this.applyEnemyDamage(en, e.d, { stun: e.st, root: e.rt, poise: e.p }, from);
        break;
      }
      case 'hhit': {
        if (!S.isHost || !this.boss) return;
        this.applyHeadDamage(this.boss, e.h, e.d);
        break;
      }
      case 'sever': if (this.boss) this.severHead(this.boss, e.h, false); break;
      case 'bossdown': if (this.boss) this.bossDefeated(this.boss, false); break;
      case 'kill': {
        const en = S.enemies.get(e.id);
        if (en) this.killEnemy(en, e.by);
        break;
      }
      case 'eproj': this.enemyShot(e); break;
      case 'elob': this.enemyLob(e); break;
      case 'eatk': this.hurtMe(e.d, 'melee'); break;
      case 'tele': this.telegraph(e); break;
      case 'bfx': if (this.boss) { const h = this.boss.heads[e.h]; if (h) h.open = 0.5; } break;
      case 'brk': { const b = S.breakables.get(e.id); if (b) this.hitBreakable(b, true); break; }
      case 'heal': {
        if (Math.hypot(this.me.x - e.x, this.me.y - e.y) < e.r) { this.healMe(e.a); sfx.heal(); }
        this.ring(e.x, e.y, 'ring_heal');
        break;
      }
      case 'taunt': this.applyTaunt(from, e.d); { const r = S.remotes.get(from); if (r) this.ring(r.x, r.y, 'ring_taunt'); } break;
      case 'rev': {
        const me = this.me;
        if (me.down && !me.dead) { me.down = false; me.hp = me.stats.maxHp * 0.4; me.iframes = 2; G.ui.setDowned(false); G.ui.toast('A teammate revived you!', 'info'); sfx.heal(); this.ring(me.x, me.y, 'ring_heal'); }
        break;
      }
      case 'wipe': this.endRun('wipe'); break;
      case 'fx': {
        const f = e.f;
        if (f.k === 'slash') this.slashFx(f.x, f.y, !!f.f);
        else if (f.k === 'proj') this.spawnProj({ x: f.x, y: f.y, dx: f.dx, dy: f.dy, speed: f.sp, range: f.r, dmg: 0, owner: 'remote', tex: f.tex, light: true });
        else if (f.k === 'storm') this.storm(f.x, f.y, 0, false, f.a || 'fire');
        else if (f.k === 'ring') this.ring(f.x, f.y, f.a);
        else if (f.k === 'lob') this.lob(f.x, f.y, f.tx, f.ty, 'orb_venom', 0.55, () => { this.puff(f.tx, f.ty, 'puff_fire', 1.6); sfx.boom(); });
        else if (f.k === 'dev') this.addDevice(f.d, f.x, f.y, false);
        break;
      }
      default: break;
    }
  }

  /* ======================== RUN END ======================== */

  endRun(reason) {
    if (this.ended) return;
    this.ended = true;
    const S = this.s;
    const s = G.save;
    if (reason === 'wipe') { wear(15); s.stats.deaths++; } else wear(reason === 'victory' || this.victory ? 3 : 2);
    if (this.victory) s.stats.clears++;
    s.meal = null; // meals last one run
    if (S.run.online && G.party && G.party.host === net.id) net.send({ t: 'pend' });
    save();
    const summary = {
      reason: this.victory ? 'victory' : reason,
      time: this.runTime, kills: this.kills, loot: this.lootLog.slice(),
      dungeon: DUNGEONS[S.run.dungeon].name, diff: S.run.diff,
    };
    G.ui.runEnd(summary, () => S.travel('village', { from: 'dungeon' }));
  }
}
