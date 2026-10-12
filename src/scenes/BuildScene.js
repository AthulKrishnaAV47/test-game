/** BuildScene — the same GameScene, locked to Build Mode (starts paused). */

import { GameScene } from './GameScene.js';

export class BuildScene extends GameScene {
  constructor() {
    super('BuildScene', 'build');
  }
}
