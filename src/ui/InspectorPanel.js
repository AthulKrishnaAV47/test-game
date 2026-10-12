/**
 * InspectorPanel — live property editor for the current selection, plus the
 * world/simulation panel underneath.
 *
 * Only properties that actually mean something for the selected object are
 * shown (see `propSchema.getEditableProps`), and every edit is applied through
 * the spawner so it goes to the real Matter body, then wrapped in an undo entry.
 */

import { $, el, clear, hide, show } from './dom.js';
import {
  section, sliderRow, toggleRow, selectRow, colorRow, readout, updateReadout, buttonRow, card,
} from './widgets.js';
import { getEditableProps } from '../config/propSchema.js';
import { GRAVITY_PRESETS, LIMITS, QUALITY_PRESETS, SPEED_PRESETS, RAGDOLL_PRESETS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';

const fmt = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '—');

export class InspectorPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.empty = $('#inspector-empty');
    this.content = $('#inspector-content');
    this.worldBody = $('#world-body');
    this.readouts = new Map();
    this.controls = [];
    this.entity = null;
    this.buildWorldPanel();
    this.refresh();
  }

  /* -------------------------------------------------------------- selection */

  refresh() {
    const selection = this.ctx.selection?.list?.() ?? [];
    const entity = selection[0] ?? null;
    this.entity = entity;
    if (!entity) {
      show(this.empty);
      hide(this.content);
      clear(this.content);
      return;
    }
    hide(this.empty);
    show(this.content);
    if (this.buildFor(entity, selection.length)) return;
  }

  /** Rebuild controls when the selection identity changed. */
  buildFor(entity, count) {
    const key = `${entity.id}:${count}`;
    if (this.builtKey === key) {
      this.updateReadouts();
      return false;
    }
    this.builtKey = key;
    clear(this.content);
    this.controls = [];

    const def = entity.def;
    const isStatic = Boolean(entity.body?.isStatic);
    const header = el('div', { class: 'insp-title' }, [
      el('span', { class: 'swatch', style: { background: entity.color } }),
      el('div', {}, [
        el('strong', { text: count > 1 ? `${count} objects selected` : entity.label ?? def?.name ?? entity.type }),
        el('small', { text: count > 1 ? 'multiple selection' : `${def?.category ?? 'object'} · ${entity.kind ?? 'prop'}` }),
      ]),
    ]);
    this.content.append(header);

    const live = el('div', { class: 'readout' });
    this.readouts.set('live', live);
    this.content.append(section('Readouts', [live]));

    const schema = getEditableProps(def, { static: isStatic }) ?? [];
    const groups = new Map();
    for (const entry of schema) {
      const group = entry.group ?? 'Physics';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(entry);
    }

    for (const [group, entries] of groups) {
      const nodes = [];
      for (const entry of entries) nodes.push(this.controlFor(entity, entry));
      this.content.append(section(group, nodes));
    }

    if (entity.kind === 'ragdoll') this.content.append(this.ragdollSection(entity));

    this.content.append(section('Actions', [
      buttonRow([
        { label: 'Duplicate', className: 'ghost', title: 'Duplicate selection (Ctrl+D)', onClick: () => this.duplicate() },
        { label: 'Rotate −15°', className: 'ghost', onClick: () => this.rotate(-Math.PI / 12) },
        { label: 'Rotate +15°', className: 'ghost', onClick: () => this.rotate(Math.PI / 12) },
        { label: 'Reset props', className: 'ghost', onClick: () => this.resetProps() },
        { label: 'Delete', className: 'danger', title: 'Delete (Del)', onClick: () => this.deleteSelection() },
      ]),
    ]));

    if (entity.behavior === 'fuseBomb') {
      this.content.append(section('Detonation', [
        buttonRow([{ label: 'Light fuse', className: 'accent', onClick: () => entity.lightFuse?.() }]),
      ]));
    }
    if (entity.behavior === 'cannon') {
      this.content.append(section('Cannon', [
        buttonRow([
          { label: 'Fire', className: 'accent', onClick: () => { entity.fired = false; entity.fireCannon?.(); } },
          { label: 'Rearm', className: 'ghost', onClick: () => { entity.fired = false; } },
        ]),
      ]));
    }

    return true;
  }

  /* ---------------------------------------------------------------- controls */

  controlFor(entity, entry) {
    const current = this.readProp(entity, entry.key);
    const commit = (value) => this.apply(entity, entry.key, value);
    let widget;
    switch (entry.type) {
      case 'toggle':
        widget = toggleRow(entry.label, Boolean(current), (value) => commit(value));
        break;
      case 'select':
        widget = selectRow(entry.label, current, entry.options ?? [], (value) => {
          const option = (entry.options ?? []).find((o) => String(o.value) === String(value));
          commit(option ? option.value : value);
        });
        break;
      case 'color':
        widget = colorRow(entry.label, current ?? entity.color, (value) => commit(value));
        break;
      case 'number':
        widget = sliderRow({
          label: entry.label,
          min: entry.min ?? 0,
          max: entry.max ?? 100,
          step: entry.step ?? 1,
          value: Number(current) || Number(entry.min) || 0,
          onInput: (value) => commit(value),
        }).node;
        break;
      case 'text':
        widget = el('label', { class: 'world-row' }, [
          el('span', { text: entry.label }),
          el('input', { type: 'text', value: current ?? '', maxlength: '32', onchange: (event) => commit(event.target.value) }),
        ]);
        break;
      default:
        widget = sliderRow({
          label: entry.label,
          min: entry.min ?? 0,
          max: entry.max ?? 1,
          step: entry.step ?? 0.01,
          decimals: entry.decimals,
          value: Number(current ?? 0),
          unit: entry.degrees ? '°' : '',
          onInput: (value) => commit(entry.degrees ? (value * Math.PI) / 180 : value),
        }).node;
        break;
    }
    this.controls.push({ key: entry.key, widget });
    return widget;
  }

  /** Current value for an editable prop, read from props/body as appropriate. */
  readProp(entity, key) {
    const body = entity.body;
    switch (key) {
      case 'density': return entity.props.density ?? body?.density ?? 0.001;
      case 'friction': return entity.props.friction ?? body?.friction ?? 0.5;
      case 'restitution': return entity.props.restitution ?? body?.restitution ?? 0.2;
      case 'static': case 'locked': return Boolean(body?.isStatic ?? entity.props.locked);
      case 'angle': return body?.angle ?? 0;
      case 'color': return entity.color;
      case 'scale': return entity.props.scale ?? 1;
      case 'hp': return entity.hp ?? entity.props.hp ?? entity.def?.destructible?.hp ?? 100;
      case 'affectedByGravity': return entity.props.affectedByGravity !== false;
      default: return entity.props[key] ?? entity.props.behavior?.[key];
    }
  }

  apply(entity, key, value) {
    const before = this.readProp(entity, key);
    const converted = key === 'angle' && typeof value === 'number' ? value : value;
    const ok = this.ctx.spawner.applyProp(entity, key, converted);
    if (ok === false) {
      this.ctx.toast?.('warn', 'Cannot change that', `${key} is fixed for this object.`);
      return;
    }
    this.ctx.undo?.recordProp(entity, key, before, converted);
    this.ctx.sfx?.uiClick?.();
    this.updateReadouts();
  }

  /* ---------------------------------------------------------------- sections */

  ragdollSection(entity) {
    const presets = Object.values(RAGDOLL_PRESETS);
    const node = selectRow(
      'Preset',
      entity.presetId,
      presets.map((p) => ({ value: p.id, label: p.name })),
      (value) => {
        this.ctx.character?.setPreset?.(value);
        this.builtKey = null;
        this.refresh();
      }
    );
    const active = this.ctx.character?.active === entity;
    return section('Character', [
      node,
      buttonRow([
        { label: active ? 'Active character' : 'Control this ragdoll', className: active ? 'ghost' : 'primary', onClick: () => this.ctx.character?.setActive(entity) },
        { label: 'Ragdoll it', className: 'ghost', title: 'Release joints and let it flop', onClick: () => this.ctx.character?.setControlEnabled?.(false) },
        { label: 'Launch', className: 'accent', onClick: () => entity.launch?.(0, -12) },
      ]),
    ]);
  }

  /* ------------------------------------------------------------------ actions */

  duplicate() {
    const list = this.ctx.selection.list();
    for (const entity of list) this.ctx.spawner.duplicate(entity, { x: 46, y: -34 });
    if (list.length) this.ctx.toast?.('success', 'Duplicated', `${list.length} object(s) copied.`);
  }

  rotate(delta) {
    for (const entity of this.ctx.selection.list()) {
      if (entity.locked) continue;
      const before = entity.angle;
      this.ctx.spawner.rotate(entity, before + delta);
      this.ctx.undo?.recordProp(entity, 'angle', before, before + delta);
    }
    this.updateReadouts();
  }

  resetProps() {
    for (const entity of this.ctx.selection.list()) {
      const defaults = this.ctx.spawner.buildProps(entity.def, {});
      for (const [key, value] of Object.entries(defaults)) {
        this.ctx.spawner.applyProp(entity, key, value);
      }
      entity.hp = entity.maxHp ?? entity.def?.destructible?.hp;
    }
    this.builtKey = null;
    this.refresh();
    this.ctx.toast?.('info', 'Properties reset', 'The object is back to its catalogue defaults.');
  }

  deleteSelection() {
    const removed = this.ctx.selection.deleteSelected();
    if (removed) this.ctx.sfx?.whoosh?.(0.4);
  }

  /* --------------------------------------------------------------- world UI */

  buildWorldPanel() {
    if (!this.worldBody) return;
    clear(this.worldBody);
    const world = this.ctx.world;

    const presetOptions = GRAVITY_PRESETS.map((p) => ({ value: p.id, label: p.name }));
    this.worldBody.append(
      card('Gravity', [
        selectRow('Preset', world.gravityPresetId, presetOptions, (id) => {
          world.setGravityPreset(id);
          this.ctx.ui?.syncWorldPanel?.();
        }),
        toggleRow('Gravity enabled', world.gravityEnabled, (on) => world.setGravityEnabled(on)),
        readout([
          { label: 'Vector', value: `${world.gravityPreset().x.toFixed(1)}, ${world.gravityPreset().y.toFixed(1)}` },
          { label: 'Strength', value: `${world.gravityPreset().scale.toFixed(2)}×` },
        ]),
      ]),
      card('Simulation', [
        sliderRow({
          label: 'Speed',
          min: 0.1, max: 3, step: 0.05, value: this.ctx.phys.speed, decimals: 2, unit: '×',
          onInput: (value) => this.ctx.ui?.setSpeed?.(value),
        }).node,
        buttonRow(SPEED_PRESETS.map((preset) => ({
          label: `${preset}×`,
          className: Math.abs(this.ctx.phys.speed - preset) < 0.01 ? 'primary' : 'ghost',
          onClick: () => this.ctx.ui?.setSpeed?.(preset),
        }))),
        readout([
          { label: 'Bodies', value: `${this.ctx.phys.bodyCount()} / ${LIMITS.MAX_BODIES}` },
          { label: 'Sim time', value: `${this.ctx.phys.simTime.toFixed(1)} s` },
        ]),
      ]),
      card('Editing', [
        toggleRow('Grid visible', this.ctx.settings.get('showGrid'), (on) => this.ctx.ui?.setGridVisible?.(on)),
        toggleRow('Snap to grid', this.ctx.settings.get('snapToGrid'), (on) => this.ctx.settings.set('snapToGrid', on)),
        sliderRow({
          label: 'Grid size', min: 10, max: 200, step: 5, value: this.ctx.settings.get('gridSize'), decimals: 0, unit: 'px',
          onInput: (value) => this.ctx.settings.set('gridSize', value),
        }).node,
      ]),
      card('Scene', [
        buttonRow([
          { label: 'Clear objects', className: 'ghost', onClick: () => this.ctx.ui?.clearScene?.() },
          { label: 'Reset scene', className: 'ghost', onClick: () => world.reset() },
          { label: 'Remove ragdolls', className: 'ghost', onClick: () => this.ctx.ui?.removeRagdolls?.() },
        ]),
      ])
    );
  }

  /* ---------------------------------------------------------------- updates */

  updateReadouts() {
    const entity = this.entity;
    if (!entity || entity.removed) {
      this.builtKey = null;
      this.refresh();
      return;
    }
    const body = entity.body;
    const speed = entity.speed?.() ?? 0;
    const mass = entity.getBodies().reduce((sum, b) => sum + (b.isStatic ? 0 : b.mass), 0);
    const entries = [
      { label: 'Mass', value: `${mass.toFixed(2)}` },
      { label: 'Velocity', value: `${fmt(speed, 1)} px/s` },
      { label: 'Angular', value: `${fmt((body?.angularVelocity ?? 0) * 60, 1)} °/s` },
      { label: 'Position', value: `${entity.position.x.toFixed(0)}, ${entity.position.y.toFixed(0)}` },
    ];
    if (entity.def?.destructible) {
      entries.push({ label: 'Durability', value: `${Math.max(0, Math.round(entity.hp ?? 0))} / ${entity.maxHp ?? entity.def.destructible.hp}` });
    }
    entries.push({ label: 'Bodies', value: `${entity.getBodies().length}` });
    if (this.ctx.character?.active === entity) entries.push({ label: 'Character', value: 'active' });
    const node = this.readouts.get('live');
    if (node) updateReadout(node, entries);
  }

  /** Cheap per-frame update (readouts only, no DOM rebuilds). */
  tick() {
    if (!this.entity) return;
    this.updateReadouts();
    for (const control of this.controls) {
      const widget = control.widget;
      if (widget?.set && control.key !== 'density') {
        const value = this.readProp(this.entity, control.key);
        if (typeof value === 'number') widget.set(value);
      }
    }
  }
}
