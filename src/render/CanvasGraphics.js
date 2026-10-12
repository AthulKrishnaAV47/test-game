/**
 * CanvasGraphics — a tiny Phaser-Graphics-compatible adapter for 2D canvases.
 *
 * The object drawers in `drawers.js` paint into a Phaser Graphics object. The
 * library panel, the level select screen and the character studio need the very
 * same artwork inside small `<canvas>` thumbnails, so this adapter implements
 * the subset of the Graphics API the drawers use and forwards it to a
 * CanvasRenderingContext2D. One drawing implementation, two destinations.
 */

import { withAlpha } from '../utils/colorUtils.js';

const isPoint = (p) => Array.isArray(p) ? { x: p[0], y: p[1] } : p;

export class CanvasGraphics {
  constructor(ctx) {
    this.ctx = ctx;
    this.path = [];
    this.fillColour = '#ffffff';
    this.fillAlpha = 1;
    this.strokeColour = '#000000';
    this.strokeAlpha = 1;
    this.lineWidth = 1;
    this.stack = [];
  }

  /* ------------------------------------------------------------- transforms */

  save() {
    this.stack.push({ tx: this.ctx.getTransform?.() ?? null, fill: this.fillColour, stroke: this.strokeColour });
    this.ctx.save();
  }

  restore() {
    this.stack.pop();
    this.ctx.restore();
  }

  translate(x, y) { this.ctx.translate(x, y); }
  rotate(radians) { this.ctx.rotate(radians); }
  scale(x, y = x) { this.ctx.scale(x, y); }

  /* ------------------------------------------------------------------ style */

  fillStyle(colour, alpha = 1) {
    this.fillColour = colour;
    this.fillAlpha = alpha;
    this.ctx.fillStyle = alpha >= 1 ? colour : withAlpha(colour, alpha);
  }

  lineStyle(width = 1, colour = '#000000', alpha = 1) {
    this.lineWidth = width;
    this.strokeColour = colour;
    this.strokeAlpha = alpha;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = alpha >= 1 ? colour : withAlpha(colour, alpha);
  }

  /* ------------------------------------------------------------------- path */

  beginPath() {
    this.path = [];
    this.ctx.beginPath();
  }

  moveTo(x, y) {
    this.path.push({ x, y });
    this.ctx.moveTo(x, y);
  }

  lineTo(x, y) {
    this.path.push({ x, y });
    this.ctx.lineTo(x, y);
  }

  closePath() {
    this.ctx.closePath();
  }

  strokePath() {
    this.ctx.stroke();
  }

  fillPath() {
    this.ctx.fill();
  }

  /* ---------------------------------------------------------------- shapes */

  fillRect(x, y, w, h) {
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h) {
    this.ctx.strokeRect(x, y, w, h);
  }

  fillCircle(x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    this.ctx.fill();
  }

  strokeCircle(x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    this.ctx.stroke();
  }

  fillEllipse(x, y, width, height) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.max(0.01, width / 2), Math.max(0.01, height / 2), 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  strokeEllipse(x, y, width, height) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.max(0.01, width / 2), Math.max(0.01, height / 2), 0, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  fillTriangle(x1, y1, x2, y2, x3, y3) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    this.ctx.fill();
  }

  strokeTriangle(x1, y1, x2, y2, x3, y3) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  fillPoints(points = [], closeShape = true) {
    if (points.length < 2) return;
    this.ctx.beginPath();
    points.map(isPoint).forEach((p, i) => (i ? this.ctx.lineTo(p.x, p.y) : this.ctx.moveTo(p.x, p.y)));
    if (closeShape) this.ctx.closePath();
    this.ctx.fill();
  }

  strokePoints(points = [], closeShape = true) {
    if (points.length < 2) return;
    this.ctx.beginPath();
    points.map(isPoint).forEach((p, i) => (i ? this.ctx.lineTo(p.x, p.y) : this.ctx.moveTo(p.x, p.y)));
    if (closeShape) this.ctx.closePath();
    this.ctx.stroke();
  }

  fillRoundedRect(x, y, w, h, radius = 0) {
    const r = Math.max(0, Math.min(radius, Math.min(Math.abs(w), Math.abs(h)) / 2));
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  strokeRoundedRect(x, y, w, h, radius = 0) {
    const r = Math.max(0, Math.min(radius, Math.min(Math.abs(w), Math.abs(h)) / 2));
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }
}

export default CanvasGraphics;
