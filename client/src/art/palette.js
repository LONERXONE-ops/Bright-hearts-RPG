// Bright Hearts palette.
// Synthesized from the art research: 16-bit SNES sprite language (FF6, Chrono Trigger,
// Chained Echoes), hue-shifted ramps with cool purple shadows and warm yellow highlights
// (Eastward, Sea of Stars), saturated hopeful colour (Stardew, Forager, Sea of Stars),
// neon accents for magic (Hyper Light Drifter) and soft hi-res light on top (Children of
// Morta, Octopath's HD-2D). Shadows never go to grey or black: they shift to indigo.

export const INK = '#1b1230';      // universal outline / deepest shadow (indigo, never pure black)
export const INK2 = '#2b1d45';
export const VOID = '#0d0a18';

// Every ramp: index 0 = deepest shadow ... last = highlight
export const R = {
  grass: ['#1f3b3a', '#25503c', '#2f6a3f', '#3f8743', '#5ea546', '#8cc251', '#c3dd6a'],
  grassDry: ['#3b3a2a', '#56522f', '#746c37', '#94883f', '#b8a64f'],
  moss: ['#20362f', '#2c4a35', '#3c6338', '#557e3d', '#78a046'],
  leaf: ['#16302f', '#1d4535', '#24603b', '#337d3e', '#4f9a44', '#7cbc4f', '#b6da6a'],
  dirt: ['#3a2430', '#573334', '#774a3c', '#956446', '#b27f55', '#cfa06c'],
  sand: ['#6b4c45', '#946a52', '#b98a5f', '#d6ab72', '#ecca8f'],
  cobble: ['#2e2638', '#463b4e', '#62566a', '#807487', '#a196a3', '#c6bcc2'],
  stone: ['#262236', '#3a3449', '#524a5f', '#6d6577', '#8a8191', '#aaa1ac', '#ccc3c8'],
  ruin: ['#232a31', '#33403f', '#4a5a51', '#647560', '#828f72', '#a4ab88'],
  crypt: ['#141a26', '#1c2735', '#253645', '#314757', '#43606b', '#5f7f84'],
  castle: ['#2c2433', '#43384a', '#5e5260', '#7b6f78', '#9b8f92', '#bdb1ae', '#ddd2c8'],
  lava: ['#5a1414', '#9a2a12', '#d7471a', '#f47b20', '#ffb13b', '#ffe27a'],
  magma: ['#1f1416', '#2f1c1c', '#432621', '#5b3327', '#73422c'],
  water: ['#14243e', '#183a57', '#1d5470', '#25718a', '#3794a3', '#64bfc0', '#a9e6dc'],
  pond: ['#122427', '#173a37', '#1d5047', '#2a6a56', '#3f8a66'],
  wood: ['#2a1a26', '#43262b', '#623a31', '#80523a', '#a06c45', '#c08d5a'],
  plank: ['#3b2530', '#5a3934', '#7d543e', '#9e714c', '#bf915f', '#dbb37a'],
  thatch: ['#5a3a26', '#86592c', '#b07d34', '#d4a542', '#ecca5c', '#f8e38a'],
  roofRed: ['#3a1428', '#5e1d30', '#8a2a36', '#b23c3b', '#d25a45', '#ec8a5c'],
  roofSlate: ['#1e1d33', '#2b2c48', '#3c405e', '#525a77', '#6f7a91', '#93a0ae'],
  roofPurple: ['#22163a', '#3a2155', '#552f72', '#71408c', '#9358a6', '#b97cc0'],
  plaster: ['#5b4a55', '#86737a', '#ad9c97', '#cdbfae', '#e6dcc4', '#f7f0dc'],
  brick: ['#3a1f2b', '#5a2b33', '#7c3c3c', '#9c5146', '#bb6c55'],
  skin: ['#5a2c35', '#8a4a45', '#bf7859', '#e2a074', '#f6c99b'],
  skin2: ['#3d2029', '#5e3330', '#86503b', '#a8704b', '#c8915f'],
  skin3: ['#2b1720', '#432427', '#62372f', '#80503b', '#9e6b4b'],
  steel: ['#1f2236', '#343a52', '#4f5872', '#727e95', '#9ba7b8', '#cfd8df', '#f2f6f4'],
  gold: ['#4a2420', '#7d4223', '#b46b26', '#e09b2f', '#f6c445', '#fde98a'],
  red: ['#3a1128', '#661a33', '#9a2338', '#cf3a3e', '#ef6550', '#ff9a7a'],
  crimson: ['#2e0d22', '#561331', '#86193d', '#b8274a', '#e04a62'],
  blue: ['#141a3d', '#1f2c63', '#2b4590', '#3967bb', '#4e92dd', '#7fc0f0', '#c0ebff'],
  purple: ['#1d1236', '#33195a', '#4e2482', '#6c33a8', '#9150c7', '#b97ddd', '#e0b5f0'],
  pink: ['#3c1232', '#6a1d4c', '#a12f68', '#d64b84', '#f27aa4', '#ffb3c8'],
  teal: ['#0f2a33', '#134347', '#1a615c', '#22826f', '#36a580', '#6ccb98', '#b2ecc0'],
  orange: ['#4a1a1c', '#7c2f1f', '#b3511f', '#e07a26', '#f8a63d', '#ffd27a'],
  cloth: ['#1e1a33', '#2f2a4d', '#433e66', '#5c5882', '#7c7aa0'],
  leather: ['#2c1a22', '#462a2a', '#653e33', '#865640', '#a87250'],
  fur: ['#3a2a2a', '#5c4236', '#80604a', '#a3825f', '#c6a57a', '#e4cb9e'],
  bone: ['#3a3340', '#5f5763', '#8b8287', '#b5ada9', '#dcd4c7', '#f5f0e2'],
  snake: ['#14301f', '#1f4a26', '#2e6a2b', '#4a8a2e', '#78ad35', '#b4d24f'],
  snakeBelly: ['#6b5a2a', '#9c8a39', '#cdb64d', '#ecd96a', '#fbf0a0'],
  venom: ['#24123d', '#3b1b5e', '#5c2a84', '#7d3fa8', '#a463c7', '#d39ce4'],
  toxic: ['#163018', '#24501f', '#3d7a1e', '#69a521', '#a1d22f', '#dcf56b'],
  mandrake: ['#3a2026', '#5e3530', '#83513b', '#a87148', '#c99460'],
  shell: ['#1f2a22', '#2e3f2b', '#435a34', '#5e7a3e', '#83a04c'],
  ghost: ['#163a46', '#22626a', '#3a9293', '#6fc7bf', '#b7f0e2'],
  sky: ['#1e2a5a', '#2f4a8a', '#4a6cbe', '#6f93dc', '#9ab8f0', '#cfe0ff'],
  darkcloth: ['#140e14', '#1f151c', '#2c1f26', '#3b2a32', '#4e3a42'],
  helm: ['#1f2638', '#323d58', '#4a5878', '#66789a', '#8b9cbc', '#b8c6de'],
  blonde: ['#6b4a26', '#9c7038', '#c99a52', '#e6c27a', '#f6e0a8', '#fff4d0'],
  hairBrown: ['#2a1810', '#45261a', '#6a3c24', '#8c5532', '#ae7046', '#cc9262'],
  ice: ['#1b2f55', '#2a4a7c', '#3d6ea6', '#5a96c9', '#86bfe2', '#bfe6f5', '#eefbff'],
  magic: ['#2a0f4a', '#55179a', '#8a2bd8', '#c45cf2', '#f09cff', '#ffe0ff'],
  heal: ['#10392c', '#16654b', '#25a070', '#57d39a', '#a8f5c9', '#eafff3'],
  fire: ['#5a0f12', '#a3231a', '#e04b1e', '#ff8a2b', '#ffc34a', '#fff1a8'],
};

export const CLASS_COLORS = {
  warrior: '#ef6550',
  mage: '#9150c7',
  savage: '#e09b2f',
  gunman: '#4e92dd',
  engineer: '#36a580',
};

export const RARITY = [
  { key: 'common', name: 'Common', color: '#e6e1d6', glow: 'rgba(230,225,214,0)' },
  { key: 'uncommon', name: 'Uncommon', color: '#7ee07a', glow: 'rgba(126,224,122,.55)' },
  { key: 'rare', name: 'Rare', color: '#5cb6ff', glow: 'rgba(92,182,255,.6)' },
  { key: 'epic', name: 'Epic', color: '#c77dff', glow: 'rgba(199,125,255,.65)' },
  { key: 'gold', name: "King's Gold", color: '#ffcf4a', glow: 'rgba(255,207,74,.75)' },
];
