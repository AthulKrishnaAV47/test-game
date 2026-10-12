/**
 * Global game configuration: physics tuning, safety limits, palettes and
 * persistence keys. Everything here is plain data so it can be imported by
 * unit tests without touching the DOM.
 */

/** Fixed physics timestep. The engine always advances in whole steps. */
export const STEP_MS = 1000 / 60;

export const PHYSICS = {
  STEP_MS,
  /** (1000/60)² — Matter multiplies applied forces by deltaTime² (delta in ms). */
  DELTA_TIME_SQ: (1000 / 60) ** 2,
  /** Never simulate more than this many steps in a single frame. */
  MAX_STEPS_PER_FRAME: 4,
  /** Frame deltas larger than this (tab was hidden) are clamped. */
  MAX_FRAME_DELTA: 100,
  /** Default engine iterations. Lowered on the 'low' quality preset. */
  ITERATIONS: {
    high: { position: 8, velocity: 6, constraint: 4 },
    medium: { position: 6, velocity: 4, constraint: 3 },
    low: { position: 4, velocity: 3, constraint: 2 },
  },
  /** Bodies slower than this sleep when sleeping is enabled. */
  SLEEP_THRESHOLD: 60,
  /** Springs/constraints default tuning. */
  DEFAULT_CONSTRAINT_STIFFNESS: 0.7,
  DEFAULT_CONSTRAINT_DAMPING: 0.1,
};

export const LIMITS = {
  /** Recommended simultaneous physics bodies (ragdoll parts included). */
  MAX_BODIES: 300,
  /** Hard ceiling - spawning is refused past this. */
  HARD_MAX_BODIES: 480,
  MAX_PARTICLES: 240,
  MAX_DEBRIS: 160,
  /** Maximum simultaneous ragdolls. */
  MAX_RAGDOLLS: 24,
  /** Recursive explosion chain depth. */
  MAX_EXPLOSION_CHAIN: 12,
  MAX_UNDO: 80,
  /** Import / persistence safety rails. */
  MAX_IMPORT_BYTES: 2_000_000,
  MAX_SAVED_OBJECTS: 400,
  MAX_SAVED_CONSTRAINTS: 600,
  MAX_SAVED_LAYOUTS: 40,
  /** Force / impulse safety clamp. */
  /** Impulse in px/step (1 px/step = 60 px/s of instant velocity change). */
  MAX_IMPULSE: 30,
  MAX_FORCE_MAGNITUDE: 0.06,
  SCALE_MIN: 0.22,
  SCALE_MAX: 2.6,
  /** How many debris pieces a destructible object may emit per break. */
  MAX_DEBRIS_PER_BREAK: 6,
};

/** Simulation speed presets (multiplier on simulated time per real second). */
export const SPEED_PRESETS = [0.25, 0.5, 1, 2];

export const GRAVITY_PRESETS = [
  { id: 'zero', name: 'Zero-G', x: 0, y: 0, scale: 0.001, icon: 'orbit' },
  { id: 'moon', name: 'Moon', x: 0, y: 1, scale: 0.16, icon: 'moon' },
  { id: 'low', name: 'Low', x: 0, y: 1, scale: 0.5, icon: 'down' },
  { id: 'normal', name: 'Earth', x: 0, y: 1, scale: 1, icon: 'down' },
  { id: 'high', name: 'Heavy', x: 0, y: 1, scale: 2, icon: 'down' },
  { id: 'crush', name: 'Crushing', x: 0, y: 1, scale: 3.2, icon: 'down' },
  { id: 'reverse', name: 'Reversed', x: 0, y: -1, scale: 1, icon: 'up' },
  { id: 'up-strong', name: 'Updraft', x: 0, y: -1, scale: 2.2, icon: 'up' },
  { id: 'sideways', name: 'Sideways', x: 1, y: 0.25, scale: 1, icon: 'right' },
];

export const QUALITY_PRESETS = {
  low: { particles: 60, shadows: false, outlines: false, trails: false, iterations: 'low' },
  medium: { particles: 140, shadows: true, outlines: true, trails: false, iterations: 'medium' },
  high: { particles: 240, shadows: true, outlines: true, trails: true, iterations: 'high' },
};

/** Physical material profiles shared by the object catalogue. */
export const MATERIALS = {
  wood: { density: 0.0016, friction: 0.55, frictionStatic: 0.7, restitution: 0.16, toughness: 0.85, sound: 'wood', debrisColor: '#a9743c' },
  metal: { density: 0.0042, friction: 0.4, frictionStatic: 0.55, restitution: 0.22, toughness: 2.4, sound: 'metal', debrisColor: '#9fb3c8' },
  heavy: { density: 0.009, friction: 0.5, frictionStatic: 0.65, restitution: 0.05, toughness: 3.4, sound: 'metal', debrisColor: '#8d9bb0' },
  rubber: { density: 0.0011, friction: 0.75, frictionStatic: 0.95, restitution: 0.78, toughness: 1.1, sound: 'rubber', debrisColor: '#e05a4f' },
  bouncy: { density: 0.0009, friction: 0.5, frictionStatic: 0.7, restitution: 0.94, toughness: 0.7, sound: 'rubber', debrisColor: '#57c8ff' },
  plastic: { density: 0.001, friction: 0.42, frictionStatic: 0.6, restitution: 0.42, toughness: 0.6, sound: 'rubber', debrisColor: '#f2a33c' },
  glass: { density: 0.0022, friction: 0.22, frictionStatic: 0.35, restitution: 0.3, toughness: 0.28, sound: 'glass', debrisColor: '#bfe9ff' },
  stone: { density: 0.0072, friction: 0.7, frictionStatic: 0.85, restitution: 0.08, toughness: 2.0, sound: 'wood', debrisColor: '#8d8f96' },
  energy: { density: 0.0004, friction: 0.05, frictionStatic: 0.05, restitution: 0.5, toughness: 0.2, sound: 'energy', debrisColor: '#a77bff' },
  ice: { density: 0.0013, friction: 0.06, frictionStatic: 0.1, restitution: 0.12, toughness: 0.5, sound: 'glass', debrisColor: '#cdefff' },
  rope: { density: 0.0012, friction: 0.4, frictionStatic: 0.5, restitution: 0.05, toughness: 0.6, sound: 'cloth', debrisColor: '#c8a86a' },
  flesh: { density: 0.0011, friction: 0.6, frictionStatic: 0.8, restitution: 0.2, toughness: 0.5, sound: 'flesh', debrisColor: '#e08a86' },
  cloth: { density: 0.0007, friction: 0.8, frictionStatic: 1, restitution: 0.1, toughness: 0.4, sound: 'soft', debrisColor: '#c76a8e' },
};

export const SOUNDS = ['wood', 'metal', 'glass', 'rubber', 'soft', 'energy'];

export const STORAGE_KEYS = {
  settings: 'sticklab.settings.v1',
  progress: 'sticklab.progress.v1',
  layouts: 'sticklab.layouts.v1',
  character: 'sticklab.character.v1',
  seenHelp: 'sticklab.helpSeen.v1',
  lastLevel: 'sticklab.lastLevel.v1',
};

export const SCHEMA_VERSION = 1;

export const WORLD = {
  width: 4200,
  height: 2400,
  wallThickness: 240,
};

export const RAGDOLL_PRESETS = {
  lightweight: {
    id: 'lightweight', name: 'Lightweight', densityScale: 0.5, stiffness: 0.6, damping: 0.08,
    limitScale: 1, restitution: 0.2, jumpSpeed: 11, speed: 2.4,
    description: 'Feather-light and easy to fling around.',
  },
  heavyweight: {
    id: 'heavyweight', name: 'Heavyweight', densityScale: 2.6, stiffness: 0.85, damping: 0.18,
    limitScale: 0.8, restitution: 0.06, jumpSpeed: 9, speed: 1.9,
    description: 'Thick build, shrugs off small blasts.',
  },
  flexible: {
    id: 'flexible', name: 'Flexible', densityScale: 0.9, stiffness: 0.3, damping: 0.03,
    limitScale: 1.45, restitution: 0.28, jumpSpeed: 12, speed: 2.9,
    description: 'Rubber-limbed noodle ragdoll.',
  },
  stiff: {
    id: 'stiff', name: 'Stiff', densityScale: 1.2, stiffness: 1, damping: 0.35,
    limitScale: 0.55, restitution: 0.1, jumpSpeed: 10, speed: 2.2,
    description: 'Rigid skeleton, keeps its shape.',
  },
  bouncy: {
    id: 'bouncy', name: 'Bouncy', densityScale: 0.7, stiffness: 0.5, damping: 0.06,
    limitScale: 1.2, restitution: 0.86, jumpSpeed: 15, speed: 3.1,
    description: 'Springy character that ricochets off everything.',
  },
};

export const RAGDOLL_COLORS = {
  skin: [
    { id: 'kb', name: 'Ink Black', value: '#1d2333', unlocked: true },
    { id: 'smoke', name: 'Smoke', value: '#4a5468', unlocked: false, achievement: 'physics_beginner' },
    { id: 'coral', name: 'Coral', value: '#ff7a59', unlocked: false, achievement: 'explosion_expert' },
    { id: 'sky', name: 'Sky', value: '#57c8ff', unlocked: false, achievement: 'gravity_explorer' },
    { id: 'mint', name: 'Mint', value: '#38e07b', unlocked: false, achievement: 'master_builder' },
    { id: 'violet', name: 'Violet', value: '#a77bff', unlocked: false, achievement: 'challenge_champion' },
    { id: 'gold', name: 'Gold', value: '#ffd23f', unlocked: false, achievement: 'destruction_expert' },
    { id: 'bone', name: 'Bone', value: '#f4f1e8', unlocked: false, achievement: 'sandbox_architect' },
  ],
  shirt: [
    { id: 'crimson', name: 'Crimson', value: '#e0364a', unlocked: true },
    { id: 'navy', name: 'Navy', value: '#2b4c9b', unlocked: true },
    { id: 'leaf', name: 'Leaf', value: '#2fa36b', unlocked: true },
    { id: 'sun', name: 'Sun', value: '#ffc93c', unlocked: true },
    { id: 'grape', name: 'Grape', value: '#8b5cf6', unlocked: false, achievement: 'chain_reaction' },
    { id: 'teal', name: 'Teal', value: '#12b5b0', unlocked: false, achievement: 'first_ragdoll' },
  ],
  pants: [
    { id: 'denim', name: 'Denim', value: '#3b5bdb', unlocked: true },
    { id: 'charcoal', name: 'Charcoal', value: '#374151', unlocked: true },
    { id: 'khaki', name: 'Khaki', value: '#b08968', unlocked: true },
    { id: 'plum', name: 'Plum', value: '#6d28d9', unlocked: false, achievement: 'master_builder' },
  ],
};

export const RAGDOLL_ACCESSORIES = [
  { id: 'none', name: 'None', icon: 'hat-none', unlocked: true },
  { id: 'cap', name: 'Cap', icon: 'hat-cap', unlocked: true },
  { id: 'helmet', name: 'Hard Hat', icon: 'hat-helmet', unlocked: false, achievement: 'physics_beginner' },
  { id: 'crown', name: 'Crown', icon: 'hat-crown', unlocked: false, achievement: 'challenge_champion' },
  { id: 'glasses', name: 'Glasses', icon: 'hat-glasses', unlocked: true },
  { id: 'visor', name: 'Safety Visor', icon: 'hat-visor', unlocked: false, achievement: 'destruction_expert' },
  { id: 'antenna', name: 'Antenna', icon: 'hat-antenna', unlocked: false, achievement: 'gravity_explorer' },
  { id: 'halo', name: 'Lab Halo', icon: 'hat-halo', unlocked: false, achievement: 'sandbox_architect' },
];

export const TEAM_COLORS = ['#e0364a', '#2b4c9b', '#2fa36b', '#ffc93c', '#8b5cf6', '#12b5b0'];

export const DEFAULT_SETTINGS = {
  masterVolume: 0.7,
  musicVolume: 0.35,
  sfxVolume: 0.75,
  musicEnabled: true,
  sfxEnabled: true,
  particles: true,
  screenShake: true,
  quality: 'high',
  showGrid: false,
  snapToGrid: false,
  gridSize: 50,
  simSpeed: 1,
  showFps: true,
  touchControls: 'auto',
  cleanHud: false,
  confirmDestructive: true,
  ragdollPreset: 'lightweight',
  cosmetics: {},
  favorites: ['crate', 'ball', 'platform', 'spring', 'explosiveBarrel'],
  recents: [],
  activeLevelId: 'laboratory',
  backgroundTheme: 'auto',
  lastMode: 'sandbox',
  autoSave: true,
  showHints: true,
  motionTrails: true,
  keybindings: {
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    jump: ['KeyW', 'Space', 'ArrowUp'],
    reset: ['KeyR'],
    undo: ['KeyZ'],
    redo: ['KeyY'],
    gravity: ['KeyG'],
    pause: ['KeyP', 'Escape'],
    deleteSelection: ['Delete', 'Backspace'],
    save: ['KeyS'],
    toggleGrid: ['KeyH'],
    nextRagdoll: ['KeyN'],
  },
};

export const CAMERA = {
  minZoom: LIMITS.SCALE_MIN,
  maxZoom: LIMITS.SCALE_MAX,
  defaultZoom: 1,
  panSpeed: 1 / 1,
  wheelSensitivity: 0.0016,
};
