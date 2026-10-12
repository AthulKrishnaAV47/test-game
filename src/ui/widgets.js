/**
 * widgets.js — reusable UI building blocks for the panels and modals.
 *
 * Every widget returns a DOM node and a tiny API, so panels only describe
 * *what* to show while the widget handles input plumbing (ranges, toggles,
 * colour swatches, stars, progress bars…).
 */

import { el, icon } from './dom.js';
import { clamp } from '../utils/mathUtils.js';

export function section(title, children = []) {
  return el('div', { class: 'insp-section' }, [title ? el('h4', { text: title }) : null, ...[].concat(children)]);
}

export function card(title, children = [], { className = '' } = {}) {
  return el('div', { class: `card ${className}`.trim() }, [
    title ? el('h5', { text: title }) : null,
    ...[].concat(children),
  ]);
}

/** Read-only label/value grid used for live physics readouts. */
export function readout(entries = []) {
  const node = el('div', { class: 'readout' });
  for (const entry of entries) {
    node.append(el('span', { text: entry.label }), el('b', { text: entry.value }));
  }
  return node;
}

export function updateReadout(node, entries = []) {
  while (node.firstChild) node.firstChild.remove();
  for (const entry of entries) {
    node.append(el('span', { text: entry.label }), el('b', { text: entry.value }));
  }
  return node;
}

/**
 * Slider + numeric field.
 * @returns {{node: HTMLElement, set:(value:number)=>void}}
 */
export function sliderRow({ label, min, max, step = 0.01, value = 0, decimals = null, unit = '', onInput }) {
  const decimalsFor = decimals ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 4);
  const range = el('input', { type: 'range', min, max, step, value });
  const number = el('input', { type: 'number', min, max, step, value });
  const head = el('div', { class: 'row-head' }, [
    el('label', { text: label }),
    el('span', { class: 'muted', text: unit ? `${Number(value).toFixed(decimalsFor)} ${unit}` : Number(value).toFixed(decimalsFor) }),
  ]);
  const node = el('div', { class: 'slider-row' }, [head, range, number]);

  const push = (raw, source) => {
    let next = clamp(Number(raw), Number(min), Number(max));
    if (!Number.isFinite(next)) next = Number(value);
    if (source !== 'range') range.value = String(next);
    if (source !== 'number') number.value = String(Number(next.toFixed(decimalsFor)));
    head.lastElementChild.textContent = unit
      ? `${next.toFixed(decimalsFor)} ${unit}`
      : next.toFixed(decimalsFor);
    onInput?.(next);
  };
  range.addEventListener('input', () => push(range.value, 'range'));
  number.addEventListener('change', () => push(number.value, 'number'));
  number.addEventListener('input', () => push(number.value, 'number'));

  return {
    node,
    set: (next, silent = true) => {
      const v = clamp(Number(next), Number(min), Number(max));
      range.value = String(v);
      number.value = String(Number(v.toFixed(decimalsFor)));
      head.lastElementChild.textContent = unit ? `${v.toFixed(decimalsFor)} ${unit}` : v.toFixed(decimalsFor);
      if (!silent) onInput?.(v);
    },
  };
}

export function toggleRow(label, value = false, onChange, { hint = '' } = {}) {
  const input = el('input', { type: 'checkbox', checked: value });
  const node = el('label', { class: 'world-row', title: hint }, [
    el('span', { text: label }),
    el('span', { class: 'switch' }, [input, el('span')]),
  ]);
  input.addEventListener('change', () => onChange?.(input.checked));
  node.input = input;
  node.set = (next) => {
    input.checked = Boolean(next);
  };
  return node;
}

export function selectRow(label, value, options = [], onChange) {
  const select = el('select');
  for (const option of options) {
    select.append(el('option', { value: String(option.value), text: option.label, selected: String(option.value) === String(value) }));
  }
  select.addEventListener('change', () => onChange?.(select.value));
  const node = el('label', { class: 'world-row' }, [el('span', { text: label }), select]);
  node.select = select;
  node.set = (next) => {
    select.value = String(next);
  };
  return node;
}

export function colorRow(label, value = '#ffffff', onInput) {
  const picker = el('input', { type: 'color', value });
  picker.addEventListener('input', () => onInput?.(picker.value));
  const node = el('label', { class: 'world-row' }, [el('span', { text: label }), picker]);
  node.input = picker;
  node.set = (next) => {
    picker.value = next;
  };
  return node;
}

/** Round colour swatches (used in the character studio). */
export function swatchRow(colors, active, onPick, { isLocked = () => false, titleOf = (c) => c.name } = {}) {
  const node = el('div', { class: 'swatch-row' });
  for (const color of colors) {
    const locked = isLocked(color);
    const button = el('button', {
      class: `swatch-pick ${color.id === active ? 'active' : ''} ${locked ? 'locked' : ''}`.trim(),
      type: 'button',
      title: locked ? `${titleOf(color)} — locked` : titleOf(color),
      style: { background: color.value ?? color.css ?? '#888' },
      onclick: () => {
        if (locked) return;
        onPick?.(color);
      },
    });
    node.append(button);
  }
  return node;
}

export function starRow(count = 0, total = 3) {
  const node = el('div', { class: 'stars' });
  for (let i = 0; i < total; i += 1) {
    node.append(el('span', { class: i < count ? 'on' : 'off', html: icon('star-filled') }));
  }
  return node;
}

export function progressBar(value = 0, { label = '' } = {}) {
  const fill = el('span', { style: { width: `${clamp(value * 100, 0, 100)}%` } });
  const bar = el('div', { class: 'cb-bar' }, [fill]);
  const node = el('div', { class: 'cb-progress' }, [bar, label ? el('span', { class: 'muted', text: label }) : null]);
  node.set = (next, text) => {
    fill.style.width = `${clamp(next * 100, 0, 100)}%`;
    if (text !== undefined && node.lastElementChild) node.lastElementChild.textContent = text;
  };
  return node;
}

export function buttonRow(buttons = []) {
  return el('div', { class: 'btn-row' }, buttons.map((b) =>
    el('button', {
      class: `btn small ${b.className ?? ''}`.trim(),
      type: 'button',
      text: b.label,
      title: b.title ?? '',
      onclick: b.onClick,
    })
  ));
}

export function iconButton(name, { title = '', className = '', onClick = null } = {}) {
  return el('button', {
    class: `btn small ${className}`.trim(),
    type: 'button',
    title,
    'data-icon': name,
    onclick: onClick,
  });
}

/** Small key-cap list for the help modal. */
export function keyList(entries = []) {
  const list = el('ul', { class: 'keylist' });
  for (const entry of entries) {
    const keys = [].concat(entry.keys ?? []).map((key) => el('kbd', { text: key }));
    list.append(el('li', {}, [el('span', {}, keys), el('span', { text: entry.label })]));
  }
  return list;
}

export function emptyState(iconName, title, hint) {
  return el('div', { class: 'empty-state' }, [
    el('span', { class: 'empty-icon', html: icon(iconName) }),
    el('p', { text: title }),
    hint ? el('small', { text: hint }) : null,
  ]);
}
