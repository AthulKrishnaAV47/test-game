/**
 * Renderer — draws the whole world procedurally into Phaser Graphics layers.
 *
 * Layers (bottom → top):
 *   1. sky      gradient + parallax hills/clouds          (screen-space)
 *   2. decor    level decorations (windows, pipes, trees…)
 *   3. grid     optional snap grid
 *   4. objects  props and contraptions
 *   5. actors   ragdolls (clothes, faces, hats)
 *   6. links    ropes, chains, springs, joints
 *   7. fx       particles, rings, screen flash
 *   8. ui       selection outlines, force arrow, marquee, ghosts
 *
 * Nothing here mutates simulation state, and off-screen objects are culled, so
 * the cost stays proportional to what the player can actually see.
 */

import { drawObject } from './drawers.js';
import { PART_LAYOUT } from '../physics/RagdollFactory.js';
import { withAlpha, mix, shade } from '../utils/colorUtils.js';
import { clamp } from '../utils/mathUtils.js';
import { getLevel } from '../config/levels.js';

const RENDER_DISTANCE = 140;

export class Renderer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.ctx = world.ctx;
    this.time = 0;

    this.skyLayer = scene.add.graphics().setDepth(0).setScrollFactor(0);
    this.decorLayer = scene.add.graphics().setDepth(1);
    this.gridLayer = scene.add.graphics().setDepth(2);
    this.objectLayer = scene.add.graphics().setDepth(3);
    this.actorLayer = scene.add.graphics().setDepth(4);
    this.linkLayer = scene.add.graphics().setDepth(5);
    this.fxLayer = scene.add.graphics().setDepth(6);
    this.uiLayer = scene.add.graphics().setDepth(7);
    this.overlay = scene.add.graphics().setDepth(9).setScrollFactor(0);

    this.level = getLevel(this.world.levelId);
    this.particles = [];
    this.forceArrow = null;
    this.marquee = null;
    this.pendingPlatform = null;
    this.ropePreview = null;
    this.hoverEntity = null;
    this.ghost = null;
    this.gridEnabled = scene.game?.settings?.get?.('showGrid') ?? false;
    this._time = 0;
  }

  setLevel(levelId) {
    this.level = getLevel(levelId);
    this.ambient = [];
    const palette = this.level.palette;
    for (let i = 0; i < 26; i += 1) {
      this.ambient.push({
        x: Math.random() * 4200,
        y: Math.random() * 2400,
        r: 2 + Math.random() * 5,
        speed: 4 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.2 + Math.random() * 0.4,
      });
    }
    this.ambientColor = palette.accent ?? '#ffffff';
  }

  setGridEnabled(enabled) {
    this.gridEnabled = Boolean(enabled);
  }

  setHover(entity) {
    this.hoverEntity = entity ?? null;
  }

  drawMarquee(rect) {
    this.marquee = rect ? { ...rect } : null;
  }

  drawForceArrow(arrow) {
    this.forceArrow = arrow ? { ...arrow } : null;
  }

  drawPendingPlatform(pending) {
    this.pendingPlatform = pending ? { ...pending } : null;
  }

  drawRopePreview(preview) {
    this.ropePreview = preview ? { ...preview } : null;
  }

  drawSpawnGhost(type, position, valid = true) {
    this.ghost = type ? { type, position, valid } : null;
  }

  /* ------------------------------------------------------------- utilities */

  get camera() {
    return this.scene.cameras.main;
  }

  isVisible(bounds) {
    const view = this.camera.worldView;
    return bounds.maxX > view.x - RENDER_DISTANCE
      && bounds.minX < view.right + RENDER_DISTANCE
      && bounds.maxY > view.y - RENDER_DISTANCE
      && bounds.minY < view.bottom + RENDER_DISTANCE;
  }

  bodyVisual(body, entity, palette = null) {
    const shadows = this.ctx.settings?.get('quality') !== 'low';
    return {
      x: body.position.x,
      y: body.position.y,
      angle: body.angle,
      w: body.drawW ?? (body.circleRadius ? body.circleRadius * 2 : 40),
      h: body.drawH ?? (body.circleRadius ? body.circleRadius * 2 : 40),
      r: body.drawR ?? body.circleRadius ?? 18,
      color: palette ?? entity?.color ?? '#c8964f',
      entity,
      time: this.time,
      shadows,
      dynamic: !body.isStatic,
      flash: entity?.damageFlash ?? 0,
      ratio: entity?.hp && entity?.maxHp ? clamp(entity.hp / entity.maxHp, 0, 1) : 1,
    };
  }

  /* ------------------------------------------------------------------ draw */

  draw(dt) {
    this.time += dt;
    for (const layer of [this.decorLayer, this.gridLayer, this.objectLayer, this.actorLayer, this.linkLayer, this.fxLayer, this.uiLayer, this.overlay]) {
      layer.clear();
    }
    this.drawSky();
    this.drawDecor();
    if (this.gridEnabled) this.drawGrid();
    this.drawObjects();
    this.drawActors();
    this.drawLinks();
    this.drawEffects();
    this.drawOverlays();
  }

  /* ------------------------------------------------------------ background */

  drawSky() {
    const g = this.skyLayer;
    const cam = this.camera;
    const w = cam.width;
    const h = cam.height;
    const palette = this.level.palette;
    g.fillGradientStyle(
      hexToInt(palette.skyTop),
      hexToInt(palette.skyTop),
      hexToInt(palette.skyBottom),
      hexToInt(palette.skyBottom),
      1
    );
    g.fillRect(0, 0, w, h);

    // Parallax hills / horizon band.
    const scrollY = cam.scrollY * 0.12;
    const horizon = h * 0.62 - scrollY * 0.5;
    g.fillStyle(hexToInt(shade(palette.ground, 0.28)), 0.55);
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 0.31 + 0.12) * w) - (cam.scrollX * 0.08) % (w * 1.4);
      g.fillCircle(cx, horizon + 40, w * 0.22);
    }
    g.fillStyle(hexToInt(palette.ground), 1);
    g.fillRect(0, horizon + 60, w, h - horizon);

    // Sun / lamp glow.
    const glow = g.fillStyle ? null : null;
    g.fillStyle(hexToInt(palette.accent), 0.16);
    g.fillCircle(w * 0.82 - (cam.scrollX * 0.03) % w, h * 0.18, 120 + Math.sin(this.time * 1.4) * 6);
    g.fillStyle(hexToInt(palette.accent), 0.3);
    g.fillCircle(w * 0.82 - (cam.scrollX * 0.03) % w, h * 0.18, 74);

    // Ambient particles (bubbles / dust / sparks / stars …).
    const kind = this.level.ambient ?? 'dust';
    const colour = kind === 'sparks' ? '#ffcf7a' : kind === 'stars' ? '#eaf4ff' : kind === 'leaves' ? '#7fd48f' : this.ambientColor;
    if (!this.ambient) this.setLevel(this.level.id);
    for (const p of this.ambient) {
      p.phase += dt * 0.8;
      const sx = p.x - cam.scrollX * 0.35;
      const sy = p.y - cam.scrollY * 0.35 + Math.sin(p.phase) * 18;
      const x = ((sx % (w + 200)) + w + 200) % (w + 200) - 100;
      const y = ((sy % (h + 200)) + h + 200) % (h + 200) - 100;
      g.fillStyle(hexToInt(colour), p.alpha * 0.7);
      if (kind === 'stars' || kind === 'sparks') {
        g.fillCircle(x, y, Math.max(1, p.r * 0.4) * (1 + Math.sin(p.phase * 3) * 0.3));
      } else {
        g.fillCircle(x, y, p.r);
      }
    }
    void glow;
  }

  drawDecor() {
    const g = this.decorLayer;
    const palette = this.level.palette;
    const cam = this.camera.worldView;
    for (const d of this.level.decorations ?? []) {
      const bounds = { minX: d.x - d.w / 2, maxX: d.x + d.w / 2, minY: d.y - d.h / 2, maxY: d.y + d.h / 2 };
      if (!this.isVisible(bounds)) continue;
      switch (d.kind) {
        case 'window':
          g.fillStyle(hexToInt(shade(palette.skyTop, 0.05)), 0.9);
          g.fillRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 12);
          g.lineStyle(8, hexToInt(palette.platformEdge), 1);
          g.strokeRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 12);
          g.lineStyle(4, hexToInt(palette.platformEdge), 0.6);
          g.beginPath();
          g.moveTo(d.x, d.y - d.h / 2);
          g.lineTo(d.x, d.y + d.h / 2);
          g.strokePath();
          break;
        case 'pipe':
          g.fillStyle(hexToInt(shade(palette.groundEdge, 0.1)), 1);
          g.fillRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, d.w / 2);
          g.fillStyle(hexToInt(palette.accent), 0.5);
          g.fillRect(d.x - d.w / 2, d.y - 14, d.w, 10);
          break;
        case 'lamp': {
          const swing = Math.sin(this.time * 1.2) * 3;
          g.lineStyle(5, '#5b6672', 1);
          g.beginPath();
          g.moveTo(d.x, d.y - d.h / 2);
          g.lineTo(d.x + swing, d.y + d.h / 2);
          g.strokePath();
          g.fillStyle(hexToInt('#ffd23f'), 0.95);
          g.fillCircle(d.x + swing, d.y + d.h / 2 + 12, 12);
          g.fillStyle(hexToInt('#ffd23f'), 0.14 + Math.sin(this.time * 2 + d.x) * 0.03);
          g.fillCircle(d.x + swing, d.y + d.h / 2 + 12, 64);
          break;
        }
        case 'shelf':
          g.fillStyle(hexToInt(palette.groundEdge), 1);
          g.fillRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 4);
          for (let i = 0; i < 4; i += 1) {
            g.fillStyle(hexToInt(i % 2 ? palette.accent : palette.platform), 0.9);
            g.fillRect(d.x - d.w / 2 + 12 + i * (d.w / 5), d.y - d.h / 2 - 26, d.w / 8, 26);
          }
          break;
        case 'machine':
          g.fillStyle(hexToInt(shade(palette.ground, -0.1)), 1);
          g.fillRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 10);
          g.fillStyle(hexToInt(palette.accent), 0.85);
          g.fillRoundedRect(d.x - d.w * 0.32, d.y - d.h * 0.36, d.w * 0.64, d.h * 0.3, 6);
          g.lineStyle(3, hexToInt(palette.platformEdge), 0.9);
          for (let i = 0; i < 3; i += 1) {
            g.strokeRect(d.x - d.w * 0.3, d.y - d.h * 0.02 + i * 22, 26, 14);
          }
          break;
        case 'crate':
          this.drawStaticBox(g, d, palette.platform, 6);
          break;
        case 'plant': {
          g.fillStyle(hexToInt('#7a5a3a'), 1);
          g.fillRoundedRect(d.x - d.w * 0.3, d.y + d.h * 0.1, d.w * 0.6, d.h * 0.5, 6);
          g.fillStyle(hexToInt('#3fa564'), 1);
          for (let i = -1; i <= 1; i += 1) {
            g.fillEllipse(d.x + i * d.w * 0.28, d.y - d.h * 0.1 + Math.abs(i) * 12, d.w * 0.5, d.h * 0.7);
          }
          break;
        }
        case 'tree': {
          g.fillStyle(hexToInt('#6b4a2c'), 1);
          g.fillRoundedRect(d.x - 12, d.y - 10, 24, d.h * 0.7, 6);
          g.fillStyle(hexToInt('#3f9e5f'), 1);
          g.fillCircle(d.x, d.y - d.h * 0.3, d.w * 0.5);
          g.fillStyle(hexToInt('#4fbf72'), 1);
          g.fillCircle(d.x - d.w * 0.22, d.y - d.h * 0.42, d.w * 0.32);
          g.fillCircle(d.x + d.w * 0.2, d.y - d.h * 0.34, d.w * 0.28);
          break;
        }
        case 'swing':
          g.lineStyle(6, '#5b6672', 1);
          g.beginPath();
          g.moveTo(d.x - d.w / 2, d.y - d.h / 2);
          g.lineTo(d.x - d.w / 2, d.y + d.h / 2);
          g.moveTo(d.x + d.w / 2, d.y - d.h / 2);
          g.lineTo(d.x + d.w / 2, d.y + d.h / 2);
          g.moveTo(d.x - d.w / 2, d.y - d.h / 2);
          g.lineTo(d.x + d.w / 2, d.y - d.h / 2);
          g.strokePath();
          g.fillStyle(hexToInt(palette.accent), 1);
          g.fillRoundedRect(d.x - d.w * 0.2, d.y + d.h * 0.36, d.w * 0.4, 12, 4);
          break;
        case 'slide':
          g.fillStyle(hexToInt(palette.accent), 0.9);
          g.fillTriangle(d.x - d.w / 2, d.y - d.h / 2, d.x + d.w / 2, d.y + d.h / 2, d.x - d.w / 2, d.y + d.h / 2);
          break;
        case 'cloud':
          g.fillStyle(0xffffff, 0.85);
          g.fillCircle(d.x, d.y, d.h * 0.6);
          g.fillCircle(d.x - d.w * 0.28, d.y + 6, d.h * 0.45);
          g.fillCircle(d.x + d.w * 0.3, d.y + 4, d.h * 0.5);
          break;
        case 'island':
          g.fillStyle(hexToInt('#7fc07f'), 1);
          g.fillEllipse(d.x, d.y - d.h * 0.3, d.w, d.h * 0.6);
          g.fillStyle(hexToInt('#8a6a44'), 1);
          g.fillTriangle(d.x - d.w / 2, d.y - d.h * 0.1, d.x + d.w / 2, d.y - d.h * 0.1, d.x, d.y + d.h / 2);
          break;
        case 'planet':
          g.fillStyle(hexToInt(palette.accent), 0.35);
          g.fillCircle(d.x, d.y, d.w * 0.5);
          g.fillStyle(hexToInt(palette.platform), 0.45);
          g.fillCircle(d.x - d.w * 0.18, d.y - d.h * 0.12, d.w * 0.2);
          break;
        case 'satellite':
          g.fillStyle(hexToInt('#c3ccd6'), 1);
          g.fillRect(d.x - 14, d.y - 10, 28, 20);
          g.fillStyle(hexToInt(palette.accent), 1);
          g.fillRect(d.x - 46, d.y - 7, 26, 14);
          g.fillRect(d.x + 20, d.y - 7, 26, 14);
          break;
        case 'panel':
          g.fillStyle(hexToInt(palette.platform), 0.9);
          g.fillRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 8);
          g.lineStyle(2, hexToInt(palette.platformEdge), 0.8);
          for (let x = d.x - d.w / 2 + 10; x < d.x + d.w / 2 - 6; x += 18) {
            g.beginPath();
            g.moveTo(x, d.y - d.h / 2 + 4);
            g.lineTo(x, d.y + d.h / 2 - 4);
            g.strokePath();
          }
          break;
        case 'banner': {
          const wave = Math.sin(this.time * 2 + d.x * 0.01) * 4;
          g.fillStyle(hexToInt(palette.accent), 0.9);
          g.fillRect(d.x - d.w / 2, d.y - d.h / 2 + wave, d.w, d.h);
          g.fillStyle(0xffffff, 0.25);
          g.fillRect(d.x - d.w / 2, d.y - d.h / 2 + wave, d.w, 8);
          break;
        }
        case 'stars':
        default:
          break;
      }
    }
    void cam;
  }

  drawStaticBox(g, d, palette, round = 6) {
    g.fillStyle(hexToInt(palette), 1);
    g.fillRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, round);
    g.lineStyle(3, hexToInt(shade(palette, -0.3)), 0.9);
    g.strokeRoundedRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, round);
  }

  drawGrid() {
    const g = this.gridLayer;
    const step = 50;
    const view = this.camera.worldView;
    g.lineStyle(1, 0xffffff, 0.12);
    const startX = Math.floor(view.x / step) * step;
    const startY = Math.floor(view.y / step) * step;
    for (let x = startX; x < view.right + step; x += step) {
      g.beginPath();
      g.moveTo(x, view.y);
      g.lineTo(x, view.bottom);
      g.strokePath();
    }
    for (let y = startY; y < view.bottom + step; y += step) {
      g.beginPath();
      g.moveTo(view.x, y);
      g.lineTo(view.right, y);
      g.strokePath();
    }
  }

  /* --------------------------------------------------------------- objects */

  drawObjects() {
    const g = this.objectLayer;
    for (const entity of this.ctx.phys.entities) {
      if (entity.removed) continue;
      if (entity.kind === 'ragdoll') continue;
      const bounds = this.entityBounds(entity);
      if (!bounds || !this.isVisible(bounds)) continue;

      if (entity.kind === 'contraption') this.drawContraption(g, entity);
      else {
        for (const body of entity.getBodies()) {
          const visual = this.bodyVisual(body, entity);
          visual.dynamic = !body.isStatic;
          this.drawBody(g, body, visual);
        }
      }
      if (entity.damageFlash > 0.05) this.drawDamageFlash(g, entity);
      this.drawStatusBadges(g, entity);
    }
  }

  entityBounds(entity) {
    try {
      return entity.bounds();
    } catch {
      return null;
    }
  }

  drawBody(g, body, visual) {
    g.save();
    g.translateCanvas(visual.x, visual.y);
    g.rotateCanvas(visual.angle);
    drawObject(g, visual.entity, { ...visual, x: 0, y: 0 });
    g.restore();
  }

  drawContraption(g, entity) {
    const type = entity.def?.composite;
    if (type === 'rope' || type === 'chain') return this.drawRopeChain(g, entity);
    if (type === 'spring') return this.drawSpringEntity(g, entity);
    if (type === 'pulley') return this.drawPulley(g, entity);
    for (const body of entity.getBodies()) {
      const part = entity.parts.find((p) => p.body === body);
      const palette = type === 'piston' && part?.name === 'head' ? '#e0a13c' : undefined;
      this.drawBody(g, body, this.bodyVisual(body, entity, palette));
    }
  }

  drawRopeChain(g, entity) {
    const links = entity.parts.filter((p) => p.name.startsWith('link'));
    const isChain = entity.type === 'chain';
    const color = isChain ? '#a9bdd3' : '#c99a5b';
    const points = links.map((p) => p.body.position);
    if (points.length < 2) return;
    g.lineStyle(isChain ? 7 : 5, hexToInt(color), 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y);
    g.strokePath();
    if (isChain) {
      g.fillStyle(hexToInt('#c9d6e4'), 1);
      for (const p of points) g.fillCircle(p.x, p.y, 4);
    }
  }

  drawSpringEntity(g, entity) {
    const base = entity.state?.spring?.base;
    const top = entity.state?.spring?.top;
    if (!base || !top) return;
    const x1 = base.position.x;
    const y1 = base.position.y - 7;
    const x2 = top.position.x;
    const y2 = top.position.y + 7;
    const coils = 6;
    g.lineStyle(4, hexToInt('#ffd23f'), 1);
    g.beginPath();
    for (let i = 0; i <= coils * 2; i += 1) {
      const t = i / (coils * 2);
      const x = x1 + (x2 - x1) * t + (i % 2 === 0 ? -9 : 9);
      const y = y1 + (y2 - y1) * t;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
    this.drawBody(g, base, this.bodyVisual(base, entity, '#98a3ad'));
    this.drawBody(g, top, this.bodyVisual(top, entity, '#e0483c'));
  }

  drawPulley(g, entity) {
    const state = entity.state?.pulley;
    if (!state) return;
    this.drawBody(g, state.wheel ?? entity.getBodies()[0], this.bodyVisual(state.wheel ?? entity.getBodies()[0], entity, '#98a3ad'));
    g.lineStyle(3, hexToInt('#7a6a52'), 1);
    g.beginPath();
    g.moveTo(state.anchor.x, state.anchor.y);
    g.lineTo(state.bodyA.position.x, state.bodyA.position.y);
    g.moveTo(state.anchor.x, state.anchor.y);
    g.lineTo(state.bodyB.position.x, state.bodyB.position.y);
    g.strokePath();
    for (const body of [state.bodyA, state.bodyB]) {
      this.drawBody(g, body, this.bodyVisual(body, entity, '#d2a05c'));
    }
  }

  drawDamageFlash(g, entity) {
    const bounds = entity.bounds();
    g.fillStyle(0xff5a4a, Math.min(0.35, entity.damageFlash * 0.3));
    g.fillRoundedRect(bounds.minX - 3, bounds.minY - 3, bounds.w + 6, bounds.h + 6, 6);
  }

  /** Zone / field objects get a soft glow so they read as interactive. */
  drawStatusBadges(g, entity) {
    if (!entity.behavior) return;
    const bounds = entity.bounds();
    const pulse = 0.5 + Math.sin(this.time * 2.4) * 0.5;
    switch (entity.behavior) {
      case 'goal':
      case 'target':
      case 'hazard':
      case 'teleporter':
      case 'freeze':
      case 'slowmo':
      case 'gravityWell':
      case 'magnet':
      case 'wind':
      case 'bouncyPad':
      case 'spawnPad':
        g.lineStyle(2, hexToInt(this.level.palette.accent), 0.12 + pulse * 0.12);
        g.strokeRoundedRect(bounds.minX - 6, bounds.minY - 6, bounds.w + 12, bounds.h + 12, 10);
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------- actors */

  drawActors() {
    const g = this.actorLayer;
    for (const ragdoll of this.ctx.character.list()) {
      const bounds = ragdoll.bounds();
      if (!this.isVisible(bounds)) continue;
      this.drawRagdoll(g, ragdoll);
    }
  }

  drawRagdoll(g, ragdoll) {
    const cosmetic = ragdoll.cosmetic;
    const parts = ragdoll.parts;
    // Soft shadow on the ground under the character.
    if (this.ctx.settings?.get('quality') !== 'low') {
      const feet = ragdoll.partBody('footL') ?? ragdoll.chest;
      g.fillStyle(0x0d1b2a, 0.14);
      g.fillEllipse(feet.position.x, feet.position.y + 12, 74 * ragdoll.scale, 16 * ragdoll.scale);
    }
    for (const part of parts) {
      const { body, layout, name } = part;
      let color = cosmetic.skin;
      if (name === 'chest') color = cosmetic.shirt;
      if (name === 'pelvis' || name === 'thighL' || name === 'thighR') color = cosmetic.pants;
      if (name === 'shinL' || name === 'shinR') color = shade(cosmetic.pants, -0.15);
      if (name === 'footL' || name === 'footR') color = '#37404d';
      if (name === 'upperArmL' || name === 'upperArmR') color = cosmetic.shirt;
      const w = layout.shape === 'circle' ? layout.r * 2 * ragdoll.scale : layout.w * ragdoll.scale;
      const h = layout.shape === 'circle' ? layout.r * 2 * ragdoll.scale : layout.h * ragdoll.scale;
      g.save();
      g.translateCanvas(body.position.x, body.position.y);
      g.rotateCanvas(body.angle);
      if (layout.shape === 'circle') {
        g.fillStyle(hexToInt(color), 1);
        g.fillCircle(0, 0, w / 2);
        g.lineStyle(2, hexToInt(shade(color, -0.45)), 1);
        g.strokeCircle(0, 0, w / 2);
      } else {
        g.fillStyle(hexToInt(color), 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(layout.round ?? 3, Math.min(w, h) / 2));
        g.lineStyle(2, hexToInt(shade(color, -0.45)), 1);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(layout.round ?? 3, Math.min(w, h) / 2));
      }
      g.restore();
    }
    this.drawFace(g, ragdoll);
    if (ragdoll.damageFlash > 0.4) {
      const chest = ragdoll.chest;
      g.fillStyle(0xff5a4a, 0.2);
      g.fillCircle(chest.position.x, chest.position.y, 40 * ragdoll.scale);
    }
  }

  drawFace(g, ragdoll) {
    const head = ragdoll.head;
    const scale = ragdoll.scale;
    if (!head) return;
    g.save();
    g.translateCanvas(head.position.x, head.position.y);
    g.rotateCanvas(head.angle);
    const skin = hexToInt(ragdoll.cosmetic.skin);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-4.4 * scale, -1.5 * scale, 3.1 * scale);
    g.fillCircle(4.4 * scale, -1.5 * scale, 3.1 * scale);
    g.fillStyle(0x1b1f2a, 1);
    const expression = ragdoll.expression;
    const look = expression === 'scared' ? -0.8 : expression === 'happy' ? 0.4 : 0;
    g.fillCircle(-4.4 * scale, -1.5 * scale + look, 1.5 * scale * (expression === 'surprised' || expression === 'scared' ? 1.5 : 1));
    g.fillCircle(4.4 * scale, -1.5 * scale + look, 1.5 * scale * (expression === 'surprised' || expression === 'scared' ? 1.5 : 1));
    g.lineStyle(2, 0x1b1f2a, 1);
    if (expression === 'happy') {
      g.beginPath();
      g.arc(0, 3 * scale, 4.4 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokePath();
    } else if (expression === 'surprised' || expression === 'scared') {
      g.strokeCircle(0, 4 * scale, 2.6 * scale);
    } else if (expression === 'dizzy') {
      g.beginPath();
      g.moveTo(-4 * scale, 4 * scale);
      g.lineTo(4 * scale, 4 * scale);
      g.strokePath();
    } else {
      g.beginPath();
      g.moveTo(-3.6 * scale, 4 * scale);
      g.lineTo(3.6 * scale, 4 * scale);
      g.strokePath();
    }
    g.restore();
    this.drawAccessory(g, ragdoll, skin);
  }

  drawAccessory(g, ragdoll, skin) {
    const head = ragdoll.head;
    const scale = ragdoll.scale;
    const accessory = ragdoll.cosmetic.accessory;
    if (!accessory || accessory === 'none') return;
    g.save();
    g.translateCanvas(head.position.x, head.position.y);
    g.rotateCanvas(head.angle);
    switch (accessory) {
      case 'cap':
        g.fillStyle(hexToInt('#e0364a'), 1);
        g.fillRoundedRect(-12 * scale, -16 * scale, 24 * scale, 9 * scale, 3);
        g.fillRect(2 * scale, -10 * scale, 13 * scale, 4 * scale);
        break;
      case 'helmet':
        g.fillStyle(hexToInt('#ffd23f'), 1);
        g.fillCircle(0, -6 * scale, 14 * scale);
        g.fillStyle(hexToInt('#e0a13c'), 1);
        g.fillRect(-16 * scale, -6 * scale, 32 * scale, 4 * scale);
        break;
      case 'crown':
        g.fillStyle(hexToInt('#ffd23f'), 1);
        g.fillRect(-11 * scale, -17 * scale, 22 * scale, 7 * scale);
        for (const dx of [-9, 0, 9]) {
          g.fillTriangle(
            dx * scale - 3 * scale, -17 * scale,
            dx * scale + 3 * scale, -17 * scale,
            dx * scale, -24 * scale
          );
        }
        break;
      case 'glasses':
        g.lineStyle(2, 0x1b1f2a, 1);
        g.strokeCircle(-4.4 * scale, -1.5 * scale, 4.4 * scale);
        g.strokeCircle(4.4 * scale, -1.5 * scale, 4.4 * scale);
        g.beginPath();
        g.moveTo(-0.2 * scale, -1.5 * scale);
        g.lineTo(0.2 * scale, -1.5 * scale);
        g.strokePath();
        break;
      case 'visor':
        g.fillStyle(hexToInt('#57c8ff'), 0.85);
        g.fillRoundedRect(-12 * scale, -8 * scale, 24 * scale, 11 * scale, 4);
        g.lineStyle(2, hexToInt('#2c86b8'), 1);
        g.strokeRoundedRect(-12 * scale, -8 * scale, 24 * scale, 11 * scale, 4);
        break;
      case 'antenna':
        g.lineStyle(2, '#c3ccd6', 1);
        g.beginPath();
        g.moveTo(0, -12 * scale);
        g.lineTo(0, -22 * scale);
        g.strokePath();
        g.fillStyle(hexToInt('#ff7a59'), 1);
        g.fillCircle(0, -24 * scale, 3 * scale);
        break;
      case 'halo':
        g.lineStyle(3, hexToInt('#ffd23f'), 0.95);
        g.strokeEllipse(0, -18 * scale, 26 * scale, 8 * scale);
        break;
      default:
        break;
    }
    g.restore();
    void skin;
  }

  /* ----------------------------------------------------------------- links */

  drawLinks() {
    const g = this.linkLayer;
    this.ctx.constraints.forEachDraw((record, a, b) => {
      const color = hexToInt(record.color ?? '#e0b64a');
      if (record.type === 'spring') {
        g.lineStyle(3, color, 1);
        const segments = 12;
        g.beginPath();
        for (let i = 0; i <= segments; i += 1) {
          const t = i / segments;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          const nx = -(b.y - a.y);
          const ny = b.x - a.x;
          const len = Math.hypot(nx, ny) || 1;
          const off = (i % 2 === 0 ? -1 : 1) * 6;
          const px = x + (nx / len) * off;
          const py = y + (ny / len) * off;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
        return;
      }
      if (record.type === 'joint' || record.type === 'pin') {
        g.fillStyle(color, 1);
        g.fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
        g.lineStyle(2, hexToInt(shade(record.color ?? '#57c8ff', -0.35)), 1);
        g.strokeCircle((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
        return;
      }
      g.lineStyle(record.type === 'chain' ? 5 : 3.5, color, 1);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
      if (record.type === 'chain') {
        const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 14));
        g.fillStyle(hexToInt('#c9d6e4'), 1);
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          g.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 3);
        }
      }
    });
  }

  /* --------------------------------------------------------------- effects */

  drawEffects() {
    const g = this.fxLayer;
    const effects = this.ctx.effects;
    for (const p of effects.particles) {
      const alpha = clamp(p.life / (p.maxLife || 0.6), 0, 1);
      const color = typeof p.color === 'string' && p.color.startsWith('#') ? hexToInt(p.color) : 0xffffff;
      g.fillStyle(color, alpha * (p.kind === 'smoke' ? 0.5 : 0.9));
      g.fillCircle(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - alpha) : 1));
    }
    for (const ring of effects.rings) {
      const alpha = clamp(ring.life / ring.maxLife, 0, 1);
      g.lineStyle(Math.max(2, 8 * alpha), hexToInt(ring.color), alpha * 0.9);
      g.strokeCircle(ring.x, ring.y, ring.r);
    }
    if (effects.flash > 0) {
      this.overlay.fillStyle(0xffffff, Math.min(0.5, effects.flash * 0.5));
      this.overlay.fillRect(0, 0, this.camera.width, this.camera.height);
    }
  }

  /* -------------------------------------------------------------- overlays */

  drawOverlays() {
    const g = this.uiLayer;
    const selection = this.ctx.selection;

    for (const entity of selection.list()) {
      if (entity.removed) continue;
      const bounds = entity.bounds();
      g.lineStyle(3, 0x57c8ff, 0.95);
      g.strokeRoundedRect(bounds.minX - 5, bounds.minY - 5, bounds.w + 10, bounds.h + 10, 8);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeRoundedRect(bounds.minX - 8, bounds.minY - 8, bounds.w + 16, bounds.h + 16, 10);
    }
    if (this.hoverEntity && !this.hoverEntity.removed && !selection.has(this.hoverEntity)) {
      const bounds = this.hoverEntity.bounds();
      g.lineStyle(2, 0xffffff, 0.5);
      g.strokeRoundedRect(bounds.minX - 4, bounds.minY - 4, bounds.w + 8, bounds.h + 8, 8);
    }

    if (this.marquee) {
      const { x, y, w, h } = this.marquee;
      g.fillStyle(0x57c8ff, 0.12);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, 0x57c8ff, 0.9);
      g.strokeRect(x, y, w, h);
    }

    if (this.pendingPlatform) {
      const { start, end } = this.pendingPlatform;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      g.fillStyle(0xa9bdd3, 0.5);
      g.fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(2, 0x57c8ff, 0.9);
      g.strokeRoundedRect(x, y, w, h, 6);
    }

    if (this.ropePreview) {
      g.lineStyle(3, hexToInt(this.ropePreview.color ?? '#c9a86a'), 0.9);
      g.beginPath();
      g.moveTo(this.ropePreview.from.x, this.ropePreview.from.y);
      g.lineTo(this.ropePreview.to.x, this.ropePreview.to.y);
      g.strokePath();
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(this.ropePreview.to.x, this.ropePreview.to.y, 4);
    }

    if (this.forceArrow) {
      const { from, to, magnitude, pull } = this.forceArrow;
      const color = pull ? 0xff7a59 : 0x57c8ff;
      g.lineStyle(5, color, 0.95);
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(to.x, to.y);
      g.strokePath();
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      for (const side of [-1, 1]) {
        g.fillStyle(color, 1);
        const a = angle + Math.PI + side * 0.45;
        g.fillTriangle(
          to.x, to.y,
          to.x + Math.cos(a) * 18, to.y + Math.sin(a) * 18,
          to.x + Math.cos(angle + Math.PI) * 22, to.y + Math.sin(angle + Math.PI) * 22
        );
      }
      if (pull) {
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(from.x, from.y, 5);
      }
      const bars = Math.round(clamp(magnitude ?? 0, 0, 30) / 3);
      g.fillStyle(color, 0.9);
      for (let i = 0; i < bars; i += 1) {
        g.fillRect(from.x + 10 + i * 7, from.y + 14, 4, 10);
      }
    }

    if (this.ghost) {
      const { position, valid } = this.ghost;
      g.lineStyle(3, valid ? 0x38e07b : 0xe0364a, 0.9);
      g.strokeCircle(position.x, position.y, 26);
      g.lineStyle(1, valid ? 0x38e07b : 0xe0364a, 0.5);
      g.strokeCircle(position.x, position.y, 34);
    }

    // Gravity indicator arrows on bodies that opted out of gravity.
    for (const entity of this.ctx.phys.entities) {
      if (entity.removed || entity.props?.affectedByGravity !== false) continue;
      const bounds = entity.bounds();
      if (!this.isVisible(bounds)) continue;
      g.fillStyle(0xa77bff, 0.9);
      g.fillCircle(bounds.x, bounds.minY - 12, 3);
      g.lineStyle(2, 0xa77bff, 0.7);
      g.strokeCircle(bounds.x, bounds.minY - 12, 7);
    }
    void withAlpha;
  }
}

/** `#rrggbb` → 0xrrggbb (Phaser wants integer colours). */
export function hexToInt(hex) {
  if (typeof hex === 'number') return hex;
  if (typeof hex !== 'string') return 0xffffff;
  const clean = hex.trim().replace('#', '');
  if (clean.startsWith('rgba') || clean.startsWith('rgb')) {
    const nums = clean.match(/[\d.]+/g) ?? [];
    const [r, g, b] = nums.map((n) => clamp(parseInt(n, 10), 0, 255));
    return ((r ?? 255) << 16) + ((g ?? 255) << 8) + (b ?? 255);
  }
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return Number.isNaN(value) ? 0xffffff : value;
}

export { PART_LAYOUT, mix };
