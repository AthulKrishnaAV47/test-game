/**
 * MenuScreen — the main menu overlay.
 *
 * Shows the nine menu entries, a small progress summary and the "click anywhere
 * to enable sound" hint that browsers require before audio may play.
 */

import { $, $$, show, hide, applyIcons } from './dom.js';
import { icon } from './icons.js';
import { services } from '../core/services.js';
import { challengeCount } from '../config/challenges.js';
import { ACHIEVEMENTS } from '../config/achievements.js';

export class MenuScreen {
  constructor(ui) {
    this.ui = ui;
    this.root = $('#menu-screen');
    this.statsNode = $('#menu-stats');
    this.actions = {
      sandbox: () => ui.startMode('sandbox'),
      challenge: () => ui.openChallengeSelect(),
      build: () => ui.startMode('build'),
      arena: () => ui.startMode('arena'),
      levels: () => ui.openLevelSelect(),
      character: () => ui.openCharacterStudio(),
      achievements: () => ui.openAchievements(),
      settings: () => ui.openSettings(),
      help: () => ui.openHelp(),
    };
    this.bind();
  }

  bind() {
    for (const button of $$('.menu-btn[data-action]')) {
      button.addEventListener('click', () => {
        services.unlockAudio();
        this.actions[button.dataset.action]?.();
      });
    }
    this.root?.addEventListener('pointerdown', () => services.unlockAudio(), { once: true });
    applyIcons(this.root ?? document);
  }

  show() {
    show(this.root);
    hide($('#hud'));
    this.refreshStats();
    applyIcons(this.root);
  }

  hide() {
    hide(this.root);
    show($('#hud'));
  }

  refreshStats() {
    if (!this.statsNode) return;
    const stats = services.stats;
    const unlocked = ACHIEVEMENTS.filter((a) => services.achievements.isUnlocked(a.id)).length;
    const stars = stats.totalStars?.() ?? 0;
    const completed = stats.get('challengesCompleted', 0) ?? 0;
    this.statsNode.textContent = `${unlocked}/${ACHIEVEMENTS.length} achievements · ${completed}/${challengeCount()} challenges · ${stars}★ · ${stats.get('objectsSpawned', 0)} objects spawned`;
  }

  /** Small badge rendered on the menu buttons (e.g. locked content). */
  static iconFor(name) {
    return icon(name);
  }
}
