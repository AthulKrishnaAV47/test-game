/**
 * EffectsManager — particles, impact flashes, screen shake and motion trails.
 *
 * Particles are plain data objects rendered by the Renderer, so the pool stays
 * independent from Phaser game objects (cheap to create/destroy) and the total
 * count is always capped.
 */

import { LIMITS, QUALITY_PRESETS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';

export class EffectsManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.particles = [];
    this.rings = [];
    this.trails = [];
    this.shakeAmount = 0;
    this.shakeDecay = 4.5;
    this.flash = 0;
    this.quality = 'high';
    this.setQuality(ctx.settings?.get('quality') ?? 'high');
  }

  setQuality(quality) {
    this.quality = quality;
    this.preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium;
  }

  get enabled() {
    return this.ctx.settings?.get('particles') !== false;
  }

  get maxParticles() {
    return Math.min(this.preset?.particles ?? LIMITS.MAX_PARTICLES, LIMITS.MAX_PARTICLES);
  }

  /* ---------------------------------------------------------------- spawn */

  addParticle(p) {
    if (this.particles.length >= this.maxParticles) this.particles.shift();
    this.particles.push(p);
  }

  /** Generic burst used by many systems. */
  burst(x, y, color = '#ffffff', count = 8, speed = 3, options = {}) {
    if (!this.enabled) return;
    const n = Math.min(count, Math.max(0, this.maxParticles - this.particles.length));
    for (let i = 0; i < n; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random());
      this.addParticle({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1,
        life: options.life ?? 0.45 + Math.random() * 0.4,
        maxLife: options.life ?? 0.85,
        size: options.size ?? 2 + Math.random() * 2.4,
        color,
        gravity: options.gravity ?? 0.12,
        kind: options.kind ?? 'dot',
      });
    }
  }

  explosion(x, y, radius = 220) {
    if (!this.enabled) {
      this.shake(0.5);
      return;
    }
    this.rings.push({ x, y, r: 8, maxR: radius * 0.85, life: 0.42, maxLife: 0.42, color: '#ffd23f' });
    this.rings.push({ x, y, r: 4, maxR: radius * 0.45, life: 0.3, maxLife: 0.3, color: '#fff6d0' });
    this.burst(x, y, '#ff9a3c', 16, 6, { life: 0.7 });
    this.burst(x, y, '#ffe680', 10, 8, { life: 0.5, size: 4 });
    this.burst(x, y, '#6b6b6b', 12, 3.4, { life: 1.1, gravity: -0.02, kind: 'smoke', size: 7 });
    if (this.ctx.settings?.get('screenShake') !== false) this.shake(clamp(radius / 420, 0.25, 1.4));
  }

  impact(x, y, { force = 0, material = 'wood', speed = 0 } = {}) {
    if (!this.enabled) return;
    const strength = clamp(force / 40, 0.15, 1);
    const palette = {
      wood: '#c99a5b',
      metal: '#ffe89a',
      glass: '#cdefff',
      rubber: '#ff9db1',
      soft: '#d9c7ff',
      energy: '#a77bff',
    };
    const color = palette[material] ?? '#dddddd';
    this.burst(x, y, color, Math.round(2 + strength * 6), 1.4 + strength * 2.6, { life: 0.32, size: 1.6 + strength * 1.6 });
    if (material === 'metal' && force > 24) {
      // sparks
      this.burst(x, y, '#fff2b0', 5, 5, { life: 0.28, size: 1.4, kind: 'spark', gravity: 0.3 });
    }
    if (speed > 8) {
      this.rings.push({ x, y, r: 3, maxR: 14 + strength * 16, life: 0.18, maxLife: 0.18, color });
    }
  }

  /** Dust puff when something lands hard on the ground. */
  dust(x, y, strength = 1) {
    if (!this.enabled) return;
    this.burst(x, y, '#d8cdb8', Math.round(3 + strength * 5), 1.6 + strength, { life: 0.6, gravity: -0.02, kind: 'smoke', size: 5 });
  }

  trail(x, y, color = '#ffffff', size = 3) {
    if (!this.enabled || this.ctx.settings?.get('motionTrails') === false || !this.preset?.trails) return;
    this.addParticle({
      x, y, vx: 0, vy: 0, life: 0.28, maxLife: 0.28, size, color, gravity: 0, kind: 'dot',
    });
  }

  shake(amount) {
    if (this.ctx.settings?.get('screenShake') === false) return;
    this.shakeAmount = Math.max(this.shakeAmount, clamp(amount, 0, 1.6));
  }

  screenFlash(alpha = 0.35) {
    this.flash = Math.max(this.flash, alpha);
  }

  /* --------------------------------------------------------------- update */

  update(dt) {
    const particles = this.particles;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity ?? 0.12) * dt * 60 * 0.1;
      p.x += p.vx * dt * 60 * 0.5;
      p.y += p.vy * dt * 60 * 0.5;
      p.vx *= 0.98;
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      ring.r += (ring.maxR - ring.r) * dt * 6;
    }
    if (this.shakeAmount > 0) {
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * this.shakeDecay * this.shakeAmount - dt * 0.1);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
  }

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.shakeAmount = 0;
    this.flash = 0;
  }
}
