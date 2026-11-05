// Shared world-space helpers for the side-view world (16px tiles, y down, (x, y) = feet).
export const TS = 16;
export const iso = (x, y) => ({ x: x * TS, y: y * TS }); // tiles -> world pixels
export const depthOf = (x, y, bias = 0) => 1000 + bias + y * 0.01 + x * 0.0001;
export const CHEST = 1.15; // chest height in tiles (projectiles fly here)
export const PHYS = { grav: 44, jump: 18, maxFall: 20, coyote: 0.1, buffer: 0.14 };
