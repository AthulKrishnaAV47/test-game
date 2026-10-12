/**
 * InputManager — keyboard, mouse and touch plumbing.
 *
 *  - maps physical keys to actions through the user's key bindings,
 *  - never steals keys while the player is typing in a form field,
 *  - forwards pointer gestures to the active tool (left button) while the
 *    camera owns right-drag panning and the wheel,
 *  - suppresses browser shortcuts (Ctrl+S, Backspace navigation…) only while
 *    the game canvas is the active surface.
 */

import { CAMERA } from '../config/gameConfig.js';
import { screenToWorld } from '../utils/coordinateUtils.js';
import { bus } from '../utils/events.js';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export class InputManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.settings = ctx.settings;
    this.keys = new Map();          // code -> Set<action>
    this.pressed = new Set();       // currently held codes
    this.pointer = {
      down: false,
      button: 0,
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      downScreen: { x: 0, y: 0 },
      dragged: false,
      downWorld: { x: 0, y: 0 },
      pointerType: 'mouse',
    };
    this.cameraPan = { active: false, x: 0, y: 0 };
    this.handlers = { keydown: [], keyup: [] };
    this.rebuildKeymap();
  }

  rebuildKeymap() {
    this.keys.clear();
    const bindings = this.settings?.get('keybindings') ?? {};
    for (const [action, codes] of Object.entries(bindings)) {
      for (const code of codes) {
        if (!this.keys.has(code)) this.keys.set(code, new Set());
        this.keys.get(code).add(action);
      }
    }
  }

  start() {
    this._onKeyDown = (event) => this.handleKeyDown(event);
    this._onKeyUp = (event) => this.handleKeyUp(event);
    this._onBlur = () => {
      this.pressed.clear();
      this.cameraPan.active = false;
      this.ctx.character?.clearInput();
    };
    this._onContextMenu = (event) => {
      if (this.isGameSurface(event.target)) event.preventDefault();
    };
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('contextmenu', this._onContextMenu);

    const input = this.scene.input;
    this._onPointerDown = (pointer) => this.handlePointerDown(pointer);
    this._onPointerMove = (pointer) => this.handlePointerMove(pointer);
    this._onPointerUp = (pointer) => this.handlePointerUp(pointer);
    this._onWheel = (pointer, over, dx, dy) => this.handleWheel(pointer, dy);
    input.on('pointerdown', this._onPointerDown);
    input.on('pointermove', this._onPointerMove);
    input.on('pointerup', this._onPointerUp);
    input.on('pointerupoutside', this._onPointerUp);
    input.on('wheel', this._onWheel);
  }

  isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    if (TYPING_TAGS.has(el.tagName)) return true;
    return el.isContentEditable === true;
  }

  isGameSurface(target) {
    return target instanceof HTMLCanvasElement || target === document.body;
  }

  on(eventName, handler) {
    (this.handlers[eventName] ??= []).push(handler);
    return () => {
      const list = this.handlers[eventName];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    };
  }

  emit(eventName, payload) {
    for (const handler of this.handlers[eventName] ?? []) handler(payload);
  }

  handleKeyDown(event) {
    if (this.isTyping()) return; // let the player type in inputs
    const actions = this.keys.get(event.code);
    const isGameSurface = this.isGameSurface(event.target);
    if (actions?.size && isGameSurface) {
      const blockable = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab', 'Slash'];
      if (blockable.includes(event.code)) event.preventDefault();
      for (const action of actions) {
        if (event.repeat && action !== 'moveLeft' && action !== 'moveRight') continue;
        this.emit('action', { action, event, repeat: event.repeat });
      }
    }
    // Ctrl+S / Cmd+S must save the layout, not the page.
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS' && isGameSurface) {
      event.preventDefault();
      this.emit('action', { action: 'save', event, repeat: false });
    }
    if (event.key === 'Escape' && isGameSurface) this.emit('escape', { event });
    this.pressed.add(event.code);
    bus.emit('input:key', { code: event.code, down: true });
  }

  handleKeyUp(event) {
    this.pressed.delete(event.code);
    bus.emit('input:key', { code: event.code, down: false });
  }

  /** Update movement flags from held keys (called once per frame). */
  updateMovement() {
    const held = (action) => {
      const codes = this.settings?.get('keybindings')?.[action] ?? [];
      return codes.some((code) => this.pressed.has(code));
    };
    if (this.isTyping()) {
      this.ctx.character?.clearInput();
      return;
    }
    this.ctx.character?.setInput({
      left: held('moveLeft'),
      right: held('moveRight'),
      jump: held('jump'),
    });

    // Camera panning with the arrow keys while holding Alt (tools-free pan).
    const alt = this.pressed.has('AltLeft') || this.pressed.has('AltRight');
    let px = 0;
    let py = 0;
    if (alt) {
      if (this.pressed.has('ArrowLeft')) px -= 1;
      if (this.pressed.has('ArrowRight')) px += 1;
      if (this.pressed.has('ArrowUp')) py -= 1;
      if (this.pressed.has('ArrowDown')) py += 1;
    }
    this.cameraPan = { active: px !== 0 || py !== 0, x: px, y: py };
  }

  updatePointerWorld(pointer) {
    const cam = this.scene.cameras.main;
    this.pointer.screen = { x: pointer.x, y: pointer.y };
    this.pointer.world = screenToWorld(cam, pointer.x, pointer.y);
    this.pointer.pointerType = pointer.pointerType ?? 'mouse';
  }

  handlePointerDown(pointer) {
    this.updatePointerWorld(pointer);
    this.pointer.down = true;
    this.pointer.button = pointer.button ?? (pointer.rightButtonDown() ? 2 : 0);
    this.pointer.downScreen = { ...this.pointer.screen };
    this.pointer.downWorld = { ...this.pointer.world };
    this.pointer.dragged = false;
    if (this.pointer.button === 2 || pointer.middleButtonDown?.()) {
      this.ctx.tools?.cancel();
      return;
    }
    if (this.ctx.ui?.isOverUi?.()) return;
    this.ctx.tools?.onPointerDown(this.pointer.world, pointer, this.pointer);
  }

  handlePointerMove(pointer) {
    const prev = { ...this.pointer.screen };
    this.updatePointerWorld(pointer);
    const dx = this.pointer.screen.x - prev.x;
    const dy = this.pointer.screen.y - prev.y;
    if (this.pointer.down && (this.pointer.button === 2 || pointer.isDown && pointer.rightButtonDown())) {
      this.ctx.camera?.pan(-dx, -dy);
      return;
    }
    if (this.pointer.down) {
      const moved = Math.hypot(
        this.pointer.screen.x - this.pointer.downScreen.x,
        this.pointer.screen.y - this.pointer.downScreen.y
      );
      if (moved > 4) this.pointer.dragged = true;
      this.ctx.tools?.onPointerMove(this.pointer.world, pointer, this.pointer);
    } else {
      this.ctx.tools?.onPointerHover(this.pointer.world, pointer);
    }
  }

  handlePointerUp(pointer) {
    this.updatePointerWorld(pointer);
    const wasDown = this.pointer.down;
    this.pointer.down = false;
    if (!wasDown) return;
    if (this.pointer.button === 2) return;
    this.ctx.tools?.onPointerUp(this.pointer.world, pointer, this.pointer);
  }

  handleWheel(pointer, dy) {
    if (this.ctx.ui?.isOverUi?.()) return;
    const factor = 1 - dy * CAMERA.wheelSensitivity;
    this.ctx.camera?.zoomBy(factor, pointer.x, pointer.y);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('contextmenu', this._onContextMenu);
    const input = this.scene?.input;
    if (input) {
      input.off('pointerdown', this._onPointerDown);
      input.off('pointermove', this._onPointerMove);
      input.off('pointerup', this._onPointerUp);
      input.off('pointerupoutside', this._onPointerUp);
      input.off('wheel', this._onWheel);
    }
    this.handlers = { keydown: [], keyup: [] };
    this.pressed.clear();
  }
}
