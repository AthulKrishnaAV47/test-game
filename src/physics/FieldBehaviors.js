/**
 * FieldBehaviors — per-step logic for special objects and mechanisms.
 *
 * Registered once per scene through `registerFieldBehaviors(ctx)`; the handler
 * runs immediately before every fixed physics step. Everything here is
 * deterministic and bounded: no behaviour allocates unbounded work per step.
 */

import { setKinematic, accelToForce } from './BodyShapes.js';
import { clamp, lerp } from '../utils/mathUtils.js';
import { num } from '../utils/validation.js';
import { bus, EVENTS } from '../utils/events.js';

/** World rectangle covered by a zone-like entity. */
export function entityZone(entity) {
  const w = num(entity.props.width, entity.def?.size?.w ?? 120, 10, 2400);
  const h = num(entity.props.height, entity.def?.size?.h ?? 120, 10, 2400);
  return { x: entity.position.x, y: entity.position.y, w, h, angle: entity.angle };
}

export function pointInZone(point, zone, margin = 0) {
  const dx = point.x - zone.x;
  const dy = point.y - zone.y;
  const cos = Math.cos(-zone.angle ?? 0);
  const sin = Math.sin(-zone.angle ?? 0);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= zone.w / 2 + margin && Math.abs(ly) <= zone.h / 2 + margin;
}

export function registerFieldBehaviors(ctx) {
  const { phys, M, forces, destruction, effects, sfx, stats } = ctx;
  /** teleporter links resolved lazily by id */
  const off = phys.addStepHandler((dt, simTime) => {
    const entities = [...phys.entities];
    const teleporters = [];
    for (const entity of entities) {
      if (entity.removed) continue;
      switch (entity.behavior) {
        case 'gravityWell':
        case 'magnet':
          forces.radialField(entity, entity.position, {
            mode: entity.props.mode ?? 'attract',
            strength: num(entity.props.strength, 0.9, 0, 3),
            dt,
          });
          break;
        case 'wind':
          forces.windField(entity, dt);
          break;
        case 'conveyor':
          runConveyor(entity, dt);
          break;
        case 'rotate':
          setKinematic(M, entity.body, entity.body.position, entity.body.angle + num(entity.props.speed, 1.2, -4, 4) * dt);
          break;
        case 'oscillate':
          runOscillate(entity, dt, simTime);
          break;
        case 'piston':
          runPiston(entity, dt, simTime);
          break;
        case 'motor':
          entity.getBodies().forEach((b) => {
            if (b.isStatic) return;
            phys.wake(b);
            M.Body.setAngularVelocity(b, num(entity.props.speed, 7, -14, 14));
          });
          break;
        case 'pulley':
          runPulley(entity, dt);
          break;
        case 'buoyancy':
          runBuoyancy(entity, dt);
          break;
        case 'fuseBomb':
          runFuse(entity, dt);
          break;
        case 'freeze':
        case 'slowmo':
        case 'hazard':
        case 'teleporter':
          teleporters.push(entity);
          break;
        default:
          break;
      }
    }

    // Zone effects share one pass over bodies to keep the step cost low.
    if (teleporters.length) runZones(teleporters, dt);
  });

  /* ------------------------------------------------------------- helpers */

  function runConveyor(entity, dt) {
    const belt = entity.bounds?.() ?? entityZone(entity);
    const speed = num(entity.props.speed, 4, 0.2, 12);
    const dir = num(entity.props.direction, 1, -1, 1);
    const cos = Math.cos(entity.angle);
    const sin = Math.sin(entity.angle);
    const halfW = belt.w / 2;
    const halfH = belt.h / 2;
    for (const body of phys.allBodies()) {
      if (body.isStatic || body.isSensor) continue;
      if (phys.getEntity(body) === entity) continue;
      const dx = body.position.x - entity.position.x;
      const dy = body.position.y - entity.position.y;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      if (Math.abs(lx) > halfW || ly < -halfH || ly > halfH + 46) continue;
      // Only push bodies that are actually resting on top of the belt.
      const touching = ly < halfH + 8;
      if (!touching) continue;
      phys.wake(body);
      const accel = Math.min(0.3, speed * 0.03); // px/step² along the belt
      M.Body.applyForce(body, body.position, {
        x: accelToForce(body, cos * dir * accel),
        y: accelToForce(body, sin * dir * accel),
      });
    }
  }

  function runOscillate(entity, dt, simTime) {
    if (entity.state.origin === undefined) {
      entity.state.origin = { x: entity.position.x, y: entity.position.y };
      entity.state.phase = entity.props.phase ?? 0;
    }
    const distance = num(entity.props.distance, 260, 20, 1200);
    const speed = num(entity.props.speed, 1, 0.05, 4);
    const rad = (num(entity.props.angle, 0, -180, 180) * Math.PI) / 180;
    const offset = Math.sin(simTime * speed + entity.state.phase) * (distance / 2);
    const target = {
      x: entity.state.origin.x + Math.cos(rad) * offset,
      y: entity.state.origin.y + Math.sin(rad) * offset,
    };
    setKinematic(M, entity.body, target, entity.body.angle);
  }

  function runPiston(entity, dt, simTime) {
    const piston = entity.state.piston;
    if (!piston) return;
    const travel = num(entity.props.length, 90, 10, 260);
    const speed = num(entity.props.speed, 1.1, 0.1, 3);
    piston.travel = travel;
    const offset = (Math.sin(simTime * speed * Math.PI) * 0.5 + 0.5) * travel;
    const baseY = piston.base.y;
    setKinematic(M, piston.head, { x: piston.base.x, y: baseY - 34 - offset }, 0);
    setKinematic(M, piston.rod, { x: piston.base.x, y: baseY - offset * 0.5 }, 0);
  }

  /**
   * Pulley: a soft "total rope length is constant" constraint. Gravity makes the
   * heavier side sink and lifts the lighter one — real pulley behaviour without
   * a dedicated solver.
   */
  function runPulley(entity, dt) {
    const pulley = entity.state.pulley;
    if (!pulley) return;
    const { anchor, bodyA, bodyB } = pulley;
    const total = num(entity.props.length, 220, 60, 700) * 2;
    pulley.total = total;
    const parts = [
      { body: bodyA, offsetX: pulley.offsetA },
      { body: bodyB, offsetX: pulley.offsetB },
    ];
    const measurements = parts.map(({ body }) => Math.hypot(body.position.x - anchor.x, body.position.y - anchor.y));
    const sum = measurements[0] + measurements[1];
    const error = sum - total;
    if (Math.abs(error) < 0.4) return;
    const stiffness = 0.16;
    parts.forEach(({ body }, index) => {
      const dist = Math.max(8, measurements[index]);
      const dx = (body.position.x - anchor.x) / dist;
      const dy = (body.position.y - anchor.y) / dist;
      // Pull toward the anchor when the rope is stretched (error > 0),
      // push away when it is slack, so both sides always share the length.
      // `tension` is a per-step acceleration toward the wheel (px/step²).
      const tension = clamp(error * stiffness * 0.02, -0.35, 0.35);
      phys.wake(body);
      M.Body.applyForce(body, body.position, {
        x: accelToForce(body, -dx * tension),
        y: accelToForce(body, -dy * tension),
      });
    });
  }

  function runBuoyancy(entity, dt) {
    const strength = num(entity.props.strength, 0.3, 0, 0.8);
    for (const body of entity.getBodies()) {
      if (body.isStatic) continue;
      M.Body.applyForce(body, body.position, { x: 0, y: accelToForce(body, -strength * 0.9) });
    }
    // Slow horizontal drift for a floaty feel.
    entity.getBodies().forEach((b) => {
      if (!b.isStatic) M.Body.setAngularVelocity(b, b.angularVelocity * 0.96);
    });
  }

  function runFuse(entity, dt) {
    if (entity.state.exploded) return;
    if (entity.state.fuseTimer === undefined) entity.state.fuseTimer = num(entity.props.fuse, 2.5, 0.2, 12);
    entity.state.fuseTimer -= dt;
    bus.emit(EVENTS.BOMB_FUSED, { entity, remaining: Math.max(0, entity.state.fuseTimer) });
    if (entity.state.fuseTimer <= 0) {
      forces.explodeEntity(entity, { chain: 1 });
    }
  }

  function runZones(zones, dt) {
    const bodies = phys.allBodies();
    const links = zones.filter((z) => z.behavior === 'teleporter');
    for (const entity of zones) {
      if (entity.removed) continue;
      const zone = entityZone(entity);
      for (const body of bodies) {
        if (body.isStatic || body.isSensor) continue;
        const owner = phys.getEntity(body);
        if (!owner || owner === entity || owner.removed) continue;
        if (!pointInZone(body.position, zone)) continue;

        if (entity.behavior === 'freeze') {
          const strength = num(entity.props.duration, 1, 0.1, 8);
          M.Body.setVelocity(body, {
            x: lerp(body.velocity.x, 0, clamp(strength * dt * 6, 0, 1)),
            y: lerp(body.velocity.y, 0, clamp(strength * dt * 6, 0, 1)),
          });
          M.Body.setAngularVelocity(body, body.angularVelocity * (1 - clamp(strength * dt * 4, 0, 1)));
        } else if (entity.behavior === 'slowmo') {
          const factor = num(entity.props.strength, 0.25, 0.05, 0.95);
          const blend = clamp(dt * 4, 0, 1);
          M.Body.setVelocity(body, {
            x: lerp(body.velocity.x, body.velocity.x * factor, blend),
            y: lerp(body.velocity.y, body.velocity.y * factor, blend),
          });
          M.Body.setAngularVelocity(body, lerp(body.angularVelocity, body.angularVelocity * factor, blend));
        } else if (entity.behavior === 'hazard') {
          if (entity.state.lastHit === undefined) entity.state.lastHit = {};
          const last = entity.state.lastHit[owner.id] ?? -10;
          if (phys.simTime - last > 0.35) {
            entity.state.lastHit[owner.id] = phys.simTime;
            bus.emit(EVENTS.HAZARD_TOUCHED, { entity: owner, zone: entity });
            effects?.burst(body.position.x, body.position.y, '#ff5d6c', 6, 2.6);
            sfx?.hazard();
            if (owner.kind === 'ragdoll') {
              owner.damage += 2;
            } else {
              destruction?.damage(owner, num(entity.props.strength, 60, 5, 400) * 0.35, { source: 'hazard' });
            }
          }
        } else if (entity.behavior === 'teleporter') {
          if (entity.state.cooldownUntil && phys.simTime < entity.state.cooldownUntil) continue;
          const partner = links.find((z) => z !== entity && (z.props.link ? z.props.link === entity.id : z.props.link === entity.props.link));
          const target = partner ?? links.find((z) => z !== entity);
          if (!target || target.removed) continue;
          const to = { x: target.position.x, y: target.position.y - 30 };
          const delta = { x: to.x - body.position.x, y: to.y - body.position.y };
          for (const b of owner.getBodies()) M.Body.translate(b, delta);
          owner.getBodies().forEach((b) => M.Body.setVelocity(b, { x: b.velocity.x * 0.4, y: b.velocity.y * 0.4 }));
          entity.state.cooldownUntil = phys.simTime + 0.6;
          target.state.cooldownUntil = phys.simTime + 0.6;
          effects?.burst(entity.position.x, entity.position.y, '#a77bff', 10, 3);
          sfx?.teleport();
          bus.emit(EVENTS.TELEPORTED, { entity: owner, from: entity.id, to: target.id });
        }
      }
    }
  }

  return off;
}
