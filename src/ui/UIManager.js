/**
 * UIManager — one place that owns the DOM interface.
 *
 * Scenes call `ui.attach(ctx)` after building their world; from then on the HUD,
 * library and inspector talk to that context directly. Everything the game code
 * needs from the UI (tool highlight, hints, dialogs, speed, fullscreen…) is a
 * method here, which keeps gameplay code free of DOM details.
 */

import { $, toast, clearModals, setLoading, confirmDialog, hasModal, closeTopModal } from './dom.js';
import { HudUI } from './HudUI.js';
import { LibraryPanel } from './LibraryPanel.js';
import { InspectorPanel } from './InspectorPanel.js';
import { MenuScreen } from './MenuScreen.js';
import * as modals from './modals.js';
import { services } from '../core/services.js';
import { bus, EVENTS } from '../utils/events.js';
import { clamp } from '../utils/mathUtils.js';
import { LIMITS } from '../config/gameConfig.js';

export class UIManager {
  /**
   * @param {{go:(mode:string, opts?:object)=>void, back:()=>void}} host scene router
   */
  constructor(host) {
    this.host = host;
    this.ctx = null;
    this.hud = null;
    this.library = null;
    this.inspector = null;
    this.menu = new MenuScreen(this);
  }

  /* -------------------------------------------------------------- lifecycle */

  /** Attach to a running world context (called by the game scenes). */
  attach(ctx) {
    this.detach();
    this.ctx = ctx;
    ctx.ui = this;
    ctx.library = this.library = new LibraryPanel(ctx);
    ctx.inspector = this.inspector = new InspectorPanel(ctx);
    ctx.hud = this.hud = new HudUI(ctx, this);
    services.attachWorld(ctx);
    this.applySettings();
    this.menu.hide();
    this.hud.setMode(ctx.world?.mode ?? 'sandbox');
    this.hud.showControlHint();
    ctx.tools?.setTool(ctx.tools.active ?? 'select');
    return this;
  }

  /** Tear the DOM bindings down (keeps repeated scene changes leak-free). */
  detach() {
    this.hud?.destroy?.();
    this.hud = null;
    this.library = null;
    this.inspector = null;
    if (this.ctx) {
      this.ctx.ui = null;
      this.ctx.library = null;
      this.ctx.inspector = null;
      this.ctx.hud = null;
    }
    this.ctx = null;
    clearModals();
    services.detachWorld();
    this.showMenu(true);
  }

  showMenu(visible) {
    if (visible) this.menu.show();
    else this.menu.hide();
  }

  /* ----------------------------------------------------------------- dialogs */

  openSettings() { modals.openSettings(this); }
  openHelp() { modals.openHelp(this); }
  openAchievements() { modals.openAchievements(this); }
  openCharacterStudio() { modals.openCharacterStudio(this); }
  openLevelSelect() { modals.openLevelSelect(this, { onPick: (levelId) => this.startMode('sandbox', { levelId }) }); }
  openChallengeSelect() { modals.openChallengeSelect(this, { onPick: (challengeId) => this.startMode('challenge', { challengeId }) }); }
  openSaveDialog() { if (this.ctx) modals.openSaveDialog(this); }
  openLoadDialog() { if (this.ctx) modals.openLoadDialog(this); }
  closeModal() { closeTopModal(); }
  get hasModal() { return hasModal(); }

  /* -------------------------------------------------------------- mode entry */

  startMode(mode, options = {}) {
    services.unlockAudio();
    setLoading(true, 'Loading…');
    // Let the loader paint before the scene swap happens.
    setTimeout(() => {
      this.host.go(mode, options);
      setLoading(false);
    }, 120);
  }

  backToMenu() {
    this.host.back();
  }

  /* --------------------------------------------------------------- HUD moves */

  setSpeed(speed, { fromSlider = false } = {}) {
    if (!this.ctx) return;
    const value = clamp(Number(speed) || 1, 0.05, 3);
    this.ctx.phys.setSpeed(value);
    this.ctx.settings.set('simSpeed', value, { silent: true });
    this.hud?.setSpeedChip(value);
    const slider = $('#speed-slider');
    if (slider && !fromSlider) slider.value = String(value);
    if (!fromSlider) this.setHint(`Speed ${value}×`);
  }

  resetScene() {
    if (!this.ctx) return;
    this.ctx.world.reset();
    this.hud?.showToolTip('Scene reset');
  }

  async clearScene() {
    if (!this.ctx) return;
    if (!(await modals.confirmClearScene(this))) return;
    this.ctx.world.clearAll({ silent: false });
  }

  removeRagdolls() {
    if (!this.ctx) return;
    const ragdolls = [...this.ctx.phys.entities].filter((e) => e.kind === 'ragdoll');
    for (const ragdoll of ragdolls) this.ctx.spawner.remove(ragdoll, { reason: 'menu', silent: true, keepUndo: true });
    this.ctx.character.clear();
    this.ctx.selection.clear();
    toast({ type: 'info', title: 'Characters removed', message: `${ragdolls.length} ragdoll(s) deleted.` });
  }

  spawnRagdollAtCursor() {
    if (!this.ctx) return null;
    const cam = this.ctx.scene?.cameras?.main;
    const view = cam?.worldView;
    const x = view ? view.centerX : 800;
    const y = view ? view.centerY : 1200;
    const preset = this.ctx.tools?.options?.ragdollPreset ?? this.ctx.settings.get('ragdollPreset');
    const ragdoll = this.ctx.spawner.spawnRagdoll(preset, x, y - 120, {});
    if (ragdoll) this.ctx.selection.select(ragdoll);
    return ragdoll;
  }

  toggleCleanHud() {
    const on = document.body.classList.toggle('clean-hud');
    this.ctx?.settings.set('cleanHud', on, { silent: true });
    this.setHint(on ? 'Clean view enabled — press H to bring the panels back' : 'Panels visible');
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      toast({ type: 'warn', title: 'Fullscreen unavailable', message: String(err?.message ?? err) });
    }
  }

  setGridVisible(visible) {
    if (!this.ctx) return;
    this.ctx.settings.set('showGrid', visible);
    this.ctx.renderer?.setGridEnabled(visible);
    this.syncWorldPanel();
  }

  setHint(text) {
    this.hud?.setHint(text);
  }

  showToolTip(text) {
    this.hud?.showToolTip(text);
  }

  flashLibrary() {
    this.hud?.flashLibrary();
  }

  isOverUi() {
    return this.hud?.isOverUi?.() ?? false;
  }

  /* ----------------------------------------------------------------- updates */

  applySettings() {
    const settings = services.settings;
    document.body.classList.toggle('clean-hud', Boolean(settings.get('cleanHud')));
    const fps = $('#fps-value');
    if (fps) fps.style.opacity = settings.get('showFps') ? '1' : '0';
    this.ctx?.renderer?.setGridEnabled?.(settings.get('showGrid'));
    this.ctx?.phys?.applyQuality?.(settings.get('quality'));
    this.ctx?.tools && (this.ctx.tools.options.snap = settings.get('snapToGrid'));
    if (this.ctx?.tools) this.ctx.tools.options.ragdollPreset = settings.get('ragdollPreset');
    services.applySettings();
  }

  /** Refresh the world panel widgets after a gravity/grid change. */
  syncWorldPanel() {
    this.inspector?.buildWorldPanel?.();
  }

  tick(dt) {
    this.hud?.tick?.(dt);
    this.inspector?.tick?.();
  }

  /** Warn (once) when the body budget is getting tight. */
  checkBudget() {
    if (!this.ctx) return;
    const count = this.ctx.phys.bodyCount();
    if (count >= LIMITS.HARD_MAX_BODIES) {
      toast({ type: 'error', title: 'Body limit', message: `The scene is at ${LIMITS.HARD_MAX_BODIES} bodies. Delete something first.` });
      return false;
    }
    if (count > LIMITS.MAX_BODIES) {
      this.hud?.onCounts({ count });
    }
    return true;
  }

  /** Called when the player finishes a challenge or an arena run. */
  showWin({ title, message, score, onNext }) {
    modals.openModeWin(this, { title, message, score, onNext });
  }

  notify(type, title, message) {
    toast({ type, title, message });
    void bus;
    void EVENTS;
  }
}

export default UIManager;
