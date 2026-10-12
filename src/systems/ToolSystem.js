/**
 * ToolSystem — the left toolbar's behaviours.
 *
 * Every tool receives pointer events in world space and talks to the same
 * services (spawner, forces, constraints, selection, undo). Interaction rules
 * live here so they stay consistent:
 *   - a click never spawns by accident (spawning needs the spawn tools),
 *   - dragging always grabs/moves, and releasing while dragging never attacks,
 *   - the force arrow previews direction and magnitude before it is applied,
 *   - every mutation is undoable.
 */

import { OBJECT_IDS, getDef } from '../config/objectCatalog.js';
import { LIMITS, RAGDOLL_PRESETS } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';
import { clamp } from '../utils/mathUtils.js';
import { clampToWorldRect, snapPoint } from '../utils/coordinateUtils.js';

export const TOOLS = [
  { id: 'select', name: 'Select', icon: 'cursor', key: '1', hint: 'Click to select · shift-click to add · drag empty space for a box selection' },
  { id: 'grab', name: 'Grab', icon: 'grab', key: '2', hint: 'Drag an object to swing it around and throw it' },
  { id: 'move', name: 'Move', icon: 'move', key: '3', hint: 'Drag to reposition objects (velocities are cleared)' },
  { id: 'spawnRagdoll', name: 'Spawn Ragdoll', icon: 'ragdoll', key: '4', hint: 'Click to drop a character — pick a preset in Character Studio' },
  { id: 'spawnObject', name: 'Spawn Object', icon: 'box', key: '5', hint: 'Pick an object in the library, then click in the world' },
  { id: 'force', name: 'Apply Force', icon: 'force', key: '6', hint: 'Drag from an object to aim · release to push · hold shift to pull' },
  { id: 'explosion', name: 'Explosion', icon: 'boom', key: '7', hint: 'Click to detonate · radius and power live in the World panel' },
  { id: 'rope', name: 'Rope / Joint', icon: 'link', key: '8', hint: 'Click a body, then another (or empty space) to connect them' },
  { id: 'eraser', name: 'Eraser', icon: 'erase', key: '9', hint: 'Click an object to delete it (Delete key also works)' },
  { id: 'platform', name: 'Draw Platform', icon: 'platform', key: '0', hint: 'Drag to draw a platform · straight lines snap while the grid is on' },
];

export class ToolSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = 'select';
    this.options = {
      ragdollPreset: ctx.settings?.get('ragdollPreset') ?? 'lightweight',
      forceStrength: 10,          // px/step at full drag length
      explosionRadius: 220,
      explosionForce: 10,
      ropeType: 'rope',
      ropeLength: 0,              // 0 = distance between the two points
      snap: ctx.settings?.get('snapToGrid') ?? false,
    };
    this.drag = null;
    this.pendingRope = null;
    this.marquee = null;
    this.lastHead = { x: 0, y: 0 };
    this.pendingObjectId = null;
  }

  /* ------------------------------------------------------------------- tools */

  setTool(id) {
    if (!TOOLS.some((t) => t.id === id)) return;
    this.cancel();
    this.active = id;
    this.pendingRope = null;
    this.ctx.renderer?.drawRopePreview?.(null);
    this.ctx.character?.setControlEnabled(id !== 'grab' && id !== 'move');
    bus.emit(EVENTS.TOOL_CHANGED, { tool: id, def: this.activeDef });
    this.ctx.ui?.setActiveTool?.(id);
    this.ctx.ui?.showToolTip?.(this.activeDef?.hint ?? '');
  }

  get activeDef() {
    return TOOLS.find((t) => t.id === this.active);
  }

  /** Set the object that the spawn tool will drop. */
  setPendingObject(id) {
    this.pendingObjectId = OBJECT_IDS.includes(id) ? id : null;
    if (this.pendingObjectId) this.setTool('spawnObject');
  }

  cancel() {
    this.drag = null;
    this.marquee = null;
    this.ctx.renderer?.drawMarquee?.(null);
    this.ctx.renderer?.drawForceArrow?.(null);
    this.ctx.renderer?.drawPendingPlatform?.(null);
  }

  /* ---------------------------------------------------------------- pointer */

  onPointerHover(world) {
    const entity = this.ctx.phys.entityAtPoint(world, { includeStatic: true });
    this.ctx.renderer?.setHover?.(entity);
    this.ctx.selection?.setHover(entity);
    if (this.active === 'spawnObject' && this.pendingObjectId) {
      this.ctx.renderer?.drawSpawnGhost?.(this.pendingObjectId, world, this.isSpawnSpotFree(world));
    } else if (this.ctx.renderer?.drawSpawnGhost && this.ghostShown) {
      this.ctx.renderer.drawSpawnGhost(null, world);
      this.ghostShown = false;
    }
    this.lastHead = { x: world.x, y: world.y };
  }

  onPointerDown(world) {
    const shift = this.ctx.input?.pressed?.has?.('ShiftLeft') || this.ctx.input?.pressed?.has?.('ShiftRight');
    switch (this.active) {
      case 'select': return this.beginSelect(world, shift);
      case 'grab': return this.beginGrab(world);
      case 'move': return this.beginMove(world);
      case 'spawnRagdoll': return this.spawnRagdoll(world);
      case 'spawnObject': return this.spawnObject(world);
      case 'force': return this.beginForce(world, shift);
      case 'explosion': return this.detonate(world);
      case 'rope': return this.ropeClick(world);
      case 'eraser': return this.erase(world);
      case 'platform': return this.beginPlatform(world);
      default: return undefined;
    }
  }

  onPointerMove(world, pointer, state) {
    this.lastHead = { x: world.x, y: world.y };
    if (this.drag?.move) this.drag.move(world, state);
    if (this.marquee) {
      this.marquee.end = world;
      this.ctx.renderer?.drawMarquee?.(this.rectFrom(this.marquee.start, world));
    }
    if (this.pendingRope) {
      this.ctx.renderer?.drawRopePreview?.({ from: this.pendingRope.world, to: world, color: this.pendingRope.color });
    }
    const selected = this.ctx.selection.list();
    const moving = selected.filter((e) => !e.locked && !e.level);
    if (moving.length && state?.dragged) this.ctx.world.lastDrag = moving.length;
  }

  onPointerUp(world, pointer, state) {
    if (this.drag?.end) this.drag.end(world, state);
    this.drag = null;
    if (this.marquee) {
      const rect = this.rectFrom(this.marquee.start, world);
      const additive = this.marquee.additive;
      const found = this.ctx.selection.pickInRect(rect);
      this.ctx.selection.selectMany(found, { additive });
      this.ctx.renderer?.drawMarquee?.(null);
      this.marquee = null;
    }
  }

  /* ----------------------------------------------------------------- select */

  beginSelect(world, additive) {
    const entity = this.ctx.phys.entityAtPoint(world, { includeStatic: true });
    if (entity) {
      if (additive) this.ctx.selection.toggle(entity);
      else this.ctx.selection.select(entity);
      return;
    }
    if (!additive) this.ctx.selection.clear();
    this.marquee = { start: { ...world }, end: { ...world }, additive };
  }

  /* ------------------------------------------------------------------- grab */

  beginGrab(world) {
    const entity = this.ctx.phys.entityAtPoint(world, {});
    if (!entity) return;
    this.ctx.selection.select(entity);
    this.ctx.phys.wake(entity.body);
    const targets = entity.getBodies().filter((b) => !b.isStatic).slice(0, 6);
    this.drag = {
      entity,
      targets,
      start: { ...world },
      // Spring-based grabbing: the object follows the cursor through real
      // forces, so it still collides with everything on the way.
      move: (point) => {
        for (const body of targets) {
          const dx = point.x - body.position.x;
          const dy = point.y - body.position.y;
          const k = 0.0045 * body.mass;
          const damp = 0.12 * body.mass;
          this.ctx.M.Body.applyForce(body, body.position, {
            x: clamp(dx * k - body.velocity.x * damp, -0.6, 0.6),
            y: clamp(dy * k - body.velocity.y * damp, -0.6, 0.6),
          });
          this.ctx.phys.wake(body);
        }
      },
      end: () => {
        // Velocity is kept — that is the throw.
        const speed = entity.speed?.() ?? 0;
        if (speed > 4) this.ctx.sfx?.whoosh?.(clamp(speed / 20, 0.2, 1));
        this.ctx.stats?.bump('objectsThrown', 1);
      },
    };
  }

  /* ------------------------------------------------------------------- move */

  beginMove(world) {
    const picked = this.ctx.phys.entityAtPoint(world, { includeStatic: true });
    if (!picked) {
      // Moving with nothing under the cursor moves the current selection.
      const selected = this.ctx.selection.list().filter((e) => !e.locked && !e.level);
      if (selected.length) return this.startMoveDrag(selected, world);
      return;
    }
    if (!this.ctx.selection.has(picked)) this.ctx.selection.select(picked);
    const targets = this.ctx.selection.list().filter((e) => !e.locked && !e.level);
    this.startMoveDrag(targets.length ? targets : [picked], world);
  }

  startMoveDrag(entities, world) {
    const snapshot = entities.map((entity) => ({
      entity,
      bodies: entity.getBodies().map((body) => ({ body, x: body.position.x, y: body.position.y })),
    }));
    const start = { ...world };
    let delta = { x: 0, y: 0 };
    this.drag = {
      snapshot,
      start,
      move: (point) => {
        delta = { x: point.x - start.x, y: point.y - start.y };
        for (const entry of snapshot) {
          for (const item of entry.bodies) {
            this.ctx.M.Body.setPosition(item.body, { x: item.x + delta.x, y: item.y + delta.y }, false);
            this.ctx.M.Body.setVelocity(item.body, { x: 0, y: 0 });
          }
        }
      },
      end: () => {
        if (Math.abs(delta.x) < 0.6 && Math.abs(delta.y) < 0.6) return;
        for (const entry of snapshot) {
          for (const item of entry.bodies) {
            this.ctx.M.Body.setPosition(item.body, { x: item.x + delta.x, y: item.y + delta.y }, false);
          }
          this.ctx.phys.wake(entry.entity.body);
        }
        this.ctx.undo?.record(`Move ${snapshot[0].entity.label}`, {
          apply: () => this.translate(snapshot, delta.x, delta.y, 1),
          revert: () => this.translate(snapshot, delta.x, delta.y, -1),
        });
      },
    };
  }

  translate(snapshot, dx, dy, sign) {
    for (const entry of snapshot) {
      for (const item of entry.bodies) {
        this.ctx.M.Body.setPosition(item.body, { x: item.x + dx * sign, y: item.y + dy * sign }, false);
        this.ctx.phys.wake(item.body);
      }
    }
  }

  /* ------------------------------------------------------------------- spawn */

  spawnRagdoll(world) {
    const spot = clampToWorldRect(world.x, world.y - 60, 60);
    this.ctx.spawner.spawnRagdoll(this.options.ragdollPreset, spot.x, spot.y);
  }

  spawnObject(world) {
    if (!this.pendingObjectId) {
      this.ctx.toast?.('info', 'Pick an object', 'Choose something in the object library, then click in the world.');
      this.ctx.ui?.flashLibrary?.();
      return;
    }
    const def = getDef(this.pendingObjectId);
    const spot = clampToWorldRect(world.x, world.y, 60);
    this.ctx.spawner.spawn(this.pendingObjectId, spot.x, spot.y, {});
    if (def?.composite) this.ctx.ui?.showToolTip?.(`${def.name} placed — drag its parts with the Move tool.`);
  }

  isSpawnSpotFree(point) {
    const bodies = this.ctx.M.Query.point(this.ctx.phys.allBodies(), point);
    return !bodies.some((body) => body.isStatic);
  }

  /* ------------------------------------------------------------------- force */

  beginForce(world, pull) {
    const entity = this.ctx.phys.entityAtPoint(world, {});
    this.drag = {
      start: { ...world },
      entity,
      pull,
      move: (point) => {
        const dx = point.x - this.drag.start.x;
        const dy = point.y - this.drag.start.y;
        const distance = Math.hypot(dx, dy);
        const magnitude = clamp(distance / 140, 0, 1) * this.options.forceStrength;
        this.ctx.renderer?.drawForceArrow?.({
          from: entity ? entity.position : this.drag.start,
          to: point,
          pull,
          magnitude,
        });
      },
      end: (point) => {
        this.ctx.renderer?.drawForceArrow?.(null);
        const dx = point.x - this.drag.start.x;
        const dy = point.y - this.drag.start.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 14) return;
        const magnitude = clamp((distance / 140) * this.options.forceStrength, 1, LIMITS.MAX_IMPULSE);
        const dir = { x: dx / distance, y: dy / distance };
        const sign = pull ? -1 : 1;
        const vector = { x: dir.x * magnitude * sign, y: dir.y * magnitude * sign };
        const targets = entity ? [entity] : this.ctx.selection.list();
        let affected = 0;
        for (const target of targets) {
          if (target.locked || target.removed) continue;
          this.ctx.forces.applyDeltaV(target, vector, { kind: pull ? 'pull' : 'push' });
          affected += 1;
        }
        if (!affected) {
          this.ctx.toast?.('info', 'Nothing to push', 'Aim the arrow starting from an object.');
          return;
        }
        this.ctx.effects?.burst(this.drag.start.x, this.drag.start.y, pull ? '#ff9d7a' : '#6cc9ff', 9, 3);
        this.ctx.sfx?.whoosh?.(clamp(magnitude / 12, 0.2, 1));
        this.ctx.stats?.bump('forcesApplied', 1);
        this.ctx.stats?.max('maxForceUsed', Math.round(magnitude));
      },
    };
  }

  /* --------------------------------------------------------------- explosion */

  detonate(world) {
    const { explosionRadius: radius, explosionForce: force } = this.options;
    this.ctx.forces.explosion({ x: world.x, y: world.y, radius, force, visual: true, chain: 1, damageScale: 1 });
    this.ctx.effects?.screenFlash(0.18);
    this.ctx.stats?.bump('explosions', 1);
    this.ctx.stats?.max('maxExplosionRadius', radius);
  }

  /* --------------------------------------------------------------- rope/joint */

  ropeClick(world) {
    const entity = this.ctx.phys.entityAtPoint(world, { includeStatic: true });
    if (!this.pendingRope) {
      this.pendingRope = {
        entity,
        world: { ...world },
        color: this.ropeColor(this.options.ropeType),
      };
      this.ctx.renderer?.drawRopePreview?.({ from: this.pendingRope.world, to: world, color: this.pendingRope.color });
      this.ctx.ui?.showToolTip?.('Now click a second object — or empty space for a fixed anchor.');
      return;
    }
    const first = this.pendingRope;
    const length = this.options.ropeLength > 0
      ? this.options.ropeLength
      : Math.max(40, Math.hypot(world.x - first.world.x, world.y - first.world.y));
    const record = this.ctx.constraints.create({
      type: this.options.ropeType,
      entityA: first.entity,
      entityB: entity,
      anchor: !entity ? { x: world.x, y: world.y } : null,
      length,
      color: first.color,
    });
    this.pendingRope = null;
    this.ctx.renderer?.drawRopePreview?.(null);
    if (!record) {
      this.ctx.toast?.('warn', 'Could not connect', 'Pick a body for at least one end of the connection.');
      return;
    }
    this.ctx.undo?.recordConstraint(record);
    this.ctx.toast?.('success', `${record.label} created`, `${Math.round(length)} px long.`);
  }

  ropeColor(type) {
    const colors = { rope: '#e0b64a', chain: '#a9bdd3', spring: '#ffd23f', joint: '#57c8ff', pin: '#38e07b', distance: '#a77bff' };
    return colors[type] ?? '#e0b64a';
  }

  /* ----------------------------------------------------------------- eraser */

  erase(world) {
    const entity = this.ctx.phys.entityAtPoint(world, { includeStatic: true });
    if (!entity) return;
    if (entity.level) {
      this.ctx.toast?.('info', 'Protected object', 'Level scenery cannot be deleted — use Reset to restore it.');
      return;
    }
    const snapshot = entity.serialize();
    this.ctx.spawner.remove(entity, { reason: 'erased', keepUndo: true });
    this.ctx.undo?.recordRemoval(entity, snapshot);
  }

  /* ---------------------------------------------------------------- platform */

  beginPlatform(world) {
    const start = this.snap(world);
    let end = start;
    this.drag = {
      start,
      move: (point) => {
        end = this.constrainPlatform(start, this.snap(point));
        this.ctx.renderer?.drawPendingPlatform?.({ start, end });
      },
      end: (point) => {
        end = this.constrainPlatform(start, this.snap(point));
        this.ctx.renderer?.drawPendingPlatform?.(null);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        if (width < 18 && height < 18) return;
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const props = {
          width: Math.max(24, width),
          height: Math.max(14, height),
          static: true,
        };
        const entity = this.ctx.spawner.spawn('platform', cx, cy, { props });
        if (!entity) return;
        this.ctx.world.customPlatforms.push({
          x: cx, y: cy, width: props.width, height: props.height, angle: 0, color: entity.color,
        });
        this.ctx.stats?.bump('platformsDrawn', 1);
      },
    };
  }

  constrainPlatform(start, point) {
    if (!this.options.snap) return point;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    if (Math.abs(dx) > Math.abs(dy) * 1.5) return { x: point.x, y: start.y };
    if (Math.abs(dy) > Math.abs(dx) * 1.5) return { x: start.x, y: point.y };
    return point;
  }

  snap(point) {
    const gridSize = this.ctx.settings?.get('gridSize') ?? 50;
    const snapped = snapPoint(point.x, point.y, gridSize, this.options.snap);
    return { x: snapped.x, y: snapped.y };
  }

  /* ------------------------------------------------------------- utilities */

  rectFrom(a, b) {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    return { x: minX, y: minY, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }

  /** Keyboard actions that depend on the active tool. */
  handleKeyAction(action) {
    const selection = this.ctx.selection.list();
    switch (action) {
      case 'deleteSelection': {
        if (!selection.length) return false;
        const snapshots = selection.map((entity) => ({ entity, data: entity.serialize() }));
        let removed = 0;
        for (const { entity, data } of snapshots) {
          if (entity.level) continue;
          if (this.ctx.spawner.remove(entity, { reason: 'deleted', keepUndo: true })) {
            this.ctx.undo?.recordRemoval(entity, data);
            removed += 1;
          }
        }
        if (removed) this.ctx.selection.clear({ silent: true });
        return removed > 0;
      }
      case 'duplicate': {
        if (!selection.length) return false;
        for (const entity of selection) this.ctx.spawner.duplicate(entity, { x: 50, y: -40 });
        return true;
      }
      case 'rotateLeft':
      case 'rotateRight': {
        if (!selection.length) return false;
        const step = action === 'rotateRight' ? Math.PI / 12 : -Math.PI / 12;
        for (const entity of selection) {
          const before = entity.angle;
          this.ctx.spawner.rotate(entity, before + step);
          this.ctx.undo?.recordProp(entity, 'angle', before, before + step, `Rotate ${entity.label}`);
        }
        return true;
      }
      default:
        return false;
    }
  }

  /* --------------------------------------------------------------- presets */

  setRagdollPreset(id) {
    if (!RAGDOLL_PRESETS[id]) return;
    this.options.ragdollPreset = id;
    this.ctx.character?.setCosmetic({}, { applyToAll: false });
    bus.emit('tool:preset', { preset: id });
  }

  get pendingObjectDef() {
    return this.pendingObjectId ? getDef(this.pendingObjectId) : null;
  }

  get presetLabel() {
    return RAGDOLL_PRESETS[this.options.ragdollPreset]?.name ?? 'Ragdoll';
  }
}
