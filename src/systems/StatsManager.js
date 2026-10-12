/**
 * StatsManager — persistent counters that drive achievements and progression.
 *
 * Counters are updated from real simulation events (destruction, explosions,
 * saves…) and persisted to localStorage with light debouncing.
 */

import { DEFAULT_STATS } from '../config/achievements.js';
import { STORAGE_KEYS } from '../config/gameConfig.js';
import { storage } from '../core/storage.js';
import { bus, EVENTS } from '../utils/events.js';
import { num } from '../utils/validation.js';
import { isPlainObject } from '../utils/validation.js';

export class StatsManager {
  constructor({ store = storage, persist = true } = {}) {
    this.store = store;
    this.persist = persist;
    this.stats = this.load();
    this.saveTimer = 0;
    this.dirty = false;
  }

  load() {
    const raw = this.store.readJSON(STORAGE_KEYS.progress, null);
    const base = { ...DEFAULT_STATS, challengeStars: {}, gravityPresetIds: [] };
    if (!isPlainObject(raw)) return base;
    const out = { ...base };
    for (const key of Object.keys(DEFAULT_STATS)) {
      if (key === 'challengeStars') continue;
      if (key === 'gravityPresetIds') {
        out.gravityPresetIds = Array.isArray(raw.gravityPresetIds)
          ? raw.gravityPresetIds.filter((id) => typeof id === 'string').slice(0, 32)
          : [];
        continue;
      }
      out[key] = num(raw[key], base[key], 0, 1e9);
    }
    if (isPlainObject(raw.challengeStars)) {
      for (const [id, stars] of Object.entries(raw.challengeStars)) {
        if (typeof id === 'string' && id.length <= 40) out.challengeStars[id] = num(stars, 0, 0, 3);
      }
    }
    if (Array.isArray(raw.achievements)) {
      out.achievements = raw.achievements.filter((a) => typeof a === 'string').slice(0, 64);
    } else {
      out.achievements = [];
    }
    return out;
  }

  get(key, fallback = 0) {
    return this.stats[key] ?? fallback;
  }

  set(key, value) {
    this.stats[key] = value;
    this.dirty = true;
    bus.emit('stats:changed', { key, value });
  }

  bump(key, amount = 1) {
    if (!(key in DEFAULT_STATS)) return;
    this.stats[key] = (this.stats[key] ?? 0) + amount;
    this.dirty = true;
    bus.emit('stats:changed', { key, value: this.stats[key] });
  }

  /** Track a running maximum (impact force, best chain…). */
  max(key, value) {
    if (!(key in DEFAULT_STATS)) return;
    const current = this.stats[key] ?? 0;
    if (value > current) {
      this.stats[key] = value;
      this.dirty = true;
      bus.emit('stats:changed', { key, value });
    }
  }

  addGravityPreset(id) {
    if (!id) return;
    if (!Array.isArray(this.stats.gravityPresetIds)) this.stats.gravityPresetIds = [];
    if (this.stats.gravityPresetIds.includes(id)) return;
    this.stats.gravityPresetIds.push(id);
    this.stats.gravityPresetsUsed = this.stats.gravityPresetIds.length;
    this.dirty = true;
    bus.emit('stats:changed', { key: 'gravityPresetsUsed', value: this.stats.gravityPresetsUsed });
  }

  addChallengeStars(challengeId, stars) {
    if (!isPlainObject(this.stats.challengeStars)) this.stats.challengeStars = {};
    const previous = this.stats.challengeStars[challengeId] ?? 0;
    if (stars > previous) {
      this.stats.challengeStars[challengeId] = stars;
      this.dirty = true;
    }
  }

  totalStars() {
    return Object.values(this.stats.challengeStars ?? {}).reduce((sum, s) => sum + s, 0);
  }

  /** Called from the scene update loop; writes at most every ~2 seconds. */
  tick(dt) {
    this.saveTimer -= dt;
    if (this.dirty && this.saveTimer <= 0) {
      this.saveTimer = 2;
      this.save();
    }
  }

  save() {
    if (!this.persist) return true;
    this.dirty = false;
    return this.store.writeJSON(STORAGE_KEYS.progress, {
      ...this.stats,
      savedAt: Date.now(),
    });
  }

  reset() {
    this.stats = { ...DEFAULT_STATS, challengeStars: {}, gravityPresetIds: [], achievements: [] };
    this.dirty = true;
    this.save();
    bus.emit('stats:reset');
  }
}

export { EVENTS };
