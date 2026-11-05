// Dev-only autotest driver: ?auto=title|create|village|castle|dungeon|boss|panel:<name>
import { G } from '../src/game/state.js';
import { newCharacter } from '../src/save.js';
import { makeGear, makeConsumable } from '../src/data/items.js';

const q = new URLSearchParams(location.search);
const mode = q.get('auto');
const cls = q.get('cls') || 'warrior';
window.__errors = [];
window.addEventListener('error', (e) => { console.log('PAGEERROR', e.message, e.filename, e.lineno); });
window.addEventListener('unhandledrejection', (e) => console.log('PAGEERROR rejection', e.reason && (e.reason.stack || e.reason)));

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function until(fn, t = 90000) { const s = Date.now(); while (!fn()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(50); } }

export async function run() {
  if (!mode || mode === 'title') return;
  await until(() => document.getElementById('title'));
  if (mode === 'create') { document.querySelector('[data-a=new]').click(); return; }
  document.getElementById('title').remove();
  G.save = newCharacter('Wisdom', cls, { hair: 'black', style: 'spiky', skin: 1 });
  G.save.level = +(q.get('lv') || 3);
  G.save.gold = 2400; G.save.ingots = 6;
  G.save.bag.push(makeGear({ slot: 'chest', cls, level: 3, rarity: 'rare', set: 'viper' }), makeGear({ slot: 'helmet', cls, level: 3, rarity: 'epic', set: 'viper' }), makeGear({ slot: 'weapon', cls, level: 3, rarity: 'gold' }), makeConsumable('roast', 1));
  if (q.get('server')) G.settings.server = q.get('server');
  if (q.get('name')) G.save.name = q.get('name');
  G.ui.startGame(false);
  await until(() => G.scene && G.scene.me);
  await wait(400);
  if (mode === 'mp') return;
  if (mode.startsWith('panel:')) { G.ui.openPanel(mode.split(':')[1]); return; }
  if (mode === 'castle') { G.scene.travel('castle', { from: 'village' }); return; }
  if (mode === 'dungeon' || mode === 'boss') {
    G.ui.startRun({ dungeon: 'ruins', diff: 'normal', seed: +(q.get('seed') || 1234), size: 1, online: false });
    await until(() => G.scene && G.scene.zoneKey === 'dungeon' && G.scene.combat && G.scene.combat.gates);
    await wait(300);
    const S = G.scene;
    if (mode === 'boss') {
      const r = S.map.bossRoom;
      for (const g of S.combat.gates) S.combat.openGate(g, true);
      S.me.x = S.combat.boss.heads[0].x - 4; S.me.y = 12; 
    } else {
      // walk into the first combat room and fight
      const r = S.map.rooms[1];
      for (const g of S.combat.gates.slice(0, 1)) S.combat.openGate(g, true);
      S.me.x = r.x0 + 5; S.me.y = 12;
    }
    S.me.hp = 99999; S.me.stats.maxHp = 99999;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const c = S.combat; if (!c) return;
      c.attack();
      if (Math.random() < 0.05) c.skill(0);
      if (Math.random() < 0.05) c.skill(1);
      if (Date.now() - t0 > 60000) clearInterval(iv);
    }, 120);
  }
}
setTimeout(() => {
  const S = G.scene; if (!S) return;
  const cam = S.cameras.main;
  console.log('DIAG fade', cam.fadeEffect.isRunning, cam.fadeEffect.progress, cam.fadeEffect.alpha, 'fps', S.game.loop.actualFps.toFixed(1), 'frames', S.game.loop.frame, 'zoom', cam.zoom, 'objs', S.children.list.length);
}, 15000);
setInterval(() => {
  const S = G.scene; if (!S || !S.me) return;
  const c = S.combat;
  console.log('DIAG2 zone', S.zoneKey, 'hp', Math.round(S.me.hp), 'pos', S.me.x.toFixed(1), S.me.y.toFixed(1), 'kills', c && c.kills, 'enemies', S.enemies.size, 'ended', c && c.ended, 'down', S.me.down, 'frames', S.game.loop.frame);
}, 4000);
const _orig = console.error; console.error = (...a) => { console.log('CONSOLEERR', ...a.map(String)); _orig(...a); };
