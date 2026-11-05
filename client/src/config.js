// Game configuration.
export const BUILD = '__BUILD__';
export const VERSION = '0.1.' + (BUILD.startsWith('__') ? 'dev' : BUILD);

// Multiplayer server. Render gives the service a URL like
// https://bright-hearts-rpg-server.onrender.com. Players can also paste a URL in Settings.
export const DEFAULT_SERVER = 'wss://bright-hearts-rpg-server.onrender.com';

export const GITHUB = 'https://github.com/LONERXONE-ops/Bright-hearts-RPG';
export const CREDIT = 'LONERXONE';

export const ZOOM_TARGET_H = 230; // world pixels visible vertically (device pixels / zoom)
