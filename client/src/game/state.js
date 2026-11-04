// Shared game state between the Phaser world and the DOM UI.
export const G = {
  save: null,        // current character
  settings: null,
  scene: null,       // active WorldScene
  ui: null,          // UI controller
  input: { mx: 0, my: 0, attack: false },
  party: null,       // {code, host, members}
  zone: 'village',
  online: false,
  run: null,         // active dungeon run info
};
