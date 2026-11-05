/* global Phaser */
// Bright Hearts RPG entry point.
import { G } from './game/state.js';
import { loadSettings } from './save.js';
import { buildAll, preloadPack } from './game/assets.js';
import { WorldScene } from './game/WorldScene.js';
import { UI } from './ui/ui.js';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() { preloadPack(this); }
  create() {
    const t0 = performance.now();
    buildAll(this, G.settings.lowFx);
    console.log('[bright hearts] art generated in', Math.round(performance.now() - t0), 'ms');
    document.getElementById('loading')?.remove();
    G.ui.showTitle();
    if (location.search.includes('auto=')) import('../dev/auto.js').then((m) => m.run()).catch((e) => console.log('PAGEERROR auto', e.stack));
    // the village is rendered behind the title screen as a living backdrop
    this.scene.start('backdrop');
  }
}

// Title backdrop: slow camera drift over the village using the real world scene in demo mode
class BackdropScene extends Phaser.Scene {
  constructor() { super('backdrop'); }
  create() {
    this.cameras.main.setBackgroundColor('#0d0a18');
    const w = this.scale.width, h = this.scale.height;
    const g = this.add.graphics();
    for (let i = 0; i < 90; i++) {
      g.fillStyle(i % 4 === 0 ? 0xf27aa4 : 0xf6c445, 0.25 + Math.random() * 0.5);
      g.fillRect(Math.random() * w, Math.random() * h, 1 + (i % 3 === 0 ? 1 : 0), 1 + (i % 3 === 0 ? 1 : 0));
    }
    const glow = this.add.image(w / 2, h * 0.48, 'light').setScale(w / 90, h / 110).setTint(0x6c33a8).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.3, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const glow2 = this.add.image(w / 2, h * 0.9, 'light').setScale(w / 50, h / 160).setTint(0xd64b84).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    void glow2;
  }
}

// Render at device resolution (capped) so pixel art stays crisp on phones,
// then let the camera pick an integer zoom.
function dpr() { return Math.min(2, window.devicePixelRatio || 1); }
function viewSize() {
  const vv = window.visualViewport;
  return { w: Math.round(vv ? vv.width : window.innerWidth), h: Math.round(vv ? vv.height : window.innerHeight) };
}

function boot() {
  G.settings = loadSettings();
  G.mobile = location.search.includes('touch=1') || matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  document.body.classList.toggle('touch', G.mobile);
  const ui = new UI(document.getElementById('ui'), null);
  const { w, h } = viewSize();
  const r = dpr();
  const game = new Phaser.Game({
    type: location.search.includes('canvas=1') ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0d0a18',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.NONE, width: Math.round(w * r), height: Math.round(h * r), zoom: 1 / r },
    input: { activePointers: 4 },
    fps: { target: 60 },
    scene: [BootScene, BackdropScene, WorldScene],
  });
  ui.game = game;
  let rt = 0;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const v = viewSize(), d = dpr();
      game.scale.resize(Math.round(v.w * d), Math.round(v.h * d));
      game.scale.setZoom(1 / d);
      ui.onResize && ui.onResize();
    }, 120);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport && window.visualViewport.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  document.addEventListener('fullscreenchange', onResize);
  window.__bh = { G, game };
}

document.fonts && document.fonts.load('12px "Pixelify Sans"').finally(boot);
if (!document.fonts) boot();
