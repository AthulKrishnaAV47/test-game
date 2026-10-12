/**
 * Progression: achievement definitions and the cosmetic unlocks they grant.
 *
 * Achievements are driven by real gameplay events counted in `StatsManager`.
 * `track` is the counter key, `target` the count needed to unlock.
 */

export const ACHIEVEMENTS = [
  {
    id: 'first_ragdoll',
    name: 'First Ragdoll',
    description: 'Spawn your very first stickman and watch it flop.',
    icon: 'user',
    track: 'ragdollsSpawned',
    target: 1,
    reward: 'Teal shirt colour',
  },
  {
    id: 'physics_beginner',
    name: 'Physics Beginner',
    description: 'Spawn 25 objects and start experimenting.',
    icon: 'flask',
    track: 'objectsSpawned',
    target: 25,
    reward: 'Smoke skin colour + Hard Hat',
  },
  {
    id: 'master_builder',
    name: 'Master Builder',
    description: 'Create 12 physical connections (ropes, joints, springs).',
    icon: 'wrench',
    track: 'constraintsCreated',
    target: 12,
    reward: 'Mint skin colour + Plum trousers',
  },
  {
    id: 'explosion_expert',
    name: 'Explosion Expert',
    description: 'Set off 20 explosions.',
    icon: 'bomb',
    track: 'explosions',
    target: 20,
    reward: 'Coral skin colour + Safety Visor',
  },
  {
    id: 'chain_reaction',
    name: 'Chain Reaction',
    description: 'Trigger an explosion chain of 3 or more.',
    icon: 'chain',
    track: 'bestChain',
    target: 3,
    reward: 'Grape shirt colour',
  },
  {
    id: 'gravity_explorer',
    name: 'Gravity Explorer',
    description: 'Try 5 different gravity presets.',
    icon: 'gravity',
    track: 'gravityPresetsUsed',
    target: 5,
    reward: 'Sky skin colour + Antenna',
  },
  {
    id: 'challenge_champion',
    name: 'Challenge Champion',
    description: 'Complete 10 challenges.',
    icon: 'trophy',
    track: 'challengesCompleted',
    target: 10,
    reward: 'Crown + Violet skin colour',
  },
  {
    id: 'destruction_expert',
    name: 'Destruction Expert',
    description: 'Destroy 60 objects.',
    icon: 'skull',
    track: 'objectsDestroyed',
    target: 60,
    reward: 'Gold skin colour + Safety Visor',
  },
  {
    id: 'sandbox_architect',
    name: 'Sandbox Architect',
    description: 'Save 5 layouts of your own.',
    icon: 'save',
    track: 'layoutsSaved',
    target: 5,
    reward: 'Bone skin colour + Lab Halo',
  },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const DEFAULT_STATS = {
  ragdollsSpawned: 0,
  objectsSpawned: 0,
  objectsDestroyed: 0,
  constraintsCreated: 0,
  explosions: 0,
  bestChain: 0,
  gravityPresetsUsed: 0,
  challengesCompleted: 0,
  layoutsSaved: 0,
  ragdollsLaunched: 0,
  maxImpactForce: 0,
  playSeconds: 0,
  bestArenaScore: 0,
  challengeStars: {},
  gravityPresetIds: [],
};
