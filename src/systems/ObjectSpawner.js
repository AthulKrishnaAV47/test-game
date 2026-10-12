/**
 * ObjectSpawner — turns catalogue definitions (and save data) into entities.
 *
 * Responsibilities:
 *  - validate the spawn position: objects always appear inside the world and
 *    never inside static level geometry,
 *  - build simple bodies, multi-part contraptions and stacks,
 *  - register entities + bodies with the physics manager,
 *  - apply "override" props coming from level data, imports and the inspector,
 *  - duplicate / remove / resize with correct bookkeeping (no orphan bodies).
 */

import { OBJECT_DEFS, getDef } from '../config/objectCatalog.js';
import { getDefaultProps } from '../config/propSchema.js';
import { LIMITS, WORLD } from '../config/gameConfig.js';
import { Prop } from '../entities/Prop.js';
import { Ragdoll } from '../entities/Ragdoll.js';
import { buildSimpleBodies, resizeBody, defSize } from '../physics/BodyShapes.js';
import { CONTRAPTION_BUILDERS, buildStackPositions } from '../physics/Contraptions.js';
import { bus, EVENTS } from '../utils/events.js';
import { num, sanitizeColor } from '../utils/validation.js';
import { clamp } from '../utils/mathUtils.js';
import { clampToWorldRect } from '../utils/coordinateUtils.js';

export class ObjectSpawner {
  constructor(ctx) {
    this.ctx = ctx;
    this.M = ctx.M;
    this.phys = ctx.phys;
    /** hard ceiling: never create bodies past this, whatever the caller says */
    this.maxBodies = LIMITS.HARD_MAX_BODIES;
  }

  /* ------------------------------------------------------------------ spawn */

  /**
   * Spawn a catalogue object.
   * @param {string} type catalogue id
   * @param {number} x world x
   * @param {number} y world y
   * @param {object} [options] { props, angle, scale, color, level, silent, static }
   * @returns {Prop|Ragdoll|null}
   */
  spawn(type, x, y, options = {}) {
    const def = getDef(type);
    if (!def) {
      this.ctx.toast?.('error', 'Unknown object', `“${type}” is not in the library.`);
      return null;
    }
    if (def.spawnRagdoll) return this.spawnRagdoll(def.spawnRagdoll, x, y, options);

    const budget = this.checkBudget(def);
    if (!budget.ok) return null;

    const props = this.buildProps(def, options);
    const scale = props.scale ?? 1;
    const spot = this.findSpawnSpot(type, x, y, props, scale);
    if (!spot) return null;

    const entity = def.composite
      ? this.buildComposite(def, spot, props, scale, options)
      : this.buildSimple(def, spot, props, scale, options);

    if (!entity) return null;
    entity.level = Boolean(options.level);
    this.register(entity);
    this.applyInitialBehaviour(entity);
    this.reportSpawn(entity, options);
    return entity;
  }

  /** Spawn a ragdoll character (preset id from RAGDOLL_PRESETS). */
  spawnRagdoll(presetId, x, y, options = {}) {
    const budget = this.checkBudget(null, 15);
    if (!budget.ok) return null;
    if (this.phys.entitiesByTag('ragdoll').length >= LIMITS.MAX_RAGDOLLS) {
      this.ctx.toast?.('warn', 'Too many characters', `The scene already has ${LIMITS.MAX_RAGDOLLS} ragdolls.`);
      return null;
    }
    const scale = clamp(num(options.scale, 1, 0.4, 2), 0.4, 2);
    const spot = this.findSpawnSpot('ragdollLight', x, y, { scale, radius: 34 }, scale);
    if (!spot) return null;
    const ragdoll = new Ragdoll({
      M: this.M,
      def: getDef('ragdollLight'),
      presetId: presetId ?? 'lightweight',
      cosmetic: { ...this.ctx.character.defaultCosmetic, ...(options.cosmetic ?? {}) },
      scale,
      x: spot.x,
      y: spot.y,
      level: Boolean(options.level),
    });
    this.M.Composite.add(this.phys.localWorld, ragdoll.getBodies());
    this.M.Composite.add(this.phys.localWorld, ragdoll.constraints);
    this.phys.register(ragdoll);
    this.ctx.character.register(ragdoll, { makeActive: options.makeActive !== false });
    this.ctx.stats?.bump('ragdollsSpawned', 1);
    bus.emit(EVENTS.RAGDOLL_SPAWNED, { entity: ragdoll });
    this.reportSpawn(ragdoll, options);
    return ragdoll;
  }

  /** Build a single-body object. */
  buildSimple(def, spot, props, scale, options) {
    const isStatic = Boolean(options.static ?? props.static ?? def.static);
    const angle = num(options.angle ?? props.angleRad, 0, -Math.PI * 4, Math.PI * 4);
    const { bodies, size } = buildSimpleBodies(this.M, def, {
      x: spot.x,
      y: spot.y,
      angle,
      props: { ...props, static: isStatic },
      scale,
      isStatic,
    });
    if (!bodies.length) return null;
    const entity = new Prop({
      def,
      bodies,
      props,
      color: options.color ?? props.color ?? null,
      level: options.level,
      tag: options.tag,
    });
    entity.size = size;
    return entity;
  }

  /** Build a multi-part contraption (spring, pulley, rope, cannon, stack…). */
  buildComposite(def, spot, props, scale, options) {
    if (def.composite === 'stack') {
      const positions = buildStackPositions({ x: spot.x, y: spot.y - 40 * scale, scale });
      if (this.phys.bodyCount() + positions.length > this.maxBodies) {
        this.ctx.toast?.('warn', 'Body limit reached', 'A crate tower needs 5 free body slots.');
        return null;
      }
      const bodies = [];
      for (const p of positions) {
        const crateDef = getDef('crate');
        const { bodies: built } = buildSimpleBodies(this.M, crateDef, {
          x: p.x,
          y: p.y,
          props: { ...getDefaultProps(crateDef), ...props },
          scale,
        });
        bodies.push(...built);
      }
      return new Prop({ def, bodies, props, color: options.color ?? props.color ?? null, tag: options.tag });
    }

    const builder = CONTRAPTION_BUILDERS[def.composite];
    if (!builder) return null;
    const built = builder(this.M, def, { x: spot.x, y: spot.y, props, scale });
    if (!built?.bodies?.length) return null;
    for (const body of built.bodies) {
      body.deltaTime = 1000 / 60;
      body.timeScale = 1;
    }
    const entity = new Prop({
      def,
      bodies: built.bodies,
      constraints: built.constraints ?? [],
      props,
      color: options.color ?? props.color ?? null,
      state: built.state ?? {},
      parts: built.parts ?? [],
      tag: options.tag,
    });
    entity.handle = built.handle ?? null;
    return entity;
  }

  /** Register bodies + constraints in the world and fire spawn feedback. */
  register(entity) {
    const bodies = entity.getBodies();
    this.M.Composite.add(this.phys.localWorld, bodies);
    if (entity.constraints?.length) this.M.Composite.add(this.phys.localWorld, entity.constraints);
    this.phys.register(entity);
    for (const body of bodies) {
      body.entityId = entity.id;
      if (body.gravityScale === undefined) body.gravityScale = 1;
    }
    this.ctx.stats?.bump('objectsSpawned', 1);
    bus.emit(EVENTS.OBJECT_SPAWNED, { entity });
    return entity;
  }

  reportSpawn(entity, options = {}) {
    if (options.silent) return;
    this.ctx.sfx?.spawn?.();
    this.ctx.effects?.burst(entity.position.x, entity.position.y, '#ffffff', 6, 2.2, { life: 0.3, size: 2 });
    this.ctx.undo?.record(`Spawn ${entity.label}`, { spawn: entity });
    this.ctx.emitCount?.();
  }

  /** Spawn-time pop (a box that had been configured) + default props. */
  buildProps(def, options = {}) {
    const props = { ...getDefaultProps(def), ...(options.props ?? {}) };
    // level/save overrides that live at the top level of an item
    const overrides = options.overrides ?? {};
    for (const [key, value] of Object.entries(overrides)) {
      if (key === 'type' || key === 'id' || key === 'x' || key === 'y' || key === 'level') continue;
      props[key] = value;
    }
    if (options.scale !== undefined) props.scale = clamp(num(options.scale, 1, 0.35, 3), 0.35, 3);
    if (options.props?.scale === undefined && props.scale === undefined) props.scale = 1;
    if (options.color) props.color = sanitizeColor(options.color, null);
    return props;
  }

  applyInitialBehaviour(entity) {
    const def = entity.def;
    if (def?.destructible) {
      entity.hp = num(entity.props.hp, def.destructible.hp, 1, 400);
      entity.maxHp = entity.hp;
    }
    if (def?.sensor) entity.sensor = true;
    // Rope ends / pulley cradles can be grabbed like any other body.
    if (entity.parts?.length) {
      for (const part of entity.parts) {
        part.body.partName = part.name;
        part.body.entityId = entity.id;
      }
    }
  }

  /* ------------------------------------------------------------- utilities */

  checkBudget(def, extra = null) {
    const needed = extra ?? (def?.composite === 'stack' ? 5 : def?.composite ? 2 : 1);
    const total = this.phys.bodyCount() + needed;
    if (total > this.maxBodies) {
      this.ctx.toast?.('warn', 'Body limit reached', `The scene is at its ${this.maxBodies}-body safety limit — delete something first.`);
      this.ctx.ui?.flashLimit?.();
      return { ok: false };
    }
    if (total > LIMITS.MAX_BODIES) {
      this.ctx.toast?.('warn', 'Heavy scene', 'Object count is above the recommended limit; performance may drop.');
    }
    return { ok: true };
  }

  /**
   * Clamp the requested position inside the world and lift it out of static
   * geometry. Returns null if no free spot could be found (never spawn inside
   * the floor or outside the level).
   */
  findSpawnSpot(type, x, y, props = {}, scale = 1) {
    const def = getDef(type);
    const size = def ? defSize(def, props) : { w: 60 * scale, h: 120 * scale };
    const halfW = Math.max(8, ((size.w ?? (size.r ?? 20) * 2) * scale) / 2);
    const halfH = Math.max(8, ((size.h ?? (size.r ?? 20) * 2) * scale) / 2);
    let spot = clampToWorldRect(num(x, WORLD.width / 2), num(y, WORLD.height / 2), Math.max(halfW, halfH) + 8);
    const rect = { min: { x: spot.x - halfW, y: spot.y - halfH }, max: { x: spot.x + halfW, y: spot.y + halfH } };

    const overlapping = () => {
      const bodies = this.M.Query.region(this.phys.allBodies(), rect);
      return bodies.some((body) => body.isStatic || this.phys.getEntity(body)?.level);
    };
    let attempts = 0;
    while (overlapping() && attempts < 40) {
      spot.y -= halfH * 0.6 + 8;
      if (spot.y - halfH < 16) {
        // Nothing free upwards: place at the top of the world and let it fall.
        spot.y = halfH + 20;
        break;
      }
      rect.min.y = spot.y - halfH;
      rect.max.y = spot.y + halfH;
      attempts += 1;
    }
    if (attempts >= 40) {
      this.ctx.toast?.('warn', 'No room here', 'That spot is blocked — try somewhere with more space.');
      return null;
    }
    return { x: clamp(spot.x, halfW + 8, WORLD.width - halfW - 8), y: clamp(spot.y, halfH + 8, WORLD.height - 8) };
  }

  /* -------------------------------------------------------- data round trip */

  /** Rebuild an entity from serialized data (save files + undo/redo). */
  spawnFromData(item, options = {}) {
    if (!item || typeof item.type !== 'string') return null;
    const def = OBJECT_DEFS[item.type];
    if (!def) return null;
    const entity = this.spawn(item.type, num(item.x, WORLD.width / 2), num(item.y, 600), {
      props: item.props ?? {},
      angle: num(item.angle, 0),
      scale: item.scale,
      color: item.color ?? undefined,
      level: options.level ?? Boolean(item.level),
      silent: true,
      cosmetic: item.cos ?? undefined,
      cosmetic: item.cos ?? undefined,
      static: item.props?.static,
    });
    if (!entity) return null;
    if (item.initial && !options.keepPosition) {
      // Saved objects restart from their recorded transform, not the clamped spot.
      this.restoreTransform(entity, item);
    }
    if (Array.isArray(item.parts) && entity.restoreParts) entity.restoreParts(item.parts);
    if (item.props) entity.props = { ...entity.props, ...item.props };
    return entity;
  }

  restoreTransform(entity, data) {
    const M = this.M;
    const bodies = entity.getBodies();
    if (!bodies.length) return;
    const primary = bodies[0];
    const dx = num(data.x, primary.position.x) - primary.position.x;
    const dy = num(data.y, primary.position.y) - primary.position.y;
    for (const body of bodies) {
      M.Body.setPosition(body, { x: body.position.x + dx, y: body.position.y + dy }, true);
      M.Body.setVelocity(body, { x: 0, y: 0 });
      M.Body.setAngularVelocity(body, 0);
    }
    if (entity.kind === 'ragdoll' && Array.isArray(data.parts)) {
      entity.restoreParts(data.parts);
    }
  }

  /** Duplicate an entity next to the original. */
  duplicate(entity, offset = { x: 40, y: -30 }) {
    if (!entity) return null;
    const data = entity.serialize();
    delete data.id;
    const clone = this.spawnFromData({ ...data, x: data.x + offset.x, y: data.y + offset.y }, { level: false });
    if (clone) {
      bus.emit(EVENTS.OBJECT_DUPLICATED, { source: entity, clone });
      this.ctx.undo?.record(`Duplicate ${entity.label}`, { spawn: clone });
      this.ctx.selection?.select(clone);
      this.ctx.toast?.('info', 'Duplicated', `${entity.label} copied.`);
    }
    return clone;
  }

  /* -------------------------------------------------------------- mutation */

  /** Remove an entity and everything that points at it. */
  remove(entity, { reason = 'deleted', silent = false, keepUndo = false } = {}) {
    if (!entity || entity.removed) return false;
    this.ctx.constraints?.removeForEntity(entity);
    this.ctx.character?.unregister(entity);
    this.ctx.selection?.deselect(entity);
    entity.markRemoved(reason);
    this.phys.removeEntity(entity);
    if (!silent) {
      bus.emit(EVENTS.OBJECT_REMOVED, { entity, reason });
      this.ctx.effects?.burst(entity.position.x, entity.position.y, '#b9c6d8', 8, 2.2);
      this.ctx.emitCount?.();
      if (!keepUndo) this.ctx.undo?.record(`Delete ${entity.label}`, { removed: entity.serialize() });
    }
    return true;
  }

  /** Apply an editable property with immediate effect. */
  applyProp(entity, key, value) {
    if (!entity) return false;
    entity.props[key] = value;
    if (typeof entity.applyProp === 'function') {
      entity.applyProp(key, value);
    } else {
      this.fallbackApply(entity, key, value);
    }
    this.ctx.phys.wake(entity.body);
    if (key === 'initial') entity.initial = { ...(value ?? entity.initial) };
    return true;
  }

  /** Safety net for entities that do not implement applyProp themselves. */
  fallbackApply(entity, key, value) {
    const M = this.M;
    for (const body of entity.getBodies()) {
      switch (key) {
        case 'friction': body.friction = clamp(num(value, 0.5, 0, 1.4), 0, 1.4); break;
        case 'restitution': body.restitution = clamp(num(value, 0.2, 0, 1), 0, 1); break;
        case 'density': if (!body.isStatic) M.Body.setDensity(body, clamp(num(value, 0.001, 0.0002, 0.05), 0.0002, 0.05)); break;
        case 'static': case 'locked': M.Body.setStatic(body, Boolean(value)); break;
        case 'angle': M.Body.setAngle(body, num(value, 0, -Math.PI * 4, Math.PI * 4)); break;
        default: break;
      }
    }
  }

  /** Resize (inspector + resize handle). */
  resize(entity, factorX, factorY = factorX) {
    if (!entity || entity.locked) return false;
    const fx = clamp(num(factorX, 1, 0.2, 4), 0.2, 4);
    const fy = clamp(num(factorY, fx, 0.2, 4), 0.2, 4);
    entity.getBodies().forEach((body) => resizeBody(this.M, body, fx, fy));
    entity.props.scale = clamp((entity.props.scale ?? 1) * ((fx + fy) / 2), 0.35, 2.5);
    this.ctx.phys.wake(entity.body);
    return true;
  }

  rotate(entity, radians) {
    if (!entity) return false;
    for (const body of entity.getBodies()) {
      this.M.Body.setAngle(body, radians);
      this.M.Body.setAngularVelocity(body, 0);
    }
    this.ctx.phys.wake(entity.body);
    return true;
  }

  /** Move every body of an entity by a delta (undo-friendly). */
  translate(entity, dx, dy) {
    if (!entity) return false;
    for (const body of entity.getBodies()) {
      this.M.Body.setPosition(body, { x: body.position.x + dx, y: body.position.y + dy }, true);
      this.ctx.phys.wake(body);
    }
    return true;
  }
}
