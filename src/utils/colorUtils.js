/**
 * Colour helpers for the procedural renderer.
 * Everything works on `#rrggbb` strings — no canvas allocation, no Phaser
 * dependency, so the same helpers run in Node tests.
 */

const hexToRgb = (hex) => {
  const clean = typeof hex === 'string' ? hex.replace('#', '') : 'cccccc';
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, 'c').slice(0, 6);
  const value = parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 204, g: 204, b: 204 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

export const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`;

/** Darken (amount < 0) or lighten (amount > 0) a colour. */
export function shade(hex, amount = -0.2) {
  const { r, g, b } = hexToRgb(hex);
  if (amount < 0) {
    const k = 1 + amount;
    return rgbToHex({ r: r * k, g: g * k, b: b * k });
  }
  return rgbToHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

/** Mix a colour toward white by `amount` (alias of a positive shade). */
export const tint = (hex, amount = 0.2) => shade(hex, Math.abs(amount));

/** Mix two colours (t = 0 → a, t = 1 → b). */
export function mix(a, b, t = 0.5) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

/** `#rrggbb` + alpha as an `rgba()` string (Phaser Graphics accepts both). */
export function withAlpha(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

/** Readable ink colour (black/white) for a given background. */
export function readableInk(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? '#22384d' : '#f7f3e8';
}

/** Interpolate a multi-stop gradient (used by the layered backgrounds). */
export function gradientStops(stops, t) {
  if (!stops?.length) return '#ffffff';
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  return mix(stops[index], stops[index + 1], scaled - index);
}

export const palette = {
  ink: '#22384d',
  paper: '#f7f3e8',
  accent: '#ff7a59',
  good: '#38e07b',
  warn: '#ffd23f',
  bad: '#e0364a',
  info: '#57c8ff',
  magic: '#a77bff',
};
