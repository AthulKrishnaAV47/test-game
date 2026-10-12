/**
 * Persistence layer.
 *
 * Wraps localStorage behind a tiny interface so tests (and browsers where
 * storage is blocked, e.g. private mode with cookies disabled) can swap in an
 * in-memory backend. Every read is defensive: corrupted values fall back to the
 * supplied default instead of breaking startup.
 */

import { safeJsonParse, isPlainObject } from '../utils/validation.js';

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
  };
}

/** Detect a usable localStorage (Safari private mode throws on write). */
function detectBackend() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return createMemoryStorage();
    const probe = '__sticklab_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (err) {
    console.warn('[storage] localStorage unavailable, using memory storage:', err?.message);
    return createMemoryStorage();
  }
}

export class Storage {
  constructor(backend = detectBackend()) {
    this.backend = backend;
    this.available = backend !== null;
  }

  setBackend(backend) {
    this.backend = backend;
  }

  readRaw(key) {
    try {
      return this.backend?.getItem(key) ?? null;
    } catch (err) {
      console.warn(`[storage] read failed for ${key}`, err?.message);
      return null;
    }
  }

  writeRaw(key, value) {
    try {
      this.backend?.setItem(key, value);
      return true;
    } catch (err) {
      // Quota exceeded / disabled storage: surface but do not crash.
      console.warn(`[storage] write failed for ${key}`, err?.message);
      return false;
    }
  }

  remove(key) {
    try {
      this.backend?.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  /** Read + parse JSON with a defensive fallback. */
  readJSON(key, fallback) {
    const raw = this.readRaw(key);
    if (raw === null || raw === undefined || raw === '') return fallback;
    const parsed = safeJsonParse(raw);
    if (!parsed.ok || !isPlainObject(parsed.value) && !Array.isArray(parsed.value)) {
      console.warn(`[storage] corrupted data at ${key}; using defaults.`);
      return fallback;
    }
    return parsed.value;
  }

  writeJSON(key, value) {
    try {
      return this.writeRaw(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[storage] serialisation failed for ${key}`, err?.message);
      return false;
    }
  }
}

export const storage = new Storage();
