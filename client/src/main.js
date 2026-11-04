/* global Phaser */
// Bright Hearts RPG entry point.
import { G } from './game/state.js';
import { loadSettings } from './save.js';
import { buildAll } from './game/assets.js';
import { WorldScene } from './game/WorldScene.js';
import { UI } from './ui/ui.js';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
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

function boot() {
  G.settings = loadSettings();
  const ui = new UI(document.getElementById('ui'), null);
  const game = new Phaser.Game({
    type: location.search.includes('canvas=1') ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0d0a18',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 4 },
    fps: { target: 60 },
    scene: [BootScene, BackdropScene, WorldScene],
  });
  ui.game = game;
  window.__bh = { G, game };
}

document.fonts && document.fonts.load('12px "Pixelify Sans"').finally(boot);
if (!document.fonts) boot();
