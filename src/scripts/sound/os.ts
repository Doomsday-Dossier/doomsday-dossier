/**
 * DOOM-OS's interface sounds (CLAUDE.md, sound map): the machine Doom built, heard. All original synthesis on the
 * actions bus, quiet under the score; each checks that sound is running, so the interface can call them freely.
 */
import type { Sound } from './engine';

const live = (s: Sound) => s.ctx.state === 'running';

/** Powering up: a low hum swelling through a closing filter, a relay clunk at the top. */
export function bootHum(s: Sound, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  const c = s.ctx, g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(120, t); lp.frequency.exponentialRampToValueAtTime(900, t + 1.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  lp.connect(g).connect(s.sfx); s.wet(g, 0.35, s.sfx);
  for (const [f, d] of [[55, -6], [55, 6], [110, 0], [165, 3]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + 3.3); }
  const k = s.osc('square', 70, s.sfx); s.env(k.g.gain, t + 1.25, 0.2, 0.002, 0.06); k.o.start(t + 1.2); k.o.stop(t + 1.4);
}

/** A key of the terminal: a dry relay tick, a little different each time. */
export function tick(s: Sound, t = s.ctx.currentTime + 0.005) {
  if (!live(s)) return;
  const o = s.osc('square', 1800 + Math.random() * 700, s.sfx);
  s.env(o.g.gain, t, 0.035, 0.0005, 0.012); o.o.start(t); o.o.stop(t + 0.03);
}

/** The scanner passing down a target: filtered noise rising in pitch over `secs`. */
export function sweep(s: Sound, secs = 2.2, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  const v = s.noiseVoice('pink', 'bandpass', 400, 6, s.sfx, false);
  v.f.frequency.setValueAtTime(300, t); v.f.frequency.exponentialRampToValueAtTime(3600, t + secs);
  v.g.gain.setValueAtTime(0.0001, t); v.g.gain.exponentialRampToValueAtTime(0.32, t + 0.2); v.g.gain.setValueAtTime(0.32, t + secs - 0.2); v.g.gain.exponentialRampToValueAtTime(0.0001, t + secs + 0.1);
  v.src.start(t, Math.random() * 2, secs + 0.2);
  const hum = s.osc('sine', 220, s.sfx); hum.o.frequency.setValueAtTime(220, t); hum.o.frequency.linearRampToValueAtTime(330, t + secs);
  s.env(hum.g.gain, t, 0.05, 0.2, secs); hum.o.start(t); hum.o.stop(t + secs + 0.3);
}

/** Target acquired: two clean tones, the second a fifth higher. */
export function lock(s: Sound, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  [[880, 0], [1320, 0.11]].forEach(([f, dt]) => { const o = s.osc('triangle', f, s.sfx); s.env(o.g.gain, t + dt, 0.16, 0.002, 0.09); o.o.start(t + dt); o.o.stop(t + dt + 0.15); s.wet(o.g, 0.3, s.sfx); });
}

/** Decrypting: a burst of rising data chirps. */
export function decrypt(s: Sound, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  for (let i = 0; i < 9; i++) { const o = s.osc('square', 600 + i * 140 + Math.random() * 80, s.sfx); s.env(o.g.gain, t + i * 0.045, 0.04, 0.001, 0.03); o.o.start(t + i * 0.045); o.o.stop(t + i * 0.045 + 0.05); }
}
