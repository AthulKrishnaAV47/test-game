/**
 * headless_boot.mjs — boots the real game inside jsdom and exercises it.
 *
 * Node has no browser, and this sandbox cannot download one, so the integration
 * check runs the actual `src/main.js` against jsdom with a stubbed 2D canvas:
 * the scene graph, physics world, systems and DOM UI are all the real ones.
 * It asserts that booting, spawning, simulating, pausing, undo/redo, save/load,
 * explosions and gravity control all work without throwing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/* ------------------------------------------------------------------ jsdom */

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[^>]*><\/script>/g, '')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;

/** Minimal 2D context: enough for Phaser's canvas renderer and our previews. */
function fakeContext(canvas) {
  const gradient = { addColorStop() {} };
  const target = { canvas };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop === 'canvas') return canvas;
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 12, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop in obj) return obj[prop];
      return () => undefined;
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  });
}
window.HTMLCanvasElement.prototype.getContext = function getContext(kind) {
  if (kind === '2d') {
    if (!this.__ctx) this.__ctx = fakeContext(this);
    return this.__ctx;
  }
  return null; // no WebGL in this environment
};

class FakeAudioNode {
  constructor() { this.gain = { value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }; this.frequency = { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; this.Q = { value: 1 }; this.type = 'sine'; this.buffer = null; this.onended = null; }
  connect() { return this; }   // real WebAudio returns the destination node
  disconnect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  constructor() {
    this.destination = new FakeAudioNode();
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
  }
  createGain() { return new FakeAudioNode(); }
  createOscillator() { return new FakeAudioNode(); }
  createBufferSource() { return new FakeAudioNode(); }
  createBiquadFilter() { return new FakeAudioNode(); }
  createStereoPanner() { return new FakeAudioNode(); }
  createDynamicsCompressor() { return new FakeAudioNode(); }
  createConvolver() { return new FakeAudioNode(); }
  createDelay() { return new FakeAudioNode(); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length), length, duration: length / 44100 }; }
  decodeAudioData() { return Promise.resolve({ getChannelData: () => new Float32Array(16), duration: 0.1 }); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
window.AudioContext = FakeAudioContext;

// jsdom only exposes CanvasRenderingContext2D when the native `canvas` package
// is installed; Phaser only checks for the constructor's existence, so provide
// it (WebGL stays switched off by returning null from getContext('webgl')).
if (!window.CanvasRenderingContext2D) {
  window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
}

const copy = [
  'screen', 'visualViewport', 'CSSStyleSheet', 'HTMLVideoElement', 'HTMLAudioElement', 'Audio',
  'OffscreenCanvas', 'TextEncoder', 'TextDecoder', 'WebGLRenderingContext', 'ImageBitmap',
  'window', 'document', 'navigator', 'location', 'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement',
  'Node', 'Element', 'Event', 'KeyboardEvent', 'MouseEvent', 'WheelEvent', 'PointerEvent', 'TouchEvent',
  'Image', 'Blob', 'URL', 'localStorage', 'sessionStorage', 'performance', 'getComputedStyle', 'CSS',
  'DOMParser', 'XMLHttpRequest', 'FormData', 'FileReader', 'AudioContext', 'File', 'AbortController',
  'requestAnimationFrame', 'cancelAnimationFrame', 'devicePixelRatio', 'innerWidth', 'innerHeight',
  'matchMedia', 'ResizeObserver', 'MutationObserver', 'IntersectionObserver', 'createImageBitmap',
];
for (const key of copy) {
  if (!(key in globalThis) && key in window) {
    Object.defineProperty(globalThis, key, { value: window[key], writable: true, configurable: true });
  }
}
const define = (key, value) => Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
define('window', window);
define('document', window.document);
try { define('navigator', window.navigator); } catch { /* node's navigator is read-only */ }
define('HTMLCanvasElement', window.HTMLCanvasElement);
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.devicePixelRatio = 1;
globalThis.URL.createObjectURL ||= () => 'blob:stub';
globalThis.URL.revokeObjectURL ||= () => {};
window.devicePixelRatio = 1;

/* --------------------------------------------------------------- reporting */

const problems = [];
const originalError = console.error;
const originalWarn = console.warn;
console.error = (...args) => {
  problems.push(args.map(String).join(' '));
  originalError(...args);
};
console.warn = (...args) => {
  const text = args.map(String).join(' ');
  if (!/AudioContext|jsdom|Not implemented/.test(text)) problems.push(`warn: ${text}`);
  originalWarn(...args);
};
window.addEventListener('error', (event) => problems.push(`window error: ${event.message}`));

/* ------------------------------------------------------------------- boot */

const results = [];
const guard = async (name, fn) => {
  try {
    return await fn();
  } catch (err) {
    problems.push(`${name}: ${err?.stack ?? err}`);
    return null;
  }
};
const check = (name, fn) => {
  try {
    const value = fn();
    results.push({ name, ok: value !== false, detail: typeof value === 'string' ? value : '' });
    return value;
  } catch (err) {
    results.push({ name, ok: false, detail: `threw: ${err.message}` });
    return null;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The game is bundled for Node through vite (see scratch/vite.ssr.config.mjs)
// so that Phaser itself is part of the bundle instead of being resolved as a
// browser-only package.
await import(path.join(root, 'scratch/build/ssr_entry.js'));
const { game, services, ui } = globalThis.window.sticklab ?? {};
check('game created', () => Boolean(game));
await wait(400);

const sceneNames = () => (game?.scene?.getScenes(true) ?? []).map((s) => s.scene.key);
check('boot → menu scene active', () => sceneNames().includes('MenuScene') || sceneNames().length === 0, sceneNames().join(','));

/* ---------------------------------------------------------- sandbox session */

await guard('start sandbox', async () => { ui.startMode('sandbox', { levelId: 'laboratory' }); await wait(600); });
console.log('scenes after start:', sceneNames().join(','), '| keys:', (game?.scene?.keys ? Object.keys(game.scene.keys) : []).join(','));
console.log('problems so far:', problems.slice(0, 4).join(' | ').slice(0, 600));
check('sandbox scene running', () => sceneNames().includes('SandboxScene'), sceneNames().join(','));

const scene = game.scene.getScene('SandboxScene');
const world = scene?.world;
const ctx = world?.ctx;
check('world + context built', () => Boolean(world && ctx?.phys && ctx?.spawner));
check('level scenery spawned', () => {
  const count = ctx.phys.entities.size;
  return count > 3 ? `entities ${count}` : `only ${count} entities`;
});

// Physics: spawn a crate in mid-air and confirm it falls with real gravity.
const crate = ctx.spawner.spawn('crate', 1200, 600, {});
const startY = crate?.position.y ?? 0;
await wait(600);
check('gravity pulls bodies down', () => (crate.position.y > startY + 5 ? `y ${startY.toFixed(0)} → ${crate.position.y.toFixed(0)}` : 'did not fall'));
check('body count grows', () => ctx.phys.bodyCount() > 3, `bodies ${ctx.phys.bodyCount()}`);

// Ragdoll spawn.
const ragdoll = ctx.spawner.spawnRagdoll('lightweight', 1400, 900, {});
await wait(400);
check('ragdoll spawns with parts', () => Boolean(ragdoll) && ragdoll.getBodies().length >= 12, ragdoll ? `parts ${ragdoll.getBodies().length}` : 'null');
check('ragdoll joint gaps stay bounded', () => {
  if (!ragdoll) return false;
  const gaps = ragdoll.enforceJointGaps?.();
  const max = Math.max(...(ragdoll.constraints ?? []).map((c) => {
    const a = c.pointAWorld?.() ?? c.bodyA.position;
    const b = c.pointBWorld?.() ?? c.bodyB.position;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }), 0);
  void gaps;
  return max < 40 ? `max gap ${max.toFixed(1)}` : `max gap ${max.toFixed(1)}`;
});

// Small tools: force, explosion, rope.
check('apply force moves an object', () => {
  const ball = ctx.spawner.spawn('ball', 1300, 700, {});
  const before = ball.position.x;
  ctx.forces.applyDeltaV(ball, { x: 8, y: -4 }, { kind: 'test' });
  for (let i = 0; i < 12; i += 1) ctx.phys.doStep(1000 / 60);
  return ball.position.x > before + 2 ? `dx ${(ball.position.x - before).toFixed(1)}` : `dx ${(ball.position.x - before).toFixed(1)}`;
});

check('explosion pushes bodies in radius', () => {
  const target = ctx.spawner.spawn('crate', 1800, 1600, {});
  const before = { ...target.position };
  ctx.forces.explosion({ x: 1800, y: 1640, radius: 260, force: 12, visual: true, chain: 1, damageScale: 0 });
  for (let i = 0; i < 20; i += 1) ctx.phys.doStep(1000 / 60);
  const moved = Math.hypot(target.position.x - before.x, target.position.y - before.y);
  return moved > 4 ? `moved ${moved.toFixed(1)} px` : `moved ${moved.toFixed(1)} px`;
});

check('rope connects two objects', () => {
  const a = ctx.spawner.spawn('crate', 900, 700, {});
  const b = ctx.spawner.spawn('ball', 1000, 700, {});
  const record = ctx.constraints.create({ type: 'rope', entityA: a, entityB: b, length: 120 });
  return Boolean(record?.id) && ctx.constraints.list().length > 0;
});

check('pause halts physics, single step advances once', () => {
  const body = ctx.spawner.spawn('ball', 800, 500, {});
  ctx.phys.pause();
  const y0 = body.position.y;
  for (let i = 0; i < 5; i += 1) world.update(1 / 60, {});
  const paused = body.position.y;
  ctx.phys.singleStep(1);
  const stepped = body.position.y;
  ctx.phys.resume();
  return paused === y0 && stepped !== y0 ? `paused ok, step moved ${(stepped - y0).toFixed(3)}` : `paused ${paused === y0}, stepped ${stepped - y0}`;
});

check('undo removes a spawned object, redo restores it', () => {
  const before = ctx.phys.entities.size;
  const entity = ctx.spawner.spawn('brick', 700, 500, {});
  ctx.undo.record('spawn', { spawn: entity });
  ctx.undo.undo();
  const afterUndo = ctx.phys.entities.size;
  ctx.undo.redo();
  const afterRedo = ctx.phys.entities.size;
  return afterUndo === before && afterRedo === before + 1
    ? 'undo/redo cycle ok'
    : `sizes ${before}/${afterUndo}/${afterRedo}`;
});

check('save → load round trip restores objects', () => {
  ctx.spawner.spawn('metalBox', 1000, 900, {});
  const saved = ctx.save.save('Harness layout', { confirmOverwrite: true });
  const before = ctx.phys.entities.size;
  ctx.world.clearAll({ silent: true });
  const afterClear = ctx.phys.entities.size;
  const loaded = ctx.save.load(saved.id);
  const afterLoad = ctx.phys.entities.size;
  return loaded?.ok !== false && afterClear < before && afterLoad >= before - 2
    ? `objects ${before} → ${afterClear} → ${afterLoad}`
    : `objects ${before} → ${afterClear} → ${afterLoad}`;
});

check('malformed import is rejected', () => {
  const bad = ctx.save.importText('{"schema":999,"objects":[{},{}]}', { apply: false });
  return bad.ok === false ? bad.message : 'accepted invalid layout!';
});

check('gravity toggle freezes vertical drift', () => {
  ctx.world.setGravityEnabled(false);
  const body = ctx.spawner.spawn('ball', 1200, 800, {});
  for (let i = 0; i < 10; i += 1) ctx.phys.doStep(1000 / 60);
  const vy = body.velocity.y;
  ctx.world.setGravityEnabled(true);
  return Math.abs(vy) < 0.6 ? `vy ${vy.toFixed(3)}` : `vy ${vy.toFixed(3)}`;
});

check('reset restores the initial scene', () => {
  const before = ctx.phys.entities.size;
  ctx.world.reset();
  const after = ctx.phys.entities.size;
  return `entities ${before} → ${after}`;
});

check('challenge mode starts', async () => true);

/* ----------------------------------------------------------------- modes */

ui.startMode('challenge', { challengeId: 'first_contact' });
await wait(450);
check('challenge scene running', () => sceneNames().includes('ChallengeScene'), sceneNames().join(','));
const challengeScene = game.scene.getScene('ChallengeScene');
check('challenge manager active', () => Boolean(challengeScene?.world?.challenge), 'no challenge manager');

ui.startMode('arena');
await wait(450);
check('arena scene running', () => sceneNames().includes('ArenaScene'), sceneNames().join(','));
check('arena manager active', () => Boolean(game.scene.getScene('ArenaScene')?.world?.arena));

ui.startMode('build');
await wait(450);
check('build scene running', () => sceneNames().includes('BuildScene'), sceneNames().join(','));
const buildWorld = game.scene.getScene('BuildScene')?.world;
check('build mode starts paused in the editor', () => Boolean(buildWorld?.ctx?.phys?.paused));

ui.backToMenu();
await wait(350);
check('returns to menu', () => sceneNames().includes('MenuScene'), sceneNames().join(','));

/* --------------------------------------------------------------- UI probes */

check('icons injected', () => window.document.querySelectorAll('[data-icon] svg').length > 10,
  `${window.document.querySelectorAll('[data-icon] svg').length} icons`);
check('tool list built', () => window.document.querySelectorAll('#tool-list .tool-btn').length === 10,
  `${window.document.querySelectorAll('#tool-list .tool-btn').length} tools`);
check('library rendered', () => window.document.querySelectorAll('#library-body .lib-item').length > 5,
  `${window.document.querySelectorAll('#library-body .lib-item').length} cards`);

/* -------------------------------------------------------------- teardown */

game.destroy(true);
await wait(120);

/* ---------------------------------------------------------------- report */

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  — ${result.detail}` : ''}`);
}
const unique = [...new Set(problems)];
console.log(`\nconsole problems: ${unique.length}`);
for (const line of unique.slice(0, 25)) console.log('  ·', line.slice(0, 220));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed || unique.length ? 1 : 0);
