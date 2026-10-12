/**
 * Environments.
 *
 * Each level is pure data: a palette, decorative background elements and a list
 * of physics items (`{ type, x, y, ...overrides }` referencing the object
 * catalogue). Both sandbox levels and challenge levels are built from these.
 */

import { WORLD } from './gameConfig.js';

export const FLOOR_Y = 2060;

export const LEVELS = [
  {
    id: 'laboratory',
    name: 'Bright Laboratory',
    description: 'Tiled floors, humming machines and plenty of room to experiment.',
    gravity: { x: 0, y: 1, scale: 1 },
    ambient: 'bubbles',
    palette: {
      skyTop: '#dff3ff',
      skyBottom: '#a8d8f0',
      wall: '#eaf6ff',
      ground: '#8fb6cc',
      groundEdge: '#6c93aa',
      platform: '#c9e6f7',
      platformEdge: '#7ba7c4',
      accent: '#ff7a59',
      ink: '#22384d',
      grid: 'rgba(60,110,150,0.16)',
    },
    decorations: [
      { kind: 'window', x: 420, y: 520, w: 520, h: 320 },
      { kind: 'window', x: 1500, y: 460, w: 380, h: 260 },
      { kind: 'pipe', x: 260, y: 900, w: 40, h: 700 },
      { kind: 'shelf', x: 1150, y: 780, w: 300, h: 26 },
      { kind: 'lamp', x: 1050, y: 120, w: 220, h: 60 },
      { kind: 'lamp', x: 2400, y: 120, w: 220, h: 60 },
      { kind: 'machine', x: 3000, y: 1620, w: 300, h: 380 },
      { kind: 'crate', x: 3560, y: 1700, w: 120, h: 120 },
      { kind: 'crate', x: 3700, y: 1740, w: 100, h: 100 },
      { kind: 'plant', x: 3800, y: 1900, w: 90, h: 140 },
    ],
    items: [
      { type: 'platform', x: 1050, y: 1700, width: 700, height: 32, static: true },
      { type: 'platform', x: 2600, y: 1520, width: 520, height: 30, static: true },
      { type: 'platform', x: 3400, y: 1900, width: 460, height: 30, static: true },
      { type: 'ramp', x: 1900, y: 2000, scale: 1.2, static: true },
      { type: 'crate', x: 980, y: 1630 },
      { type: 'crate', x: 1060, y: 1630 },
      { type: 'ball', x: 2600, y: 1450 },
      { type: 'barrel', x: 3300, y: 1850 },
    ],
  },
  {
    id: 'playground',
    name: 'Playground',
    description: 'Sunny park with a slide, swings and a trampoline.',
    gravity: { x: 0, y: 1, scale: 1 },
    ambient: 'leaves',
    palette: {
      skyTop: '#bfe9ff',
      skyBottom: '#8fd6a5',
      wall: '#cdeedd',
      ground: '#7dc98a',
      groundEdge: '#4f9a5d',
      platform: '#f6d36b',
      platformEdge: '#c79c2b',
      accent: '#ff7a59',
      ink: '#26412f',
      grid: 'rgba(40,110,70,0.14)',
    },
    decorations: [
      { kind: 'cloud', x: 520, y: 260, w: 320, h: 130 },
      { kind: 'cloud', x: 1900, y: 190, w: 420, h: 150 },
      { kind: 'cloud', x: 3300, y: 300, w: 300, h: 120 },
      { kind: 'tree', x: 300, y: 1800, w: 220, h: 420 },
      { kind: 'tree', x: 3900, y: 1840, w: 200, h: 380 },
      { kind: 'swing', x: 1500, y: 900, w: 420, h: 460 },
      { kind: 'lamp', x: 2600, y: 220, w: 180, h: 54 },
      { kind: 'slide', x: 3000, y: 1980, w: 420, h: 300 },
    ],
    items: [
      { type: 'platform', x: 1000, y: 1600, width: 520, height: 28, static: true },
      { type: 'platform', x: 2300, y: 1350, width: 420, height: 28, static: true },
      { type: 'ramp', x: 3050, y: 1900, scale: 1.4, static: true },
      { type: 'seesaw', x: 1800, y: 2020 },
      { type: 'bouncyPad', x: 2200, y: 2040 },
      { type: 'tyre', x: 3400, y: 1990 },
      { type: 'tyre', x: 3520, y: 1990 },
      { type: 'ball', x: 1150, y: 1520 },
      { type: 'rope', x: 1500, y: 1360 },
    ],
  },
  {
    id: 'industrial',
    name: 'Industrial Test Chamber',
    description: 'Conveyors, pistons and a very hungry pit.',
    gravity: { x: 0, y: 1, scale: 1.15 },
    ambient: 'sparks',
    palette: {
      skyTop: '#3a4152',
      skyBottom: '#22262f',
      wall: '#2e3440',
      ground: '#5b6472',
      groundEdge: '#3b424e',
      platform: '#7d8794',
      platformEdge: '#4a515c',
      accent: '#ffc93c',
      ink: '#e8eef7',
      grid: 'rgba(255,255,255,0.07)',
    },
    decorations: [
      { kind: 'pipe', x: 300, y: 700, w: 54, h: 900 },
      { kind: 'pipe', x: 3900, y: 620, w: 54, h: 1000 },
      { kind: 'machine', x: 900, y: 1500, w: 340, h: 420 },
      { kind: 'machine', x: 3000, y: 1420, w: 380, h: 440 },
      { kind: 'lamp', x: 1400, y: 140, w: 200, h: 54 },
      { kind: 'lamp', x: 2800, y: 140, w: 200, h: 54 },
      { kind: 'banner', x: 2100, y: 320, w: 420, h: 130 },
    ],
    items: [
      { type: 'platform', x: 700, y: 1720, width: 900, height: 34, static: true },
      { type: 'platform', x: 3500, y: 1720, width: 900, height: 34, static: true },
      { type: 'hazard', x: 2100, y: 2140, width: 1500, height: 80, static: true },
      { type: 'conveyor', x: 700, y: 1690 },
      { type: 'piston', x: 2600, y: 1600 },
      { type: 'rotatingPlatform', x: 2100, y: 1300, width: 380, height: 26 },
      { type: 'metalBox', x: 1600, y: 1600 },
      { type: 'metalBox', x: 1700, y: 1600 },
      { type: 'explosiveBarrel', x: 3000, y: 1640 },
      { type: 'heavySphere', x: 3600, y: 1600 },
    ],
  },
  {
    id: 'island',
    name: 'Floating Island',
    description: 'Sky-high platforms, long drops and balloons.',
    gravity: { x: 0, y: 1, scale: 0.85 },
    ambient: 'clouds',
    palette: {
      skyTop: '#7fc7ff',
      skyBottom: '#d6f0ff',
      wall: '#bfe4ff',
      ground: '#8ad06f',
      groundEdge: '#5b9b47',
      platform: '#c98f5a',
      platformEdge: '#8c5c33',
      accent: '#ff7a59',
      ink: '#2b3f57',
      grid: 'rgba(255,255,255,0.12)',
    },
    decorations: [
      { kind: 'cloud', x: 700, y: 420, w: 520, h: 180 },
      { kind: 'cloud', x: 2400, y: 300, w: 620, h: 200 },
      { kind: 'cloud', x: 3500, y: 620, w: 460, h: 160 },
      { kind: 'island', x: 500, y: 1500, w: 900, h: 320 },
      { kind: 'island', x: 2400, y: 1250, w: 700, h: 260 },
      { kind: 'island', x: 3800, y: 1650, w: 620, h: 240 },
      { kind: 'planet', x: 3700, y: 260, w: 160, h: 160 },
    ],
    items: [
      { type: 'platform', x: 900, y: 1650, width: 900, height: 40, static: true },
      { type: 'platform', x: 2400, y: 1400, width: 620, height: 36, static: true },
      { type: 'platform', x: 3600, y: 1780, width: 760, height: 36, static: true },
      { type: 'platform', x: 1650, y: 1150, width: 240, height: 26, static: true },
      { type: 'platform', x: 3100, y: 1000, width: 240, height: 26, static: true },
      { type: 'balloon', x: 1600, y: 800 },
      { type: 'balloon', x: 2700, y: 700 },
      { type: 'crate', x: 1000, y: 1580 },
      { type: 'ball', x: 2500, y: 1330 },
    ],
  },
  {
    id: 'station',
    name: 'Space Station',
    description: 'Low gravity ring station. Objects drift forever.',
    gravity: { x: 0, y: 1, scale: 0.28 },
    ambient: 'stars',
    palette: {
      skyTop: '#0b1030',
      skyBottom: '#1d2350',
      wall: '#232a4d',
      ground: '#4c5688',
      groundEdge: '#2e3560',
      platform: '#8d9bd6',
      platformEdge: '#525d94',
      accent: '#38e07b',
      ink: '#eef3ff',
      grid: 'rgba(160,190,255,0.14)',
    },
    decorations: [
      { kind: 'stars', x: 0, y: 0, w: WORLD.width, h: 1400 },
      { kind: 'planet', x: 3400, y: 520, w: 420, h: 420 },
      { kind: 'satellite', x: 1200, y: 420, w: 260, h: 140 },
      { kind: 'panel', x: 2500, y: 760, w: 420, h: 160 },
      { kind: 'pipe', x: 200, y: 800, w: 40, h: 800 },
      { kind: 'lamp', x: 2100, y: 160, w: 260, h: 50 },
    ],
    items: [
      { type: 'platform', x: 700, y: 1600, width: 900, height: 34, static: true },
      { type: 'platform', x: 2100, y: 1320, width: 700, height: 30, static: true },
      { type: 'platform', x: 3500, y: 1480, width: 800, height: 30, static: true },
      { type: 'platform', x: 2900, y: 900, width: 300, height: 26, static: true },
      { type: 'gravityWell', x: 2100, y: 900, radius: 360, strength: 0.8 },
      { type: 'metalBox', x: 1400, y: 1500 },
      { type: 'metalBox', x: 1500, y: 1500 },
      { type: 'ball', x: 2200, y: 1200 },
      { type: 'glassPane', x: 700, y: 1520 },
    ],
  },
  {
    id: 'arena',
    name: 'Destruction Arena',
    description: 'A walled pit with towers, barrels and scoreboards.',
    gravity: { x: 0, y: 1, scale: 1.1 },
    ambient: 'dust',
    palette: {
      skyTop: '#553a56',
      skyBottom: '#2c1c33',
      wall: '#3a2438',
      ground: '#7a5a4b',
      groundEdge: '#4f3a30',
      platform: '#b08a6a',
      platformEdge: '#6f5340',
      accent: '#ff5d6c',
      ink: '#ffe9e3',
      grid: 'rgba(255,190,150,0.1)',
    },
    decorations: [
      { kind: 'banner', x: 900, y: 360, w: 520, h: 160 },
      { kind: 'banner', x: 3300, y: 360, w: 520, h: 160 },
      { kind: 'lamp', x: 1400, y: 150, w: 220, h: 56 },
      { kind: 'lamp', x: 2800, y: 150, w: 220, h: 56 },
      { kind: 'crate', x: 400, y: 1800, w: 160, h: 160 },
      { kind: 'crate', x: 3800, y: 1820, w: 140, h: 140 },
      { kind: 'machine', x: 2100, y: 1650, w: 360, h: 460 },
    ],
    items: [
      { type: 'platform', x: 2100, y: 1820, width: 700, height: 34, static: true },
      { type: 'platform', x: 800, y: 1560, width: 460, height: 30, static: true },
      { type: 'platform', x: 3400, y: 1560, width: 460, height: 30, static: true },
      { type: 'wall', x: 900, y: 1450 },
      { type: 'wall', x: 1600, y: 1450 },
      { type: 'wall', x: 2600, y: 1450 },
      { type: 'crateTower', x: 1200, y: 2000 },
      { type: 'crateTower', x: 3000, y: 2000 },
      { type: 'explosiveBarrel', x: 1800, y: 1600 },
      { type: 'explosiveBarrel', x: 2400, y: 1600 },
      { type: 'target', x: 3600, y: 1260, static: true },
      { type: 'target', x: 600, y: 1260, static: true },
      { type: 'tyre', x: 2100, y: 1600 },
      { type: 'ball', x: 700, y: 1440 },
    ],
  },
];

export const LEVEL_IDS = LEVELS.map((l) => l.id);

export const getLevel = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];

/**
 * Full static scene for a level: floor, side walls, ceiling stopper and the
 * level's own items. The sandbox never leaves the player without ground.
 */
export function buildLevelScene(levelId) {
  const level = getLevel(levelId);
  const width = WORLD.width;
  const palette = level.palette;
  const platforms = [
    {
      type: 'platform',
      x: width / 2,
      y: FLOOR_Y + 200,
      width: width + 400,
      height: 400,
      static: true,
      color: palette.ground,
      level: true,
    },
    { type: 'wall', x: -60, y: WORLD.height / 2 - 200, width: 120, height: WORLD.height + 1200, static: true, color: palette.groundEdge, level: true },
    { type: 'wall', x: width + 60, y: WORLD.height / 2 - 200, width: 120, height: WORLD.height + 1200, static: true, color: palette.groundEdge, level: true },
    { type: 'wall', x: width / 2, y: -200, width: width + 400, height: 120, static: true, color: palette.groundEdge, level: true },
  ];

  return {
    level,
    platforms,
    items: level.items.map((item) => ({ ...item, level: true })),
    decorations: level.decorations ?? [],
    ambient: level.ambient,
  };
}

/** Preview swatch colours for the level-select cards. */
export const levelPreviewColors = (level) => [level.palette.skyTop, level.palette.skyBottom, level.palette.ground];
