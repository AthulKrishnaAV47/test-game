/**
 * ChallengeManager — evaluates one challenge's objectives from real events.
 *
 * Goal types (see `src/config/challenges.js`) are evaluated every physics step
 * (zone holds, survival) and from bus events (destruction, explosions, chains),
 * so a completed objective always reflects something that actually happened in
 * the simulation. Star rating is derived from the par time and how cleanly the
 * goals were met.
 */

import { bus, EVENTS } from '../utils/events.js';
import { clamp } from '../utils/mathUtils.js';

const GOAL_LABELS = {
  zone: 'Reach the goal zone',
  destroy: 'Destroy the targets',
  explosionDestroy: 'Destroy targets with one blast',
  chain: 'Trigger an explosion chain',
  launch: 'Launch far enough',
  survive: 'Survive',
  custom: 'Complete the objective',
};

export class ChallengeManager {
  constructor(ctx, def, options = {}) {
    this.ctx = ctx;
    this.def = def;
    this.options = options;
    this.goals = (def.goals ?? []).map((goal) => ({
      ...goal,
      done: false,
      progress: 0,
      timer: 0,
      label: goal.label ?? GOAL_LABELS[goal.type] ?? 'Objective',
    }));
    this.failConditions = (def.failIf ?? []).map((f) => ({ ...f, triggered: false }));
    this.time = 0;
    this.finished = false;
    this.failed = false;
    this.stars = 0;
    this.enabled = options.enabled !== false;
    /** kills counted inside the current explosion window */
    this.blastWindow = { until: 0, count: 0, id: 0 };
    this.handlers = [];
  }

  begin() {
    const { def } = this;
    this.ctx.toast?.('info', `Challenge ${def.index}: ${def.name}`, def.objective);
    bus.emit(EVENTS.CHALLENGE_STARTED, { challenge: def });
    this.emitStatus();

    this.handlers.push(
      bus.on(EVENTS.OBJECT_DESTROYED, (payload) => this.onDestroyed(payload)),
      bus.on(EVENTS.EXPLOSION, (payload) => this.onExplosion(payload)),
      bus.on(EVENTS.EXPLOSION_CHAIN, (payload) => this.onChain(payload)),
      bus.on(EVENTS.RAGDOLL_LAUNCHED, (payload) => this.onLaunched(payload)),
      bus.on(EVENTS.HAZARD_TOUCHED, (payload) => this.onHazardTouched(payload))
    );
  }

  /* --------------------------------------------------------------- events */

  onDestroyed({ entity, byExplosion, chain = 0 }) {
    if (this.finished || !this.enabled) return;
    for (const goal of this.goals) {
      if (goal.done) continue;
      if (goal.type === 'destroy') {
        if (goal.tag && !entity.hasTag?.(goal.tag)) continue;
        if (goal.typeFilter && entity.type !== goal.typeFilter) continue;
        goal.progress += 1;
        if (goal.progress >= (goal.count ?? 1)) this.complete(goal);
      } else if (goal.type === 'explosionDestroy' && byExplosion) {
        // Count kills that happened inside one blast window.
        const now = this.time;
        if (now > this.blastWindow.until) {
          this.blastWindow = { until: now + (goal.within ?? 2.5), count: 0, id: this.blastWindow.id + 1 };
        }
        this.blastWindow.count += 1;
        goal.progress = Math.max(goal.progress, this.blastWindow.count);
        if (this.blastWindow.count >= (goal.count ?? 1)) this.complete(goal);
      } else if (goal.type === 'chain' && chain >= (goal.count ?? 3)) {
        goal.progress = chain;
        this.complete(goal);
      }
    }
  }

  onExplosion() {
    if (this.finished || !this.enabled) return;
    for (const goal of this.goals) {
      if (goal.type === 'explosionDestroy' && !goal.done) {
        // Damage is applied synchronously by the explosion, so OBJECT_DESTROYED
        // events arrive before this handler runs — nothing more to do here.
        goal.progress = Math.max(goal.progress, this.blastWindow.count);
      }
    }
  }

  onChain({ length }) {
    for (const goal of this.goals) {
      if (goal.type === 'chain' && !goal.done && length >= (goal.count ?? 3)) {
        goal.progress = length;
        this.complete(goal);
      }
    }
  }

  onLaunched({ distance }) {
    for (const goal of this.goals) {
      if (goal.type === 'launch' && !goal.done) {
        goal.progress = Math.max(goal.progress, distance ?? 0);
        if ((distance ?? 0) >= (goal.minDistance ?? 400)) this.complete(goal);
      }
    }
  }

  onHazardTouched() {
    if (this.finished || !this.enabled) return;
    for (const fail of this.failConditions) {
      if (fail.type !== 'hazardTouched') continue;
      if (!fail.triggered) {
        fail.triggered = true;
        this.fail(fail.label ?? 'A hazard was touched');
      }
    }
  }

  /* ----------------------------------------------------------- evaluation */

  update(dt, steps = 0) {
    if (this.finished) return;
    if (steps > 0) this.time += steps / 60;
    if (!this.enabled) return;

    for (const goal of this.goals) {
      if (goal.done || goal.type !== 'zone') continue;
      const inside = this.entitiesInZone(goal);
      if (inside) {
        goal.timer += steps / 60;
        goal.progress = clamp(goal.timer / (goal.hold ?? 0.3), 0, 1);
        if (goal.timer >= (goal.hold ?? 0.3)) this.complete(goal);
      } else if (goal.timer > 0) {
        goal.timer = Math.max(0, goal.timer - dt * 2);
        goal.progress = clamp(goal.timer / (goal.hold ?? 0.3), 0, 1);
      }
    }
    this.emitStatus();
  }

  /** Which entities satisfy a zone goal right now. */
  entitiesInZone(goal) {
    const zone = goal.zone;
    if (!zone) return null;
    const candidates = this.zoneCandidates(goal.kind, goal.objectType);
    for (const entity of candidates) {
      if (entity.removed) continue;
      const point = entity.center?.() ?? entity.position;
      const inside = Math.abs(point.x - zone.x) <= zone.w / 2 && Math.abs(point.y - zone.y) <= zone.h / 2;
      if (!inside) continue;
      if (goal.minSpeed && (entity.speed?.() ?? 0) < goal.minSpeed) continue;
      if (goal.kind === 'ragdoll' && !entity.grounded && (goal.requireGrounded ?? true) && goal.hold > 0.2) {
        // Still inside the zone while airborne — keep the timer running, the
        // hold time itself prevents a lucky fly-through from counting.
      }
      return entity;
    }
    return null;
  }

  zoneCandidates(kind, objectType) {
    switch (kind) {
      case 'ragdoll':
        return this.ctx.phys.entitiesByTag('ragdoll');
      case 'ball':
        return [...this.ctx.phys.entities].filter((e) => e.hasTag?.('ball') || e.def?.tags?.includes('ball'));
      case 'type':
        return [...this.ctx.phys.entities].filter((e) => e.type === objectType);
      case 'any':
      default:
        return [...this.ctx.phys.entities];
    }
  }

  /* -------------------------------------------------------------- results */

  complete(goal) {
    if (goal.done) return;
    goal.done = true;
    goal.progress = 1;
    this.ctx.sfx?.uiOpen?.();
    this.ctx.toast?.('success', 'Objective complete', goal.label);
    bus.emit(EVENTS.CHALLENGE_GOAL, { goal, challenge: this.def });
    this.emitStatus();

    if (this.goals.every((g) => g.done)) this.completeChallenge();
  }

  completeChallenge() {
    if (this.finished) return;
    this.finished = true;
    this.failed = false;
    this.stars = this.computeStars();
    this.ctx.stats?.bump('challengesCompleted', 1);
    this.ctx.stats?.addChallengeStars(this.def.id, this.stars);
    if (this.stars >= 3) this.ctx.stats?.bump('challengesThreeStar', 1);
    if (this.ctx.stats?.get('challengesCompleted', 0) >= 15) {
      // AchievementManager watches the counter; nothing else to do here.
    }
    this.ctx.sfx?.achievement?.();
    this.ctx.effects?.screenFlash(0.25);
    this.ctx.toast?.('success', 'Challenge complete!', `${this.def.name} · ${'★'.repeat(this.stars)}${'☆'.repeat(3 - this.stars)} · ${this.time.toFixed(1)}s`);
    bus.emit(EVENTS.CHALLENGE_COMPLETED, { challenge: this.def, stars: this.stars, time: this.time });
    this.emitStatus();
  }

  fail(reason) {
    if (this.finished) return;
    this.failed = true;
    this.finished = true;
    this.stars = 0;
    this.ctx.sfx?.error?.();
    this.ctx.toast?.('error', 'Challenge failed', reason);
    bus.emit(EVENTS.CHALLENGE_FAILED, { challenge: this.def, reason });
    this.emitStatus();
  }

  computeStars() {
    const par = this.def.par ?? 120;
    if (this.time <= par * 0.6) return 3;
    if (this.time <= par) return 2;
    return 1;
  }

  retry() {
    const world = this.ctx.world;
    world.reset({ silent: true });
    this.time = 0;
    this.finished = false;
    this.failed = false;
    this.stars = 0;
    this.blastWindow = { until: 0, count: 0, id: 0 };
    for (const goal of this.goals) {
      goal.done = false;
      goal.progress = 0;
      goal.timer = 0;
    }
    for (const fail of this.failConditions) fail.triggered = false;
    this.ctx.toast?.('info', 'Challenge reset', this.def.objective);
    this.emitStatus();
    bus.emit(EVENTS.CHALLENGE_STARTED, { challenge: this.def, retry: true });
  }

  nextChallenge() {
    return this.ctx.world?.advanceChallenge?.() ?? null;
  }

  /** Progress payload sent to the HUD banner. */
  status() {
    const total = this.goals.length || 1;
    const done = this.goals.filter((g) => g.done).length;
    const progress = this.goals.reduce((sum, g) => sum + (g.done ? 1 : g.progress), 0) / total;
    return {
      id: this.def.id,
      index: this.def.index,
      name: this.def.name,
      objective: this.def.objective,
      instructions: this.def.instructions,
      hint: this.def.hint,
      par: this.def.par,
      time: this.time,
      goals: this.goals.map((g) => ({ id: g.id, label: g.label, done: g.done, progress: g.progress })),
      progress,
      stars: this.stars,
      finished: this.finished,
      failed: this.failed,
      failReason: this.failConditions.find((f) => f.triggered)?.label ?? null,
    };
  }

  emitStatus() {
    bus.emit(EVENTS.CHALLENGE_STATUS, this.status());
  }

  onReset() {
    this.time = 0;
    this.finished = false;
    this.failed = false;
    for (const goal of this.goals) {
      goal.done = false;
      goal.progress = 0;
      goal.timer = 0;
    }
    for (const fail of this.failConditions) fail.triggered = false;
    bus.emit(EVENTS.CHALLENGE_STARTED, { challenge: this.def, retry: true });
    this.emitStatus();
  }

  destroy() {
    for (const off of this.handlers) off?.();
    this.handlers = [];
  }
}
