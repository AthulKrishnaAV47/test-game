/**
 * Challenge mode — 15 progressively harder physics puzzles.
 *
 * Every challenge is data: a prepared scene (`items`), one or more goal
 * conditions evaluated against real simulation events, and star thresholds.
 * Goal types are implemented in `src/systems/ChallengeManager.js`:
 *
 *   zone            an entity (ball / ragdoll / any / specific type) must stay
 *                   inside a world-space rectangle for `hold` seconds
 *   destroy         destroy N objects (optionally filtered by tag/type)
 *   explosionDestroy destroy N objects inside a single explosion window
 *   chain           trigger an explosion chain of at least N
 *   launch          a ragdoll must travel at least `minDistance` horizontally
 *   survive         stay alive for N seconds
 *   custom          special-case checks (obstacle course, rope swing…)
 */

import { FLOOR_Y } from './levels.js';

const item = (type, x, y, extra = {}) => ({ type, x, y, ...extra });

export const GOAL_ZONE = (x, y, w = 200, h = 140, extra = {}) =>
  item('goalZone', x, y, { width: w, height: h, ...extra });

export const CHALLENGES = [
  {
    id: 'first_contact',
    index: 1,
    name: 'First Contact',
    level: 'laboratory',
    objective: 'Knock the rubber ball into the glowing goal zone.',
    instructions:
      'The ball sits on the tiled floor. Use the Force tool (key 6) to drag an arrow through the ball and release, or grab it with the Grab tool (key 2) and throw it into the green zone.',
    hint: 'A nudge is enough — the Force tool pushes everything inside your arrow rectangle.',
    par: 45,
    camera: { x: 2000, y: 1700 },
    items: [
      item('ball', 1400, 1990),
      GOAL_ZONE(2500, 1985, 220, 150),
      item('crate', 1900, 2020),
      item('brick', 1750, 2020),
    ],
    goals: [{ id: 'ball_in_zone', label: 'Ball inside the goal zone', type: 'zone', kind: 'ball', zone: { x: 2500, y: 1985, w: 220, h: 150 }, hold: 0.35 }],
  },

  {
    id: 'air_mail',
    index: 2,
    name: 'Air Mail',
    level: 'playground',
    objective: 'Land a ragdoll on the high platform.',
    instructions:
      'Spawn a ragdoll (key 4) above the trampoline so it bounces up onto the platform, or fling it with the Force tool. It must stay on the platform briefly to count.',
    hint: 'Bouncy characters bounce highest — try the Bouncy preset, or set gravity lower.',
    par: 60,
    camera: { x: 1400, y: 1600 },
    items: [
      item('platform', 1000, 1500, { width: 620, height: 30, static: true }),
      GOAL_ZONE(1000, 1400, 320, 150),
      item('bouncyPad', 900, 2040),
      item('bouncyPad', 1150, 2040),
      item('crate', 1500, 2020),
    ],
    goals: [{ id: 'ragdoll_on_high', label: 'Ragdoll on the high platform', type: 'zone', kind: 'ragdoll', zone: { x: 1000, y: 1400, w: 320, h: 150 }, hold: 0.8 }],
  },

  {
    id: 'bridge_builder',
    index: 3,
    name: 'Bridge Builder',
    level: 'laboratory',
    objective: 'Bridge the gap so the heavy sphere rolls into the goal.',
    instructions:
      'The sphere sits on the left platform. Spawn planks, crates or platforms to build a bridge across the gap, then push the sphere along it into the goal zone on the right platform.',
    hint: 'Planks are long and cheap. Drag them with the Grab tool to position them precisely.',
    par: 120,
    camera: { x: 2100, y: 1500 },
    items: [
      item('platform', 1100, 1500, { width: 700, height: 32, static: true }),
      item('platform', 3000, 1500, { width: 700, height: 32, static: true }),
      item('heavySphere', 1150, 1420),
      GOAL_ZONE(3150, 1400, 220, 150),
      item('plank', 3600, 2020),
      item('crate', 700, 2020),
    ],
    goals: [{ id: 'sphere_delivered', label: 'Heavy sphere in the goal zone', type: 'zone', kind: 'type', objectType: 'heavySphere', zone: { x: 3150, y: 1400, w: 220, h: 150 }, hold: 0.4 }],
  },

  {
    id: 'rope_swing',
    index: 4,
    name: 'Rope Swing',
    level: 'playground',
    objective: 'Swing a ragdoll across the spike pit into the goal zone.',
    instructions:
      'A rope hangs from the ceiling beam. Grab its lower end with the joint tool: select the rope tip, shift-click a ragdoll, then press Create Joint. Push the ragdoll to swing, then cut the rope (Eraser) to drop into the zone. Any other method that avoids the pit works too.',
    hint: 'Attach the rope to the ragdoll torso, then use a small explosion or a push to start the swing.',
    par: 90,
    camera: { x: 2100, y: 1400 },
    items: [
      item('platform', 900, 1600, { width: 520, height: 30, static: true }),
      item('platform', 3300, 1600, { width: 520, height: 30, static: true }),
      item('hazard', 2100, 2130, { width: 1500, height: 90, static: true }),
      item('platform', 2100, 760, { width: 140, height: 40, static: true }),
      item('rope', 2100, 860, { length: 460, segments: 12 }),
      GOAL_ZONE(3300, 1500, 220, 150),
    ],
    goals: [
      { id: 'swing_reach', label: 'Ragdoll in the far goal zone', type: 'zone', kind: 'ragdoll', zone: { x: 3300, y: 1500, w: 220, h: 150 }, hold: 0.6 },
    ],
    failIf: [{ id: 'no_pit', label: 'Do not fall in the pit', type: 'hazardTouched' }],
  },

  {
    id: 'boom_booth',
    index: 5,
    name: 'Boom Booth',
    level: 'industrial',
    objective: 'Destroy all three targets with a single explosion.',
    instructions:
      'Roll an explosive barrel next to the three targets (or spawn a fresh one) and set it off with the Explosion tool. All three targets must break within the same blast.',
    hint: 'Barrels explode when hit hard, when burned by another blast, or via the Explosion tool.',
    par: 60,
    camera: { x: 2000, y: 1800 },
    items: [
      item('target', 2000, 1990, { static: true }),
      item('target', 2140, 1990, { static: true }),
      item('target', 2280, 1990, { static: true }),
      item('explosiveBarrel', 1500, 2000),
      item('metalBox', 1250, 2020),
    ],
    goals: [{ id: 'triple', label: '3 targets in one blast', type: 'explosionDestroy', count: 3, within: 3 }],
  },

  {
    id: 'obstacle_course',
    index: 6,
    name: 'Obstacle Course',
    level: 'industrial',
    objective: 'Get a ragdoll past the pistons and pit to the finish pad.',
    instructions:
      'Navigate the stepped platforms. The pits are lethal for scoring, so build bridges, use the moving piston, or ride the rotating platform. Reach the finish pad on the far right.',
    hint: 'Drawing platforms (key 0) lets you build a solid path over the pit.',
    par: 150,
    camera: { x: 2100, y: 1700 },
    items: [
      item('platform', 600, 1750, { width: 700, height: 32, static: true }),
      item('platform', 1700, 1850, { width: 340, height: 28, static: true }),
      item('platform', 2500, 1700, { width: 340, height: 28, static: true }),
      item('platform', 3600, 1750, { width: 720, height: 32, static: true }),
      item('piston', 2150, 1800),
      item('rotatingPlatform', 2900, 1450, { width: 420, height: 26 }),
      item('hazard', 1600, 2180, { width: 900, height: 90, static: true }),
      item('hazard', 3400, 2180, { width: 700, height: 90, static: true }),
      GOAL_ZONE(3650, 1660, 240, 150),
    ],
    goals: [{ id: 'course_finish', label: 'Ragdoll on the finish pad', type: 'zone', kind: 'ragdoll', zone: { x: 3650, y: 1660, w: 240, h: 150 }, hold: 0.6 }],
    failIf: [{ id: 'no_pit', label: 'Avoid the pits', type: 'hazardTouched' }],
  },

  {
    id: 'lever_logic',
    index: 7,
    name: 'Lever Logic',
    level: 'laboratory',
    objective: 'Use the lever to launch the crate into the high goal zone.',
    instructions:
      'Drop something heavy (Heavy Sphere, Metal Box) onto the lowered side of the lever to catapult the crate up to the platform on the right. The floor between is electrified, so rolling it across will not work.',
    hint: 'Heavier weight or a bigger drop height means a bigger launch. The plank on the ground is spare material.',
    par: 90,
    camera: { x: 2100, y: 1700 },
    items: [
      item('lever', 1500, 1960),
      item('crate', 1660, 1880),
      item('platform', 2500, 1660, { width: 420, height: 30, static: true }),
      GOAL_ZONE(2500, 1540, 300, 160),
      item('hazard', 2100, 2130, { width: 900, height: 90, static: true }),
      item('plank', 800, 2020),
      item('brick', 700, 2020),
    ],
    goals: [{ id: 'crate_up', label: 'Crate in the upper goal zone', type: 'zone', kind: 'type', objectType: 'crate', zone: { x: 2500, y: 1540, w: 300, h: 160 }, hold: 0.3 }],
  },

  {
    id: 'moon_walk',
    index: 8,
    name: 'Moon Walk',
    level: 'station',
    objective: 'In low gravity, reach the floating goal zone.',
    instructions:
      'Gravity here is only 28% of Earth. Walk and jump a ragdoll up the drifting platforms, or build a bouncy route. The goal hovers high above the middle platform.',
    hint: 'Use W/Space to jump. Helium balloons lift characters upward.',
    par: 120,
    camera: { x: 2100, y: 1300 },
    items: [
      item('platform', 700, 1600, { width: 900, height: 34, static: true }),
      item('platform', 1500, 1200, { width: 320, height: 26, static: true }),
      item('platform', 2300, 1000, { width: 320, height: 26, static: true }),
      item('platform', 3200, 1400, { width: 700, height: 30, static: true }),
      GOAL_ZONE(2100, 800, 260, 180),
      item('balloon', 1700, 1600),
      item('bouncyPad', 900, 1560),
    ],
    goals: [{ id: 'moon_goal', label: 'Ragdoll in the floating zone', type: 'zone', kind: 'ragdoll', zone: { x: 2100, y: 800, w: 260, h: 180 }, hold: 0.6 }],
  },

  {
    id: 'cannonball_run',
    index: 9,
    name: 'Cannonball Run',
    level: 'industrial',
    objective: 'Fire a ball from the cannon into the goal zone.',
    instructions:
      'Select the cannon and adjust its angle and muzzle power in the inspector, then press Fire. The ball must reach the glowing zone on the far shelf.',
    hint: 'Aim up and to the right. 30–40° is a good starting angle.',
    par: 60,
    camera: { x: 2100, y: 1600 },
    items: [
      item('cannon', 800, 1980, { angle: -35, power: 30, length: 110 }),
      item('platform', 3400, 1380, { width: 520, height: 30, static: true }),
      GOAL_ZONE(3400, 1270, 260, 160),
      item('ball', 950, 2020),
      item('crate', 1200, 2020),
    ],
    goals: [{ id: 'cannon_hit', label: 'Launched ball inside the zone', type: 'zone', kind: 'ball', zone: { x: 3400, y: 1270, w: 260, h: 160 }, hold: 0.2, minSpeed: 2 }],
  },

  {
    id: 'chain_gang',
    index: 10,
    name: 'Chain Gang',
    level: 'arena',
    objective: 'Trigger a chain reaction of at least 4 explosions.',
    instructions:
      'Five explosive barrels stand in a row. Set one off (Explosion tool, or a heavy impact) and let the chain do the rest. Space them out with the Grab tool for a longer chain.',
    hint: 'Each barrel damages neighbours within its blast radius — spacing matters.',
    par: 60,
    camera: { x: 1800, y: 1800 },
    items: [
      item('explosiveBarrel', 1300, 2000),
      item('explosiveBarrel', 1470, 2000),
      item('explosiveBarrel', 1640, 2000),
      item('explosiveBarrel', 1810, 2000),
      item('explosiveBarrel', 1980, 2000),
      item('bomb', 1100, 1960, { fuse: 2.5 }),
    ],
    goals: [{ id: 'chain4', label: 'Explosion chain of 4+', type: 'chain', count: 4 }],
  },

  {
    id: 'belt_courier',
    index: 11,
    name: 'Belt Courier',
    level: 'industrial',
    objective: 'Transport the metal ball across the pit on conveyor belts.',
    instructions:
      'Rotate a conveyor belt in the inspector so it spans the gap, and turn up its speed. Belts push anything resting on top of them. Deliver the ball to the far goal zone.',
    hint: 'The Belt speed and Direction sliders are in the inspector, along with Rotation.',
    par: 150,
    camera: { x: 2100, y: 1700 },
    items: [
      item('platform', 800, 1700, { width: 760, height: 32, static: true }),
      item('platform', 3400, 1700, { width: 760, height: 32, static: true }),
      item('hazard', 2100, 2150, { width: 1400, height: 90, static: true }),
      item('ball', 900, 1630),
      GOAL_ZONE(3500, 1600, 240, 160),
      item('conveyor', 1200, 2020),
      item('conveyor', 1500, 2020, { angle: -0.5 }),
      item('brick', 2100, 1620, { static: true }),
    ],
    goals: [{ id: 'belt_delivery', label: 'Ball in the far goal zone', type: 'zone', kind: 'ball', zone: { x: 3500, y: 1600, w: 240, h: 160 }, hold: 0.3 }],
  },

  {
    id: 'pulley_lift',
    index: 12,
    name: 'Pulley Lift',
    level: 'laboratory',
    objective: 'Use the pulley to lift the heavy sphere into the goal zone.',
    instructions:
      'The pulley has two cradles. Drop the heavy sphere into the right cradle (use the Grab tool) and stack heavy material into the left cradle — the heavier side sinks and lifts the sphere.',
    hint: 'Metal boxes and stone blocks are heavier than wood. The joint tool can pin the sphere to the cradle.',
    par: 120,
    camera: { x: 2100, y: 1200 },
    items: [
      item('pulley', 2100, 700, { length: 320 }),
      item('heavySphere', 700, 2000),
      item('metalBox', 3200, 2000),
      item('stoneBlock', 3400, 2000),
      GOAL_ZONE(1700, 900, 260, 170),
      item('platform', 1000, 2020, { width: 600, height: 30, static: true }),
      item('platform', 3300, 2020, { width: 600, height: 30, static: true }),
    ],
    goals: [{ id: 'lifted', label: 'Heavy sphere in the high zone', type: 'zone', kind: 'type', objectType: 'heavySphere', zone: { x: 1700, y: 900, w: 260, h: 170 }, hold: 0.5 }],
  },

  {
    id: 'platform_hop',
    index: 13,
    name: 'Platform Hop',
    level: 'playground',
    objective: 'Ride the moving platforms across the spike pit.',
    instructions:
      'The platforms slide back and forth over a lethal drop. Time a ragdoll jump, or spawn a longer platform to bridge the last gap. Reach the pad on the far side.',
    hint: 'You can change the travel distance and speed of each moving platform in the inspector.',
    par: 140,
    camera: { x: 2100, y: 1700 },
    items: [
      item('platform', 700, 1700, { width: 700, height: 32, static: true }),
      item('movingPlatform', 1500, 1750, { distance: 620, speed: 1.1, angle: 0 }),
      item('movingPlatform', 2400, 1500, { distance: 520, speed: 1.4, angle: 90 }),
      item('movingPlatform', 3200, 1780, { distance: 420, speed: 1.6, angle: 0 }),
      item('platform', 3800, 1700, { width: 620, height: 32, static: true }),
      item('hazard', 2100, 2160, { width: 2600, height: 90, static: true }),
      GOAL_ZONE(3850, 1600, 240, 150),
    ],
    goals: [{ id: 'hop_done', label: 'Ragdoll on the far pad', type: 'zone', kind: 'ragdoll', zone: { x: 3850, y: 1600, w: 240, h: 150 }, hold: 0.6 }],
    failIf: [{ id: 'no_pit', label: 'Avoid the pit', type: 'hazardTouched' }],
  },

  {
    id: 'ragdoll_launcher',
    index: 14,
    name: 'Ragdoll Launcher',
    level: 'arena',
    objective: 'Launch a ragdoll at least 900 px horizontally.',
    instructions:
      'Build a launcher: a seesaw, a bouncy pad, a cannon or a spring. Fire a ragdoll far enough that it travels 900 px from where it was launched and lands inside the goal zone.',
    hint: 'A spring compressed under a plank gives a reliable catapult. The Explosion tool also works — aim your blast.',
    par: 120,
    camera: { x: 2100, y: 1700 },
    items: [
      item('seesaw', 1300, 1990),
      item('spring', 1800, 1980),
      item('bouncyPad', 2400, 2040),
      item('heavySphere', 700, 2000),
      GOAL_ZONE(3700, 1900, 300, 180),
      item('crate', 1000, 2020),
    ],
    goals: [
      { id: 'launched_far', label: 'Ragdoll launched 900 px', type: 'launch', minDistance: 900, kind: 'ragdoll' },
      { id: 'landed_in_zone', label: 'Ragdoll in the goal zone', type: 'zone', kind: 'ragdoll', zone: { x: 3700, y: 1900, w: 300, h: 180 }, hold: 0.5 },
    ],
  },

  {
    id: 'final_playground',
    index: 15,
    name: 'Final Playground',
    level: 'arena',
    objective: 'Destroy 4 targets, chain 3 explosions and deliver the ball home.',
    instructions:
      'The full toolbox: knock down the four floating targets, set off a three-barrel chain reaction, and finish by getting the metal ball into the goal zone. Everything is fair game.',
    hint: 'Work left to right — barrels first, then use the blast to clear targets, then move the ball.',
    par: 240,
    camera: { x: 2100, y: 1700 },
    items: [
      item('target', 800, 1500, { static: true }),
      item('target', 1300, 1350, { static: true }),
      item('target', 2900, 1350, { static: true }),
      item('target', 3400, 1500, { static: true }),
      item('explosiveBarrel', 1900, 1990),
      item('explosiveBarrel', 2060, 1990),
      item('explosiveBarrel', 2220, 1990),
      item('heavySphere', 600, 1990),
      GOAL_ZONE(3700, 1900, 280, 180),
      item('platform', 800, 1650, { width: 500, height: 30, static: true }),
      item('platform', 3400, 1650, { width: 500, height: 30, static: true }),
    ],
    goals: [
      { id: 'targets_down', label: '4 targets destroyed', type: 'destroy', count: 4, tag: 'target' },
      { id: 'chain3', label: 'Explosion chain of 3+', type: 'chain', count: 3 },
      { id: 'ball_home', label: 'Heavy sphere in the goal zone', type: 'zone', kind: 'type', objectType: 'heavySphere', zone: { x: 3700, y: 1900, w: 280, h: 180 }, hold: 0.4 },
    ],
  },
];

export const getChallenge = (id) => CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
export const challengeCount = () => CHALLENGES.length;

/**
 * Flexible (non data-driven) level items: challenge scenes also inherit the
 * level's own props but not its decorative clutter, so puzzles stay readable.
 */
export const challengeFloorY = FLOOR_Y;
