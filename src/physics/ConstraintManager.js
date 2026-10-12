/**
 * ConstraintManager — every player-made connection lives here.
 *
 * Connections are backed by real Matter constraints (never visuals), are
 * serialisable, and are cleaned up with the objects they belong to.
 */

import { uid } from '../utils/ids.js';
import { num } from '../utils/validation.js';
import { bus, EVENTS } from '../utils/events.js';

export const CONSTRAINT_TYPES = {
  rope: { id: 'rope', name: 'Rope', stiffness: 0.8, damping: 0.16, length: 220, color: '#e0b64a', min: 24, max: 1600, sag: 22 },
  chain: { id: 'chain', name: 'Chain', stiffness: 0.97, damping: 0.3, length: 220, color: '#a9bdd3', min: 24, max: 1600, sag: 16 },
  spring: { id: 'spring', name: 'Spring', stiffness: 0.2, damping: 0.04, length: 180, color: '#ffd23f', min: 20, max: 800, sag: 0 },
  joint: { id: 'joint', name: 'Hinge Joint', stiffness: 1, damping: 0.35, length: 0, color: '#57c8ff', min: 0, max: 260, sag: 0 },
  pin: { id: 'pin', name: 'Pin', stiffness: 1, damping: 0.5, length: 0, color: '#38e07b', min: 0, max: 260, sag: 0 },
  distance: { id: 'distance', name: 'Rigid Bar', stiffness: 1, damping: 0.4, length: 200, color: '#a77bff', min: 0, max: 1600, sag: 0 },
};

export class ConstraintManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.M = ctx.M;
    this.phys = ctx.phys;
    /** @type {Map<string, object>} connection id -> record */
    this.records = new Map();
  }

  /**
   * Create a connection.
   *
   * @param {object} spec
   * @param {string} spec.type - key of CONSTRAINT_TYPES
   * @param {object} [spec.entityA] - entity (omit for a world anchor)
   * @param {object} [spec.entityB]
   * @param {object} [spec.bodyA] - specific body (limb, cradle…) defaults to primary body
   * @param {object} [spec.bodyB]
   * @param {{x:number,y:number}} [spec.anchor] - world anchor when entityA is absent
   */
  create(spec) {
    const type = CONSTRAINT_TYPES[spec.type] ?? CONSTRAINT_TYPES.rope;
    const M = this.M;
    const bodyA = spec.bodyA ?? spec.entityA?.body ?? null;
    const bodyB = spec.bodyB ?? spec.entityB?.body ?? null;
    const anchor = spec.anchor ? { x: num(spec.anchor.x, 0), y: num(spec.anchor.y, 0) } : null;

    if (!bodyB) return null;
    if (!bodyA && !anchor) return null;

    const stiffness = num(spec.stiffness, type.stiffness, 0.02, 1);
    const damping = num(spec.damping, type.damping, 0, 1);

    // Attach at the point closest to the other end so connections look natural.
    const aPos = bodyA ? bodyA.position : anchor;
    const bPos = bodyB.position;
    const dist = Math.hypot(bPos.x - aPos.x, bPos.y - aPos.y);
    const length = num(spec.length, type.length ? Math.min(type.max, Math.max(type.min, dist)) : 0, 0, 1800);

    // Local attachment points (Matter keeps pointA/pointB rotated internally).
    const pointA = bodyA
      ? M.Vector.rotate(M.Vector.mul(M.Vector.sub(bodyA.position, bodyA.position), 1), 0)
      : anchor;
    const localA = bodyA ? { x: 0, y: 0 } : anchor;
    const localB = { x: 0, y: 0 };
    if (bodyA) {
      // offset toward the partner, expressed in the body's local frame
      const world = M.Vector.sub(bPos, bodyA.position);
      const scaled = M.Vector.magnitude(world) > 0 ? M.Vector.mult(M.Vector.normalise(world), Math.min(6, dist * 0.1)) : { x: 0, y: 0 };
      const rotatedBack = M.Vector.rotate(scaled, -bodyA.angle);
      localA.x = rotatedBack.x;
      localA.y = rotatedBack.y;
    }
    if (bodyB) {
      const world = M.Vector.sub(aPos, bodyB.position);
      const scaled = M.Vector.magnitude(world) > 0 ? M.Vector.mult(M.Vector.normalise(world), Math.min(6, dist * 0.1)) : { x: 0, y: 0 };
      // Point offsets on the moving body are relative to the *current* angle,
      // Matter will keep rotating them; store the world-scaled offset directly.
      localB.x = scaled.x;
      localB.y = scaled.y;
    }

    const constraint = M.Constraint.create({
      bodyA: bodyA ?? undefined,
      bodyB,
      pointA: bodyA ? localA : { x: anchor.x, y: anchor.y },
      pointB: localB,
      length: type.length === 0 ? 0 : length,
      stiffness,
      damping,
      render: { visible: false },
    });
    if (!bodyA) {
      // World-anchored constraint: pointA is a fixed world position.
      constraint.angleA = 0;
    }
    M.Composite.add(this.phys.localWorld, constraint);
    this.phys.wake(bodyA);
    this.phys.wake(bodyB);

    const record = {
      id: spec.id ?? uid('con'),
      type: type.id,
      definition: type,
      constraint,
      bodyA,
      bodyB,
      entityA: spec.entityA ?? null,
      entityB: spec.entityB ?? null,
      anchor,
      length: type.length === 0 ? 0 : length,
      stiffness,
      damping,
      color: spec.color ?? type.color,
      label: type.name,
    };
    this.records.set(record.id, record);
    this.ctx.stats?.bump('constraintsCreated', 1);
    bus.emit(EVENTS.CONSTRAINT_CREATED, { record });
    return record;
  }

  /** Remove a connection and its Matter constraint. */
  remove(recordOrId) {
    const record = typeof recordOrId === 'string' ? this.records.get(recordOrId) : recordOrId;
    if (!record) return false;
    this.M.Composite.remove(this.phys.localWorld, record.constraint);
    this.records.delete(record.id);
    bus.emit(EVENTS.CONSTRAINT_REMOVED, { record });
    return true;
  }

  /** Drop every connection touching an entity (called before deletion). */
  removeForEntity(entity) {
    if (!entity) return 0;
    let removed = 0;
    for (const record of [...this.records.values()]) {
      if (record.entityA === entity || record.entityB === entity) {
        this.remove(record);
        removed += 1;
      }
    }
    // Composite objects own internal constraints too.
    for (const constraint of entity.constraints ?? []) {
      this.M.Composite.remove(this.phys.localWorld, constraint);
    }
    return removed;
  }

  list() {
    return [...this.records.values()];
  }

  get(id) {
    return this.records.get(id) ?? null;
  }

  clear() {
    for (const record of [...this.records.values()]) this.remove(record);
  }

  /** Adjust length/stiffness on the fly (inspector + rope tool). */
  update(recordOrId, patch = {}) {
    const record = typeof recordOrId === 'string' ? this.records.get(recordOrId) : recordOrId;
    if (!record) return false;
    if (patch.length !== undefined && record.definition.length !== 0) {
      record.length = num(patch.length, record.length, record.definition.min, record.definition.max);
      record.constraint.length = record.length;
    }
    if (patch.stiffness !== undefined) {
      record.stiffness = num(patch.stiffness, record.stiffness, 0.02, 1);
      record.constraint.stiffness = record.stiffness;
    }
    if (patch.damping !== undefined) {
      record.damping = num(patch.damping, record.damping, 0, 1);
      record.constraint.damping = record.damping;
    }
    return true;
  }

  /* -------------------------------------------------------- serialisation */

  serialize() {
    return this.list().map((record) => ({
      id: record.id,
      type: record.type,
      bodyA: record.entityA?.id ?? null,
      bodyB: record.entityB?.id ?? null,
      anchor: record.anchor ? { x: record.anchor.x, y: record.anchor.y } : null,
      length: record.length,
      stiffness: record.stiffness,
      damping: record.damping,
      color: record.color,
      label: record.label,
    }));
  }

  /** Rebuild connections from a validated save file. */
  restore(list, lookup) {
    if (!Array.isArray(list)) return 0;
    let count = 0;
    for (const entry of list) {
      const entityA = entry.bodyA ? lookup(entry.bodyA) : null;
      const entityB = entry.bodyB ? lookup(entry.bodyB) : null;
      if (!entityB) continue;
      if (!entityA && !entry.anchor) continue;
      const record = this.create({
        id: entry.id,
        type: CONSTRAINT_TYPES[entry.type] ? entry.type : 'rope',
        entityA,
        entityB,
        anchor: entry.anchor ?? undefined,
        length: entry.length,
        stiffness: entry.stiffness,
        damping: entry.damping,
        color: entry.color ?? undefined,
      });
      if (record) count += 1;
    }
    return count;
  }

  /** Iterate for rendering: each connection draws as rope/chain/spring. */
  forEachDraw(callback) {
    for (const record of this.records.values()) {
      const { constraint } = record;
      const a = constraint.bodyA ? this.M.Constraint.pointAWorld(constraint) : (record.anchor ?? { x: 0, y: 0 });
      const b = this.M.Constraint.pointBWorld(constraint);
      callback(record, a, b);
    }
  }
}
