/**
 * RagdollFactory — builds the articulated stickman.
 *
 * The figure is a set of rigid bodies connected by real Matter constraints:
 *
 *        head
 *         |  neck
 *      upper torso
 *      /   |   \
 *  shoulder |  shoulder
 *   upper arms    (elbows) forearms (wrists) hands
 *         pelvis  (hips) thighs (knees) shins (ankles) feet
 *
 * Because this module only talks to Matter it can be unit-tested in Node:
 * `physics.test.js` and `ragdoll.test.js` build ragdolls with `matter-js` and
 * verify joints stay connected, limits engage and joints never explode.
 */

import { RAGDOLL_PRESETS, MATERIALS } from '../config/gameConfig.js';

/** Collision categories (bitmask). */
export const CATEGORY = {
  static: 0x0001,
  object: 0x0002,
  ragdoll: 0x0004,
  sensor: 0x0008,
};

/**
 * Body layout in local figure space. Origin (0,0) is the chest centre while the
 * figure stands upright; +y points down, so a standing character is ~140 px tall.
 */
export const PART_LAYOUT = [
  { name: 'chest', shape: 'rect', w: 28, h: 34, x: 0, y: 0, mass: 1.5, round: 4 },
  { name: 'pelvis', shape: 'rect', w: 24, h: 16, x: 0, y: 25, mass: 1.1, round: 4 },
  { name: 'head', shape: 'circle', r: 13, x: 0, y: -30, mass: 1.0 },
  { name: 'upperArmL', shape: 'rect', w: 9, h: 26, x: -18, y: 3, mass: 0.6, round: 3 },
  { name: 'foreArmL', shape: 'rect', w: 8, h: 24, x: -18, y: 28, mass: 0.45, round: 3 },
  { name: 'handL', shape: 'circle', r: 5, x: -18, y: 43, mass: 0.2 },
  { name: 'upperArmR', shape: 'rect', w: 9, h: 26, x: 18, y: 3, mass: 0.6, round: 3 },
  { name: 'foreArmR', shape: 'rect', w: 8, h: 24, x: 18, y: 28, mass: 0.45, round: 3 },
  { name: 'handR', shape: 'circle', r: 5, x: 18, y: 43, mass: 0.2 },
  { name: 'thighL', shape: 'rect', w: 10, h: 28, x: -8, y: 49, mass: 0.9, round: 3 },
  { name: 'shinL', shape: 'rect', w: 9, h: 26, x: -8, y: 76, mass: 0.7, round: 3 },
  { name: 'footL', shape: 'rect', w: 15, h: 7, x: -10, y: 92, mass: 0.3, round: 2 },
  { name: 'thighR', shape: 'rect', w: 10, h: 28, x: 8, y: 49, mass: 0.9, round: 3 },
  { name: 'shinR', shape: 'rect', w: 9, h: 26, x: 8, y: 76, mass: 0.7, round: 3 },
  { name: 'footR', shape: 'rect', w: 15, h: 7, x: 10, y: 92, mass: 0.3, round: 2 },
];

/**
 * Joints. `limits` are degrees relative to the parent body's rotation,
 * `[min, max]`, and are scaled by the ragdoll preset.
 */
export const JOINT_LAYOUT = [
  // The spine holds the two torso halves together — without it the pelvis and
  // chest are independent assemblies and the figure folds in half.
  { name: 'spine', a: 'chest', b: 'pelvis', pointA: { x: 0, y: 17 }, pointB: { x: 0, y: -8 }, limits: [-38, 38], stiffness: 0.98, damping: 0.4 },
  { name: 'neck', a: 'chest', b: 'head', pointA: { x: 0, y: -17 }, pointB: { x: 0, y: 13 }, limits: [-42, 42], stiffness: 0.95, damping: 0.3 },
  { name: 'shoulderL', a: 'chest', b: 'upperArmL', pointA: { x: -13, y: -12 }, pointB: { x: 0, y: -13 }, limits: [-150, 90], stiffness: 0.85, damping: 0.25 },
  { name: 'elbowL', a: 'upperArmL', b: 'foreArmL', pointA: { x: 0, y: 13 }, pointB: { x: 0, y: -12 }, limits: [-10, 150], stiffness: 0.9, damping: 0.3 },
  { name: 'wristL', a: 'foreArmL', b: 'handL', pointA: { x: 0, y: 12 }, pointB: { x: 0, y: 0 }, limits: [-70, 70], stiffness: 0.8, damping: 0.3 },
  { name: 'shoulderR', a: 'chest', b: 'upperArmR', pointA: { x: 13, y: -12 }, pointB: { x: 0, y: -13 }, limits: [-150, 90], stiffness: 0.85, damping: 0.25 },
  { name: 'elbowR', a: 'upperArmR', b: 'foreArmR', pointA: { x: 0, y: 13 }, pointB: { x: 0, y: -12 }, limits: [-10, 150], stiffness: 0.9, damping: 0.3 },
  { name: 'wristR', a: 'foreArmR', b: 'handR', pointA: { x: 0, y: 12 }, pointB: { x: 0, y: 0 }, limits: [-70, 70], stiffness: 0.8, damping: 0.3 },
  { name: 'hipL', a: 'pelvis', b: 'thighL', pointA: { x: -8, y: 0 }, pointB: { x: 0, y: -14 }, limits: [-95, 55], stiffness: 0.9, damping: 0.3 },
  { name: 'kneeL', a: 'thighL', b: 'shinL', pointA: { x: 0, y: 14 }, pointB: { x: 0, y: -13 }, limits: [-150, 6], stiffness: 0.92, damping: 0.32 },
  { name: 'ankleL', a: 'shinL', b: 'footL', pointA: { x: 0, y: 13 }, pointB: { x: 0, y: -2 }, limits: [-45, 45], stiffness: 0.85, damping: 0.3 },
  { name: 'hipR', a: 'pelvis', b: 'thighR', pointA: { x: 8, y: 0 }, pointB: { x: 0, y: -14 }, limits: [-95, 55], stiffness: 0.9, damping: 0.3 },
  { name: 'kneeR', a: 'thighR', b: 'shinR', pointA: { x: 0, y: 14 }, pointB: { x: 0, y: -13 }, limits: [-150, 6], stiffness: 0.92, damping: 0.32 },
  { name: 'ankleR', a: 'shinR', b: 'footR', pointA: { x: 0, y: 13 }, pointB: { x: 0, y: -2 }, limits: [-45, 45], stiffness: 0.85, damping: 0.3 },
];

let ragdollGroupCounter = 1;

/**
 * Build the ragdoll bodies + constraints.
 *
 * @param {object} M - Matter namespace
 * @param {object} options
 * @returns {{parts: Array, joints: Array, constraints: Array, bounds: object}}
 */
export function buildRagdollBodies(M, {
  x = 0,
  y = 0,
  presetId = 'lightweight',
  scale = 1,
  groupId = null,
} = {}) {
  const preset = RAGDOLL_PRESETS[presetId] ?? RAGDOLL_PRESETS.lightweight;
  const group = groupId ?? -(ragdollGroupCounter++ % 60000 + 1);
  const material = MATERIALS.cloth;
  const parts = [];
  const byName = new Map();

  for (const layout of PART_LAYOUT) {
    const density = material.density * preset.densityScale * layout.mass;
    const common = {
      friction: material.friction,
      frictionStatic: material.frictionStatic,
      frictionAir: 0.012,
      restitution: preset.restitution,
      density,
      collisionFilter: { group, category: CATEGORY.ragdoll, mask: 0xffffffff },
      label: layout.name,
      sleepThreshold: 90,
    };
    let body;
    const bx = x + layout.x * scale;
    const by = y + layout.y * scale;
    if (layout.shape === 'circle') {
      body = M.Bodies.circle(bx, by, layout.r * scale, common, 12);
    } else {
      body = M.Bodies.rectangle(bx, by, layout.w * scale, layout.h * scale, common);
      if (layout.round) {
        // Chamfer keeps rectangles from catching on each other.
        body = M.Bodies.rectangle(bx, by, layout.w * scale, layout.h * scale, {
          ...common,
          chamfer: { radius: layout.round * scale },
        });
      }
    }
    // Body.setVelocity/setAngularVelocity divide by body.deltaTime, which is
    // `undefined` until the engine has stepped the body once. Initialise it so
    // first-frame control code cannot produce NaN.
    body.deltaTime = 1000 / 60;
    body.timeScale = 1;
    body.partName = layout.name;
    body.ragdollGroup = group;
    // Drawing metadata (see BodyShapes.buildSimpleBodies).
    body.drawShape = layout.shape;
    body.drawRound = layout.round ?? 0;
    if (layout.shape === 'circle') body.drawR = layout.r * scale;
    else {
      body.drawW = layout.w * scale;
      body.drawH = layout.h * scale;
    }
    parts.push({ name: layout.name, body, layout, mass: layout.mass });
    byName.set(layout.name, body);
  }

  const constraints = [];
  const joints = [];
  for (const joint of JOINT_LAYOUT) {
    const bodyA = byName.get(joint.a);
    const bodyB = byName.get(joint.b);
    if (!bodyA || !bodyB) continue;
    const stiffness = Math.max(0.35, joint.stiffness * (0.55 + preset.stiffness * 0.55));
    const damping = Math.max(0.05, (joint.damping + preset.damping) * 0.75);
    const constraint = M.Constraint.create({
      bodyA,
      bodyB,
      pointA: { x: joint.pointA.x * scale, y: joint.pointA.y * scale },
      pointB: { x: joint.pointB.x * scale, y: joint.pointB.y * scale },
      length: 0,
      stiffness,
      damping,
      render: { visible: false },
    });
    constraints.push(constraint);
    joints.push({
      name: joint.name,
      a: joint.a,
      b: joint.b,
      constraint,
      stiffness,
      damping,
      // Limits are relative to the parent body, scaled by the preset.
      limits: {
        min: (joint.limits[0] * Math.PI * preset.limitScale) / 180,
        max: (joint.limits[1] * Math.PI * preset.limitScale) / 180,
      },
      restRel: 0,
      coupled: false,
    });
  }

  const bounds = boundsOf(parts.map((p) => p.body));
  return { parts, joints, constraints, bounds, group, preset };
}

/**
 * World-space attachment points of a joint.
 *
 * Matter keeps `constraint.pointA/pointB` rotated into world orientation as it
 * solves (tracking `angleA/angleB`), so the canonical anchor is simply
 * `body.position + constraint.pointX` — which is exactly what
 * `Constraint.pointAWorld()` returns.
 */
export function jointAnchors(M, joint) {
  const { constraint } = joint;
  if (!constraint?.bodyA || !constraint?.bodyB) return null;
  return {
    a: M.Constraint.pointAWorld(constraint),
    b: M.Constraint.pointBWorld(constraint),
    bodyA: constraint.bodyA,
    bodyB: constraint.bodyB,
  };
}

export function boundsOf(bodies) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const body of bodies) {
    minX = Math.min(minX, body.bounds.min.x);
    minY = Math.min(minY, body.bounds.min.y);
    maxX = Math.max(maxX, body.bounds.max.x);
    maxY = Math.max(maxY, body.bounds.max.y);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

/** Distance between the two anchor points of a joint (0 when perfectly joined). */
export function jointSeparation(M, joint) {
  if (!joint?.constraint || typeof M.Constraint.currentLength !== 'function') return 0;
  return M.Constraint.currentLength(joint.constraint);
}
