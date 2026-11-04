/* global Phaser */
// DOM UI: title, character creation, HUD, touch controls and all panels.
import { G } from '../game/state.js';
import { net } from '../net.js';
import { icon } from '../art/icons.js';
import { humanSheet, lookFor, HAIR, SKIN, NPC_LOOKS } from '../art/chars.js';
import { CLASSES, CLASS_ORDER, ATTRS, ATTR_INFO, xpForLevel, derive } from '../data/classes.js';
import { RARITY_RAMP, RARITY_NAME, SLOTS, SLOT_ICON, STORE_STOCK, CONSUMABLES, ENCHANT_SLOTS, PERKS, SETS, makeConsumable, sellValue, CLASS_WEAPON_ICON } from '../data/items.js';
import { BOUNTIES, DECREES, CRUSADES } from '../data/quests.js';
import { DUNGEONS, DIFFICULTY } from '../world/dungeon.js';
import { newCharacter, loadSave, writeSave, saveSettings, deleteSave } from '../save.js';
import { gearTotals, addItem, countItem, repairCost, save, addXp, BAG_SIZE } from '../game/progress.js';
import { sfx, initAudio, resumeAudio, playMusic, setVolumes } from '../audio.js';
import { VERSION, GITHUB, CREDIT, DEFAULT_SERVER } from '../config.js';
import { CLASS_COLORS } from '../art/palette.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.floor(n).toLocaleString();
const COIN = () => icon('coin');
const RCOL = { common: 'var(--common)', uncommon: 'var(--uncommon)', rare: 'var(--rare)', epic: 'var(--epic)', gold: 'var(--goldr)', warn: 'var(--warn)', info: 'var(--line)', quest: 'var(--pink)' };
const CLASS_ICON = { warrior: 'sword', mage: 'staff', savage: 'axe', gunman: 'rifle', engineer: 'wrench' };

const sheetCache = {};
function sheetCanvas(lookKey, look) {
  if (!sheetCache[lookKey]) sheetCache[lookKey] = humanSheet(look).canvas();
  return sheetCache[lookKey];
}
function drawFrame(canvas, sheet, frame) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(sheet, frame * 32, 0, 32, 32, 0, 0, canvas.width, canvas.height);
}

export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.panel = null;
    this.hudCache = {};
    this.toastsEl = null;
    this.chatOpen = false;
    this.attackHeld = false;
    G.ui = this;
    this.anim = [];
    setInterval(() => this.tickAnims(), 140);
    this.animFrame = 0;
  }

  typing() { return this.chatOpen || (document.activeElement && document.activeElement.tagName === 'INPUT'); }

  tickAnims() {
    this.animFrame++;
    this.anim = this.anim.filter((a) => a.canvas.isConnected);
    for (const a of this.anim) drawFrame(a.canvas, a.sheet, a.frames[this.animFrame % a.frames.length]);
  }
  animate(canvas, sheet, frames) { this.anim.push({ canvas, sheet, frames }); drawFrame(canvas, sheet, frames[0]); }

  iconFor(item) {
    if (item.type === 'gear') return icon(item.icon, RARITY_RAMP[item.rarity]);
    return icon(item.icon);
  }
  rarityColorInt(r) { return { common: 0xe6e1d6, uncommon: 0x7ee07a, rare: 0x5cb6ff, epic: 0xc77dff, gold: 0xffcf4a }[r] || 0xffffff; }

  /* ============================== TITLE ============================== */

  showTitle() {
    const el = document.createElement('div');
    el.id = 'title';
    const saveData = loadSave();
    el.innerHTML = `
      <div class="ver">v${VERSION}</div>
      <img class="logo" src="./logo.png" alt="Bright Hearts RPG">
      <div class="menu">
        ${saveData ? `<button class="btn gold" data-a="continue"><img class="ic px" src="${icon('heart')}">Continue · ${esc(saveData.name)} Lv${saveData.level}</button>` : ''}
        <button class="btn ${saveData ? '' : 'gold'}" data-a="new">${saveData ? 'New Hero' : 'Start Adventure'}</button>
        <button class="btn ghost" data-a="settings"><img class="ic px" src="${icon('gear')}">Settings</button>
      </div>
      <div class="tap">co-op dungeon raids for 1 to 10 heroes</div>
      <div class="credit">A game by <a href="${GITHUB}" target="_blank" rel="noopener">${CREDIT}</a></div>`;
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('i');
      s.className = 'sparkle';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = Math.random() * 2.4 + 's';
      if (i % 3 === 0) s.style.background = 'var(--pink)';
      el.appendChild(s);
    }
    el.addEventListener('click', (ev) => {
      initAudio(G.settings); resumeAudio(); playMusic('title');
      const a = ev.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      sfx.ui();
      if (a === 'continue') { G.save = saveData; el.remove(); this.startGame(); }
      else if (a === 'new') {
        if (saveData) this.confirm('Start a new hero?', 'Your current hero <b>' + esc(saveData.name) + '</b> will be replaced on this device.', () => { el.remove(); this.showCreate(); });
        else { el.remove(); this.showCreate(); }
      } else if (a === 'settings') this.openPanel('settings');
    });
    document.body.appendChild(el);
    this.rotateHint();
  }

  rotateHint() {
    if ($('.rotate')) return;
    const r = document.createElement('div');
    r.className = 'rotate armed';
    r.innerHTML = '<div class="ph"></div><div>Turn your phone sideways<br><small style="color:var(--dim)">Bright Hearts plays in landscape</small></div>';
    document.body.appendChild(r);
  }

  /* ============================== CREATE ============================== */

  showCreate() {
    const el = document.createElement('div');
    el.id = 'create';
    const st = { cls: 'warrior', name: '', hair: 'brown', style: 'spiky', skin: 0 };
    el.innerHTML = `
      <div class="wrap frame gold corner">
        <div class="stage"><canvas width="64" height="64" class="pv"></canvas><div class="pedestal"></div>
          <div class="row" style="margin-top:8px;justify-content:center" data-k="look"></div>
        </div>
        <div style="min-width:0;overflow:auto">
          <h2>Choose your hero</h2>
          <div class="classtabs"></div>
          <div class="cinfo"></div>
          <div class="lbl">Name</div>
          <div class="row"><input class="field" maxlength="14" placeholder="Hero name" style="flex:1"><button class="btn gold" data-a="go">Begin</button></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    const tabs = $('.classtabs', el);
    tabs.innerHTML = CLASS_ORDER.map((c) => `<div class="classtab" data-c="${c}"><img src="${icon(CLASS_ICON[c])}">${CLASSES[c].name}</div>`).join('');
    const pv = $('.pv', el);
    const render = () => {
      for (const t of tabs.children) t.classList.toggle('on', t.dataset.c === st.cls);
      const C = CLASSES[st.cls];
      const sheet = humanSheet(lookFor(st.cls, st)).canvas();
      this.anim = this.anim.filter((a) => a.canvas !== pv);
      this.animate(pv, sheet, [2, 3, 4, 5, 2, 3, 4, 5, 6, 7, 7, 0, 1, 0, 1]);
      $('.cinfo', el).innerHTML = `
        <div><span class="tag" style="color:${CLASS_COLORS[st.cls]}">${C.archetype}</span><span class="tag">${C.role}</span><span class="tag">${C.resource === 'scrap' ? 'Uses Scrap' : 'Uses Mana'}</span></div>
        <div style="margin:4px 0 6px">${C.blurb}</div>
        ${ATTRS.map((a) => `<div class="statrow" title="${ATTR_INFO[a]}"><span>${a[0].toUpperCase() + a.slice(1)}</span><div class="statbar"><i style="width:${Math.min(100, C.base[a] * 2.2)}%"></i></div><span>${C.base[a]}</span></div>`).join('')}
        <div class="lbl">Skills</div>
        <div class="row">${C.skills.map((s) => `<span class="tag" style="color:var(--text)"><img src="${icon(s.icon)}" style="width:14px;height:14px;vertical-align:-3px;image-rendering:pixelated"> ${s.name}</span>`).join('')}</div>
        <div class="paths">${C.paths.map((p) => `<div class="path"><b>${p.name}</b>${p.desc}</div>`).join('')}</div>`;
      $('[data-k=look]', el).innerHTML = `
        ${Object.entries(HAIR).map(([k, r]) => `<div class="swatch ${st.hair === k ? 'on' : ''}" data-hair="${k}" style="background:${r[3]}"></div>`).join('')}
        <div style="width:100%;height:2px"></div>
        ${['spiky', 'short', 'long', 'bob', 'pony'].map((s) => `<div class="chip ${st.style === s ? 'on' : ''}" data-style="${s}">${s}</div>`).join('')}
        <div style="width:100%;height:2px"></div>
        ${SKIN.map((r, i) => `<div class="swatch ${st.skin === i ? 'on' : ''}" data-skin="${i}" style="background:${r[3]}"></div>`).join('')}`;
    };
    render();
    el.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-c],[data-hair],[data-style],[data-skin],[data-a]');
      if (!t) return;
      sfx.ui();
      if (t.dataset.c) st.cls = t.dataset.c;
      if (t.dataset.hair) st.hair = t.dataset.hair;
      if (t.dataset.style) st.style = t.dataset.style;
      if (t.dataset.skin) st.skin = +t.dataset.skin;
      if (t.dataset.a === 'go') {
        const name = $('input', el).value.trim().replace(/[<>]/g, '') || ['Ash', 'Nova', 'Kairo', 'Zuri', 'Tamsin'][Math.floor(Math.random() * 5)];
        G.save = newCharacter(name, st.cls, { hair: st.hair, style: st.style, skin: st.skin });
        writeSave(G.save);
        el.remove();
        this.startGame(true);
        return;
      }
      render();
    });
  }

  /* ============================== GAME START ============================== */

  startGame(fresh) {
    initAudio(G.settings); resumeAudio();
    this.buildHud();
    const look = G.save.look;
    net.hello({ name: G.save.name, cls: G.save.cls, lvl: G.save.level, look });
    net.on('status', (s) => this.setNet(s));
    net.on('party', (m) => this.onParty(m));
    net.on('perr', (m) => this.toast(m.m, 'warn'));
    net.on('pstart', (m) => this.onPartyStart(m));
    net.on('disconnected', () => this.toast('Lost connection to the server. Reconnecting…', 'warn'));
    net.connect(G.settings.server || DEFAULT_SERVER);
    this.game.scene.start('world', { zone: 'village' });
    if (fresh) setTimeout(() => this.talkTo({ name: 'Captain Rhea', id: 'guild', role: 'guild', look: NPC_LOOKS.guild, line: `Welcome to Brightheart Village, ${G.save.name}! The portal south of the fountain leads to the Overgrown Ruins. Stock up at Mira's store first, then raid. Move with the stick, attack with the big red button.` }), 1500);
  }

  /* ============================== HUD ============================== */

  buildHud() {
    const hud = document.createElement('div');
    hud.id = 'hud';
    const s = G.save;
    const C = CLASSES[s.cls];
    hud.innerHTML = `
      <div class="hurt"></div>
      <div class="card frame">
        <div class="portrait"><canvas width="64" height="64"></canvas><div class="lv">1</div></div>
        <div class="bars">
          <div class="nm"><span>${esc(s.name)}</span><small>${C.name}</small></div>
          <div class="bar hp"><i class="lag"></i><i class="v"></i><span></span></div>
          <div class="bar ${C.resource === 'scrap' ? 'scrap' : 'mp'}"><i class="v"></i><span></span></div>
          <div class="bar xp"><i class="v"></i></div>
          <div class="status"></div>
        </div>
      </div>
      <div class="topright">
        <div class="gold-pill frame"><img class="px" src="${COIN()}"><span class="g">0</span></div>
        <button class="btn iconbtn" data-a="quests" title="Quests"><img src="${icon('scroll')}"></button>
        <button class="btn iconbtn" data-a="character" title="Hero (I)"><img src="${icon('bag')}"></button>
        <button class="btn iconbtn" data-a="settings" title="Settings"><img src="${icon('gear')}"></button>
      </div>
      <div class="netdot"><i></i><span>offline</span></div>
      <div class="zonebanner"><div class="t"></div><div class="orn"></div><div class="s"></div></div>
      <div class="runbar frame hidden"><span class="dn"></span><span class="tm">0:00</span><span class="kl"></span></div>
      <div class="bossbar frame hidden"><div class="bn"></div><div class="heads"></div></div>
      <div id="toasts"></div>
      <div id="chatlog"></div>
      <div id="stick"><svg class="arrows" viewBox="0 0 100 100"><path d="M50 6 L56 14 L44 14Z M50 94 L56 86 L44 86Z M6 50 L14 44 L14 56Z M94 50 L86 44 L86 56Z" fill="#cdbfff"/></svg><div class="knob"></div></div>
      <button class="btn iconbtn chatbtn" data-a="chat"><img src="${icon('chat')}"></button>
      <div id="actions">
        <div class="act big" data-act="atk"><img src="${icon(CLASS_ICON[s.cls])}"></div>
        <div class="act s1" data-act="s0"><img src="${icon(C.skills[0].icon)}"><div class="cd"></div><div class="cost ${C.resource === 'scrap' ? 'scrap' : ''}">${C.skills[0].cost}</div></div>
        <div class="act s2" data-act="s1"><img src="${icon(C.skills[1].icon)}"><div class="cd"></div><div class="cost ${C.resource === 'scrap' ? 'scrap' : ''}">${C.skills[1].cost}</div></div>
        <div class="act dodge" data-act="dodge"><img src="${icon('dash')}"><div class="cd"></div></div>
        <div class="act pot" data-act="pot"><img src="${icon('potionRed')}"><div class="cd"></div><div class="num">0</div></div>
      </div>
      <button id="interact" class="btn gold hidden"><span class="k">E</span><span class="l"></span></button>
      <div class="downed frame hidden"><div class="t">DOWNED</div><div class="s"></div></div>
      <div class="revive frame hidden"><div class="l"></div><div class="bar"><i class="v"></i></div></div>`;
    this.root.appendChild(hud);
    this.hud = hud;
    this.toastsEl = $('#toasts', hud);
    const pc = $('.portrait canvas', hud);
    drawFrame(pc, humanSheet(lookFor(s.cls, s.look)).canvas(), 0);
    hud.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      sfx.ui();
      if (a === 'chat') this.openChat();
      else this.openPanel(a);
    });
    $('#interact', hud).addEventListener('click', () => G.scene && G.scene.interact());
    this.bindStick($('#stick', hud));
    this.bindActions($('#actions', hud));
    const loop = () => {
      if (this.attackHeld && G.scene && !this.panel) G.scene.combat.attack();
      requestAnimationFrame(loop);
    };
    loop();
  }

  bindStick(stick) {
    const knob = $('.knob', stick);
    let id = null, cx = 0, cy = 0, R = 46;
    const set = (x, y) => {
      let dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.hypot(dx, dy) / R;
      G.input.mx = m > 0.18 ? dx / R : 0;
      G.input.my = m > 0.18 ? dy / R : 0;
    };
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId; stick.setPointerCapture(id);
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.36;
      set(e.clientX, e.clientY);
      resumeAudio();
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; G.input.mx = 0; G.input.my = 0; };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  bindActions(el) {
    el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !G.scene) return;
      e.preventDefault();
      resumeAudio();
      b.classList.add('down');
      const a = b.dataset.act;
      const c = G.scene.combat;
      if (a === 'atk') { this.attackHeld = true; c.attack(); }
      else if (a === 's0') c.skill(0);
      else if (a === 's1') c.skill(1);
      else if (a === 'dodge') c.dodge();
      else if (a === 'pot') c.potion();
    });
    const up = (e) => { for (const b of el.querySelectorAll('.down')) b.classList.remove('down'); if (!e.target.closest || true) this.attackHeld = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  updateHud(me, scene) {
    if (!this.hud) return;
    const c = this.hudCache;
    const s = G.save;
    const set = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
    const hpF = Math.max(0, me.hp / me.stats.maxHp);
    set('hp', Math.round(me.hp) + '/' + me.stats.maxHp, (v) => {
      $('.bar.hp i.v', this.hud).style.width = hpF * 100 + '%';
      $('.bar.hp i.lag', this.hud).style.width = hpF * 100 + '%';
      $('.bar.hp span', this.hud).textContent = v;
      $('.bar.hp', this.hud).classList.toggle('low', hpF < 0.3);
    });
    const mpF = Math.max(0, me.mp / (me.maxMp || 1));
    set('mp', Math.floor(me.mp) + '/' + me.maxMp, (v) => {
      const b = $('.bar.mp, .bar.scrap', this.hud);
      $('i.v', b).style.width = mpF * 100 + '%';
      $('span', b).textContent = (me.resource === 'scrap' ? 'Scrap ' : '') + v;
    });
    const need = xpForLevel(s.level);
    set('xp', s.xp + '/' + need + '/' + s.level, () => {
      $('.bar.xp i.v', this.hud).style.width = (s.level >= 30 ? 100 : (s.xp / need) * 100) + '%';
      $('.portrait .lv', this.hud).textContent = s.level;
    });
    set('gold', s.gold, (v) => { $('.gold-pill .g', this.hud).textContent = fmt(v); });
    const stx = Object.keys(me.status).map((k) => k + (me.status[k] > 0 ? Math.ceil(me.status[k]) : '')).join(',');
    set('status', stx, () => {
      const names = { poison: ['Poisoned', '#a1d22f'], taunt: ['Taunting', '#ff9a7a'], haste: ['Haste', '#ffd27a'], root: ['Rooted', '#cdeaff'] };
      $('.status', this.hud).innerHTML = Object.keys(me.status).filter((k) => names[k]).map((k) => `<b style="color:${names[k][1]}">${names[k][0]}</b>`).join('');
    });
    // skill cooldowns + affordability
    const C = CLASSES[s.cls];
    for (let i = 0; i < 2; i++) {
      const sk = C.skills[i];
      const p = me.cds[i] > 0 ? (me.cds[i] / sk.cd) * 100 : 0;
      set('cd' + i, Math.round(p) + (me.mp >= sk.cost ? 'y' : 'n'), () => {
        const b = $(`.act.s${i + 1}`, this.hud);
        $('.cd', b).style.setProperty('--p', p + '%');
        b.classList.toggle('nores', me.mp < sk.cost);
      });
    }
    set('dcd', Math.round((me.dodgeCd / 1.1) * 100), (v) => $('.act.dodge .cd', this.hud).style.setProperty('--p', v + '%'));
    set('pcd', Math.round((me.potCd / 15) * 100), (v) => $('.act.pot .cd', this.hud).style.setProperty('--p', v + '%'));
    const vials = countItem('vial1') + countItem('vial2') + countItem('vial3');
    set('vials', vials, (v) => { $('.act.pot .num', this.hud).textContent = v; });
    if (scene.zoneKey === 'dungeon' && scene.combat) {
      const t = scene.combat.runTime;
      set('rt', Math.floor(t), () => { $('.runbar .tm', this.hud).textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; });
      set('kl', scene.combat.kills, (v) => { $('.runbar .kl', this.hud).innerHTML = `<img src="${icon('skull')}" style="width:14px;height:14px;vertical-align:-3px;image-rendering:pixelated"> ${v}`; });
      const b = scene.combat.boss;
      const showBoss = b && b.alive && scene.combat.curRoom === b.room;
      set('bossOn', !!showBoss, (v) => { $('.bossbar', this.hud).classList.toggle('hidden', !v); if (v) { $('.bossbar .bn', this.hud).textContent = b.def.name; $('.bossbar .heads', this.hud).innerHTML = b.heads.map((h) => `<div class="bar"><i class="v"></i><span>${h.name}</span></div>`).join(''); } });
      if (showBoss) {
        const sig = b.heads.map((h) => Math.round(h.hp)).join(',');
        set('bossHp', sig, () => b.heads.forEach((h, i) => { const el = $('.bossbar .heads', this.hud).children[i]; $('i.v', el).style.width = Math.max(0, h.hp / h.maxHp) * 100 + '%'; el.classList.toggle('dead', !h.alive); }));
      }
    }
  }

  refresh() { this.hudCache = {}; if (this.panel && this.panel.re) this.panel.re(); }

  setNet(s) {
    G.online = s === 'online';
    const el = $('.netdot', this.hud);
    if (!el) return;
    el.classList.toggle('on', s === 'online');
    el.classList.toggle('conn', s === 'connecting');
    $('span', el).textContent = s === 'online' ? (this.onlineCount ? this.onlineCount + ' here' : 'online') : s === 'connecting' ? 'connecting…' : 'offline · solo';
  }
  setOnlineCount(n) { this.onlineCount = n; this.setNet(G.online ? 'online' : 'offline'); }

  enterZone(zone, title) {
    if (!this.hud) return;
    this.hudCache = {};
    this.closePanel();
    const zb = $('.zonebanner', this.hud);
    $('.t', zb).textContent = title;
    $('.s', zb).textContent = zone === 'village' ? 'Safe haven · Shops, Guild Board and the Dungeon Portal' : zone === 'castle' ? 'Royal Decrees and King\'s Crusades' : 'Clear each chamber to break its seal';
    zb.classList.add('show');
    clearTimeout(this.zbT);
    this.zbT = setTimeout(() => zb.classList.remove('show'), 3200);
    $('.runbar', this.hud).classList.toggle('hidden', zone !== 'dungeon');
    $('.bossbar', this.hud).classList.add('hidden');
    this.setDowned(false);
  }

  setInteract(label) {
    const b = $('#interact', this.hud);
    if (!b) return;
    if (this.hudCache.inter === label) return;
    this.hudCache.inter = label;
    b.classList.toggle('hidden', !label);
    if (label) $('.l', b).textContent = label;
  }

  setDowned(on, t) {
    const d = $('.downed', this.hud);
    if (!d) return;
    d.classList.toggle('hidden', !on);
    if (on) $('.s', d).textContent = `Bleeding out ${Math.ceil(t)}s · a teammate can revive you`;
  }
  setRevive(r) {
    const el = $('.revive', this.hud);
    if (!el) return;
    el.classList.toggle('hidden', !r);
    if (r) { $('.l', el).textContent = 'Reviving ' + r.name + '…'; $('i.v', el).style.width = Math.min(100, r.p * 100) + '%'; }
  }

  hurtFlash() {
    const h = $('.hurt', this.hud);
    h.classList.add('on');
    clearTimeout(this.hurtT);
    this.hurtT = setTimeout(() => h.classList.remove('on'), 60);
  }

  toast(msg, kind = 'info', iconSrc) {
    if (!this.toastsEl) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.setProperty('--c', RCOL[kind] || 'var(--line)');
    if (RCOL[kind] && ['uncommon', 'rare', 'epic', 'gold'].includes(kind)) t.style.color = RCOL[kind];
    t.innerHTML = (iconSrc ? `<img src="${iconSrc}">` : '') + esc(msg);
    this.toastsEl.appendChild(t);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
  }

  banner(title, sub, boss) {
    if (!this.hud) return;
    const old = $('.bigbanner', this.hud);
    if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'bigbanner' + (boss ? ' boss' : '');
    b.innerHTML = `<div class="t">${esc(title)}</div><div class="s">${esc(sub || '')}</div>`;
    this.hud.appendChild(b);
    setTimeout(() => { b.style.transition = 'opacity .5s'; b.style.opacity = 0; setTimeout(() => b.remove(), 500); }, boss ? 3000 : 2000);
  }

  levelUp(lv) {
    const el = document.createElement('div');
    el.className = 'levelup';
    el.innerHTML = `<div class="t">LEVEL ${lv}!</div><div style="text-shadow:0 2px 0 var(--ink)">Your stats grow stronger</div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, 2000);
    net.hello({ name: G.save.name, cls: G.save.cls, lvl: lv, look: G.save.look });
    save();
  }

  /* ============================== CHAT ============================== */

  openChat() {
    if (!G.online) { this.toast('Chat needs the multiplayer server (Settings).', 'warn'); return; }
    if (this.chatOpen) return;
    this.chatOpen = true;
    const box = document.createElement('div');
    box.id = 'chatbox';
    box.className = 'frame';
    box.innerHTML = `<input class="field" maxlength="120" placeholder="Say something…"><button class="btn gold small">Send</button>`;
    this.hud.appendChild(box);
    const inp = $('input', box);
    inp.focus();
    const close = () => { this.chatOpen = false; box.remove(); };
    const send = () => { const m = inp.value.trim(); if (m) net.send({ t: 'chat', m }); close(); };
    $('button', box).onclick = send;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); if (e.key === 'Escape') close(); e.stopPropagation(); });
    inp.addEventListener('blur', () => setTimeout(() => { if (this.chatOpen && document.activeElement !== inp) close(); }, 150));
  }
  chatLine(name, msg, mine) {
    const log = $('#chatlog', this.hud);
    if (!log) return;
    const d = document.createElement('div');
    if (mine) d.className = 'me';
    d.innerHTML = `<b>${esc(name)}:</b> ${esc(msg)}`;
    log.appendChild(d);
    while (log.children.length > 6) log.firstChild.remove();
    setTimeout(() => { d.style.transition = 'opacity 1s'; d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 12000);
  }

  /* ============================== DIALOG ============================== */

  talkTo(npc) {
    this.closePanel();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.background = 'rgba(9,6,20,.25)';
    ov.style.alignItems = 'flex-end';
    const roleBtn = {
      blacksmith: ['Open Forge', 'smith'], store: ['Browse Store', 'store'], enchanter: ['Enchant Gear', 'enchanter'],
      tavern: ['Order a Meal', 'tavern'], guild: ['Guild Board', 'guild'], king: ['Royal Decrees', 'king'], advisor: ['Royal Decrees', 'king'],
    }[npc.role];
    ov.innerHTML = `<div class="dlg frame gold"><div class="face"><canvas width="64" height="64"></canvas></div><div style="flex:1;min-width:0"><div class="who">${esc(npc.name)}</div><div class="txt"></div><div class="acts">${roleBtn ? `<button class="btn gold small" data-a="${roleBtn[1]}">${roleBtn[0]}</button>` : ''}<button class="btn small" data-a="bye">Goodbye</button></div></div></div>`;
    document.body.appendChild(ov);
    const look = npc.look || NPC_LOOKS[npc.id] || NPC_LOOKS.villagerA;
    drawFrame($('canvas', ov), sheetCanvas('npc_' + npc.id, look), 0);
    const txt = $('.txt', ov);
    let i = 0;
    const line = npc.line || '…';
    const tick = setInterval(() => { i += 2; txt.textContent = line.slice(0, i); if (i >= line.length) clearInterval(tick); }, 22);
    this.panel = { el: ov, close: () => { clearInterval(tick); ov.remove(); } };
    ov.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) { if (i < line.length) { i = line.length; txt.textContent = line; } return; }
      sfx.ui();
      if (a === 'bye') this.closePanel();
      else this.openPanel(a);
    });
  }

  /* ============================== PANELS ============================== */

  closePanel() {
    if (!this.panel) return;
    this.panel.close();
    this.panel = null;
  }

  confirm(title, html, yes) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.zIndex = 60;
    ov.innerHTML = `<div class="panel frame gold" style="width:min(420px,100%)"><div class="head"><h3>${esc(title)}</h3></div><div class="body"><div class="note" style="font-size:14px;color:var(--text)">${html}</div></div><div class="foot"><button class="btn small" data-a="no">Cancel</button><button class="btn gold small" data-a="yes">Confirm</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      sfx.ui();
      ov.remove();
      if (a === 'yes') yes();
    });
  }

  openPanel(kind, opts = {}) {
    this.closePanel();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    const p = document.createElement('div');
    p.className = 'panel frame gold corner';
    ov.appendChild(p);
    document.body.appendChild(ov);
    G.input.mx = 0; G.input.my = 0;
    this.attackHeld = false;
    const state = { tab: opts.tab, sel: null };
    const self = this;
    const builders = {
      character: () => this.pCharacter(state),
      quests: () => this.pQuests(state),
      settings: () => this.pSettings(state),
      store: () => this.pStore(state),
      smith: () => this.pSmith(state),
      enchanter: () => this.pEnchanter(state),
      tavern: () => this.pTavern(state),
      guild: () => this.pGuild(state),
      king: () => this.pKing(state),
      portal: () => this.pPortal(state),
    };
    const re = () => {
      const res = builders[kind]();
      p.style.width = res.width || '';
      p.innerHTML = `<div class="head"><h3>${res.icon ? `<img src="${icon(res.icon)}">` : ''}${res.title}</h3>${res.money !== false ? `<div class="money"><span><img class="px" src="${COIN()}">${fmt(G.save?.gold || 0)}</span>${G.save?.ingots ? `<span><img class="px" src="${icon('ingot')}">${G.save.ingots}</span>` : ''}</div>` : ''}<button class="btn x" data-a="close">✕</button></div>${res.tabs ? `<div class="tabs">${res.tabs.map(([k, l]) => `<div class="tab ${state.tab === k ? 'on' : ''}" data-tab="${k}">${l}</div>`).join('')}</div>` : ''}<div class="body">${res.html}</div>${res.foot ? `<div class="foot">${res.foot}</div>` : ''}`;
      if (res.after) res.after(p);
    };
    this.panel = { el: ov, kind, re, close: () => ov.remove() };
    if (!state.tab) { const res = builders[kind](); if (res.tabs) state.tab = res.tabs[0][0]; }
    re();
    ov.addEventListener('click', (e) => {
      if (e.target === ov) { this.closePanel(); return; }
      const t = e.target.closest('[data-a],[data-tab],[data-sel]');
      if (!t) return;
      if (t.dataset.tab) { state.tab = t.dataset.tab; state.sel = null; sfx.ui(); re(); return; }
      if (t.dataset.sel !== undefined) { state.sel = t.dataset.sel; sfx.ui(); re(); return; }
      const a = t.dataset.a;
      if (a === 'close') { sfx.uiBack(); this.closePanel(); return; }
      sfx.ui();
      self.panelAction(kind, a, t.dataset, state);
      if (this.panel && this.panel.re === re) re();
    });
  }

  findItem(id) {
    const s = G.save;
    for (const slot of SLOTS) if (s.equip[slot] && s.equip[slot].id === id) return { item: s.equip[slot], where: 'equip', slot };
    const i = s.bag.findIndex((b) => b.id === id);
    if (i >= 0) return { item: s.bag[i], where: 'bag', index: i };
    return null;
  }

  slotHtml(item, selId, extra = '') {
    if (!item) return `<div class="slot" ${extra}></div>`;
    const dur = item.type === 'gear' ? `<div class="dur"><i style="width:${item.dur}%;background:${item.dur < 25 ? 'var(--hp)' : item.dur < 50 ? 'var(--warn)' : 'var(--good)'}"></i></div>` : '';
    return `<div class="slot r-${item.rarity || 'common'} ${selId === item.id ? 'sel' : ''}" data-sel="${item.id}"><img src="${this.iconFor(item)}">${item.qty > 1 ? `<span class="q">${item.qty}</span>` : ''}${item.up ? `<span class="q" style="color:var(--gold3);top:1px;bottom:auto">+${item.up}</span>` : ''}${dur}</div>`;
  }

  itemDetail(item, ctx) {
    if (!item) return `<div class="detail"><div class="note">Tap an item to inspect it.</div></div>`;
    const s = G.save;
    let st = '', meta = '', acts = '';
    if (item.type === 'gear') {
      meta = `${RARITY_NAME[item.rarity]} ${item.slot} · Lv ${item.level}${item.req > 1 ? ' · requires Lv ' + item.req : ''} · Durability ${Math.round(item.dur)}%`;
      if (item.atk) st += `<span>Attack <b>${item.atk}${item.up ? ' (+' + item.up * 8 + '%)' : ''}</b></span>`;
      if (item.def) st += `<span>Defense <b>${item.def}${item.up ? ' (+' + item.up * 8 + '%)' : ''}</b></span>`;
      if (item.hp) st += `<span>Max HP <b>+${item.hp}</b></span>`;
      if (item.mp) st += `<span>Max Mana <b>+${item.mp}</b></span>`;
      if (item.crit) st += `<span>Crit <b>+${(item.crit * 100).toFixed(1)}%</b></span>`;
      const perks = (item.perks || []).map((pid) => [...PERKS.weapon, ...PERKS.armor].find((p) => p.id === pid)).filter(Boolean);
      const slots = ENCHANT_SLOTS[item.rarity];
      st += slots ? `<div style="width:100%">${perks.map((p) => `<div class="perk">◆ ${p.name}: ${p.text}</div>`).join('')}${Array(Math.max(0, slots - perks.length)).fill('<div class="perk" style="color:var(--dim)">◇ Empty enchant slot</div>').join('')}</div>` : '';
      if (item.set && SETS[item.set]) st += `<div style="width:100%;color:var(--good);font-size:12px">${SETS[item.set].name} set · 2pc: ${SETS[item.set].twoText} · 4pc: ${SETS[item.set].fourText}</div>`;
      if (ctx.where === 'bag') acts += `<button class="btn gold small" data-a="equip" data-id="${item.id}" ${item.req > s.level ? 'disabled' : ''}>Equip</button>`;
      if (ctx.where === 'equip') acts += `<button class="btn small" data-a="unequip" data-id="${item.id}">Unequip</button>`;
      if (ctx.where === 'bag') acts += `<button class="btn small ghost" data-a="drop" data-id="${item.id}">Discard</button>`;
    } else if (item.type === 'treasure') {
      meta = `${RARITY_NAME[item.rarity]} Treasure · sell at the Village Store`;
      st = `<span>Value <b style="color:var(--gold3)">${fmt(item.value)}g</b></span>`;
    } else {
      const c = CONSUMABLES[item.key];
      meta = c.kind === 'meal' ? 'Tavern meal · one active per run' : c.kind === 'charm' ? 'Charm' : 'Combat potion';
      st = `<span>${c.desc}</span>`;
      if (c.kind === 'meal') acts += `<button class="btn gold small" data-a="eat" data-id="${item.id}">Eat${s.meal ? ' (replaces current)' : ''}</button>`;
    }
    return `<div class="detail"><div class="nm c-${item.rarity || 'common'}">${esc(item.name)}</div><div class="meta">${meta}</div><div class="st">${st}</div><div class="acts">${acts}</div></div>`;
  }

  heroCanvasAfter(p) {
    const cv = p.querySelector('.hero canvas');
    if (cv) this.animate(cv, humanSheet(lookFor(G.save.cls, G.save.look)).canvas(), [0, 0, 1, 1]);
  }

  pCharacter(state) {
    const s = G.save;
    const C = CLASSES[s.cls];
    const tabs = [['gear', 'Gear'], ['stats', 'Stats'], ['skills', 'Skills']];
    if (state.tab === 'stats') {
      const st = derive(s.cls, s.level, gearTotals(s), {});
      const gt = gearTotals(s);
      const sets = Object.entries(gt.sets || {}).map(([k, n]) => `${SETS[k]?.name} ${n}/4`).join(', ') || 'none';
      return {
        title: `${esc(s.name)} · ${C.name} Lv ${s.level}`, icon: CLASS_ICON[s.cls], tabs,
        html: `<div class="cols"><div><div class="lbl">Attributes</div>${ATTRS.map((a) => `<div class="statrow" title="${ATTR_INFO[a]}"><span>${a}</span><div class="statbar"><i style="width:${Math.min(100, st.attrs[a] * 1.6)}%"></i></div><span>${st.attrs[a]}</span></div>`).join('')}<div class="note">${C.archetype} archetype · ${C.role}</div></div>
          <div><div class="lbl">Combat</div><div class="statlist">
            <span>Max HP</span><span>${st.maxHp}</span><span>${C.resource === 'scrap' ? 'Scrap cap' : 'Max Mana'}</span><span>${st.maxMp}</span>
            <span>Attack</span><span>${Math.round(st.atk)}</span><span>Spell Power</span><span>${Math.round(st.spell)}</span>
            <span>Defense</span><span>${Math.round(st.def)} (${Math.round(st.mitigation * 100)}% mitigation)</span>
            <span>Crit chance</span><span>${(st.crit * 100).toFixed(1)}%</span><span>Move speed</span><span>${st.speed.toFixed(2)}</span>
            <span>Poison resist</span><span>${Math.round(st.poisonRes * 100)}%</span><span>Set pieces</span><span>${sets}</span>
            <span>Mastery Seals</span><span>${s.seals}</span><span>Bosses slain</span><span>${s.stats.bosses}</span>
            <span>Dungeon clears</span><span>${s.stats.clears}</span><span>Snakes slain</span><span>${s.stats.snakes}</span>
          </div></div></div>`,
      };
    }
    if (state.tab === 'skills') {
      return {
        title: 'Skills & Mastery', icon: 'star', tabs,
        html: `<div class="lbl">Active skills</div><div class="list">${C.skills.map((k) => `<div class="li"><img src="${icon(k.icon)}"><div class="grow"><div class="t">${k.name}</div><div class="d">${k.desc}</div></div><div class="price" style="color:${C.resource === 'scrap' ? '#8ff0c6' : '#8fc6ff'}">${k.cost} ${C.resource === 'scrap' ? 'Scrap' : 'MP'} · ${k.cd}s</div></div>`).join('')}
          <div class="li"><img src="${icon('dash')}"><div class="grow"><div class="t">Dodge Roll</div><div class="d">Roll with invincibility frames. Use it to pass through boss sweeps.</div></div><div class="price">1.1s</div></div></div>
          <div class="lbl">Specialization paths</div><div class="choice">${C.paths.map((pth) => `<div class="opt"><b style="color:var(--pink)">${pth.name}</b><small>${pth.desc}</small><div class="note">5 tiers · 10 nodes · King's Capstone needs a Mastery Seal</div></div>`).join('')}</div>
          <div class="note">Skill trees open in the next update. You earn 1 skill point per level (30 at max level); investing in Tier 2 of a path locks the other two.</div>`,
      };
    }
    const sel = state.sel ? this.findItem(state.sel) : null;
    const eq = (slot) => s.equip[slot] ? this.slotHtml(s.equip[slot], state.sel) : `<div class="slot"><img class="ghost" src="${icon(slot === 'weapon' ? CLASS_WEAPON_ICON[s.cls] : SLOT_ICON[slot])}"></div>`;
    return {
      title: 'Hero', icon: 'bag', tabs,
      html: `<div class="cols"><div><div class="equipgrid">
          ${eq('helmet')}<div class="hero"><canvas width="64" height="64"></canvas></div>${eq('weapon')}
          ${eq('chest')}${eq('greaves')}
          ${eq('boots')}<div class="slot" style="opacity:.6" title="Active meal">${s.meal ? `<img src="${icon(CONSUMABLES[s.meal].icon)}">` : `<img class="ghost" src="${icon('meat')}">`}</div>
        </div>${this.itemDetail(sel?.item, sel || {})}</div>
        <div><div class="lbl">Bag ${s.bag.length}/${BAG_SIZE}</div><div class="bag">${s.bag.map((it) => this.slotHtml(it, state.sel)).join('')}${Array(Math.max(0, 15 - s.bag.length)).fill('<div class="slot"></div>').join('')}</div></div></div>`,
      after: (p) => this.heroCanvasAfter(p),
    };
  }

  pQuests() {
    const s = G.save;
    const rows = [];
    for (const b of BOUNTIES) { const st = s.bounties[b.id]; if (st) rows.push({ q: b, st, kind: 'Bounty' }); }
    for (const d of DECREES) { const st = s.decrees[d.id]; if (st) rows.push({ q: d, st, kind: 'Royal Decree' }); }
    if (s.crusade) { const c = CRUSADES.find((x) => x.id === s.crusade.id); if (c) rows.push({ q: c, st: s.crusade, kind: "King's Crusade" }); }
    return {
      title: 'Quest Log', icon: 'scroll',
      html: rows.length ? `<div class="list">${rows.map(({ q, st, kind }) => `<div class="li"><img src="${icon(st.done ? 'star' : 'scroll')}"><div class="grow"><div class="t">${q.name} <small style="color:var(--dim)">· ${kind}</small></div><div class="d">${q.text}</div><div class="prog"><i style="width:${(st.p / q.goal) * 100}%"></i></div></div><div class="price">${st.done ? '<span style="color:var(--good)">Done!</span>' : `${fmt(st.p)}/${fmt(q.goal)}`}</div></div>`).join('')}</div>`
        : `<div class="note" style="font-size:14px">No active quests. Visit the <b>Guild Board</b> by the fountain for bounties, or the <b>King</b> in the castle for Royal Decrees.</div>`,
    };
  }

  pSettings() {
    const st = G.settings;
    return {
      title: 'Settings', icon: 'gear', money: false,
      html: `<div class="lbl">Multiplayer server</div>
        <div class="row"><input class="field" data-k="server" placeholder="${DEFAULT_SERVER}" value="${esc(st.server || '')}" style="flex:1"><button class="btn small gold" data-a="saveServer">Connect</button></div>
        <div class="note">Paste your Render URL (like https://bright-hearts-rpg-server.onrender.com). Leave empty for the default. Status: <b>${G.online ? 'online' : 'offline'}</b></div>
        <div class="lbl">Audio</div>
        <div class="row"><span style="width:60px">Music</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-k="music" style="flex:1"></div>
        <div class="row"><span style="width:60px">Effects</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-k="sfx" style="flex:1"></div>
        <div class="lbl">Display</div>
        <div class="row"><div class="chip ${st.shake ? 'on' : ''}" data-a="toggle" data-k="shake">Screen shake</div><div class="chip ${st.lowFx ? 'on' : ''}" data-a="toggle" data-k="lowFx">Battery saver FX</div></div>
        <div class="lbl">About</div>
        <div class="note">Bright Hearts RPG v${VERSION} · made by <a href="${GITHUB}" target="_blank" rel="noopener" style="color:var(--gold)">${CREDIT}</a>. All pixel art is generated in-game.</div>
        ${G.save ? `<div class="lbl">Danger zone</div><button class="btn small ghost" data-a="wipeSave">Delete hero on this device</button>` : ''}`,
      after: (p) => {
        for (const r of p.querySelectorAll('input[type=range]')) r.addEventListener('input', () => { st[r.dataset.k] = +r.value; saveSettings(st); setVolumes(st); });
      },
    };
  }

  pStore(state) {
    const s = G.save;
    const tabs = [['buy', 'Buy'], ['sell', 'Market Counter']];
    if (state.tab === 'sell') {
      const treasures = s.bag.filter((b) => b.type === 'treasure');
      const gear = s.bag.filter((b) => b.type === 'gear');
      const total = treasures.reduce((a, b) => a + b.value, 0);
      return {
        title: "Mira's Village Store", icon: 'coins', tabs,
        html: `<div class="note">Treasures from jars, crates, chests and monsters are worth Gold here.</div>
          <div class="list">${treasures.map((t) => `<div class="li"><img src="${this.iconFor(t)}"><div class="grow"><div class="t c-${t.rarity}">${esc(t.name)}</div></div><div class="price"><img src="${COIN()}">${fmt(t.value)}</div><button class="btn small" data-a="sell" data-id="${t.id}">Sell</button></div>`).join('') || '<div class="note">No Treasures yet. Smash everything in the dungeon!</div>'}
          ${gear.length ? '<div class="lbl">Gear (smelting at the Blacksmith gives Ingots instead)</div>' : ''}
          ${gear.map((t) => `<div class="li"><img src="${this.iconFor(t)}"><div class="grow"><div class="t c-${t.rarity}">${esc(t.name)}</div><div class="d">${RARITY_NAME[t.rarity]} ${t.slot}</div></div><div class="price"><img src="${COIN()}">${sellValue(t)}</div><button class="btn small" data-a="sell" data-id="${t.id}">Sell</button></div>`).join('')}</div>`,
        foot: treasures.length ? `<button class="btn gold" data-a="sellAll">Sell All Treasures · ${fmt(total)}g</button>` : '',
      };
    }
    return {
      title: "Mira's Village Store", icon: 'coins', tabs,
      html: `<div class="list">${STORE_STOCK.filter((k) => CONSUMABLES[k].kind !== 'meal').map((k) => { const c = CONSUMABLES[k]; return `<div class="li"><img src="${icon(c.icon)}"><div class="grow"><div class="t">${c.name} <small style="color:var(--dim)">· owned ${countItem(k)}</small></div><div class="d">${c.desc}</div></div><div class="price"><img src="${COIN()}">${c.price}</div><button class="btn small gold" data-a="buy" data-k="${k}" ${s.gold < c.price ? 'disabled' : ''}>Buy</button></div>`; }).join('')}</div>
        <div class="note">Two potion slots share a 15s cooldown. Tap the potion button in combat; it uses a Purge Tonic first if you are poisoned.</div>`,
    };
  }

  pTavern() {
    const s = G.save;
    const meals = STORE_STOCK.filter((k) => CONSUMABLES[k].kind === 'meal');
    return {
      title: "Gus's Tavern", icon: 'meat',
      html: `<div class="note">One meal at a time. It lasts for your next dungeon run and is lost if your party wipes. Current: <b style="color:var(--gold3)">${s.meal ? CONSUMABLES[s.meal].name : 'nothing'}</b></div>
        <div class="list">${meals.map((k) => { const c = CONSUMABLES[k]; return `<div class="li"><img src="${icon(c.icon)}"><div class="grow"><div class="t">${c.name}</div><div class="d">${c.desc}</div></div><div class="price"><img src="${COIN()}">${c.price}</div><button class="btn small gold" data-a="meal" data-k="${k}" ${s.gold < c.price ? 'disabled' : ''}>Eat</button></div>`; }).join('')}
        <div class="li"><img src="${icon('feast')}"><div class="grow"><div class="t">The King's Banquet</div><div class="d">Raid feast for a party run: everyone gets +10% to all stats. ${s.banquet ? '<b style="color:var(--good)">Ready for your next party raid!</b>' : ''}</div></div><div class="price"><img src="${COIN()}">1500</div><button class="btn small gold" data-a="banquet" ${s.gold < 1500 || s.banquet ? 'disabled' : ''}>Order</button></div></div>`,
    };
  }

  pSmith(state) {
    const s = G.save;
    const tabs = [['repair', 'Repair'], ['smelt', 'Smelt'], ['upgrade', 'Upgrade']];
    const equipped = SLOTS.map((k) => s.equip[k]).filter(Boolean);
    if (state.tab === 'smelt') {
      const fodder = s.bag.filter((b) => b.type === 'gear' && (b.rarity === 'common' || b.rarity === 'uncommon'));
      return {
        title: "Brann's Forge", icon: 'anvilI', tabs,
        html: `<div class="note">Smelt unwanted Common and Uncommon gear into <b>Forged Ingots</b>, the one universal crafting material. Epic and King's Gold gear is Smelt-Locked for safety.</div>
          <div class="list">${fodder.map((t) => `<div class="li"><img src="${this.iconFor(t)}"><div class="grow"><div class="t c-${t.rarity}">${esc(t.name)}</div><div class="d">${RARITY_NAME[t.rarity]} ${t.slot} · Lv ${t.level}</div></div><div class="price"><img src="${icon('ingot')}">${t.rarity === 'uncommon' ? 2 : 1}</div><button class="btn small" data-a="smelt" data-id="${t.id}">Smelt</button></div>`).join('') || '<div class="note">Nothing to smelt in your bag.</div>'}</div>`,
        foot: fodder.length ? `<button class="btn gold" data-a="smeltAll">Smelt all (${fodder.reduce((a, b) => a + (b.rarity === 'uncommon' ? 2 : 1), 0)} Ingots)</button>` : '',
      };
    }
    if (state.tab === 'upgrade') {
      return {
        title: "Brann's Forge", icon: 'anvilI', tabs,
        html: `<div class="note">Each upgrade adds +8% base Attack or Defense without raising the equip level. Max +5.</div><div class="list">${equipped.map((t) => { const g = 80 * (t.up + 1) * (1 + t.level * 0.2), ing = 1 + t.up * 2; return `<div class="li"><img src="${this.iconFor(t)}"><div class="grow"><div class="t c-${t.rarity}">${esc(t.name)} ${t.up ? '+' + t.up : ''}</div><div class="d">${t.atk ? 'ATK ' + t.atk : 'DEF ' + t.def}</div></div><div class="price"><img src="${COIN()}">${Math.round(g)} <img src="${icon('ingot')}">${ing}</div><button class="btn small gold" data-a="upgrade" data-id="${t.id}" ${t.up >= 5 || s.gold < g || s.ingots < ing ? 'disabled' : ''}>${t.up >= 5 ? 'Max' : 'Upgrade'}</button></div>`; }).join('') || '<div class="note">Equip some gear first.</div>'}</div>`,
      };
    }
    const total = equipped.reduce((a, t) => a + repairCost(t), 0);
    return {
      title: "Brann's Forge", icon: 'anvilI', tabs,
      html: `<div class="note">Gear never breaks for good, but below 50% durability it loses 25% of its stats, and at 0% it is <b>Blunted</b> (-75%, enchants disabled). Party wipes cost 15% durability.</div>
        <div class="list">${equipped.map((t) => `<div class="li"><img src="${this.iconFor(t)}"><div class="grow"><div class="t c-${t.rarity}">${esc(t.name)}</div><div class="prog"><i style="width:${t.dur}%;background:${t.dur < 50 ? 'var(--warn)' : 'var(--good)'}"></i></div></div><div class="price">${Math.round(t.dur)}%</div><button class="btn small" data-a="repair" data-id="${t.id}" ${t.dur >= 100 || s.gold < repairCost(t) ? 'disabled' : ''}>${repairCost(t)}g</button></div>`).join('')}</div>`,
      foot: `<button class="btn gold" data-a="repairAll" ${!total || s.gold < total ? 'disabled' : ''}>Repair all · ${total}g</button>`,
    };
  }

  pEnchanter(state) {
    const s = G.save;
    const items = [...SLOTS.map((k) => s.equip[k]).filter(Boolean), ...s.bag.filter((b) => b.type === 'gear')].filter((t) => ENCHANT_SLOTS[t.rarity] > 0);
    const sel = items.find((t) => t.id === state.sel) || items[0];
    let detail = '<div class="note">Uncommon or better gear has enchant slots. Bring some back from the ruins!</div>';
    if (sel) {
      sel.locks = sel.locks || [];
      const pool = sel.slot === 'weapon' ? PERKS.weapon : PERKS.armor;
      const n = ENCHANT_SLOTS[sel.rarity];
      const cost = Math.round(120 * (1 + ['uncommon', 'rare', 'epic', 'gold'].indexOf(sel.rarity) * 0.8));
      const ing = 2 + sel.locks.filter(Boolean).length;
      detail = `<div class="lbl">${esc(sel.name)}</div><div class="list">${Array.from({ length: n }, (_, i) => { const pk = pool.find((p) => p.id === (sel.perks || [])[i]); return `<div class="li"><img src="${icon(sel.locks[i] ? 'lock' : 'magic')}"><div class="grow"><div class="t">${pk ? pk.name : '<span style="color:var(--dim)">Empty slot</span>'}</div><div class="d">${pk ? pk.text : 'Roll to imbue a perk'}</div></div>${pk ? `<div class="chip ${sel.locks[i] ? 'on' : ''}" data-a="lock" data-id="${sel.id}" data-i="${i}">${sel.locks[i] ? 'Locked' : 'Lock (+1 ingot)'}</div>` : ''}</div>`; }).join('')}</div>
        <div class="row" style="margin-top:10px;justify-content:flex-end"><span class="money"><span><img src="${COIN()}">${cost}</span><span><img src="${icon('ingot')}">${ing}</span></span><button class="btn pink" data-a="roll" data-id="${sel.id}" ${s.gold < cost || s.ingots < ing ? 'disabled' : ''}>Roll Perks</button></div>`;
    }
    return {
      title: "Ysolde's Enchanting", icon: 'magic',
      html: `<div class="cols"><div><div class="lbl">Your enchantable gear</div><div class="bag">${items.map((t) => this.slotHtml(t, sel?.id)).join('') || '<div class="note">None yet.</div>'}</div></div><div>${detail}</div></div><div class="note">Respeccing a locked skill tree will also be done here (Gold + Ingots) once skill trees arrive.</div>`,
    };
  }

  pGuild() {
    const s = G.save;
    const active = Object.values(s.bounties).filter((b) => !b.claimed).length;
    return {
      title: 'Guild Board', icon: 'scroll',
      html: `<div class="note">Take up to 3 bounties at a time. Party up at the <b>Dungeon Portal</b> by sharing a Room Code with friends.</div>
        <div class="list">${BOUNTIES.map((b) => { const st = s.bounties[b.id]; let btn; if (!st || st.claimed) btn = `<button class="btn small gold" data-a="accept" data-id="${b.id}" ${active >= 3 ? 'disabled' : ''}>Accept</button>`; else if (st.done) btn = `<button class="btn small pink" data-a="claim" data-id="${b.id}">Claim</button>`; else btn = `<span class="price">${st.p}/${b.goal}</span>`; return `<div class="li"><img src="${icon(st?.done ? 'star' : 'scroll')}"><div class="grow"><div class="t">${b.name}</div><div class="d">${b.text} · <span style="color:var(--gold3)">${b.gold}g</span> · ${b.xp} XP</div>${st && !st.claimed ? `<div class="prog"><i style="width:${(st.p / b.goal) * 100}%"></i></div>` : ''}</div>${btn}</div>`; }).join('')}</div>`,
    };
  }

  pKing() {
    const s = G.save;
    const decreeActive = Object.values(s.decrees).some((d) => !d.claimed);
    return {
      title: "King's Castle", icon: 'crown',
      html: `<div class="note">You hold one <b>Solo Slot</b> (Royal Decree) and one <b>Party Slot</b> (King's Crusade). Decrees reward Mastery Seals, needed for Tier-5 King's Capstones. Seals: <b style="color:var(--gold3)">${s.seals}</b></div>
        <div class="lbl">Royal Decrees · solo</div>
        <div class="list">${DECREES.map((d) => { const st = s.decrees[d.id]; let btn; if (!st || st.claimed) btn = `<button class="btn small gold" data-a="decree" data-id="${d.id}" ${decreeActive ? 'disabled' : ''}>Accept</button>`; else if (st.done) btn = `<button class="btn small pink" data-a="claimDecree" data-id="${d.id}">Claim</button>`; else btn = `<span class="price">${fmt(st.p)}/${fmt(d.goal)}</span>`; return `<div class="li"><img src="${icon('crown')}"><div class="grow"><div class="t">${d.name}</div><div class="d">${d.text} · ${fmt(d.gold)}g · ${d.ingots} Ingots · Mastery Seal</div>${st && !st.claimed ? `<div class="prog"><i style="width:${(st.p / d.goal) * 100}%"></i></div>` : ''}</div>${btn}</div>`; }).join('')}</div>
        <div class="lbl">King's Crusade · party</div>
        <div class="list">${CRUSADES.map((c) => { const st = s.crusade && s.crusade.id === c.id ? s.crusade : null; let btn; if (!st) btn = `<button class="btn small gold" data-a="crusade" data-id="${c.id}" ${s.crusade && !s.crusade.claimed ? 'disabled' : ''}>Accept</button>`; else if (st.done && !st.claimed) btn = `<button class="btn small pink" data-a="claimCrusade">Claim</button>`; else btn = `<span class="price">${fmt(st.p)}/${fmt(c.goal)}</span>`; return `<div class="li"><img src="${icon('scepter')}"><div class="grow"><div class="t">${c.name}</div><div class="d">${c.text} Kills by any teammate in your dungeon count. · ${fmt(c.gold)}g · ${c.ingots} Ingots · double XP</div>${st ? `<div class="prog"><i style="width:${(st.p / c.goal) * 100}%"></i></div>` : ''}</div>${btn}</div>`; }).join('')}</div>`,
    };
  }

  pPortal(state) {
    const s = G.save;
    state.dg = state.dg || 'ruins';
    state.diff = state.diff || 'normal';
    const party = G.party;
    const isHost = party && party.host === net.id;
    const dungeons = Object.entries(DUNGEONS).map(([k, d]) => `<div class="opt ${state.dg === k ? 'on' : ''} ${d.unlocked ? '' : 'lock'}" data-a="pickDg" data-k="${k}"><b>${d.name}</b><small>${d.unlocked ? 'Snakes, mandrakes, tortoises · Boss: Three-Headed Snake' : 'Coming in a future update'}</small></div>`).join('');
    const diffs = Object.entries(DIFFICULTY).map(([k, d]) => `<div class="opt ${state.diff === k ? 'on' : ''} ${s.level >= d.minLevel ? '' : 'lock'}" data-a="pickDiff" data-k="${k}"><b>${d.name}</b><small>${s.level >= d.minLevel ? `Enemy HP x${d.hp}` : 'Requires Lv ' + d.minLevel}</small></div>`).join('');
    let partyHtml;
    if (!G.online) partyHtml = `<div class="note">You are offline, so raids are solo. Set up the multiplayer server in <b>Settings</b> to party up with friends.</div>`;
    else if (!party || !party.code) partyHtml = `<div class="row"><button class="btn gold" data-a="pcreate">Create Party</button><input class="field" data-k="code" maxlength="4" placeholder="CODE" style="width:110px;text-transform:uppercase;text-align:center;letter-spacing:4px"><button class="btn" data-a="pjoin">Join</button></div><div class="note">Share your 4-letter Room Code with friends. Up to 10 heroes per raid; enemies scale with party size.</div>`;
    else partyHtml = `<div class="row" style="align-items:stretch"><div class="code" style="flex:1">${party.code}</div><button class="btn small ghost" data-a="pleave">Leave</button></div>
        <div class="members">${party.members.map((m) => `<div class="member"><img src="${icon(CLASS_ICON[m.cls] || 'sword')}"><div><div>${esc(m.name)}</div><div class="host">${m.id === party.host ? '★ host' : 'Lv ' + (m.lvl || 1)}</div></div></div>`).join('')}</div>
        <div class="note">${isHost ? 'You are the host. Start when everyone is in.' : 'Waiting for the host to open the portal…'}</div>`;
    return {
      title: 'Dungeon Portal', icon: 'map',
      html: `<div class="lbl">Dungeon</div><div class="choice">${dungeons}</div><div class="lbl">Difficulty</div><div class="choice">${diffs}</div>
        <div class="lbl">Party ${party && party.code ? `· ${party.members.length}/10` : ''}</div>${partyHtml}
        <div class="note">Meal: <b style="color:var(--gold3)">${s.meal ? CONSUMABLES[s.meal].name : 'none'}</b> · Vials: ${countItem('vial1') + countItem('vial2') + countItem('vial3')} · Tonics: ${countItem('purge')}</div>`,
      foot: party && party.code ? (isHost ? `<button class="btn gold" data-a="startParty">Open Portal · ${party.members.length} hero${party.members.length > 1 ? 'es' : ''}</button>` : '') : `<button class="btn gold" data-a="startSolo">Enter Solo</button>`,
    };
  }

  panelAction(kind, a, d, state) {
    const s = G.save;
    const it = d.id ? this.findItem(d.id) : null;
    const refreshStats = () => { if (G.scene?.combat) G.scene.combat.refreshStats(false); save(); this.hudCache = {}; };
    switch (a) {
      case 'equip': {
        if (!it || it.where !== 'bag') return;
        const item = it.item;
        const old = s.equip[item.slot];
        s.bag.splice(it.index, 1);
        if (old) s.bag.push(old);
        s.equip[item.slot] = item;
        state.sel = item.id;
        refreshStats();
        break;
      }
      case 'unequip': {
        if (!it || it.where !== 'equip') return;
        if (s.bag.length >= BAG_SIZE) { this.toast('Bag is full!', 'warn'); return; }
        s.bag.push(it.item); s.equip[it.slot] = null; refreshStats();
        break;
      }
      case 'drop': if (it && it.where === 'bag') { s.bag.splice(it.index, 1); state.sel = null; save(); } break;
      case 'eat': if (it) { s.meal = it.item.key; it.item.qty--; if (it.item.qty <= 0) s.bag.splice(it.index, 1); this.toast('Ate ' + CONSUMABLES[s.meal].name, 'info'); save(); } break;
      case 'buy': {
        const c = CONSUMABLES[d.k];
        if (s.gold < c.price) return;
        if (addItem(makeConsumable(d.k, 1))) { s.gold -= c.price; sfx.coin(); save(); }
        break;
      }
      case 'meal': {
        const c = CONSUMABLES[d.k];
        if (s.gold < c.price) return;
        s.gold -= c.price; s.meal = d.k; sfx.coin(); this.toast(`${c.name} eaten. Bonus active for your next run.`, 'info'); save();
        break;
      }
      case 'banquet': if (s.gold >= 1500) { s.gold -= 1500; s.banquet = true; sfx.coin(); save(); } break;
      case 'sell': {
        if (!it || it.where !== 'bag') return;
        s.gold += sellValue(it.item); s.bag.splice(it.index, 1); sfx.coin(); save();
        break;
      }
      case 'sellAll': {
        const tr = s.bag.filter((b) => b.type === 'treasure');
        const total = tr.reduce((x, b) => x + b.value, 0);
        s.bag = s.bag.filter((b) => b.type !== 'treasure');
        s.gold += total; sfx.epic(); this.toast(`Sold ${tr.length} Treasures for ${fmt(total)} Gold!`, 'gold'); save();
        break;
      }
      case 'repair': if (it && s.gold >= repairCost(it.item)) { s.gold -= repairCost(it.item); it.item.dur = 100; sfx.coin(); refreshStats(); } break;
      case 'repairAll': {
        for (const t of SLOTS.map((k) => s.equip[k]).filter(Boolean)) { const c = repairCost(t); if (s.gold >= c) { s.gold -= c; t.dur = 100; } }
        sfx.coin(); refreshStats();
        break;
      }
      case 'smelt': if (it && it.where === 'bag') { s.ingots += it.item.rarity === 'uncommon' ? 2 : 1; s.bag.splice(it.index, 1); sfx.break(); save(); } break;
      case 'smeltAll': {
        const f = s.bag.filter((b) => b.type === 'gear' && (b.rarity === 'common' || b.rarity === 'uncommon'));
        s.ingots += f.reduce((x, b) => x + (b.rarity === 'uncommon' ? 2 : 1), 0);
        s.bag = s.bag.filter((b) => !f.includes(b)); sfx.break(); save();
        break;
      }
      case 'upgrade': {
        if (!it) return;
        const t = it.item; const g = Math.round(80 * (t.up + 1) * (1 + t.level * 0.2)), ing = 1 + t.up * 2;
        if (t.up >= 5 || s.gold < g || s.ingots < ing) return;
        s.gold -= g; s.ingots -= ing; t.up++; sfx.loot(); this.toast(`${t.name} upgraded to +${t.up}!`, t.rarity); refreshStats();
        break;
      }
      case 'lock': { if (!it) return; const t = it.item; t.locks = t.locks || []; t.locks[+d.i] = !t.locks[+d.i]; break; }
      case 'roll': {
        if (!it) return;
        const t = it.item; t.locks = t.locks || []; t.perks = t.perks || [];
        const pool = t.slot === 'weapon' ? PERKS.weapon : PERKS.armor;
        const cost = Math.round(120 * (1 + ['uncommon', 'rare', 'epic', 'gold'].indexOf(t.rarity) * 0.8));
        const ing = 2 + t.locks.filter(Boolean).length;
        if (s.gold < cost || s.ingots < ing) return;
        s.gold -= cost; s.ingots -= ing;
        const n = ENCHANT_SLOTS[t.rarity];
        for (let i = 0; i < n; i++) {
          if (t.locks[i] && t.perks[i]) continue;
          const options = pool.filter((p) => !t.perks.includes(p.id) || t.perks[i] === p.id);
          t.perks[i] = options[Math.floor(Math.random() * options.length)].id;
        }
        state.sel = t.id;
        sfx.magic(); refreshStats();
        break;
      }
      case 'accept': s.bounties[d.id] = { p: 0, done: false }; save(); break;
      case 'claim': {
        const b = BOUNTIES.find((x) => x.id === d.id); const st = s.bounties[d.id];
        if (!b || !st?.done) return;
        s.gold += b.gold; st.claimed = true; delete s.bounties[d.id]; sfx.epic();
        addXp(b.xp);
        this.toast(`${b.name}: +${b.gold}g, +${b.xp} XP`, 'gold'); save();
        break;
      }
      case 'decree': s.decrees[d.id] = { p: 0, done: false }; save(); break;
      case 'claimDecree': {
        const q = DECREES.find((x) => x.id === d.id); const st = s.decrees[d.id];
        if (!q || !st?.done) return;
        s.gold += q.gold; s.ingots += q.ingots; s.seals++; delete s.decrees[d.id]; sfx.epic();
        this.toast(`The King grants you a Mastery Seal!`, 'gold'); save();
        break;
      }
      case 'crusade': s.crusade = { id: d.id, p: 0, done: false }; save(); break;
      case 'claimCrusade': {
        const c = CRUSADES.find((x) => x.id === s.crusade?.id);
        if (!c || !s.crusade.done) return;
        s.gold += c.gold; s.ingots += c.ingots; s.crusade = null; sfx.epic(); this.toast('Crusade rewards claimed!', 'gold'); save();
        break;
      }
      case 'pickDg': state.dg = d.k; break;
      case 'pickDiff': state.diff = d.k; break;
      case 'pcreate': net.send({ t: 'pcreate' }); break;
      case 'pjoin': {
        const code = (this.panel.el.querySelector('[data-k=code]')?.value || '').trim().toUpperCase();
        if (code.length !== 4) { this.toast('Room Codes have 4 letters', 'warn'); return; }
        net.send({ t: 'pjoin', code });
        break;
      }
      case 'pleave': net.send({ t: 'pleave' }); G.party = null; break;
      case 'startSolo': this.startRun({ dungeon: state.dg, diff: state.diff, seed: (Math.random() * 1e9) | 0, size: 1, online: false }); break;
      case 'startParty': net.send({ t: 'pstart', dungeon: state.dg, diff: state.diff, seed: (Math.random() * 1e9) | 0 }); break;
      case 'saveServer': {
        const v = this.panel.el.querySelector('[data-k=server]').value.trim();
        G.settings.server = v; saveSettings(G.settings);
        net.ws && net.ws.close();
        net.connect(v || DEFAULT_SERVER);
        this.toast('Connecting to ' + (v || 'default server') + '…', 'info');
        break;
      }
      case 'toggle': G.settings[d.k] = !G.settings[d.k]; saveSettings(G.settings); break;
      case 'wipeSave': this.confirm('Delete hero?', 'This permanently deletes <b>' + esc(s.name) + '</b> from this device.', () => { deleteSave(); location.reload(); }); break;
      default: break;
    }
  }

  /* ============================== PARTY ============================== */

  onParty(m) {
    if (!m.code) { G.party = null; } else G.party = m;
    if (this.panel?.kind === 'portal') this.panel.re();
    else if (m.code && m.members && G.zone !== 'dungeon') this.toast(`Party ${m.code}: ${m.members.length} hero${m.members.length > 1 ? 'es' : ''}`, 'info');
  }

  onPartyStart(m) {
    if (G.zone === 'dungeon') return;
    this.closePanel();
    let n = 3;
    this.banner('Portal opening', 'Raid starts in ' + n + '…', true);
    const iv = setInterval(() => {
      n--;
      if (n > 0) this.banner('Portal opening', 'Raid starts in ' + n + '…', true);
      else { clearInterval(iv); this.startRun({ dungeon: m.dungeon, diff: m.diff, seed: m.seed, size: m.size, online: true, host: m.host }); }
    }, 900);
  }

  startRun(run) {
    const s = G.save;
    if (s.banquet && run.size > 1) { run.banquet = true; s.banquet = false; save(); }
    this.closePanel();
    G.run = run;
    G.scene && G.scene.travel('dungeon', { run });
  }

  runStart(run) {
    if (run.size > 1) this.toast(`${run.size} heroes · enemies scaled for a party`, 'info');
    if (G.save.meal) this.toast('Meal bonus active: ' + CONSUMABLES[G.save.meal].name, 'info');
  }

  runEnd(sum, done) {
    this.closePanel();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    const win = sum.reason === 'victory';
    const title = win ? 'VICTORY!' : sum.reason === 'wipe' ? 'PARTY WIPED' : 'RETREAT';
    const sub = win ? `${sum.dungeon} cleared` : sum.reason === 'wipe' ? 'You keep XP, Gold and loot, but equipped gear lost 15% durability.' : 'You escaped with your loot.';
    ov.innerHTML = `<div class="panel frame gold corner result ${win ? '' : 'wipe'}" style="width:min(560px,100%)"><div class="body"><div class="big">${title}</div><div class="note" style="text-align:center">${sub}</div>
      <div class="sum"><div><b>${Math.floor(sum.time / 60)}:${String(Math.floor(sum.time % 60)).padStart(2, '0')}</b>Time</div><div><b>${sum.kills}</b>Kills</div><div><b>${sum.loot.length}</b>Loot</div></div>
      <div class="bag">${sum.loot.map((it) => this.slotHtml(it, null)).join('')}</div></div><div class="foot"><button class="btn gold" data-a="ok">Return to Village</button></div></div>`;
    document.body.appendChild(ov);
    this.panel = { el: ov, close: () => ov.remove() };
    if (win) sfx.epic();
    $('[data-a=ok]', ov).onclick = () => { sfx.ui(); this.closePanel(); done(); };
  }
}
