/**
 * PhysicsManager — owns the Matter world used by a scene.
 *
 * Responsibilities
 *  - fixed-timestep stepping (the engine always advances in whole 1/60s steps;
 *    simulation speed only changes how many steps happen per real second),
 *  - pause / resume / single step,
 *  - frame-time clamping after tab suspension,
 *  - a body <-> entity registry used by selection, collision handling and
 *    serialisation,
 *  - ordered pre-step callbacks for behaviours (fields, motors, ragdoll
 *    control). Behaviours run right before `Engine.update`, i.e. within the
 *    same deterministic step as the solver.
 */

import { PHYSICS, LIMITS } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';

export class PhysicsManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts
   * @param {object} opts.Matter - the Matter namespace used by the scene
   * @param {object} opts.settings - SettingsManager
   */
  constructor(scene, { Matter, settings }) {
    this.scene = scene;
    this.M = Matter;
    this.settings = settings;
    this.world = scene.matter.world;
    this.engine = this.world.engine;
    this.localWorld = this.world.localWorld;

    // We drive the engine ourselves: deterministic steps at a fixed rate.
    this.world.autoUpdate = false;

    this.paused = false;
    this.speed = 1;
    this.accumulator = 0;
    this.simTime = 0;      // seconds of simulated time
    this.stepCount = 0;
    this.stepsLastFrame = 0;
    this.lastFrameDelta = 0;

    /** @type {Set<Function>} pre-step callbacks: (dtSeconds, simTime) => void */
    this.stepHandlers = new Set();
    /** @type {Map<number, object>} Matter body id -> entity */
    this.bodyMap = new Map();
    /** @type {Set<object>} live entities */
    this.entities = new Set();
    /** Collision listeners receive (event, phys) */
    this.collisionHandlers = new Set();

    this.engine.enableSleeping = true;
    this.applyQuality(this.settings?.get('quality') ?? 'high');

    this._onCollisionStart = (event) => this.emitCollisions('collisionStart', event);
    this._onCollisionActive = (event) => this.emitCollisions('collisionActive', event);
    this._onCollisionEnd = (event) => this.emitCollisions('collisionEnd', event);
    this.M.Events.on(this.engine, 'collisionStart', this._onCollisionStart);
    this.M.Events.on(this.engine, 'collisionActive', this._onCollisionActive);
    this.M.Events.on(this.engine, 'collisionEnd', this._onCollisionEnd);

    // Safety net: if the tab was hidden, drop stale accumulated time.
    this._onVisibility = () => {
      this.accumulator = 0;
      this.lastFrameDelta = 0;
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibility);
    }
  }

  /* ------------------------------------------------------------------ setup */

  applyQuality(quality) {
    const preset = PHYSICS.ITERATIONS[quality] ?? PHYSICS.ITERATIONS.medium;
    this.engine.positionIterations = preset.position;
    this.engine.velocityIterations = preset.velocity;
    this.engine.constraintIterations = preset.constraint;
  }

  setGravity(gravity) {
    if (!gravity) return;
    const { scale = 1, x = 0, y = 1 } = gravity;
    this.engine.gravity.x = x;
    this.engine.gravity.y = y;
    // Matter's `scale` is 0.001 by default; keep the preset multiplier separate
    // so `getGravityAcceleration()` can report real px/step² numbers.
    this.engine.gravity.scale = 0.001 * scale;
  }

  getGravity() {
    return {
      x: this.engine.gravity.x,
      y: this.engine.gravity.y,
      scale: (this.engine.gravity.scale ?? 0.001) / 0.001,
    };
  }

  /**
   * Gravity expressed as an acceleration in px/step² (Matter accelerates a body
   * by `gravity.y * gravity.scale * deltaTime²` per step, with delta in ms).
   */
  getGravityAcceleration() {
    const g = this.engine.gravity;
    const scale = g.scale ?? 0.001;
    return { x: g.x * scale * PHYSICS.DELTA_TIME_SQ, y: g.y * scale * PHYSICS.DELTA_TIME_SQ };
  }

  setGravityEnabled(enabled, gravity) {
    if (enabled) {
      this.setGravity(gravity ?? { x: 0, y: 1, scale: 1 });
    } else {
      this.setGravity({ x: 0, y: 0, scale: 1 });
    }
  }

  /* ------------------------------------------------------------------ flow */

  setSpeed(speed) {
    this.speed = Math.min(3, Math.max(0.05, Number.isFinite(speed) ? speed : 1));
    bus.emit(EVENTS.SIM_STATE, this.state());
  }

  pause() {
    this.paused = true;
    this.accumulator = 0;
    bus.emit(EVENTS.SIM_STATE, this.state());
  }

  resume() {
    this.paused = false;
    this.accumulator = 0;
    bus.emit(EVENTS.SIM_STATE, this.state());
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** Advance exactly one fixed step even while paused (debug/step button). */
  singleStep(steps = 1) {
    const count = Math.max(1, Math.min(10, Math.floor(steps)));
    this.paused = true;
    for (let i = 0; i < count; i += 1) this.doStep(PHYSICS.STEP_MS);
    bus.emit(EVENTS.SIM_STATE, { ...this.state(), stepped: true });
  }

  state() {
    return {
      paused: this.paused,
      speed: this.speed,
      simTime: this.simTime,
      steps: this.stepCount,
    };
  }

  /**
   * Called every render frame by the scene. Returns the number of steps taken.
   */
  update(deltaMs) {
    this.stepsLastFrame = 0;
    if (this.paused) return 0;

    const clamped = Math.min(
      Number.isFinite(deltaMs) ? deltaMs : PHYSICS.STEP_MS,
      PHYSICS.MAX_FRAME_DELTA
    );
    this.lastFrameDelta = clamped;
    this.accumulator += clamped * this.speed;

    let steps = 0;
    while (this.accumulator >= PHYSICS.STEP_MS && steps < PHYSICS.MAX_STEPS_PER_FRAME) {
      this.doStep(PHYSICS.STEP_MS);
      this.accumulator -= PHYSICS.STEP_MS;
      steps += 1;
    }
    // Never let the accumulator spiral: a huge backlog means we simply skip time.
    if (this.accumulator > PHYSICS.STEP_MS * PHYSICS.MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.stepsLastFrame = steps;
    return steps;
  }

  /** One deterministic simulation step. */
  doStep(delta) {
    const dt = delta / 1000;
    for (const handler of [...this.stepHandlers]) {
      try {
        handler(dt, this.simTime, this);
      } catch (err) {
        console.error('[PhysicsManager] step handler failed:', err);
      }
    }
    this.world.step(delta);
    this.simTime += dt;
    this.stepCount += 1;
  }

  addStepHandler(handler) {
    this.stepHandlers.add(handler);
    return () => this.stepHandlers.delete(handler);
  }

  addCollisionHandler(handler) {
    this.collisionHandlers.add(handler);
    return () => this.collisionHandlers.delete(handler);
  }

  emitCollisions(phase, event) {
    if (!this.collisionHandlers.size) return;
    for (const handler of [...this.collisionHandlers]) {
      try {
        handler(phase, event, this);
      } catch (err) {
        console.error(`[PhysicsManager] collision handler failed (${phase}):`, err);
      }
    }
  }

  /* -------------------------------------------------------------- registry */

  register(entity) {
    if (!entity) return entity;
    this.entities.add(entity);
    for (const body of entity.getBodies()) {
      this.bodyMap.set(body.id, entity);
      body.gameEntity = entity;
    }
    bus.emit(EVENTS.ENTITY_COUNT, { count: this.bodyCount(), entities: this.entities.size });
    return entity;
  }

  unregister(entity) {
    if (!entity) return;
    this.entities.delete(entity);
    for (const body of entity.getBodies()) {
      this.bodyMap.delete(body.id);
    }
    bus.emit(EVENTS.ENTITY_COUNT, { count: this.bodyCount(), entities: this.entities.size });
  }

  /** Resolve the entity that owns a Matter body (handles composite parts). */
  getEntity(body) {
    if (!body) return null;
    if (body.gameEntity) return body.gameEntity;
    return this.bodyMap.get(body.id) ?? null;
  }

  bodyCount() {
    return this.bodyMap.size;
  }

  canSpawn(extraBodies = 1) {
    const total = this.bodyCount() + extraBodies;
    return {
      ok: total <= LIMITS.HARD_MAX_BODIES,
      warn: total > LIMITS.MAX_BODIES,
      total,
    };
  }

  /** Wake a sleeping body (and its whole entity) so forces take effect. */
  wake(body) {
    if (!body) return;
    const entity = this.getEntity(body) ?? body.gameEntity;
    const bodies = entity?.getBodies?.() ?? [body];
    for (const b of bodies) {
      this.M.Sleeping?.set?.(b, false);
      if (typeof b.isSleeping === 'boolean') b.isSleeping = false;
      b.sleepCounter = 0;
    }
  }

  allBodies() {
    return this.M.Composite.allBodies(this.localWorld);
  }

  /* ---------------------------------------------------------------- queries */

  /** All entities whose any part overlaps the given world rectangle. */
  entitiesInRect(rect) {
    const found = new Set();
    const bodies = this.M.Query.region(this.allBodies(), rect);
    for (const body of bodies) {
      const entity = this.getEntity(body);
      if (entity) found.add(entity);
    }
    return [...found];
  }

  /** Topmost entity at a world point (prefers dynamic bodies). */
  entityAtPoint(point, { includeStatic = true, filter = null } = {}) {
    const bodies = this.M.Query.point(this.allBodies(), point);
    const candidates = bodies
      .map((body) => ({ body, entity: this.getEntity(body) }))
      .filter((c) => c.entity && (filter ? filter(c.entity) : true))
      .filter((c) => includeStatic || !c.body.isStatic);
    if (!candidates.length) return null;
    // Dynamic bodies win over static ones; otherwise pick the newest body.
    candidates.sort((a, b) => {
      const aScore = (a.body.isStatic ? 0 : 1) * 1e6 + a.body.id;
      const bScore = (b.body.isStatic ? 0 : 1) * 1e6 + b.body.id;
      return bScore - aScore;
    });
    return candidates[0].entity;
  }

  /** Entities with a part whose centre is within `radius` of `center`. */
  entitiesInCircle(center, radius) {
    const found = new Set();
    for (const entity of this.entities) {
      if (entity.removed) continue;
      for (const body of entity.getBodies()) {
        const b = body.bounds;
        const nx = Math.max(b.min.x, Math.min(center.x, b.max.x));
        const ny = Math.max(b.min.y, Math.min(center.y, b.max.y));
        const dx = center.x - nx;
        const dy = center.y - ny;
        if (dx * dx + dy * dy <= radius * radius) {
          found.add(entity);
          break;
        }
      }
    }
    return [...found];
  }

  entitiesWithBehavior(behavior) {
    return [...this.entities].filter((e) => !e.removed && e.behavior === behavior);
  }

  entitiesByTag(tag) {
    return [...this.entities].filter((e) => !e.removed && e.hasTag(tag));
  }

  /* --------------------------------------------------------------- cleanup */

  /** Remove an entity's bodies & constraints from the Matter world. */
  removeEntity(entity) {
    if (!entity) return;
    for (const constraint of entity.constraints ?? []) {
      this.M.Composite.remove(this.localWorld, constraint);
    }
    for (const body of entity.getBodies()) {
      this.M.Composite.remove(this.localWorld, body);
    }
    this.unregister(entity);
  }

  /** Remove leftovers (debris) plus stale handler references. */
  destroy() {
    this.stepHandlers.clear();
    this.collisionHandlers.clear();
    this.M.Events.off(this.engine, 'collisionStart', this._onCollisionStart);
    this.M.Events.off(this.engine, 'collisionActive', this._onCollisionActive);
    this.M.Events.off(this.engine, 'collisionEnd', this._onCollisionEnd);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    this.bodyMap.clear();
    this.entities.clear();
  }
}
