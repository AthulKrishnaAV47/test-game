/**
 * ArenaManager — Destruction Arena scoring, driven purely by real events.
 *
 * Tracks objects destroyed, the biggest impact force, launched ragdolls and the
 * longest explosion chain, then folds them into a single destruction score.
 */

import { bus, EVENTS } from '../utils/events.js';
import { LIMITS } from '../config/gameConfig.js';

export const ARENA_SCORING = {
  objectDestroyed: 25,
  targetDestroyed: 60,
  impact: 0.5,        // per unit of impact force (capped)
  launched: 40,
  chain: 75,          // per extra link in an explosion chain
  ragdollLaunched: 120,
};

export class ArenaManager {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.options = options;
    this.reset();
    this.handlers = [];
  }

  reset() {
    this.destroyed = 0;
    this.maxImpact = 0;
    this.launched = 0;
    this.bestChain = 0;
    this.targetsDown = 0;
    this.score = 0;
    this.runTime = 0;
    this.lastEvent = null;
  }

  begin() {
    this.reset();
    this.ctx.toast?.('info', 'Destruction Arena', 'Demolish everything — the scoreboard is watching.');
    this.handlers.push(
      bus.on(EVENTS.OBJECT_DESTROYED, ({ entity, byExplosion }) => this.onDestroyed(entity, byExplosion)),
      bus.on(EVENTS.IMPACT, ({ force }) => this.onImpact(force)),
      bus.on(EVENTS.RAGDOLL_LAUNCHED, ({ entity }) => this.onLaunched(entity)),
      bus.on(EVENTS.EXPLOSION_CHAIN, ({ length }) => this.onChain(length)),
      bus.on(EVENTS.EXPLOSION, () => this.onExplosion())
    );
    this.emit();
    return this;
  }

  onDestroyed(entity, byExplosion) {
    this.destroyed += 1;
    let points = ARENA_SCORING.objectDestroyed;
    if (entity?.hasTag?.('target')) {
      this.targetsDown += 1;
      points = ARENA_SCORING.targetDestroyed;
    }
    if (byExplosion) points += 15;
    this.score += points;
    this.ctx.stats?.bump('arenaObjectsDestroyed', 1);
    this.notify(entity ? `${entity.label} destroyed` : 'Object destroyed', points);
    this.emit();
  }

  onImpact(force) {
    if (!Number.isFinite(force) || force <= this.maxImpact) return;
    const gain = Math.max(0, force - this.maxImpact) * ARENA_SCORING.impact;
    this.maxImpact = force;
    this.score += gain;
    this.ctx.stats?.max('maxImpactForce', Math.round(force));
    this.emit();
  }

  onLaunched(entity) {
    this.launched += 1;
    this.score += ARENA_SCORING.ragdollLaunched;
    this.ctx.stats?.bump('ragdollsLaunched', 1);
    this.notify(`${entity?.label ?? 'Ragdoll'} launched`, ARENA_SCORING.ragdollLaunched);
    this.emit();
  }

  onChain(length) {
    if (length <= this.bestChain) return;
    const extra = length - this.bestChain;
    this.bestChain = length;
    this.score += extra * ARENA_SCORING.chain;
    this.ctx.stats?.max('bestChain', length);
    this.notify(`Chain reaction ×${length}`, extra * ARENA_SCORING.chain);
    this.emit();
  }

  onExplosion() {
    this.ctx.stats?.bump('explosions', 1);
  }

  notify(label, points) {
    this.lastEvent = { label, points, at: this.ctx.phys.simTime };
  }

  update(dt, steps = 0) {
    this.runTime += (steps || 0) / 60;
    // Time bonus: demolishing quickly is worth a little extra.
    if (steps > 0) this.score += 0.2 * steps;
    this.emit();
  }

  onReset() {
    // A scene reset restarts the run, as the arena is a scoring mode.
    this.reset();
    this.emit();
  }

  status() {
    return {
      destroyed: this.destroyed,
      maxImpact: Math.round(this.maxImpact),
      launched: this.launched,
      chain: this.bestChain,
      score: Math.round(this.score),
      targetsDown: this.targetsDown,
      runTime: this.runTime,
      bestScore: this.ctx.stats?.get('arenaBestScore', 0) ?? 0,
      limitWarning: this.ctx.phys.bodyCount() > LIMITS.MAX_BODIES,
    };
  }

  /** Persist the best score when a run ends. */
  finish() {
    const score = Math.round(this.score);
    this.ctx.stats?.max('arenaBestScore', score);
    this.ctx.stats?.bump('arenaRuns', 1);
    this.ctx.toast?.('success', 'Run complete', `Destruction score: ${score}`);
    return score;
  }

  emit() {
    bus.emit(EVENTS.ARENA_SCORE, this.status());
  }

  destroy() {
    for (const off of this.handlers) off?.();
    this.handlers = [];
  }
}
