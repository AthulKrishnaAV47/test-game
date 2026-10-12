/**
 * HudUI — the in-game HUD: top bar (simulation controls), tool list, status bar,
 * challenge banner, arena scoreboard, pause overlay and the first-run hint.
 *
 * The HUD is pure DOM on top of the canvas. It only reads simulation state
 * through the shared context, so pausing the physics never freezes the UI (and
 * the UI keeps working while the world is paused).
 */

import { $, $$, el, clear, hide, show, toast, applyIcons, screenFlash } from './dom.js';
import { icon } from './icons.js';
import { TOOLS } from '../systems/ToolSystem.js';
import { LIMITS } from '../config/gameConfig.js';
import { bus, EVENTS } from '../utils/events.js';
import { clamp } from '../utils/mathUtils.js';

const UI_SELECTOR = '#topbar, #toolbar, #library-panel, #inspector, #statusbar, #challenge-banner, #arena-board, #pause-overlay, #modal-root, #control-hint';

export class HudUI {
  constructor(ctx, ui) {
    this.ctx = ctx;
    this.ui = ui;
    this.fps = 60;
    this.frames = 0;
    this.fpsTime = 0;
    this.pointer = { x: 0, y: 0 };
    this.paused = false;
    this.unsubs = [];
    this.builtKey = null;

    this.nodes = {
      hud: $('#hud'),
      fps: $('#fps-value'),
      bodies: $('#body-value'),
      sim: $('#status-sim'),
      mode: $('#status-mode'),
      objects: $('#status-objects'),
      selection: $('#status-selection'),
      coords: $('#status-coords'),
      hint: $('#status-hint'),
      limit: $('#status-limit'),
      modeBadge: $('#mode-badge'),
      toolTip: $('#tool-tip-banner'),
      controlHint: $('#control-hint'),
      pauseOverlay: $('#pause-overlay'),
      challenge: $('#challenge-banner'),
      arena: $('#arena-board'),
      toolbar: $('#toolbar'),
      library: $('#library-panel'),
      inspector: $('#inspector'),
    };

    this.buildToolList();
    this.buildSpeedChips();
    this.bindTopbar();
    this.bindPauseOverlay();
    this.bindCollapse();
    this.bindHint();
    this.subscribe();
    this.setMode(this.ctx.world?.mode ?? 'sandbox');
    this.setPaused(this.ctx.phys?.paused ?? false);
    applyIcons(this.nodes.hud ?? document);
  }

  /* ------------------------------------------------------------------- setup */

  buildToolList() {
    const list = $('#tool-list');
    if (!list) return;
    clear(list);
    this.toolButtons = new Map();
    for (const tool of TOOLS) {
      const button = el('button', {
        class: 'tool-btn',
        type: 'button',
        title: tool.hint,
        onclick: () => this.ctx.tools?.setTool(tool.id),
      }, [
        el('span', { class: 'tool-icon', html: icon(tool.icon) }),
        el('span', { class: 'tool-label', text: tool.name }),
        el('span', { class: 'tool-key', text: tool.key }),
      ]);
      list.append(button);
      this.toolButtons.set(tool.id, button);
    }
    this.setActiveTool(this.ctx.tools?.active ?? 'select');
  }

  buildSpeedChips() {
    this.speedChips = $$('[data-speed]');
    for (const chip of this.speedChips) {
      chip.addEventListener('click', () => this.ui.setSpeed(Number(chip.dataset.speed)));
    }
    const slider = $('#speed-slider');
    if (slider) {
      slider.value = String(this.ctx.phys.speed ?? 1);
      slider.addEventListener('input', () => this.ui.setSpeed(Number(slider.value), { fromSlider: true }));
    }
  }

  bindTopbar() {
    const actions = {
      play: () => this.ctx.phys.resume(),
      pause: () => this.ctx.phys.togglePause(),
      step: () => this.ctx.phys.singleStep(1),
      reset: () => this.ui.resetScene(),
      clear: () => this.ui.clearScene(),
      gravity: () => this.ctx.world.toggleGravity(),
      undo: () => this.ctx.undo.undo(),
      redo: () => this.ctx.undo.redo(),
      save: () => this.ui.openSaveDialog(),
      load: () => this.ui.openLoadDialog(),
      fullscreen: () => this.ui.toggleFullscreen(),
      clean: () => this.ui.toggleCleanHud(),
    };
    for (const button of $$('[data-sim]')) {
      button.addEventListener('click', () => actions[button.dataset.sim]?.());
    }
    $('#btn-back-menu')?.addEventListener('click', () => this.ui.backToMenu());
  }

  bindPauseOverlay() {
    for (const button of $$('#pause-overlay [data-pause]')) {
      button.addEventListener('click', () => {
        switch (button.dataset.pause) {
          case 'resume': this.ctx.phys.resume(); break;
          case 'step': this.ctx.phys.singleStep(1); break;
          case 'reset': this.ui.resetScene(); break;
          case 'settings': this.ui.openSettings(); break;
          case 'menu': this.ui.backToMenu(); break;
          default: break;
        }
      });
    }
  }

  bindCollapse() {
    for (const button of $$('.collapse-btn')) {
      button.addEventListener('click', () => {
        const target = document.getElementById(button.dataset.collapse);
        if (!target) return;
        const collapsed = target.classList.toggle('collapsed');
        button.setAttribute('data-icon', collapsed ? 'chevron-right' : 'chevron-left');
        button.innerHTML = '';
        delete button.dataset.iconApplied;
        applyIcons(button.parentElement ?? button);
      });
    }
  }

  bindHint() {
    $('#ch-dismiss')?.addEventListener('click', () => {
      hide(this.nodes.controlHint);
      this.ctx.settings?.set('showHints', false);
      this.ctx.store?.write?.('sticklab.helpSeen.v1', true);
    });
    window.addEventListener('pointermove', (event) => {
      this.pointer = { x: event.clientX, y: event.clientY };
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ events */

  subscribe() {
    this.unsubs.push(
      bus.on(EVENTS.FRAME_STATS, (payload) => this.onFrameStats(payload)),
      bus.on(EVENTS.ENTITY_COUNT, (payload) => this.onCounts(payload)),
      bus.on(EVENTS.SELECTION_CHANGED, ({ entities }) => this.onSelection(entities)),
      bus.on(EVENTS.SIM_STATE, (state) => {
        this.setPaused(Boolean(state.paused));
        this.setSpeedChip(state.speed);
      }),
      bus.on(EVENTS.SCENE_READY, ({ mode }) => {
        this.setMode(mode);
        this.ctx.inspector?.refresh?.();
      }),
      bus.on(EVENTS.SCENE_RESET, () => this.setHint('Scene reset — everything is back at the start.')),
      bus.on(EVENTS.TOOL_CHANGED, ({ tool }) => {
        this.setActiveTool(tool);
        this.setHint(TOOLS.find((t) => t.id === tool)?.hint ?? '');
      }),
      bus.on(EVENTS.CHALLENGE_STATUS, (status) => this.onChallengeStatus(status)),
      bus.on(EVENTS.ARENA_SCORE, (status) => this.onArenaScore(status)),
      bus.on(EVENTS.TOAST, ({ type, title, message }) => toast({ type, title, message })),
      bus.on(EVENTS.GRAVITY_CHANGED, ({ enabled, presetId }) => {
        this.setHint(`Gravity ${enabled ? 'on' : 'off'}${presetId ? ` · ${presetId}` : ''}`);
      }),
      bus.on(EVENTS.EXPLOSION, ({ radius }) => screenFlash(clamp((radius ?? 200) / 2600, 0.05, 0.3)))
    );
  }

  onFrameStats({ bodyCount = 0 } = {}) {
    this.frames += 1;
    if (this.nodes.bodies) this.nodes.bodies.textContent = String(bodyCount);
  }

  /** Called by the scene each frame with the real frame delta (seconds). */
  tick(dt) {
    this.fpsTime += dt;
    if (this.fpsTime >= 0.35) {
      this.fps = clamp(Math.round(this.frames / this.fpsTime), 1, 240);
      this.frames = 0;
      this.fpsTime = 0;
      if (this.nodes.fps) this.nodes.fps.textContent = String(this.fps);
      const pointer = this.ctx.input?.pointer?.world;
      if (pointer && this.nodes.coords) this.nodes.coords.textContent = `${pointer.x.toFixed(0)}, ${pointer.y.toFixed(0)}`;
    }
  }

  onCounts({ count = 0, entities = 0, debris = 0 } = {}) {
    if (this.nodes.objects) {
      this.nodes.objects.textContent = `${count} / ${LIMITS.MAX_BODIES} bodies`;
      this.nodes.objects.title = `${entities} objects · ${debris} debris`;
    }
    this.nodes.limit?.classList.toggle('hidden', count <= LIMITS.MAX_BODIES);
    if (count > LIMITS.MAX_BODIES) this.setHint(`Body limit reached (${count}) — delete something to spawn more.`);
  }

  onSelection(entities = []) {
    const [first] = entities;
    if (!entities.length) this.nodes.selection.textContent = 'No selection';
    else if (entities.length === 1) this.nodes.selection.textContent = first?.label ?? 'Object';
    else this.nodes.selection.textContent = `${entities.length} objects`;
  }

  onChallengeStatus(status) {
    const banner = this.nodes.challenge;
    if (!banner || !status) return;
    banner.classList.remove('hidden');
    const done = status.goals.filter((g) => g.done).length;
    $('#cb-index').textContent = `${status.index + 1} / 15`;
    $('#cb-name').textContent = status.name;
    $('#cb-objective').textContent = status.objective;
    const fill = $('#cb-bar-fill');
    if (fill) fill.style.width = `${Math.round(clamp(status.progress ?? 0, 0, 1) * 100)}%`;
    $('#cb-status').textContent = status.finished
      ? (status.failed ? `Failed — ${status.failReason ?? 'try again'}` : `Complete · ${status.stars}★ · ${status.time.toFixed(1)}s (par ${status.par}s)`)
      : `${done}/${status.goals.length} goals · ${status.time.toFixed(1)}s`;
    $('#cb-next')?.classList.toggle('hidden', !(status.finished && !status.failed));
  }

  onArenaScore(status) {
    const board = this.nodes.arena;
    if (!board || !status) return;
    $('#arena-destroyed').textContent = String(status.destroyed);
    $('#arena-impact').textContent = String(status.maxImpact);
    $('#arena-launched').textContent = String(status.launched);
    $('#arena-chain').textContent = String(status.chain);
    $('#arena-score').textContent = String(status.score);
  }

  /* ---------------------------------------------------------------- controls */

  setActiveTool(id) {
    for (const [toolId, button] of this.toolButtons ?? []) {
      button.classList.toggle('active', toolId === id);
    }
  }

  setSpeedChip(speed) {
    for (const chip of this.speedChips ?? []) {
      chip.classList.toggle('active', Math.abs(Number(chip.dataset.speed) - speed) < 0.01);
    }
    const slider = $('#speed-slider');
    if (slider && document.activeElement !== slider) slider.value = String(speed);
  }

  setMode(mode) {
    const names = { sandbox: 'Free Sandbox', challenge: 'Challenge Mode', build: 'Build Mode', arena: 'Destruction Arena' };
    if (this.nodes.mode) this.nodes.mode.textContent = names[mode] ?? mode;
    if (this.nodes.modeBadge) this.nodes.modeBadge.textContent = names[mode] ?? mode;
    this.nodes.challenge?.classList.toggle('hidden', mode !== 'challenge');
    this.nodes.arena?.classList.toggle('hidden', mode !== 'arena');
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.nodes.pauseOverlay?.classList.toggle('hidden', !paused);
    if (this.nodes.sim) {
      this.nodes.sim.textContent = paused ? 'Paused' : 'Running';
      this.nodes.sim.classList.toggle('paused', paused);
    }
  }

  setHint(text) {
    if (this.nodes.hint) this.nodes.hint.textContent = text || '';
  }

  showToolTip(text) {
    const node = this.nodes.toolTip;
    if (!node) return;
    if (!text) {
      node.classList.add('hidden');
      return;
    }
    node.textContent = text;
    node.classList.remove('hidden');
    clearTimeout(this._tipTimer);
    this._tipTimer = setTimeout(() => node.classList.add('hidden'), 5200);
  }

  showControlHint(force = false) {
    if (!force) {
      if (this.ctx.settings?.get('showHints') === false) return;
      if (this.ctx.store?.read?.('sticklab.helpSeen.v1', false)) return;
    }
    show(this.nodes.controlHint);
  }

  flashLibrary() {
    this.ctx.library?.flash?.();
  }

  /** True when the pointer is over a HUD panel, so tools ignore that click. */
  isOverUi() {
    if (document.body.classList.contains('modal-open')) return true;
    const node = document.elementFromPoint(this.pointer.x, this.pointer.y);
    if (!node) return false;
    return Boolean(node.closest(UI_SELECTOR));
  }

  destroy() {
    for (const off of this.unsubs) off?.();
    this.unsubs = [];
    clearTimeout(this._tipTimer);
  }
}
