/**
 * CameraController — pan, zoom, focus and follow behaviour.
 *
 * Uses Phaser's camera bounds so the view can never drift outside the level;
 * `zoomAround` keeps the world point under the cursor fixed while zooming.
 */

import { CAMERA, WORLD } from '../config/gameConfig.js';
import { clampZoom, zoomAround, panCamera, clampCameraToWorld } from '../utils/coordinateUtils.js';
import { clamp } from '../utils/mathUtils.js';

export class CameraController {
  constructor(ctx) {
    this.ctx = ctx;
    this.camera = ctx.scene.cameras.main;
    this.follow = null;
    this.followEnabled = false;
    this.panSpeed = 900;
  }

  setup() {
    this.camera.setBounds(0, 0, WORLD.width, WORLD.height);
    this.camera.setZoom(CAMERA.defaultZoom);
    this.centerOn(WORLD.width / 2, WORLD.height / 2);
  }

  centerOn(x, y) {
    const cam = this.camera;
    cam.scrollX = x - cam.width / (2 * cam.zoom);
    cam.scrollY = y - cam.height / (2 * cam.zoom);
    clampCameraToWorld(cam);
  }

  focusOn(point, { zoom = null, smooth = false } = {}) {
    if (!point) return;
    if (zoom) cam_setZoom(this.camera, zoom);
    this.centerOn(point.x, point.y);
    if (smooth) {
      this.camera.pan(point.x, point.y, 260, 'Sine.easeInOut');
    }
  }

  focusRect(rect, padding = 160) {
    if (!rect) return;
    const zoomX = this.camera.width / (rect.w + padding * 2);
    const zoomY = this.camera.height / (rect.h + padding * 2);
    const zoom = clampZoom(Math.min(zoomX, zoomY));
    this.camera.setZoom(zoom);
    this.centerOn(rect.x, rect.y);
  }

  zoomBy(deltaFactor, screenX, screenY) {
    const next = clampZoom(this.camera.zoom * deltaFactor);
    zoomAround(this.camera, screenX, screenY, next);
    return this.camera.zoom;
  }

  setZoom(z, screenX, screenY) {
    const cx = screenX ?? this.camera.width / 2;
    const cy = screenY ?? this.camera.height / 2;
    return zoomAround(this.camera, cx, cy, clampZoom(z));
  }

  pan(dxScreen, dyScreen) {
    panCamera(this.camera, dxScreen, dyScreen);
  }

  followEntity(entity, enabled = true) {
    this.follow = entity;
    this.followEnabled = enabled && Boolean(entity);
  }

  update(dt, input) {
    // Keyboard camera panning (held arrow keys with the camera modifier key).
    if (input?.cameraPan?.active) {
      const p = input.cameraPan;
      this.pan(p.x * this.panSpeed * dt / this.camera.zoom, p.y * this.panSpeed * dt / this.camera.zoom);
    }
    if (this.followEnabled && this.follow && !this.follow.removed) {
      const center = this.follow.center?.() ?? this.follow.position;
      const cam = this.camera;
      const midX = cam.scrollX + cam.width / 2;
      const midY = cam.scrollY + cam.height / 2;
      const dx = center.x - midX;
      const dy = center.y - midY;
      const deadzone = 90;
      if (Math.abs(dx) > deadzone || Math.abs(dy) > deadzone) {
        const k = clamp(dt * 4, 0, 1);
        cam.scrollX += (dx - Math.sign(dx) * deadzone * 0) * k;
        cam.scrollY += (dy - Math.sign(dy) * deadzone * 0) * k;
        clampCameraToWorld(cam);
      }
    }
    this.applyShake();
  }

  applyShake() {
    const effects = this.ctx.effects;
    if (!effects) return;
    const amount = clamp(effects.shakeAmount, 0, 1.6);
    if (amount <= 0.001) return;
    const cam = this.camera;
    cam.setScroll(
      cam.scrollX + (Math.random() - 0.5) * amount * 14,
      cam.scrollY + (Math.random() - 0.5) * amount * 14
    );
  }

  get zoom() {
    return this.camera.zoom;
  }

  get worldCenter() {
    return { x: this.camera.midPoint.x, y: this.camera.midPoint.y };
  }
}

function cam_setZoom(cam, zoom) {
  cam.setZoom(clampZoom(zoom));
}
