/**
 * objectCatalog.js — every spawnable object in StickLab.
 *
 * A definition is pure data: how the body is shaped, which material it uses,
 * whether it can break, how it is drawn and which behaviour system drives it.
 * Behaviour names and property keys must match the implementations in
 * `src/physics/FieldBehaviors.js`, `src/physics/ForceManager.js` and
 * `src/config/propSchema.js` — those three files are the contract.
 */

import { MATERIALS, RAGDOLL_PRESETS } from './gameConfig.js';

export const OBJECT_CATEGORIES = [
  { id: 'basic', name: 'Basic', icon: 'box' },
  { id: 'structures', name: 'Structures', icon: 'platform' },
  { id: 'mechanical', name: 'Mechanical', icon: 'spring' },
  { id: 'special', name: 'Special', icon: 'sparkle' },
  { id: 'characters', name: 'Characters', icon: 'ragdoll' },
];

/** Shorthand: build a props object from a material plus overrides. */
const matProps = (material, extra = {}) => {
  const mat = MATERIALS[material] ?? MATERIALS.wood;
  return {
    density: mat.density,
    friction: mat.friction,
    restitution: mat.restitution,
    ...extra,
  };
};

/**
 * Every definition.
 *  shape:   rect | circle | poly
 *  size:    { w, h } | { r } | { points: [[x, y], …] }
 *  render:  drawer key from src/render/drawers.js
 *  behavior / composite: keys understood by the physics layer
 */
export const OBJECT_DEFS = {
  /* =============================================================== BASIC == */
  crate: {
    id: 'crate', name: 'Wooden Crate', category: 'basic', material: 'wood',
    shape: 'rect', size: { w: 58, h: 58 }, render: 'crate',
    destructible: { hp: 48, debris: 5, debrisMaterial: 'wood' },
    defaultProps: matProps('wood', { density: 0.0016, friction: 0.55, restitution: 0.12 }),
    tags: ['box', 'wood', 'breakable'],
    description: 'Light wooden box — stacking and smashing material.',
  },
  metalBox: {
    id: 'metalBox', name: 'Metal Box', category: 'basic', material: 'metal',
    shape: 'rect', size: { w: 56, h: 56 }, render: 'metalBox',
    destructible: { hp: 150, debris: 4, debrisMaterial: 'metal' },
    defaultProps: matProps('metal', { density: 0.0042, friction: 0.42, restitution: 0.08 }),
    tags: ['box', 'metal', 'heavy'],
    description: 'Heavy steel container that shrugs off most impacts.',
  },
  ball: {
    id: 'ball', name: 'Rubber Ball', category: 'basic', material: 'rubber',
    shape: 'circle', size: { r: 22 }, render: 'ball',
    defaultProps: matProps('rubber'),
    tags: ['ball', 'sphere', 'bouncy', 'roll'],
    description: 'Bounces off everything and rolls forever.',
  },
  heavySphere: {
    id: 'heavySphere', name: 'Heavy Sphere', category: 'basic', material: 'heavy',
    shape: 'circle', size: { r: 32 }, render: 'heavySphere',
    defaultProps: matProps('heavy'),
    tags: ['ball', 'sphere', 'heavy', 'cannonball'],
    description: 'Dense iron ball — perfect cannon ammunition.',
  },
  bouncyBall: {
    id: 'bouncyBall', name: 'Bouncy Ball', category: 'basic', material: 'bouncy',
    shape: 'circle', size: { r: 17 }, render: 'bouncyBall',
    defaultProps: matProps('bouncy'),
    tags: ['ball', 'sphere', 'bouncy', 'spring'],
    description: 'Almost perfectly elastic. Chaos on a ramp.',
  },
  barrel: {
    id: 'barrel', name: 'Barrel', category: 'basic', material: 'wood',
    shape: 'rect', size: { w: 46, h: 64 }, render: 'barrel',
    destructible: { hp: 42, debris: 6, debrisMaterial: 'wood' },
    defaultProps: matProps('wood', { friction: 0.5, restitution: 0.14 }),
    tags: ['wood', 'roll', 'breakable'],
    description: 'Rolls on its side, splinters when hit hard.',
  },
  brick: {
    id: 'brick', name: 'Brick', category: 'basic', material: 'stone',
    shape: 'rect', size: { w: 46, h: 24 }, render: 'brick',
    destructible: { hp: 34, debris: 4, debrisMaterial: 'stone' },
    defaultProps: matProps('stone', { density: 0.0019, friction: 0.62, restitution: 0.06 }),
    tags: ['stone', 'wall', 'breakable'],
    description: 'Build walls, then knock them down.',
  },
  plank: {
    id: 'plank', name: 'Plank', category: 'basic', material: 'wood',
    shape: 'rect', size: { w: 150, h: 18 }, render: 'plank',
    destructible: { hp: 30, debris: 4, debrisMaterial: 'wood' },
    defaultProps: matProps('wood', { density: 0.0014, friction: 0.5, restitution: 0.1 }),
    tags: ['wood', 'bridge', 'plank'],
    description: 'Long board — bridge material and seesaw arm.',
  },
  iceCube: {
    id: 'iceCube', name: 'Ice Cube', category: 'basic', material: 'ice',
    shape: 'rect', size: { w: 54, h: 54 }, render: 'iceCube',
    destructible: { hp: 26, debris: 6, debrisMaterial: 'ice' },
    defaultProps: matProps('ice'),
    tags: ['ice', 'slippery', 'breakable'],
    description: 'Slippery block that shatters into shards.',
  },
  balloon: {
    id: 'balloon', name: 'Balloon', category: 'basic', material: 'cloth',
    shape: 'circle', size: { r: 26 }, render: 'balloon', behavior: 'buoyancy',
    destructible: { hp: 6, debris: 3, debrisMaterial: 'cloth' },
    defaultProps: matProps('cloth', { density: 0.0004, friction: 0.3, restitution: 0.5, strength: 0.36 }),
    tags: ['balloon', 'float', 'toy'],
    description: 'Floats upward and drifts. Pops on a hard hit.',
  },
  target: {
    id: 'target', name: 'Target', category: 'basic', material: 'wood',
    shape: 'circle', size: { r: 28 }, render: 'target', behavior: 'target',
    destructible: { hp: 26, debris: 5, debrisMaterial: 'wood' },
    defaultProps: matProps('wood', { density: 0.0011, friction: 0.4, restitution: 0.2 }),
    tags: ['target', 'challenge', 'score'],
    description: 'Destruction target. Breaking it counts towards challenges.',
  },

  /* ========================================================== STRUCTURES == */
  platform: {
    id: 'platform', name: 'Platform', category: 'structures', material: 'stone',
    shape: 'rect', size: { w: 260, h: 28 }, render: 'platform',
    defaultStatic: true,
    defaultProps: matProps('stone', { friction: 0.72, restitution: 0.02, static: true }),
    tags: ['ground', 'platform', 'static'],
    description: 'Solid platform. Make it dynamic to turn it into a wrecking bar.',
  },
  ramp: {
    id: 'ramp', name: 'Ramp', category: 'structures', material: 'stone',
    shape: 'poly', size: { points: [[-110, 40], [110, 40], [110, -6], [-16, -44]] },
    render: 'ramp', defaultStatic: true,
    defaultProps: matProps('stone', { friction: 0.7, restitution: 0.02, static: true }),
    tags: ['ground', 'ramp', 'slope'],
    description: 'Angled block for rolling things downhill.',
  },
  wall: {
    id: 'wall', name: 'Wall', category: 'structures', material: 'stone',
    shape: 'rect', size: { w: 34, h: 190 }, render: 'wall', defaultStatic: true,
    defaultProps: matProps('stone', { friction: 0.7, restitution: 0.02, static: true }),
    tags: ['ground', 'wall', 'tower'],
    description: 'Tall barrier that keeps ragdolls where you want them.',
  },
  stoneBlock: {
    id: 'stoneBlock', name: 'Stone Block', category: 'structures', material: 'stone',
    shape: 'rect', size: { w: 74, h: 74 }, render: 'stoneBlock',
    destructible: { hp: 200, debris: 5, debrisMaterial: 'stone' },
    defaultProps: matProps('stone', { friction: 0.66, restitution: 0.04 }),
    tags: ['stone', 'heavy', 'block'],
    description: 'Big slab of rock. Needs a lot of force to break.',
  },
  glassPane: {
    id: 'glassPane', name: 'Glass Pane', category: 'structures', material: 'glass',
    shape: 'rect', size: { w: 130, h: 16 }, render: 'glassPane',
    destructible: { hp: 10, debris: 7, debrisMaterial: 'glass' },
    defaultProps: matProps('glass'),
    tags: ['glass', 'breakable', 'fragile'],
    description: 'Shatters beautifully at the lightest touch.',
  },
  brickWall: {
    id: 'brickWall', name: 'Brick Wall', category: 'structures', material: 'stone',
    shape: 'rect', size: { w: 200, h: 120 }, render: 'brickWall',
    stack: 'brick', stackCount: 10,
    defaultProps: matProps('stone', { density: 0.0019, friction: 0.62, restitution: 0.06 }),
    tags: ['wall', 'stack', 'multiple'],
    description: 'Ten bricks stacked in a wall — chain reactions love it.',
  },
  crateStack: {
    id: 'crateStack', name: 'Crate Stack', category: 'structures', material: 'wood',
    shape: 'rect', size: { w: 200, h: 140 }, render: 'crateStack',
    stack: 'crate', stackCount: 6,
    defaultProps: matProps('wood', { friction: 0.55, restitution: 0.12 }),
    tags: ['stack', 'tower', 'multiple'],
    description: 'Spawns a whole tower of crates for demolishing.',
  },

  /* ========================================================== MECHANICAL == */
  spring: {
    id: 'spring', name: 'Spring', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 62, h: 62 }, render: 'spring', composite: 'spring',
    defaultProps: matProps('metal', { stiffness: 0.05, damping: 0.04, length: 58, scale: 1 }),
    tags: ['spring', 'bounce', 'mechanical'],
    description: 'Two plates and a real spring constraint. Catapults everything.',
  },
  pendulum: {
    id: 'pendulum', name: 'Pendulum', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 130, h: 190 }, render: 'pendulum', composite: 'pendulum',
    defaultProps: matProps('metal', { length: 150, scale: 1 }),
    tags: ['pendulum', 'swing', 'mechanical'],
    description: 'Hanging weight on a pin joint — a wrecking ball.',
  },
  seesaw: {
    id: 'seesaw', name: 'Seesaw', category: 'mechanical', material: 'wood',
    shape: 'rect', size: { w: 240, h: 70 }, render: 'seesaw', composite: 'seesaw',
    defaultProps: matProps('wood', { length: 230, fulcrum: 22, stiffness: 0.9 }),
    tags: ['lever', 'seesaw', 'balance'],
    description: 'Balanced plank on a pivot. A timing puzzle in one object.',
  },
  lever: {
    id: 'lever', name: 'Lever', category: 'mechanical', material: 'wood',
    shape: 'rect', size: { w: 210, h: 64 }, render: 'lever', composite: 'lever',
    defaultProps: matProps('wood', { length: 200, fulcrum: 18, stiffness: 0.95 }),
    tags: ['lever', 'mechanism'],
    description: 'Shorter arm with a heavier counterweight.',
  },
  piston: {
    id: 'piston', name: 'Piston', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 110, h: 120 }, render: 'piston', composite: 'piston', behavior: 'piston',
    defaultProps: matProps('metal', { length: 90, speed: 1.1 }),
    tags: ['piston', 'motor', 'machine'],
    description: 'Motorised rod that extends and retracts — a launcher.',
  },
  conveyor: {
    id: 'conveyor', name: 'Conveyor Belt', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 240, h: 30 }, render: 'conveyor', behavior: 'conveyor',
    defaultStatic: true,
    defaultProps: matProps('metal', { static: true, speed: 5, direction: 1, friction: 0.9 }),
    tags: ['conveyor', 'belt', 'machine'],
    description: 'Drags anything resting on it at a constant speed.',
  },
  movingPlatform: {
    id: 'movingPlatform', name: 'Moving Platform', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 190, h: 26 }, render: 'movingPlatform', behavior: 'oscillate',
    defaultStatic: true,
    defaultProps: matProps('metal', { static: true, distance: 300, speed: 1, angle: 0, friction: 0.8 }),
    tags: ['platform', 'moving', 'elevator'],
    description: 'Slides back and forth. Riders keep their momentum.',
  },
  rotatingPlatform: {
    id: 'rotatingPlatform', name: 'Rotating Platform', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 220, h: 24 }, render: 'rotatingPlatform', behavior: 'rotate',
    defaultStatic: true,
    defaultProps: matProps('metal', { static: true, speed: 1.2, friction: 0.7 }),
    tags: ['rotating', 'fan', 'machine'],
    description: 'Spins at a constant rate — a fan, a wheel, a hazard.',
  },
  motorWheel: {
    id: 'motorWheel', name: 'Motorised Wheel', category: 'mechanical', material: 'metal',
    shape: 'circle', size: { r: 40 }, render: 'motorWheel', behavior: 'motor',
    defaultProps: matProps('metal', { density: 0.0028, speed: 7, friction: 0.9 }),
    tags: ['wheel', 'motor', 'drive'],
    description: 'Self-driven wheel. Drop a cart on top for a vehicle.',
  },
  hinge: {
    id: 'hinge', name: 'Hinge', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 150, h: 16 }, render: 'hinge', composite: 'hinge',
    defaultProps: matProps('metal', { length: 150, stiffness: 0.9, hingeSide: 'left' }),
    tags: ['hinge', 'door', 'pin'],
    description: 'Plank pinned at one end — a door, a trap, a catflap.',
  },
  pulley: {
    id: 'pulley', name: 'Pulley', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 150, h: 210 }, render: 'pulley', composite: 'pulley', behavior: 'pulley',
    defaultProps: matProps('metal', { length: 220 }),
    tags: ['pulley', 'lift', 'rope'],
    description: 'Wheel and rope: the counterweight lifts as the load falls.',
  },
  rope: {
    id: 'rope', name: 'Rope', category: 'mechanical', material: 'rope',
    shape: 'rect', size: { w: 24, h: 210 }, render: 'rope', composite: 'rope',
    defaultProps: { density: 0.0012, friction: 0.4, restitution: 0.05, length: 200, segments: 7 },
    tags: ['rope', 'swing', 'hang'],
    description: 'Flexible rope. Anchor one end and swing from it.',
  },
  chain: {
    id: 'chain', name: 'Chain', category: 'mechanical', material: 'metal',
    shape: 'rect', size: { w: 26, h: 230 }, render: 'chain', composite: 'chain',
    defaultProps: matProps('metal', { density: 0.0026, length: 220, segments: 6 }),
    tags: ['chain', 'swing', 'heavy'],
    description: 'Heavier, stiffer link chain for cranes and bridges.',
  },

  /* ============================================================= SPECIAL == */
  explosiveBarrel: {
    id: 'explosiveBarrel', name: 'Explosive Barrel', category: 'special', material: 'metal',
    shape: 'rect', size: { w: 48, h: 66 }, render: 'explosiveBarrel', behavior: 'fuseBomb',
    destructible: { hp: 20, debris: 6, debrisMaterial: 'metal', explodes: true },
    defaultProps: matProps('metal', { density: 0.0026, blastRadius: 230, blastForce: 10, fuse: 2.5, autoFuse: false }),
    tags: ['explosive', 'barrel', 'boom'],
    description: 'Detonates on impact or with a lit fuse. Chain them together.',
  },
  bouncyPad: {
    id: 'bouncyPad', name: 'Bouncy Pad', category: 'special', material: 'bouncy',
    shape: 'rect', size: { w: 170, h: 26 }, render: 'bouncyPad', behavior: 'bouncyPad',
    defaultStatic: true,
    defaultProps: matProps('bouncy', { static: true, power: 16, restitution: 1.05, friction: 0.5 }),
    tags: ['bounce', 'trampoline', 'launch'],
    description: 'Launches whatever lands on it. Stack pads for silly heights.',
  },
  cannon: {
    id: 'cannon', name: 'Cannon', category: 'special', material: 'metal',
    shape: 'rect', size: { w: 120, h: 110 }, render: 'cannon', composite: 'cannon', behavior: 'cannon',
    defaultProps: matProps('metal', { angle: -35, power: 24, length: 110, ammo: 'heavySphere', autoFire: false, reload: 1.1 }),
    tags: ['cannon', 'launcher', 'projectile'],
    description: 'Aims, loads and fires real projectiles. Edit angle, power and ammo.',
  },
  gravityWell: {
    id: 'gravityWell', name: 'Gravity Well', category: 'special', material: 'energy',
    shape: 'circle', size: { r: 44 }, render: 'gravityWell', behavior: 'gravityWell',
    defaultStatic: true, sensor: true,
    defaultProps: { static: true, radius: 420, strength: 0.9, mode: 'attract', friction: 0.4, restitution: 0.1, density: 0.001 },
    tags: ['gravity', 'field', 'attract'],
    description: 'Pulls (or pushes) everything inside its radius every step.',
  },
  magneticField: {
    id: 'magneticField', name: 'Magnetic Field', category: 'special', material: 'energy',
    shape: 'rect', size: { w: 210, h: 190 }, render: 'magneticField', behavior: 'magnet',
    defaultStatic: true, sensor: true,
    defaultProps: { static: true, radius: 320, strength: 0.8, mode: 'attract', friction: 0.4, restitution: 0.1, density: 0.001 },
    tags: ['magnet', 'field', 'metal'],
    description: 'A magnetic bubble that hauls metal objects towards its core.',
  },
  windGenerator: {
    id: 'windGenerator', name: 'Wind Generator', category: 'special', material: 'metal',
    shape: 'rect', size: { w: 84, h: 130 }, render: 'windGenerator', behavior: 'wind',
    defaultStatic: true,
    defaultProps: matProps('metal', { static: true, radius: 480, strength: 0.55, angle: 0, gust: true }),
    tags: ['wind', 'field', 'push'],
    description: 'Blows a steady cone of wind. Aim it with the angle property.',
  },
  freezeZone: {
    id: 'freezeZone', name: 'Freeze Zone', category: 'special', material: 'energy',
    shape: 'rect', size: { w: 240, h: 180 }, render: 'freezeZone', behavior: 'freeze',
    defaultStatic: true, sensor: true,
    defaultProps: { static: true, duration: 1.4, friction: 0.4, restitution: 0.1, density: 0.001 },
    tags: ['freeze', 'zone', 'slow'],
    description: 'Chilling area: objects inside slow down and stop spinning.',
  },
  slowMotionField: {
    id: 'slowMotionField', name: 'Slow-Motion Field', category: 'special', material: 'energy',
    shape: 'rect', size: { w: 260, h: 210 }, render: 'slowMotionField', behavior: 'slowmo',
    defaultStatic: true, sensor: true,
    defaultProps: { static: true, strength: 0.25, friction: 0.4, restitution: 0.1, density: 0.001 },
    tags: ['slow', 'time', 'zone'],
    description: 'Bullet-time bubble. Wonderful with explosions.',
  },
  teleporter: {
    id: 'teleporter', name: 'Teleporter', category: 'special', material: 'energy',
    shape: 'rect', size: { w: 120, h: 34 }, render: 'teleporter', behavior: 'teleporter',
    defaultStatic: true, sensor: true,
    defaultProps: { static: true, link: '', friction: 0.4, restitution: 0.1, density: 0.001 },
    tags: ['teleport', 'portal', 'zone'],
    description: 'Two of these link up automatically: in one end, out the other.',
  },
  breakableCrate: {
    id: 'breakableCrate', name: 'Breakable Crate', category: 'special', material: 'wood',
    shape: 'rect', size: { w: 62, h: 62 }, render: 'breakableCrate', behavior: 'breakable',
    destructible: { hp: 22, debris: 8, debrisMaterial: 'wood' },
    defaultProps: matProps('wood', { density: 0.0015, friction: 0.55, restitution: 0.1 }),
    tags: ['breakable', 'crate', 'debris'],
    description: 'Splinters into lots of debris — satisfying to chain.',
  },
  hazardSpikes: {
    id: 'hazardSpikes', name: 'Spike Hazard', category: 'special', material: 'metal',
    shape: 'rect', size: { w: 200, h: 28 }, render: 'hazardSpikes', behavior: 'hazard',
    defaultStatic: true, sensor: true,
    defaultProps: matProps('metal', { static: true, strength: 70, friction: 0.5, restitution: 0.1 }),
    tags: ['hazard', 'spikes', 'danger'],
    description: 'Damages whatever touches it. Perfect for obstacle courses.',
  },
  goalZone: {
    id: 'goalZone', name: 'Goal Zone', category: 'special', material: 'energy',
    shape: 'rect', size: { w: 160, h: 120 }, render: 'goalZone', behavior: 'goal',
    defaultStatic: true, sensor: true,
    defaultProps: { static: true, goalLabel: 'Goal', friction: 0.4, restitution: 0.1, density: 0.001 },
    tags: ['goal', 'zone', 'finish'],
    description: 'Sensor-only finish area. Get the objective inside to win.',
  },

  /* ========================================================== CHARACTERS == */
  ragdollLight: {
    id: 'ragdollLight', name: 'Ragdoll — Lightweight', category: 'characters', material: 'flesh',
    shape: 'rect', size: { w: 66, h: 160 }, render: 'ragdoll', ragdoll: 'lightweight',
    defaultProps: {},
    tags: ['ragdoll', 'character', 'light'],
    description: 'Floppy, fast and hilarious. Pops up from big hits.',
  },
  ragdollHeavy: {
    id: 'ragdollHeavy', name: 'Ragdoll — Heavyweight', category: 'characters', material: 'flesh',
    shape: 'rect', size: { w: 74, h: 168 }, render: 'ragdoll', ragdoll: 'heavyweight',
    defaultProps: {},
    tags: ['ragdoll', 'character', 'heavy'],
    description: 'Moves like a sack of concrete and topples everything.',
  },
  ragdollFlexible: {
    id: 'ragdollFlexible', name: 'Ragdoll — Flexible', category: 'characters', material: 'flesh',
    shape: 'rect', size: { w: 66, h: 162 }, render: 'ragdoll', ragdoll: 'flexible',
    defaultProps: {},
    tags: ['ragdoll', 'character', 'floppy'],
    description: 'Contortionist joints. Folds up on the smallest bump.',
  },
  ragdollStiff: {
    id: 'ragdollStiff', name: 'Ragdoll — Stiff', category: 'characters', material: 'flesh',
    shape: 'rect', size: { w: 66, h: 166 }, render: 'ragdoll', ragdoll: 'stiff',
    defaultProps: {},
    tags: ['ragdoll', 'character', 'stiff'],
    description: 'Keeps its shape and tumbles like a statue.',
  },
  ragdollBouncy: {
    id: 'ragdollBouncy', name: 'Ragdoll — Bouncy', category: 'characters', material: 'flesh',
    shape: 'rect', size: { w: 66, h: 162 }, render: 'ragdoll', ragdoll: 'bouncy',
    defaultProps: {},
    tags: ['ragdoll', 'character', 'bouncy'],
    description: 'Rubbery limbs that ping off everything.',
  },
};

/**
 * Cartoon palette per object. Kept separate from the definitions so the same
 * artwork can be recoloured without touching physics data.
 */
export const OBJECT_COLORS = {
  crate: '#c8964f', metalBox: '#9fb3c8', ball: '#ff7a59', heavySphere: '#6b7c93',
  bouncyBall: '#ffd23f', barrel: '#b07a3c', brick: '#c96a4a', plank: '#d9a866',
  iceCube: '#bfe9ff', balloon: '#ff8fb1', target: '#ff5d6c',
  platform: '#7f90a3', ramp: '#8a9bab', wall: '#8a9bab', stoneBlock: '#93a3b3',
  glassPane: '#cfeaff', brickWall: '#c96a4a', crateStack: '#c8964f',
  spring: '#c0cbd8', pendulum: '#8d9aa8', seesaw: '#d9a866', lever: '#cf9c58',
  piston: '#aab6c4', conveyor: '#5a6673', movingPlatform: '#8f9ead',
  rotatingPlatform: '#8f9ead', motorWheel: '#7d8b99', hinge: '#b3bfcc',
  pulley: '#b3bfcc', rope: '#e0b64a', chain: '#a9bdd3',
  explosiveBarrel: '#e0364a', bouncyPad: '#ff9d7a', cannon: '#5f6b7a',
  gravityWell: '#a77bff', magneticField: '#57c8ff', windGenerator: '#8fd0e6',
  freezeZone: '#9fdcff', slowMotionField: '#c9a6ff', teleporter: '#a77bff',
  breakableCrate: '#c8964f', hazardSpikes: '#c2cad4', goalZone: '#38e07b',
  ragdollLight: '#111820', ragdollHeavy: '#111820', ragdollFlexible: '#111820',
  ragdollStiff: '#111820', ragdollBouncy: '#111820',
};

export const OBJECT_LIST = Object.values(OBJECT_DEFS);
for (const def of OBJECT_LIST) {
  if (!def.color) def.color = OBJECT_COLORS[def.id] ?? '#c8964f';
}
export const OBJECT_IDS = OBJECT_LIST.map((d) => d.id);

/** Objects the library starts with in the favourites row. */
export const DEFAULT_FAVORITES = ['crate', 'ball', 'platform', 'spring', 'explosiveBarrel', 'ragdollLight'];

/** Sensible spawn presets used by challenge levels and the build-mode palette. */
export const SPAWN_PRESETS = {
  crateTower: ['crateStack'],
  wall: ['brickWall'],
  trampoline: ['bouncyPad', 'ball'],
};

/* --------------------------------------------------------------- utilities */

export function getDef(id) {
  return OBJECT_DEFS[id] ?? null;
}

export function defsByCategory(category) {
  if (!category || category === 'favourites' || category === 'recents') return OBJECT_LIST.slice();
  return OBJECT_LIST.filter((d) => d.category === category);
}

export function searchDefs(query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return OBJECT_LIST.slice();
  return OBJECT_LIST.filter((d) => {
    const haystack = [d.id, d.name, d.description, d.category, ...(d.tags ?? [])].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function defsByTag(tag) {
  return OBJECT_LIST.filter((d) => (d.tags ?? []).includes(tag));
}

export function isRagdollDef(def) {
  return Boolean(def?.ragdoll);
}

/** The five ragdoll presets as catalogue entries (used by the character tab). */
export function ragdollDefs() {
  return Object.keys(RAGDOLL_PRESETS)
    .map((id) => OBJECT_LIST.find((d) => d.ragdoll === id) ?? null)
    .filter(Boolean);
}

/** Rough body count a definition will use (for the body-budget warning). */
export function bodyCost(def) {
  if (!def) return 1;
  if (def.stack) return def.stackCount ?? 5;
  switch (def.composite) {
    case 'pulley': return 5;
    case 'rope':
    case 'chain': return Math.max(3, (def.defaultProps?.segments ?? 6) + 1);
    case 'seesaw':
    case 'lever': return 3;
    case 'piston': return 3;
    case 'pendulum': return 2;
    case 'spring': return 2;
    case 'cannon': return 3;
    case 'hinge': return 2;
    default: return 1;
  }
}
