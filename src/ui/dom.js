/**
 * dom.js — small helpers shared by every UI module.
 *
 * Keeping DOM plumbing in one place makes the panels readable and guarantees
 * that listeners are removed again when a scene shuts down (no duplicate
 * handlers after repeated scene changes).
 */

import { applyIcons, icon } from './icons.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Create an element with attributes/children in one call. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  if (node) node.textContent = '';
  return node;
}

export function show(node) {
  node?.classList.remove('hidden');
  return node;
}

export function hide(node) {
  node?.classList.add('hidden');
  return node;
}

export function toggle(node, visible) {
  if (!node) return false;
  node.classList.toggle('hidden', !visible);
  return Boolean(visible);
}

export const isVisible = (node) => Boolean(node) && !node.classList.contains('hidden');

/** Icon span used inside dynamically built UI. */
export const iconEl = (name, cls = 'icon') => el('span', { class: cls, 'data-icon': name, html: icon(name) });

/** Toggle a button's pressed state. */
export function setActive(node, active) {
  node?.classList.toggle('active', Boolean(active));
}

/** Fire `handler` for every event in `list`, returning one unsubscribe(). */
export function listen(target, list, handler, options) {
  for (const type of [].concat(list)) target.addEventListener(type, handler, options);
  return () => {
    for (const type of [].concat(list)) target.removeEventListener(type, handler, options);
  };
}

/* ------------------------------------------------------------------- toasts */

const TOAST_LIFETIME = 3600;

export function toast({ type = 'info', title = '', message = '' } = {}) {
  const root = $('#toast-root');
  if (!root) return null;
  const node = el('div', { class: `toast ${type}` }, [
    el('strong', { text: title || '' }),
    message ? el('span', { text: message }) : null,
  ]);
  root.append(node);
  // Keep the stack short so old notifications never cover the HUD.
  while (root.children.length > 4) root.firstElementChild.remove();
  const remove = () => {
    node.classList.add('fade');
    setTimeout(() => node.remove(), 320);
  };
  const timer = setTimeout(remove, TOAST_LIFETIME);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
  return node;
}

/* ------------------------------------------------------------------ overlays */

export function setLoading(visible, text = 'Loading…') {
  const overlay = $('#loading-overlay');
  const label = $('#loading-text');
  if (label && text) label.textContent = text;
  if (overlay) overlay.classList.toggle('hidden', !visible);
}

export function screenFlash(strength = 0.25, colour = '#ffffff') {
  const node = $('#screen-flash');
  if (!node) return;
  node.style.background = colour;
  node.style.transition = 'none';
  node.style.opacity = String(Math.max(0, Math.min(1, strength)));
  requestAnimationFrame(() => {
    node.style.transition = 'opacity 0.28s ease';
    node.style.opacity = '0';
  });
}

export function lockScroll(locked) {
  document.body.classList.toggle('modal-open', Boolean(locked));
}

/* ---------------------------------------------------------------- modal API */

let modalStack = [];

/** Show a modal card. `options.onClose` runs after it is removed. */
export function openModal({ title, body, actions = [], narrow = false, className = '', onClose = null, dismissible = true }) {
  const root = $('#modal-root');
  if (!root) return { close() {} };
  root.classList.add('modal-root-inner');

  const cards = $$('.modal', root);
  for (const card of cards) card.classList.add('dimmed');

  const actionNodes = actions.map((action) =>
    el('button', {
      class: `btn ${action.className ?? ''}`.trim(),
      type: 'button',
      text: action.label,
      onclick: async () => {
        const result = await action.onClick?.();
        if (result === false) return;
        close();
      },
    })
  );

  const card = el('div', { class: `modal ${narrow ? 'narrow' : ''} ${className}`.trim() }, [
    dismissible
      ? el('button', { class: 'btn ghost small modal-close', type: 'button', 'data-icon': 'close', title: 'Close', onclick: () => close() })
      : null,
    title ? el('h3', { text: title }) : null,
    ...([].concat(body ?? [])),
    actionNodes.length ? el('div', { class: 'modal-actions' }, actionNodes) : null,
  ]);

  const overlay = el('div', { class: 'overlay', style: { zIndex: '85' } }, [card]);
  root.append(overlay);
  applyIcons(card);
  modalStack.push(overlay);
  lockScroll(true);

  if (dismissible) {
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close();
    });
  }

  function close() {
    if (!overlay.isConnected) return;
    overlay.remove();
    modalStack = modalStack.filter((entry) => entry !== overlay);
    const remaining = $$('.modal', root);
    if (remaining.length === 1) remaining[0].classList.remove('dimmed');
    if (!modalStack.length) lockScroll(false);
    onClose?.();
  }

  return { close, card };
}

/** Promise-based confirmation dialog (used before destructive actions). */
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      narrow: true,
      body: [el('p', { class: 'muted', text: message })],
      actions: [
        { label: cancelLabel, className: 'ghost', onClick: () => resolve(false) },
        { label: confirmLabel, className: danger ? 'danger' : 'primary', onClick: () => resolve(true) },
      ],
      onClose: () => resolve(false),
    });
    void close;
  });
}

/** Promise-based text prompt (save names, teleporter links, …). */
export function promptDialog({
  title = 'Enter a value',
  label = '',
  value = '',
  placeholder = '',
  confirmLabel = 'Save',
  validate = null,
} = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', value, placeholder, maxlength: '48' });
    const error = el('span', { class: 'status-item warn hidden' });
    const submit = () => {
      const text = input.value.trim();
      const problem = validate?.(text);
      if (problem) {
        error.textContent = problem;
        error.classList.remove('hidden');
        input.focus();
        return false;
      }
      resolve(text);
      return true;
    };
    const { close } = openModal({
      title,
      narrow: true,
      body: [
        label ? el('label', { class: 'field-label', text: label }) : null,
        input,
        error,
      ],
      actions: [
        { label: 'Cancel', className: 'ghost', onClick: () => resolve(null) },
        { label: confirmLabel, className: 'primary', onClick: submit },
      ],
      onClose: () => resolve(null),
    });
    void close;
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });
    setTimeout(() => input.focus(), 30);
  });
}

export function closeTopModal() {
  const top = modalStack[modalStack.length - 1];
  if (!top) return false;
  top.remove();
  modalStack.pop();
  if (!modalStack.length) lockScroll(false);
  return true;
}

export const hasModal = () => modalStack.length > 0;

export function clearModals() {
  for (const overlay of modalStack) overlay.remove();
  modalStack = [];
  lockScroll(false);
  const root = $('#modal-root');
  if (root) for (const card of $$('.modal', root)) card.classList.remove('dimmed');
}

export { applyIcons, icon };
