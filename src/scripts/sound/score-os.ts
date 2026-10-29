/**
 * DOOM-OS's score: an original piece for this site, synthesised live (no samples, no third-party music).
 * D minor, 76 bpm, in eight-bar phrases: i, VI, iv, V, then i, VI, the flat second (E flat, the darkest chord
 * in the key) and V. Doom's motif is a falling half step that won't resolve (D, C sharp, D, down to B flat),
 * answered by a slow chromatic fall (E flat, D, C sharp) over the last two bars of the phrase.
 *
 * It is built in layers that come in as His Majesty explores, so the music grows with the reign:
 *   0  arrival:  low strings held under a heartbeat, a distant choir
 *   1  one module visited:  a spiccato string ostinato in a 3-3-2 pulse, filtered dark
 *   2  three modules:  war drums, the low horns with Doom's motif, the choir forward, the ostinato opens up
 *   3  five modules, or a breach:  brass braams on the phrase downbeats, high string tremolo, a riser into each
 *      phrase, everything open
 * Levels change at the next bar and fade over two bars. It pauses (fading out) while the tab is hidden.
 * Instruments: strings are detuned saw ensembles through low-pass filters; horns are saws through a filter that
 * opens with each note; the choir is saws through two vowel formants ("ah"); drums are pitch-dropping sines with a
 * skin of filtered noise; braams are distorted saw stacks with a sweeping filter. All of it into one stone hall.
 */
type Layer = 'pad' | 'pulse' | 'ost' | 'drums' | 'horn' | 'choir' | 'braam' | 'trem';
const BPM = 76, BEAT = 60 / BPM, BAR = BEAT * 4, SIX = BEAT / 4;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// the phrase: chord tones as MIDI notes, bass root
const D = 50, F = 53, A = 57, Bb = 46, G = 43, Eb = 51, Cs = 49, E = 52;
const CHORDS = [
  { root: 38, tones: [D, F, A] },        // D minor
  { root: 34, tones: [Bb + 12, D, F] },  // B flat
  { root: 43 - 12, tones: [G + 12, Bb + 12, D] }, // G minor
  { root: 33, tones: [45 + 12, Cs, E] }, // A major
  { root: 38, tones: [D, F, A] },        // D minor
  { root: 34, tones: [Bb + 12, D, F] },  // B flat
  { root: 39, tones: [Eb, 55, Bb + 12] }, // E flat, the flat second
  { root: 33, tones: [45 + 12, Cs, E] }, // A major
];
// Doom's motif for the low horns: [bar in phrase, beat, length in beats, MIDI]
const MOTIF: [number, number, number, number][] = [
  [0, 0, 2, 50], [0, 2, 1, 49], [0, 3, 1, 50], [1, 0, 4, 46],
  [4, 0, 1, 50], [4, 1, 1, 53], [4, 2, 2, 52], [5, 0, 4, 50],
  [6, 0, 2, 51], [6, 2, 2, 50], [7, 0, 4, 49],
];
// the ostinato's accents fall 3-3-2 across each half bar
const ACCENT = new Set([0, 3, 6, 8, 11, 14]);
const OST = [0, 0, 12, 0, 7, 0, 12, 7, 0, 0, 12, 0, 7, 12, 0, 7];
const LEVELS: Record<number, Partial<Record<Layer, number>>> = {
  0: { pad: 1, pulse: 1, choir: 0.45 },
  1: { pad: 1, pulse: 0.8, choir: 0.55, ost: 0.75 },
  2: { pad: 1, pulse: 0.5, choir: 0.85, ost: 1, drums: 1, horn: 1 },
  3: { pad: 1, pulse: 0.4, choir: 1, ost: 1, drums: 1, horn: 1, braam: 1, trem: 1 },
};
const WET: Record<Layer, number> = { pad: 0.5, pulse: 0.3, ost: 0.3, drums: 0.5, horn: 0.6, choir: 0.8, braam: 0.6, trem: 0.7 };

export type Score = { setLevel(n: number): void; level(): number; hit(): void; stop(): void };

/** The score's graph on any context: live (AudioContext) or rendered (OfflineAudioContext). */
function build(ctx: BaseAudioContext, out: AudioNode, hall: AudioNode) {
  // the mix's tone: nothing below 32 Hz (laptops and phones only turn it into mud), the low end eased back so the
  // strings and horns carry, and a little air on top
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.7;
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 140; low.gain.value = -5;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 4500; air.gain.value = 2;
  hp.connect(low).connect(air).connect(out);
  const bus = {} as Record<Layer, GainNode>;
  for (const k of Object.keys(WET) as Layer[]) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(hp);
    const w = ctx.createGain(); w.gain.value = WET[k]; g.connect(w).connect(hall);
    bus[k] = g;
  }
  const noise = (() => { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const shaper = (() => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * 2.6); } return c; })();
  const env = (p: AudioParam, t: number, peak: number, a: number, hold: number, r: number) => {
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (hold > 0) p.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  };
  const saws = (f: number, cents: number[], dest: AudioNode, t: number, end: number, type: OscillatorType = 'sawtooth') => cents.forEach((c) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = c; o.connect(dest); o.start(t); o.stop(end); });
  const lp = (f: number, q = 0.7, dest: AudioNode) => { const x = ctx.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; x.Q.value = q; x.connect(dest); return x; };
  const amp = (dest: AudioNode) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(dest); return g; };
  const burst = (t: number, len: number) => { const s = ctx.createBufferSource(); s.buffer = noise; s.start(t, Math.random(), len); return s; };

  const I = {
    /** Low strings held through the bar, the bass root and its fifth. */
    pad(root: number, t: number) {
      const g = amp(bus.pad), f = lp(420, 0.8, g);
      env(g.gain, t, 0.055, 1.1, BAR - 1.1, 2.2);
      saws(hz(root), [-9, 7], f, t, t + BAR + 2.3); saws(hz(root + 7), [-4, 5], f, t, t + BAR + 2.3);
      saws(hz(root - 12), [0], f, t, t + BAR + 2.3, 'triangle');
    },
    /** A heartbeat in armour, on one and on three. */
    pulse(t: number) {
      [[0, 0.55], [0.26, 0.38], [BEAT * 2, 0.5], [BEAT * 2 + 0.26, 0.34]].forEach(([dt, v]) => {
        const g = amp(bus.pulse), o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(62, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.22);
        o.connect(g); env(g.gain, t + dt, v, 0.006, 0, 0.32); o.start(t + dt); o.stop(t + dt + 0.4);
      });
    },
    /** Spiccato low strings, sixteen to the bar, accents in 3-3-2. */
    ost(root: number, t: number, open: number) {
      OST.forEach((iv, i) => {
        const at = t + i * SIX, acc = ACCENT.has(i), g = amp(bus.ost), f = lp(open * (acc ? 1.5 : 1), 1.1, g);
        env(g.gain, at, acc ? 0.22 : 0.12, 0.005, 0, acc ? 0.26 : 0.17);
        saws(hz(root + 12 + iv), [-8, 0, 8], f, at, at + 0.32);
      });
    },
    /** War drums: one big hit, the pickups, and a roll into the phrase. */
    drums(t: number, bar: number) {
      const hit = (at: number, v: number, p = 1) => {
        const g = amp(bus.drums), o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(78 * p, at); o.frequency.exponentialRampToValueAtTime(40 * p, at + 0.3);
        o.connect(g); env(g.gain, at, v, 0.004, 0, 0.9); o.start(at); o.stop(at + 1);
        const sg = amp(bus.drums), sf = lp(1300, 0.8, sg); burst(at, 0.08).connect(sf); env(sg.gain, at, v * 0.35, 0.002, 0, 0.07);
      };
      hit(t, 0.45); hit(t + BEAT * 1.75, 0.22, 1.25); hit(t + BEAT * 2, 0.35, 1.1); hit(t + BEAT * 3.5, 0.2, 1.3);
      if (bar % 8 === 7) for (let i = 0; i < 8; i++) hit(t + BEAT * 2 + i * SIX, 0.1 + i * 0.035, 1.4);
    },
    /** A low horn: the filter opens as the note speaks, the way brass brightens when it's pushed. */
    horn(m: number, t: number, dur: number) {
      const g = amp(bus.horn), f = lp(300, 2, g);
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1300, t + 0.18); f.frequency.exponentialRampToValueAtTime(760, t + 0.6);
      env(g.gain, t, 0.11, 0.14, Math.max(0, dur - 0.2), 0.5);
      saws(hz(m), [0, 6], f, t, t + dur + 0.6); saws(hz(m - 12), [-3], f, t, t + dur + 0.6, 'square');
    },
    /** The choir, on "ah": saws through two vowel formants. */
    choir(tones: number[], t: number) {
      const g = amp(bus.choir), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), mix = ctx.createGain();
      f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 7;
      const g2 = ctx.createGain(); g2.gain.value = 0.55; mix.connect(f1).connect(g); mix.connect(f2).connect(g2).connect(g);
      // a chord a bar, each fading in under the last as it fades out, so the choir never drops out
      env(g.gain, t, 0.2, 1.2, BAR - 1.0, 2.2);
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.8; vg.gain.value = 9; vib.connect(vg); vib.start(t); vib.stop(t + BAR + 2.5);
      tones.forEach((m) => [-6, 5].forEach((c) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m + 12); o.detune.value = c; vg.connect(o.detune); o.connect(mix); o.start(t); o.stop(t + BAR + 2.5); }));
    },
    /** A brass braam: a distorted low stack with a filter that tears open and slowly closes. */
    braam(root: number, t: number) {
      const g = amp(bus.braam), f = lp(140, 1.4, g), ws = ctx.createWaveShaper(); ws.curve = shaper; ws.connect(f);
      f.frequency.setValueAtTime(140, t); f.frequency.exponentialRampToValueAtTime(2300, t + 0.32); f.frequency.exponentialRampToValueAtTime(420, t + 3);
      env(g.gain, t, 0.13, 0.05, 1.6, 2.2);
      const end = t + 4;
      saws(hz(root), [0, 9], ws, t, end); saws(hz(root + 12), [-5, 4], ws, t, end); saws(hz(root + 19), [0], ws, t, end); saws(hz(root - 12), [0], ws, t, end, 'square');
      const sg = amp(bus.braam), so = ctx.createOscillator(); so.frequency.value = hz(root - 12); so.connect(sg); env(sg.gain, t, 0.22, 0.03, 1.2, 1.8); so.start(t); so.stop(end);
    },
    /** High strings in tremolo, the chord shivering above everything. */
    trem(tones: number[], t: number) {
      const g = amp(bus.trem), f = lp(3800, 0.7, g), am = ctx.createGain(); am.gain.value = 0.5; am.connect(f);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start(t); lfo.stop(t + BAR + 1.2);
      env(g.gain, t, 0.045, 0.6, BAR - 0.6, 1);
      tones.forEach((m) => saws(hz(m + 24), [-7, 7], am, t, t + BAR + 1.2));
    },
    /** A rising rush of air into the next phrase. */
    riser(t: number, len: number) {
      const g = amp(bus.braam), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.Q.value = 2; f.connect(g);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + len);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + len - 0.02); g.gain.setValueAtTime(0.0001, t + len);
      burst(t, len).connect(f);
    },
  };

  /** Everything that sounds in one bar, for the layers the level has in. */
  const bar = (n: number, t: number, lvl: number) => {
    const p = n % 8, ch = CHORDS[p], on = LEVELS[lvl];
    // the held chords begin to swell just before the bar line, so each one rises as the last fades: no gap
    const early = Math.max(0, t - 0.7);
    I.pad(ch.root, early);
    if (on.pulse) I.pulse(t);
    if (on.choir) I.choir(ch.tones, early);
    if (on.ost) I.ost(ch.root, t, lvl >= 3 ? 2200 : lvl >= 2 ? 1300 : 700);
    if (on.drums) I.drums(t, n);
    if (on.horn && n % 16 < 8) MOTIF.filter((x) => x[0] === p).forEach(([, b, len, m]) => I.horn(m, t + b * BEAT, len * BEAT));
    if (on.braam && (p === 0 || p === 4)) I.braam(ch.root, t);
    if (on.trem) I.trem(ch.tones, t);
    if (on.braam && p === 7) I.riser(t + BAR - BEAT * 2, BEAT * 2);
  };
  /** Fades each layer toward the level's mix over `secs`. */
  const mix = (lvl: number, t: number, secs: number, solo?: string) => {
    for (const k of Object.keys(bus) as Layer[]) {
      const g = bus[k].gain, v = solo && solo !== k ? 0 : LEVELS[lvl][k] ?? 0;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + secs);
    }
  };
  return { bar, mix, I };
}

/**
 * Starts the score on a live context. `out` is the score's bus; `ir` the site's stone hall. The score has its own
 * hall in front of its volume, so its reverb fades, pauses and mutes with it.
 */
export function startScore(ctx: AudioContext, out: AudioNode, ir: AudioBuffer | null, level = 0): Score {
  const vol = ctx.createGain(); vol.gain.value = 0; vol.connect(out);
  const hall = ctx.createGain(); hall.gain.value = 0.9;
  if (ir) { const cv = ctx.createConvolver(); cv.buffer = ir; hall.connect(cv).connect(vol); }
  const g = build(ctx, vol, hall);
  let lvl = Math.max(0, Math.min(3, level)), n = 0, next = ctx.currentTime + 0.15, on = true, boost = 0;
  g.mix(lvl, ctx.currentTime, 0.01);
  vol.gain.setValueAtTime(0, ctx.currentTime); vol.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
  const want = () => Math.max(lvl, boost > ctx.currentTime ? 3 : 0);
  let playing = lvl;
  const iv = window.setInterval(() => {
    if (!on || document.hidden) return;
    while (next < ctx.currentTime + 1.4) {
      const w = want();
      if (w !== playing) { g.mix(w, next, BAR * 2); playing = w; }
      g.bar(n, next, playing); n++; next += BAR;
    }
  }, 180);
  const vis = () => {
    const t = ctx.currentTime;
    vol.gain.cancelScheduledValues(t); vol.gain.setValueAtTime(vol.gain.value, t);
    if (document.hidden) vol.gain.linearRampToValueAtTime(0, t + 0.6);
    else { vol.gain.linearRampToValueAtTime(1, t + 2.5); next = Math.max(next, t + 0.1); n = Math.ceil(n / 8) * 8; }
  };
  document.addEventListener('visibilitychange', vis);
  return {
    setLevel(x) { lvl = Math.max(0, Math.min(3, x)); },
    level: () => playing,
    // a breach: everything in for the next eight bars, and a braam right now
    hit() { boost = ctx.currentTime + BAR * 8; g.I.braam(CHORDS[n % 8].root, ctx.currentTime + 0.02); },
    stop() { on = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis); const t = ctx.currentTime; vol.gain.cancelScheduledValues(t); vol.gain.setValueAtTime(vol.gain.value, t); vol.gain.linearRampToValueAtTime(0, t + 2); },
  };
}

/** Renders `bars` bars at a level into a buffer, for checking the mix (localhost QA only). */
export async function renderScore(level: number, bars: number, sampleRate = 44100, solo?: string) {
  const len = Math.ceil((bars * BAR + 4) * sampleRate), ctx = new OfflineAudioContext(2, len, sampleRate);
  const hall = ctx.createConvolver(), n = Math.floor(sampleRate * 3.6), ir = ctx.createBuffer(2, n, sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let l = 0; for (let i = 0; i < n; i++) { const t = i / n; l += (Math.random() * 2 - 1 - l) * (0.5 - 0.42 * t); d[i] = l * Math.pow(1 - t, 2.4); } }
  hall.buffer = ir; const hg = ctx.createGain(); hg.gain.value = 0.9; hg.connect(hall).connect(ctx.destination);
  const g = build(ctx, ctx.destination, hg);
  g.mix(level, 0, 0.01, solo);
  for (let i = 0; i < bars; i++) g.bar(i, 0.1 + i * BAR, level);
  return ctx.startRendering();
}
export const SCORE_BAR = BAR;
