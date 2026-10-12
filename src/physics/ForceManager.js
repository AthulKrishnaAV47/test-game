/**
 * ForceManager — impulses, pushes, pulls, explosions and continuous fields.
 *
 * All magnitudes are clamped for safety: a runaway explosion can never inject
 * NaN/huge velocities into the simulation.
 */

import { LIMITS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';
import { bus, EVENTS } from '../utils/events.js';
import { num } from '../utils/validation.js';
import { dvToForce, accelToForce } from './BodyShapes.js';

export class ForceManager {
  constructor(ctx) {
    this.ctx = ctx;         // { phys, M, effects, sfx, destruction, stats, bus }
    this.M = ctx.M;
    this.phys = ctx.phys;
    this.totalForces = 0;
  }

  /* ----------------------------------------------------------- primitives */

  /** Impulse in Matter units (Δv per body, mass compensated). */
  impulse(entity, vector, { at = null, massCompensation = 0.5 } = {}) {
    if (!entity || entity.removed) return;
    const M = this.M;
    for (const body of entity.getBodies()) {
      if (body.isStatic) continue;
      this.phys.wake(body);
      const scale = clamp(Math.pow(0.6 / Math.max(0.05, body.mass), massCompensation), 0.25, 4);
      const dvx = clamp(num(vector.x, 0, -60, 60) * scale, -LIMITS.MAX_IMPULSE, LIMITS.MAX_IMPULSE);
      const dvy = clamp(num(vector.y, 0, -60, 60) * scale, -LIMITS.MAX_IMPULSE, LIMITS.MAX_IMPULSE);
      const target = at ?? body.position;
      M.Body.applyForce(body, target, { x: dvToForce(body, dvx), y: dvToForce(body, dvy) });
    }
    this.totalForces += 1;
  }

  /** Continuous push (per physics step) — used by tools while dragging. */
  force(entity, vector, at = null) {
    if (!entity || entity.removed) return;
    const M = this.M;
    for (const body of entity.getBodies()) {
      if (body.isStatic) continue;
      this.phys.wake(body);
      // `vector` is a per-step acceleration (px/step²).
      const ax = clamp(num(vector.x, 0, -1.2, 1.2), -1.2, 1.2);
      const ay = clamp(num(vector.y, 0, -1.2, 1.2), -1.2, 1.2);
      M.Body.applyForce(body, at ?? body.position, { x: accelToForce(body, ax), y: accelToForce(body, ay) });
    }
  }

  /**
   * Apply a direct change in velocity (px/step) to an entity.
   * Used by the click-drag force arrow tool and the wind field.
   */
  applyDeltaV(entity, vector, options = {}) {
    if (!entity || entity.removed) return;
    const M = this.M;
    const vx = clamp(num(vector.x, 0, -30, 30), -30, 30);
    const vy = clamp(num(vector.y, 0, -30, 30), -30, 30);
    for (const body of entity.getBodies()) {
      if (body.isStatic || body.isSensor) continue;
      this.phys.wake(body);
      M.Body.applyForce(body, body.position, { x: dvToForce(body, vx), y: dvToForce(body, vy) });
    }
    this.totalForces += 1;
    bus.emit(EVENTS.FORCE_APPLIED, { entity, strength: Math.hypot(vx, vy), kind: options.kind ?? 'impulse' });
  }

  push(entity, dirX, dirY, strength = 12) {
    const len = Math.hypot(dirX, dirY) || 1;
    this.impulse(entity, { x: (dirX / len) * strength, y: (dirY / len) * strength });
    bus.emit(EVENTS.FORCE_APPLIED, { entity, strength, kind: 'push' });
    this.ctx.sfx?.whoosh?.(strength);
  }

  pull(entity, dirX, dirY, strength = 10) {
    this.push(entity, -dirX, -dirY, strength);
    bus.emit(EVENTS.FORCE_APPLIED, { entity, strength, kind: 'pull' });
  }

  /** Launch an entity with a direct velocity (used by cannons/launchers). */
  launch(entity, vx, vy) {
    const M = this.M;
    if (!entity) return;
    for (const body of entity.getBodies()) {
      if (body.isStatic) continue;
      this.phys.wake(body);
      M.Body.setVelocity(body, {
        x: clamp(num(vx, 0, -60, 60), -60, 60),
        y: clamp(num(vy, 0, -60, 60), -60, 60),
      });
    }
    if (entity.kind === 'ragdoll') bus.emit(EVENTS.RAGDOLL_LAUNCHED, { entity });
  }

  /* ---------------------------------------------------------- explosions */

  /**
   * Radial explosion.
   *
   * Force falls off linearly with distance and only bodies inside the radius
   * are touched. Damage is scaled by the same falloff so distant objects can
   * survive a blast they nominally "felt".
   */
  explosion({
    x,
    y,
    radius = 220,
    force = 0.09,
    chain = 1,
    sourceEntity = null,
    damageScale = 1,
    visual = true,
  }) {
    const M = this.M;
    const r = clamp(num(radius, 220, 20, 900), 20, 900);
    const f = clamp(num(force, 0.09, 0.005, 0.5), 0.005, 0.5);
    const maxDeltaV = Math.min(18, f * 90);                 // Δv at the centre
    const maxDamage = f * 1400 * damageScale;  // damage at the centre
    let affected = 0;

    for (const entity of [...this.phys.entities]) {
      if (entity.removed) continue;
      const cx = entity.position.x;
      const cy = entity.position.y;
      const distCentre = Math.hypot(cx - x, cy - y);
      const entityRadius = Math.max(entity.bounds?.().w ?? 0, entity.bounds?.().h ?? 0) * 0.5;
      if (distCentre > r + entityRadius) continue;

      let hit = false;
      for (const body of entity.getBodies()) {
        if (body.isStatic || body.isSensor) continue;
        const dx = body.position.x - x;
        const dy = body.position.y - y;
        const dist = Math.max(10, Math.hypot(dx, dy) - (body.circleRadius ?? 0));
        if (dist > r) continue;
        hit = true;
        const falloff = clamp(1 - dist / r, 0, 1);
        const deltaV = maxDeltaV * falloff * falloff ** 0.35;
        this.phys.wake(body);
        const scale = clamp(Math.pow(0.6 / Math.max(0.05, body.mass), 0.5), 0.3, 3.2);
        M.Body.applyForce(body, body.position, {
          x: dvToForce(body, (dx / dist) * deltaV * scale),
          y: dvToForce(body, (dy / dist) * deltaV * scale),
        });
      }
      if (!hit) continue;
      affected += 1;

      const falloffCentre = clamp(1 - distCentre / (r + 1), 0, 1);
      const damage = maxDamage * falloffCentre;
      if (damage > 0) {
        if (entity.kind === 'ragdoll') {
          // Bodies already received the impulse above; just register the hit.
          entity.damage += 1 + Math.round(falloffCentre * 3);
        } else {
          this.ctx.destruction?.damage(entity, damage, { source: 'explosion', chain, x, y });
        }
      }
    }

    if (visual) {
      this.ctx.effects?.explosion(x, y, r);
      this.ctx.sfx?.explosion(clamp(f * 8, 0.2, 1.5));
      this.ctx.stats?.bump('explosions', 1);
      this.ctx.stats?.max('bestChain', chain);
    }
    bus.emit(EVENTS.EXPLOSION, { x, y, radius: r, force: f, chain, affected, sourceId: sourceEntity?.id ?? null });
    return { affected, radius: r };
  }

  /** Detonate a bomb/barrel entity (may start a chain reaction). */
  explodeEntity(entity, { chain = 1, remove = true } = {}) {
    if (!entity || entity.removed) return;
    if (chain > LIMITS.MAX_EXPLOSION_CHAIN) return;
    const props = entity.props ?? {};
    const radius = num(props.blastRadius, 240, 40, 700);
    const force = num(props.blastForce, 0.09, 0.005, 0.4);
    entity.state.exploded = true;
    this.explosion({ x: entity.position.x, y: entity.position.y, radius, force, chain, sourceEntity: entity });
    if (remove) {
      this.ctx.destruction?.destroyEntity(entity, { reason: 'exploded', byExplosion: true, silent: true });
    }
  }

  /* -------------------------------------------------------- field effects */

  /** Continuous radial field (gravity well / magnet). */
  radialField(entity, point, { mode = 'attract', strength = 0.9, dt = 1 / 60 } = {}) {
    const M = this.M;
    const radius = num(entity.props.radius, 300, 40, 900);
    const s = clamp(num(strength, 0.9, 0, 3), 0, 3);
    const dirSign = mode === 'repel' ? -1 : 1;
    for (const body of this.phys.allBodies()) {
      if (body.isStatic) continue;
      const dx = body.position.x - point.x;
      const dy = body.position.y - point.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius || dist < 4) continue;
      const falloff = clamp(1 - dist / radius, 0, 1);
      const accel = clamp(s * 0.28 * falloff, 0, 0.6);   // px/step²
      const owner = this.phys.getEntity(body);
      if (owner === entity) continue;
      this.phys.wake(body);
      M.Body.applyForce(body, body.position, {
        x: accelToForce(body, (-dx / dist) * accel * dirSign),
        y: accelToForce(body, (-dy / dist) * accel * dirSign),
      });
    }
  }

  /** Directional wind inside a rectangle. */
  windField(entity, dt) {
    const M = this.M;
    const props = entity.props;
    const rad = (num(props.angle, 0, -180, 180) * Math.PI) / 180;
    const strength = clamp(num(props.strength, 0.35, 0, 1.2), 0, 1.2);
    const length = num(props.radius, 420, 60, 1200);
    const origin = entity.position;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);
    for (const body of this.phys.allBodies()) {
      if (body.isStatic || body.isSensor) continue;
      const dx = body.position.x - origin.x;
      const dy = body.position.y - origin.y;
      const along = dx * dirX + dy * dirY;
      const across = Math.abs(-dx * dirY + dy * dirX);
      if (along < 0 || along > length || across > 160) continue;
      const owner = this.phys.getEntity(body);
      if (owner === entity) continue;
      this.phys.wake(body);
      const accel = strength * 0.22 * (1 - along / length); // px/step²
      M.Body.applyForce(body, body.position, {
        x: accelToForce(body, dirX * accel),
        y: accelToForce(body, dirY * accel),
      });
    }
  }

  attract(entity, point, strength = 0.6) {
    this.radialField(entity, point, { mode: 'attract', strength });
  }

  repel(entity, point, strength = 0.6) {
    this.radialField(entity, point, { mode: 'repel', strength });
  }
}
