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

