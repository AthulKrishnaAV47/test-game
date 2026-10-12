/** ChallengeScene — the same GameScene, locked to Challenge Mode. */

import { GameScene } from './GameScene.js';

export class ChallengeScene extends GameScene {
  constructor() {
    super('ChallengeScene', 'challenge');
  }
}
