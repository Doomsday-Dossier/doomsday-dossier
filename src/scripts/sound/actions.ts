/**
 * Sounds tied to actions (CLAUDE.md, sound map): a redaction bar tearing away, a stamp landing, the arena's
 * clash. Original synthesis on the actions bus; each checks that sound is running, so a page can call them
 * freely.
 */
import type { Sound } from './engine';

const live = (s: Sound) => s.ctx.state === 'running';

/** A redaction bar torn off: a short ripping burst through a rising band. */
export function tear(s: Sound, t = s.ctx.currentTime + 0.01, len = 0.22) {
  if (!live(s)) return;
  const v = s.noiseVoice('white', 'bandpass', 900, 0.8, s.sfx, false);
  v.f.frequency.setValueAtTime(700, t); v.f.frequency.exponentialRampToValueAtTime(3800, t + len);
  // a rip is many tiny tears: a fast irregular tremolo
  const am = s.ctx.createGain(); am.gain.value = 0.55; v.g.disconnect(); v.g.connect(am).connect(s.sfx);
  const lfo = s.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 55 + Math.random() * 30;
  const d = s.ctx.createGain(); d.gain.value = 0.45; lfo.connect(d).connect(am.gain);
  s.env(v.g.gain, t, 1.6, 0.01, len);
  v.src.start(t, Math.random() * 2, len + 0.05); lfo.start(t); lfo.stop(t + len + 0.05);
}

/** A censor's marker drawn across the page: a felt-tip squeak, a dry stroke falling in pitch as it runs out. */
export function redact(s: Sound, t = s.ctx.currentTime + 0.01, len = 0.42) {
  if (!live(s)) return;
  const v = s.noiseVoice('pink', 'bandpass', 2400, 2.2, s.sfx, false);
  v.f.frequency.setValueAtTime(3200, t); v.f.frequency.exponentialRampToValueAtTime(1500, t + len);
  s.env(v.g.gain, t, 0.9, 0.03, len);
  v.src.start(t, Math.random() * 2, len + 0.05);
  // the felt dragging on paper: a slow, uneven rasp
  const am = s.ctx.createGain(); am.gain.value = 0.7; v.g.disconnect(); v.g.connect(am).connect(s.sfx);
  const lfo = s.ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 18 + Math.random() * 8;
  const d = s.ctx.createGain(); d.gain.value = 0.3; lfo.connect(d).connect(am.gain);
  lfo.start(t); lfo.stop(t + len + 0.05);
}

/** A rubber stamp landing on paper: a dull 90 Hz thud and a slap. */
export function stamp(s: Sound, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  const o = s.osc('sine', 95, s.sfx);
  o.o.frequency.setValueAtTime(95, t); o.o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  s.env(o.g.gain, t, 0.85, 0.003, 0.2); o.o.start(t); o.o.stop(t + 0.3);
  const n = s.noiseVoice('pink', 'bandpass', 1500, 0.8, s.sfx, false);
  s.env(n.g.gain, t, 0.5, 0.001, 0.05); n.src.start(t, Math.random() * 2, 0.1);
  s.wet(o.g, 0.25, s.sfx);
}

/** The arena clash: a metallic impact, a sub thump and a short hall tail. */
export function clash(s: Sound, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  [1, 2.76, 5.4, 8.93].forEach((r, i) => {
    const o = s.osc('sine', 330 * r, s.sfx);
    s.env(o.g.gain, t, 0.2 / (1 + i), 0.002, 0.9 / (1 + i * 0.5)); o.o.start(t); o.o.stop(t + 1); s.wet(o.g, 0.5, s.sfx);
  });
  const sub = s.osc('sine', 70, s.sfx);
  sub.o.frequency.setValueAtTime(70, t); sub.o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
  s.env(sub.g.gain, t, 0.65, 0.004, 0.55); sub.o.start(t); sub.o.stop(t + 0.6);
  const n = s.noiseVoice('white', 'lowpass', 2400, 0.7, s.sfx, false);
  s.env(n.g.gain, t, 0.6, 0.001, 0.12); n.src.start(t, Math.random() * 2, 0.2);
}
