/**
 * Tiny synchronous event bus used to decouple the simulation from the UI.
 * Systems emit gameplay facts (explosion, object destroyed, ragdoll landed…)
 * and the UI / achievements / challenge systems listen.
 */

export const EVENTS = {
  MODE_CHANGED: 'mode:changed',
  SIM_STATE: 'sim:state',            // { paused, speed, singleStep }
  GRAVITY_CHANGED: 'gravity:changed', // { x, y, scale, enabled }
  OBJECT_SPAWNED: 'object:spawned',   // { entity }
  OBJECT_REMOVED: 'object:removed',   // { entity, reason }
  OBJECT_DESTROYED: 'object:destroyed', // { entity, impact, byExplosion }
  OBJECT_SELECTED: 'object:selected', // { entities }
  OBJECT_CHANGED: 'object:changed',   // { entity, props }
  OBJECT_DUPLICATED: 'object:duplicated', // { source, clone }
  PROJECTILE_FIRED: 'object:projectile',  // { entity, projectile }
  HOVER_CHANGED: 'selection:hover',   // { entity }
  TOOL_CHANGED: 'tool:changed',       // { tool }
  CONSTRAINT_CREATED: 'constraint:created',
  CONSTRAINT_REMOVED: 'constraint:removed',
  EXPLOSION: 'physics:explosion',     // { x, y, radius, force, chain, entityId }
  EXPLOSION_CHAIN: 'physics:explosion-chain', // { length, x, y }
  IMPACT: 'physics:impact',           // { force, x, y, materialA, materialB }
  RAGDOLL_SPAWNED: 'ragdoll:spawned',
  CHARACTER_ACTIVE: 'character:active',       // { entity }
  CHARACTER_LIST_CHANGED: 'character:list',   // { ragdolls, active }
  COSMETIC_CHANGED: 'character:cosmetic',     // { cosmetic, entity }
  RAGDOLL_LAUNCHED: 'ragdoll:launched',
  RAGDOLL_LANDED: 'ragdoll:landed',
  FORCE_APPLIED: 'physics:force',
  HAZARD_TOUCHED: 'physics:hazard',   // { entity, zone }
  TELEPORTED: 'physics:teleport',     // { entity, from, to }
  BOMB_FUSED: 'physics:fuse',         // { entity, remaining }
  CHALLENGE_STARTED: 'challenge:started',
  CHALLENGE_STATUS: 'challenge:status',   // { id, goals, progress, stars… }
  CHALLENGE_GOAL: 'challenge:goal',       // { goal, challenge }
  CHALLENGE_PROGRESS: 'challenge:progress',
  CHALLENGE_COMPLETED: 'challenge:completed',
  CHALLENGE_FAILED: 'challenge:failed',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  TOAST: 'ui:toast',
  ENTITY_COUNT: 'world:entity-count',
  ARENA_SCORE: 'arena:score',
  HISTORY_CHANGED: 'history:changed',  // { canUndo, canRedo, label }
  SAVE_CHANGED: 'save:changed',
  SCENE_READY: 'scene:ready',
  SCENE_RESET: 'scene:reset',         // { mode }
  BUILD_MODE_CHANGED: 'build:mode',
  FRAME_STATS: 'stats:frame',
  SELECTION_CHANGED: 'selection:changed',
};

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(handler);
    if (!set.size) this.listeners.delete(type);
  }

  emit(type, payload) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        // A broken listener must never break the simulation loop.
        console.error(`[EventBus] listener for "${type}" failed:`, err);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}

/** Global bus instance (the game itself is single-scene-at-a-time). */
export const bus = new EventBus();
