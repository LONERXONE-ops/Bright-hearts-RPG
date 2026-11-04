// Tiny synthesized sound kit (no audio files to download).
let ctx = null, master = null, musicGain = null, sfxGain = null;
let musicTimer = null, musicKey = null;

export function initAudio(settings) {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = (settings?.music ?? 0.5) * 0.22; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = (settings?.sfx ?? 0.7) * 0.5; sfxGain.connect(master);
  } catch (e) { ctx = null; }
}
export function setVolumes(s) {
  if (!ctx) return;
  musicGain.gain.value = s.music * 0.22;
  sfxGain.gain.value = s.sfx * 0.5;
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, dest = sfxGain, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, hp = 800, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(sfxGain);
  s.start(t);
}

export const sfx = {
  swing: () => { noise(0.08, 0.25, 2500); tone(420, 0.06, 'triangle', 0.08, -200); },
  hit: () => { noise(0.07, 0.35, 900); tone(160, 0.08, 'square', 0.12, -80); },
  crit: () => { noise(0.1, 0.4, 600); tone(880, 0.12, 'square', 0.12, 400); },
  shoot: () => { noise(0.09, 0.4, 1500); tone(220, 0.07, 'sawtooth', 0.1, -150); },
  magic: () => { tone(660, 0.18, 'sine', 0.15, 500); tone(990, 0.18, 'sine', 0.08, 300, sfxGain, 0.04); },
  heal: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, 0, sfxGain, i * 0.05)); },
  boom: () => { noise(0.35, 0.5, 120); tone(90, 0.35, 'sine', 0.3, -50); },
  hurt: () => { tone(200, 0.12, 'square', 0.15, -120); },
  coin: () => { tone(1320, 0.06, 'square', 0.08); tone(1760, 0.1, 'square', 0.08, 0, sfxGain, 0.05); },
  loot: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, 0, sfxGain, i * 0.06)); },
  epic: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, 0, sfxGain, i * 0.07)); },
  ui: () => tone(740, 0.05, 'square', 0.06),
  uiBack: () => tone(520, 0.05, 'square', 0.06),
  level: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, 0, sfxGain, i * 0.09)); },
  break: () => { noise(0.15, 0.35, 400); tone(300, 0.05, 'square', 0.06, -100); },
  dash: () => { noise(0.18, 0.25, 3000); },
  roar: () => { tone(110, 0.6, 'sawtooth', 0.25, -40); noise(0.5, 0.25, 200); },
  down: () => { [400, 300, 200].forEach((f, i) => tone(f, 0.2, 'square', 0.12, 0, sfxGain, i * 0.12)); },
  door: () => { tone(200, 0.2, 'triangle', 0.15, 200); },
};

// gentle generative music: a chord progression per zone
const SONGS = {
  title: { tempo: 2.4, chords: [[57, 64, 69, 72], [53, 60, 65, 69], [55, 62, 67, 71], [52, 59, 64, 67]], wave: 'triangle' },
  village: { tempo: 2.0, chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], wave: 'triangle' },
  castle: { tempo: 2.6, chords: [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [45, 52, 57, 61]], wave: 'sine' },
  ruins: { tempo: 2.8, chords: [[45, 52, 57, 60], [43, 50, 55, 58], [41, 48, 53, 57], [40, 47, 52, 56]], wave: 'sine' },
  boss: { tempo: 1.2, chords: [[40, 47, 52, 55], [41, 48, 53, 56], [40, 47, 52, 55], [38, 45, 50, 53]], wave: 'sawtooth' },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function playMusic(key) {
  if (!ctx || musicKey === key) return;
  musicKey = key;
  clearInterval(musicTimer);
  const song = SONGS[key];
  if (!song) return;
  let step = 0;
  const play = () => {
    const ch = song.chords[step % song.chords.length];
    ch.forEach((n, i) => tone(mtof(n), song.tempo * 0.95, song.wave, i === 0 ? 0.16 : 0.07, 0, musicGain, i * 0.02));
    // little melody sparkle
    const mel = ch[(step * 3) % ch.length] + 12;
    tone(mtof(mel), song.tempo * 0.4, 'sine', 0.06, 0, musicGain, song.tempo * 0.5);
    if (key === 'boss') { tone(mtof(ch[0] - 12), 0.15, 'square', 0.12, 0, musicGain, 0); tone(mtof(ch[0] - 12), 0.15, 'square', 0.1, 0, musicGain, song.tempo * 0.5); }
    step++;
  };
  play();
  musicTimer = setInterval(play, song.tempo * 1000);
}
