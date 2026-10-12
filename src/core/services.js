/**
 * services.js — the singletons that outlive a single scene.
 *
 * Settings, statistics, achievements and audio belong to the *player*, not to a
 * scene, so they are created once here and reused when the player moves between
 * the menu and the four game modes. Scenes only attach their world context
 * (`services.attachWorld(ctx)`) so achievements can report through the bus.
 */

import { storage } from './storage.js';
import { SettingsManager } from './SettingsManager.js';
import { StatsManager } from '../systems/StatsManager.js';
import { AchievementManager } from '../systems/AchievementManager.js';
import { SFX } from '../services/SFX.js';
import { bus, EVENTS } from '../utils/events.js';

class Services {
  constructor() {
    this.store = storage;
    this.settings = new SettingsManager(storage);
    this.stats = new StatsManager({ store: storage });
    this.sfx = new SFX({ settings: this.settings });

    // Achievements may be checked from the menu too, so their "toast" simply
    // travels over the bus instead of pointing at a DOM helper.
    this.achievements = new AchievementManager({
      stats: this.stats,
      settings: this.settings,
      sfx: this.sfx,
      toast: (type, title, message) => bus.emit(EVENTS.TOAST, { type, title, message }),
    });

    /** The world context of the current scene (null while in the menu). */
    this.worldCtx = null;
  }

  attachWorld(ctx) {
    this.worldCtx = ctx;
    if (ctx) {
      this.achievements.ctx = {
        stats: this.stats,
        settings: this.settings,
        sfx: this.sfx,
        toast: (type, title, message) => ctx.toast?.(type, title, message),
      };
    }
    return ctx;
  }

  detachWorld() {
    this.worldCtx = null;
    this.achievements.ctx = {
      stats: this.stats,
      settings: this.settings,
      sfx: this.sfx,
      toast: (type, title, message) => bus.emit(EVENTS.TOAST, { type, title, message }),
    };
  }

  /** Audio needs a real user gesture before the WebAudio context may start. */
  unlockAudio() {
    try {
      this.sfx.init();
      this.sfx.resume();
      if (this.settings.get('musicEnabled')) this.sfx.startMusic();
    } catch (err) {
      console.warn('[services] audio unavailable', err);
    }
  }

  applySettings() {
    const sfx = this.sfx;
    if (!sfx.audio) return;
    sfx.applyVolume?.();
    if (this.settings.get('musicEnabled')) sfx.startMusic?.();
    else sfx.stopMusic?.();
  }
}

export const services = new Services();
export default services;
