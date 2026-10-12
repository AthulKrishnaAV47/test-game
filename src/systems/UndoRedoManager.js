/**
 * UndoRedoManager — bounded command history for editing actions.
 *
 * Two kinds of entries are supported:
 *  - structural: `{ spawn }` / `{ removed }` (spawning, deleting, duplicating)
 *  - functional: `{ apply, revert }` (property changes, moving, constraints)
 *
 * Re-creating an object replays it from serialized data, so undo can never
 * resurrect a stale body reference or duplicate listeners.
 */

import { LIMITS } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';

export class UndoRedoManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.undoStack = [];
    this.redoStack = [];
    this.suspended = false;
    this.maxEntries = LIMITS.MAX_UNDO;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  get lastLabel() {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  /** Push a new action (clears the redo branch, as browsers do). */
  record(label, entry) {
    if (this.suspended || !entry) return null;
    const item = { label, ...entry, at: Date.now() };
    this.undoStack.push(item);
    if (this.undoStack.length > this.maxEntries) this.undoStack.shift();
    this.redoStack.length = 0;
    this.emit();
    return item;
  }

  /** Convenience wrapper for property edits. */
  recordProp(entity, key, before, after, label = null) {
    if (before === after) return null;
    return this.record(label ?? `Change ${key}`, {
      apply: () => this.ctx.spawner.applyProp(entity, key, after),
      revert: () => this.ctx.spawner.applyProp(entity, key, before),
    });
  }

  /** Convenience wrapper for connections (constraints). */
  recordConstraint(record) {
    const snapshot = {
      type: record.type,
      bodyA: record.entityA?.id ?? null,
      bodyB: record.entityB?.id ?? null,
      anchor: record.anchor ? { ...record.anchor } : null,
      length: record.length,
      stiffness: record.stiffness,
      damping: record.damping,
      color: record.color,
    };
    const find = (id) => (id ? [...this.ctx.phys.entities].find((e) => e.id === id) ?? null : null);
    return this.record(`Connect ${record.label ?? record.type}`, {
      apply: () => this.ctx.constraints.create({ ...snapshot, entityA: find(snapshot.bodyA), entityB: find(snapshot.bodyB) }),
      revert: () => {
        const live = this.ctx.constraints.get(record.id);
        if (live) this.ctx.constraints.remove(live);
      },
    });
  }

  /** Record the deletion of an entity (already removed by the caller). */
  recordRemoval(entity, data = null) {
    const snapshot = data ?? entity.serialize();
    return this.record(`Delete ${entity.label}`, { removed: snapshot });
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.suspended = true;
    try {
      if (entry.spawn) {
        if (!entry.spawn.removed) {
          this.ctx.spawner.remove(entry.spawn, { reason: 'undo', silent: true, keepUndo: true });
        }
      } else if (entry.removed) {
        const restored = this.ctx.spawner.spawnFromData(entry.removed, { silent: true });
        entry.restored = restored;
        if (restored) this.ctx.selection?.select(restored);
      } else if (typeof entry.revert === 'function') {
        entry.revert();
      }
    } catch (err) {
      console.error('[undo] failed:', err);
      this.ctx.toast?.('error', 'Undo failed', String(err?.message ?? err));
    } finally {
      this.suspended = false;
    }
    this.redoStack.push(entry);
    this.emit();
    this.ctx.toast?.('info', 'Undo', entry.label);
    bus.emit(EVENTS.SCENE_READY, { mode: this.ctx.mode, reason: 'undo' });
    return true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.suspended = true;
    try {
      if (entry.spawn) {
        const rebuilt = this.ctx.spawner.spawnFromData(entry.spawn.serialize(), { silent: true });
        if (rebuilt) entry.spawn = rebuilt;
      } else if (entry.removed) {
        const target = entry.restored;
        if (target && !target.removed) {
          this.ctx.spawner.remove(target, { reason: 'redo', silent: true, keepUndo: true });
        }
      } else if (typeof entry.apply === 'function') {
        entry.apply();
      }
    } catch (err) {
      console.error('[redo] failed:', err);
      this.ctx.toast?.('error', 'Redo failed', String(err?.message ?? err));
    } finally {
      this.suspended = false;
    }
    this.undoStack.push(entry);
    this.emit();
    this.ctx.toast?.('info', 'Redo', entry.label);
    return true;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit();
  }

  emit() {
    bus.emit(EVENTS.HISTORY_CHANGED, {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      label: this.lastLabel,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    });
  }
}
