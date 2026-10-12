/**
 * Validation & sanitisation helpers.
 *
 * Every value that enters the simulation from user input, localStorage or an
 * imported JSON file passes through this module. Imported data is treated as
 * strictly untrusted: nothing is ever evaluated, and every number is clamped
 * into a range the physics engine can survive.
 */

import { LIMITS, SCHEMA_VERSION, WORLD, MATERIALS, SOUNDS } from '../config/gameConfig.js';

export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Safe JSON parse — never throws, never evaluates. */
export function safeJsonParse(text) {
  if (typeof text !== 'string') return { ok: false, error: 'Not a string' };
  if (text.length === 0) return { ok: false, error: 'Empty input' };
  try {
    const value = JSON.parse(text);
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
}

/** Coerce to a finite number inside [min,max], else fallback. */
export function num(value, fallback = 0, min = -Infinity, max = Infinity) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return n < min ? min : n > max ? max : n;
}

export const int = (value, fallback = 0, min = -Infinity, max = Infinity) => Math.round(num(value, fallback, min, max));
export const bool = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function sanitizeColor(value, fallback = '#cccccc') {
  if (typeof value === 'string' && HEX_COLOR.test(value.trim())) {
    const v = value.trim().toLowerCase();
    // Expand shorthand so renderers can assume 6 digit hex.
    if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    return v;
  }
  return fallback;
}

export function sanitizeText(value, maxLen = 48, fallback = '') {
  if (typeof value !== 'string') return fallback;
  // Strip control characters and limit the length.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.slice(0, maxLen) || fallback;
}

export function sanitizeId(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 64);
  return cleaned || fallback;
}

export const isSound = (v) => SOUNDS.includes(v);

/** Clamp a material key, defaulting to wood. */
export const sanitizeMaterial = (v) => (MATERIALS[v] ? v : 'wood');

/** Clamp a spawn position into the playable world (with margin inside walls). */
export function clampToWorld(x, y, margin = 60) {
  return {
    x: num(x, WORLD.width / 2, margin, WORLD.width - margin),
    y: num(y, WORLD.height / 2, margin, WORLD.height - margin),
  };
}

/**
 * Validate + sanitise a saved layout object.
 *
 * @param {unknown} input - parsed JSON candidate.
 * @param {object} opts
 * @param {Iterable<string>} opts.knownTypes - allowed object definition ids.
 * @param {Iterable<string>} opts.knownConstraintTypes - allowed constraint kinds.
 * @param {number} [opts.maxObjects]
 * @param {number} [opts.maxConstraints]
 * @returns {{ok:boolean, layout?:object, warnings:string[], errors:string[]}}
 */
export function validateLayout(input, opts = {}) {
  const errors = [];
  const warnings = [];
  const knownTypes = new Set(opts.knownTypes ?? []);
  const knownConstraintTypes = new Set(
    opts.knownConstraintTypes ?? ['rope', 'chain', 'spring', 'joint', 'distance', 'pin', 'pulley']
  );
  const maxObjects = Math.min(opts.maxObjects ?? LIMITS.MAX_SAVED_OBJECTS, LIMITS.MAX_SAVED_OBJECTS);
  const maxConstraints = Math.min(opts.maxConstraints ?? LIMITS.MAX_SAVED_CONSTRAINTS, LIMITS.MAX_SAVED_CONSTRAINTS);

  if (!isPlainObject(input)) return { ok: false, errors: ['Layout must be a JSON object.'], warnings };

  const version = num(input.version, 0, 0, 999);
  if (!version) {
    return { ok: false, errors: ['Missing schema version — file was not produced by StickLab.'], warnings };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Layout schema v${version} is newer than this build (v${SCHEMA_VERSION}). Please update.`],
      warnings,
    };
  }

  const rawObjects = Array.isArray(input.objects) ? input.objects : [];
  if (!Array.isArray(input.objects)) warnings.push('No objects array found — loading an empty scene.');
  if (rawObjects.length > maxObjects) {
    warnings.push(`Layout had ${rawObjects.length} objects; only the first ${maxObjects} were loaded.`);
  }

  const objects = [];
  const seenIds = new Set();
  for (const raw of rawObjects.slice(0, maxObjects)) {
    if (!isPlainObject(raw)) {
      warnings.push('Skipped a malformed object entry.');
      continue;
    }
    const type = sanitizeId(raw.type, null);
    if (!type || (knownTypes.size && !knownTypes.has(type))) {
      warnings.push(`Skipped unsupported object type "${String(raw.type).slice(0, 24)}".`);
      continue;
    }
    let id = sanitizeId(raw.id, null);
    if (!id || seenIds.has(id)) id = `obj_${objects.length}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    seenIds.add(id);

    const pos = clampToWorld(raw.x, raw.y, 20);
    const props = sanitizeProps(raw.props);
    objects.push({
      id,
      type,
      x: pos.x,
      y: pos.y,
      angle: num(raw.angle, 0, -Math.PI * 4, Math.PI * 4),
      scale: num(raw.scale, 1, 0.35, 3),
      color: raw.color === undefined ? null : sanitizeColor(raw.color, null),
      props,
      cos: raw.cos && isPlainObject(raw.cos) ? sanitizeCosmetic(raw.cos) : null,
      initial: isPlainObject(raw.initial)
        ? {
            x: num(raw.initial.x, pos.x, 20, WORLD.width - 20),
            y: num(raw.initial.y, pos.y, 20, WORLD.height - 20),
            angle: num(raw.initial.angle, 0, -Math.PI * 4, Math.PI * 4),
          }
        : { x: pos.x, y: pos.y, angle: num(raw.angle, 0, -Math.PI * 4, Math.PI * 4) },
    });
  }

  const rawConstraints = Array.isArray(input.constraints) ? input.constraints : [];
  if (rawConstraints.length > maxConstraints) {
    warnings.push(`Layout had ${rawConstraints.length} connections; only the first ${maxConstraints} were loaded.`);
  }
  const constraints = [];
  const objectIds = new Set(objects.map((o) => o.id));
  for (const raw of rawConstraints.slice(0, maxConstraints)) {
    if (!isPlainObject(raw)) continue;
    const type = sanitizeId(raw.type, 'rope');
    if (knownConstraintTypes.size && !knownConstraintTypes.has(type)) {
      warnings.push(`Skipped unsupported connection type "${String(raw.type).slice(0, 20)}".`);
      continue;
    }
    const bodyA = sanitizeId(raw.bodyA, null);
    const bodyB = sanitizeId(raw.bodyB, null);
    const anchor = isPlainObject(raw.anchor)
      ? clampToWorld(raw.anchor.x, raw.anchor.y, 10)
      : null;
    const hasAnchorA = isPlainObject(raw.pointA) || Boolean(anchor);
    if ((!bodyA || !objectIds.has(bodyA)) && !hasAnchorA) {
      warnings.push('Skipped a connection that referenced a missing object.');
      continue;
    }
    if (bodyA && !objectIds.has(bodyA)) {
      warnings.push('Skipped a connection referencing an unknown body.');
      continue;
    }
    if (bodyB && !objectIds.has(bodyB)) {
      warnings.push('Skipped a connection referencing an unknown body.');
      continue;
    }
    constraints.push({
      type,
      bodyA: bodyA ?? null,
      bodyB: bodyB ?? null,
      anchor: anchor ?? null,
      pointA: isPlainObject(raw.pointA) ? { x: num(raw.pointA.x, 0, -4000, 4000), y: num(raw.pointA.y, 0, -4000, 4000) } : null,
      pointB: isPlainObject(raw.pointB) ? { x: num(raw.pointB.x, 0, -4000, 4000), y: num(raw.pointB.y, 0, -4000, 4000) } : null,
      length: num(raw.length, 100, 4, 4000),
      stiffness: num(raw.stiffness, 0.7, 0.02, 1),
      damping: num(raw.damping, 0.1, 0, 1),
      color: raw.color === undefined ? null : sanitizeColor(raw.color, null),
      label: sanitizeText(raw.label, 32, 'Connection'),
    });
  }

  const layout = {
    version: SCHEMA_VERSION,
    kind: input.kind === 'challenge' || input.kind === 'build' ? input.kind : 'sandbox',
    levelId: sanitizeId(input.levelId, 'laboratory'),
    name: sanitizeText(input.name, 40, 'Untitled layout'),
    gravity: sanitizeGravity(input.gravity),
    sim: sanitizeSim(input.sim),
    camera: {
      x: num(input.camera?.x, WORLD.width / 2, 0, WORLD.width),
      y: num(input.camera?.y, WORLD.height / 2, 0, WORLD.height),
      zoom: num(input.camera?.zoom, 1, LIMITS.SCALE_MIN, LIMITS.SCALE_MAX),
    },
    objects,
    constraints,
    platforms: sanitizeCustomPlatforms(input.platforms),
    meta: {
      savedAt: num(input.meta?.savedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
      appVersion: sanitizeText(input.meta?.appVersion, 16, '1.0.0'),
    },
  };

  return { ok: true, layout, warnings, errors };
}

function sanitizeProps(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  const numeric = [
    ['density', 0.0002, 0.02],
    ['friction', 0, 1.4],
    ['frictionStatic', 0, 2],
    ['restitution', 0, 1],
    ['restitutionBias', 0, 0.6],
    ['angleLimit', 0, Math.PI],
    ['stiffness', 0.02, 1],
    ['damping', 0, 1],
    ['speed', 0, 12],
    ['radius', 10, 900],
    ['strength', 0, 6],
    ['power', 0, 40],
    ['duration', 0.2, 60],
    ['hp', 1, 100000],
    ['maxHp', 1, 100000],
    ['scale', 0.35, 3],
    ['angle', -Math.PI * 4, Math.PI * 4],
    ['width', 10, 1800],
    ['height', 10, 1800],
    ['length', 4, 4000],
    ['mass', 0.01, 400],
  ];
  for (const [key, min, max] of numeric) {
    if (raw[key] !== undefined) out[key] = num(raw[key], 0, min, max);
  }
  if (raw.color !== undefined) out.color = sanitizeColor(raw.color, '#cccccc');
  if (raw.locked !== undefined) out.locked = bool(raw.locked, false);
  if (raw.affectedByGravity !== undefined) out.affectedByGravity = bool(raw.affectedByGravity, true);
  if (raw.static !== undefined) out.static = bool(raw.static, false);
  if (raw.direction !== undefined) out.direction = num(raw.direction, 1, -1, 1);
  if (raw.mode !== undefined) out.mode = sanitizeId(raw.mode, 'attract');
  if (raw.material !== undefined) out.material = sanitizeMaterial(raw.material);
  return out;
}

function sanitizeCosmetic(raw) {
  const out = {};
  if (raw.skin) out.skin = sanitizeColor(raw.skin, '#1d2333');
  if (raw.shirt) out.shirt = sanitizeColor(raw.shirt, '#e0364a');
  if (raw.pants) out.pants = sanitizeColor(raw.pants, '#3b5bdb');
  if (raw.accessory) out.accessory = sanitizeId(raw.accessory, 'none');
  if (raw.preset) out.preset = sanitizeId(raw.preset, 'lightweight');
  if (raw.face) out.face = sanitizeId(raw.face, 'neutral');
  if (raw.expression) out.expression = sanitizeId(raw.expression, 'auto');
  return out;
}

function sanitizeCustomPlatforms(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 120).map((p) => {
    const angle = num(p?.angle, 0, -Math.PI * 4, Math.PI * 4);
    const width = num(p?.width, 120, 16, 1800);
    const height = num(p?.height, 22, 8, 400);
    const pos = clampToWorld(p?.x, p?.y, 10);
    return {
      x: pos.x,
      y: pos.y,
      angle,
      width,
      height,
      color: sanitizeColor(p?.color, '#7bd3ff'),
      material: sanitizeMaterial(p?.material ?? 'stone'),
      static: true,
    };
  });
}

export function sanitizeGravity(raw) {
  if (!isPlainObject(raw)) return { x: 0, y: 1, scale: 1 };
  return {
    x: num(raw.x, 0, -4, 4),
    y: num(raw.y, 1, -4, 4),
    scale: num(raw.scale, 1, 0, 6),
  };
}

export function sanitizeSim(raw) {
  if (!isPlainObject(raw)) return { speed: 1, gravityEnabled: true };
  return {
    speed: num(raw.speed, 1, 0.05, 3),
    gravityEnabled: bool(raw.gravityEnabled, true),
  };
}

/**
 * Validate an imported JSON string (from a file or a textarea).
 * Rejects oversized, malformed and structurally invalid documents.
 */
export function validateImportText(text, opts = {}) {
  const byteLength = new TextEncoder().encode(text ?? '').length;
  if (byteLength > LIMITS.MAX_IMPORT_BYTES) {
    return { ok: false, errors: [`File is too large (${(byteLength / 1024).toFixed(0)} KB). Limit is ${(LIMITS.MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1)} MB.`], warnings: [] };
  }
  const parsed = safeJsonParse(text);
  if (!parsed.ok) return { ok: false, errors: [parsed.error], warnings: [] };
  return validateLayout(parsed.value, opts);
}

/** Guard used before feeding a number into Matter (NaN/inf crash the engine). */
export const assertFiniteVec = (v, fallback = { x: 0, y: 0 }) => {
  if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return { ...fallback };
  return { x: v.x, y: v.y };
};

export const assertFiniteNum = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
