/**
 * SelectionSystem — what is currently selected, plus the marquee state.
 *
 * Selection is the single source of truth for the inspector, keyboard
 * character control, deletion, duplication and constraint creation, so it is
 * kept deliberately dumb: a set of entities and change events.
 */

import { bus, EVENTS } from '../utils/events.js';

export class SelectionSystem {
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Set<object>} */
    this.items = new Set();
    this.hover = null;
    this.marquee = null;
    this.locked = false; // true while a modal/dialog is open
  }

  get size() {
    return this.items.size;
  }

  get primary() {
    return this.first();
  }

  first() {
    return this.items.values().next().value ?? null;
  }

  list() {
    return [...this.items];
  }

  has(entity) {
    return this.items.has(entity);
  }

  isSelected(entity) {
    return this.items.has(entity);
  }

  /** Replace (or extend) the selection. */
  select(entity, { additive = false } = {}) {
    if (!entity || entity.removed) return;
    if (!additive) this.items.clear();
    this.items.add(entity);
    this.markChanged({ added: entity });
  }

  selectMany(entities, { additive = false } = {}) {
    if (!additive) this.items.clear();
    let added = 0;
    for (const entity of entities) {
      if (!entity || entity.removed) continue;
      if (!this.items.has(entity)) {
        this.items.add(entity);
        added += 1;
      }
    }
    if (added || !additive) this.markChanged();
  }

  toggle(entity) {
    if (!entity) return;
    if (this.items.has(entity)) this.items.delete(entity);
    else this.items.add(entity);
    this.markChanged();
  }

  deselect(entity) {
    if (this.items.delete(entity)) this.markChanged();
  }

  clear({ silent = false } = {}) {
    if (!this.items.size) return;
    this.items.clear();
    if (!silent) this.markChanged();
  }

  setHover(entity) {
    if (this.hover === entity) return;
    this.hover = entity ?? null;
    bus.emit(EVENTS.HOVER_CHANGED, { entity: this.hover });
  }

  /** Hit test in world space (used by every pointer tool). */
  pickAt(point, options = {}) {
    return this.ctx.phys.entityAtPoint(point, options) ?? null;
  }

  /** Everything inside a world rectangle (marquee selection). */
  pickInRect(rect) {
    return this.ctx.phys.entitiesInRect(rect);
  }

  /** Delete every selected entity (level scenery is protected). */
  deleteSelected() {
    const list = this.list();
    let removed = 0;
    for (const entity of list) {
      if (entity.level) {
        this.ctx.toast?.('info', 'Protected object', 'Level scenery cannot be deleted.');
        continue;
      }
      if (this.ctx.spawner.remove(entity, { reason: 'deleted' })) removed += 1;
    }
    if (removed) this.clear({ silent: true });
    return removed;
  }

  serializeSelection() {
    return this.list().map((e) => e.id);
  }

  markChanged(meta = {}) {
    for (const entity of this.items) entity.selected = true;
    bus.emit(EVENTS.SELECTION_CHANGED, { entities: this.list(), ...meta });
  }
}
