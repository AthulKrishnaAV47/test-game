/**
 * Inspector property schema.
 *
 * The inspector builds its controls from this file so only properties that are
 * meaningful for the selected object are ever shown. Each entry maps to a real
 * engine property (Matter body fields or behaviour parameters).
 */

import { MATERIALS } from './gameConfig.js';

const COMMON_DYNAMIC = [
  { key: 'density', label: 'Density', type: 'range', min: 0.0002, max: 0.02, step: 0.0002, decimals: 4, group: 'Physics' },
  { key: 'friction', label: 'Friction', type: 'range', min: 0, max: 1.2, step: 0.01, group: 'Physics' },
  { key: 'restitution', label: 'Bounciness', type: 'range', min: 0, max: 1, step: 0.01, group: 'Physics' },
  { key: 'affectedByGravity', label: 'Gravity participation', type: 'toggle', group: 'Physics' },
  { key: 'locked', label: 'Lock position', type: 'toggle', group: 'Editing' },
  { key: 'scale', label: 'Scale', type: 'range', min: 0.35, max: 2.5, step: 0.05, group: 'Editing' },
  { key: 'color', label: 'Colour', type: 'color', group: 'Appearance' },
];

const COMMON_STATIC = [
  { key: 'friction', label: 'Friction', type: 'range', min: 0, max: 1.2, step: 0.01, group: 'Physics' },
  { key: 'restitution', label: 'Bounciness', type: 'range', min: 0, max: 1, step: 0.01, group: 'Physics' },
  { key: 'angle', label: 'Rotation', type: 'range', min: -180, max: 180, step: 1, degrees: true, group: 'Editing' },
  { key: 'color', label: 'Colour', type: 'color', group: 'Appearance' },
];

const DESTRUCTIBLE_PROPS = [
  { key: 'hp', label: 'Durability', type: 'range', min: 1, max: 400, step: 1, group: 'Destruction' },
];

/** Behaviour specific parameters. */
export const BEHAVIOR_PROPS = {
  spring: [
    { key: 'stiffness', label: 'Stiffness', type: 'range', min: 0.05, max: 1, step: 0.01, group: 'Spring' },
    { key: 'damping', label: 'Damping', type: 'range', min: 0, max: 1, step: 0.01, group: 'Spring' },
    { key: 'length', label: 'Rest length', type: 'range', min: 20, max: 320, step: 2, group: 'Spring' },
  ],
  conveyor: [
    { key: 'speed', label: 'Belt speed', type: 'range', min: 0.5, max: 12, step: 0.1, group: 'Belt' },
    { key: 'direction', label: 'Direction', type: 'select', options: [{ value: 1, label: 'Forward' }, { value: -1, label: 'Reverse' }], group: 'Belt' },
  ],
  oscillate: [
    { key: 'distance', label: 'Travel distance', type: 'range', min: 30, max: 900, step: 10, group: 'Motion' },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 4, step: 0.05, group: 'Motion' },
    { key: 'angle', label: 'Direction', type: 'range', min: -180, max: 180, step: 5, degrees: true, group: 'Motion' },
  ],
  rotate: [
    { key: 'speed', label: 'Spin speed', type: 'range', min: -4, max: 4, step: 0.05, group: 'Motor' },
  ],
  motor: [
    { key: 'speed', label: 'Wheel speed', type: 'range', min: -14, max: 14, step: 0.5, group: 'Motor' },
  ],
  piston: [
    { key: 'speed', label: 'Cycle speed', type: 'range', min: 0.1, max: 3, step: 0.05, group: 'Motion' },
    { key: 'length', label: 'Throw', type: 'range', min: 20, max: 220, step: 5, group: 'Motion' },
  ],
  gravityWell: [
    { key: 'radius', label: 'Field radius', type: 'range', min: 80, max: 800, step: 10, group: 'Field' },
    { key: 'strength', label: 'Strength', type: 'range', min: 0.05, max: 3, step: 0.05, group: 'Field' },
    { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'attract', label: 'Attract' }, { value: 'repel', label: 'Repel' }], group: 'Field' },
  ],
  magnet: [
    { key: 'radius', label: 'Field radius', type: 'range', min: 60, max: 700, step: 10, group: 'Field' },
    { key: 'strength', label: 'Strength', type: 'range', min: 0.05, max: 2.5, step: 0.05, group: 'Field' },
    { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'attract', label: 'Attract' }, { value: 'repel', label: 'Repel' }], group: 'Field' },
  ],
  wind: [
    { key: 'radius', label: 'Gust length', type: 'range', min: 100, max: 900, step: 10, group: 'Field' },
    { key: 'strength', label: 'Wind strength', type: 'range', min: 0.02, max: 1.2, step: 0.02, group: 'Field' },
    { key: 'angle', label: 'Direction', type: 'range', min: -180, max: 180, step: 5, degrees: true, group: 'Field' },
  ],
  freeze: [
    { key: 'duration', label: 'Freeze strength', type: 'range', min: 0.2, max: 6, step: 0.1, group: 'Field' },
  ],
  slowmo: [
    { key: 'strength', label: 'Time factor', type: 'range', min: 0.05, max: 0.95, step: 0.05, group: 'Field' },
  ],
  teleporter: [
    { key: 'link', label: 'Partner id', type: 'text', group: 'Portal' },
  ],
  explosive: [
    { key: 'blastRadius', label: 'Blast radius', type: 'range', min: 60, max: 700, step: 10, group: 'Explosive' },
    { key: 'blastForce', label: 'Blast force', type: 'range', min: 0.01, max: 0.4, step: 0.005, decimals: 3, group: 'Explosive' },
  ],
  fuseBomb: [
    { key: 'fuse', label: 'Fuse (seconds)', type: 'range', min: 0.2, max: 12, step: 0.1, group: 'Explosive' },
    { key: 'blastRadius', label: 'Blast radius', type: 'range', min: 60, max: 700, step: 10, group: 'Explosive' },
  ],
  bouncyPad: [
    { key: 'power', label: 'Launch power', type: 'range', min: 4, max: 34, step: 0.5, group: 'Pad' },
  ],
  cannon: [
    { key: 'power', label: 'Muzzle power', type: 'range', min: 4, max: 40, step: 0.5, group: 'Cannon' },
    { key: 'length', label: 'Barrel length', type: 'range', min: 40, max: 170, step: 5, group: 'Cannon' },
  ],
  buoyancy: [
    { key: 'strength', label: 'Lift force', type: 'range', min: 0.05, max: 0.6, step: 0.01, group: 'Float' },
  ],
  hazard: [
    { key: 'strength', label: 'Damage per second', type: 'range', min: 5, max: 200, step: 5, group: 'Hazard' },
  ],
  pulley: [
    { key: 'length', label: 'Rope length', type: 'range', min: 60, max: 600, step: 10, group: 'Pulley' },
  ],
  rope: [
    { key: 'length', label: 'Length', type: 'range', min: 60, max: 900, step: 10, group: 'Rope' },
    { key: 'segments', label: 'Segments', type: 'number', min: 3, max: 26, step: 1, group: 'Rope' },
  ],
  seesaw: [
    { key: 'stiffness', label: 'Pivot stiffness', type: 'range', min: 0.3, max: 1, step: 0.02, group: 'Pivot' },
  ],
  hinge: [
    { key: 'stiffness', label: 'Pin stiffness', type: 'range', min: 0.4, max: 1, step: 0.02, group: 'Pivot' },
  ],
};

/** Props every object with a Matter body exposes. */
export function getEditableProps(def, context = {}) {
  const list = [];
  const isStatic = Boolean(context.static ?? def?.static);
  if (!def) return list;
  list.push(...(isStatic ? COMMON_STATIC : COMMON_DYNAMIC));
  if (def.destructible) list.push(...DESTRUCTIBLE_PROPS);
  const behavior = def.behavior;
  if (behavior && BEHAVIOR_PROPS[behavior]) list.push(...BEHAVIOR_PROPS[behavior]);
  if (def.composite && BEHAVIOR_PROPS[def.composite]) list.push(...BEHAVIOR_PROPS[def.composite]);
  return list;
}

/** Default behaviour props for a freshly spawned object. */
export function getDefaultProps(def) {
  if (!def) return {};
  const mat = MATERIALS[def.material] ?? MATERIALS.wood;
  const props = {
    density: mat.density,
    friction: mat.friction,
    restitution: mat.restitution,
  };
  for (const schema of [BEHAVIOR_PROPS[def.behavior], BEHAVIOR_PROPS[def.composite]]) {
    if (!schema) continue;
    for (const entry of schema) {
      if (props[entry.key] !== undefined) continue;
      if (entry.type === 'range' || entry.type === 'number') props[entry.key] = entry.default ?? entry.min;
      else if (entry.type === 'select') props[entry.key] = entry.default ?? entry.options[0].value;
    }
  }
  // Sensible behaviour defaults (instead of "min" from the schema).
  const d = props;
  if (def.behavior === 'conveyor') { d.speed = 4; d.direction = 1; }
  if (def.behavior === 'oscillate') { d.distance = 260; d.speed = 1; d.angle = 0; }
  if (def.behavior === 'rotate') d.speed = 1.2;
  if (def.behavior === 'motor') d.speed = 7;
  if (def.behavior === 'piston') { d.speed = 1.1; d.length = 90; }
  if (def.behavior === 'gravityWell') { d.radius = 320; d.strength = 0.9; d.mode = 'attract'; }
  if (def.behavior === 'magnet') { d.radius = 260; d.strength = 0.9; d.mode = 'attract'; }
  if (def.behavior === 'wind') { d.radius = 420; d.strength = 0.35; d.angle = 0; }
  if (def.behavior === 'freeze') d.duration = 1;
  if (def.behavior === 'slowmo') d.strength = 0.25;
  if (def.behavior === 'explosive') { d.blastRadius = 240; d.blastForce = 0.09; }
  if (def.behavior === 'fuseBomb') { d.fuse = 2.5; d.blastRadius = 260; }
  if (def.behavior === 'bouncyPad') d.power = 20;
  if (def.behavior === 'cannon') { d.power = 26; d.length = 92; d.angle = -20; }
  if (def.behavior === 'buoyancy') d.strength = 0.3;
  if (def.behavior === 'hazard') d.strength = 60;
  if (def.composite === 'rope') { d.length = 260; d.segments = 10; }
  if (def.composite === 'pulley') d.length = 220;
  if (def.composite === 'spring') { d.stiffness = 0.35; d.damping = 0.05; d.length = 110; }
  if (def.composite === 'seesaw' || def.composite === 'lever') d.stiffness = 0.9;
  if (def.composite === 'hinge') d.stiffness = 0.95;
  return props;
}
