/**
 * modals.js — every full-screen dialog the game needs.
 *
 * Settings, How to Play, Achievements, Character Studio, Level Select,
 * Challenge Select and the save/load library. All of them are built from the
 * same primitives (`openModal`, widgets) so they behave consistently: Esc or a
 * click outside dismisses them, and no dialog ever keeps a listener alive after
 * it closes.
 */

import {
  $, el, clear, openModal, confirmDialog, promptDialog, toast, applyIcons, screenFlash,
} from './dom.js';
import {
  section, card, sliderRow, toggleRow, selectRow, starRow, keyList, buttonRow, swatchRow, emptyState,
} from './widgets.js';
import { levelPreviewCanvas, drawDefPreview } from './previews.js';
import { LEVELS, getLevel } from '../config/levels.js';
import { CHALLENGES, challengeCount } from '../config/challenges.js';
import { ACHIEVEMENT_MAP } from '../config/achievements.js';
import {
  QUALITY_PRESETS, RAGDOLL_ACCESSORIES, RAGDOLL_COLORS, RAGDOLL_PRESETS, GRAVITY_PRESETS,
} from '../config/gameConfig.js';
import { icon } from './icons.js';

/* ----------------------------------------------------------------- settings */

export function openSettings(ui) {
  const { settings, sfx, world } = ui.ctx;
  const body = [];
  const live = (key, value) => {
    settings.set(key, value);
    ui.applySettings();
  };

  body.push(el('h4', { text: 'Audio' }));
  body.push(sliderRow({
    label: 'Master volume', min: 0, max: 1, step: 0.02, value: settings.get('masterVolume'),
    onInput: (v) => live('masterVolume', v),
  }).node);
  body.push(sliderRow({
    label: 'Music', min: 0, max: 1, step: 0.02, value: settings.get('musicVolume'),
    onInput: (v) => live('musicVolume', v),
  }).node);
  body.push(sliderRow({
    label: 'Sound effects', min: 0, max: 1, step: 0.02, value: settings.get('sfxVolume'),
    onInput: (v) => live('sfxVolume', v),
  }).node);
  body.push(toggleRow('Music enabled', settings.get('musicEnabled'), (v) => {
    live('musicEnabled', v);
    if (!v) sfx?.stopMusic?.();
  }));
  body.push(toggleRow('Sound effects enabled', settings.get('sfxEnabled'), (v) => live('sfxEnabled', v)));

  body.push(el('h4', { text: 'Video & performance' }));
  body.push(selectRow('Quality', settings.get('quality'), Object.keys(QUALITY_PRESETS).map((key) => ({
    value: key, label: key[0].toUpperCase() + key.slice(1),
  })), (value) => {
    live('quality', value);
    ui.ctx.phys?.applyQuality?.(value);
  }));
  body.push(toggleRow('Particles & effects', settings.get('particles'), (v) => live('particles', v)));
  body.push(toggleRow('Screen shake', settings.get('screenShake'), (v) => live('screenShake', v)));
  body.push(toggleRow('Motion trails', settings.get('motionTrails'), (v) => live('motionTrails', v)));
  body.push(toggleRow('Show FPS counter', settings.get('showFps'), (v) => live('showFps', v)));
  body.push(toggleRow('Touch controls', settings.get('touchControls') === 'on' || settings.get('touchControls') === 'auto', (v) => live('touchControls', v ? 'auto' : 'off'), { hint: 'Show on-screen buttons on tablets' }));

  body.push(el('h4', { text: 'Gameplay' }));
  body.push(toggleRow('Show grid by default', settings.get('showGrid'), (v) => {
    live('showGrid', v);
    ui.setGridVisible(v);
  }));
  body.push(toggleRow('Snap to grid', settings.get('snapToGrid'), (v) => live('snapToGrid', v)));
  body.push(sliderRow({
    label: 'Grid size', min: 10, max: 200, step: 5, decimals: 0, unit: 'px',
    value: settings.get('gridSize'), onInput: (v) => live('gridSize', v),
  }).node);
  body.push(toggleRow('Confirm destructive actions', settings.get('confirmDestructive'), (v) => live('confirmDestructive', v)));
  body.push(toggleRow('Hints & tips', settings.get('showHints'), (v) => live('showHints', v)));

  body.push(el('h4', { text: 'Controls' }));
  body.push(el('p', { class: 'muted', text: 'Click a key to rebind it. Bindings are stored locally.' }));
  const bindingRows = el('div', { class: 'grid-2' });
  for (const [action, codes] of Object.entries(settings.get('keybindings') ?? {})) {
    const button = el('button', {
      class: 'btn small wide',
      type: 'button',
      text: codes.join(' / ').replace(/^Key/, '').replace(/^Arrow/, ''),
      title: 'Click, then press the new key',
      onclick: () => {
        button.textContent = 'Press a key…';
        const handler = (event) => {
          event.preventDefault();
          window.removeEventListener('keydown', handler, true);
          settings.bind(action, [event.code]);
          ui.applySettings();
          button.textContent = event.code.replace(/^Key/, '').replace(/^Arrow/, '');
        };
        window.addEventListener('keydown', handler, true);
      },
    });
    bindingRows.append(el('label', { class: 'world-row' }, [el('span', { text: action }), button]));
  }
  body.push(bindingRows);

  body.push(el('h4', { text: 'Data' }));
  body.push(buttonRow([
    { label: 'Reset key bindings', className: 'ghost', onClick: () => { settings.resetBindings(); ui.applySettings(); ui.openSettings(); } },
    { label: 'Reset all settings', className: 'ghost', onClick: async () => { if (await confirmDialog({ title: 'Reset settings?', message: 'Volumes, bindings and quality go back to their defaults.', danger: true, confirmLabel: 'Reset' })) { settings.resetAll(); ui.applySettings(); ui.openSettings(); toast({ type: 'success', title: 'Settings reset' }); } } },
    { label: 'Erase progress', className: 'danger', onClick: async () => { if (await confirmDialog({ title: 'Erase progress?', message: 'Achievements, stars and saves stored in this browser are deleted.', danger: true, confirmLabel: 'Erase everything' })) { ui.ctx.stats?.reset(); ui.ctx.achievements?.refresh?.(); ui.ctx.save?.clearAll?.(); toast({ type: 'warn', title: 'Progress erased' }); } } },
  ]));

  if (world) {
    body.push(el('h4', { text: 'Gravity preset' }));
    body.push(selectRow('Preset', world.gravityPresetId, GRAVITY_PRESETS.map((p) => ({ value: p.id, label: p.name })), (id) => world.setGravityPreset(id)));
  }

  openModal({ title: 'Settings', body, onClose: () => applyIcons(document) });
}

/* --------------------------------------------------------------- how to play */

export function openHelp(ui) {
  const { settings } = ui.ctx;
  const bindings = settings?.get('keybindings') ?? {};
  const keys = (action) => (bindings[action] ?? []).map((code) => code.replace(/^Key/, '').replace(/^Arrow/, ''));

  const body = [
    el('div', { class: 'help-cols' }, [
      card('Movement & camera', [
        keyList([
          { keys: [...keys('moveLeft'), ...keys('moveRight')], label: 'Walk the active ragdoll' },
          { keys: keys('jump'), label: 'Jump' },
          { keys: ['Wheel'], label: 'Zoom (clamped 0.35× – 2.2×)' },
          { keys: ['Right-drag'], label: 'Pan the camera' },
          { keys: ['Alt', '←/→↑/↓'], label: 'Pan with the keyboard' },
        ]),
      ]),
      card('Interaction', [
        keyList([
          { keys: ['Left-click'], label: 'Select / use the active tool' },
          { keys: ['Left-drag'], label: 'Grab & throw (Grab tool) or marquee select' },
          { keys: ['Shift', 'click'], label: 'Add to selection' },
          { keys: [...keys('deleteSelection')], label: 'Delete selection' },
          { keys: ['Ctrl', 'D'], label: 'Duplicate selection' },
        ]),
      ]),
      card('Simulation', [
        keyList([
          { keys: keys('pause'), label: 'Pause / resume' },
          { keys: ['.'], label: 'Step exactly one frame' },
          { keys: keys('reset'), label: 'Reset experiment' },
          { keys: keys('gravity'), label: 'Toggle gravity' },
          { keys: keys('undo'), label: 'Undo' },
          { keys: keys('redo'), label: 'Redo' },
          { keys: ['Ctrl', keys('save')[0] ?? 'S'], label: 'Save layout' },
        ]),
      ]),
      card('Tools (1 – 0)', [
        keyList([
          { keys: ['1'], label: 'Select — click objects, drag for a box' },
          { keys: ['2'], label: 'Grab — spring-follow and throw' },
          { keys: ['3'], label: 'Move — reposition objects' },
          { keys: ['4'], label: 'Spawn Ragdoll — drops at the cursor' },
          { keys: ['5'], label: 'Spawn Object — pick in the library first' },
          { keys: ['6'], label: 'Apply Force — drag an arrow, release to push' },
          { keys: ['7'], label: 'Explosion — click to detonate' },
          { keys: ['8'], label: 'Rope / Joint — click two things to link them' },
          { keys: ['9'], label: 'Eraser — click to delete' },
          { keys: ['0'], label: 'Draw Platform — drag an area' },
        ]),
      ]),
    ]),
    el('div', { class: 'help-cols' }, [
      card('Free Sandbox', [el('p', { text: 'Every object and control is unlocked. Experiment freely — undo, save layouts and bend gravity.' })]),
      card('Challenge Mode', [el('p', { text: '15 physics puzzles. The banner shows the objective; complete every goal for up to three stars.' })]),
      card('Build Mode', [el('p', { text: 'Snap-friendly construction. Test your build with physics on, then return to the editor — the design is preserved.' })]),
      card('Destruction Arena', [el('p', { text: 'Score points for destroyed objects, big impacts, launched ragdolls and explosion chains.' })]),
    ]),
    card('Tips', [
      el('ul', { class: 'keylist' }, [
        el('li', {}, [el('span', { text: 'Ragdolls are real physics — drive them with A/D, then grab a limb to throw them.' })]),
        el('li', {}, [el('span', { text: 'Explosions only push bodies inside the radius, and they can be chained.' })]),
        el('li', {}, [el('span', { text: 'Select two objects and use the Rope tool to link them with an adjustable length.' })]),
        el('li', {}, [el('span', { text: 'Pause, then step one frame at a time to study a tricky collision.' })]),
      ]),
    ]),
  ];

  openModal({ title: 'How to Play', body, actions: [{ label: 'Got it', className: 'primary', onClick: () => {} }] });
}

/* ------------------------------------------------------------- achievements */

export function openAchievements(ui) {
  const { achievements, stats } = ui.ctx;
  const list = achievements?.list?.() ?? [];
  const grid = el('div', { class: 'grid-2' });

  for (const entry of list) {
    const progress = entry.target ? Math.min(1, entry.value / entry.target) : 0;
    const node = el('div', { class: `card ach-card ${entry.unlocked ? 'unlocked' : 'locked'}`.trim() }, [
      el('div', { class: 'ach-icon', html: icon(entry.icon ?? 'medal') }),
      el('div', {}, [
        el('h5', { text: entry.name }),
        el('p', { text: entry.description }),
        entry.reward ? el('span', { class: 'tag', text: `Reward: ${entry.reward}` }) : null,
        el('div', { class: 'ach-progress' }, [el('span', { style: { width: `${Math.round(progress * 100)}%` } })]),
        el('small', { class: 'muted', text: entry.unlocked ? 'Unlocked' : `${Math.min(entry.value, entry.target)} / ${entry.target}` }),
      ]),
    ]);
    grid.append(node);
  }

  const total = list.length;
  const unlocked = list.filter((entry) => entry.unlocked).length;
  openModal({
    title: `Achievements — ${unlocked} / ${total}`,
    body: [
      el('p', { class: 'muted', text: 'Progress is stored in this browser only. No accounts, no ads, nothing to buy.' }),
      grid,
      el('h4', { text: 'Progress' }),
      el('p', { class: 'muted', text: `Challenges completed: ${stats?.get('challengesCompleted', 0) ?? 0} / ${challengeCount()} · Stars: ${stats?.totalStars?.() ?? 0} / ${challengeCount() * 3}` }),
      el('p', { class: 'muted', text: `Objects spawned: ${stats?.get('objectsSpawned', 0) ?? 0} · Explosions: ${stats?.get('explosions', 0) ?? 0} · Best arena score: ${stats?.get('arenaBestScore', 0) ?? 0}` }),
    ],
  });
}

/* ---------------------------------------------------------- character studio */

export function openCharacterStudio(ui) {
  const { settings, achievements, character } = ui.ctx;
  const cosmetic = { ...(settings.get('cosmetics') ?? {}) };
  const preview = el('canvas', { width: '220', height: '260' });
  const previewWrap = el('div', { class: 'studio-preview' }, [preview]);
  const available = (entry) => entry.unlocked || !entry.achievement || achievements?.isUnlocked?.(entry.achievement);
  const locked = (entry) => !available(entry);

  const controls = el('div', {});
  const body = el('div', { class: 'studio-grid' }, [previewWrap, controls]);
  const bodyNodes = [body];

  const refreshPreview = () => drawStickman(preview, cosmetic);

  const colorGroup = (key, list) => {
    const node = swatchRow(list, cosmetic[key], (entry) => {
      cosmetic[key] = entry.id;
      settings.set('cosmetics', cosmetic);
      character?.setCosmetic({ [key]: entry.value }, { applyToAll: false });
      refreshPreview();
      rebuild();
    }, { isLocked: locked, titleOf: (entry) => `${entry.name}${entry.achievement ? ` — unlock: ${ACHIEVEMENT_MAP[entry.achievement]?.name ?? entry.achievement}` : ''}` });
    return node;
  };

  const presets = selectRow('Ragdoll preset', settings.get('ragdollPreset'), Object.values(RAGDOLL_PRESETS).map((p) => ({
    value: p.id, label: p.name,
  })), (value) => {
    settings.set('ragdollPreset', value);
    ui.ctx.tools.options.ragdollPreset = value;
    toast({ type: 'info', title: 'Spawn preset', message: `${RAGDOLL_PRESETS[value].name} ragdolls` });
  });

  function rebuild() {
    clear(controls);
    controls.append(
      presets,
      section('Skin', [colorGroup('skin', RAGDOLL_COLORS.skin)]),
      section('Shirt', [colorGroup('shirt', RAGDOLL_COLORS.shirt)]),
      section('Trousers', [colorGroup('pants', RAGDOLL_COLORS.pants)]),
      section('Accessory', [
        el('div', { class: 'swatch-row' }, RAGDOLL_ACCESSORIES.map((entry) => el('button', {
          class: `btn small ${cosmetic.accessory === entry.id ? 'primary' : ''} ${locked(entry) ? 'ghost' : ''}`.trim(),
          type: 'button',
          title: entry.achievement ? `Unlock: ${ACHIEVEMENT_MAP[entry.achievement]?.name ?? entry.achievement}` : entry.name,
          text: entry.name,
          onclick: () => {
            if (locked(entry)) {
              toast({ type: 'warn', title: 'Locked accessory', message: `Unlock it with “${ACHIEVEMENT_MAP[entry.achievement]?.name ?? 'play'}”.` });
              return;
            }
            cosmetic.accessory = entry.id;
            settings.set('cosmetics', cosmetic);
            character?.setCosmetic({ accessory: entry.id });
            refreshPreview();
            rebuild();
          },
        }))),
      ]),
      section('Actions', [
        buttonRow([
          { label: 'Apply to all ragdolls', className: 'primary', onClick: () => { character?.setCosmetic(cosmetic, { applyToAll: true }); toast({ type: 'success', title: 'Look applied' }); } },
          { label: 'Spawn one now', className: 'ghost', onClick: () => ui.spawnRagdollAtCursor() },
        ]),
      ])
    );
  }

  rebuild();
  refreshPreview();
  openModal({ title: 'Character Studio', body: bodyNodes, onClose: () => applyIcons(document) });
}

/** Procedural stickman portrait for the character studio (no image assets). */
export function drawStickman(canvas, cosmetic = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#152244');
  gradient.addColorStop(1, '#0b1226');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const colourOf = (group, id, fallback) => RAGDOLL_COLORS[group]?.find((c) => c.id === id)?.value ?? fallback;
  const skin = cosmetic.skin ? colourOf('skin', cosmetic.skin, '#1d2333') : '#1d2333';
  const shirt = cosmetic.shirt ? colourOf('shirt', cosmetic.shirt, '#e0364a') : '#e0364a';
  const pants = cosmetic.pants ? colourOf('pants', cosmetic.pants, '#3b5bdb') : '#3b5bdb';

  const cx = w / 2;
  const headR = 22;
  const headY = 52;
  ctx.lineCap = 'round';
  ctx.strokeStyle = skin;
  ctx.lineWidth = 10;

  // torso + limbs
  ctx.beginPath();
  ctx.moveTo(cx, headY + headR);
  ctx.lineTo(cx, headY + headR + 60);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 40, headY + headR + 26);
  ctx.lineTo(cx + 40, headY + headR + 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, headY + headR + 60);
  ctx.lineTo(cx - 26, h - 26);
  ctx.moveTo(cx, headY + headR + 60);
  ctx.lineTo(cx + 26, h - 26);
  ctx.stroke();

  // shirt block
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.roundRect(cx - 26, headY + headR + 6, 52, 54, 10);
  ctx.fill();
  // trousers
  ctx.fillStyle = pants;
  ctx.beginPath();
  ctx.roundRect(cx - 30, headY + headR + 56, 60, 26, 8);
  ctx.fill();

  // head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // eyes + smile (expressions are part of the character)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 7, headY - 3, 4.4, 0, Math.PI * 2);
  ctx.arc(cx + 7, headY - 3, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#101a33';
  ctx.beginPath();
  ctx.arc(cx - 6.4, headY - 3, 2.1, 0, Math.PI * 2);
  ctx.arc(cx + 7.6, headY - 3, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, headY + 6, 7, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();

  drawStudioAccessory(ctx, cosmetic.accessory, cx, headY, headR, skin);
  return canvas;
}

function drawStudioAccessory(ctx, accessory, cx, headY, headR, skin) {
  ctx.lineWidth = 4;
  switch (accessory) {
    case 'cap':
      ctx.fillStyle = '#e0364a';
      ctx.beginPath();
      ctx.arc(cx, headY - 6, headR - 1, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx + 6, headY - 9, 26, 6);
      break;
    case 'helmet':
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath();
      ctx.arc(cx, headY - 4, headR + 2, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - headR - 4, headY - 6, (headR + 4) * 2, 6);
      break;
    case 'crown':
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(cx - 18, headY - headR + 4);
      ctx.lineTo(cx - 12, headY - headR - 14);
      ctx.lineTo(cx - 4, headY - headR + 2);
      ctx.lineTo(cx + 4, headY - headR - 14);
      ctx.lineTo(cx + 12, headY - headR + 2);
      ctx.lineTo(cx + 18, headY - headR - 10);
      ctx.lineTo(cx + 18, headY - headR + 6);
      ctx.lineTo(cx - 18, headY - headR + 6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'glasses':
      ctx.strokeStyle = '#101a33';
      ctx.beginPath();
      ctx.arc(cx - 7, headY - 3, 8, 0, Math.PI * 2);
      ctx.arc(cx + 7, headY - 3, 8, 0, Math.PI * 2);
      ctx.moveTo(cx - 1, headY - 3);
      ctx.lineTo(cx + 1, headY - 3);
      ctx.stroke();
      break;
    case 'visor':
      ctx.fillStyle = '#57c8ff';
      ctx.beginPath();
      ctx.roundRect(cx - 16, headY - 12, 32, 16, 6);
      ctx.fill();
      break;
    case 'antenna': {
      ctx.strokeStyle = skin;
      ctx.beginPath();
      ctx.moveTo(cx, headY - headR);
      ctx.lineTo(cx, headY - headR - 20);
      ctx.stroke();
      ctx.fillStyle = '#38e07b';
      ctx.beginPath();
      ctx.arc(cx, headY - headR - 24, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'halo':
      ctx.strokeStyle = '#ffe89a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, headY - headR - 10, 20, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------- levels */

export function openLevelSelect(ui, { onPick } = {}) {
  const grid = el('div', { class: 'grid-3' });
  const chosen = ui.ctx.settings.get('activeLevelId');
  for (const level of LEVELS) {
    const preview = el('div', { class: 'level-preview' }, [levelPreviewCanvas(level)]);
    const node = el('div', { class: `card level-card selectable ${level.id === chosen ? 'active' : ''}`.trim() }, [
      preview,
      el('h5', { text: level.name }),
      el('p', { class: 'muted', text: level.description }),
      el('span', { class: 'tag', text: `${level.gravity.scale}× gravity · ${level.ambient}` }),
      el('button', {
        class: 'btn primary small',
        type: 'button',
        text: 'Play here',
        onclick: () => {
          ui.ctx.settings.set('activeLevelId', level.id);
          ui.closeModal();
          onPick?.(level.id);
        },
      }),
    ]);
    grid.append(node);
  }
  openModal({ title: 'Level Select', body: [grid] });
}

export function openChallengeSelect(ui, { onPick } = {}) {
  const { stats } = ui.ctx;
  const grid = el('div', { class: 'challenge-grid' });
  for (const challenge of CHALLENGES) {
    const stars = stats?.get(`challenge:${challenge.id}`, 0) ?? 0;
    const node = el('div', { class: 'card challenge-card' }, [
      el('div', { class: 'cc-head' }, [
        el('span', { class: 'cc-index', text: `#${challenge.index + 1}` }),
        starRow(stars),
      ]),
      el('h5', { text: challenge.name }),
      el('p', { class: 'muted', text: challenge.objective }),
      el('button', {
        class: 'btn primary small',
        type: 'button',
        text: 'Start',
        onclick: () => {
          ui.closeModal();
          onPick?.(challenge.id);
        },
      }),
    ]);
    grid.append(node);
  }
  openModal({
    title: 'Challenge Mode',
    body: [
      el('p', { class: 'muted', text: 'Each puzzle has a prepared level, a clear objective and a par time. Earn up to three stars.' }),
      grid,
    ],
  });
}

/* -------------------------------------------------------------- save / load */

export function openSaveDialog(ui) {
  const { save, stats } = ui.ctx;
  const list = el('div', { class: 'grid-2' });
  const render = () => {
    clear(list);
    const entries = save.list();
    if (!entries.length) list.append(emptyState('folder', 'No saved layouts yet', 'Save the current scene to reuse it later.'));
    for (const entry of entries) {
      list.append(card(entry.name, [
        el('p', { class: 'muted', text: `${entry.objects ?? 0} objects · ${entry.constraints ?? 0} links · ${new Date(entry.savedAt ?? Date.now()).toLocaleString()}` }),
        buttonRow([
          { label: 'Overwrite', className: 'ghost', onClick: () => { save.save(entry.name, { id: entry.id, confirmOverwrite: true }); toast({ type: 'success', title: 'Layout saved', message: entry.name }); render(); } },
          { label: 'Delete', className: 'danger', onClick: () => { save.remove(entry.id); render(); } },
        ]),
      ]));
    }
  };
  render();

  openModal({
    title: 'Save / Load Layouts',
    body: [
      el('p', { class: 'muted', text: 'Layouts keep object transforms, physics properties, colours, joints and the gravity configuration.' }),
      buttonRow([
        { label: 'Save current scene', className: 'primary', onClick: async () => {
          const name = await promptDialog({
            title: 'Save layout', label: 'Name', value: `Layout ${save.list().length + 1}`, confirmLabel: 'Save',
            validate: (text) => (text.length ? null : 'Please enter a name.'),
          });
          if (!name) return;
          const existing = save.list().find((entry) => entry.name.toLowerCase() === name.toLowerCase());
          if (existing && ui.ctx.settings.get('confirmDestructive')) {
            const ok = await confirmDialog({ title: 'Overwrite layout?', message: `“${name}” already exists.`, confirmLabel: 'Overwrite', danger: true });
            if (!ok) return;
          }
          const record = save.save(name, { id: existing?.id ?? null, confirmOverwrite: true });
          if (record) {
            stats?.bump('layoutsSaved', 1);
            toast({ type: 'success', title: 'Layout saved', message: name });
            render();
          } else {
            toast({ type: 'error', title: 'Could not save', message: 'The layout could not be stored (storage full?).' });
          }
        } },
        { label: 'Export JSON', className: 'ghost', onClick: () => {
          const text = save.exportJSON();
          const blob = new Blob([text], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = el('a', { href: url, download: 'sticklab-layout.json' });
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast({ type: 'success', title: 'Exported', message: 'sticklab-layout.json' });
        } },
        { label: 'Import file…', className: 'ghost', onClick: () => pickFile(async (text) => {
          const result = save.importText(text, { apply: true });
          if (!result.ok) toast({ type: 'error', title: 'Import failed', message: result.message });
          else { toast({ type: 'success', title: 'Imported', message: `${result.objects} objects restored` }); render(); }
        }) },
      ]),
      list,
    ],
  });
}

export function openLoadDialog(ui) {
  const { save } = ui.ctx;
  const entries = save.list();
  const list = el('div', { class: 'grid-2' });
  if (!entries.length) list.append(emptyState('folder', 'Nothing saved yet', 'Use Save to store the current layout, or Import a JSON file.'));
  for (const entry of entries) {
    list.append(card(entry.name, [
      el('p', { class: 'muted', text: `${entry.objects ?? 0} objects · ${entry.constraints ?? 0} links` }),
      buttonRow([
        { label: 'Load', className: 'primary', onClick: () => {
          const result = save.load(entry.id);
          if (result?.ok === false) toast({ type: 'error', title: 'Load failed', message: result.message });
          else { ui.closeModal(); toast({ type: 'success', title: 'Layout loaded', message: entry.name }); }
        } },
        { label: 'Delete', className: 'danger', onClick: () => { save.remove(entry.id); ui.closeModal(); ui.openLoadDialog(); } },
      ]),
    ]));
  }
  openModal({
    title: 'Load Layout',
    body: [
      list,
      buttonRow([{ label: 'Import file…', className: 'ghost', onClick: () => pickFile((text) => {
        const result = save.importText(text, { apply: true });
        if (!result.ok) toast({ type: 'error', title: 'Import failed', message: result.message });
        else { ui.closeModal(); toast({ type: 'success', title: 'Imported', message: `${result.objects} objects restored` }); }
      }) }]),
    ],
  });
}

function pickFile(onLoad) {
  const input = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (file) {
      const text = await file.text();
      onLoad(text);
    }
    input.remove();
  });
  input.click();
}

/* ------------------------------------------------------------- misc dialogs */

export async function confirmClearScene(ui) {
  if (!ui.ctx.settings.get('confirmDestructive')) return true;
  return confirmDialog({
    title: 'Clear the scene?',
    message: 'Every object you placed is removed. Level scenery stays and Reset can restore the start state.',
    confirmLabel: 'Clear objects',
    danger: true,
  });
}

export function openModeWin(ui, { title, message, score, onNext }) {
  openModal({
    title,
    narrow: true,
    dismissible: false,
    body: [
      el('p', { text: message }),
      score !== undefined ? el('p', { class: 'muted', text: `Score: ${score}` }) : null,
    ],
    actions: [
      { label: 'Back to menu', className: 'ghost', onClick: () => ui.backToMenu() },
      onNext ? { label: 'Next challenge', className: 'primary', onClick: onNext } : { label: 'Continue', className: 'primary', onClick: () => {} },
    ],
  });
}

export { screenFlash };
