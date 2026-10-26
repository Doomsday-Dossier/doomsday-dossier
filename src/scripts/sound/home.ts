/**
 * Home page sounds (sound map in CLAUDE.md): a file sliding into view as each one arrives in the archive, and
 * the green flood as the camera passes through Doom's mask (the forge's green hum swelling, with a rush of air
 * through the eye slit). All synthesised; action sounds on the actions bus, under the forge.
 */
import type { Sound } from './engine';

/** A file sliding out of the drawer: a soft low swish and a dull wooden-iron thud as it settles. */
export function fileArrive(s: Sound, t = s.ctx.currentTime + 0.01) {
  const out = s.sfx;
  const sw = s.noiseVoice('pink', 'bandpass', 700, 0.9, out, false);
  sw.f.frequency.setValueAtTime(420, t);
  sw.f.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
  s.env(sw.g.gain, t, 0.35, 0.08, 0.3);
  sw.src.start(t, Math.random() * 2, 0.5);
  const thud = s.osc('sine', 92, out);
  s.env(thud.g.gain, t + 0.27, 0.45, 0.004, 0.16);
  thud.o.start(t + 0.25); thud.o.stop(t + 0.5);
  s.wet(sw.g, 0.25, out); s.wet(thud.g, 0.3, out);
}

/** The green flood through the mask: the hum's minor chord swelling, an airy rush rising into the eye. */
export function floodRise(s: Sound, seconds = 1.8, t = s.ctx.currentTime + 0.01) {
  const c = s.ctx, out = s.sfx;
  const g = c.createGain(); g.gain.value = 0.0001;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.value = 220;
  lp.connect(g).connect(out); s.wet(g, 0.7, out);
  const oscs = [55, 82.41, 110, 130.81, 164.81].flatMap((f) => [-7, 7].map((cents) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents; o.connect(lp); return o; }));
  g.gain.exponentialRampToValueAtTime(0.5, t + seconds);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 2.2);
  lp.frequency.setValueAtTime(220, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + seconds);
  oscs.forEach((o) => { o.start(t); o.stop(t + seconds + 2.4); });
  const air = s.noiseVoice('white', 'bandpass', 600, 1.2, out, false);
  air.f.frequency.setValueAtTime(500, t);
  air.f.frequency.exponentialRampToValueAtTime(5200, t + seconds);
  air.g.gain.setValueAtTime(0.0001, t);
  air.g.gain.exponentialRampToValueAtTime(0.28, t + seconds * 0.95);
  air.g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.8);
  air.src.start(t, 0, seconds + 1);
}
