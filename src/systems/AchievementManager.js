/**
 * AchievementManager — watches progress counters and unlocks cosmetics.
 *
 * Achievements only unlock when their real condition is met: each definition
 * points at a counter that is incremented by actual gameplay events.
 */

import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../config/achievements.js';
import { RAGDOLL_COLORS, RAGDOLL_ACCESSORIES } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';

export class AchievementManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.stats = ctx.stats;
    this.unlocked = new Set(this.stats.stats.achievements ?? []);
    this.off = bus.on('stats:changed', ({ key }) => this.checkFor(key));
    // A rebuilt scene should re-evaluate everything once.
    this.checkAll({ silent: true });
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  /** 0..1 progress towards an achievement. */
  progress(id) {
    const def = ACHIEVEMENT_MAP[id];
    if (!def) return 0;
    if (this.isUnlocked(id)) return 1;
    const value = this.stats.get(def.track, 0);
    return Math.max(0, Math.min(1, value / def.target));
  }

  value(id) {
    const def = ACHIEVEMENT_MAP[id];
    if (!def) return 0;
    return this.stats.get(def.track, 0);
  }

  list() {
    return ACHIEVEMENTS.map((def) => ({
      ...def,
      unlocked: this.isUnlocked(def.id),
      progress: this.progress(def.id),
      value: this.value(def.id),
    }));
  }

  checkFor(trackKey) {
    for (const def of ACHIEVEMENTS) {
      if (def.track !== trackKey) continue;
      if (this.isUnlocked(def.id)) continue;
      if (this.stats.get(def.track, 0) >= def.target) this.unlock(def.id);
    }
  }

  checkAll({ silent = false } = {}) {
    for (const def of ACHIEVEMENTS) {
      if (!this.isUnlocked(def.id) && this.stats.get(def.track, 0) >= def.target) {
        this.unlock(def.id, { silent });
      }
    }
  }

  unlock(id, { silent = false } = {}) {
    const def = ACHIEVEMENT_MAP[id];
    if (!def || this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    if (!Array.isArray(this.stats.stats.achievements)) this.stats.stats.achievements = [];
    this.stats.stats.achievements.push(id);
    this.stats.dirty = true;
    this.stats.save();
    bus.emit(EVENTS.ACHIEVEMENT_UNLOCKED, { achievement: def });
    if (!silent) {
      this.ctx.toast?.('success', `Achievement unlocked: ${def.name}`, `${def.description} · Reward: ${def.reward}`);
      this.ctx.sfx?.achievement?.();
    }
    return true;
  }

  /** Cosmetics available to this profile (achievement gated). */
  availableColors() {
    return RAGDOLL_COLORS.skin.map((c) => ({
      ...c,
      unlocked: c.unlocked || !c.achievement || this.isUnlocked(c.achievement),
    }));
  }

  availableShirts() {
    return RAGDOLL_COLORS.shirt.map((c) => ({
      ...c,
      unlocked: c.unlocked || !c.achievement || this.isUnlocked(c.achievement),
    }));
  }

  availablePants() {
    return RAGDOLL_COLORS.pants.map((c) => ({
      ...c,
      unlocked: c.unlocked || !c.achievement || this.isUnlocked(c.achievement),
    }));
  }

  availableAccessories() {
    return RAGDOLL_ACCESSORIES.map((a) => ({
      ...a,
      unlocked: a.unlocked || !a.achievement || this.isUnlocked(a.achievement),
    }));
  }

  /** Unlocked background themes for the sandbox (level select in Build Mode). */
  availableThemes() {
    return [
      { id: 'laboratory', name: 'Bright Laboratory', unlocked: true },
      { id: 'playground', name: 'Playground', unlocked: true },
      { id: 'industrial', name: 'Industrial Chamber', unlocked: true },
      { id: 'island', name: 'Floating Island', unlocked: true },
      { id: 'station', name: 'Space Station', unlocked: this.isUnlocked('gravity_explorer') },
      { id: 'arena', name: 'Destruction Arena', unlocked: this.isUnlocked('destruction_expert') },
    ];
  }

  destroy() {
    this.off?.();
  }
}
