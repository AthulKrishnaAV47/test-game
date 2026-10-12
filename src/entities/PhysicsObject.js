/**
 * PhysicsObject — the base entity for everything with presence in the physics
 * world. A single entity may own several Matter bodies (contraptions) and
 * several constraints (springs, pivots, ropes).
 *
 * Entities never touch Phaser directly: the renderer reads their state.
 */

import { uid } from '../utils/ids.js';
import { num, sanitizeColor } from '../utils/validation.js';

export class PhysicsObject {
  /**
   * @param {object} options
   * @param {object} options.def       catalogue definition
   * @param {Array}  options.bodies    Matter bodies (first one is primary)
   * @param {object} [options.props]   editable behaviour properties
   * @param {string} [options.color]   override colour
   */
  constructor({ id, def, bodies = [], props = {}, color = null, constraints = [], level = false, tag = null }) {
    this.id = id ?? uid(def?.id ?? 'obj');
    this.def = def;
    this.type = def?.id ?? 'unknown';
    this.label = def?.name ?? 'Object';
    this.bodies = bodies;
    this.constraints = constraints;
    this.props = { ...props };
    this.baseColor = color ?? null;
    this.level = Boolean(level);
    this.tag = tag ?? def?.id ?? null;
    this.behavior = def?.behavior ?? null;
    this.composite = def?.composite ?? null;
    this.removed = false;
    /** runtime additions by behaviour systems */
    this.state = {};
    this.createdAt = performance.now?.() ?? Date.now();
    this.locked = Boolean(this.props.locked);
    this.selected = false;

    // Remember the initial transform so resets are deterministic.
    const primary = this.body;
    this.initial = primary
      ? { x: primary.position.x, y: primary.position.y, angle: primary.angle }
      : { x: 0, y: 0, angle: 0 };
    this.initialParts = this.bodies.map((b) => ({
      x: b.position.x,
      y: b.position.y,
      angle: b.angle,
      velocity: { x: b.velocity.x, y: b.velocity.y },
      angularVelocity: b.angularVelocity,
    }));
    this.initialProps = { ...this.props };
  }

  get body() {
    return this.bodies[0] ?? null;
  }

  get position() {
    return this.body?.position ?? { x: 0, y: 0 };
  }

  get angle() {
    return this.body?.angle ?? 0;
  }

  get isStatic() {
    return Boolean(this.body?.isStatic);
  }

  get pointCount() {
    return this.bodies.reduce((n, b) => n + 1, 0);
  }

  getBodies() {
    return this.bodies;
  }

  hasTag(tag) {
    if (!tag) return false;
    if (this.tag === tag) return true;
    return Boolean(this.def?.tags?.includes(tag));
  }

  /** Live world-space bounds (used by selection and field queries). */
  bounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const body of this.bodies) {
      const b = body.bounds;
      minX = Math.min(minX, b.min.x);
      minY = Math.min(minY, b.min.y);
      maxX = Math.max(maxX, b.max.x);
      maxY = Math.max(maxY, b.max.y);
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
  }

  /** Colour used by the renderer (props override the catalogue colour). */
  get color() {
    return sanitizeColor(this.props.color ?? this.baseColor ?? this.def?.color ?? '#cccccc', '#cccccc');
  }

  /**
   * Apply a property change. The heavy lifting lives in the spawner/behaviour
   * code which installs `applyProp`; this wrapper keeps callers simple.
   */
  setProp(key, value) {
    this.props[key] = value;
    if (key === 'locked') this.locked = Boolean(value);
    if (typeof this.applyProp === 'function') this.applyProp(key, value);
  }

  getProp(key, fallback = 0) {
    return this.props[key] ?? fallback;
  }

  /** Total mass of every body in the entity. */
  mass() {
    return this.bodies.reduce((sum, b) => sum + (b.mass || 0), 0);
  }

  speed() {
    const body = this.body;
    if (!body) return 0;
    return Math.hypot(body.velocity.x, body.velocity.y);
  }

  /** Mark for removal; the spawner/systems perform the actual world cleanup. */
  markRemoved(reason = 'removed') {
    this.removed = true;
    this.removalReason = reason;
  }

  /** Serialise for save files (initial transform + current state). */
  serialize() {
    const primary = this.body;
    return {
      id: this.id,
      type: this.type,
      x: num(primary?.position.x, 0),
      y: num(primary?.position.y, 0),
      angle: num(primary?.angle, 0),
      scale: num(this.props.scale, 1, 0.35, 3),
      color: sanitizeColor(this.props.color ?? this.baseColor, null),
      props: { ...this.props },
      cos: this.cosmetic ? { ...this.cosmetic } : null,
      initial: { ...this.initial },
      parts: this.kind === 'ragdoll' ? this.serializeParts() : null,
    };
  }

  /** Overridden by ragdolls. */
  serializeParts() {
    return null;
  }
}
