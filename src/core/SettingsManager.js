/**
 * User settings: audio, video quality, grid, simulation and key bindings.
 * Persisted to localStorage and merged defensively with the defaults.
 */

import { DEFAULT_SETTINGS, STORAGE_KEYS, QUALITY_PRESETS } from '../config/gameConfig.js';
import { storage } from './storage.js';
import { bool, num, sanitizeId } from '../utils/validation.js';
import { bus, EVENTS } from '../utils/events.js';

const KEY_WHITELIST = new Set(Object.keys(DEFAULT_SETTINGS.keybindings));

function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_SETTINGS.keybindings } };
  if (!raw || typeof raw !== 'object') return out;

  out.masterVolume = num(raw.masterVolume, out.masterVolume, 0, 1);
  out.musicVolume = num(raw.musicVolume, out.musicVolume, 0, 1);
  out.sfxVolume = num(raw.sfxVolume, out.sfxVolume, 0, 1);
  out.musicEnabled = bool(raw.musicEnabled, out.musicEnabled);
  out.sfxEnabled = bool(raw.sfxEnabled, out.sfxEnabled);
  out.particles = bool(raw.particles, out.particles);
  out.screenShake = bool(raw.screenShake, out.screenShake);
  out.quality = QUALITY_PRESETS[raw.quality] ? raw.quality : out.quality;
  out.showGrid = bool(raw.showGrid, out.showGrid);
  out.snapToGrid = bool(raw.snapToGrid, out.snapToGrid);
  out.gridSize = num(raw.gridSize, out.gridSize, 10, 200);
  out.simSpeed = num(raw.simSpeed, out.simSpeed, 0.05, 3);
  out.showFps = bool(raw.showFps, out.showFps);
  out.touchControls = ['auto', 'on', 'off'].includes(raw.touchControls) ? raw.touchControls : out.touchControls;
  out.cleanHud = bool(raw.cleanHud, out.cleanHud);
  out.confirmDestructive = bool(raw.confirmDestructive, out.confirmDestructive);
  out.ragdollPreset = sanitizeId(raw.ragdollPreset, out.ragdollPreset);
  out.showHints = bool(raw.showHints, out.showHints);
  out.motionTrails = bool(raw.motionTrails, out.motionTrails);

  if (raw.keybindings && typeof raw.keybindings === 'object') {
    for (const [action, keys] of Object.entries(raw.keybindings)) {
      if (!KEY_WHITELIST.has(action)) continue;
      if (!Array.isArray(keys)) continue;
      const cleaned = keys
        .filter((k) => typeof k === 'string' && /^[A-Za-z0-9+.\-_ ]{1,32}$/.test(k))
        .slice(0, 4);
      if (cleaned.length) out.keybindings[action] = cleaned;
    }
  }
  return out;
}

export class SettingsManager {
  constructor(store = storage) {
    this.storage = store;
    this.values = sanitizeSettings(this.storage.readJSON(STORAGE_KEYS.settings, null));
    this.profile = sanitizeSettings(this.storage.readJSON(`${STORAGE_KEYS.settings}.profile`, null));
  }

  get(key) {
    return this.values[key];
  }

  /** Quality preset resolved into concrete effect budgets. */
  get quality() {
    return QUALITY_PRESETS[this.values.quality] ?? QUALITY_PRESETS.medium;
  }

  getAll() {
    return { ...this.values, keybindings: { ...this.values.keybindings } };
  }

  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return false;
    this.values = sanitizeSettings({ ...this.values, [key]: value });
    this.save();
    bus.emit('settings:changed', { key, value: this.values[key] });
    return true;
  }

  setMany(patch) {
    this.values = sanitizeSettings({ ...this.values, ...patch });
    this.save();
    bus.emit('settings:changed', { key: '*', value: null });
  }

  bind(action, keys) {
    if (!KEY_WHITELIST.has(action)) return false;
    this.values.keybindings[action] = Array.isArray(keys) ? keys.slice(0, 4) : [keys];
    this.save();
    bus.emit('settings:changed', { key: 'keybindings', value: action });
    return true;
  }

  resetBindings() {
    this.values.keybindings = { ...DEFAULT_SETTINGS.keybindings };
    this.save();
    bus.emit('settings:changed', { key: 'keybindings', value: '*' });
  }

  /** Merge the current settings into the persisted profile blob. */
  saveProfileData(patch) {
    this.profile = { ...this.profile, ...patch };
    this.storage.writeJSON(`${STORAGE_KEYS.settings}.profile`, this.profile);
    return this.profile;
  }

  save() {
    this.storage.writeJSON(STORAGE_KEYS.settings, this.values);
  }

  resetAll() {
    this.values = sanitizeSettings(null);
    this.save();
    bus.emit('settings:changed', { key: '*', value: null });
  }
}

export { sanitizeSettings };
