// Character progression helpers: XP, items, durability, quests.
import { G } from './state.js';
import { xpForLevel, CLASSES } from '../data/classes.js';
import { SETS, CONSUMABLES } from '../data/items.js';
import { BOUNTIES, DECREES, CRUSADES } from '../data/quests.js';
import { writeSave } from '../save.js';
import { sfx } from '../audio.js';

export const BAG_SIZE = 40;

function durFactor(it) {
  if (!it) return 1;
  if (it.dur <= 0) return 0.25;
  if (it.dur < 50) return 0.75;
  return 1;
}

export function gearTotals(save) {
  const t = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, speed: 0, poisonRes: 0, lifesteal: 0 };
  const sets = {};
  for (const it of Object.values(save.equip)) {
    if (!it) continue;
    const f = durFactor(it);
    const up = 1 + (it.up || 0) * 0.08;
    t.atk += (it.atk || 0) * f * up;
    t.def += (it.def || 0) * f * up;
    t.hp += (it.hp || 0) * f;
    t.mp += (it.mp || 0) * f;
    t.crit += (it.crit || 0) * f;
    if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
    if (it.dur > 0) for (const p of it.perks || []) {
      if (p === 'vamp') t.lifesteal += 0.03;
      if (p === 'vital') t.hp += 20;
    }
  }
  for (const [k, n] of Object.entries(sets)) {
    const s = SETS[k];
    if (!s) continue;
    const b = n >= 4 ? s.four : n >= 2 ? s.two : null;
    if (b) { t.poisonRes += b.poisonRes || 0; t.speed += b.speed || 0; }
  }
  t.sets = sets;
  return t;
}

export function hasPerk(save, id) {
  for (const it of Object.values(save.equip)) if (it && it.dur > 0 && (it.perks || []).includes(id)) return true;
  return false;
}

export function save() { if (G.save) writeSave(G.save); }

export function addXp(n) {
  const s = G.save;
  if (s.level >= 30) return;
  s.xp += Math.round(n);
  let leveled = false;
  while (s.level < 30 && s.xp >= xpForLevel(s.level)) {
    s.xp -= xpForLevel(s.level);
    s.level++;
    leveled = true;
  }
  if (leveled) {
    sfx.level();
    G.ui.levelUp(s.level);
    if (G.scene) G.scene.combat.refreshStats(true);
  }
}

export function addGold(n) { G.save.gold += Math.round(n); }

export function addItem(item) {
  const s = G.save;
  if (item.type === 'consumable') {
    const ex = s.bag.find((b) => b.type === 'consumable' && b.key === item.key);
    if (ex) { ex.qty += item.qty; return true; }
  }
  if (s.bag.length >= BAG_SIZE) { G.ui.toast('Bag is full!', 'warn'); return false; }
  s.bag.push(item);
  return true;
}

export function countItem(key) {
  const it = G.save.bag.find((b) => b.type === 'consumable' && b.key === key);
  return it ? it.qty : 0;
}
export function useItem(key) {
  const s = G.save;
  const i = s.bag.findIndex((b) => b.type === 'consumable' && b.key === key);
  if (i < 0) return false;
  s.bag[i].qty--;
  if (s.bag[i].qty <= 0) s.bag.splice(i, 1);
  return true;
}
export function bestVial() {
  for (const k of ['vial3', 'vial2', 'vial1']) if (countItem(k) > 0) return k;
  return null;
}

export function stat(key, n = 1) {
  const s = G.save;
  s.stats[key] = (s.stats[key] || 0) + n;
  // bounty / decree progress
  for (const b of BOUNTIES) {
    const st = s.bounties[b.id];
    if (st && !st.done && b.stat === key) {
      st.p = Math.min(b.goal, st.p + n);
      if (st.p >= b.goal) { st.done = true; G.ui.toast('Bounty complete: ' + b.name + '! Claim it at the Guild Board.', 'quest'); sfx.loot(); }
    }
  }
  for (const d of DECREES) {
    const st = s.decrees[d.id];
    if (st && !st.done && d.stat === key) {
      st.p = Math.min(d.goal, st.p + n);
      if (st.p >= d.goal) { st.done = true; G.ui.toast(d.name + ' fulfilled! See the King.', 'quest'); sfx.epic(); }
    }
  }
  if (s.crusade && key === 'partyMobs') {
    const c = CRUSADES.find((x) => x.id === s.crusade.id);
    if (c && !s.crusade.done) { s.crusade.p = Math.min(c.goal, s.crusade.p + n); if (s.crusade.p >= c.goal) { s.crusade.done = true; G.ui.toast(c.name + ' complete!', 'quest'); } }
  }
}

export function wear(amount) {
  for (const it of Object.values(G.save.equip)) {
    if (!it) continue;
    const temper = (it.perks || []).includes('temper') ? 0.6 : 1;
    it.dur = Math.max(0, it.dur - amount * temper);
  }
}

export function repairCost(it) { return it ? Math.ceil((100 - it.dur) * (0.4 + it.level * 0.08)) : 0; }

export function resourceName() { return CLASSES[G.save.cls].resource === 'scrap' ? 'Scrap' : 'MP'; }
export { CONSUMABLES };
