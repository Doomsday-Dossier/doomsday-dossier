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

/** A signal tearing in: a short burst of static, high-passed, with a low thump under it. */
export function staticBurst(s: Sound, t = s.ctx.currentTime + 0.005) {
  if (!live(s)) return;
  const v = s.noiseVoice('white', 'highpass', 1800, 0.7, s.sfx, false);
  v.g.gain.setValueAtTime(0.0001, t); v.g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  v.src.start(t, Math.random() * 2, 0.36);
  const th = s.osc('sine', 90, s.sfx); th.o.frequency.exponentialRampToValueAtTime(45, t + 0.2); s.env(th.g.gain, t, 0.25, 0.003, 0.2); th.o.start(t); th.o.stop(t + 0.3);
}

/** Glass breaking as the screen shatters: a hard bright crack, then tinkling shards and a dull thump under it. */
export function shatter(s: Sound, t = s.ctx.currentTime + 0.005) {
  if (!live(s)) return;
  const v = s.noiseVoice('white', 'highpass', 2600, 0.8, s.sfx, false);
  v.g.gain.setValueAtTime(0.0001, t); v.g.gain.exponentialRampToValueAtTime(0.2, t + 0.004); v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  v.src.start(t, Math.random() * 2, 0.3);
  for (let i = 0; i < 7; i++) {
    const at = t + 0.02 + Math.random() * 0.22, o = s.osc('sine', 2400 + Math.random() * 4200, s.sfx);
    s.env(o.g.gain, at, 0.05, 0.001, 0.05 + Math.random() * 0.08); o.o.start(at); o.o.stop(at + 0.2); s.wet(o.g, 0.25, s.sfx);
  }
  const th = s.osc('sine', 120, s.sfx); th.o.frequency.exponentialRampToValueAtTime(48, t + 0.18); s.env(th.g.gain, t, 0.18, 0.002, 0.16); th.o.start(t); th.o.stop(t + 0.25);
}

/** The shards flying apart onto the new screen: a falling rush of air. */
export function burst(s: Sound, t = s.ctx.currentTime + 0.005) {
  if (!live(s)) return;
  const v = s.noiseVoice('pink', 'bandpass', 2200, 1.4, s.sfx, false);
  v.f.frequency.setValueAtTime(2400, t); v.f.frequency.exponentialRampToValueAtTime(360, t + 0.55);
  v.g.gain.setValueAtTime(0.0001, t); v.g.gain.exponentialRampToValueAtTime(0.16, t + 0.05); v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  v.src.start(t, Math.random() * 2, 0.65);
}

/** Intrusion: a two-tone klaxon, four times, through a thin band-pass like a speaker in a control room. */
export function alarm(s: Sound, t = s.ctx.currentTime + 0.01) {
  if (!live(s)) return;
  const bp = s.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2; bp.connect(s.sfx);
  for (let i = 0; i < 4; i++) {
    const o = s.osc('square', i % 2 ? 440 : 660, bp); o.g.gain.value = 0;
    o.g.gain.setValueAtTime(0.0001, t + i * 0.22); o.g.gain.exponentialRampToValueAtTime(0.07, t + i * 0.22 + 0.01); o.g.gain.setValueAtTime(0.07, t + i * 0.22 + 0.17); o.g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.2);
    o.o.start(t + i * 0.22); o.o.stop(t + i * 0.22 + 0.21);
  }
}

/** An intrusion node cut: a hard electrical snap falling away, with a click of static. */
export function sever(s: Sound, t = s.ctx.currentTime + 0.005) {
  if (!live(s)) return;
  const o = s.osc('square', 1600, s.sfx); o.o.frequency.exponentialRampToValueAtTime(90, t + 0.16);
  s.env(o.g.gain, t, 0.09, 0.001, 0.16); o.o.start(t); o.o.stop(t + 0.2); s.wet(o.g, 0.2, s.sfx);
  const v = s.noiseVoice('white', 'bandpass', 3200, 1.5, s.sfx, false);
  v.g.gain.setValueAtTime(0.0001, t); v.g.gain.exponentialRampToValueAtTime(0.12, t + 0.003); v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  v.src.start(t, Math.random() * 2, 0.1);
}

/** Shards slamming shut: a low iron impact with a metallic ring and a long tail in the hall. */
export function slam(s: Sound, t = s.ctx.currentTime + 0.005) {
  if (!live(s)) return;
  const th = s.osc('sine', 110, s.sfx); th.o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
  s.env(th.g.gain, t, 0.5, 0.004, 0.7); th.o.start(t); th.o.stop(t + 0.8); s.wet(th.g, 0.5, s.sfx);
  for (const r of [1, 2.76, 5.4, 8.93]) { const o = s.osc('sine', 140 * r, s.sfx); s.env(o.g.gain, t, 0.05 / r, 0.002, 0.9 / Math.sqrt(r)); o.o.start(t); o.o.stop(t + 1.1); s.wet(o.g, 0.6, s.sfx); }
  const v = s.noiseVoice('brown', 'lowpass', 600, 0.7, s.sfx, false);
  v.g.gain.setValueAtTime(0.0001, t); v.g.gain.exponentialRampToValueAtTime(0.4, t + 0.006); v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  v.src.start(t, Math.random() * 2, 0.4);
}

/** The machine underneath everything: two detuned low tones through a slowly breathing filter. Returns a stop. */
export function drone(s: Sound) {
  if (!live(s)) return () => {};
  const c = s.ctx, t = c.currentTime, g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 3;
  lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg).connect(lp.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 4);
  lp.connect(g).connect(s.sfx); s.wet(g, 0.5, s.sfx);
  const oscs = [41.2, 41.6, 82.4, 123.5].map((f) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); return o; });
  lfo.start(t);
  return () => { const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0.0001, n, 0.4); setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 2500); };
}
