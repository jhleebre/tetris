// Background music, synthesised and scheduled with WebAudio (no audio files).
// A bright 16-bar loop in D major on the canon progression
// (D–A–Bm–F#m–G–D–G–A, played twice): an original melody, then a busier
// variation. Bass, arpeggio, lead with a bell an octave up, kick, clap, hi-hat.
// Tempo rises with the level. Goes through sound.out, so M (mute all) applies too.
import { sound } from './sound.js';
import { prefs } from '../util/storage.js';

const STEPS = 16;                   // sixteenth notes per bar
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// One chord per bar: bass root (stepping down like the canon bass) and arpeggio triad (MIDI)
const CANON = [
  { root: 50, tri: [62, 66, 69] }, // D
  { root: 45, tri: [61, 64, 69] }, // A
  { root: 47, tri: [62, 66, 71] }, // Bm
  { root: 42, tri: [61, 66, 69] }, // F#m
  { root: 43, tri: [62, 67, 71] }, // G
  { root: 38, tri: [62, 66, 69] }, // D
  { root: 43, tri: [62, 67, 71] }, // G
  { root: 45, tri: [61, 64, 69] }, // A
];
const BARS = [...CANON, ...CANON];

// Lead melody per bar: [step, note, length in steps]
const MELODY = [
  // Theme: long, singable notes
  [[0, 78, 4], [4, 81, 4], [8, 86, 6], [14, 85, 2]],
  [[0, 81, 4], [4, 76, 4], [8, 73, 4], [12, 76, 4]],
  [[0, 78, 4], [4, 83, 4], [8, 86, 4], [12, 83, 4]],
  [[0, 81, 6], [6, 78, 2], [8, 73, 8]],
  [[0, 79, 4], [4, 83, 4], [8, 86, 4], [12, 88, 4]],
  [[0, 86, 4], [4, 81, 2], [6, 78, 2], [8, 81, 8]],
  [[0, 83, 2], [2, 81, 2], [4, 79, 2], [6, 78, 2], [8, 76, 4], [12, 79, 4]],
  [[0, 76, 4], [4, 73, 4], [8, 76, 4], [12, 81, 4]],
  // Variation: running eighth notes, climbing higher
  [[0, 86, 2], [2, 85, 2], [4, 83, 2], [6, 81, 2], [8, 78, 2], [10, 81, 2], [12, 86, 4]],
  [[0, 85, 2], [2, 81, 2], [4, 76, 2], [6, 81, 2], [8, 85, 4], [12, 88, 4]],
  [[0, 86, 2], [2, 83, 2], [4, 78, 2], [6, 83, 2], [8, 86, 4], [12, 90, 4]],
  [[0, 88, 4], [4, 85, 4], [8, 81, 8]],
  [[0, 83, 2], [2, 86, 2], [4, 91, 4], [8, 90, 2], [10, 88, 2], [12, 86, 4]],
  [[0, 90, 4], [4, 86, 4], [8, 81, 4], [12, 78, 4]],
  [[0, 79, 2], [2, 81, 2], [4, 83, 2], [6, 86, 2], [8, 88, 2], [10, 86, 2], [12, 83, 4]],
  [[0, 85, 4], [4, 88, 4], [8, 85, 4], [12, 81, 4]],
];
// Arpeggio walks up through the triad and its octave and back
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const arpNote = (tri, k) => (k === 3 ? tri[0] + 12 : tri[k]);

export const music = {
  enabled: prefs.music,
  playing: false,
  bpm: 120,
  step: 0,          // position in the loop, in sixteenths
  nextT: 0,         // audio time of the next step
  timer: null,
  bus: null, filter: null, noiseBuf: null,

  setup() {
    const ctx = sound.ctx;
    if (!ctx || this.bus) return !!this.bus;
    this.bus = ctx.createGain(); this.bus.gain.value = 0;
    this.bus.connect(sound.out);
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 3200;
    this.filter.connect(this.bus);
    const n = Math.floor(ctx.sampleRate * .05);
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  },

  /** restart: begin the loop from the top (new game) instead of resuming. */
  start(restart = false) {
    if (restart) this.step = 0;
    if (!this.enabled || this.playing || !this.setup()) return;
    const ctx = sound.ctx;
    this.playing = true;
    this.nextT = ctx.currentTime + .08;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(1, ctx.currentTime, .1); // peaks ≈ .2, just under the effects
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  },

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
    const ctx = sound.ctx;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(0, ctx.currentTime, .06);
  },

  /** Faster at higher levels: 120 bpm at level 1, up to 168. */
  setLevel(lv) { this.bpm = Math.min(168, 120 + (lv - 1) * 4); },

  /** Flips music on/off, remembers it, and returns the new state. */
  toggle(shouldPlay) {
    this.enabled = !this.enabled; prefs.music = this.enabled;
    if (!this.enabled) this.stop();
    else if (shouldPlay) this.start();
    return this.enabled;
  },

  // Look-ahead scheduler: queue every step that starts in the next 0.15 s
  schedule() {
    const ctx = sound.ctx;
    if (!this.playing) return;
    // After a long stall (background tab) skip ahead instead of bursting notes
    if (this.nextT < ctx.currentTime - .2) this.nextT = ctx.currentTime + .02;
    while (this.nextT < ctx.currentTime + .15) {
      this.playStep(this.step, this.nextT);
      this.nextT += 60 / this.bpm / 4;
      this.step = (this.step + 1) % (BARS.length * STEPS);
    }
  },

  playStep(i, t) {
    const bar = Math.floor(i / STEPS), s = i % STEPS, ch = BARS[bar], sixteenth = 60 / this.bpm / 4;
    // Bass: bouncy eighths, root on the beat and its octave on the offbeat
    if (s % 2 === 0) this.note('triangle', midi(ch.root + (s % 4 === 2 ? 12 : 0)), t, sixteenth * 1.6, .16, this.bus);
    // Arpeggio: sixteenths, an octave higher in the second half of the bar
    this.note('square', midi(arpNote(ch.tri, ARP[s % 8]) + (s >= 8 ? 12 : 0)), t, sixteenth * .7, .024, this.filter);
    // Lead, with a soft bell an octave up for sparkle
    for (const [st, n, len] of MELODY[bar]) {
      if (st !== s) continue;
      const dur = sixteenth * len * .95;
      this.note('triangle', midi(n), t, dur, .08, this.bus, true);
      this.note('sine', midi(n + 12), t, Math.min(dur, sixteenth * 3), .022, this.bus);
    }
    // Drums: kick on every beat, clap on 2 and 4, hat on the offbeats
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.clap(t);
    if (s % 4 === 2) this.hat(t);
  },

  note(type, f, t, dur, vol, dest, vibrato = false) {
    const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (vibrato && dur > .2) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = f * .006;
      lfo.connect(lg).connect(o.frequency); lfo.start(t + .12); lfo.stop(t + dur + .05);
    }
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .01);
    g.gain.setValueAtTime(vol, t + dur * .6);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + .02);
  },
  kick(t) {
    const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
    g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + .18);
  },
  clap(t) {
    const ctx = sound.ctx, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .8;
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    src.connect(bp).connect(g).connect(this.bus); src.start(t);
  },
  hat(t) {
    const ctx = sound.ctx, s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noiseBuf; hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .045);
    s.connect(hp).connect(g).connect(this.bus); s.start(t);
  },
};
