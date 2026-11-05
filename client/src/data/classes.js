// Classes, stats and skills, taken from the Co-op Dungeon Raid RPG design guide.

export const ATTRS = ['vitality', 'armor', 'might', 'agility', 'spirit', 'presence'];
export const ATTR_INFO = {
  vitality: 'Max HP and passive HP regeneration',
  armor: 'Physical mitigation and poise',
  might: 'Physical attack power and stagger',
  agility: 'Attack speed, move speed and crit rate',
  spirit: 'Max Mana, Mana regen and spell power',
  presence: 'Aggro, buff duration and revive speed',
};

export const CLASSES = {
  warrior: {
    name: 'Warrior', title: 'Hero', tagline: 'The brave boy on a journey to save the world.', archetype: 'Vanguard', role: 'Flank Exploiter',
    blurb: 'Fast, agile close-range melee with minor spells. Hit enemies from behind to Sunder their armor.',
    base: { vitality: 20, armor: 15, might: 25, agility: 25, spirit: 10, presence: 5 },
    resource: 'mana', weapon: 'Blade', range: 1.25, melee: true, atkSpeed: 0.38,
    paths: [
      { name: 'Spellblade', desc: 'Elemental blade infusions, sword beams and blink dashes.' },
      { name: 'Dual-Blader', desc: 'Extreme attack speed, stacking bleed, evasion and crits.' },
      { name: 'Warlord', desc: 'Battle banners and war cries that speed up the whole party.' },
    ],
    skills: [
      { id: 'beam', name: 'Sword Beam', icon: 'beam', cost: 14, cd: 3.5, desc: 'Fire a piercing blade of light.' },
      { id: 'blink', name: 'Blink Dash', icon: 'dash', cost: 10, cd: 5, desc: 'Dash forward, striking everything you pass.' },
    ],
  },
  mage: {
    name: 'Mage', title: 'Mage', tagline: 'A young mage with a kind heart.', archetype: 'Arcanist', role: 'Sustain Engine',
    blurb: 'Slow, long-range magic and party support. Heals, cleanses and revives from range.',
    base: { vitality: 10, armor: 5, might: 5, agility: 10, spirit: 45, presence: 25 },
    resource: 'mana', weapon: 'Staff', range: 6, melee: false, atkSpeed: 0.55,
    paths: [
      { name: 'Light Healer', desc: 'HP restoration, cleansing, auras and instant ranged revives.' },
      { name: 'Dark Mage', desc: 'Heavy AoE, life-drain, defense-shredding curses and hexes.' },
      { name: 'Elementalist', desc: 'Freeze control, chain lightning and firestorms.' },
    ],
    skills: [
      { id: 'firestorm', name: 'Firestorm', icon: 'fire', cost: 26, cd: 6, desc: 'Rain fire on a target area.' },
      { id: 'heal', name: 'Radiant Mend', icon: 'healS', cost: 22, cd: 7, desc: 'Heal yourself and nearby allies, cleanse poison.' },
    ],
  },
  savage: {
    name: 'Hunter', title: 'Hunter', tagline: 'A wild soul with a bow.', archetype: 'Beast Warden', role: 'Aggro Anchor',
    blurb: 'Tough as the frozen north. Holds the boss\'s attention with war cries while her arrows rain from range.',
    base: { vitality: 30, armor: 25, might: 20, agility: 10, spirit: 5, presence: 10 },
    resource: 'mana', weapon: 'Longbow', range: 6, melee: false, atkSpeed: 0.5,
    paths: [
      { name: 'Warden', desc: 'Boss taunts, damage absorption and shields for the party.' },
      { name: 'Beastmaster', desc: 'Wolf and hawk companions that fight beside her.' },
      { name: 'Berserker', desc: 'Faster arrows and life-steal as HP falls.' },
    ],
    skills: [
      { id: 'taunt', name: 'War Cry', icon: 'shield', cost: 12, cd: 8, desc: 'Pull aggro and take 50% less damage for 5s.' },
      { id: 'volley', name: 'Arrow Rain', icon: 'volley', cost: 18, cd: 6, desc: 'Rain arrows on an area.' },
    ],
  },
  gunman: {
    name: 'Gunman', title: 'Gunman', tagline: 'A lone traveler with a trusty gun.', archetype: 'Ranger', role: 'Weak-Point Interrupter',
    blurb: 'Mid-to-long range gunslinger. Snipes boss weak points and lays down explosives.',
    base: { vitality: 15, armor: 10, might: 25, agility: 30, spirit: 10, presence: 10 },
    resource: 'mana', weapon: 'Revolver', range: 7, melee: false, atkSpeed: 0.42,
    paths: [
      { name: 'Sharpshooter', desc: 'Defense-piercing rifles and boss weak-point sniping.' },
      { name: 'Gunslinger', desc: 'Fast dual pistols, dodge-rolls and rapid barrages.' },
      { name: 'Demolitionist', desc: 'Shotgun area denial, grenades and turrets.' },
    ],
    skills: [
      { id: 'snipe', name: 'Weak-Point Snipe', icon: 'snipe', cost: 15, cd: 4, desc: 'A piercing shot that deals triple damage to bosses.' },
      { id: 'grenade', name: 'Blast Grenade', icon: 'grenade', cost: 20, cd: 6, desc: 'Lob an explosive that damages an area.' },
    ],
  },
  engineer: {
    name: 'Engineer', title: 'Engineer', tagline: 'A clever mind that builds the future.', archetype: 'Tactician', role: 'Mechanical Support',
    blurb: 'Battlefield tactician. Spends Scrap to deploy sentries and snares. Smash crates for Scrap.',
    // The guide gives no numbers for the Engineer, so this 100 point spread is a balanced starting point.
    base: { vitality: 15, armor: 15, might: 15, agility: 20, spirit: 15, presence: 20 },
    resource: 'scrap', weapon: 'Wrench', range: 5, melee: false, atkSpeed: 0.5,
    paths: [
      { name: 'Machinist', desc: 'Construction, fortification and defensive devices.' },
      { name: 'Mechanist', desc: 'Machines, drones and mechanical companions.' },
      { name: 'Trapper', desc: 'Snares, traps and battlefield disruption.' },
    ],
    skills: [
      { id: 'sentry', name: 'Deploy Sentry', icon: 'sentry', cost: 30, cd: 3, desc: 'Place an automated sentry for 15s.' },
      { id: 'snare', name: 'Mechanical Snare', icon: 'snareS', cost: 18, cd: 4, desc: 'Drop a trap that roots enemies.' },
    ],
  },
};

export const CLASS_ORDER = ['warrior', 'mage', 'savage', 'gunman', 'engineer'];

export function xpForLevel(l) {
  return Math.round(60 * Math.pow(l, 1.55));
}

// Derived combat stats from attributes + gear
export function derive(cls, level, gearStats = {}, buffs = {}) {
  const c = CLASSES[cls];
  const a = {};
  for (const k of ATTRS) a[k] = c.base[k] + Math.floor((c.base[k] / 100) * (level - 1) * 6);
  const s = {
    attrs: a,
    maxHp: Math.round(70 + a.vitality * 4 + level * 9 + (gearStats.hp || 0)),
    hpRegen: 0.4 + a.vitality * 0.03,
    maxMp: c.resource === 'scrap' ? 100 : Math.round(20 + a.spirit * 2.4 + level * 2),
    mpRegen: c.resource === 'scrap' ? 0 : 1.2 + a.spirit * 0.09,
    atk: 6 + a.might * 0.55 + level * 1.4 + (gearStats.atk || 0),
    spell: 6 + a.spirit * 0.6 + level * 1.4 + (gearStats.atk || 0) * 0.8,
    def: a.armor * 0.7 + (gearStats.def || 0),
    speed: 3.1 + a.agility * 0.018 + (gearStats.speed || 0),
    crit: 0.05 + a.agility * 0.003 + (gearStats.crit || 0),
    critDmg: 1.6,
    reviveTime: c.resource === 'mana' && cls === 'mage' ? 2.5 : 4,
    poisonRes: gearStats.poisonRes || 0,
    lifesteal: gearStats.lifesteal || 0,
  };
  if (buffs.meal === 'roast') s.maxHp = Math.round(s.maxHp * 1.2);
  if (buffs.meal === 'skewer') { s.crit += 0.12; }
  if (buffs.meal === 'venison') s.poisonRes += 0.35;
  if (buffs.banquet) { s.atk *= 1.1; s.def *= 1.1; s.maxHp = Math.round(s.maxHp * 1.1); }
  s.mitigation = s.def / (s.def + 60);
  return s;
}
