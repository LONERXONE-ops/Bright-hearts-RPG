// Gear, treasures, consumables and loot tables (from the design guide).
import { R } from '../art/palette.js';

export const SLOTS = ['weapon', 'helmet', 'chest', 'greaves', 'boots'];
export const SLOT_ICON = { weapon: 'sword', helmet: 'helmet', chest: 'chest', greaves: 'greaves', boots: 'boots' };
export const CLASS_WEAPON_ICON = { warrior: 'sword', mage: 'staff', savage: 'axe', gunman: 'rifle', engineer: 'wrench' };

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'gold'];
export const RARITY_NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', gold: "King's Gold" };
export const RARITY_MULT = { common: 1, uncommon: 1.18, rare: 1.4, epic: 1.7, gold: 2.1 };
export const ENCHANT_SLOTS = { common: 0, uncommon: 1, rare: 2, epic: 3, gold: 3 };
export const RARITY_RAMP = { common: R.steel, uncommon: R.teal, rare: R.blue, epic: R.purple, gold: R.gold };

// [mob, boss] probabilities per difficulty, Common..Gold (percent)
export const LOOT_TABLE = {
  normal: { mob: [75, 20, 4.8, 0.2, 0], boss: [40, 45, 14, 1, 0] },
  nightmare: { mob: [45, 38, 15, 1.9, 0.1], boss: [0, 45, 43, 11, 1] },
  hell: { mob: [15, 40, 35, 9.5, 0.5], boss: [0, 15, 55, 25, 5] },
};

export const TREASURES = [
  { rarity: 'common', name: 'Tarnished Coins', icon: 'coins', value: 25 },
  { rarity: 'uncommon', name: 'Jade Figurine', icon: 'jade', value: 75 },
  { rarity: 'rare', name: 'Sapphire Chalice', icon: 'chalice', value: 250 },
  { rarity: 'epic', name: 'Jeweled Crown', icon: 'crown', value: 800 },
  { rarity: 'gold', name: 'Sovereign Scepter', icon: 'scepter', value: 2500 },
];
export const DIFF_TREASURE_MULT = { normal: 1, nightmare: 1.5, hell: 2.5 };
export const DIFF_TAG = { normal: '', nightmare: 'Pristine ', hell: 'Royal ' };

export const SETS = {
  viper: {
    name: 'Viper-Scale', dungeon: 'ruins',
    two: { poisonRes: 0.25, speed: 0.18 }, four: { poisonRes: 0.5, speed: 0.37 },
    twoText: '+25% Poison Resistance, +6% Move Speed', fourText: '+50% Poison Resistance, +12% Move Speed',
  },
};

export const PERKS = {
  weapon: [
    { id: 'pierce', name: 'Armor Piercing', text: 'Ignores 15% Defense' },
    { id: 'exec', name: 'Executioner', text: '+25% damage to targets below 30% HP' },
    { id: 'vamp', name: 'Vampiric', text: 'Restores 3% of damage dealt as HP' },
    { id: 'threat', name: 'Threatening', text: '+35% aggro generation' },
    { id: 'mend', name: 'Mending', text: '+15% outgoing healing' },
    { id: 'temper', name: 'Tempered Steel', text: '-40% durability loss' },
    { id: 'bane', name: 'Bane: Reptiles', text: '+20% damage vs snakes' },
    { id: 'prospect', name: 'Prospector', text: '+15% Gold drops' },
    { id: 'siphon', name: 'Siphoning Strike', text: 'Crits restore 2% Mana to an ally' },
  ],
  armor: [
    { id: 'thorns', name: 'Thorns', text: 'Reflects 10% melee damage' },
    { id: 'fleet', name: 'Fleet-Footed', text: '+10% dodge distance' },
    { id: 'vital', name: 'Vitality', text: '+15% Max HP' },
    { id: 'rshield', name: 'Revive Shield', text: 'Barrier while reviving an ally' },
  ],
};

export const CONSUMABLES = {
  vial1: { name: 'Crimson Vial I', icon: 'potionRed', price: 40, kind: 'potion', heal: 0.3, desc: 'Instantly restores 30% Max HP.' },
  vial2: { name: 'Crimson Vial II', icon: 'potionRed', price: 120, kind: 'potion', heal: 0.5, desc: 'Instantly restores 50% Max HP.' },
  vial3: { name: 'Crimson Vial III', icon: 'potionRed', price: 300, kind: 'potion', heal: 0.75, desc: 'Instantly restores 75% Max HP.' },
  purge: { name: 'Purge Tonic', icon: 'potionGreen', price: 60, kind: 'potion', cleanse: true, desc: 'Clears poison, burn and cobweb roots.' },
  adren: { name: 'Adrenaline Draught', icon: 'potionGold', price: 90, kind: 'potion', haste: true, desc: '+25% move speed and resets skill cooldowns for 6s.' },
  roast: { name: 'Ironhide Roast', icon: 'meat', price: 80, kind: 'meal', desc: 'Tank meal: +20% Max HP for one run.' },
  skewer: { name: "Tracker's Skewer", icon: 'skewer', price: 80, kind: 'meal', desc: 'DPS meal: +12% Crit Chance for one run.' },
  broth: { name: "Sage's Broth", icon: 'broth', price: 80, kind: 'meal', desc: 'Mage meal: +15% cooldown reduction, faster revives.' },
  venison: { name: 'Spiced Venison', icon: 'venison', price: 70, kind: 'meal', desc: 'Hazard meal: -35% poison and lava damage.' },
  phoenix: { name: 'Phoenix Charm', icon: 'charm', price: 250, kind: 'charm', desc: 'Solo only: revive yourself once when downed.' },
};

export const STORE_STOCK = ['vial1', 'vial2', 'vial3', 'purge', 'adren', 'phoenix', 'roast', 'skewer', 'broth', 'venison'];

let uid = Date.now() % 100000;
export function newId() { return 'i' + (uid++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function rollRarity(table, r = Math.random()) {
  let x = r * 100;
  for (let i = 0; i < table.length; i++) { if (x < table[i]) return RARITIES[i]; x -= table[i]; }
  return 'common';
}

const WEAPON_NAMES = {
  warrior: ['Ruin Blade', 'Moss-Edge Saber', 'Fang Sword', 'Vine Cutter'],
  mage: ['Lotus Staff', 'Verdant Rod', 'Serpent Wand', 'Sage Branch'],
  savage: ['Root Greataxe', 'Stone Cleaver', 'Bramble Maul', 'Temple Axe'],
  gunman: ['Jungle Rifle', 'Viper Carbine', 'Long Musket', 'Ruin Repeater'],
  engineer: ['Brass Wrench', 'Gear Spanner', 'Cog Driver', 'Tinker Hammer'],
};
const ARMOR_NAMES = { helmet: 'Hood', chest: 'Mail', greaves: 'Greaves', boots: 'Treads' };

export function makeGear({ slot, cls, level = 1, rarity = 'common', set = null, diff = 'normal' }) {
  const m = RARITY_MULT[rarity];
  const lv = Math.max(1, level);
  const item = { id: newId(), type: 'gear', slot, rarity, level: lv, cls, dur: 100, perks: [], up: 0 };
  if (slot === 'weapon') {
    const names = WEAPON_NAMES[cls] || WEAPON_NAMES.warrior;
    item.name = names[Math.floor(Math.random() * names.length)];
    item.atk = Math.round((4 + lv * 2.2) * m);
    item.icon = CLASS_WEAPON_ICON[cls] || 'sword';
  } else {
    const isSet = set && rarity !== 'common';
    item.set = isSet ? set : null;
    item.name = (isSet ? SETS[set].name + ' ' : 'Traveler ') + ARMOR_NAMES[slot];
    item.def = Math.round((2 + lv * 1.2) * m * (slot === 'chest' ? 1.4 : 1));
    // class-scaled armor (guide section 16)
    if (cls === 'mage') item.mp = Math.round(lv * 1.5 * m);
    if (cls === 'savage') item.hp = Math.round((6 + lv * 3) * m);
    if (cls === 'warrior' || cls === 'gunman') item.crit = +(0.005 * m).toFixed(3);
    if (cls === 'engineer') item.hp = Math.round((3 + lv * 2) * m);
    item.icon = slot;
  }
  item.req = diff === 'hell' ? 25 : diff === 'nightmare' ? 15 : 1;
  return item;
}

export function rollGear(cls, level, diff, boss) {
  const tbl = LOOT_TABLE[diff] || LOOT_TABLE.normal;
  const rarity = rollRarity(boss ? tbl.boss : tbl.mob);
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
  return makeGear({ slot, cls, level, rarity, set: 'viper', diff });
}

export function rollTreasure(diff) {
  const tbl = LOOT_TABLE[diff] || LOOT_TABLE.normal;
  const rarity = rollRarity(tbl.mob);
  const t = TREASURES.find((x) => x.rarity === rarity);
  return { id: newId(), type: 'treasure', rarity, name: DIFF_TAG[diff] + t.name, icon: t.icon, value: Math.round(t.value * DIFF_TREASURE_MULT[diff]) };
}

export function makeConsumable(key, qty = 1) {
  const c = CONSUMABLES[key];
  return { id: newId(), type: 'consumable', key, name: c.name, icon: c.icon, qty };
}

export function sellValue(item) {
  if (item.type === 'treasure') return item.value;
  if (item.type === 'gear') return Math.round((5 + item.level * 3) * RARITY_MULT[item.rarity]);
  return 0;
}
