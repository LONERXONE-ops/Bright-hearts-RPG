// Enemy stats (Dungeon 1: Overgrown Ruins). Scaled at spawn by difficulty and party bracket.
export const ENEMIES = {
  viper: {
    name: 'Viper Swarmer', hp: 34, atk: 7, speed: 2.4, range: 0.95, aggro: 6.5, cd: 1.15, xp: 9, gold: [2, 6],
    kind: 'melee', snake: true, radius: 0.32, sheetW: 32, poise: 10,
  },
  spitter: {
    name: 'Venom Spitter', hp: 28, atk: 6, speed: 1.7, range: 5.2, keep: 3.6, aggro: 7.5, cd: 2.0, xp: 11, gold: [3, 7],
    kind: 'ranged', snake: true, radius: 0.32, sheetW: 32, poise: 8, proj: 'venom',
  },
  tortoise: {
    name: 'Bramble Tortoise', hp: 110, atk: 11, speed: 1.0, range: 1.15, aggro: 5.5, cd: 1.8, xp: 20, gold: [5, 12],
    kind: 'melee', frontal: 0.8, radius: 0.45, sheetW: 40, poise: 40,
  },
  mandrake: {
    name: 'Mandrake Shrieker', hp: 44, atk: 5, speed: 1.1, range: 5.5, keep: 4.2, aggro: 7, cd: 3.2, xp: 15, gold: [4, 9],
    kind: 'healer', radius: 0.3, sheetW: 32, poise: 6, proj: 'spore',
  },
};

export const BOSSES = {
  hydra: {
    name: 'Three-Headed Snake', title: 'Warden of the Overgrown Ruins',
    headHp: 260, atk: 16, xp: 320, gold: [80, 140],
    heads: [
      { name: 'Venom Head', attack: 'spit', sx: -40, sy: 4 },
      { name: 'Fang Head', attack: 'bite', sx: 0, sy: -8 },
      { name: 'Tail Head', attack: 'sweep', sx: 40, sy: 4 },
    ],
  },
};
