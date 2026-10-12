/**
 * Ragdoll — an articulated stickman made of Matter bodies + constraints.
 *
 * Pure physics: every pose comes from constraints and forces, never from
 * keyframes. Per fixed step the ragdoll runs four passes:
 *
 *  1. joint safety — a joint may never separate more than `MAX_JOINT_GAP`;
 *  2. joint limits — soft angular springs (Matter has no angular limits);
 *  3. control — gravity compensation + pose spring + balance, walking, jumping
 *     (only while this ragdoll is the active character);
 *  4. stability clamps — speed/angular-velocity caps and NaN recovery.
 *
 * The stance is deliberately "muscular": gravity is cancelled for grounded,
 * calm characters and a force-capped pose spring pulls every limb to its place.
 * That is what lets a 15-body ragdoll stand up, while still being thrown by
 * explosions (the spring is capped and only runs when grounded and calm).
 */

import { PhysicsObject } from './PhysicsObject.js';
import { PART_LAYOUT, JOINT_LAYOUT, boundsOf, buildRagdollBodies } from '../physics/RagdollFactory.js';
import { RAGDOLL_PRESETS, MATERIALS } from '../config/gameConfig.js';
import { angleDelta, clamp, lerp } from '../utils/mathUtils.js';
import { accelToForce, dvToForce } from '../physics/BodyShapes.js';

/** A joint may never visually separate more than this (px). */
export const MAX_JOINT_GAP = 9;
const POSE_BY_NAME = new Map(PART_LAYOUT.map((p) => [p.name, p]));
const STANCE_JOINTS = ['spine', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR'];

export class Ragdoll extends PhysicsObject {
  constructor({ M, id, def, presetId = 'lightweight', cosmetic = {}, scale = 1, x = 0, y = 0, level = false }) {
    const built = buildRagdollBodies(M, { x, y, presetId, scale });
    super({
      id,
      def,
      bodies: built.parts.map((p) => p.body),
      props: { scale, preset: presetId },
      constraints: built.constraints,
      level,
    });
    this.kind = 'ragdoll';
    this.tag = 'ragdoll';
    this.M = M;
    this.presetId = presetId;
    this.preset = built.preset ?? RAGDOLL_PRESETS[presetId] ?? RAGDOLL_PRESETS.lightweight;
    this.scale = scale;
    this.parts = built.parts;
    this.joints = built.joints;
    this.byName = new Map(built.parts.map((p) => [p.name, p.body]));
    this.group = built.group;
    this.boundsOfParts = () => boundsOf(this.parts.map((p) => p.body));

    this.cosmetic = {
      skin: cosmetic.skin ?? '#1d2333',
      shirt: cosmetic.shirt ?? '#e0364a',
      pants: cosmetic.pants ?? '#3b5bdb',
      accessory: cosmetic.accessory ?? 'none',
      face: cosmetic.face ?? 'auto',
    };
    this.expression = 'neutral';
    this.expressionTimer = 0;
    this.control = { active: false, left: false, right: false, jump: false };
    this.grounded = false;
    this.groundTimer = 0;
    this.stepPhase = 0;
    this.jumpCooldown = 0;
    this.launchOrigin = { x, y };
    this.launched = false;
    this.launchReported = false;
    this.maxSpeed = 0;
    this.lastImpact = 0;
    this.damage = 0;
    for (const part of this.parts) {
      part.body.ragdollId = this.id;
      part.body.partName = part.name;
    }
  }

  /* --------------------------------------------------------------- helpers */

  get chest() {
    return this.byName.get('chest');
  }

  get pelvis() {
    return this.byName.get('pelvis');
  }

  get head() {
    return this.byName.get('head');
  }

  partBody(name) {
    return this.byName.get(name) ?? null;
  }

  center() {
    return this.chest.position;
  }

  bounds() {
    return this.boundsOfParts();
  }

  /** Speed of the fastest part (px/step). */
  speed() {
    const chest = this.chest;
    const body = chest?.velocity;
    return body ? Math.hypot(body.x, body.y) : 0;
  }

  /** Horizontal distance travelled from the original launch point. */
  launchDistance() {
    return Math.abs(this.chest.position.x - this.launchOrigin.x);
  }

  setControlInput(input) {
    if (!input) return;
    this.control = { ...this.control, ...input, active: true };
  }

  clearControl() {
    this.control = { active: false, left: false, right: false, jump: false };
  }

  setCosmetic(patch) {
    this.cosmetic = { ...this.cosmetic, ...patch };
  }

  /* --------------------------------------------------------- per-step work */

  /** Called once per fixed physics step by CharacterManager. */
  step(dt) {
    this.enforceJointGaps();
    this.applyJointLimits();
    if (this.control.active) this.applyControl(dt);
    this.clampDynamics();
    this.updateExpression(dt);
    const speed = this.speed();
    if (speed > this.maxSpeed) this.maxSpeed = speed;
    if (speed > 6 && !this.launched) {
      this.launched = true;
      this.launchOrigin = { x: this.chest.position.x, y: this.chest.position.y };
    }
  }

  /** Hard guarantee that limbs never visually detach. */
  enforceJointGaps() {
    const M = this.M;
    for (const joint of this.joints) {
      const { constraint } = joint;
      if (!constraint?.bodyA || !constraint?.bodyB) continue;
      const a = constraint.bodyA;
      const b = constraint.bodyB;
      const pa = M.Constraint.pointAWorld(constraint);
      const pb = M.Constraint.pointBWorld(constraint);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= MAX_JOINT_GAP) continue;
      const excess = dist - MAX_JOINT_GAP;
      const nx = dx / dist;
      const ny = dy / dist;
      const totalMass = (a.mass || 1) + (b.mass || 1);
      const shareA = (b.mass || 1) / totalMass;
      const shareB = (a.mass || 1) / totalMass;
      M.Body.translate(a, { x: nx * excess * shareA, y: ny * excess * shareA });
      M.Body.translate(b, { x: -nx * excess * shareB, y: -ny * excess * shareB });
      const relVx = b.velocity.x - a.velocity.x;
      const relVy = b.velocity.y - a.velocity.y;
      const along = relVx * nx + relVy * ny;
      if (along > 0) {
        M.Body.setVelocity(a, {
          x: a.velocity.x + nx * along * 0.5 * shareA,
          y: a.velocity.y + ny * along * 0.5 * shareA,
        });
        M.Body.setVelocity(b, {
          x: b.velocity.x - nx * along * 0.5 * shareB,
          y: b.velocity.y - ny * along * 0.5 * shareB,
        });
      }
    }
  }

  /** Soft angular limits — blends the relative angular velocity. */
  applyJointLimits() {
    for (const joint of this.joints) {
      if (!joint.limits) continue;
      const a = this.byName.get(joint.a);
      const b = this.byName.get(joint.b);
      if (!a || !b) continue;
      const rel = angleDelta(a.angle, b.angle) - joint.restRel;
      let excess = 0;
      if (rel > joint.limits.max) excess = rel - joint.limits.max;
      else if (rel < joint.limits.min) excess = rel - joint.limits.min;
      if (excess === 0) continue;
      const relV = b.angularVelocity - a.angularVelocity;
      this.blendJoint(a, b, clamp(-excess * 4 - relV * 0.6, -0.5, 0.5), 0.5);
    }
  }

  /** Blend the relative angular velocity of two limbs toward a target. */
  blendJoint(a, b, targetRelAV, blend = 0.3) {
    const M = this.M;
    const relV = b.angularVelocity - a.angularVelocity;
    const delta = clamp(targetRelAV - relV, -0.6, 0.6) * blend;
    const inertiaA = a.inertia || 1;
    const inertiaB = b.inertia || 1;
    const total = inertiaA + inertiaB;
    const shareA = inertiaB / total;
    const shareB = inertiaA / total;
    M.Body.setAngularVelocity(a, a.angularVelocity - delta * shareA);
    M.Body.setAngularVelocity(b, b.angularVelocity + delta * shareB);
  }

  /** Balance, walking and jumping for the active character. */
  applyControl(dt) {
    const M = this.M;
    const chest = this.chest;
    const pelvis = this.pelvis;
    const { left, right, jump } = this.control;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const targetSpeed = dir * this.preset.speed;

    this.grounded = (this.groundTimer ?? 0) > 0;
    if (this.groundTimer > 0) this.groundTimer -= dt;

    // Torso balance (always on: without it a standing character topples).
    const angleErr = angleDelta(0, chest.angle);
    const avTarget = clamp(-angleErr * 0.9 - chest.angularVelocity * 0.5, -0.14, 0.14);
    M.Body.setAngularVelocity(chest, lerp(chest.angularVelocity, avTarget, 0.4));

    const calm = Math.hypot(chest.velocity.x, chest.velocity.y) < 9;
    const pelvisPose = POSE_BY_NAME.get('pelvis');
    const footPose = POSE_BY_NAME.get('footL');
    const standHeight = (footPose.y - pelvisPose.y) * this.scale;

    if (this.grounded && calm) {
      const g = this.gravityAccel ?? { x: 0, y: 0.278 };
      for (const part of this.parts) {
        const body = part.body;
        const layout = part.layout;
        // 1. cancel gravity — this is the character's leg "muscles"
        M.Body.applyForce(body, body.position, { x: 0, y: accelToForce(body, -g.y) });
        if (!layout) continue;
        // 2. pull the limb toward its place in the standing pose
        const targetX = pelvis.position.x + layout.x * this.scale;
        const targetY = pelvis.position.y + (layout.y - pelvisPose.y) * this.scale;
        M.Body.applyForce(body, body.position, {
          x: accelToForce(body, clamp((targetX - body.position.x) * 0.1, -0.9, 0.9)),
          y: accelToForce(body, clamp((targetY - body.position.y) * 0.1, -0.9, 0.9)),
        });
        // 3. steer each limb's rotation back to upright (bounded rate)
        M.Body.setAngularVelocity(body, lerp(body.angularVelocity, clamp(angleDelta(body.angle, 0) * 0.3, -0.16, 0.16), 0.3));
      }

      // 4. hold the relative joint angles at the standing pose
      for (const name of STANCE_JOINTS) {
        const joint = this.joints.find((j) => j.name === name);
        if (!joint) continue;
        const a = this.byName.get(joint.a);
        const b = this.byName.get(joint.b);
        if (!a || !b) continue;
        const rel = angleDelta(a.angle, b.angle) - joint.restRel;
        const relV = b.angularVelocity - a.angularVelocity;
        this.blendJoint(a, b, clamp(-rel * 2 - relV * 0.35, -0.35, 0.35), 0.5);
      }

      // 5. keep the pelvis at standing height above the feet
      const feetY = (this.byName.get('footL').position.y + this.byName.get('footR').position.y) / 2;
      const heightError = feetY - standHeight - pelvis.position.y;
      if (Math.abs(heightError) > 1) {
        const lift = clamp(-heightError * 0.02, -0.18, 0.3);
        M.Body.applyForce(pelvis, pelvis.position, { x: 0, y: accelToForce(pelvis, -lift) });
        M.Body.applyForce(chest, chest.position, { x: 0, y: accelToForce(chest, -lift * 0.5) });
      }
      for (const part of this.parts) {
        const b = part.body;
        if (Math.abs(b.velocity.y) > 0.01) {
          M.Body.setVelocity(b, { x: b.velocity.x, y: lerp(b.velocity.y, 0, 0.08) });
        }
      }
    }

    // --- walking -----------------------------------------------------------
    if (dir !== 0) {
      const dv = targetSpeed - chest.velocity.x;
      const accel = clamp(dv * 0.22, -0.5, 0.5);
      for (const part of this.parts) {
        const share = part.name === 'chest' ? 1 : part.name === 'pelvis' ? 0.8 : 0.55;
        M.Body.applyForce(part.body, part.body.position, { x: accelToForce(part.body, accel * share), y: 0 });
      }
      if (this.grounded && calm) {
        this.stepPhase += dt * 7;
        const swing = Math.sin(this.stepPhase);
        const legL = this.byName.get('thighL');
        const legR = this.byName.get('thighR');
        if (legL) M.Body.setAngularVelocity(legL, lerp(legL.angularVelocity, swing * 0.06, 0.2));
        if (legR) M.Body.setAngularVelocity(legR, lerp(legR.angularVelocity, -swing * 0.06, 0.2));
      }
    } else {
      this.stepPhase = 0;
    }

    if (jump && this.grounded && !(this.jumpCooldown > 0)) {
      const jumpSpeed = clamp(this.preset.jumpSpeed ?? 11, 6, 20);
      for (const part of this.parts) {
        M.Body.setVelocity(part.body, { x: part.body.velocity.x * 0.7, y: -jumpSpeed });
      }
      this.grounded = false;
      this.jumpCooldown = 0.25;
      this.ctx?.sfx?.prop?.('jump', 0.4);
    }
    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
  }

  /** Safety clamps so no correction can fling a ragdoll at absurd speeds. */
  clampDynamics() {
    const M = this.M;
    for (let i = 0; i < this.parts.length; i += 1) {
      const part = this.parts[i];
      const b = part.body;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      if (speed > 26) {
        const k = 26 / speed;
        M.Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k });
      }
      if (Math.abs(b.angularVelocity) > 0.35) {
        M.Body.setAngularVelocity(b, clamp(b.angularVelocity, -0.35, 0.35));
      }
      if (
        !Number.isFinite(b.position.x) ||
        !Number.isFinite(b.position.y) ||
        !Number.isFinite(b.angle) ||
        !Number.isFinite(b.angularVelocity)
      ) {
        const spot = this.initialParts[i] ?? { x: this.initial.x, y: this.initial.y - 200, angle: 0 };
        M.Body.setPosition(b, { x: spot.x, y: spot.y }, false);
        M.Body.setAngle(b, spot.angle ?? 0, false);
        M.Body.setVelocity(b, { x: 0, y: 0 });
        M.Body.setAngularVelocity(b, 0);
      }
    }
  }

  /** Expression reacts to speed, damage and recent impacts (auto mode). */
  updateExpression(dt) {
    if (this.damage > 0 && this.expressionTimer <= 0) {
      this.expression = 'dizzy';
      this.expressionTimer = 0.8;
      this.damage -= 1;
      return;
    }
    if (this.cosmetic.face !== 'auto') {
      this.expression = this.cosmetic.face;
      return;
    }
    this.expressionTimer -= dt;
    if (this.expressionTimer > 0) return;
    const speed = this.speed();
    if (speed > 11) {
      this.expression = 'scared';
      this.expressionTimer = 0.4;
    } else if (speed > 6) {
      this.expression = 'surprised';
      this.expressionTimer = 0.4;
    } else if (speed > 1.4) {
      this.expression = 'happy';
      this.expressionTimer = 0.5;
    } else {
      this.expression = 'neutral';
      this.expressionTimer = 0.5;
    }
  }

  /* --------------------------------------------------------------- effects */

  /**
   * Radial impulse from an explosion. Gravity accelerates a body by ~0.28
   * px/step², so a blast Δv of 4-9 px/step throws a ragdoll convincingly
   * without launching it into orbit. Heavier characters move less.
   */
  applyBlast(origin, radius, magnitude, damage = 0) {
    const M = this.M;
    const maxDeltaV = Math.min(14, magnitude * 90);
    for (const part of this.parts) {
      const body = part.body;
      const dx = body.position.x - origin.x;
      const dy = body.position.y - origin.y;
      const dist = Math.max(12, Math.hypot(dx, dy));
      if (dist > radius) continue;
      const falloff = Math.max(0, 1 - dist / radius);
      const deltaV = maxDeltaV * falloff * falloff ** 0.35;
      const mass = clamp(Math.pow(0.35 / Math.max(0.05, body.mass), 0.5), 0.35, 2.6);
      M.Body.applyForce(body, body.position, {
        x: dvToForce(body, (dx / dist) * deltaV * mass),
        y: dvToForce(body, (dy / dist) * deltaV * mass),
      });
    }
    if (damage) this.damage += damage;
  }

  /** Direct launch (cannons, launchers, the launcher challenge). */
  launch(vx, vy) {
    for (const part of this.parts) {
      this.M.Body.setVelocity(part.body, { x: vx, y: vy });
    }
    this.launched = true;
    this.launchOrigin = { x: this.chest.position.x, y: this.chest.position.y };
  }

  /** Freeze the character in place (build-mode ghosts, death poses). */
  setKinematicLocked(locked) {
    const M = this.M;
    for (const part of this.parts) {
      M.Body.setStatic(part.body, Boolean(locked));
    }
  }

  /* -------------------------------------------------------- serialisation */

  serializeParts() {
    return this.parts.map((part) => ({
      name: part.name,
      x: part.body.position.x,
      y: part.body.position.y,
      angle: part.body.angle,
    }));
  }

  restoreParts(list) {
    if (!Array.isArray(list)) return;
    const M = this.M;
    for (const entry of list) {
      const body = this.byName.get(entry?.name);
      if (!body) continue;
      M.Body.setPosition(body, { x: Number(entry.x) || body.position.x, y: Number(entry.y) || body.position.y }, true);
      M.Body.setAngle(body, Number(entry.angle) || 0, true);
      M.Body.setVelocity(body, { x: 0, y: 0 });
      M.Body.setAngularVelocity(body, 0);
    }
    this.initialParts = this.parts.map((p) => ({
      x: p.body.position.x,
      y: p.body.position.y,
      angle: p.body.angle,
    }));
  }

  serialize() {
    const data = super.serialize();
    data.cos = { ...this.cosmetic };
    data.preset = this.presetId;
    this.initial = {
      x: this.chest.position.x,
      y: this.chest.position.y,
      angle: 0,
    };
    data.initial = { ...this.initial };
    return data;
  }

  /** Material key used by sound + particles. */
  get materialKey() {
    return MATERIALS.cloth ? 'cloth' : 'soft';
  }
}

export { PART_LAYOUT, JOINT_LAYOUT };
