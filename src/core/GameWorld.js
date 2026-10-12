/**
 * GameWorld — assembles one playable world and keeps it running.
 *
 * A world owns the physics services (Matter world, constraints, forces,
 * collisions, field behaviours) plus the gameplay systems that operate on them.
 * Scenes create a world, hand it player input and let it update; modes
 * (sandbox / challenge / build / arena) differ only by which manager is
 * attached, so every mode shares the same physics and interaction rules.
 */

import { PhysicsManager } from '../physics/PhysicsManager.js';
import { ConstraintManager } from '../physics/ConstraintManager.js';
import { ForceManager } from '../physics/ForceManager.js';
import { CollisionManager } from '../physics/CollisionManager.js';
import { registerFieldBehaviors } from '../physics/FieldBehaviors.js';
import { ObjectSpawner } from '../systems/ObjectSpawner.js';
import { DestructionManager } from '../systems/DestructionManager.js';
import { EffectsManager } from '../systems/EffectsManager.js';
import { CharacterManager } from '../systems/CharacterManager.js';
import { SelectionSystem } from '../systems/SelectionSystem.js';
import { UndoRedoManager } from '../systems/UndoRedoManager.js';
import { SaveManager } from '../systems/SaveManager.js';
import { CameraController } from '../systems/CameraController.js';
import { ToolSystem } from '../systems/ToolSystem.js';
import { ChallengeManager } from '../systems/ChallengeManager.js';
import { ArenaManager } from '../systems/ArenaManager.js';
import { buildLevelScene, getLevel } from '../config/levels.js';
import { getChallenge } from '../config/challenges.js';
import { GRAVITY_PRESETS, WORLD } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';
import { sanitizeGravity } from '../utils/validation.js';

export class GameWorld {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} services { settings, stats, achievements, sfx, store, Matter }
   */
  constructor(scene, services) {
    this.scene = scene;
    this.settings = services.settings;
    this.stats = services.stats;
    this.achievements = services.achievements;
    this.sfx = services.sfx;
    this.store = services.store;
    this.M = services.Matter;

    this.mode = 'sandbox';
    this.levelId = 'laboratory';
    this.challengeId = null;
    this.gravityEnabled = true;
    this.gravityPresetId = 'normal';
    this.customPlatforms = [];
    /** Snapshot that Reset restores (stored separately from live state). */
    this.initialSnapshot = null;
    /** Build Mode design snapshot, kept while testing. */
    this.designSnapshot = null;
    this.paused = false;
    this.fps = 60;

    this.buildContext();
  }

  buildContext() {
    const ctx = {
      scene: this.scene,
      M: this.M,
      settings: this.settings,
      stats: this.stats,
      achievements: this.achievements,
      sfx: this.sfx,
      store: this.store,
      world: this,
      mode: this.mode,
      levelId: this.levelId,
      toast: (type, title, message) => bus.emit(EVENTS.TOAST, { type, title, message }),
      emitCount: () => this.emitCounts(),
    };
    ctx.phys = new PhysicsManager(this.scene, { Matter: this.M, settings: this.settings });
    ctx.constraints = new ConstraintManager(ctx);
    ctx.forces = new ForceManager(ctx);
    ctx.effects = new EffectsManager(ctx);
    ctx.destruction = new DestructionManager(ctx);
    ctx.collision = new CollisionManager(ctx);
    ctx.spawner = new ObjectSpawner(ctx);
    ctx.character = new CharacterManager(ctx);
    ctx.selection = new SelectionSystem(ctx);
    ctx.undo = new UndoRedoManager(ctx);
    ctx.save = new SaveManager(ctx);
    ctx.camera = new CameraController(ctx);
    ctx.tools = new ToolSystem(ctx);
    this.ctx = ctx;

    // Field behaviours run inside the fixed step, alongside character control.
    ctx.unregisterFields = registerFieldBehaviors(ctx);
    ctx.unregisterGravity = ctx.phys.addStepHandler(() => this.applyPerBodyGravity());
    this.ctx.mode = this.mode;
  }

  /* -------------------------------------------------------------- lifecycle */

  /** Load a mode: fresh scene, level scenery, optional challenge items. */
  start(config = {}) {
    this.mode = config.mode ?? this.mode;
    this.ctx.mode = this.mode;
    const challengeDef = this.mode === 'challenge'
      ? getChallenge(config.challengeId ?? this.challengeId)
      : null;
    this.challengeId = challengeDef?.id ?? config.challengeId ?? null;
    this.levelId = config.levelId ?? challengeDef?.level ?? this.levelId ?? 'laboratory';
    this.customPlatforms = [];

    const level = getLevel(this.levelId);
    const gravity = sanitizeGravity(config.gravity ?? level.gravity ?? { x: 0, y: 1, scale: 1 });
    this.gravityEnabled = gravity.scale > 0;
    this.gravityPresetId = config.gravityPresetId ?? 'normal';
    this.ctx.levelId = this.levelId;

    this.clearAll({ silent: true });
    this.ctx.camera.setup();
    this.ctx.phys.setGravity(gravity);
    this.ctx.phys.setSpeed(config.speed ?? this.settings?.get('simSpeed') ?? 1);
    this.ctx.phys.resume();

    const built = buildLevelScene(this.levelId);
    for (const item of [...built.platforms, ...built.items]) this.spawnItem(item, { level: true });

    if (challengeDef) {
      for (const item of challengeDef.items ?? []) this.spawnItem(item, { level: true });
      if (challengeDef.camera) this.ctx.camera.focusOn(challengeDef.camera);
    }

    if (config.layout) this.applyLayout(config.layout);

    this.initialSnapshot = this.snapshot();
    this.attachModeManager({ ...config, challengeId: this.challengeId });
    this.ctx.undo.clear();
    this.emitCounts();
    bus.emit(EVENTS.SCENE_READY, {
      mode: this.mode,
      levelId: this.levelId,
      challengeId: this.challengeId,
    });
    return this;
  }

  attachModeManager(config = {}) {
    this.challenge?.destroy?.();
    this.arena?.destroy?.();
    this.challenge = null;
    this.arena = null;
    if (this.mode === 'challenge') {
      const def = getChallenge(config.challengeId ?? this.challengeId);
      this.challenge = new ChallengeManager(this.ctx, def, config.challenge ?? {});
      this.challenge.begin();
    } else if (this.mode === 'arena') {
      this.arena = new ArenaManager(this.ctx, config.arena ?? {});
      this.arena.begin();
    }
  }

  /** Remove player objects; level scenery survives unless told otherwise. */
  clearAll({ silent = false, keepLevel = true } = {}) {
    for (const entity of [...this.ctx.phys.entities]) {
      if (keepLevel && entity.level) continue;
      this.ctx.spawner.remove(entity, { reason: 'clear', silent: true, keepUndo: true });
    }
    this.ctx.constraints.clear();
    this.ctx.effects.clear();
    this.ctx.destruction.clear();
    this.ctx.selection.clear();
    this.ctx.undo.clear();
    this.customPlatforms = [];
    if (!silent) {
      this.ctx.toast('info', 'Scene cleared', 'Level scenery was kept — Reset restores everything.');
      this.emitCounts();
      bus.emit(EVENTS.SCENE_READY, { mode: this.mode, reason: 'clear' });
    }
  }

  /**
   * Reset to the initial scene. Objects are rebuilt from the snapshot, so no
   * body or listener is ever duplicated and gravity/velocities are deterministic.
   */
  reset({ silent = false, rebuild = true } = {}) {
    const snapshot = this.initialSnapshot ?? this.snapshot();
    this.ctx.phys.resume();
    this.ctx.phys.setSpeed(snapshot.sim?.speed ?? this.ctx.phys.speed);
    this.ctx.effects.clear();
    this.ctx.destruction.clear();
    this.ctx.character.clear();
    for (const entity of [...this.ctx.phys.entities]) {
      this.ctx.spawner.remove(entity, { reason: 'reset', silent: true, keepUndo: true });
    }
    this.ctx.constraints.clear();
    this.ctx.selection.clear();
    this.ctx.undo.clear();
    this.customPlatforms = [];

    if (rebuild) {
      const lookup = new Map();
      for (const item of snapshot.objects) {
        const entity = this.spawnItem(item, { lookup });
        if (entity && item.id) lookup.set(item.id, entity);
      }
      this.ctx.constraints.restore(snapshot.constraints, (id) => lookup.get(id));
    }
    this.ctx.phys.setGravity(snapshot.gravity);
    this.gravityEnabled = (snapshot.gravity?.scale ?? 1) > 0;
    this.challenge?.onReset?.();
    this.arena?.onReset?.();
    this.emitCounts();
    bus.emit(EVENTS.SCENE_RESET, { mode: this.mode });
    if (!silent) this.ctx.toast('info', 'Scene reset', 'Positions, velocities and gravity are back to the start.');
  }

  /** Serialise the current scene state. */
  snapshot() {
    const objects = [];
    for (const entity of this.ctx.phys.entities) {
      if (entity.removed) continue;
      const data = entity.serialize();
      data.level = Boolean(entity.level);
      objects.push(data);
    }
    return {
      levelId: this.levelId,
      gravity: this.ctx.phys.getGravity(),
      sim: { speed: this.ctx.phys.speed },
      objects,
      constraints: this.ctx.constraints.serialize(),
      platforms: this.customPlatforms.map((p) => ({ ...p })),
    };
  }

  /** Spawn one item from level data, a save file or a snapshot. */
  spawnItem(item, { level = false, lookup = null } = {}) {
    if (!item) return null;
    const { type, x, y, angle, color, cos, parts, width, height, scale, static: isStatic, ...rest } = item;
    const overrides = { ...rest, width, height, scale, static: isStatic };
    const entity = this.ctx.spawner.spawn(type, x, y, {
      overrides,
      props: item.props ?? {},
      angle,
      scale,
      color,
      cosmetic: cos ?? undefined,
      level: level || Boolean(item.level),
      silent: true,
      makeActive: false,
    });
    if (!entity) return null;
    if (item.id && lookup) lookup.set(item.id, entity);
    if (parts && entity.restoreParts) entity.restoreParts(parts);
    if (item.initial) entity.initial = { ...item.initial };
    return entity;
  }

  /** Apply a validated layout document (import / named save). */
  applyLayout(layout, { silent = true } = {}) {
    if (!layout) return { objects: 0 };
    this.clearAll({ silent: true });
    if (layout.levelId && layout.levelId !== this.levelId) {
      this.levelId = layout.levelId;
      this.ctx.levelId = this.levelId;
      const built = buildLevelScene(this.levelId);
      for (const item of [...built.platforms, ...built.items]) this.spawnItem(item, { level: true });
    }
    this.ctx.phys.setGravity(sanitizeGravity(layout.gravity ?? this.ctx.phys.getGravity()));
    if (layout.sim?.speed) this.ctx.phys.setSpeed(layout.sim.speed);

    const lookup = new Map();
    for (const item of layout.objects ?? []) {
      const entity = this.spawnItem(item);
      if (entity && item.id) lookup.set(item.id, entity);
    }
    const restored = this.ctx.constraints.restore(layout.constraints ?? [], (id) => lookup.get(id));
    this.customPlatforms = (layout.platforms ?? []).map((p) => ({ ...p }));
    if (layout.camera && Number.isFinite(layout.camera.x)) this.ctx.camera.focusOn(layout.camera);
    this.initialSnapshot = this.snapshot();
    this.emitCounts();
    if (!silent) {
      this.ctx.toast('success', 'Scene loaded', `${layout.objects?.length ?? 0} objects · ${restored} connections.`);
    }
    return { objects: layout.objects?.length ?? 0, constraints: restored };
  }

  captureDesign() {
    this.designSnapshot = this.snapshot();
    return this.designSnapshot;
  }

  restoreDesign() {
    if (!this.designSnapshot) return false;
    const design = this.designSnapshot;
    this.applyLayout(design);
    this.designSnapshot = null;
    return true;
  }

  /** Build Mode: test the layout with physics on, then go back to editing. */
  setBuildTesting(testing) {
    this.buildTesting = Boolean(testing);
    if (this.buildTesting) {
      this.captureDesign();
      this.ctx.phys.resume();
    } else {
      this.restoreDesign();
      this.ctx.phys.pause();
    }
    bus.emit(EVENTS.BUILD_MODE_CHANGED, { testing: this.buildTesting });
    return this.buildTesting;
  }

  /* ---------------------------------------------------------------- gravity */

  setGravityEnabled(enabled) {
    this.gravityEnabled = Boolean(enabled);
    const preset = this.gravityPreset();
    this.ctx.phys.setGravityEnabled(this.gravityEnabled, { x: preset.x, y: preset.y, scale: preset.scale });
    bus.emit(EVENTS.GRAVITY_CHANGED, { enabled: this.gravityEnabled, presetId: this.gravityPresetId });
  }

  toggleGravity() {
    this.setGravityEnabled(!this.gravityEnabled);
  }

  gravityPreset(id = this.gravityPresetId) {
    return GRAVITY_PRESETS.find((p) => p.id === id) ?? GRAVITY_PRESETS.find((p) => p.id === 'normal') ?? GRAVITY_PRESETS[3];
  }

  setGravityPreset(id) {
    const preset = GRAVITY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.gravityPresetId = preset.id;
    this.gravityEnabled = preset.scale > 0;
    this.ctx.phys.setGravity({ x: preset.x, y: preset.y, scale: preset.scale });
    this.stats?.addGravityPreset(preset.id);
    this.ctx.toast('info', `Gravity: ${preset.name}`, this.gravityEnabled ? '' : 'Objects now float freely.');
    bus.emit(EVENTS.GRAVITY_CHANGED, { enabled: this.gravityEnabled, presetId: preset.id, preset });
  }

  applyGravityConfig(config) {
    const gravity = sanitizeGravity(config ?? this.ctx.phys.getGravity());
    this.ctx.phys.setGravity(gravity);
    this.gravityEnabled = gravity.scale > 0;
  }

  /**
   * Matter 0.20 has no per-body gravity scale, so participating bodies get a
   * counter-force. Only bodies that opted out are touched (cheap).
   */
  applyPerBodyGravity() {
    const bodies = this.ctx.phys.allBodies();
    const g = this.ctx.phys.getGravityAcceleration();
    if (!g.x && !g.y) return;
    const DELTA_TIME_SQ = 277.77;
    for (const body of bodies) {
      if (body.gravityScale === undefined || body.gravityScale === 1) continue;
      if (body.isStatic || body.isSleeping) continue;
      const k = (1 - body.gravityScale) * body.mass * DELTA_TIME_SQ;
      body.force.x -= g.x * k;
      body.force.y -= g.y * k;
    }
  }

  /* ---------------------------------------------------------------- update */

  get isPaused() {
    return this.ctx.phys.paused;
  }

  get bodyCount() {
    return this.ctx.phys.bodyCount();
  }

  emitCounts() {
    bus.emit(EVENTS.ENTITY_COUNT, {
      count: this.ctx.phys.bodyCount(),
      entities: this.ctx.phys.entities.size,
      debris: this.ctx.destruction.count,
    });
  }

  /** Called every render frame by the scene. */
  update(dt, input) {
    this.ctx.input = input;
    const steps = this.ctx.phys.update(dt * 1000);
    this.ctx.effects.update(dt);
    this.ctx.camera?.update(dt, input);
    this.challenge?.update(dt, steps);
    this.arena?.update(dt, steps);
    this.stats?.tick?.(dt);
    bus.emit(EVENTS.FRAME_STATS, { steps, simTime: this.ctx.phys.simTime, bodyCount: this.bodyCount });
  }

  destroy() {
    this.challenge?.destroy?.();
    this.arena?.destroy?.();
    this.ctx.unregisterFields?.();
    this.ctx.unregisterGravity?.();
    this.ctx.character?.destroy?.();
    this.ctx.phys.destroy();
  }
}

export { WORLD };
