/**
 * CollisionManager — turns raw Matter contact events into game feedback.
 *
 *  - estimates impact force (relative speed × reduced mass),
 *  - throttles audio so a pile of 200 crates does not produce 200 sounds,
 *  - damages destructibles above their impact threshold,
 *  - drives special surfaces: bouncy pads, balloons, triggers,
 *  - tracks grounded contacts so the controlled ragdoll can jump.
 */

import { MATERIALS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';
import { bus, EVENTS } from '../utils/events.js';
import { accelToForce } from './BodyShapes.js';

const MATERIAL_SOUND = {
  wood: 'wood',
  metal: 'metal',
  heavy: 'metal',
  stone: 'wood',
  glass: 'glass',
  rubber: 'rubber',
  bouncy: 'rubber',
  plastic: 'rubber',
  cloth: 'soft',
  energy: 'energy',
  ice: 'glass',
};

export class CollisionManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.M = ctx.M;
    this.phys = ctx.phys;
    this.impactThreshold = 0.9;      // below this: ignore (resting contacts)
    this.damageThreshold = 26;       // force needed before objects take damage
    this.soundBudget = 6;            // max sounds per 100 ms window
    this.soundWindowStart = 0;
    this.soundsThisWindow = 0;
    this.lastSoundAt = new Map();    // entityId -> timestamp (per-entity throttle)
    this.maxForceSeen = 0;
    this._offStart = ctx.phys.addCollisionHandler((phase, event, phys) => {
      if (phase === 'collisionStart') this.onStart(event);
      else if (phase === 'collisionActive') this.onActive(event);
    });
  }

  static materialSound(key) {
    return MATERIAL_SOUND[key] ?? 'wood';
  }

  /** Impact energy estimate: relative speed * reduced mass. */
  pairForce(pair) {
    const a = pair.bodyA;
    const b = pair.bodyB;
    const va = a.velocity ?? { x: 0, y: 0 };
    const vb = b.velocity ?? { x: 0, y: 0 };
    const rel = Math.hypot(va.x - vb.x, va.y - vb.y);
    const ma = a.isStatic ? Infinity : a.mass || 1;
    const mb = b.isStatic ? Infinity : b.mass || 1;
    const reduced = ma === Infinity && mb === Infinity ? 0 : ma === Infinity ? mb : mb === Infinity ? ma : (ma * mb) / (ma + mb);
    return { force: rel * reduced, speed: rel };
  }

  onStart(event) {
    for (const pair of event.pairs) {
      this.handlePair(pair);
    }
  }

  onActive(event) {
    // Grounding detection for controllable characters.
    for (const pair of event.pairs) {
      const entityA = this.phys.getEntity(pair.bodyA);
      const entityB = this.phys.getEntity(pair.bodyB);
      if (entityA?.kind === 'ragdoll' && entityB !== entityA) entityA.groundTimer = 0.14;
      if (entityB?.kind === 'ragdoll' && entityA !== entityB) entityB.groundTimer = 0.14;
    }
  }

  handlePair(pair) {
    const { force, speed } = this.pairForce(pair);
    if (force < this.impactThreshold && speed < 1.2) return;

    const entityA = this.phys.getEntity(pair.bodyA);
    const entityB = this.phys.getEntity(pair.bodyB);
    if (!entityA && !entityB) return;
    const primary = entityA ?? entityB;
    const secondary = entityA ? entityB : entityA;

    this.maxForceSeen = Math.max(this.maxForceSeen, force);
    this.ctx.stats?.max('maxImpactForce', Math.round(force));

    // Contact point (Matter gives us the support point when available).
    const contact = pair.activeContacts?.[0];
    const point = contact?.vertex ?? primary.position;

    const materialA = MATERIALS[pair.bodyA.materialKey ?? primary.def?.material]?.sound ?? 'wood';
    const materialB = MATERIALS[pair.bodyB.materialKey ?? secondary?.def?.material]?.sound ?? materialA;

    if (force > this.impactThreshold) {
      this.playImpactSound(primary, materialA, force, speed);
      this.ctx.effects?.impact(point.x, point.y, { force, material: materialA, speed });
      bus.emit(EVENTS.IMPACT, {
        force,
        x: point.x,
        y: point.y,
        materialA,
        materialB,
        entityA: entityA?.id ?? null,
        entityB: entityB?.id ?? null,
      });
    }

    // Damage from impacts (destructibles only; the destruction system decides).
    for (const [self, other, otherMaterial] of [
      [entityA, entityB, materialB],
      [entityB, entityA, materialA],
    ]) {
      if (!self || self.removed) continue;
      if (self.def?.destructible && force > this.damageThreshold) {
        const damage = (force - this.damageThreshold) * 0.55;
        this.ctx.destruction?.damage(self, damage, { source: 'impact', force, x: point.x, y: point.y, other });
      }
    }

    this.handleSpecialContacts(entityA, pair.bodyA, entityB, pair.bodyB, force, point);
  }

  handleSpecialContacts(entityA, bodyA, entityB, bodyB, force, point) {
    // Bouncy pads: launch whatever lands on top.
    for (const [pad, other, otherBody] of [
      [entityA, entityB, bodyB],
      [entityB, entityA, bodyA],
    ]) {
      if (!pad || pad.removed) continue;
      if (pad.behavior === 'bouncyPad' && other && !other.removed) {
        const power = clamp(pad.props.power ?? 20, 4, 40);
        const g = this.phys.getGravity();
        const dirY = g.y >= 0 ? -1 : 1;
        const dirX = pad.props.direction ?? 0;
        other.getBodies().forEach((b) => {
          if (b.isStatic) return;
          this.phys.wake(b);
          this.M.Body.setVelocity(b, {
            x: b.velocity.x * 0.4 + dirX * power * 0.5,
            y: dirY * power * (1 + Math.min(0.3, force * 0.002)),
          });
        });
        this.ctx.effects?.burst(point.x, point.y, '#57c8ff', 8, 3);
        this.ctx.sfx?.spring(clamp(power / 20, 0.3, 1.3));
      }
      if (pad.behavior === 'target' && other) {
        this.ctx.effects?.burst(point.x, point.y, '#ff7a59', 6, 2.4);
        this.ctx.sfx?.hit(0.8);
      }
      if (pad.behavior === 'buoyancy' && force > 2.4) {
        // Balloons pop on hard impacts.
        this.ctx.destruction?.destroyEntity(pad, { reason: 'popped', silent: false });
      }
      if (pad.behavior === 'breakable' && force > 8 && pad.def?.destructible) {
        this.ctx.destruction?.damage(pad, force * 2, { source: 'impact', force, x: point.x, y: point.y });
      }
      if (pad.behavior === 'motor' && other && force > 1) {
        // A spinning wheel drags whatever touches it sideways.
        const spin = pad.props.speed ?? 7;
        const sign = Math.sign(spin) || 1;
        other.getBodies().forEach((b) => {
          if (b.isStatic) return;
          this.phys.wake(b);
          this.M.Body.applyForce(b, point, { x: sign * Math.abs(spin) * b.mass * 0.05, y: 0 });
        });
      }
    }
  }

  /** Throttled audio: a global budget plus a per-entity cooldown. */
  playImpactSound(entity, material, force, speed) {
    const now = this.phys.simTime * 1000;
    if (now - this.soundWindowStart > 100) {
      this.soundWindowStart = now;
      this.soundsThisWindow = 0;
    }
    if (this.soundsThisWindow >= this.soundBudget) return;
    const key = entity?.id ?? 'world';
    const last = this.lastSoundAt.get(key) ?? -1000;
    if (now - last < 90) return;
    this.lastSoundAt.set(key, now);
    if (this.lastSoundAt.size > 400) this.lastSoundAt.clear();
    this.soundsThisWindow += 1;
    const intensity = clamp(force / 60, 0.08, 1);
    this.ctx.sfx?.impact(CollisionManager.materialSound(material), intensity, speed);
  }

  destroy() {
    this._offStart?.();
  }
}
