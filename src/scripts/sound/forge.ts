/**
 * The forge's sound, scheduled against the forge timing from the click (sound map in CLAUDE.md). Every sound
 * is synthesised here: a furnace rumble that builds, ember crackle, a thick heavy pour, the sizzle and ticks
 * of iron cooling, a rising resonant green hum, the deep metallic crack and low boom as the mould splits, a
 * low groan as the title rises, and the slow tick of a heavy clock as the countdown etches in.
 */
import type { Timing } from '../forge/timing';
import type { Sound } from './engine';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function playForge(s: Sound, T: Timing, t0 = s.ctx.currentTime + 0.02) {
  const c = s.ctx, out = s.forge, at = (x: number) => t0 + x;
  const stops: (() => void)[] = [];
  const end = at(T.total + 4);

  // furnace rumble: deep brown noise and a 38 Hz body, swelling, lifting at the crack, settling under the title
  const r = s.noiseVoice('brown', 'lowpass', 120, 4, out);
  const body = s.osc('sine', 38, out);
  for (const [g, peak] of [[r.g.gain, 0.9], [body.g.gain, 0.35]] as const) {
    g.setValueAtTime(0.0001, at(0));
    g.exponentialRampToValueAtTime(peak, at(T.rumble[1]));
    g.setValueAtTime(peak, at(T.crack));
    g.linearRampToValueAtTime(peak * 1.3, at(T.crack + 0.05));
    g.exponentialRampToValueAtTime(peak * 0.25, at(T.total));
    g.exponentialRampToValueAtTime(0.0001, end);
  }
  r.f.frequency.setValueAtTime(70, at(0));
  r.f.frequency.exponentialRampToValueAtTime(140, at(T.rumble[1]));
  r.src.start(at(0)); r.src.stop(end); body.o.start(at(0)); body.o.stop(end);
  stops.push(() => { r.src.stop(); body.o.stop(); });

  // ember crackle: short band-passed clicks, scattered, thinning out once the mould cracks
  const crackleEnd = Math.max(T.seep[1], 0.6);
  for (let t = 0.1; t < crackleEnd; t += -Math.log(Math.random()) / 9) {
    const src = c.createBufferSource(); src.buffer = s.noise('white');
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(1800, 5200); f.Q.value = 2;
    const g = c.createGain(); const p = c.createStereoPanner(); p.pan.value = rnd(-0.7, 0.7);
    src.connect(f).connect(g).connect(p).connect(out);
    s.env(g.gain, at(t), rnd(0.04, 0.22), 0.001, rnd(0.015, 0.05));
    src.start(at(t), rnd(0, 3), 0.08);
  }

  // the pour: a thick low hiss with a slow bubbling, and the weight of the metal underneath
  if (T.pour[0] >= 0) {
    const h = s.noiseVoice('pink', 'lowpass', 900, 0.8, out);
    const weight = s.noiseVoice('brown', 'bandpass', 110, 2, out);
    const bub = c.createOscillator(); bub.frequency.value = 7;
    const depth = c.createGain(); depth.gain.value = 260; bub.connect(depth).connect(h.f.frequency);
    for (const [g, peak] of [[h.g.gain, 0.55], [weight.g.gain, 0.7]] as const) {
      g.setValueAtTime(0.0001, at(T.pour[0]));
      g.exponentialRampToValueAtTime(peak, at(T.pour[0] + 0.18));
      g.setValueAtTime(peak, at(T.pour[1] - 0.05));
      g.exponentialRampToValueAtTime(0.0001, at(T.pour[1] + 0.45));
    }
    s.wet(h.g, 0.25);
    for (const n of [h.src, weight.src, bub]) { n.start(at(T.pour[0])); n.stop(at(T.pour[1] + 0.6)); }

    // sizzle: hot metal meeting air, crackly, building through the pour and thinning as it cools
    const z = s.noiseVoice('white', 'highpass', 3200, 0.7, out);
    const z0 = T.pour[0] + 0.25, z1 = T.pour[1] + T.coolDur;
    z.g.gain.setValueAtTime(0.0001, at(z0));
    for (let t = z0; t < z1; t += 0.035) {
      const k = t < T.pour[1] ? (t - z0) / (T.pour[1] - z0) : 1 - (t - T.pour[1]) / (z1 - T.pour[1]);
      z.g.gain.setValueAtTime(Math.max(0.0001, 0.16 * Math.max(0, k) * rnd(0.35, 1)), at(t));
    }
    z.g.gain.exponentialRampToValueAtTime(0.0001, at(z1 + 0.2));
    z.src.start(at(z0)); z.src.stop(at(z1 + 0.3));

    // ticks: cast iron contracting as it cools, quick at first then slowing
    let t = T.pour[0] + 0.6;
    for (let i = 0; t < z1 + 0.4; i++) {
      const base = rnd(1900, 3600), g = c.createGain(), p = c.createStereoPanner();
      p.pan.value = rnd(-0.6, 0.6); g.connect(p).connect(out); s.wet(g, 0.35);
      for (const ratio of [1, 1.59, 2.43]) {
        const o = c.createOscillator(); o.frequency.value = base * ratio; o.connect(g); o.start(at(t)); o.stop(at(t + 0.2));
      }
      s.env(g.gain, at(t), rnd(0.05, 0.12), 0.001, rnd(0.06, 0.12));
      t += 0.12 + i * 0.03 + rnd(0, 0.15);
    }
  }

  // the green hum: a low minor chord, rising through an opening filter, trembling, choked at the crack
  const hum = c.createGain(); hum.gain.value = 0.0001;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.value = 180;
  // the tremolo multiplies the hum (a gain of 1 swinging by 0.12), so the hum can still fade to silence
  const tremNode = c.createGain(); tremNode.gain.value = 1;
  lp.connect(tremNode).connect(hum).connect(out); s.wet(hum, 0.5);
  const trem = c.createOscillator(); trem.frequency.value = 5.2;
  const tremG = c.createGain(); tremG.gain.value = 0.12; trem.connect(tremG).connect(tremNode.gain);
  const notes = [55, 65.41, 82.41, 110, 130.81];
  const voices = notes.flatMap((f) => [-6, 6].map((cents) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents; o.connect(lp); return o; }));
  const sub = c.createOscillator(); sub.frequency.value = 55; const subG = c.createGain(); subG.gain.value = 0.5; sub.connect(subG).connect(hum);
  hum.gain.setValueAtTime(0.0001, at(T.seep[0]));
  hum.gain.exponentialRampToValueAtTime(0.32, at(T.seep[1]));
  hum.gain.setValueAtTime(0.32, at(T.crack - 0.02));
  hum.gain.exponentialRampToValueAtTime(0.06, at(T.crack + 0.25));
  hum.gain.exponentialRampToValueAtTime(0.0001, at(T.total + 2.5));
  lp.frequency.setValueAtTime(180, at(T.seep[0]));
  lp.frequency.exponentialRampToValueAtTime(1700, at(T.seep[1]));
  lp.frequency.exponentialRampToValueAtTime(400, at(T.crack + 0.6));
  for (const o of [...voices, sub, trem]) { o.start(at(T.seep[0])); o.stop(at(T.total + 2.6)); }

  // the crack: a hard transient and the mould ringing like struck metal
  const ck = s.noiseVoice('white', 'highpass', 1500, 0.7, out, false);
  s.env(ck.g.gain, at(T.crack), 0.9, 0.001, 0.05);
  ck.src.start(at(T.crack), 0.3, 0.2);
  const ring = c.createGain(); ring.connect(out); s.wet(ring, 0.9);
  for (const ratio of [1, 2.76, 5.40, 8.93, 13.34]) {
    const o = c.createOscillator(); o.frequency.value = 410 * ratio; o.connect(ring); o.start(at(T.crack)); o.stop(at(T.crack + 1.6));
  }
  s.env(ring.gain, at(T.crack), 0.16, 0.002, 1.2);

  // the boom: a sweeping sub drop and a burst of deep noise
  const boom = s.osc('sine', 70, out); s.wet(boom.g, 0.6);
  boom.o.frequency.setValueAtTime(72, at(T.crack + 0.02));
  boom.o.frequency.exponentialRampToValueAtTime(28, at(T.crack + 1.3));
  s.env(boom.g.gain, at(T.crack + 0.02), 0.95, 0.006, 1.9);
  boom.o.start(at(T.crack)); boom.o.stop(at(T.crack + 2.2));
  const thud = s.noiseVoice('brown', 'lowpass', 90, 1, out, false);
  s.env(thud.g.gain, at(T.crack + 0.02), 0.9, 0.004, 0.7);
  thud.src.start(at(T.crack), 0, 1);

  // the title rising: a low iron groan
  const groan = s.noiseVoice('brown', 'bandpass', 240, 6, out);
  groan.f.frequency.setValueAtTime(200, at(T.stand[0]));
  groan.f.frequency.exponentialRampToValueAtTime(340, at(T.stand[1]));
  groan.g.gain.setValueAtTime(0.0001, at(T.stand[0]));
  groan.g.gain.exponentialRampToValueAtTime(0.35, at(T.stand[0] + 0.25));
  groan.g.gain.exponentialRampToValueAtTime(0.0001, at(T.stand[1] + 0.2));
  s.wet(groan.g, 0.4);
  groan.src.start(at(T.stand[0])); groan.src.stop(at(T.stand[1] + 0.3));

  // the heavy clock: one tick a second from the moment the countdown begins to etch
  for (let k = 0, t = T.etch[0]; k < 6; k++, t += 1) clockTick(s, at(t), k % 2 === 1);

  return { stop: () => { const n = c.currentTime; s.forge.gain.cancelScheduledValues(n); s.forge.gain.setTargetAtTime(0, n, 0.08); setTimeout(() => { stops.forEach((f) => { try { f(); } catch { /* already stopped */ } }); s.forge.gain.setValueAtTime(0.42, c.currentTime); }, 600); } };
}

/** The slow tick of a heavy clock: a wooden-metal click, a low body, a large room. Tock a little lower. */
export function clockTick(s: Sound, t: number, tock = false, level = 1) {
  const c = s.ctx, out = s.forge;
  const click = s.noiseVoice('white', 'bandpass', tock ? 1900 : 2300, 3, out, false);
  s.env(click.g.gain, t, 0.35 * level, 0.001, 0.02);
  click.src.start(t, Math.random() * 2, 0.06);
  const body = s.osc('sine', tock ? 160 : 180, out);
  s.env(body.g.gain, t, 0.3 * level, 0.002, 0.09);
  body.o.start(t); body.o.stop(t + 0.15);
  const low = s.osc('sine', 62, out);
  s.env(low.g.gain, t, 0.35 * level, 0.004, 0.16);
  low.o.start(t); low.o.stop(t + 0.25);
  s.wet(click.g, 0.7); s.wet(body.g, 0.5);
  void c;
}
