// 16x16 pixel icons for the UI (rendered to data URLs, shown crisp at 2-4x).
import { Pix } from './pix.js';
import { R, INK } from './palette.js';

const c = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];

function sword(p, ramp = R.steel) {
  p.line(4, 11, 12, 3, ramp[5]); p.line(5, 11, 13, 3, ramp[3]); p.line(4, 10, 12, 2, ramp[6]);
  p.line(2, 10, 6, 14, R.gold[4]); p.line(3, 9, 7, 13, R.gold[3]);
  p.line(2, 13, 3, 14, R.wood[3]); p.set(1, 14, R.gold[4]);
}
const draw = {
  sword: (p, ramp) => sword(p, ramp),
  staff: (p) => { p.line(3, 14, 11, 4, R.wood[3]); p.line(4, 14, 12, 4, R.wood[1]); p.ellipse(12.5, 3.5, 2.5, 2.5, R.magic[4]); p.set(12, 3, '#fff'); p.set(10, 2, R.gold[4]); p.set(14, 5, R.gold[3]); },
  axe: (p) => { p.line(3, 14, 11, 3, R.wood[3]); p.line(4, 14, 12, 3, R.wood[1]); p.poly([[9, 2], [14, 1], [15, 7], [11, 6]], R.steel[4]); p.line(14, 1, 15, 7, R.steel[6]); },
  rifle: (p) => { p.line(1, 11, 14, 5, R.steel[4]); p.line(1, 12, 14, 6, R.steel[2]); p.poly([[1, 11], [5, 10], [5, 13], [1, 14]], R.wood[3]); p.set(9, 7, R.steel[5]); },
  revolver: (p) => { p.rect(3, 5, 10, 3, R.steel[4]); p.hline(3, 12, 5, R.steel[6]); p.rect(5, 6, 4, 4, R.steel[3]); p.ellipse(7, 8, 2, 2, R.steel[2]); p.poly([[3, 8], [6, 8], [5, 14], [2, 14]], R.wood[3]); p.set(4, 10, R.gold[4]); },
  bow: (p) => { for (let j = -6; j <= 6; j++) { const b = Math.round(4 - (j * j) / 10); p.set(4 + b, 8 + j, Math.abs(j) > 4 ? R.bone[4] : R.wood[3]); p.set(5 + b, 8 + j, R.wood[1]); } p.vline(4, 2, 14, R.bone[5]); p.line(3, 11, 13, 3, R.wood[4]); p.set(14, 2, R.steel[6]); p.set(13, 2, R.steel[4]); },
  volley: (p) => { for (const [x, y] of [[3, 2], [8, 4], [12, 1]]) { p.vline(x, y, y + 9, R.wood[4]); p.set(x, y + 10, R.steel[6]); p.set(x - 1, y + 9, R.steel[4]); p.set(x + 1, y + 9, R.steel[4]); p.set(x - 1, y, R.red[4]); p.set(x + 1, y, R.red[4]); } },
  pause: (p) => { p.rect(4, 3, 3, 10, R.bone[5]); p.rect(9, 3, 3, 10, R.bone[5]); },
  wrench: (p) => { p.line(3, 13, 11, 5, R.steel[4]); p.line(4, 13, 12, 5, R.steel[2]); p.ellipse(12, 4, 3, 3, R.steel[4]); p.ellipse(12.5, 3.5, 1.2, 1.2, null); p.set(13, 3, R.steel[1]); p.set(12, 3, R.steel[1]); p.set(3, 13, R.orange[4]); },
  helmet: (p, ramp = R.steel) => { p.ball(8, 8, 6, 6, ramp.slice(1, 6)); p.rect(2, 9, 12, 5, c(ramp, 3)); p.hline(4, 11, 9, INK); p.hline(4, 11, 10, c(ramp, 1)); p.vline(7, 11, 13, c(ramp, 1)); p.rect(2, 12, 12, 2, c(ramp, 2)); },
  chest: (p, ramp = R.steel) => { p.poly([[2, 3], [6, 2], [8, 4], [10, 2], [14, 3], [13, 8], [12, 14], [4, 14], [3, 8]], c(ramp, 3)); p.vline(8, 5, 13, c(ramp, 2)); p.line(3, 4, 5, 8, c(ramp, 5)); p.hline(5, 11, 11, c(ramp, 1)); },
  greaves: (p, ramp = R.steel) => { p.rect(3, 2, 10, 4, c(ramp, 3)); p.rect(3, 6, 4, 8, c(ramp, 4)); p.rect(9, 6, 4, 8, c(ramp, 2)); p.hline(3, 12, 2, c(ramp, 5)); },
  boots: (p, ramp = R.leather) => { p.rect(3, 2, 4, 9, c(ramp, 3)); p.rect(3, 10, 7, 4, c(ramp, 3)); p.rect(9, 3, 4, 8, c(ramp, 2)); p.rect(9, 10, 6, 4, c(ramp, 2)); p.hline(3, 9, 13, c(ramp, 1)); p.hline(3, 6, 2, c(ramp, 4)); },
  potionRed: (p) => potion(p, R.red),
  potionBlue: (p) => potion(p, R.blue),
  potionGreen: (p) => potion(p, R.toxic),
  potionGold: (p) => potion(p, R.gold),
  coin: (p) => { p.ellipse(8, 8, 6, 6, R.gold[3]); p.ellipse(7.5, 7.5, 4.5, 4.5, R.gold[4]); p.vline(7, 5, 10, R.gold[2]); p.set(6, 5, R.gold[5]); },
  ingot: (p) => { p.poly([[2, 10], [5, 5], [14, 5], [12, 10]], R.steel[4]); p.poly([[2, 10], [12, 10], [12, 13], [2, 13]], R.steel[2]); p.poly([[12, 10], [14, 5], [14, 8], [12, 13]], R.steel[1]); p.hline(5, 13, 5, R.steel[6]); },
  scrap: (p) => { p.ellipse(8, 9, 5, 5, R.steel[3]); p.ellipse(8, 9, 2, 2, R.steel[1]); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.set(8 + Math.cos(a) * 6, 9 + Math.sin(a) * 6, R.steel[4]); } p.set(12, 3, R.orange[4]); p.line(11, 2, 14, 5, R.orange[3]); },
  coins: (p) => { for (const [x, y] of [[5, 11], [10, 11], [7, 7]]) { p.ellipse(x, y, 3.2, 2.2, R.bone[3]); p.ellipse(x, y - 1, 3.2, 2.2, R.bone[4]); } },
  jade: (p) => { p.ball(8, 10, 4, 4, R.teal.slice(2, 7)); p.ball(8, 5, 3, 3, R.teal.slice(2, 7)); p.rect(5, 13, 6, 2, R.wood[3]); },
  chalice: (p) => { p.poly([[3, 2], [13, 2], [11, 7], [5, 7]], R.blue[4]); p.hline(3, 12, 2, R.blue[6]); p.vline(8, 7, 11, R.gold[3]); p.rect(5, 12, 7, 2, R.gold[3]); p.set(8, 4, R.gold[5]); },
  crown: (p) => { p.poly([[2, 13], [2, 5], [5, 8], [8, 3], [11, 8], [14, 5], [14, 13]], R.gold[4]); p.hline(2, 13, 11, R.gold[2]); p.set(8, 8, R.purple[4]); p.set(5, 10, R.red[4]); p.set(11, 10, R.blue[5]); },
  scepter: (p) => { p.line(4, 14, 10, 6, R.gold[3]); p.line(5, 14, 11, 6, R.gold[2]); p.ellipse(11.5, 4.5, 3, 3, R.red[4]); p.set(11, 3, '#fff'); p.set(14, 2, R.gold[5]); p.set(9, 2, R.gold[5]); },
  scroll: (p) => { p.rect(3, 3, 10, 10, R.plaster[4]); p.rect(2, 2, 12, 2, R.plaster[3]); p.rect(2, 12, 12, 2, R.plaster[3]); for (let y = 5; y < 11; y += 2) p.hline(5, 11, y, R.wood[2]); },
  heart: (p) => { p.ellipse(5.5, 6, 3.2, 3.2, R.pink[4]); p.ellipse(10.5, 6, 3.2, 3.2, R.pink[3]); p.poly([[2.5, 7], [13.5, 7], [8, 14]], R.pink[3]); p.set(5, 5, '#fff'); },
  meat: (p) => { p.ball(8, 8, 5, 4.5, R.red.slice(1, 5)); p.line(11, 11, 14, 14, R.bone[5]); p.set(14, 13, R.bone[5]); p.set(13, 14, R.bone[5]); },
  skewer: (p) => { p.line(2, 14, 14, 2, R.wood[4]); for (const t of [4, 7, 10]) p.ball(t + 1, 15 - t - 1, 2, 2, R.orange.slice(2, 6)); },
  broth: (p) => { p.ellipse(8, 10, 6, 4, R.wood[3]); p.ellipse(8, 8, 5.5, 2, R.teal[4]); p.set(6, 5, '#ffffff88'); p.set(9, 4, '#ffffff88'); },
  venison: (p) => { p.ball(8, 9, 6, 4, R.orange.slice(1, 5)); p.set(6, 7, R.red[4]); p.set(9, 8, R.red[4]); },
  feast: (p) => { p.poly([[1, 9], [8, 5], [15, 9], [8, 13]], R.wood[4]); p.ball(6, 8, 2.5, 2, R.red.slice(2, 5)); p.ball(10, 8, 2, 1.6, R.gold.slice(2, 5)); },
  charm: (p) => { p.ellipse(8, 9, 5, 5, R.orange[3]); p.ellipse(8, 9, 3, 3, R.gold[5]); p.line(8, 1, 8, 4, R.gold[3]); p.set(6, 8, R.red[4]); },
  // skills
  beam: (p) => { sword(p, R.blue); p.line(8, 7, 15, 0, '#bfe8ff'); p.line(9, 8, 15, 2, '#7fc0f0'); },
  dash: (p) => { for (let i = 0; i < 4; i++) p.hline(1 + i, 9 + i * 1, 4 + i * 2, R.blue[5 - (i % 2)]); p.ball(12, 8, 3, 3, R.steel.slice(2, 7)); },
  fire: (p) => { p.ball(8, 10, 5, 4.5, R.fire.slice(1, 6)); p.poly([[4, 9], [8, 1], [12, 9]], R.fire[3]); p.poly([[6, 10], [8, 5], [10, 10]], R.fire[5]); },
  healS: (p) => { p.rect(6, 2, 4, 12, R.heal[4]); p.rect(2, 6, 12, 4, R.heal[4]); p.rect(7, 3, 2, 10, R.heal[5]); p.rect(3, 7, 10, 2, R.heal[5]); },
  shield: (p) => { p.poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], R.steel[3]); p.poly([[4, 4], [12, 4], [12, 8], [8, 13], [4, 8]], R.red[3]); p.vline(8, 4, 12, R.gold[4]); },
  slam: (p) => { p.ellipse(8, 12, 7, 2.5, R.orange[3]); p.rect(6, 1, 4, 9, R.steel[3]); p.rect(3, 1, 10, 4, R.steel[4]); for (const x of [2, 13]) p.vline(x, 9, 12, R.gold[4]); },
  snipe: (p) => { p.ellipse(8, 8, 6, 6, R.red[3]); p.ellipse(8, 8, 4.5, 4.5, null); p.ellipse(8, 8, 2, 2, R.red[4]); p.hline(0, 15, 8, R.red[4]); p.vline(8, 0, 15, R.red[4]); },
  grenade: (p) => { p.ball(8, 10, 5, 5, R.teal.slice(1, 5)); p.rect(6, 3, 4, 3, R.steel[3]); p.line(10, 3, 13, 1, R.steel[4]); p.set(14, 1, R.fire[5]); },
  sentry: (p) => { p.ball(8, 7, 5, 4, R.teal.slice(1, 6)); p.hline(9, 15, 7, R.steel[4]); p.line(8, 10, 3, 15, R.steel[3]); p.line(8, 10, 13, 15, R.steel[3]); p.set(6, 6, '#ff5050'); },
  snareS: (p) => { for (let a = 0; a < 6.3; a += 0.05) p.set(8 + Math.cos(a) * 6, 9 + Math.sin(a) * 3.5, R.steel[4]); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; p.line(8 + Math.cos(a) * 6, 9 + Math.sin(a) * 3.5, 8 + Math.cos(a) * 4, 9 + Math.sin(a) * 2, R.steel[6]); } },
  taunt: (p) => { p.ellipse(8, 8, 6, 6, R.red[3]); p.rect(7, 4, 2, 6, '#fff'); p.rect(7, 11, 2, 2, '#fff'); },
  chat: (p) => { p.rect(2, 3, 12, 8, R.bone[5]); p.poly([[4, 11], [8, 11], [4, 14]], R.bone[5]); for (const x of [5, 8, 11]) p.set(x, 7, INK); },
  bag: (p) => { p.ball(8, 10, 6, 5, R.leather.slice(1, 5)); p.rect(5, 2, 6, 4, R.leather[3]); p.hline(4, 11, 5, R.gold[4]); },
  quest: (p) => draw.scroll(p),
  gear: (p) => { p.ellipse(8, 8, 5, 5, R.steel[4]); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.rect(Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), 2, 2, R.steel[4]); } p.ellipse(8, 8, 2, 2, R.steel[1]); },
  map: (p) => { p.poly([[2, 3], [6, 2], [10, 4], [14, 3], [14, 13], [10, 14], [6, 12], [2, 13]], R.plaster[4]); p.line(6, 2, 6, 12, R.plaster[2]); p.line(10, 4, 10, 14, R.plaster[2]); p.set(11, 8, R.red[4]); p.set(12, 9, R.red[4]); },
  door: (p) => { p.rect(4, 2, 8, 12, R.wood[3]); p.vline(8, 2, 13, R.wood[1]); p.set(10, 8, R.gold[4]); },
  skull: (p) => { p.ball(8, 7, 5, 5, R.bone.slice(2, 6)); p.rect(5, 10, 6, 3, R.bone[4]); p.rect(5, 6, 2, 2, INK); p.rect(9, 6, 2, 2, INK); },
  star: (p) => { p.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 15], [8, 11], [3, 15], [5, 9], [1, 6], [6, 6]], R.gold[4]); p.set(8, 5, R.gold[5]); },
  anvilI: (p) => { p.poly([[2, 5], [14, 5], [12, 8], [4, 8]], R.steel[3]); p.rect(6, 8, 4, 4, R.steel[2]); p.rect(4, 12, 8, 2, R.steel[2]); p.hline(2, 14, 5, R.steel[5]); },
  magic: (p) => { p.ball(8, 8, 4, 4, R.magic.slice(1, 6)); for (const [x, y] of [[2, 3], [13, 4], [3, 13], [13, 12]]) p.set(x, y, R.magic[5]); },
  lock: (p) => { p.rect(3, 7, 10, 8, R.gold[3]); p.ellipse(8, 6, 3.5, 4, null); for (let a = 3.14; a < 6.3; a += 0.1) p.set(8 + Math.cos(a) * 3.5, 7 + Math.sin(a) * 4, R.steel[4]); p.rect(7, 10, 2, 3, INK); },
};

function potion(p, ramp) {
  p.ball(8, 10, 5, 5, ramp.slice(1, 6));
  p.rect(6, 2, 4, 4, R.ice[5]); p.rect(6, 1, 4, 2, R.wood[3]);
  p.set(6, 8, '#ffffff'); p.set(6, 9, '#ffffffaa');
}

const cache = {};
export function icon(name, ramp) {
  const key = name + (ramp ? ramp[3] : '');
  if (cache[key]) return cache[key];
  const p = new Pix(16, 16);
  (draw[name] || draw.star)(p, ramp);
  p.outline(INK);
  cache[key] = p.dataURL();
  return cache[key];
}
