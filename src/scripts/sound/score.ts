/**
 * The ambient score, "sorcery and science" (CLAUDE.md, fifth interview): Doom is master scientist and sorcerer.
 * A low string-like drone (detuned saws through a slowly breathing filter), bell harmonics drifting above it
 * into the hall (the sorcery), and a faint machine pulse at 52 bpm like a heartbeat in armour (the science).
 * It sits on the score bus, about 24 dB under the forge, and keeps going for as long as the page lives.
 */
import type { Sound } from './engine';

let running: { stop(): void } | null = null;

export function startScore(s: Sound, fadeIn = 4) {
  if (running) return running;
  const c = s.ctx, out = c.createGain(), t0 = c.currentTime;
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(1, t0 + fadeIn);
  out.connect(s.score); s.wet(out, 0.35, s.score);

  // the drone: D and A, low, each a pair of slightly detuned saws, through a filter that breathes
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.Q.value = 1.2; lp.connect(out);
  const breath = c.createOscillator(); breath.frequency.value = 0.045;
  const breathD = c.createGain(); breathD.gain.value = 120; breath.connect(breathD).connect(lp.frequency); breath.start();
  const drone = [36.71, 55, 73.42].flatMap((f, i) => [-5, 7].map((cents) => {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
    const g = c.createGain(); g.gain.value = i === 0 ? 0.5 : 0.28; o.connect(g).connect(lp); o.start(); return o;
  }));

  // the bells: a soft struck partial set every few seconds, notes from D minor, high and far away
  const NOTES = [587.33, 698.46, 880, 1046.5, 1174.66, 1396.91];
  let bellTimer = 0;
  const bell = () => {
    const t = c.currentTime + 0.05, f = NOTES[Math.floor(Math.random() * NOTES.length)];
    const g = c.createGain(), p = c.createStereoPanner();
    p.pan.value = Math.random() * 1.2 - 0.6;
    g.connect(p).connect(out); s.wet(p, 0.9, s.score);
    for (const [ratio, amp] of [[1, 1], [2.01, 0.35], [3.02, 0.18], [4.17, 0.08]] as const) {
      const o = c.createOscillator(); o.frequency.value = f * ratio;
      const og = c.createGain(); og.gain.value = amp; o.connect(og).connect(g); o.start(t); o.stop(t + 6);
    }
    s.env(g.gain, t, 0.05, 0.02, 5.5);
    bellTimer = window.setTimeout(bell, 4000 + Math.random() * 4000);
  };
  bellTimer = window.setTimeout(bell, 2500);

  // the machine pulse: a soft sub thump at 52 bpm
  let pulseTimer = 0;
  const beat = 60 / 52;
  let next = c.currentTime + 1;
  const pulse = () => {
    while (next < c.currentTime + 0.3) {
      const o = c.createOscillator(); o.frequency.value = 46;
      const g = c.createGain(); o.connect(g).connect(out);
      s.env(g.gain, next, 0.22, 0.01, 0.22); o.start(next); o.stop(next + 0.3);
      next += beat;
    }
    pulseTimer = window.setTimeout(pulse, 120);
  };
  pulse();

  running = {
    stop() {
      clearTimeout(bellTimer); clearTimeout(pulseTimer);
      const t = c.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0.0001, t, 0.6);
      setTimeout(() => { [...drone, breath].forEach((o) => { try { o.stop(); } catch { /* stopped */ } }); }, 3000);
      running = null;
    },
  };
  return running;
}
