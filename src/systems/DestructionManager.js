/**
 * DestructionManager — durability, breaking and debris.
 *
 * Only objects whose definition declares `destructible` can be damaged, so the
 * sandbox stays predictable. Debris is capped and cleaned up automatically, and
 * explosives detonate instead of crumbling (which can start a chain reaction).
 */

import { LIMITS } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';
import { clamp } from '../utils/mathUtils.js';
import { getDef } from '../config/objectCatalog.js';

export class DestructionManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.debris = [];
    this.debrisLimit = LIMITS.MAX_DEBRIS;
    this.debrisPerBreak = LIMITS.MAX_DEBRIS_PER_BREAK;
    this.breakCount = 0;
  }

  /** Apply damage; returns true if the entity broke. */
  damage(entity, amount, meta = {}) {
    if (!entity || entity.removed) return false;
    const def = entity.def ?? getDef(entity.type);
    if (!def?.destructible) return false;
    const dmg = clamp(Number(amount) || 0, 0, 100000);
    if (dmg <= 0) return false;

    entity.hp = (entity.hp ?? def.destructible.hp) - dmg;
    entity.lastDamage = { amount: dmg, meta, at: this.ctx.phys.simTime };
    entity.damageFlash = Math.min(1, (entity.damageFlash ?? 0) + dmg / 70);
    this.ctx.stats?.max('maxImpactForce', Math.round(meta.force ?? 0));

    if (entity.hp <= 0) {
      this.destroyEntity(entity, { ...meta, reason: meta.reason ?? 'destroyed' });
      return true;
    }
    if (dmg > 5) {
      this.ctx.effects?.impact(entity.position.x, entity.position.y, {
        force: dmg,
        material: def.material === 'metal' ? 'metal' : 'wood',
        speed: meta.force ?? 0,
      });
    }
    return false;
  }

  /** Remove an entity (optionally leaving debris) and report the score. */
  destroyEntity(entity, meta = {}) {
    if (!entity || entity.removed) return false;
    const def = entity.def ?? getDef(entity.type);
    const points = Math.max(1, Math.round((entity.maxHp ?? 30) / 6));
    this.breakCount += 1;

    const explosive = def?.destructible?.explodeOnBreak && !meta.exploded;
    if (explosive && def.destructible.explosion) {
      // Detonate instead of crumbling — may start a chain reaction.
      this.ctx.forces?.explodeEntity(entity, {
        chain: (meta.chain ?? 0) + 1,
        remove: true,
        damageScale: def.destructible.explosion.damageScale ?? 1,
      });
      return true;
    }

    if (def?.destructible && meta.debris !== false) this.spawnDebris(entity, def);

    this.ctx.spawner.remove(entity, {
      reason: meta.reason ?? 'destroyed',
      silent: true,
      keepUndo: true,
    });
    this.ctx.stats?.bump('objectsDestroyed', 1);
    this.ctx.effects?.burst(entity.position.x, entity.position.y, def?.destructible?.debrisColor ?? '#e0b64a', 12, 2.6);
    this.ctx.sfx?.break?.(def?.material ?? 'wood');
    bus.emit(EVENTS.OBJECT_DESTROYED, {
      entity,
      points,
      byExplosion: Boolean(meta.byExplosion ?? meta.exploded),
      chain: meta.chain ?? 0,
      ...meta,
    });
    return true;
  }

  /** Create a small, capped number of debris pieces. */
  spawnDebris(entity, def) {
    const count = Math.min(def.destructible?.debris ?? 4, this.debrisPerBreak);
    const material = def.material ?? 'wood';
    const color = def.destructible?.debrisColor ?? undefined;
    for (let i = 0; i < count; i += 1) {
      if (this.debris.length >= this.debrisLimit) {
        const oldest = this.debris.shift();
        if (oldest && !oldest.removed) {
          this.ctx.spawner.remove(oldest, { reason: 'debris-cleanup', silent: true, keepUndo: true });
        }
      }
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const piece = this.ctx.spawner.spawn('brick', entity.position.x + Math.cos(angle) * 12, entity.position.y + Math.sin(angle) * 12, {
        props: {
          material,
          width: 14 + Math.random() * 10,
          height: 7 + Math.random() * 5,
          restitution: 0.2,
          friction: 0.7,
          scale: 0.6,
        },
        color,
        silent: true,
      });
      if (!piece) break;
      piece.tag = 'debris';
      piece.debris = true;
      piece.ttl = 22 + Math.random() * 8;
      piece.props.scale = 0.6;
      this.ctx.forces?.impulse(piece, { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 - 2 });
      this.debris.push(piece);
    }
  }

  /** Debris expiry — keeps long sessions clean. */
  update(dt) {
    if (!this.debris.length) return;
    for (let i = this.debris.length - 1; i >= 0; i -= 1) {
      const piece = this.debris[i];
      if (piece.removed) {
        this.debris.splice(i, 1);
        continue;
      }
      piece.ttl -= dt;
      if (piece.ttl <= 0) {
        this.debris.splice(i, 1);
        this.ctx.spawner.remove(piece, { reason: 'debris-timeout', silent: true, keepUndo: true });
      }
    }
  }

  /** Heal everything back to full durability (reset / load). */
  repairAll() {
    for (const entity of this.ctx.phys.entities) {
      if (entity.def?.destructible) {
        entity.hp = entity.maxHp ?? entity.def.destructible.hp;
        entity.damageFlash = 0;
      }
    }
  }

  clear() {
    for (const piece of [...this.debris]) {
      if (!piece.removed) this.ctx.spawner.remove(piece, { reason: 'reset', silent: true, keepUndo: true });
    }
    this.debris.length = 0;
  }

  get count() {
    return this.debris.length;
  }
}
