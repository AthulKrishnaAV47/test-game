/**
 * previews.js — library thumbnails drawn with the real object drawers.
 *
 * Each preview is a small `<canvas>` where the object's own drawer paints the
 * artwork, scaled to fit. Because it reuses `drawObject`, a thumbnail can never
 * drift away from what the object actually looks like in the world.
 */

import { drawObject } from '../render/drawers.js';
import { CanvasGraphics } from '../render/CanvasGraphics.js';
import { getDef } from '../config/objectCatalog.js';
import { MATERIALS } from '../config/gameConfig.js';
import { shade } from '../utils/colorUtils.js';

export const PREVIEW_BACKGROUND = '#0d1730';

/**
 * Draw a catalogue object into a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {object|string} defOrId
 * @param {{size?: number, dpr?: number, padding?: number, background?: string|null}} options
 */
export function drawDefPreview(canvas, defOrId, options = {}) {
  const def = typeof defOrId === 'string' ? getDef(defOrId) : defOrId;
  if (!canvas || !def) return null;
  const size = options.size ?? (canvas.clientWidth || 40);
  const dpr = options.dpr ?? Math.min(2, window.devicePixelRatio || 1);
  const padding = options.padding ?? 0.22;
  const px = Math.max(18, Math.round(size * dpr));
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  if (options.background !== null) {
    ctx.fillStyle = options.background ?? PREVIEW_BACKGROUND;
    ctx.fillRect(0, 0, px, px);
  }

  const g = new CanvasGraphics(ctx);
  const visual = defVisual(def, px, padding);
  ctx.save();
  ctx.translate(px / 2, px / 2);
  drawObject(g, { def, type: def.id, color: visual.color }, visual);
  ctx.restore();
  return canvas;
}

/** Geometry + colour used for a definition's preview/thumbnail. */
export function defVisual(def, box = 44, padding = 0.22) {
  const mat = MATERIALS[def.material] ?? MATERIALS.wood;
  let w = def.size?.w ?? (def.size?.r ? def.size.r * 2 : 44);
  let h = def.size?.h ?? (def.size?.r ? def.size.r * 2 : 44);
  if (def.shape === 'poly' && def.size?.points?.length) {
    const xs = def.size.points.map((p) => p[0]);
    const ys = def.size.points.map((p) => p[1]);
    w = Math.max(...xs) - Math.min(...xs);
    h = Math.max(...ys) - Math.min(...ys);
  }
  const scale = (box * (1 - padding * 2)) / Math.max(w, h, 1);
  return {
    x: 0,
    y: 0,
    angle: 0,
    w: w * scale,
    h: h * scale,
    r: (def.size?.r ?? Math.min(w, h) / 2) * scale,
    color: def.color ?? mat.debrisColor ?? '#c8964f',
    entity: { def, color: def.color ?? '#c8964f' },
    shadows: false,
    dynamic: false,
    flash: 0,
    ratio: 1,
    time: 0,
    scale,
  };
}

/** Create a ready-to-use preview canvas element. */
export function previewCanvas(defOrId, size = 34) {
  const canvas = document.createElement('canvas');
  canvas.className = 'preview-canvas';
  drawDefPreview(canvas, defOrId, { size });
  return canvas;
}

/** Small colour chip preview used in the inspector/level select. */
export function levelPreviewCanvas(level, width = 190, height = 74) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  const palette = level.palette;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = shade(palette.groundEdge, -0.05);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  for (let x = 0; x <= width; x += 18) {
    ctx.lineTo(x, height * 0.7 + Math.sin(x * 0.05) * 5);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.platform;
  ctx.beginPath();
  ctx.roundRect(width * 0.12, height * 0.58, width * 0.26, 7, 3);
  ctx.roundRect(width * 0.58, height * 0.44, width * 0.3, 7, 3);
  ctx.fill();

  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.3, 6, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}
