/**
 * icons.js — the game's inline SVG icon set.
 *
 * Every icon is a 24×24 stroke drawing that inherits `currentColor`, so icons
 * stay crisp at any size and pick up the theme colours from CSS. They are
 * injected into `[data-icon]` placeholders so the HTML stays readable.
 */

const S = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  /* ------------------------------------------------------------- menu / mode */
  play: S('<path d="M8 5.5 19 12 8 18.5z" fill="currentColor" stroke-width="1.2"/>'),
  pause: S('<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>'),
  step: S('<path d="M7 5.5 16 12l-9 6.5z" fill="currentColor" stroke-width="1.2"/><rect x="17.4" y="5.5" width="2.6" height="13" rx="1.2" fill="currentColor" stroke="none"/>'),
  reset: S('<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4.5V10h5.5"/>'),
  trash: S('<path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7"/><path d="M6.5 7l1 12.1A1.9 1.9 0 0 0 9.4 21h5.2a1.9 1.9 0 0 0 1.9-1.9L17.5 7"/><path d="M10.4 11v6M13.6 11v6"/>'),
  gravity: S('<path d="M12 3v13"/><path d="M8 12.2 12 16.4l4-4.2"/><path d="M5 20h14"/>'),
  undo: S('<path d="M9 7H14.5a5 5 0 0 1 0 10H8"/><path d="M11.5 4 8.5 7l3 3"/>'),
  redo: S('<path d="M15 7H9.5a5 5 0 0 0 0 10H16"/><path d="M12.5 4l3 3-3 3"/>'),
  save: S('<path d="M5 4.5h11L19.5 8v11.5H5z"/><path d="M8.5 4.5v5h7v-5"/><rect x="8" y="13" width="8" height="6.5" rx="1"/>'),
  folder: S('<path d="M3.5 7.5h6l2-2.4h9v13.4h-17z"/>'),
  expand: S('<path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15"/>'),
  eye: S('<path d="M2.8 12S6.5 6.5 12 6.5 21.2 12 21.2 12 17.5 17.5 12 17.5 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  'eye-off': S('<path d="M4 4.5 20 20"/><path d="M9.6 6.9A9.6 9.6 0 0 1 12 6.5c5.5 0 9.2 5.5 9.2 5.5a17 17 0 0 1-3.1 3.5"/><path d="M6.4 8.7A17.6 17.6 0 0 0 2.8 12S6.5 17.5 12 17.5a9.8 9.8 0 0 0 3.3-.5"/>'),
  home: S('<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 10.4V19.5h11.6v-9.1"/><path d="M10.2 19.5v-4.8h3.6v4.8"/>'),
  trophy: S('<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.2v1.6A3.2 3.2 0 0 0 8 10.8M16 6h2.8v1.6a3.2 3.2 0 0 1-2.8 3.2"/><path d="M12 13.5V17M8.5 19.5h7l-.7-2.5h-5.6z"/>'),
  wrench: S('<path d="M14.8 4.6a4.4 4.4 0 0 0-3.2 6.9L5.4 17.7a1.9 1.9 0 0 0 0 2.7l-.7-.7a1.9 1.9 0 0 0 2.7 0l6.2-6.2a4.4 4.4 0 0 0 5.6-5.9l-2.6 2.6-2.3-.6-.6-2.3z"/>'),
  skull: S('<path d="M6 11.5A6 6 0 0 1 18 11.5v3.1l-1.6 1.2V19h-8.8v-3.2L6 14.6z"/><circle cx="9.6" cy="11.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.4" cy="11.6" r="1.5" fill="currentColor" stroke="none"/><path d="M12 15v2.4M10 15v1.6M14 15v1.6"/>'),
  map: S('<path d="M3.5 6.5 9 4.5l6 2 5.5-2v13L15 19.5l-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
  user: S('<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20a7.4 7.4 0 0 1 14.4 0"/>'),
  medal: S('<circle cx="12" cy="14.6" r="5"/><path d="M8.6 9.7 6.8 4h10.4l-1.8 5.7"/><path d="M12 12.4l.9 1.7 1.9.3-1.4 1.3.4 1.9-1.8-1-1.8 1 .4-1.9-1.4-1.3 1.9-.3z"/>'),
  cog: S('<circle cx="12" cy="12" r="3.1"/><path d="M12 3.6v2.2M12 18.2v2.2M4.9 7.9l1.9 1.1M17.2 15l1.9 1.1M4.9 16.1l1.9-1.1M17.2 9l1.9-1.1"/>'),
  question: S('<circle cx="12" cy="12" r="8.2"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6v.3"/><circle cx="12" cy="16.6" r=".9" fill="currentColor"/>'),

  /* ------------------------------------------------------------------ toolbar */
  cursor: S('<path d="M6 3.6 18.2 12.4l-5 .6 2.6 5.2-2.4 1.1-2.6-5.2-3.2 3.8z" fill="currentColor" stroke-width="1.2"/>'),
  grab: S('<path d="M9 11V5.9a1.6 1.6 0 0 1 3.2 0V11"/><path d="M12.2 11V4.9a1.6 1.6 0 0 1 3.2 0V11"/><path d="M15.4 11.4V7.6a1.6 1.6 0 0 1 3.2 0V14a6 6 0 0 1-6 6h-1.2a5.4 5.4 0 0 1-5.4-5.4V10a1.6 1.6 0 0 1 3.2 0"/>'),
  move: S('<path d="M12 3.5v17M6.5 6.5h-3v11h3M17.5 6.5h3v11h-3"/><path d="M12 3.5 9.6 6.1h4.8z" fill="currentColor"/><path d="M12 20.5l-2.4-2.6h4.8z" fill="currentColor"/>'),
  ragdoll: S('<circle cx="12" cy="4.6" r="2.3"/><path d="M12 7v6M12 9.4 7.6 12M12 9.4 16.4 12M12 13l-2.6 6M12 13l2.6 6"/>'),
  box: S('<path d="M12 3.6 19.6 7.6v8.8L12 20.4 4.4 16.4V7.6z"/><path d="M4.4 7.6 12 11.6l7.6-4M12 11.6v8.8"/>'),
  force: S('<path d="M4 19.6 19 5"/><path d="M19 5h-5.6M19 5v5.6"/><path d="M4 19.6 4 14M4 19.6l5.6 0"/>'),
  boom: S('<path d="M12 3.4l1.9 4.2 4.4-1.3-1.5 4.3 4.3 1.7-4 2.2 2.5 3.8-4.6-.6-.6 4.4-3-3.2-3 3.2-.6-4.4-4.6.6 2.5-3.8-4-2.2 4.3-1.7-1.5-4.3 4.4 1.3z"/>'),
  link: S('<path d="M10.4 13.6 13.6 10.4"/><path d="M8.6 15.4 7 17a3.4 3.4 0 0 1-4.8-4.8L3.8 10.6A3.4 3.4 0 0 1 8.2 7"/><path d="M15.4 8.6 17 7a3.4 3.4 0 0 1 4.8 4.8l-1.6 1.6a3.4 3.4 0 0 1-4.4 3.6"/>'),
  erase: S('<path d="M8.4 19.5H19.5"/><path d="M4.6 15.2 12 7.8l4.6 4.6-6.4 6.4a2 2 0 0 1-2.8 0l-2.8-2.8a2 2 0 0 1 0-2.8z"/><path d="M12 7.8 15.2 4.6a2 2 0 0 1 2.8 0l1.9 1.9a2 2 0 0 1 0 2.8L16.6 12.4"/>'),
  platform: S('<rect x="3.5" y="14" width="17" height="4.6" rx="2.3"/><path d="M8 8.5v3M16 6.5v5"/>'),

  /* --------------------------------------------------------------- interface */
  star: S('<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.9l5.4-.8z"/>'),
  'star-filled': S('<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.9l5.4-.8z" fill="currentColor"/>'),
  search: S('<circle cx="10.8" cy="10.8" r="6"/><path d="M15.2 15.2 20 20"/>'),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: S('<path d="M4.5 12.6 9.6 17.5 19.5 6.6"/>'),
  'chevron-down': S('<path d="M6 9.5 12 15.5l6-6"/>'),
  'chevron-left': S('<path d="M14.5 6 8.5 12l6 6"/>'),
  'chevron-right': S('<path d="M9.5 6l6 6-6 6"/>'),
  'chevron-up': S('<path d="M6 14.5 12 8.5l6 6"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  minus: S('<path d="M5 12h14"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5"/>'),
  unlock: S('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.4 10.5V8a3.6 3.6 0 0 1 7-1.5"/>'),
  copy: S('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
  rotate: S('<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4.5V10h-5.5"/>'),
  magnet: S('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 9h4M14 9h4"/>'),
  wind: S('<path d="M3.5 8.5h9a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3.5 13h13a2.6 2.6 0 1 1-2.6 2.6"/><path d="M3.5 17.5h5.2"/>'),
  snow: S('<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5"/>'),
  warn: S('<path d="M12 3.8 21 19.4H3z"/><path d="M12 9.4v4.4"/><circle cx="12" cy="16.6" r=".9" fill="currentColor"/>'),
  info: S('<circle cx="12" cy="12" r="8.2"/><path d="M12 11v5.4"/><circle cx="12" cy="8.2" r=".9" fill="currentColor"/>'),
  sparkle: S('<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  heart: S('<path d="M12 19.5S4.5 15 4.5 9.9A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7.5 2.3c0 5.1-7.5 9.6-7.5 9.6z"/>'),
  shield: S('<path d="M12 3.6 19 6v6.2c0 4.2-3 6.9-7 8.2-4-1.3-7-4-7-8.2V6z"/><path d="M9 12.2l2.2 2.3L15.4 10"/>'),
  palette: S('<path d="M12 3.8a8.2 8.2 0 0 0 0 16.4c1.4 0 2-.9 2-1.9s-.7-1.7-.7-2.5c0-1 .7-1.7 1.8-1.7h1.6A3.5 3.5 0 0 0 20.2 10C20.2 6.4 16.5 3.8 12 3.8z"/><circle cx="8.4" cy="9" r="1.1" fill="currentColor"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor"/><circle cx="15.4" cy="9.4" r="1.1" fill="currentColor"/>'),
  hat: S('<path d="M4 17.6h16"/><path d="M7.6 17.6c0-4.4 1.6-8.6 4.4-8.6s4.4 4.2 4.4 8.6"/><path d="M12 9V6.4"/>'),
  level: S('<path d="M3.6 17.8h16.8"/><path d="M6.6 17.8V12h4v5.8M13.4 17.8V8.4h4v9.4"/>'),
  camera: S('<rect x="3.6" y="7" width="16.8" height="12" rx="2.4"/><circle cx="12" cy="13" r="3.2"/><path d="M9 7l1.2-2.2h3.6L15 7"/>'),
  timer: S('<circle cx="12" cy="13.4" r="6.6"/><path d="M12 9.6v4l2.6 1.8M9.4 3.6h5.2"/>'),
  target: S('<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="3.4"/><path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4"/>'),
  ruler: S('<rect x="3.4" y="8.4" width="17.2" height="7.2" rx="1.8"/><path d="M7.6 8.4v2.6M11 8.4v3.4M14.4 8.4v2.6M17.6 8.4v3.4"/>'),
  door: S('<path d="M5.6 19.5V5.6a1 1 0 0 1 1-1h10.8a1 1 0 0 1 1 1v13.9"/><path d="M3.8 19.5h16.4"/><circle cx="14.6" cy="12.4" r="1" fill="currentColor"/>'),
  spring: S('<path d="M8 3.6h8M8 20.4h8"/><path d="M9.4 4.6c3.4 2-3.4 3.6 0 5.6s-3.4 3.6 0 5.6 0 3.4 0 4.4"/><path d="M4.6 12h2.8M16.6 12h2.8"/>'),
  chain: S('<rect x="3.4" y="9.4" width="8.4" height="5.2" rx="2.6"/><rect x="12.2" y="9.4" width="8.4" height="5.2" rx="2.6"/>'),
  stop: S('<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.2"/>'),
  clock: S('<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3.2 2.2"/>'),
  refresh: S('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.8h-4.8"/>'),
  rulerSnap: S('<path d="M4 4v16M4 4h16"/><rect x="9" y="9" width="10" height="10" rx="2"/>'),
  rocket: S('<path d="M12 3.4c3 1.6 4.6 4.8 4.6 8.4l-4.6 4.4-4.6-4.4c0-3.6 1.6-6.8 4.6-8.4z"/><circle cx="12" cy="10" r="1.7"/><path d="M9.4 16.2 7 20.4l3.4-1.2M14.6 16.2 17 20.4l-3.4-1.2"/>'),
  broken: S('<path d="M4.5 5h6l3 4h6M4.5 19h6l3-4h6"/><path d="M12 12h.5"/>'),
  wave: S('<path d="M3 12c1.8-4 3.4-4 5.2 0s3.4 4 5.2 0 3.4-4 5.2 0"/>'),
  pauseSmall: S('<rect x="7.4" y="6" width="3.2" height="12" rx="1"/><rect x="13.4" y="6" width="3.2" height="12" rx="1"/>'),
  logo: S('<circle cx="12" cy="4.8" r="2.6"/><path d="M12 7.6V13M12 9 7 11.6M12 9l5 2.6M12 13l-2.6 6.6M12 13l2.6 6.6"/>'),
};

/** Build an inline SVG string for an icon name. */
export function icon(name, size = null) {
  const body = ICONS[name] ?? ICONS.info;
  if (!size) return body;
  return body.replace('<svg ', `<svg width="${size}" height="${size}" `);
}

/** Replace every `[data-icon]` placeholder inside `root` with its SVG. */
export function applyIcons(root = document) {
  const nodes = root.querySelectorAll('[data-icon]');
  for (const node of nodes) {
    const name = node.getAttribute('data-icon');
    if (!name || node.dataset.iconApplied === name) continue;
    node.innerHTML = icon(name);
    node.dataset.iconApplied = name;
    if (!node.classList.contains('mi')) node.classList.add('icon');
  }
  return nodes.length;
}

export const ICON_NAMES = Object.keys(ICONS);
