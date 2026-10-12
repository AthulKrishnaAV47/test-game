/**
 * LibraryPanel — the object library (categories, search, previews, favourites,
 * recents) plus the spawn action.
 *
 * The panel never spawns silently: picking a card selects the object for the
 * spawn tool, and the Spawn button (or a double click) places one in front of
 * the camera, which keeps "no accidental spawns while dragging" true.
 */

import { $, el, clear, applyIcons, toast } from './dom.js';
import { drawDefPreview } from './previews.js';
import {
  OBJECT_CATEGORIES, OBJECT_LIST, OBJECT_DEFS, getDef, searchDefs, ragdollDefs, isRagdollDef,
} from '../config/objectCatalog.js';
import { MATERIALS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';

const MAX_RECENTS = 8;

export class LibraryPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.settings = ctx.settings;
    this.root = $('#library-panel');
    this.body = $('#library-body');
    this.tabs = $('#library-tabs');
    this.search = $('#object-search');
    this.detail = $('#library-detail');
    this.ldName = $('#ld-name');
    this.ldMeta = $('#ld-meta');
    this.ldPreview = $('#ld-preview');
    this.favButton = $('#ld-fav');
    this.spawnButton = $('#ld-spawn');

    this.category = 'all';
    this.query = '';
    this.selectedId = this.favorites[0] ?? 'crate';
    this.cards = new Map();

    this.buildTabs();
    this.bind();
    this.render();
    this.select(this.selectedId, { silent: true });
  }

  get favorites() {
    const list = this.settings?.get('favorites') ?? [];
    return Array.isArray(list) ? list.filter((id) => OBJECT_DEFS[id]) : [];
  }

  get recents() {
    const list = this.settings?.get('recents') ?? [];
    return Array.isArray(list) ? list.filter((id) => OBJECT_DEFS[id]) : [];
  }

  /* ------------------------------------------------------------------- setup */

  buildTabs() {
    clear(this.tabs);
    const tabs = [
      { id: 'all', name: 'All', icon: 'box' },
      { id: 'favourites', name: 'Favourites', icon: 'star' },
      { id: 'recents', name: 'Recent', icon: 'clock' },
      ...OBJECT_CATEGORIES,
    ];
    for (const tab of tabs) {
      const button = el('button', {
        type: 'button',
        text: tab.name,
        class: tab.id === this.category ? 'active' : '',
        onclick: () => {
          this.category = tab.id;
          for (const child of this.tabs.children) child.classList.toggle('active', child === button);
          this.render();
        },
      });
      this.tabs.append(button);
    }
  }

  bind() {
    this.search?.addEventListener('input', () => {
      this.query = this.search.value;
      this.render();
    });
    this.spawnButton?.addEventListener('click', () => this.spawnSelected());
    this.favButton?.addEventListener('click', () => this.toggleFavorite(this.selectedId));
  }

  /* ------------------------------------------------------------------ render */

  listForCategory() {
    if (this.category === 'favourites') {
      return this.favorites.map((id) => OBJECT_DEFS[id]).filter(Boolean);
    }
    if (this.category === 'recents') return this.recents.map((id) => OBJECT_DEFS[id]).filter(Boolean);
    if (this.category === 'all') return searchDefs(this.query);
    const base = this.query ? searchDefs(this.query) : OBJECT_LIST;
    if (this.category === 'characters') return ragdollDefs().filter((d) => base.includes(d));
    return base.filter((d) => d.category === this.category);
  }

  render() {
    const list = this.listForCategory();
    clear(this.body);
    this.cards.clear();

    if (!list.length) {
      this.body.append(el('div', { class: 'lib-empty', text: this.category === 'favourites'
        ? 'No favourites yet — tap the star on an object.'
        : this.category === 'recents'
          ? 'Nothing spawned yet.'
          : 'No objects match that search.' }));
      return;
    }

    for (const def of list) {
      const card = el('div', {
        class: `lib-item ${def.id === this.selectedId ? 'active' : ''}`.trim(),
        title: def.description ?? def.name,
        onclick: () => this.select(def.id),
        ondblclick: () => this.spawnSelected(),
      });
      const swatch = el('div', { class: 'lib-swatch' });
      const canvas = el('canvas', { width: '32', height: '32' });
      swatch.append(canvas);
      card.append(swatch, el('div', { class: 'lib-meta' }, [
        el('strong', { text: def.name }),
        el('span', { text: this.metaLine(def) }),
      ]));
      this.body.append(card);
      this.cards.set(def.id, card);
      drawDefPreview(canvas, def, { size: 32, padding: 0.16 });
    }
  }

  metaLine(def) {
    const mat = MATERIALS[def.material];
    const bits = [];
    if (isRagdollDef(def)) bits.push('character');
    else if (def.defaultStatic) bits.push('static');
    else bits.push(mat ? mat.sound : 'object');
    if (def.destructible) bits.push(`hp ${def.destructible.hp}`);
    if (def.behavior) bits.push(def.behavior);
    return bits.join(' · ');
  }

  /* --------------------------------------------------------------- selection */

  select(id, { silent = false } = {}) {
    if (!OBJECT_DEFS[id]) return;
    this.selectedId = id;
    for (const [cardId, card] of this.cards) card.classList.toggle('active', cardId === id);
    const def = getDef(id);
    if (this.ldName) this.ldName.textContent = def.name;
    if (this.ldMeta) {
      const mat = MATERIALS[def.material];
      this.ldMeta.textContent = def.description ?? (mat ? `${mat.sound} object` : '');
    }
    if (this.ldPreview) {
      clear(this.ldPreview);
      const canvas = el('canvas', { width: '38', height: '38' });
      this.ldPreview.append(canvas);
      drawDefPreview(canvas, def, { size: 38, padding: 0.12 });
    }
    this.updateFavIcon();
    // The spawn tool follows the library, so clicking a card then the world works.
    this.ctx.tools?.setPendingObject(id);
    if (!silent) this.ctx.ui?.showToolTip?.(`${def.name} ready — click in the world to place it.`);
  }

  updateFavIcon() {
    if (!this.favButton) return;
    const isFav = this.favorites.includes(this.selectedId);
    this.favButton.setAttribute('data-icon', isFav ? 'star-filled' : 'star');
    this.favButton.innerHTML = '';
    delete this.favButton.dataset.iconApplied;
    applyIcons(this.favButton.parentElement ?? this.favButton);
    this.favButton.classList.toggle('active', isFav);
    this.favButton.title = isFav ? 'Remove from favourites' : 'Add to favourites';
  }

  toggleFavorite(id = this.selectedId) {
    if (!id) return;
    const favorites = this.favorites.slice();
    const index = favorites.indexOf(id);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.unshift(id);
    this.settings?.set('favorites', favorites.slice(0, 24));
    this.updateFavIcon();
    if (this.category === 'favourites') this.render();
    else {
      const card = this.cards.get(id);
      card?.classList.toggle('active', id === this.selectedId);
    }
    toast({ type: 'success', title: index >= 0 ? 'Removed from favourites' : 'Added to favourites', message: getDef(id)?.name });
  }

  remember(id) {
    const recents = [id, ...this.recents.filter((entry) => entry !== id)].slice(0, MAX_RECENTS);
    this.settings?.set('recents', recents);
    if (this.category === 'recents') this.render();
  }

  /* ------------------------------------------------------------------ spawn */

  /** Spawn the selected object in front of the camera (used by the Spawn button). */
  spawnSelected() {
    const id = this.selectedId;
    const def = getDef(id);
    if (!def) return null;
    const { camera, world, phys } = this.ctx;
    const cam = this.ctx.scene?.cameras?.main;
    const view = cam?.worldView;
    const x = view ? view.centerX : world.settings?.get('spawnX') ?? 600;
    const groundY = view ? view.y + view.height * 0.42 : 1800;
    const y = clamp(groundY, 60, 2200);
    this.remember(id);
    const entity = this.ctx.spawner.spawn(id, x, y, {});
    if (!entity) return null;
    this.ctx.selection?.select(entity);
    this.ctx.sfx?.spawn?.();
    this.ctx.stats?.bump('objectsSpawned', 1);
    void camera; void phys;
    return entity;
  }

  flash() {
    this.root?.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }],
      { duration: 220, iterations: 2 }
    );
  }
}
