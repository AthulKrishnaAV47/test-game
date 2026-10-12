/**
 * SaveManager — scene serialisation, named layouts, JSON import/export.
 *
 * Saves live in localStorage as a small index plus the layouts themselves.
 * Everything that arrives from a file is validated before a single body is
 * created; nothing is ever evaluated as code.
 */

import { LIMITS, SCHEMA_VERSION, STORAGE_KEYS, WORLD, CAMERA } from '../config/gameConfig.js';
import { storage } from '../core/storage.js';
import { OBJECT_DEFS, OBJECT_IDS } from '../config/objectCatalog.js';
import { validateLayout, validateImportText, sanitizeText, sanitizeId } from '../utils/validation.js';
import { LIMITS as LIMIT_CONSTANTS } from '../config/gameConfig.js';

export class SaveManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.store = ctx.store ?? storage;
  }

  /* ------------------------------------------------------------ serialise */

  /** Capture the current scene as a layout document. */
  serializeScene({ name = 'Untitled layout', kind = 'sandbox' } = {}) {
    const entities = [...this.ctx.phys.entities].filter((e) => !e.removed);
    const objects = entities.map((entity) => this.serializeEntity(entity));
    const constraints = (this.ctx.constraints?.serialize() ?? []).filter((c) => c.bodyB || c.anchor);

    return {
      version: SCHEMA_VERSION,
      kind,
      levelId: this.ctx.levelId,
      name: sanitizeText(name, 40, 'Untitled layout'),
      gravity: this.ctx.phys.getGravity(),
      sim: {
        speed: this.ctx.phys.speed,
        gravityEnabled: this.ctx.gravityEnabled !== false,
      },
      camera: {
        x: this.ctx.camera?.camera?.midPoint?.x ?? WORLD.width / 2,
        y: this.ctx.camera?.camera?.midPoint?.y ?? WORLD.height / 2,
        zoom: this.ctx.camera?.camera?.zoom ?? CAMERA.defaultZoom,
      },
      objects,
      constraints,
      platforms: this.ctx.customPlatforms ?? [],
      meta: {
        savedAt: Date.now(),
        appVersion: '1.0.0',
      },
    };
  }

  serializeEntity(entity) {
    const data = entity.serialize();
    data.level = Boolean(entity.level);
    return data;
  }

  /* -------------------------------------------------------------- storage */

  readIndex() {
    const raw = this.store.readJSON(STORAGE_KEYS.layouts, null);
    if (!raw || typeof raw !== 'object') return { layouts: {} };
    const layouts = {};
    if (raw.layouts && typeof raw.layouts === 'object') {
      for (const [key, value] of Object.entries(raw.layouts)) {
        if (typeof key !== 'string' || key.length > 60) continue;
        if (!value || typeof value !== 'object') continue;
        layouts[key] = {
          name: sanitizeText(value.name, 40, key),
          savedAt: Number(value.savedAt) || 0,
          levelId: sanitizeId(value.levelId, 'laboratory'),
          kind: value.kind === 'build' ? 'build' : 'sandbox',
          objectCount: Math.max(0, Math.min(9999, Number(value.objectCount) || 0)),
          data: value.data && typeof value.data === 'object' ? value.data : null,
        };
      }
    }
    return { layouts };
  }

  list() {
    const { layouts } = this.readIndex();
    return Object.entries(layouts)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  has(id) {
    const { layouts } = this.readIndex();
    return Boolean(layouts[id]);
  }

  /** Save (or overwrite) a named layout. */
  save(name, { id = null, kind = 'sandbox', confirmOverwrite = false } = {}) {
    const cleanName = sanitizeText(name, 40, 'Untitled layout');
    const layoutId = id ?? this.slug(cleanName);
    const { layouts } = this.readIndex();
    if (layouts[layoutId] && !confirmOverwrite && id === null) {
      return { ok: false, needsConfirm: true, id: layoutId };
    }
    if (Object.keys(layouts).length >= LIMITS.MAX_SAVED_LAYOUTS && !layouts[layoutId]) {
      return { ok: false, error: `Save limit reached (${LIMITS.MAX_SAVED_LAYOUTS}). Delete a layout first.` };
    }
    const data = this.serializeScene({ name: cleanName, kind });
    const result = this.store.writeJSON(STORAGE_KEYS.layouts, {
      layouts: {
        ...layouts,
        [layoutId]: {
          name: cleanName,
          savedAt: Date.now(),
          levelId: data.levelId,
          kind,
          objectCount: data.objects.length,
          data,
        },
      },
    });
    if (!result) return { ok: false, error: 'Could not write to local storage (quota or blocked).' };
    this.ctx.stats?.bump('layoutsSaved', 1);
    this.ctx.toast?.('success', 'Layout saved', `“${cleanName}” · ${data.objects.length} objects`);
    return { ok: true, id: layoutId, layout: data };
  }

  load(id) {
    const { layouts } = this.readIndex();
    const entry = layouts[id];
    if (!entry?.data) return { ok: false, error: 'Saved layout not found.' };
    const result = validateLayout(entry.data, {
      knownTypes: OBJECT_IDS,
      maxObjects: LIMITS.MAX_SAVED_OBJECTS,
      maxConstraints: LIMITS.MAX_SAVED_CONSTRAINTS,
    });
    if (!result.ok) return { ok: false, error: result.errors.join(' ') };
    return { ok: true, layout: result.layout, warnings: result.warnings, name: entry.name };
  }

  remove(id) {
    const { layouts } = this.readIndex();
    if (!layouts[id]) return false;
    delete layouts[id];
    return this.store.writeJSON(STORAGE_KEYS.layouts, { layouts });
  }

  rename(id, name) {
    const { layouts } = this.readIndex();
    if (!layouts[id]) return false;
    layouts[id].name = sanitizeText(name, 40, layouts[id].name);
    return this.store.writeJSON(STORAGE_KEYS.layouts, { layouts });
  }

  slug(name) {
    const base = sanitizeText(name, 40, 'layout')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    return `${base || 'layout'}-${Date.now().toString(36).slice(-4)}`;
  }

  /* ------------------------------------------------------- import/export */

  exportJSON(name = 'sticklab-layout') {
    const data = this.serializeScene({ name });
    const text = JSON.stringify(data, null, 2);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeText(name, 30, 'sticklab-layout').replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.ctx.toast?.('success', 'Layout exported', `${data.objects.length} objects written to file.`);
      return { ok: true, text };
    } catch (err) {
      console.error('[export] failed', err);
      this.ctx.toast?.('error', 'Export failed', err.message);
      return { ok: false, error: err.message };
    }
  }

  /** Validate + apply an imported JSON document. */
  importText(text, { apply = true } = {}) {
    const result = validateImportText(text, {
      knownTypes: OBJECT_IDS,
      maxObjects: LIMITS.MAX_SAVED_OBJECTS,
      maxConstraints: LIMITS.MAX_SAVED_CONSTRAINTS,
    });
    if (!result.ok) {
      this.ctx.toast?.('error', 'Import rejected', result.errors.join(' '));
      return { ok: false, error: result.errors.join(' ') };
    }
    if (result.warnings?.length) {
      this.ctx.toast?.('warn', 'Imported with warnings', result.warnings.slice(0, 2).join(' '));
    }
    const stats = apply ? this.ctx.world?.applyLayout(result.layout) : { objects: result.layout.objects.length };
    this.ctx.toast?.('success', 'Layout imported', `${stats?.objects ?? 0} objects restored.`);
    return { ok: true, layout: result.layout, warnings: result.warnings };
  }

  createLibrarySnapshot() {
    return OBJECT_DEFS ? Object.keys(OBJECT_DEFS).length : 0;
  }
}

export { LIMIT_CONSTANTS };
