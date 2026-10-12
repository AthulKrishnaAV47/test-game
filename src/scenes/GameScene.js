/**
 * GameScene — the playable scene shared by all four modes.
 *
 * It wires a `GameWorld` (physics + gameplay systems) together with the DOM UI,
 * forwards input, and renders the world once per frame. Mode-specific scenes are
 * thin subclasses that only change the default mode, so every mode runs on
 * exactly the same interaction rules.
 */

// Phaser is imported as a namespace: the ESM build (which vite.config.js
// aliases everything to) exposes named exports and no default export.
import * as Phaser from 'phaser';
import { GameWorld } from '../core/GameWorld.js';
import { Renderer } from '../render/Renderer.js';
import { InputManager } from '../systems/InputManager.js';
import { services } from '../core/services.js';
import { TOOLS } from '../systems/ToolSystem.js';
import { bus, EVENTS } from '../utils/events.js';
import { CHALLENGES, challengeCount, getChallenge } from '../config/challenges.js';

const Matter = Phaser.Physics.Matter.Matter;
const DIGITS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export class GameScene extends Phaser.Scene {
  constructor(key = 'GameScene', mode = 'sandbox') {
    super({ key });
    this.defaultMode = mode;
  }

  init(data = {}) {
    this.launchData = data;
    this.mode = data.mode ?? this.defaultMode;
  }

  create() {
    const settings = services.settings;
    this.game.settings = settings; // the Renderer reads scene.game.settings

    this.world = new GameWorld(this, {
      Matter,
      settings,
      stats: services.stats,
      achievements: services.achievements,
      sfx: services.sfx,
      store: services.store,
    });

    const challengeDef = this.mode === 'challenge' ? getChallenge(this.launchData.challengeId) : null;
    const levelId = this.launchData.levelId
      ?? challengeDef?.level
      ?? settings.get('activeLevelId')
      ?? 'laboratory';

    this.world.start({
      mode: this.mode,
      levelId,
      challengeId: challengeDef?.id ?? null,
      gravity: this.launchData.gravity,
      speed: settings.get('simSpeed') ?? 1,
      layout: this.launchData.layout ?? null,
    });

    this.renderer = new Renderer(this, this.world);
    this.renderer.setLevel(this.world.levelId);
    this.world.ctx.renderer = this.renderer;

    this.inputManager = new InputManager(this.world.ctx);
    this.inputManager.start();
    this.unsubscribeAction = this.inputManager.on('action', ({ action, event }) => this.handleAction(action, event));
    this.unsubscribeEscape = this.inputManager.on('escape', () => this.handleEscape());

    this.ui = services.ui;
    this.ui?.attach(this.world.ctx);
    this.bindDirectKeys();
    this.bindModeUI();

    this.events.once('shutdown', () => this.teardown());
    this.events.once('destroy', () => this.teardown());
    this.cameras.main.setBackgroundColor('#0b1226');
    this.scale.on('resize', this.onResize, this);

    bus.emit(EVENTS.MODE_CHANGED, { mode: this.mode, levelId: this.world.levelId });
  }

  /* --------------------------------------------------------------- mode glue */

  bindModeUI() {
    if (this.mode === 'challenge') {
      this.challenge = this.world.challenge;
      this.ui?.setHint(`Challenge ${(this.challenge?.def.index ?? 0) + 1}/${challengeCount()} — ${this.challenge?.def.objective ?? ''}`);
      this.challengeUnsubs = [
        bus.on(EVENTS.CHALLENGE_COMPLETED, ({ stars }) => {
          services.stats.addChallengeStars?.(this.world.challengeId, stars);
          services.stats.bump('challengesCompleted', 1);
          services.achievements.checkAll();
          setTimeout(() => this.ui?.showWin({
            title: `Challenge complete — ${stars}★`,
            message: this.challenge?.def.objective ?? '',
            onNext: () => this.nextChallenge(),
          }), 420);
        }),
        bus.on(EVENTS.CHALLENGE_FAILED, ({ reason }) => {
          this.ui?.notify('warn', 'Challenge failed', reason ?? 'The objective is no longer possible — press R to retry.');
        }),
      ];
      document.getElementById('cb-retry')?.addEventListener('click', () => this.retryChallenge());
      document.getElementById('cb-next')?.addEventListener('click', () => this.nextChallenge());
      document.getElementById('cb-hint')?.addEventListener('click', () => {
        const hint = this.challenge?.def.hint;
        this.ui?.notify('info', 'Hint', hint ?? 'Try manipulating gravity, or grab the object directly.');
      });
    }

    if (this.mode === 'arena') {
      document.getElementById('arena-reset')?.addEventListener('click', () => {
        this.world.arena?.finish();
        this.world.reset();
      });
    }

    if (this.mode === 'build') this.buildModeUI();
  }

  /** Build Mode shows a floating bar with Test / Save / Clear. */
  buildModeUI() {
    if (document.getElementById('build-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'build-bar';
    bar.className = 'panel build-bar';
    bar.innerHTML = `
      <span class="status-pill" id="build-status">Editing</span>
      <button class="btn small primary" id="build-test">Test physics</button>
      <button class="btn small ghost" id="build-save">Save layout</button>
      <button class="btn small ghost" id="build-clear">Clear</button>`;
    document.getElementById('hud')?.append(bar);
    bar.querySelector('#build-test').addEventListener('click', () => this.toggleBuildTesting());
    bar.querySelector('#build-save').addEventListener('click', () => this.ui?.openSaveDialog());
    bar.querySelector('#build-clear').addEventListener('click', () => this.ui?.clearScene());
    this.world.setBuildTesting(false);
    this.world.ctx.phys.pause();
    this.updateBuildBar(false);
  }

  toggleBuildTesting() {
    const testing = this.world.setBuildTesting(!this.world.buildTesting);
    if (testing) this.world.ctx.phys.resume();
    else this.world.ctx.phys.pause();
    this.updateBuildBar(testing);
    this.ui?.setHint(testing
      ? 'Testing — watch the physics, then return to the editor. Your design is preserved.'
      : 'Editing — objects are frozen. Grid snapping helps you line things up.');
  }

  updateBuildBar(testing) {
    const status = document.getElementById('build-status');
    const button = document.getElementById('build-test');
    if (status) status.textContent = testing ? 'Testing' : 'Editing';
    if (button) button.textContent = testing ? 'Back to editor' : 'Test physics';
  }

  nextChallenge() {
    const index = CHALLENGES.findIndex((c) => c.id === this.world.challengeId);
    const next = CHALLENGES[index + 1];
    if (!next) {
      this.ui?.notify('success', 'All challenges complete', 'You are officially a physics champion.');
      return;
    }
    this.ui?.startMode('challenge', { challengeId: next.id });
  }

  retryChallenge() {
    this.world.reset();
    this.ui?.setHint('Challenge restarted — good luck!');
  }

  /* ------------------------------------------------------------------ input */

  handleAction(action, event) {
    const ctx = this.world.ctx;
    switch (action) {
      case 'reset': this.ui?.resetScene(); break;
      case 'undo': ctx.undo.undo(); break;
      case 'redo': ctx.undo.redo(); break;
      case 'gravity': this.world.toggleGravity(); break;
      case 'pause': this.togglePause(); break;
      case 'save': this.ui?.openSaveDialog(); break;
      case 'deleteSelection': ctx.tools.handleKeyAction('deleteSelection'); break;
      case 'toggleGrid': this.ui?.setGridVisible(!ctx.settings.get('showGrid')); break;
      case 'nextRagdoll': this.world.character.cycleActive(); break;
      case 'duplicate':
        event?.preventDefault?.();
        ctx.tools.handleKeyAction('duplicate');
        break;
      default: break;
    }
  }

  handleEscape() {
    if (this.ui?.hasModal) {
      this.ui.closeModal();
      return;
    }
    this.togglePause();
  }

  togglePause() {
    const paused = !this.world.ctx.phys.paused;
    if (paused) this.world.ctx.phys.pause();
    else this.world.ctx.phys.resume();
    this.ui?.setHint(paused ? 'Paused — the physics is frozen, the UI is not.' : 'Running');
  }

  /** Extra shortcuts that are not remappable (tools, view toggles, stepping). */
  bindDirectKeys() {
    this.input.keyboard.on('keydown', (event) => {
      const active = document.activeElement;
      if (active && (TYPING_TAGS.has(active.tagName) || active.isContentEditable)) return;
      const digit = DIGITS.indexOf(event.code.replace(/^(Digit|Numpad)/, ''));
      if (digit >= 0 && TOOLS[digit]) {
        this.world.ctx.tools.setTool(TOOLS[digit].id);
        return;
      }
      switch (event.code) {
        case 'Period':
        case 'Comma':
          this.world.ctx.phys.singleStep(1);
          break;
        case 'KeyH': this.ui?.toggleCleanHud(); break;
        case 'KeyF': this.ui?.toggleFullscreen(); break;
        case 'KeyT': if (this.mode === 'build') this.toggleBuildTesting(); break;
        default: break;
      }
    });
  }

  /* ----------------------------------------------------------------- update */

  update(time, deltaMs) {
    if (!this.world) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.inputManager?.updateMovement();
    this.world.update(dt, this.inputManager);
    this.renderer?.draw(dt);
    this.ui?.tick(dt);
    void time;
  }

  onResize() {
    this.renderer?.draw(0);
  }

  teardown() {
    if (this.tornDown) return;
    this.tornDown = true;
    this.unsubscribeAction?.();
    this.unsubscribeEscape?.();
    for (const off of this.challengeUnsubs ?? []) off?.();
    this.challengeUnsubs = [];
    this.scale.off('resize', this.onResize, this);
    this.inputManager?.destroy?.();
    this.inputManager = null;
    this.renderer = null;
    this.world?.destroy?.();
    services.ui?.detach?.();
    this.world = null;
  }
}
