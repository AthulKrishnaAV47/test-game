/**
 * CharacterManager — owns the ragdolls.
 *
 * Every ragdoll runs its corrective passes once per *fixed physics step* (joint
 * safety, joint limits, control, stability clamps), which is why this class
 * registers a step handler instead of doing the work in the render loop.
 *
 * The character studio cosmetics are stored in settings so a player's colours
 * apply to every ragdoll they spawn.
 */

import { bus, EVENTS } from '../utils/events.js';
import { RAGDOLL_PRESETS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';

const DEFAULT_COSMETIC = {
  skin: '#1d2333',
  shirt: '#e0364a',
  pants: '#3b5bdb',
  accessory: 'none',
  face: 'auto',
};

export class CharacterManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.M = ctx.M;
    /** @type {Set<object>} */
    this.ragdolls = new Set();
    this.active = null;
    this.controlEnabled = true;
    this.defaultCosmetic = { ...DEFAULT_COSMETIC, ...(ctx.settings?.get('cosmetics') ?? {}) };
    this.input = { left: false, right: false, jump: false };
    this.stepHandler = ctx.phys.addStepHandler((dt) => this.step(dt));
    this.jumpEdge = false;
  }

  /* ------------------------------------------------------------ lifecycle */

  register(ragdoll, { makeActive = true } = {}) {
    if (!ragdoll) return;
    this.ragdolls.add(ragdoll);
    if (makeActive || !this.active || this.active.removed) this.setActive(ragdoll);
    else ragdoll.clearControl();
    bus.emit(EVENTS.CHARACTER_LIST_CHANGED, { ragdolls: this.list(), active: this.active });
  }

  unregister(entity) {
    if (!entity) return;
    this.ragdolls.delete(entity);
    if (this.active === entity) {
      this.active = this.pickNext(entity);
      if (this.active) this.applyInput();
      bus.emit(EVENTS.CHARACTER_ACTIVE, { entity: this.active });
    }
  }

  pickNext(exclude = null) {
    for (const ragdoll of this.ragdolls) {
      if (ragdoll !== exclude && !ragdoll.removed) return ragdoll;
    }
    return null;
  }

  list() {
    return [...this.ragdolls].filter((r) => !r.removed);
  }

  count() {
    return this.list().length;
  }

  setActive(entity) {
    if (!entity || entity.removed) return null;
    for (const ragdoll of this.ragdolls) {
      if (ragdoll !== entity) ragdoll.clearControl();
    }
    this.active = entity;
    this.applyInput();
    bus.emit(EVENTS.CHARACTER_ACTIVE, { entity });
    return entity;
  }

  cycleActive() {
    const list = this.list();
    if (!list.length) return null;
    const index = list.indexOf(this.active);
    return this.setActive(list[(index + 1) % list.length]);
  }

  clear() {
    this.ragdolls.clear();
    this.active = null;
  }

  /* --------------------------------------------------------------- control */

  /** Called once per frame with the current keyboard state. */
  setInput({ left = false, right = false, jump = false } = {}) {
    this.jumpEdge = Boolean(jump) && !this.input.jump;
    this.input = { left: Boolean(left), right: Boolean(right), jump: Boolean(jump) };
    this.applyInput();
  }

  applyInput() {
    if (!this.controlEnabled) {
      for (const ragdoll of this.ragdolls) ragdoll.clearControl();
      return;
    }
    for (const ragdoll of this.ragdolls) {
      if (ragdoll === this.active && !ragdoll.removed) ragdoll.setControlInput(this.input);
      else ragdoll.clearControl();
    }
  }

  setControlEnabled(enabled) {
    this.controlEnabled = Boolean(enabled);
    this.applyInput();
  }

  /** Per fixed step: corrective passes for every character. */
  step(dt) {
    const gravityAccel = this.ctx.phys.getGravityAcceleration();
    for (const ragdoll of [...this.ragdolls]) {
      if (ragdoll.removed) {
        this.ragdolls.delete(ragdoll);
        continue;
      }
      ragdoll.gravityAccel = gravityAccel;
      try {
        ragdoll.step(dt);
      } catch (err) {
        console.error('[CharacterManager] ragdoll step failed', err);
      }
    }
    // Character launched tracking for challenges/achievements.
    for (const ragdoll of this.ragdolls) {
      if (ragdoll.removed || !ragdoll.launched) continue;
      const distance = ragdoll.launchDistance();
      if (distance > 260 && !ragdoll.launchReported) {
        ragdoll.launchReported = true;
        this.ctx.stats?.bump('ragdollsLaunched', 1);
        bus.emit(EVENTS.RAGDOLL_LAUNCHED, { entity: ragdoll, distance });
      }
    }
  }

  /* ------------------------------------------------------------- cosmetics */

  setCosmetic(patch, { applyToAll = false } = {}) {
    this.defaultCosmetic = { ...this.defaultCosmetic, ...patch };
    this.ctx.settings?.set('cosmetics', this.defaultCosmetic, { silent: true });
    const targets = applyToAll ? this.list() : [this.active].filter(Boolean);
    for (const ragdoll of targets) ragdoll.setCosmetic(patch);
    bus.emit(EVENTS.COSMETIC_CHANGED, { cosmetic: this.defaultCosmetic, entity: this.active });
  }

  applyCosmeticToAll() {
    for (const ragdoll of this.list()) ragdoll.setCosmetic(this.defaultCosmetic);
  }

  presetList() {
    return Object.values(RAGDOLL_PRESETS).map((preset) => ({
      ...preset,
      count: this.list().filter((r) => r.presetId === preset.id).length,
    }));
  }

  /** Rebuild the active ragdoll with a different preset (studio preview). */
  setPreset(presetId) {
    const ragdoll = this.active;
    if (!ragdoll || !RAGDOLL_PRESETS[presetId]) return null;
    const { x, y } = ragdoll.chest.position;
    const cosmetic = { ...ragdoll.cosmetic };
    this.ctx.spawner.remove(ragdoll, { silent: true, reason: 'preset-swap' });
    return this.ctx.spawner.spawnRagdoll(presetId, x, Math.max(120, y - 40), { cosmetic, silent: true });
  }

  launchAll(origin = null, radius = 900, magnitude = 0.18) {
    for (const ragdoll of this.list()) {
      if (origin) ragdoll.applyBlast(origin, radius, magnitude);
      else this.ctx.forces?.impulse(ragdoll, { x: 0, y: -8 });
    }
  }

  get activeSpeed() {
    return this.active && !this.active.removed ? clamp(this.active.speed(), 0, 99) : 0;
  }

  destroy() {
    this.stepHandler?.();
    this.stepHandler = null;
    this.clear();
  }
}
