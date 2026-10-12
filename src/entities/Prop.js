/**
 * Prop — a catalogue object with a Matter body (or bodies) and editable
 * behaviour properties.
 *
 * Composites (springs, pulleys, ropes…) are still one entity: they own several
 * bodies plus the constraints that hold them together, which keeps selection,
 * deletion, serialisation and undo uniform for every spawnable object.
 */

import { PhysicsObject } from './PhysicsObject.js';
import { MATERIALS } from '../config/gameConfig.js';
import { resizeBody, setKinematic } from '../physics/BodyShapes.js';
import { clamp } from '../utils/mathUtils.js';
import { num, sanitizeColor } from '../utils/validation.js';
import { bus, EVENTS } from '../utils/events.js';

export class Prop extends PhysicsObject {
  constructor({ id, def, bodies = [], props = {}, color = null, constraints = [], level = false, state = {}, parts = [], tag = null }) {
    super({ id, def, bodies, props, color, constraints, level, tag });
    this.kind = def?.composite ? 'contraption' : 'prop';
    this.state = state;
    this.parts = parts;
    this.hp = def?.destructible ? num(props.hp, def.destructible.hp, 1, 400) : null;
    this.maxHp = this.hp;
    this.damageFlash = 0;
    this.spawnTime = 0;
    this.fuseTimer = def?.behavior === 'fuseBomb' ? num(props.fuse, 2.5, 0.2, 12) : null;
    this.fired = false;
    this.stuck = false;
  }

  /** Additive gravity scale per body: Matter 0.20 ignores `body.gravityScale`. */
  setGravityParticipation(on) {
    const scale = on ? 1 : 0;
    for (const body of this.bodies) body.gravityScale = scale;
    this.props.affectedByGravity = Boolean(on);
  }

  get gravityScale() {
    return this.props.affectedByGravity === false ? 0 : 1;
  }

  /** Objects with a fuse burn down inside the fixed step. */
  tickFuse(dt) {
    if (this.fuseTimer === null || this.fuseTimer < 0) return;
    this.fuseTimer -= dt;
    if (this.fuseTimer <= 0) {
      this.fuseTimer = -1;
      this.ctx?.forces?.explodeEntity(this, { chain: 1, remove: false, damageScale: 1.1 });
      bus.emit(EVENTS.BOMB_FUSED, { entity: this });
    }
  }

  /** Light a fuse (also used by the rope/joint tool and challenge setups). */
  lightFuse(seconds = null) {
    this.fuseTimer = num(seconds, this.props.fuse ?? 2.5, 0.2, 12);
    this.ctx?.sfx?.prop?.('fuse', 0.6);
    bus.emit(EVENTS.BOMB_FUSED, { entity: this, lit: true, seconds: this.fuseTimer });
  }

  /** Fire a cannon (behaviour === 'cannon'). */
  fireCannon() {
    if (!this.state.cannon || this.fired) return false;
    const { muzzle, angle, power } = this.state.cannon;
    const spawner = this.ctx?.spawner;
    if (!spawner) return false;
    const world = this.ctx.world;
    const spots = { x: muzzle.x, y: muzzle.y };
    const projectile = spawner.spawn(this.props.ammo ?? 'ball', spots.x, spots.y, { silent: true });
    if (!projectile) return false;
    const clampedPower = clamp(num(this.props.power, power, 2, 40), 2, 40);
    this.ctx.forces.launch(projectile, Math.cos(angle) * clampedPower, Math.sin(angle) * clampedPower);
    this.ctx.effects?.explosion(muzzle.x, muzzle.y, 90);
    this.ctx.sfx?.prop?.('cannon', 0.8);
    this.fired = true;
    this.cooldown = num(this.props.reload, 1.1, 0.1, 8);
    bus.emit(EVENTS.PROJECTILE_FIRED, { entity: this, projectile, angle, power: clampedPower });
    return true;
  }

  /** Per-step behaviour hook (called by the world's step handler). */
  onStep(dt, phys) {
    this.spawnTime += dt;
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);

    // Fuses and teleporter cooldowns live in FieldBehaviors (registered once per
    // world); the cannon is the only behaviour this entity drives itself.
    if (this.behavior === 'cannon' && this.props.autoFire) {
      this.cooldown = Math.max(0, (this.cooldown ?? 0) - dt);
      if (this.cooldown === 0 && !this.fired) this.fireCannon();
    }
  }

  /** Editable properties map to real engine changes. */
  applyProp(key, value) {
    const M = this.M ?? this.ctx?.M;
    const bodies = this.getBodies();
    switch (key) {
      case 'density': {
        const density = clamp(num(value, 0.001, 0.0002, 0.05), 0.0002, 0.05);
        for (const body of bodies) {
          if (body.isStatic) continue;
          M.Body.setDensity(body, density);
        }
        break;
      }
      case 'friction':
        for (const body of bodies) body.friction = clamp(num(value, 0.5, 0, 1.4), 0, 1.4);
        break;
      case 'restitution':
        for (const body of bodies) body.restitution = clamp(num(value, 0.2, 0, 1), 0, 1);
        break;
      case 'static':
      case 'locked': {
        const isStatic = Boolean(value);
        for (const body of bodies) M.Body.setStatic(body, isStatic);
        this.locked = isStatic;
        break;
      }
      case 'affectedByGravity':
        this.setGravityParticipation(Boolean(value));
        break;
      case 'scale': {
        const next = clamp(num(value, 1, 0.35, 2.5), 0.35, 2.5);
        const current = this.props.scale ?? 1;
        if (next !== current) {
          const factor = next / current;
          for (const body of bodies) resizeBody(M, body, factor, factor);
          this.props.scale = next;
        }
        break;
      }
      case 'angle': {
        const radians = num(value, 0, -Math.PI * 2, Math.PI * 2);
        for (const body of bodies) {
          M.Body.setAngle(body, radians);
          M.Body.setAngularVelocity(body, 0);
        }
        break;
      }
      case 'color':
        this.baseColor = sanitizeColor(value, this.baseColor ?? '#cccccc');
        this.props.color = this.baseColor;
        break;
      case 'hp': {
        this.hp = clamp(num(value, 30, 1, 400), 1, 400);
        this.maxHp = this.hp;
        break;
      }
      /* behaviour parameters ------------------------------------------------ */
      case 'stiffness': {
        const v = clamp(num(value, 0.5, 0.02, 1), 0.02, 1);
        for (const s of [this.state.spring, this.state.seesaw, this.state.hinge, this.state.lever]) {
          if (s?.constraint) s.constraint.stiffness = v;
        }
        break;
      }
      case 'damping': {
        const v = clamp(num(value, 0.05, 0, 1), 0, 1);
        for (const s of [this.state.spring, this.state.seesaw, this.state.hinge, this.state.lever]) {
          if (s?.constraint) s.constraint.damping = v;
        }
        break;
      }
      case 'length': {
        const scale = this.props.scale ?? 1;
        const v = clamp(num(value, 110, 10, 900), 10, 900) * scale;
        if (this.state.spring?.constraint) this.state.spring.constraint.length = v;
        if (this.state.pulley) this.state.pulley.length = v;
        if (this.state.piston) this.state.piston.travel = clamp(num(value, 90, 10, 260), 10, 260) * scale;
        if (this.state.cannon) this.state.cannon.length = clamp(num(value, 92, 30, 200), 30, 200) * scale;
        break;
      }
      case 'segments':
        // Segment count is a build-time property: recorded so saves reload the
        // same rope, but the live chain is not re-built under the player.
        this.props.segments = Math.round(clamp(num(value, 10, 3, 26), 3, 26));
        break;
      case 'distance':
        this.state.origin = undefined;
        this.state.phase = 0;
        break;
      case 'direction':
      case 'speed':
      case 'strength':
      case 'radius':
      case 'fuse':
      case 'power':
      case 'blastRadius':
      case 'blastForce':
      case 'duration':
      case 'link':
      case 'ammo':
      case 'autoFire':
      case 'interval':
      case 'spawnType':
        // Read live by the behaviour systems each step.
        break;
      default:
        break;
    }
    bus.emit(EVENTS.OBJECT_CHANGED, { entity: this, key, value });
  }

  /** Kinematic bodies (conveyors, motors, pistons) are moved by behaviours. */
  moveKinematic(body, position, angle = null) {
    setKinematic(this.M ?? this.ctx?.M, body, position, angle);
  }

  serialize() {
    const data = super.serialize();
    if (this.kind === 'contraption') {
      data.parts = this.parts.map((part) => ({
        name: part.name,
        x: part.body.position.x,
        y: part.body.position.y,
        angle: part.body.angle,
      }));
    }
    return data;
  }

  restoreParts(list) {
    if (!Array.isArray(list) || !this.parts.length) return;
    const M = this.M ?? this.ctx?.M;
    for (const entry of list) {
      const part = this.parts.find((p) => p.name === entry.name);
      if (!part) continue;
      M.Body.setPosition(part.body, { x: num(entry.x, part.body.position.x), y: num(entry.y, part.body.position.y) }, true);
      M.Body.setAngle(part.body, num(entry.angle, 0), true);
      M.Body.setVelocity(part.body, { x: 0, y: 0 });
      M.Body.setAngularVelocity(part.body, 0);
    }
  }

  /** Material key used by sounds/particles. */
  get materialKey() {
    return MATERIALS[this.props.material ?? this.def?.material] ? (this.props.material ?? this.def?.material) : 'wood';
  }
}
