/**
 * SFX — procedural WebAudio sound effects.
 *
 * No audio files are shipped: every sound is synthesised on demand from
 * oscillators and a small noise buffer, which keeps the bundle tiny and makes
 * pitch/volume variation trivial. Collisions can fire hundreds of times per
 * second, so playback is throttled per-material and globally.
 */

import { SOUNDS } from '../config/gameConfig.js';
import { clamp } from '../utils/mathUtils.js';

const clamp01 = (v) => clamp(Number(v) || 0, 0, 1);

export class SFX {
  constructor(ctx = {}) {
    this.ctx = ctx;
    this.audio = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.unlocked = false;
    this.lastPlayed = new Map();   // sound -> performance.now()
    this.globalBudget = 6;
    this.budgetWindow = 100;
    this.windowStart = 0;
    this.budgetUsed = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.settings = ctx.settings ?? null;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.audio) return this.audio;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audio = new Ctor();
      this.master = this.audio.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.audio.destination);

      this.sfxGain = this.audio.createGain();
      this.sfxGain.gain.value = this.volume;
      this.sfxGain.connect(this.master);

      this.musicGain = this.audio.createGain();
      this.musicGain.gain.value = this.enabled && this.musicEnabled ? 0.16 : 0;
      this.musicGain.connect(this.master);

      this.noiseBuffer = this.makeNoiseBuffer(1.2);
      this.unlocked = true;
    } catch (err) {
      console.warn('[sfx] audio unavailable', err);
      this.audio = null;
    }
    return this.audio;
  }

  resume() {
    if (!this.audio) this.init();
    if (this.audio?.state === 'suspended') this.audio.resume().catch(() => {});
  }

  get enabled() {
    return this.settings?.get('sfxEnabled') !== false;
  }

  get musicEnabled() {
    return this.settings?.get('musicEnabled') !== false;
  }

  get volume() {
    const v = this.settings?.get('masterVolume');
    return typeof v === 'number' ? clamp(v, 0, 1) : 0.7;
  }

  applyVolume() {
    if (!this.audio) return;
    this.sfxGain.gain.value = this.enabled ? this.volume : 0;
    this.musicGain.gain.value = this.enabled && this.musicEnabled ? this.volume * 0.22 : 0;
    this.master.gain.value = 0.9;
  }

  /* ------------------------------------------------------------ utilities */

  makeNoiseBuffer(seconds) {
    const rate = this.audio.sampleRate;
    const buffer = this.audio.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /**
   * Global + per-sound throttling so a collapsing tower does not clip.
   * @returns {boolean} whether the sound may play now
   */
  allow(key, minGapMs = 24) {
    if (!this.enabled || !this.audio) return false;
    const now = performance.now();
    if (now - this.windowStart > this.budgetWindow) {
      this.windowStart = now;
      this.budgetUsed = 0;
    }
    if (this.budgetUsed >= this.globalBudget) return false;
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < minGapMs) return false;
    this.lastPlayed.set(key, now);
    this.budgetUsed += 1;
    return true;
  }

  /** Simple oscillator blip. */
  tone({ freq = 440, duration = 0.12, type = 'sine', gain = 0.2, sweep = null, delay = 0, curve = 'exp' }) {
    if (!this.audio) return;
    const t0 = this.audio.currentTime + delay;
    const osc = this.audio.createOscillator();
    const g = this.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (sweep) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + duration);
      else osc.frequency.linearRampToValueAtTime(Math.max(20, sweep), t0 + duration);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + Math.min(0.012, duration * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Filtered noise burst (impacts, explosions, dust). */
  noise({ duration = 0.2, gain = 0.2, filter = 'lowpass', freq = 900, q = 1, delay = 0, sweepTo = null }) {
    if (!this.audio || !this.noiseBuffer) return;
    const t0 = this.audio.currentTime + delay;
    const src = this.audio.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = false;
    const f = this.audio.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + duration);
    const g = this.audio.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /* ---------------------------------------------------------- game sounds */

  /** Collision impact; `intensity` 0..1, `speed` px/step. */
  impact(materialKey = 'wood', intensity = 0.4, speed = 0) {
    const material = SOUNDS.materials?.[materialKey] ?? SOUNDS.materials?.wood ?? { type: 'noise', freq: 420, duration: 0.09 };
    const key = `impact:${materialKey}`;
    if (!this.allow(key, material.gap ?? 40)) return;
    const amp = clamp01(intensity) * (material.gain ?? 0.2);
    if (material.type === 'metal') {
      this.noise({ duration: material.duration, gain: amp * 0.7, filter: 'highpass', freq: material.freq, q: 1.2 });
      this.tone({ freq: material.freq * 1.5, duration: material.duration, type: 'triangle', gain: amp * 0.5, sweep: material.freq });
    } else if (material.type === 'glass') {
      this.noise({ duration: material.duration, gain: amp * 0.8, filter: 'highpass', freq: material.freq, q: 0.8 });
      this.tone({ freq: material.freq * 2, duration: material.duration * 1.4, type: 'sine', gain: amp * 0.35 });
    } else if (material.type === 'spring') {
      this.spring(amp);
    } else {
      this.noise({ duration: material.duration, gain: amp, filter: 'lowpass', freq: material.freq, q: 0.7, sweepTo: material.freq * 0.5 });
    }
    if (speed > 10) this.tone({ freq: 120, duration: 0.07, type: 'sine', gain: amp * 0.35, sweep: 60 });
  }

  /** Big explosion: low boom + crackle. `volume` 0..1 */
  explosion(volume = 0.8) {
    if (!this.allow('explosion', 60)) return;
    const v = clamp01(volume);
    this.tone({ freq: 140, duration: 0.55, type: 'sawtooth', gain: 0.22 * v, sweep: 36 });
    this.noise({ duration: 0.75, gain: 0.34 * v, filter: 'lowpass', freq: 1500, q: 0.6, sweepTo: 120 });
    this.noise({ duration: 0.3, gain: 0.2 * v, filter: 'bandpass', freq: 2400, q: 0.8, delay: 0.03 });
    this.tone({ freq: 70, duration: 0.9, type: 'sine', gain: 0.18 * v, sweep: 30 });
  }

  spring(strength = 0.4) {
    if (!this.allow('spring', 45)) return;
    const v = clamp01(strength);
    this.tone({ freq: 520 + v * 260, duration: 0.26, type: 'triangle', gain: 0.16 * (0.4 + v), sweep: 180, curve: 'exp' });
  }

  /** Generic "something hit the floor" thud. */
  hit(strength = 0.5) {
    if (!this.allow('hit', 60)) return;
    const v = clamp01(strength);
    this.tone({ freq: 110, duration: 0.14, type: 'sine', gain: 0.2 * (0.35 + v), sweep: 55 });
    this.noise({ duration: 0.12, gain: 0.12 * v, filter: 'lowpass', freq: 700 });
  }

  bounce(strength = 0.4) {
    if (!this.allow('bounce', 50)) return;
    const v = clamp01(strength);
    this.tone({ freq: 300 + v * 320, duration: 0.16, type: 'sine', gain: 0.16, sweep: 720 + v * 300, curve: 'exp' });
  }

  break(material = 'wood') {
    if (!this.allow('break', 70)) return;
    if (material === 'metal') {
      this.noise({ duration: 0.35, gain: 0.22, filter: 'highpass', freq: 1800, q: 1.4 });
      this.tone({ freq: 900, duration: 0.3, type: 'triangle', gain: 0.12, sweep: 320 });
    } else if (material === 'glass') {
      this.noise({ duration: 0.45, gain: 0.26, filter: 'highpass', freq: 2600, q: 0.9 });
      this.tone({ freq: 1800, duration: 0.2, type: 'sine', gain: 0.1, sweep: 900 });
    } else {
      this.noise({ duration: 0.3, gain: 0.24, filter: 'bandpass', freq: 900, q: 0.6, sweepTo: 300 });
      this.tone({ freq: 220, duration: 0.2, type: 'square', gain: 0.08, sweep: 90 });
    }
  }

  hazard() {
    if (!this.allow('hazard', 250)) return;
    this.tone({ freq: 220, duration: 0.12, type: 'square', gain: 0.1, sweep: 180 });
    this.tone({ freq: 300, duration: 0.12, type: 'square', gain: 0.09, sweep: 240, delay: 0.14 });
  }

  teleport() {
    if (!this.allow('teleport', 90)) return;
    this.tone({ freq: 300, duration: 0.28, type: 'sine', gain: 0.14, sweep: 1600, curve: 'linear' });
    this.tone({ freq: 1600, duration: 0.22, type: 'sine', gain: 0.1, sweep: 400, delay: 0.05, curve: 'linear' });
  }

  whoosh(strength = 0.5) {
    if (!this.allow('whoosh', 90)) return;
    const v = clamp01(strength);
    this.noise({ duration: 0.42, gain: 0.16 * (0.4 + v), filter: 'bandpass', freq: 700, q: 0.7, sweepTo: 220 });
  }

  /** Physics props with their own voice. */
  prop(kind, strength = 0.5) {
    const v = clamp01(strength);
    switch (kind) {
      case 'cannon':
        if (!this.allow('cannon', 120)) return;
        this.noise({ duration: 0.4, gain: 0.3, filter: 'lowpass', freq: 1200, sweepTo: 180 });
        this.tone({ freq: 90, duration: 0.4, type: 'sawtooth', gain: 0.2, sweep: 40 });
        break;
      case 'balloon':
        if (!this.allow('balloon', 80)) return;
        this.noise({ duration: 0.1, gain: 0.3, filter: 'highpass', freq: 3200 });
        this.tone({ freq: 700, duration: 0.07, type: 'square', gain: 0.14, sweep: 200 });
        break;
      case 'fuse':
        if (!this.allow('fuse', 140)) return;
        this.noise({ duration: 0.18, gain: 0.1, filter: 'highpass', freq: 2600 });
        break;
      case 'motor':
        if (!this.allow('motor', 200)) return;
        this.tone({ freq: 160, duration: 0.2, type: 'sawtooth', gain: 0.07 * (0.4 + v), sweep: 190 });
        break;
      case 'snap':
        if (!this.allow('snap', 90)) return;
        this.tone({ freq: 900, duration: 0.08, type: 'square', gain: 0.12, sweep: 260 });
        break;
      default:
        this.impact('soft', v, 0);
    }
  }

  /* --------------------------------------------------------------- UI/misc */

  uiClick() {
    if (!this.allow('ui', 30)) return;
    this.tone({ freq: 780, duration: 0.045, type: 'square', gain: 0.07, sweep: 620 });
  }

  uiOpen() {
    if (!this.allow('uiOpen', 40)) return;
    this.tone({ freq: 420, duration: 0.09, type: 'sine', gain: 0.09, sweep: 720 });
    this.tone({ freq: 620, duration: 0.1, type: 'sine', gain: 0.06, sweep: 940, delay: 0.06 });
  }

  spawn() {
    if (!this.allow('spawn', 45)) return;
    this.tone({ freq: 320, duration: 0.12, type: 'triangle', gain: 0.11, sweep: 520 });
  }

  error() {
    if (!this.allow('error', 120)) return;
    this.tone({ freq: 220, duration: 0.16, type: 'square', gain: 0.1, sweep: 140 });
  }

  achievement() {
    if (!this.allow('achievement', 200)) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.tone({ freq, duration: 0.22, type: 'triangle', gain: 0.1, delay: i * 0.09 });
    });
  }

  /* -------------------------------------------------------------- music */

  /** Light procedural chiptune loop; quiet background only. */
  startMusic() {
    if (!this.audio || this.musicTimer) return;
    const pattern = [0, 3, 5, 7, 10, 7, 5, 3];
    const root = 220;
    const tick = () => {
      if (!this.musicEnabled) return;
      const step = this.musicStep % pattern.length;
      const semi = pattern[step];
      const freq = root * Math.pow(2, semi / 12);
      this.tone({ freq, duration: 0.32, type: 'triangle', gain: 0.02 });
      if (step % 2 === 0) this.tone({ freq: freq / 2, duration: 0.42, type: 'sine', gain: 0.025 });
      if (step % 4 === 2) this.noise({ duration: 0.05, gain: 0.012, filter: 'highpass', freq: 5200 });
      this.musicStep += 1;
    };
    this.musicTimer = setInterval(tick, 420);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  setMusicPlaying(playing) {
    if (playing) {
      this.resume();
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  destroy() {
    this.stopMusic();
    try {
      this.audio?.close();
    } catch (err) {
      /* ignore */
    }
    this.audio = null;
    this.unlocked = false;
  }
}
