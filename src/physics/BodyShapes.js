/**
 * BodyShapes — turn catalogue definitions into Matter bodies.
 *
 * All Matter access funnels through here so the spawner never has to know about
 * rectangles vs circles vs polygons, and so tests can build bodies in Node.
 */

import { CATEGORY } from './RagdollFactory.js';
import { MATERIALS } from '../config/gameConfig.js';
import { num } from '../utils/validation.js';

/**
 * Matter integrates forces as `velocity += (force / mass) * deltaTime²`, and the
 * engine is fed deltas in milliseconds, so `deltaTime² ≈ 277.8` for a 60 Hz step.
 * Working in velocities (px per step) and accelerations (px per step²) keeps the
 * rest of the codebase readable — these helpers do the conversion.
 */
export const DELTA_TIME_SQ = (1000 / 60) ** 2;

/** Force needed on `body` to add `deltaV` (px/step) of velocity this step. */
export const dvToForce = (body, deltaV) => (deltaV * (body?.mass || 1)) / DELTA_TIME_SQ;

/** Force needed on `body` for a per-step acceleration of `accel` (px/step²). */
export const accelToForce = (body, accel) => (accel * (body?.mass || 1)) / DELTA_TIME_SQ;

/** Apply a velocity impulse (px/step) directly. */
export function applyImpulse(M, body, deltaV) {
  if (!body || body.isStatic) return;
  M.Body.applyForce(body, body.position, { x: dvToForce(body, deltaV.x), y: dvToForce(body, deltaV.y) });
}

/** Apply a continuous per-step acceleration (px/step²). */
export function applyAcceleration(M, body, accel) {
  if (!body || body.isStatic) return;
  M.Body.applyForce(body, body.position, { x: accelToForce(body, accel.x), y: accelToForce(body, accel.y) });
}

/** Default physics tuning applied to every world body. */
export const BASE_OPTIONS = {
  frictionAir: 0.011,
  slop: 0.04,
  sleepThreshold: 70,
};

export function bodyOptions(def, props = {}, { isStatic = false, isSensor = false } = {}) {
  const material = MATERIALS[props.material ?? def?.material] ?? MATERIALS.wood;
  return {
    ...BASE_OPTIONS,
    isStatic,
    isSensor,
    density: num(props.density, material.density, 0.0001, 0.05),
    friction: num(props.friction, material.friction, 0, 1.5),
    frictionStatic: num(props.frictionStatic, material.frictionStatic, 0, 2),
    restitution: num(props.restitution, material.restitution, 0, 1),
    label: def?.id ?? 'body',
    collisionFilter: isSensor
      ? // Sensors are geometric only: they never generate collisions.
        { category: CATEGORY.sensor, mask: 0, group: 0 }
      : {
          category: isStatic ? CATEGORY.static : CATEGORY.object,
          mask: 0xffffffff,
          group: 0,
        },
  };
}

/** Current size of a definition (allowing per-instance overrides). */
export function defSize(def, props = {}) {
  const base = def?.size ?? { w: 40, h: 40 };
  if (def?.shape === 'circle') {
    const r = num(props.radius, base.r ?? 20, 6, 400);
    return { r, w: r * 2, h: r * 2 };
  }
  if (def?.shape === 'poly') {
    const s = num(props.scale, 1, 0.2, 6);
    return { points: base.points.map(([x, y]) => [x * s, y * s]) };
  }
  return {
    w: num(props.width, base.w ?? 40, 6, 1800),
    h: num(props.height, base.h ?? 40, 6, 1800),
  };
}

/**
 * Build the body (or bodies) for a simple definition.
 * @returns {{bodies: Array, size: object}}
 */
export function buildSimpleBodies(M, def, { x = 0, y = 0, angle = 0, props = {}, scale = 1, isStatic = false } = {}) {
  const staticFlag = Boolean(props.static ?? isStatic);
  const options = bodyOptions(def, props, { isStatic: staticFlag, isSensor: Boolean(def?.sensor) });
  const size = defSize(def, props);
  const bodies = [];

  if (def.shape === 'circle') {
    const r = size.r * scale;
    bodies.push(M.Bodies.circle(x, y, r, options, Math.max(12, Math.round(r / 3))));
  } else if (def.shape === 'poly') {
    const points = size.points.map(([px, py]) => ({ x: px * scale, y: py * scale }));
    let body = null;
    try {
      body = M.Bodies.fromVertices(x, y, [points], options, true);
    } catch (err) {
      console.warn('[BodyShapes] polygon build failed, falling back to rectangle', err);
      body = null;
    }
    bodies.push(body || M.Bodies.rectangle(x, y, 120 * scale, 90 * scale, options));
  } else if (def.shape === 'none') {
    // Pure logical entity (ragdolls are built elsewhere).
    return { bodies: [], size };
  } else {
    const w = size.w * scale;
    const h = size.h * scale;
    const round = Math.min(8, Math.min(w, h) * 0.18);
    const body = M.Bodies.rectangle(x, y, w, h, { ...options, ...(round > 2 ? { chamfer: { radius: round } } : {}) });
    bodies.push(body);
  }

  for (const b of bodies) {
    // See RagdollFactory: avoids NaN the first frame before the engine steps.
    b.deltaTime = 1000 / 60;
    b.timeScale = 1;
    // Drawing metadata: the renderer needs the *built* size, which cannot be
    // recovered from rotated bounds later on.
    b.drawShape = def.shape;
    b.drawRound = def.shape === 'rect' ? Math.min(10, Math.min(size.w ?? 40, size.h ?? 40) * 0.18) : 0;
    if (def.shape === 'circle') b.drawR = (size.r ?? 20) * scale;
    else if (def.shape === 'poly') b.drawPoints = (size.points ?? []).map(([px, py]) => ({ x: px * scale, y: py * scale }));
    else {
      b.drawW = (size.w ?? 40) * scale;
      b.drawH = (size.h ?? 40) * scale;
    }
    b.drawDefId = def.id;
  }
  const body = bodies[0];
  if (body) {
    body.materialKey = props.material ?? def.material;
    if (angle) M.Body.setAngle(body, angle);
    if (def?.static) body.isStatic = true;
  }
  return { bodies, size };
}

/** Resize a body in place (used by the inspector with immediate effect). */
export function resizeBody(M, body, scaleX, scaleY) {
  if (!body || !M.Body.scale) return false;
  const sx = num(scaleX, 1, 0.15, 8);
  const sy = num(scaleY, 1, 0.15, 8);
  M.Body.scale(body, sx, sy);
  return true;
}

/**
 * Kinematic helper for conveyor / moving platform / piston parts.
 *
 * `Body.setPosition(pos, updateVelocity=true)` writes both the position and the
 * derived velocity (`position - positionPrev`) that Matter's solver uses for
 * friction and restitution, so kinematic bodies genuinely push dynamic ones.
 */
export function setKinematic(M, body, position, angle = null) {
  if (!body) return;
  M.Body.setPosition(body, position, true);
  if (angle !== null && Number.isFinite(angle)) M.Body.setAngle(body, angle, true);
}

export { CATEGORY };
