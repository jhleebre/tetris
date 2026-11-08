import { prefs } from '../util/storage.js';

// All sounds are synthesised with WebAudio, so there are no audio files to load.
// The context starts on the first user gesture (browsers block autoplay).
const NOTES = [523, 659, 784, 1047, 1319]; // C major arpeggio for line clears

export const sound = {
  ctx: null, out: null, muted: prefs.muted,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : .5; this.out.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol, f0, f1, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = buf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t);
  },

  move() { this.tone('square', 480, 460, .03, .035); },
  rotate() { this.tone('triangle', 660, 880, .05, .07); },
  hold() { this.tone('sine', 380, 760, .12, .12); },
  softDrop() { this.tone('triangle', 520, 260, .08, .08); },
  drop() { this.noise(.14, .3, 1400, 90); this.tone('triangle', 170, 55, .14, .22); },
  lock() { this.tone('triangle', 240, 190, .06, .1); },
  /** n lines at once; the pitch climbs with the combo count. */
  clear(n, combo) {
    const k = Math.pow(2, Math.min(12, Math.max(0, combo)) / 12);
    for (let i = 0; i < n + (n === 4 ? 1 : 0); i++) this.tone('triangle', NOTES[i] * k, NOTES[i] * k, .16, .16, i * .055);
    if (n === 4) { this.noise(.6, .18, 5000, 800, .1); this.tone('sine', 2093 * k, 2093 * k, .35, .06, .25); }
  },
  level() { [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, f, .12, .08, i * .07)); },
  over() { this.tone('sawtooth', 300, 40, 1.1, .18); this.noise(.9, .25, 1200, 60); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, .25, .18, i * .11)); },

  /** Flips mute, remembers it, and returns the new state. */
  toggleMute() {
    this.muted = !this.muted; prefs.muted = this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : .5;
    return this.muted;
  },
};
