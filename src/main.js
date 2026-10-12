/**
 * main.js — StickLab's entry point.
 *
 * Creates the Phaser game (fixed-step Matter physics driven by our own
 * PhysicsManager), installs the DOM UI and routes between the menu and the four
 * game modes. Everything the game needs is generated at runtime, so booting is
 * instant: no asset downloads, no backend, no accounts.
 */

// Phaser is imported as a namespace: the ESM build (which vite.config.js
// aliases everything to) exposes named exports and no default export.
import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ChallengeScene } from './scenes/ChallengeScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';
import { BuildScene } from './scenes/BuildScene.js';
import { UIManager } from './ui/UIManager.js';
import { services } from './core/services.js';
import { applyIcons, setLoading, toast } from './ui/dom.js';
import { WORLD } from './config/gameConfig.js';
import { prefersReducedMotion } from './utils/device.js';

const MODE_SCENES = {
  sandbox: 'SandboxScene',
  challenge: 'ChallengeScene',
  arena: 'ArenaScene',
  build: 'BuildScene',
};

const ALL_SCENES = ['MenuScene', 'SandboxScene', 'ChallengeScene', 'ArenaScene', 'BuildScene'];

/* ------------------------------------------------------------------- scene host */

const host = {
  go(mode, options = {}) {
    const key = MODE_SCENES[mode] ?? MODE_SCENES.sandbox;
    services.settings.set('lastMode', mode, { silent: true });
    for (const sceneKey of ALL_SCENES) game.scene.stop(sceneKey);
    game.scene.start(key, { mode, ...options });
  },
  back() {
    for (const sceneKey of ALL_SCENES) game.scene.stop(sceneKey);
    game.scene.start('MenuScene');
  },
};

const ui = new UIManager(host);
services.ui = ui;

/* ------------------------------------------------------------------------ game */

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0b1226',
  banner: false,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: true,
      debug: false,
      setBounds: { x: 0, y: 0, width: WORLD.width, height: WORLD.height },
    },
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
    roundPixels: false,
  },
  audio: { disableWebAudio: false, noAudio: false },
  input: { mouse: { preventDefaultWheel: true }, touch: { capture: true } },
  scene: [BootScene, MenuScene, new GameScene('SandboxScene', 'sandbox'), ChallengeScene, ArenaScene, BuildScene],
});

// The Renderer and other helpers look for `game.settings`; keep them in sync.
game.settings = services.settings;
window.sticklab = { game, services, ui };

/* ------------------------------------------------------------------- niceties */

function boot() {
  applyIcons(document);
  setLoading(true, 'Setting up the lab…');
  if (prefersReducedMotion()) {
    services.settings.set('motionTrails', false, { silent: true });
  }
  // Never leave the player without feedback if the scene manager fails.
  window.setTimeout(() => setLoading(false), 4000);
}

function reportError(error) {
  const message = error?.message ?? String(error);
  console.error('[sticklab]', error);
  toast({ type: 'error', title: 'Something went wrong', message });
}

window.addEventListener('error', (event) => {
  if (event?.error) reportError(event.error);
});
window.addEventListener('unhandledrejection', (event) => reportError(event.reason));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') services.sfx.stopMusic?.();
  else if (services.settings.get('musicEnabled')) services.sfx.startMusic?.();
});

boot();
