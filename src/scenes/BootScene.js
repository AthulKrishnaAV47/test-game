/**
 * BootScene — prepares the shared services and hands over to the menu.
 *
 * Everything in StickLab is generated at runtime (vector art, procedural audio),
 * so there is nothing to preload: the boot step only installs the DOM icons,
 * detects the device capabilities and hides the loading overlay.
 */

// Phaser is imported as a namespace: the ESM build (which vite.config.js
// aliases everything to) exposes named exports and no default export.
import * as Phaser from 'phaser';
import { services } from '../core/services.js';
import { applyIcons, setLoading } from '../ui/dom.js';
import { detectQuality } from '../utils/device.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    applyIcons(document);
    const quality = services.settings.get('quality');
    if (!quality) services.settings.set('quality', detectQuality(), { silent: true });
    setLoading(false);
    this.scene.start('MenuScene');
  }
}
