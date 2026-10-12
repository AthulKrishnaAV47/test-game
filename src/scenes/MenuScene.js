/**
 * MenuScene — an empty scene that simply hosts the DOM main menu.
 *
 * Keeping the menu in the DOM means it can be styled, animated and made
 * accessible with normal CSS while Phaser stays responsible for the world.
 */

// Phaser is imported as a namespace: the ESM build (which vite.config.js
// aliases everything to) exposes named exports and no default export.
import * as Phaser from 'phaser';
import { services } from '../core/services.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1226');
    services.detachWorld();
    services.ui?.showMenu(true);
    services.stats.checkDaily?.();
    this.events.once('shutdown', () => services.ui?.showMenu(false));
  }
}
