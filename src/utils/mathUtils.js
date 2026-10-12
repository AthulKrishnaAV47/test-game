/**
 * Small numeric / structural helpers used across the game.
 */

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

export const lerp = (a, b, t) => a + (b - a) * t;

export const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));

export const round = (value, decimals = 2) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

export const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export const degrees = (radians) => (radians * 180) / Math.PI;

export const radians = (deg) => (deg * Math.PI) / 180;

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function moveToward(current, target, maxDelta) {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

/** Deterministic pseudo random generator (mulberry32) for reproducible scenes. */
export function createRng(seed = 1) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng, min, max) => min + rng() * (max - min);

export const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

/** Average of an array of numbers (0 for empty arrays). */
export function average(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Format an integer with thin separators: 1234567 -> 1,234,567 */
export const formatNumber = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = Math.floor(s % 60);
  return `${m}:${rest.toString().padStart(2, '0')}`;
}
