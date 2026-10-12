/**
 * Coordinate helpers.
 *
 * The game uses three coordinate spaces:
 *  - world space (physics/matter space),
 *  - camera/screen space (canvas pixels),
 *  - DOM space (UI panel pixels; the canvas fills the whole viewport so DOM and
 *    screen space share the same origin).
 *
 * Phaser's Camera stores `scrollX/scrollY` as the world position of the view's
 * top-left corner at zoom 1, and `worldView` as the visible world rectangle
 * (zoom aware). All conversions in the game go through these helpers so zooming
 * and panning can never desync picking from rendering.
 */

import { CAMERA, WORLD } from '../config/gameConfig.js';
import { clamp } from './mathUtils.js';

export const screenToWorld = (camera, screenX, screenY) => camera.getWorldPoint(screenX, screenY);

export const worldToScreen = (camera, worldX, worldY) => ({
  x: (worldX - camera.worldView.x) * camera.zoom,
  y: (worldY - camera.worldView.y) * camera.zoom,
});

/** Clamp a zoom value to the configured limits. */
export const clampZoom = (zoom, min = CAMERA.minZoom, max = CAMERA.maxZoom) =>
  clamp(Number.isFinite(zoom) ? zoom : CAMERA.defaultZoom, min, max);

/** Clamp camera scroll so the view never leaves the world. */
export function clampCameraToWorld(camera) {
  if (typeof camera.clampX === 'function') {
    camera.scrollX = camera.clampX(camera.scrollX);
    camera.scrollY = camera.clampY(camera.scrollY);
  }
}

/**
 * Zoom the camera around a screen-space anchor so the world point under the
 * cursor stays put. Returns the applied zoom.
 */
export function zoomAround(camera, screenX, screenY, targetZoom) {
  const before = camera.getWorldPoint(screenX, screenY);
  const applied = clampZoom(targetZoom);
  camera.setZoom(applied);
  const after = camera.getWorldPoint(screenX, screenY);
  camera.scrollX += before.x - after.x;
  camera.scrollY += before.y - after.y;
  clampCameraToWorld(camera);
  return applied;
}

/** Pan the camera by a screen-space delta (right-drag panning). */
export function panCamera(camera, dxScreen, dyScreen) {
  camera.scrollX -= dxScreen / camera.zoom;
  camera.scrollY -= dyScreen / camera.zoom;
  clampCameraToWorld(camera);
}

/** Snap a world point to the grid if snapping is enabled. */
export const snapPoint = (x, y, gridSize, enabled) => {
  if (!enabled || !gridSize) return { x, y };
  return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
};

export const snapValue = (v, gridSize, enabled) => (enabled && gridSize ? Math.round(v / gridSize) * gridSize : v);

/** Matter angles are already radians/clockwise, matching Phaser rotation. */
export const matterAngleToRotation = (angle) => (Number.isFinite(angle) ? angle : 0);

/** Clamp a point into the world rectangle. */
export const clampToWorldRect = (x, y, margin = 0) => ({
  x: clamp(Number.isFinite(x) ? x : 0, margin, WORLD.width - margin),
  y: clamp(Number.isFinite(y) ? y : 0, margin, WORLD.height - margin),
});

export { WORLD };
