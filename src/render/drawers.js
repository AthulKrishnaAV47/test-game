/**
 * Object drawers — every catalogue `render` key maps to a function that paints
 * one prop into a Phaser Graphics object.
 *
 * All drawing is procedural vector art (no external images): rounded shapes,
 * cartoon shading and a couple of accent details per object. Functions receive
 * a context object with the body's geometry plus a few palette helpers, so the
 * same drawer also works for debris, previews and the library panel thumbnails.
 */

import { shade, tint, withAlpha } from '../utils/colorUtils.js';

const R = (g, x, y, w, h, r, fill, stroke = null, lw = 2) => {
  if (fill) {
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
  }
  if (stroke) {
    g.lineStyle(lw, stroke, 1);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
  }
};

const C = (g, x, y, r, fill, stroke = null, lw = 2) => {
  if (fill) {
    g.fillStyle(fill, 1);
    g.fillCircle(x, y, r);
  }
  if (stroke) {
    g.lineStyle(lw, stroke, 1);
    g.strokeCircle(x, y, r);
  }
};

const shadow = (g, ctx) => {
  if (!ctx.shadows) return;
  g.fillStyle('#0d1b2a', 0.16);
  g.fillEllipse(ctx.x, ctx.y + ctx.h * 0.5 + 4, ctx.w * 1.05, Math.max(6, ctx.h * 0.22));
};

const stripes = (g, ctx, color) => {
  g.lineStyle(3, withAlpha(color, 0.55), 1);
  for (let i = -1; i <= 1; i += 1) {
    g.beginPath();
    g.moveTo(ctx.x - ctx.w / 2 + 4, ctx.y + i * ctx.h * 0.24);
    g.lineTo(ctx.x + ctx.w / 2 - 4, ctx.y + i * ctx.h * 0.24);
    g.strokePath();
  }
};

const bolts = (g, ctx, color) => {
  const dx = ctx.w / 2 - 5;
  const dy = ctx.h / 2 - 5;
  g.fillStyle(color, 0.9);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.fillCircle(ctx.x + sx * dx, ctx.y + sy * dy, Math.max(1.5, Math.min(3, ctx.w * 0.06)));
  }
};

const drawer = (fn) => (g, ctx) => {
  if (ctx.shadows && ctx.dynamic) shadow(g, ctx);
  fn(g, ctx);
};

export const DRAWERS = {
  /* ------------------------------------------------------------------ boxes */
  crate: drawer((g, ctx) => {
    const base = ctx.color ?? '#c8964f';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, base, shade(base, -0.35), 3);
    R(g, ctx.x, ctx.y, ctx.w * 0.92, Math.max(4, ctx.h * 0.16), 2, shade(base, -0.18));
    g.lineStyle(3, shade(base, -0.3), 1);
    g.beginPath();
    g.moveTo(ctx.x - ctx.w / 2 + 3, ctx.y - ctx.h / 2 + 3);
    g.lineTo(ctx.x + ctx.w / 2 - 3, ctx.y + ctx.h / 2 - 3);
    g.moveTo(ctx.x + ctx.w / 2 - 3, ctx.y - ctx.h / 2 + 3);
    g.lineTo(ctx.x - ctx.w / 2 + 3, ctx.y + ctx.h / 2 - 3);
    g.strokePath();
  }),
  breakableCrate: drawer((g, ctx) => {
    const base = ctx.color ?? '#d8a45c';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 5, base, shade(base, -0.4), 3);
    g.lineStyle(2, shade(base, -0.55), 0.9);
    g.beginPath();
    g.moveTo(ctx.x - ctx.w * 0.5, ctx.y - ctx.h * 0.12);
    g.lineTo(ctx.x - ctx.w * 0.1, ctx.y + ctx.h * 0.05);
    g.lineTo(ctx.x + ctx.w * 0.35, ctx.y - ctx.h * 0.2);
    g.strokePath();
  }),
  metalBox: drawer((g, ctx) => {
    const base = ctx.color ?? '#8fa2b8';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.4), 3);
    R(g, ctx.x, ctx.y - ctx.h * 0.1, ctx.w * 0.96, ctx.h * 0.5, 2, tint(base, 0.22));
    bolts(g, ctx, shade(base, -0.5));
  }),
  stoneBlock: drawer((g, ctx) => {
    const base = ctx.color ?? '#9aa0a8';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, base, shade(base, -0.4), 3);
    g.fillStyle(shade(base, -0.15), 0.8);
    g.fillCircle(ctx.x - ctx.w * 0.2, ctx.y - ctx.h * 0.15, Math.max(2, ctx.w * 0.09));
    g.fillCircle(ctx.x + ctx.w * 0.18, ctx.y + ctx.h * 0.12, Math.max(2, ctx.w * 0.07));
  }),
  brick: drawer((g, ctx) => {
    const base = ctx.color ?? '#c2683f';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.4), 2.5);
    stripes(g, ctx, shade(base, 0.4));
  }),
  glass: drawer((g, ctx) => {
    const base = ctx.color ?? '#bfe9ff';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, withAlpha(base, 0.55), shade(base, -0.1), 2);
    g.fillStyle('#ffffff', 0.4);
    g.fillTriangle(
      ctx.x - ctx.w * 0.3, ctx.y + ctx.h * 0.3,
      ctx.x - ctx.w * 0.05, ctx.y - ctx.h * 0.35,
      ctx.x + ctx.w * 0.05, ctx.y - ctx.h * 0.3
    );
  }),
  ice: drawer((g, ctx) => {
    const base = ctx.color ?? '#cdefff';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, withAlpha(base, 0.8), '#8fd2f0', 2);
    g.lineStyle(2, '#ffffff', 0.7);
    g.beginPath();
    g.moveTo(ctx.x - ctx.w * 0.25, ctx.y + ctx.h * 0.2);
    g.lineTo(ctx.x + ctx.w * 0.15, ctx.y - ctx.h * 0.25);
    g.strokePath();
  }),
  plank: drawer((g, ctx) => {
    const base = ctx.color ?? '#d2a05c';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.4), 2.5);
    stripes(g, ctx, shade(base, -0.2));
  }),
  barrel: drawer((g, ctx) => {
    const base = ctx.color ?? '#b9793c';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, ctx.w * 0.35, base, shade(base, -0.42), 3);
    g.lineStyle(3, '#5a4632', 0.85);
    for (const f of [-0.3, 0.3]) {
      g.beginPath();
      g.moveTo(ctx.x - ctx.w / 2, ctx.y + ctx.h * f);
      g.lineTo(ctx.x + ctx.w / 2, ctx.y + ctx.h * f);
      g.strokePath();
    }
  }),
  explosiveBarrel: drawer((g, ctx) => {
    const base = ctx.color ?? '#e0483c';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, ctx.w * 0.3, base, shade(base, -0.45), 3);
    g.fillStyle('#ffe066', 1);
    g.fillTriangle(ctx.x, ctx.y - 4, ctx.x - 8, ctx.y + 8, ctx.x + 8, ctx.y + 8);
    g.fillStyle('#2b2b2b', 1);
    g.fillCircle(ctx.x, ctx.y + 5, 2.4);
  }),
  bomb: drawer((g, ctx) => {
    const base = ctx.color ?? '#39404d';
    C(g, ctx.x, ctx.y, ctx.r, base, shade(base, -0.4), 3);
    g.lineStyle(3, '#c9a86a', 1);
    g.beginPath();
    g.moveTo(ctx.x + ctx.r * 0.5, ctx.y - ctx.r * 0.85);
    g.lineTo(ctx.x + ctx.r * 0.9, ctx.y - ctx.r * 1.5);
    g.strokePath();
    const spark = 2 + Math.sin(ctx.time * 12) * 1.2;
    C(g, ctx.x + ctx.r * 0.95, ctx.y - ctx.r * 1.6, Math.max(1.5, spark), '#ffd23f');
  }),
  balloon: drawer((g, ctx) => {
    const base = ctx.color ?? '#ff7a59';
    C(g, ctx.x, ctx.y - 2, ctx.r, base, shade(base, -0.3), 2.5);
    g.fillStyle('#ffffff', 0.5);
    g.fillCircle(ctx.x - ctx.r * 0.35, ctx.y - ctx.r * 0.4, ctx.r * 0.22);
    g.lineStyle(2, '#5a4632', 1);
    g.beginPath();
    g.moveTo(ctx.x, ctx.y + ctx.r - 1);
    g.lineTo(ctx.x + 2, ctx.y + ctx.r + 14);
    g.strokePath();
  }),

  /* ---------------------------------------------------------------- circles */
  ball: drawer((g, ctx) => {
    const base = ctx.color ?? '#e0483c';
    C(g, ctx.x, ctx.y, ctx.r, base, shade(base, -0.4), 3);
    g.fillStyle('#ffffff', 0.35);
    g.fillCircle(ctx.x - ctx.r * 0.3, ctx.y - ctx.r * 0.34, ctx.r * 0.3);
    g.lineStyle(3, shade(base, -0.25), 1);
    g.beginPath();
    g.moveTo(ctx.x - ctx.r, ctx.y + ctx.r * 0.2);
    g.lineTo(ctx.x + ctx.r, ctx.y - ctx.r * 0.2);
    g.strokePath();
  }),
  bouncyBall: drawer((g, ctx) => {
    const base = ctx.color ?? '#57c8ff';
    C(g, ctx.x, ctx.y, ctx.r, base, shade(base, -0.35), 3);
    g.fillStyle('#ffffff', 0.55);
    g.fillCircle(ctx.x - ctx.r * 0.32, ctx.y - ctx.r * 0.36, ctx.r * 0.28);
    g.fillStyle('#eaf7ff', 0.8);
    g.fillCircle(ctx.x + ctx.r * 0.25, ctx.y + ctx.r * 0.28, ctx.r * 0.16);
  }),
  heavySphere: drawer((g, ctx) => {
    const base = ctx.color ?? '#5c6874';
    C(g, ctx.x, ctx.y, ctx.r, base, '#2f3841', 3);
    g.fillStyle('#8794a1', 0.85);
    g.fillCircle(ctx.x - ctx.r * 0.3, ctx.y - ctx.r * 0.3, ctx.r * 0.32);
    bolts(g, { ...ctx, w: ctx.r * 1.6, h: ctx.r * 1.6 }, '#c3ccd6');
  }),
  tyre: drawer((g, ctx) => {
    const base = ctx.color ?? '#3a3f45';
    C(g, ctx.x, ctx.y, ctx.r, base, '#20242a', 3);
    C(g, ctx.x, ctx.y, ctx.r * 0.45, '#98a3ad', base, 2);
    g.lineStyle(2, '#22262b', 0.9);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + ctx.time * 0.4;
      g.beginPath();
      g.moveTo(ctx.x + Math.cos(a) * ctx.r * 0.5, ctx.y + Math.sin(a) * ctx.r * 0.5);
      g.lineTo(ctx.x + Math.cos(a) * ctx.r * 0.92, ctx.y + Math.sin(a) * ctx.r * 0.92);
      g.strokePath();
    }
  }),

  /* -------------------------------------------------------------- platforms */
  platform: drawer((g, ctx) => {
    const base = ctx.color ?? '#a9bdd3';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, base, shade(base, -0.32), 3);
    R(g, ctx.x, ctx.y - ctx.h * 0.18, ctx.w * 0.96, Math.max(3, ctx.h * 0.3), 3, tint(base, 0.18));
  }),
  movingPlatform: drawer((g, ctx) => {
    platformDraw(g, ctx, '#7fd4c1');
    g.fillStyle('#2f6d63', 0.9);
    g.fillTriangle(ctx.x - 10, ctx.y + ctx.h * 0.5 + 3, ctx.x, ctx.y + ctx.h * 0.5 + 12, ctx.x + 10, ctx.y + ctx.h * 0.5 + 3);
  }),
  rotatingPlatform: drawer((g, ctx) => {
    platformDraw(g, ctx, '#c9a3ff');
    g.lineStyle(3, '#6b4bb3', 0.9);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + ctx.time;
      g.beginPath();
      g.moveTo(ctx.x + Math.cos(a) * ctx.w * 0.12, ctx.y + Math.sin(a) * ctx.w * 0.12);
      g.lineTo(ctx.x + Math.cos(a) * ctx.w * 0.36, ctx.y + Math.sin(a) * ctx.w * 0.36);
      g.strokePath();
    }
  }),
  wall: drawer((g, ctx) => {
    const base = ctx.color ?? '#8296ad';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.35), 3);
    const step = 46;
    g.lineStyle(2, shade(base, -0.2), 0.6);
    for (let y = ctx.y - ctx.h / 2 + step; y < ctx.y + ctx.h / 2; y += step) {
      g.beginPath();
      g.moveTo(ctx.x - ctx.w / 2 + 2, y);
      g.lineTo(ctx.x + ctx.w / 2 - 2, y);
      g.strokePath();
    }
  }),
  ramp: drawer((g, ctx) => {
    const base = ctx.color ?? '#a9bdd3';
    const pts = [
      { x: -ctx.w / 2, y: ctx.h / 2 },
      { x: ctx.w / 2, y: -ctx.h / 2 },
      { x: ctx.w / 2, y: ctx.h / 2 },
    ];
    g.fillStyle(base, 1);
    g.fillPoints(pts.map((p) => ({ x: ctx.x + p.x, y: ctx.y + p.y })), true);
    g.lineStyle(3, shade(base, -0.35), 1);
    g.strokePoints(pts.map((p) => ({ x: ctx.x + p.x, y: ctx.y + p.y })), true);
  }),
  spawnPad: drawer((g, ctx) => {
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 8, withAlpha('#38e07b', 0.35), '#38e07b', 3);
    g.lineStyle(3, '#38e07b', 0.9);
    g.beginPath();
    g.moveTo(ctx.x, ctx.y + 8);
    g.lineTo(ctx.x, ctx.y - 10);
    g.moveTo(ctx.x - 7, ctx.y - 3);
    g.lineTo(ctx.x, ctx.y - 11);
    g.lineTo(ctx.x + 7, ctx.y - 3);
    g.strokePath();
  }),
  bouncyPad: drawer((g, ctx) => {
    const base = ctx.color ?? '#57c8ff';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, ctx.h * 0.5, base, shade(base, -0.35), 3);
    g.fillStyle('#eaf7ff', 0.75);
    for (let i = -1; i <= 1; i += 1) {
      g.fillCircle(ctx.x + i * ctx.w * 0.25, ctx.y, Math.max(2, ctx.h * 0.16));
    }
  }),

  /* --------------------------------------------------------------- machines */
  spring: drawer((g, ctx) => {
    const base = ctx.color ?? '#ffd23f';
    R(g, ctx.x, ctx.y + ctx.h * 0.42, ctx.w * 0.9, Math.max(6, ctx.h * 0.16), 3, '#98a3ad', '#5b6672', 2);
    g.lineStyle(3, base, 1);
    const coils = 5;
    g.beginPath();
    const top = ctx.y - ctx.h * 0.4;
    const bottom = ctx.y + ctx.h * 0.34;
    for (let i = 0; i <= coils * 2; i += 1) {
      const t = i / (coils * 2);
      const y = bottom + (top - bottom) * t;
      const x = ctx.x + (i % 2 === 0 ? -ctx.w * 0.28 : ctx.w * 0.28);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
    R(g, ctx.x, ctx.y - ctx.h * 0.46, ctx.w * 0.7, Math.max(6, ctx.h * 0.14), 3, '#e0483c', '#8f251c', 2);
  }),
  pendulum: drawer((g, ctx) => {
    C(g, ctx.x, ctx.y - ctx.h * 0.42, ctx.w * 0.16, '#98a3ad', '#5b6672', 2);
    g.lineStyle(4, '#7a6a52', 1);
    g.beginPath();
    g.moveTo(ctx.x, ctx.y - ctx.h * 0.42);
    g.lineTo(ctx.x, ctx.y + ctx.h * 0.3);
    g.strokePath();
    C(g, ctx.x, ctx.y + ctx.h * 0.34, ctx.w * 0.22, '#5c6874', '#2f3841', 2.5);
  }),
  seesaw: drawer((g, ctx) => {
    const base = ctx.color ?? '#d2a05c';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.4), 3);
    g.fillStyle('#98a3ad', 1);
    g.fillTriangle(ctx.x - 12, ctx.y + ctx.h * 0.5 + 16, ctx.x + 12, ctx.y + ctx.h * 0.5 + 16, ctx.x, ctx.y + ctx.h * 0.5);
    g.lineStyle(3, '#5b6672', 1);
    g.strokeTriangle(ctx.x - 12, ctx.y + ctx.h * 0.5 + 16, ctx.x + 12, ctx.y + ctx.h * 0.5 + 16, ctx.x, ctx.y + ctx.h * 0.5);
  }),
  lever: drawer((g, ctx) => {
    seesawDraw(g, ctx);
    C(g, ctx.x + ctx.w * 0.36, ctx.y - ctx.h * 0.7, Math.max(4, ctx.h * 0.5), '#e0483c', '#8f251c', 2);
  }),
  piston: drawer((g, ctx) => {
    R(g, ctx.x, ctx.y + ctx.h * 0.28, ctx.w, ctx.h * 0.7, 5, '#7c8794', '#4b545e', 3);
    R(g, ctx.x, ctx.y - ctx.h * 0.05, ctx.w * 0.4, ctx.h * 0.7, 3, '#c3ccd6', '#6d7783', 2);
    R(g, ctx.x, ctx.y - ctx.h * 0.5, ctx.w * 0.8, ctx.h * 0.2, 4, '#e0a13c', '#8a5c1c', 2.5);
  }),
  conveyor: drawer((g, ctx) => {
    const base = ctx.color ?? '#4a5560';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, base, shade(base, -0.35), 3);
    g.fillStyle('#2f3740', 1);
    g.fillRoundedRect(ctx.x - ctx.w / 2 + 4, ctx.y - ctx.h * 0.24, ctx.w - 8, ctx.h * 0.48, 4);
    const offset = (ctx.time * 40) % 26;
    g.fillStyle('#8fa2b8', 0.95);
    for (let x = -ctx.w / 2 + 10 + offset; x < ctx.w / 2 - 6; x += 26) {
      g.fillRect(ctx.x + x, ctx.y - 3, 12, 6);
    }
    g.fillStyle('#ffd23f', 1);
    const dir = ctx.entity?.props?.direction ?? 1;
    g.fillTriangle(ctx.x + dir * 12, ctx.y + ctx.h * 0.5 + 2, ctx.x + dir * 4, ctx.y + ctx.h * 0.5 + 8, ctx.x + dir * 20, ctx.y + ctx.h * 0.5 + 8);
  }),
  motorWheel: drawer((g, ctx) => {
    C(g, ctx.x, ctx.y, ctx.r, '#f2a33c', '#a5651a', 3);
    g.lineStyle(3, '#a5651a', 1);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + ctx.time * 3;
      g.beginPath();
      g.moveTo(ctx.x, ctx.y);
      g.lineTo(ctx.x + Math.cos(a) * ctx.r * 0.85, ctx.y + Math.sin(a) * ctx.r * 0.85);
      g.strokePath();
    }
    C(g, ctx.x, ctx.y, ctx.r * 0.28, '#e8eef7', '#8b96a3', 2);
  }),
  pulley: drawer((g, ctx) => {
    C(g, ctx.x, ctx.y, ctx.r, '#98a3ad', '#5b6672', 3);
    g.lineStyle(3, '#7a6a52', 1);
    g.beginPath();
    g.moveTo(ctx.x - ctx.r, ctx.y);
    g.lineTo(ctx.x - ctx.w * 1.2, ctx.y + ctx.h * 1.4);
    g.moveTo(ctx.x + ctx.r, ctx.y);
    g.lineTo(ctx.x + ctx.w * 1.2, ctx.y + ctx.h * 1.4);
    g.strokePath();
    C(g, ctx.x, ctx.y, ctx.r * 0.35, '#4a5560');
  }),
  hinge: drawer((g, ctx) => {
    const base = ctx.color ?? '#c8964f';
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.4), 3);
    C(g, ctx.x - ctx.w * 0.5, ctx.y - ctx.h * 0.5, Math.max(3, ctx.w * 0.09), '#8fa2b8', '#4b545e', 2);
    C(g, ctx.x - ctx.w * 0.5, ctx.y + ctx.h * 0.5, Math.max(3, ctx.w * 0.09), '#8fa2b8', '#4b545e', 2);
  }),
  cannon: drawer((g, ctx) => {
    R(g, ctx.x, ctx.y + ctx.h * 0.5, ctx.w * 1.1, Math.max(10, ctx.h * 0.5), 6, '#6b7280', '#3f4652', 3);
    g.lineStyle(2, '#2f3740', 0.8);
    g.beginPath();
    g.moveTo(ctx.x - ctx.w * 0.4, ctx.y + ctx.h * 0.2);
    g.lineTo(ctx.x + ctx.w * 0.4, ctx.y + ctx.h * 0.2);
    g.strokePath();
  }),

  /* ----------------------------------------------------------------- fields */
  gravityWell: drawer((g, ctx) => {
    field(g, ctx, '#a77bff');
    const pulse = 0.6 + Math.sin(ctx.time * 2.2) * 0.15;
    g.lineStyle(3, '#a77bff', pulse);
    for (let i = 1; i <= 3; i += 1) {
      g.strokeCircle(ctx.x, ctx.y, ctx.r * 0.35 * i);
    }
    C(g, ctx.x, ctx.y, ctx.r * 0.22, '#6b3fd4', '#4a2a99', 2);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + ctx.time;
      const r0 = ctx.r * 0.7;
      const r1 = ctx.r * 0.45;
      arrowHead(g, ctx.x + Math.cos(a) * r1, ctx.y + Math.sin(a) * r1, a + Math.PI, '#c9a3ff', 7);
      g.lineStyle(2, '#c9a3ff', 0.8);
      g.beginPath();
      g.moveTo(ctx.x + Math.cos(a) * r0, ctx.y + Math.sin(a) * r0);
      g.lineTo(ctx.x + Math.cos(a) * r1, ctx.y + Math.sin(a) * r1);
      g.strokePath();
    }
  }),
  magnet: drawer((g, ctx) => {
    field(g, ctx, '#ff7a59');
    const dir = ctx.entity?.props.mode === 'repel' ? Math.PI : 0;
    g.lineStyle(4, '#ff7a59', 0.9);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + ctx.time * 0.8;
      const r0 = ctx.r * 0.3;
      const r1 = ctx.r * 0.8;
      g.beginPath();
      g.moveTo(ctx.x + Math.cos(a) * r0, ctx.y + Math.sin(a) * r0);
      g.lineTo(ctx.x + Math.cos(a) * r1, ctx.y + Math.sin(a) * r1);
      g.strokePath();
      arrowHead(g, ctx.x + Math.cos(a + dir) * r1, ctx.y + Math.sin(a + dir) * r1, a + dir + (ctx.entity?.props.mode === 'repel' ? 0 : Math.PI), '#ffb59c', 6);
    }
    C(g, ctx.x, ctx.y, ctx.r * 0.2, '#e0483c');
  }),
  windGenerator: drawer((g, ctx) => {
    field(g, ctx, '#7fd4c1');
    const dir = ((ctx.entity?.props.angle ?? 0) * Math.PI) / 180;
    for (let i = 0; i < 3; i += 1) {
      const off = (i - 1) * 16;
      g.lineStyle(4, '#7fd4c1', 0.85 - i * 0.15);
      g.beginPath();
      g.moveTo(ctx.x - Math.cos(dir) * ctx.r, ctx.y - Math.sin(dir) * ctx.r + off);
      g.lineTo(ctx.x + Math.cos(dir) * ctx.r, ctx.y + Math.sin(dir) * ctx.r + off);
      g.strokePath();
      arrowHead(g, ctx.x + Math.cos(dir) * ctx.r, ctx.y + Math.sin(dir) * ctx.r + off, dir, '#bff0e6', 8);
    }
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, '#4aa08d', '#2c6e5f', 3);
    g.lineStyle(3, '#eaf7ff', 1);
    for (let i = -1; i <= 1; i += 1) {
      g.beginPath();
      g.moveTo(ctx.x - 8, ctx.y + i * 7);
      g.lineTo(ctx.x + 8, ctx.y + i * 7);
      g.strokePath();
    }
  }),
  freezeZone: drawer((g, ctx) => {
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 10, withAlpha('#bfe9ff', 0.28), '#7fd4f0', 3);
    g.lineStyle(2, '#eaf9ff', 0.85);
    for (let i = 0; i < 3; i += 1) {
      const x = ctx.x - ctx.w * 0.28 + i * ctx.w * 0.28;
      g.beginPath();
      g.moveTo(x, ctx.y - ctx.h * 0.22);
      g.lineTo(x, ctx.y + ctx.h * 0.22);
      g.moveTo(x - 6, ctx.y - ctx.h * 0.08);
      g.lineTo(x + 6, ctx.y + ctx.h * 0.08);
      g.moveTo(x - 6, ctx.y + ctx.h * 0.08);
      g.lineTo(x + 6, ctx.y - ctx.h * 0.08);
      g.strokePath();
    }
  }),
  slowMotionField: drawer((g, ctx) => {
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 10, withAlpha('#c9a3ff', 0.24), '#a77bff', 3);
    g.lineStyle(3, '#d9c4ff', 0.9);
    for (let i = 0; i < 3; i += 1) {
      const r = ctx.w * (0.12 + i * 0.12);
      g.strokeCircle(ctx.x, ctx.y, r);
    }
    g.fillStyle('#e8dbff', 1);
    g.fillCircle(ctx.x, ctx.y, 4);
  }),
  teleporter: drawer((g, ctx) => {
    const t = ctx.time * 2;
    for (let i = 0; i < 3; i += 1) {
      const a = t + (i / 3) * Math.PI * 2;
      const r = ctx.r * (0.5 + 0.12 * Math.sin(t + i));
      C(g, ctx.x + Math.cos(a) * r * 0.5, ctx.y + Math.sin(a) * r * 0.5, Math.max(2, ctx.r * 0.28), withAlpha('#57c8ff', 0.8), '#2c86b8', 2);
    }
    g.lineStyle(3, '#57c8ff', 0.7);
    g.strokeCircle(ctx.x, ctx.y, ctx.r * 0.85);
    C(g, ctx.x, ctx.y, ctx.r * 0.18, '#eaf7ff');
  }),
  target: drawer((g, ctx) => {
    const alive = (ctx.entity?.hp ?? 1) > 0;
    const base = alive ? '#e0483c' : '#8b96a3';
    C(g, ctx.x, ctx.y, ctx.r, base, '#8f251c', 3);
    C(g, ctx.x, ctx.y, ctx.r * 0.66, '#f7f3e8', base, 2);
    C(g, ctx.x, ctx.y, ctx.r * 0.33, base);
    g.lineStyle(4, '#5b6672', 1);
    g.beginPath();
    g.moveTo(ctx.x, ctx.y - ctx.r);
    g.lineTo(ctx.x, ctx.y - ctx.r * 2.1);
    g.strokePath();
  }),
  goalZone: drawer((g, ctx) => {
    const pulse = 0.36 + Math.sin(ctx.time * 3) * 0.12;
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 12, withAlpha('#38e07b', pulse * 0.5), '#2bb35e', 3);
    g.lineStyle(3, '#38e07b', 0.9);
    g.beginPath();
    g.moveTo(ctx.x - ctx.w * 0.18, ctx.y);
    g.lineTo(ctx.x - ctx.w * 0.06, ctx.y + ctx.h * 0.12);
    g.lineTo(ctx.x + ctx.w * 0.14, ctx.y - ctx.h * 0.1);
    g.strokePath();
  }),
  hazard: drawer((g, ctx) => {
    R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, '#3a3f45', '#20242a', 3);
    g.fillStyle('#ffd23f', 0.95);
    const tooth = 18;
    for (let x = -ctx.w / 2 + 6; x < ctx.w / 2 - 6; x += tooth * 2) {
      g.fillTriangle(
        ctx.x + x, ctx.y - ctx.h * 0.35,
        ctx.x + x + tooth, ctx.y - ctx.h * 0.35,
        ctx.x + x + tooth / 2, ctx.y + ctx.h * 0.2
      );
    }
    g.lineStyle(3, '#e0483c', 0.8);
    g.beginPath();
    g.moveTo(ctx.x - ctx.w / 2 + 3, ctx.y + ctx.h * 0.4);
    g.lineTo(ctx.x + ctx.w / 2 - 3, ctx.y + ctx.h * 0.4);
    g.strokePath();
  }),
};

function arrowHead(g, x, y, angle, color, size = 8) {
  g.fillStyle(color, 1);
  const a1 = angle + Math.PI * 0.78;
  const a2 = angle - Math.PI * 0.78;
  g.fillTriangle(
    x, y,
    x + Math.cos(a1) * size, y + Math.sin(a1) * size,
    x + Math.cos(a2) * size, y + Math.sin(a2) * size
  );
}

function field(g, ctx, color) {
  const r = ctx.r * 1.0;
  g.fillStyle(color, 0.12);
  g.fillCircle(ctx.x, ctx.y, r);
  g.lineStyle(2, color, 0.4);
  g.strokeCircle(ctx.x, ctx.y, r);
}

function platformDraw(g, ctx, color) {
  R(g, ctx.x, ctx.y, ctx.w, ctx.h, 6, color, shade(color, -0.32), 3);
  R(g, ctx.x, ctx.y - ctx.h * 0.18, ctx.w * 0.95, Math.max(3, ctx.h * 0.3), 3, tint(color, 0.2));
}

function seesawDraw(g, ctx) {
  const base = ctx.color ?? '#d2a05c';
  R(g, ctx.x, ctx.y, ctx.w, ctx.h, 4, base, shade(base, -0.4), 3);
  g.fillStyle('#98a3ad', 1);
  g.fillTriangle(ctx.x - 12, ctx.y + ctx.h * 0.5 + 16, ctx.x + 12, ctx.y + ctx.h * 0.5 + 16, ctx.x, ctx.y + ctx.h * 0.5);
}

/** Draw a catalogue object; falls back to a neutral rounded box. */
export function drawObject(g, entity, visual) {
  const key = entity.def?.render ?? entity.type;
  const fn = DRAWERS[key] ?? DRAWERS.crate;
  fn(g, visual);
}

export const DRAWER_KEYS = Object.keys(DRAWERS);

export { R as roundRect, C as circle };
