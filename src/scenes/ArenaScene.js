/** ArenaScene — the same GameScene, locked to the Destruction Arena. */

import { GameScene } from './GameScene.js';

export class ArenaScene extends GameScene {
  constructor() {
    super('ArenaScene', 'arena');
  }
}
