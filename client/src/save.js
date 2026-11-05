// Local save (localStorage). Characters are stored on the device.
import { makeConsumable, makeGear } from './data/items.js';

const KEY = 'brighthearts.save.v1';
const SETTINGS = 'brighthearts.settings.v1';

export function defaultSettings() {
  return { server: '', music: 0.5, sfx: 0.7, shake: true, showFps: false, lowFx: false };
}
export function loadSettings() {
  try { return { ...defaultSettings(), ...(JSON.parse(localStorage.getItem(SETTINGS)) || {}) }; } catch (e) { return defaultSettings(); }
}
export function saveSettings(s) { try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch (e) { /* ignore */ } }

export function newCharacter(name, cls, look) {
  const starter = makeGear({ slot: 'weapon', cls, level: 1, rarity: 'common' });
  starter.name = { warrior: 'Squire Blade', mage: 'Apprentice Staff', savage: 'Hunting Bow', gunman: 'Old Revolver', engineer: 'Trusty Wrench' }[cls];
  const boots = makeGear({ slot: 'boots', cls, level: 1, rarity: 'common' });
  return {
    v: 1, name, cls, look,
    level: 1, xp: 0, gold: 150, ingots: 0, seals: 0,
    equip: { weapon: starter, helmet: null, chest: null, greaves: null, boots },
    bag: [makeConsumable('vial1', 3), makeConsumable('purge', 1)],
    meal: null,
    stats: { snakes: 0, treasures: 0, breakables: 0, mandrakes: 0, bosses: 0, fastClear: 0, partyMobs: 0, clears: 0, deaths: 0 },
    bounties: {}, decrees: {}, crusade: null,
    pity: 0,
    created: Date.now(),
  };
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1 && s.cls) return s;
  } catch (e) { /* ignore */ }
  return null;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
export function deleteSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
