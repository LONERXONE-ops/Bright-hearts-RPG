// Guild Board bounties and King's Castle decrees.
export const BOUNTIES = [
  { id: 'b_snakes', name: 'Snake Cull', text: 'Slay 30 snakes in the Overgrown Ruins.', stat: 'snakes', goal: 30, gold: 220, xp: 160 },
  { id: 'b_treasure', name: 'Relic Hunter', text: 'Recover 10 dungeon Treasures.', stat: 'treasures', goal: 10, gold: 180, xp: 140 },
  { id: 'b_speed', name: 'Swift Raid', text: 'Clear the Overgrown Ruins in under 10 minutes.', stat: 'fastClear', goal: 1, gold: 300, xp: 220 },
  { id: 'b_crates', name: 'Crate Smasher', text: 'Smash 25 jars, crates or urns.', stat: 'breakables', goal: 25, gold: 120, xp: 90 },
  { id: 'b_mandrake', name: 'Silence the Shriekers', text: 'Defeat 8 Mandrake Shriekers.', stat: 'mandrakes', goal: 8, gold: 200, xp: 150 },
];

export const DECREES = [
  { id: 'd_snakes', name: 'Royal Decree: Serpent Purge', text: 'Slay 500 snakes for the Crown.', stat: 'snakes', goal: 500, gold: 2500, ingots: 20, seal: true },
  { id: 'd_bosses', name: 'Royal Decree: Monster Bane', text: 'Defeat 15 dungeon bosses.', stat: 'bosses', goal: 15, gold: 3000, ingots: 25, seal: true },
];

export const CRUSADES = [
  { id: 'c_ruins', name: "King's Crusade: Reclaim the Ruins", text: 'With a party, slay 3,000 Overgrown Ruins mobs.', stat: 'partyMobs', goal: 3000, gold: 6000, ingots: 60 },
];
