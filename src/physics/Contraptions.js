/**
 * Contraptions — multi-part objects (springs, pulleys, ropes, cannons…).
 *
 * Each builder returns `{ bodies, constraints, parts, state }` where `state`
 * carries behaviour bookkeeping used by `FieldBehaviors`. Builders only need
 * Matter, so they are unit-testable in Node.
 */

import { bodyOptions, setKinematic } from './BodyShapes.js';
import { CATEGORY } from './RagdollFactory.js';
import { MATERIALS } from '../config/gameConfig.js';
import { num, clampToWorld } from '../utils/validation.js';
import { uid } from '../utils/ids.js';

const matOptions = (def, props, kind = 'metal') => bodyOptions(def, { material: kind, ...props }, {});

/** Helper: a Matter pin between two bodies. */
function pin(M, bodyA, bodyB, { pointA = { x: 0, y: 0 }, pointB = { x: 0, y: 0 }, length = 0, stiffness = 0.9, damping = 0.2, record = true } = {}) {
  const constraint = M.Constraint.create({
    bodyA,
    bodyB,
    pointA,
    pointB,
    length,
    stiffness,
    damping,
    render: { visible: false },
  });
  constraint.isJoint = record;
  return constraint;
}

/* ------------------------------------------------------------------ spring */

export function buildSpring(M, def, { x, y, props = {}, scale = 1 }) {
  const size = def.size;
  const baseH = 14 * scale;
  const topH = 14 * scale;
  const restLength = num(props.length, size.h - baseH * 2, 16, 400) * scale;
  const base = M.Bodies.rectangle(x, y + (restLength + baseH) / 2, size.w * scale, baseH, {
    ...matOptions(def, props),
    isStatic: true,
  });
  const top = M.Bodies.rectangle(x, y - (restLength + topH) / 2, size.w * scale, topH, {
    ...matOptions(def, props, 'rubber'),
    density: MATERIALS.rubber.density * 0.5,
  });
  const spring = pin(M, base, top, {
    pointA: { x: 0, y: 0 },
    pointB: { x: 0, y: 0 },
    length: restLength,
    stiffness: num(props.stiffness, 0.35, 0.05, 1),
    damping: num(props.damping, 0.05, 0, 1),
    record: false,
  });
  spring.isSpring = true;
  base.label = `${def.id}_base`;
  top.label = `${def.id}_pad`;
  return {
    bodies: [base, top],
    constraints: [spring],
    parts: [{ name: 'base', body: base }, { name: 'pad', body: top }],
    state: { spring: { base, top, constraint: spring, restLength, width: size.w * scale } },
  };
}

/* ---------------------------------------------------------------- pendulum */

export function buildPendulum(M, def, { x, y, props = {}, scale = 1 }) {
  const rodLength = 150 * scale;
  const anchor = M.Bodies.circle(x, y - rodLength, 9 * scale, {
    ...matOptions(def, props),
    isStatic: true,
  });
  const rod = M.Bodies.rectangle(x, y - rodLength / 2, 10 * scale, rodLength, matOptions(def, props));
  const bob = M.Bodies.circle(x, y, 26 * scale, {
    ...matOptions(def, props, 'heavy'),
    density: MATERIALS.heavy.density * 0.6,
  });
  const joints = [
    pin(M, anchor, rod, { pointA: { x: 0, y: 0 }, pointB: { x: 0, y: -rodLength / 2 }, stiffness: 1, damping: 0.3 }),
    pin(M, rod, bob, { pointA: { x: 0, y: rodLength / 2 }, pointB: { x: 0, y: 0 }, stiffness: 1, damping: 0.3 }),
  ];
  return {
    bodies: [anchor, rod, bob],
    constraints: joints,
    parts: [{ name: 'anchor', body: anchor }, { name: 'rod', body: rod }, { name: 'bob', body: bob }],
    state: { pendulum: { anchor, rod, bob, joints } },
  };
}

/* ------------------------------------------------------- seesaw / lever */

export function buildSeesaw(M, def, { x, y, props = {}, scale = 1 }) {
  const w = num(props.width, def.size.w, 80, 900) * scale;
  const thickness = def.size.h * scale;
  const fulcrum = M.Bodies.circle(x, y + thickness + 12 * scale, 13 * scale, {
    ...matOptions(def, props),
    isStatic: true,
  });
  const plank = M.Bodies.rectangle(x, y, w, thickness, {
    ...matOptions(def, props, 'wood'),
    density: MATERIALS.wood.density * 0.8,
  });
  const pivot = pin(M, fulcrum, plank, {
    pointA: { x: 0, y: 0 },
    pointB: { x: 0, y: 0 },
    length: thickness + 12 * scale,
    stiffness: num(props.stiffness, 0.9, 0.3, 1),
    damping: 0.25,
  });
  pivot.isPivot = true;
  return {
    bodies: [fulcrum, plank],
    constraints: [pivot],
    parts: [{ name: 'fulcrum', body: fulcrum }, { name: 'plank', body: plank }],
    state: { seesaw: { fulcrum, plank, pivot, width: w } },
  };
}

/* ----------------------------------------------------------------- piston */

export function buildPiston(M, def, { x, y, props = {}, scale = 1 }) {
  const bodyH = def.size.h * scale;
  const cylinder = M.Bodies.rectangle(x, y + bodyH * 0.28, def.size.w * scale, bodyH * 0.7, {
    ...matOptions(def, props),
    isStatic: true,
  });
  const rod = M.Bodies.rectangle(x, y - 14 * scale, 22 * scale, bodyH * 0.62, {
    ...matOptions(def, props),
    isStatic: true,
  });
  const head = M.Bodies.rectangle(x, y - bodyH * 0.52, 46 * scale, 18 * scale, {
    ...matOptions(def, props, 'heavy'),
    isStatic: true,
  });
  const travel = num(props.length, 90, 10, 260) * scale;
  return {
    bodies: [cylinder, rod, head],
    constraints: [],
    parts: [{ name: 'cylinder', body: cylinder }, { name: 'rod', body: rod }, { name: 'head', body: head }],
    state: {
      piston: {
        cylinder,
        rod,
        head,
        base: { x, y },
        travel,
        travelConfig: travel,
        speed: num(props.speed, 1.1, 0.1, 3),
        phase: 0,
      },
    },
  };
}

/* ----------------------------------------------------------------- pulley */

export function buildPulley(M, def, { x, y, props = {}, scale = 1 }) {
  const length = num(props.length, 220, 60, 700) * scale;
  const wheel = M.Bodies.circle(x, y, 22 * scale, { ...matOptions(def, props), isStatic: true });
  const cradleSize = { w: 74 * scale, h: 12 * scale };
  const cradleA = M.Bodies.rectangle(x - 46 * scale, y + length, cradleSize.w, cradleSize.h, {
    ...matOptions(def, props, 'wood'),
    density: MATERIALS.wood.density * 0.5,
  });
  const cradleB = M.Bodies.rectangle(x + 46 * scale, y + length, cradleSize.w, cradleSize.h, {
    ...matOptions(def, props, 'wood'),
    density: MATERIALS.wood.density * 0.5,
  });
  return {
    bodies: [wheel, cradleA, cradleB],
    constraints: [],
    parts: [
      { name: 'wheel', body: wheel },
      { name: 'cradleA', body: cradleA },
      { name: 'cradleB', body: cradleB },
    ],
    state: {
      pulley: {
        anchor: { x, y },
        bodyA: cradleA,
        bodyB: cradleB,
        total: length * 2,
        stiffness: 0.5,
        offsetA: -46 * scale,
        offsetB: 46 * scale,
      },
    },
  };
}

/* ------------------------------------------------------------ rope/chain */

export function buildRope(M, def, { x, y, props = {}, scale = 1, kind = 'rope' }) {
  const total = num(props.length, 260, 40, 900) * scale;
  const segments = Math.max(3, Math.min(26, Math.round(num(props.segments, 10, 3, 26))));
  const segLength = total / segments;
  const anchor = M.Bodies.circle(x, y, 7, { ...matOptions(def, props), isStatic: true, isSensor: true });
  anchor.collisionFilter.mask = 0;
  const links = [];
  const constraints = [];
  const isChain = kind === 'chain';
  for (let i = 0; i < segments; i += 1) {
    const ly = y + segLength * (i + 0.5);
    const size = Math.max(6, segLength * 0.55);
    const link = isChain
      ? M.Bodies.rectangle(x, ly, size * 0.6, segLength * 0.9, {
          ...matOptions(def, props, 'metal'),
          density: MATERIALS.metal.density * 0.35,
        })
      : M.Bodies.rectangle(x, ly, size * 0.7, segLength * 0.9, {
          ...matOptions(def, props, 'cloth'),
          density: MATERIALS.cloth.density * 1.6,
        });
    link.ropeIndex = i;
    links.push(link);
    constraints.push(
      pin(M, i === 0 ? anchor : links[i - 1], link, {
        pointA: i === 0 ? { x: 0, y: 0 } : { x: 0, y: segLength / 2 },
        pointB: { x: 0, y: -segLength / 2 },
        length: 0,
        stiffness: isChain ? 0.95 : 0.8,
        damping: isChain ? 0.25 : 0.12,
        record: false,
      })
    );
  }
  return {
    bodies: [anchor, ...links],
    constraints,
    parts: [{ name: 'anchor', body: anchor }, ...links.map((b, i) => ({ name: `link${i}`, body: b }))],
    state: { rope: { anchor, links, constraints, kind, segLength } },
    // The last link is the "grabbable" end for the joint tool.
    handle: links[links.length - 1],
  };
}

/* ------------------------------------------------------------------ hinge */

export function buildHinge(M, def, { x, y, props = {}, scale = 1 }) {
  const w = def.size.w * scale;
  const anchor = M.Bodies.circle(x - w / 2, y, 8 * scale, {
    ...matOptions(def, props),
    isStatic: true,
    isSensor: true,
  });
  anchor.collisionFilter.mask = 0;
  const door = M.Bodies.rectangle(x, y + 60 * scale, w, def.size.h * 2.4 * scale, matOptions(def, props, 'wood'));
  const hinge = pin(M, anchor, door, {
    pointA: { x: 0, y: 0 },
    pointB: { x: -w / 2, y: -60 * scale },
    length: 0,
    stiffness: num(props.stiffness, 0.95, 0.4, 1),
    damping: 0.15,
  });
  hinge.isPivot = true;
  return {
    bodies: [anchor, door],
    constraints: [hinge],
    parts: [{ name: 'anchor', body: anchor }, { name: 'door', body: door }],
    state: { hinge: { anchor, door, constraint: hinge } },
  };
}

/* ----------------------------------------------------------------- cannon */

export function buildCannon(M, def, { x, y, props = {}, scale = 1 }) {
  const base = M.Bodies.rectangle(x, y + 22 * scale, def.size.w * scale, 30 * scale, {
    ...matOptions(def, props),
    isStatic: true,
  });
  const barrelLength = num(props.length, 92, 40, 170) * scale;
  const angle = ((num(props.angle, -20, -180, 180)) * Math.PI) / 180;
  const barrel = M.Bodies.rectangle(
    x + Math.cos(angle) * (barrelLength / 2),
    y + Math.sin(angle) * (barrelLength / 2) - 6 * scale,
    30 * scale,
    barrelLength,
    { ...matOptions(def, props), isStatic: true }
  );
  M.Body.setAngle(barrel, angle + Math.PI / 2);
  return {
    bodies: [base, barrel],
    constraints: [],
    parts: [{ name: 'base', body: base }, { name: 'barrel', body: barrel }],
    state: {
      cannon: {
        base,
        barrel,
        angle,
        barrelLength,
        scale,
        power: num(props.power, 24, 2, 40),
        // World-space muzzle position at the barrel tip (used by fireCannon).
        muzzle: {
          x: x + Math.cos(angle) * barrelLength,
          y: y + Math.sin(angle) * barrelLength - 6 * scale,
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ stack */

/** Crate tower: returns 5 independent crates (the spawner spawns each one). */
export function buildStackPositions({ x, y, scale = 1 }) {
  const size = 62 * scale;
  const positions = [];
  for (let i = 0; i < 3; i += 1) positions.push({ x: x + (i - 1) * (size + 2), y: y - size / 2 });
  for (let i = 0; i < 2; i += 1) positions.push({ x: x + (i - 0.5) * (size + 2), y: y - size * 1.5 });
  return positions;
}

export const CONTRAPTION_BUILDERS = {
  spring: buildSpring,
  pendulum: buildPendulum,
  seesaw: buildSeesaw,
  lever: buildSeesaw,
  piston: buildPiston,
  pulley: buildPulley,
  rope: (M, def, opts) => buildRope(M, def, { ...opts, kind: 'rope' }),
  chain: (M, def, opts) => buildRope(M, def, { ...opts, kind: 'chain' }),
  hinge: buildHinge,
  cannon: buildCannon,
};

export { pin, setKinematic, uid, clampToWorld };
