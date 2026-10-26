/**
 * Each character's signature sound (CLAUDE.md, sound map), played as their file opens. All synthesised here,
 * original work, drawn from who they are in the comics or the MCU (the source of each is in the sound map).
 * Every design is one to three seconds on the actions bus, peaking near the other action sounds and well under
 * the forge.
 */
import type { Sound } from './engine';

type S = Sound;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** A filtered noise burst whose filter sweeps from f0 to f1 over the whole envelope. */
function burst(s: S, t: number, o: { kind?: 'white' | 'pink' | 'brown'; type?: BiquadFilterType; f0: number; f1?: number; q?: number; peak: number; a: number; d: number; wet?: number; pan?: number }) {
  const v = s.noiseVoice(o.kind ?? 'white', o.type ?? 'bandpass', o.f0, o.q ?? 1, panTo(s, o.pan ?? 0), false);
  if (o.f1) { v.f.frequency.setValueAtTime(o.f0, t); v.f.frequency.exponentialRampToValueAtTime(o.f1, t + o.a + o.d); }
  s.env(v.g.gain, t, o.peak, o.a, o.d);
  v.src.start(t, rnd(0, 2), o.a + o.d + 0.05);
  if (o.wet) s.wet(v.g, o.wet, s.sfx);
  return v;
}

/** An oscillator whose pitch glides from f0 to f1, with an attack-decay envelope. */
function tone(s: S, t: number, o: { type?: OscillatorType; f0: number; f1?: number; peak: number; a: number; d: number; wet?: number; lp?: number; pan?: number; detune?: number }) {
  let out: AudioNode = panTo(s, o.pan ?? 0);
  if (o.lp) { const f = s.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.connect(out); out = f; }
  const v = s.osc(o.type ?? 'sine', o.f0, out);
  if (o.detune) v.o.detune.value = o.detune;
  if (o.f1) { v.o.frequency.setValueAtTime(o.f0, t); v.o.frequency.exponentialRampToValueAtTime(o.f1, t + o.a + o.d); }
  s.env(v.g.gain, t, o.peak, o.a, o.d);
  v.o.start(t); v.o.stop(t + o.a + o.d + 0.05);
  if (o.wet) s.wet(v.g, o.wet, s.sfx);
  return v;
}

/** Struck metal: inharmonic sine partials, the higher ones dying faster. */
function ring(s: S, t: number, f: number, ratios: number[], peak: number, decay: number, wet = 0.4, pan = 0) {
  ratios.forEach((r, i) => tone(s, t, { f0: f * r, peak: peak / (1 + i * 0.7), a: 0.003, d: decay / (1 + i * 0.45), wet, pan }));
}

function panTo(s: S, pan: number) {
  if (!pan) return s.sfx;
  const p = s.ctx.createStereoPanner(); p.pan.value = pan; p.connect(s.sfx); return p;
}

/** A low body hit: a sine falling in pitch, with a short noise transient. */
function thud(s: S, t: number, f0 = 90, f1 = 40, peak = 0.7, d = 0.35) {
  tone(s, t, { f0, f1, peak, a: 0.004, d, wet: 0.25 });
  burst(s, t, { kind: 'pink', type: 'lowpass', f0: 900, peak: peak * 0.5, a: 0.002, d: 0.06 });
}

/** A run of short clicks, randomly spaced, through a high band (keys, cards, chitter, sparks). */
function clicks(s: S, t: number, n: number, span: number, f: number, peak: number, q = 2) {
  for (let i = 0; i < n; i++) burst(s, t + rnd(0, span), { f0: f * rnd(0.8, 1.25), q, peak: peak * rnd(0.5, 1), a: 0.001, d: rnd(0.008, 0.03), pan: rnd(-0.4, 0.4) });
}

/** A sustained voice with amplitude modulation (flutter, tremolo, beating wings). */
function flutter(s: S, t: number, o: { f: number; q?: number; rate: number; peak: number; dur: number; kind?: 'white' | 'pink' }) {
  const v = s.noiseVoice(o.kind ?? 'pink', 'bandpass', o.f, o.q ?? 1.2, s.sfx, false);
  const am = s.ctx.createGain(); am.gain.value = 0.5;
  const lfo = s.ctx.createOscillator(); lfo.frequency.value = o.rate;
  const depth = s.ctx.createGain(); depth.gain.value = 0.5;
  v.g.disconnect(); v.g.connect(am).connect(s.sfx);
  lfo.connect(depth).connect(am.gain);
  s.env(v.g.gain, t, o.peak, o.dur * 0.3, o.dur * 0.7);
  v.src.start(t, rnd(0, 2), o.dur + 0.05); lfo.start(t); lfo.stop(t + o.dur + 0.05);
}

export const SIGNATURES: Record<string, (s: S, t: number) => void> = {
  // armoured gauntlet servos, then a crackling green bolt (scientist and sorcerer)
  'victor-von-doom': (s, t) => {
    tone(s, t, { type: 'sawtooth', f0: 110, f1: 165, peak: 0.18, a: 0.05, d: 0.32, lp: 900 });
    tone(s, t + 0.38, { type: 'sawtooth', f0: 150, f1: 98, peak: 0.16, a: 0.04, d: 0.3, lp: 800 });
    clicks(s, t + 0.75, 26, 0.7, 3200, 0.22, 3);
    tone(s, t + 0.75, { type: 'sawtooth', f0: 55, peak: 0.22, a: 0.2, d: 1.2, lp: 700, wet: 0.6 });
    tone(s, t + 0.75, { type: 'sawtooth', f0: 82.4, peak: 0.16, a: 0.25, d: 1.1, lp: 900, wet: 0.6, detune: 7 });
  },
  // the shield ricochets: a hit, then a long bright ring that bends as it flies away
  'steve-rogers': (s, t) => {
    burst(s, t, { kind: 'pink', type: 'lowpass', f0: 1400, peak: 0.5, a: 0.002, d: 0.08 });
    ring(s, t, 1180, [1, 2.32, 4.25, 6.63], 0.32, 2.4, 0.5, -0.2);
    tone(s, t + 0.02, { f0: 1180, f1: 1090, peak: 0.12, a: 0.01, d: 1.8, pan: 0.3 });
  },
  // rolling thunder, with Mjolnir's charged hum and a few sparks
  'thor': (s, t) => {
    burst(s, t, { kind: 'brown', type: 'lowpass', f0: 220, f1: 80, q: 0.8, peak: 0.9, a: 0.25, d: 2.4, wet: 0.5 });
    flutter(s, t + 0.1, { f: 160, q: 4, rate: 6, peak: 0.25, dur: 1.6, kind: 'pink' });
    tone(s, t + 0.1, { type: 'sawtooth', f0: 98, peak: 0.12, a: 0.3, d: 1.4, lp: 500 });
    clicks(s, t + 0.2, 10, 1.0, 4200, 0.12, 4);
  },
  // two wing beats and Redwing's chirp
  'sam-wilson': (s, t) => {
    burst(s, t, { kind: 'pink', f0: 300, f1: 1700, q: 0.9, peak: 0.5, a: 0.12, d: 0.25 });
    burst(s, t + 0.42, { kind: 'pink', f0: 280, f1: 1500, q: 0.9, peak: 0.42, a: 0.12, d: 0.25 });
    tone(s, t + 0.8, { f0: 2400, f1: 3400, peak: 0.1, a: 0.01, d: 0.06, pan: 0.4 });
    tone(s, t + 0.9, { f0: 2600, f1: 3600, peak: 0.08, a: 0.01, d: 0.06, pan: 0.45 });
  },
  // the metal arm: a servo whirr and the plates locking
  'bucky-barnes': (s, t) => {
    const v = burst(s, t, { kind: 'white', f0: 500, f1: 1400, q: 5, peak: 0.16, a: 0.08, d: 0.4 });
    void v;
    tone(s, t, { type: 'sawtooth', f0: 220, f1: 420, peak: 0.1, a: 0.05, d: 0.42, lp: 1600 });
    [0.52, 0.6, 0.68].forEach((d, i) => { burst(s, t + d, { f0: 2500, type: 'highpass', peak: 0.3, a: 0.001, d: 0.02 }); ring(s, t + d, 880 + i * 60, [1, 2.7], 0.08, 0.25, 0.2); });
  },
  // shrinking: the pitch climbs to a tiny pip, ants chittering underneath
  'scott-lang': (s, t) => {
    tone(s, t, { type: 'triangle', f0: 180, f1: 2600, peak: 0.2, a: 0.05, d: 0.55 });
    tone(s, t + 0.62, { f0: 4200, peak: 0.12, a: 0.003, d: 0.05 });
    clicks(s, t + 0.2, 34, 1.0, 5200, 0.09, 6);
  },
  // the Ten Rings spinning up, a resonant chime as they lock
  'shang-chi': (s, t) => {
    for (let i = 0; i < 14; i++) { const d = 0.9 * (1 - Math.pow(1 - i / 14, 1.6)); burst(s, t + d, { f0: 700 + i * 90, q: 6, peak: 0.08 + i * 0.012, a: 0.005, d: 0.06, pan: Math.sin(i * 1.3) * 0.5 }); }
    ring(s, t + 0.95, 660, [1, 2.0, 3.01, 4.2], 0.2, 2.2, 0.6);
  },
  // lighter, quicker wings, and a drone's ping
  'joaquin-torres': (s, t) => {
    flutter(s, t, { f: 1300, q: 1.4, rate: 18, peak: 0.3, dur: 0.6 });
    tone(s, t + 0.65, { f0: 1800, peak: 0.12, a: 0.004, d: 0.18, wet: 0.5, pan: -0.3 });
    tone(s, t + 0.95, { f0: 1800, peak: 0.05, a: 0.004, d: 0.15, wet: 0.5, pan: 0.3 });
  },
  // a rubbery stretch, then the snap back
  'reed-richards': (s, t) => {
    const v = tone(s, t, { type: 'triangle', f0: 120, f1: 520, peak: 0.22, a: 0.1, d: 0.6, lp: 1800 });
    const lfo = s.ctx.createOscillator(); lfo.frequency.value = 9; const dg = s.ctx.createGain(); dg.gain.value = 18; lfo.connect(dg).connect(v.o.frequency); lfo.start(t); lfo.stop(t + 0.75);
    burst(s, t + 0.72, { f0: 1500, q: 2, peak: 0.35, a: 0.001, d: 0.04 });
    tone(s, t + 0.72, { f0: 320, f1: 70, peak: 0.3, a: 0.002, d: 0.22 });
  },
  // a glassy force field hums, then fades to nothing as she turns invisible
  'sue-storm': (s, t) => {
    const f = s.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(300, t + 2.2); f.connect(s.sfx);
    [523.25, 784, 1046.5, 1568].forEach((hz, i) => { const v = s.osc('sine', hz, f); v.o.detune.value = (i % 2 ? 4 : -4); s.env(v.g.gain, t, 0.09 / (1 + i * 0.4), 0.35, 1.9); v.o.start(t); v.o.stop(t + 2.4); s.wet(v.g, 0.6, s.sfx); });
  },
  // flame on: an ignition whoosh into a steady roar
  'johnny-storm': (s, t) => {
    burst(s, t, { kind: 'pink', f0: 200, f1: 2600, q: 0.8, peak: 0.5, a: 0.3, d: 0.2 });
    burst(s, t + 0.3, { kind: 'brown', type: 'lowpass', f0: 700, q: 0.7, peak: 0.6, a: 0.15, d: 1.4 });
    clicks(s, t + 0.35, 18, 1.2, 2600, 0.12, 1.5);
  },
  // rock grinding, then a punch that shakes the ground
  'ben-grimm': (s, t) => {
    flutter(s, t, { f: 260, q: 2, rate: 23, peak: 0.45, dur: 0.6, kind: 'pink' });
    thud(s, t + 0.7, 70, 32, 0.9, 0.6);
    burst(s, t + 0.7, { kind: 'brown', type: 'lowpass', f0: 160, peak: 0.6, a: 0.01, d: 0.9, wet: 0.4 });
  },
  // a telepathic chord swells as Cerebro reaches out
  'professor-x': (s, t) => {
    const f = s.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4200, t + 1.4); f.connect(s.sfx);
    [220, 277.18, 329.63, 440, 659.25].forEach((hz, i) => { const v = s.osc('sine', hz, f); v.o.detune.value = rnd(-6, 6); s.env(v.g.gain, t, 0.09, 1.0, 1.4); v.o.start(t); v.o.stop(t + 2.5); s.wet(v.g, 0.7, s.sfx); void i; });
    tone(s, t + 0.6, { f0: 1760, peak: 0.03, a: 0.6, d: 1.2, wet: 0.8 });
  },
  // steel groaning as it bends, over a deep magnetic hum
  'magneto': (s, t) => {
    tone(s, t, { f0: 50, peak: 0.3, a: 0.4, d: 1.8 });
    tone(s, t, { f0: 100, peak: 0.1, a: 0.4, d: 1.6 });
    const v = s.noiseVoice('pink', 'bandpass', 400, 9, s.sfx, false);
    v.f.frequency.setValueAtTime(380, t + 0.2); v.f.frequency.exponentialRampToValueAtTime(920, t + 1.3); v.f.frequency.exponentialRampToValueAtTime(600, t + 1.9);
    s.env(v.g.gain, t + 0.2, 0.7, 0.5, 1.3); v.src.start(t + 0.2, rnd(0, 2), 2); s.wet(v.g, 0.5, s.sfx);
  },
  // an optic blast charging with a rising whine, then released
  'cyclops': (s, t) => {
    tone(s, t, { type: 'sawtooth', f0: 200, f1: 1600, peak: 0.1, a: 0.6, d: 0.1, lp: 3000 });
    burst(s, t + 0.7, { kind: 'pink', f0: 900, f1: 300, q: 0.7, peak: 0.55, a: 0.01, d: 0.6, wet: 0.4 });
    tone(s, t + 0.7, { type: 'sawtooth', f0: 140, f1: 90, peak: 0.14, a: 0.01, d: 0.6, lp: 1200 });
  },
  // BAMF: a sharp pop, a low thump and a hiss of sulphur
  'nightcrawler': (s, t) => {
    burst(s, t, { f0: 1200, q: 1, peak: 0.6, a: 0.001, d: 0.05 });
    tone(s, t, { f0: 120, f1: 60, peak: 0.45, a: 0.002, d: 0.18 });
    burst(s, t + 0.04, { type: 'highpass', f0: 4000, peak: 0.12, a: 0.02, d: 0.6, wet: 0.5 });
  },
  // a rippling, scaly shimmer as she changes shape
  'mystique': (s, t) => {
    for (let i = 0; i < 26; i++) tone(s, t + rnd(0, 0.9), { f0: rnd(900, 3200), peak: 0.035, a: 0.01, d: rnd(0.05, 0.15), pan: rnd(-0.6, 0.6) });
    burst(s, t, { kind: 'pink', f0: 600, f1: 3000, q: 3, peak: 0.18, a: 0.4, d: 0.6 });
  },
  // a deep, low growl
  'beast': (s, t) => {
    const v = tone(s, t, { type: 'sawtooth', f0: 72, f1: 62, peak: 0.3, a: 0.15, d: 0.9, lp: 520 });
    const lfo = s.ctx.createOscillator(); lfo.frequency.value = 27; const dg = s.ctx.createGain(); dg.gain.value = 9; lfo.connect(dg).connect(v.o.frequency); lfo.start(t); lfo.stop(t + 1.1);
    burst(s, t, { kind: 'brown', type: 'lowpass', f0: 300, peak: 0.25, a: 0.15, d: 0.9 });
  },
  // a card riffle, then a kinetic charge that fizzes and pops
  'gambit': (s, t) => {
    for (let i = 0; i < 22; i++) burst(s, t + i * 0.016, { f0: 3400, type: 'highpass', peak: 0.16, a: 0.001, d: 0.012 });
    tone(s, t + 0.45, { type: 'square', f0: 300, f1: 1100, peak: 0.05, a: 0.4, d: 0.05, lp: 2400 });
    burst(s, t + 0.45, { f0: 2600, q: 3, peak: 0.12, a: 0.4, d: 0.05 });
    burst(s, t + 0.92, { f0: 900, q: 0.8, peak: 0.6, a: 0.001, d: 0.12, wet: 0.4 });
    thud(s, t + 0.92, 110, 50, 0.4, 0.2);
  },
  // the electric crack of a Widow's Bite
  'yelena-belova': (s, t) => {
    tone(s, t, { type: 'square', f0: 120, peak: 0.06, a: 0.01, d: 0.35, lp: 2000 });
    clicks(s, t, 30, 0.32, 3800, 0.3, 1.5);
    burst(s, t + 0.33, { f0: 2000, q: 0.6, peak: 0.5, a: 0.001, d: 0.08 });
  },
  // a heavy round shield landing with a dull, deep clang
  'red-guardian': (s, t) => {
    thud(s, t, 80, 42, 0.7, 0.4);
    ring(s, t, 220, [1, 2.41, 3.87, 5.2], 0.28, 1.6, 0.5);
  },
  // dog tags jingling over heavy boots
  'john-walker': (s, t) => {
    thud(s, t, 70, 45, 0.45, 0.2);
    thud(s, t + 0.45, 66, 42, 0.45, 0.2);
    for (let i = 0; i < 7; i++) ring(s, t + 0.05 + rnd(0, 0.6), rnd(3000, 4300), [1, 1.48], 0.04, 0.12, 0.2, rnd(-0.3, 0.3));
  },
  // a glitching, reversed flicker as she phases
  'ghost': (s, t) => {
    for (let i = 0; i < 9; i++) { const d = i * 0.11 + rnd(0, 0.04); burst(s, t + d, { f0: rnd(500, 2400), q: 2, peak: 0.22, a: rnd(0.04, 0.09), d: 0.005 }); }
    tone(s, t + 0.2, { type: 'square', f0: 440, f1: 110, peak: 0.04, a: 0.6, d: 0.02, lp: 1800 });
  },
  // a golden radiant swell that collapses into a dark rumble (the Sentry and the Void)
  'bob-reynolds': (s, t) => {
    const f = s.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.setValueAtTime(5000, t + 1.0); f.frequency.exponentialRampToValueAtTime(200, t + 1.6); f.connect(s.sfx);
    [392, 493.88, 587.33, 783.99].forEach((hz) => { const v = s.osc('sine', hz, f); v.o.frequency.setValueAtTime(hz, t + 1.0); v.o.frequency.exponentialRampToValueAtTime(hz * 0.5, t + 1.6); s.env(v.g.gain, t, 0.08, 0.9, 0.8); v.o.start(t); v.o.stop(t + 1.8); s.wet(v.g, 0.7, s.sfx); });
    burst(s, t + 1.1, { kind: 'brown', type: 'lowpass', f0: 140, peak: 0.7, a: 0.2, d: 1.4, wet: 0.4 });
  },
  // the kinetic pulse of her suit releasing stored energy
  'shuri': (s, t) => {
    const v = s.noiseVoice('pink', 'bandpass', 300, 8, s.sfx, false);
    v.f.frequency.setValueAtTime(220, t); v.f.frequency.exponentialRampToValueAtTime(1400, t + 0.35); v.f.frequency.exponentialRampToValueAtTime(160, t + 0.9);
    s.env(v.g.gain, t, 0.5, 0.3, 0.6); v.src.start(t, rnd(0, 2), 1);
    tone(s, t + 0.3, { f0: 90, f1: 45, peak: 0.6, a: 0.005, d: 0.5, wet: 0.3 });
  },
  // a wooden war staff striking stone, mountain wind behind it
  "mbaku": (s, t) => {
    burst(s, t, { kind: 'pink', type: 'bandpass', f0: 600, f1: 900, q: 0.5, peak: 0.2, a: 0.6, d: 1.2 });
    burst(s, t + 0.35, { f0: 900, q: 3, peak: 0.5, a: 0.001, d: 0.05 });
    ring(s, t + 0.35, 420, [1, 2.6], 0.25, 0.22, 0.5);
  },
  // a deep ocean swell, bubbles, and the flutter of his ankle wings
  'namor': (s, t) => {
    burst(s, t, { kind: 'brown', type: 'lowpass', f0: 380, peak: 0.6, a: 0.7, d: 1.2, wet: 0.4 });
    for (let i = 0; i < 9; i++) tone(s, t + 0.2 + rnd(0, 1.0), { f0: rnd(280, 500), f1: rnd(700, 1100), peak: 0.06, a: 0.005, d: 0.06 });
    flutter(s, t + 1.0, { f: 1500, q: 1.5, rate: 26, peak: 0.18, dur: 0.45 });
  },
  // an illusion's shimmer over a slowly turning clock (the TVA)
  'loki': (s, t) => {
    [1318.5, 1567.98, 1975.53].forEach((hz, i) => { const v = tone(s, t + i * 0.08, { f0: hz, peak: 0.06, a: 0.05, d: 1.6, wet: 0.8 }); const l = s.ctx.createOscillator(); l.frequency.value = 5 + i; const g = s.ctx.createGain(); g.gain.value = 9; l.connect(g).connect(v.o.detune); l.start(t); l.stop(t + 1.8); });
    [0.2, 0.9].forEach((d) => { burst(s, t + d, { f0: 1800, q: 4, peak: 0.25, a: 0.001, d: 0.02 }); tone(s, t + d, { f0: 190, peak: 0.12, a: 0.002, d: 0.08 }); });
  },
  // 1940s radio static and teletype keys (the SSR)
  'peggy-carter': (s, t) => {
    burst(s, t, { f0: 1800, q: 1, peak: 0.16, a: 0.05, d: 1.3 });
    clicks(s, t, 14, 1.2, 6000, 0.1, 1);
    for (let i = 0; i < 9; i++) { const d = 0.25 + i * 0.09 + rnd(0, 0.03); burst(s, t + d, { f0: 2400, q: 3, peak: 0.25, a: 0.001, d: 0.015 }); tone(s, t + d, { f0: 1300, peak: 0.03, a: 0.001, d: 0.03 }); }
  },
};

/**
 * Level trims in dB, measured with scripts/sounds-record.mjs so every signature peaks near -20 dBFS: under the
 * stamp and the clash, far under the forge. Soft textures (wings, static, shimmer) need lifting; heavy hits less.
 */
const TRIM: Record<string, number> = {
  'sam-wilson': 13, 'joaquin-torres': 13, 'mystique': 16, 'ghost': 14, 'peggy-carter': 14, 'cyclops': 6, 'yelena-belova': 5,
  'scott-lang': 7, 'loki': 8, 'bucky-barnes': 3, 'sue-storm': 5, 'johnny-storm': 4, 'reed-richards': 3, 'ben-grimm': -4, 'red-guardian': -5,
};

/** Plays a signature through its own trim on the actions bus. */
function voice(s: S, slug: string, t: number) {
  const trim = s.ctx.createGain();
  trim.gain.value = Math.pow(10, (TRIM[slug] ?? 0) / 20);
  trim.connect(s.sfx);
  // the designs write to s.sfx: hand them a view of the engine whose actions bus is the trim
  const view = Object.create(s) as S;
  Object.defineProperty(view, 'sfx', { value: trim });
  SIGNATURES[slug](view, t);
  setTimeout(() => trim.disconnect(), 6000);
}

/** Plays a character's signature sound now, if sound is running. Returns false when it could not. */
export function playSignature(s: S, slug: string) {
  if (!SIGNATURES[slug] || s.ctx.state !== 'running') return false;
  voice(s, slug, s.ctx.currentTime + 0.03);
  return true;
}
export { voice as playSignatureAt };
