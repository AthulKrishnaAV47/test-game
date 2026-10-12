/**
 * device.js — capability detection used for the default quality setting.
 *
 * The result only seeds the initial setting: the player can always override it
 * from the settings panel, and nothing else in the game depends on it.
 */

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
    || 'ontouchstart' in window
    || (navigator?.maxTouchPoints ?? 0) > 1;
}

export function isLowPowerDevice() {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;
  return cores <= 2 || memory <= 2;
}

/** 'low' | 'medium' | 'high' — the default quality preset for this device. */
export function detectQuality() {
  if (isLowPowerDevice()) return 'low';
  if (isTouchDevice()) return 'medium';
  return 'high';
}

export function prefersReducedMotion() {
  return Boolean(window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}
