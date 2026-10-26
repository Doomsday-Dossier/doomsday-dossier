/**
 * The site's sound engine (design system v3). Everything is synthesised live with the Web Audio API: no audio
 * files, so every sound is this site's own work. Three buses meet at one master gain behind the mute button:
 * the forge (the loudest thing on the site), action sounds, and the score (about 24 dB under the forge, ducked
 * under action sounds). A generated impulse response gives a shared stone-hall reverb.
 *
 * Browsers only start sound after a click or tap: `unlock()` is called from that gesture. The mute choice is
 * remembered in localStorage `dd-sound`.
 */
const KEY = 'dd-sound';

export class Sound {
  private static one: Sound | null = null;
  static get() { return (Sound.one ??= new Sound()); }

  ctx: AudioContext;
  master: GainNode;
  forge: GainNode; sfx: GainNode; score: GainNode;
  reverb: ConvolverNode; send: GainNode;
  /** a tap of the final mix, for screen recordings with sound */
  tap: MediaStreamAudioDestinationNode | null = null;
  muted: boolean;
  private buffers = new Map<string, AudioBuffer>();
  private listeners = new Set<(m: boolean) => void>();

  private constructor() {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.muted = (() => { try { return localStorage.getItem(KEY) === 'off'; } catch { return false; } })();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    // a gentle limiter so stacked impacts never clip
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp).connect(this.ctx.destination);
    // levels: the forge is the loudest thing on the site and still sits well under full scale
    this.forge = this.bus(0.42);
    this.sfx = this.bus(0.22);
    this.score = this.bus(0.02); // about 24 dB under the forge: felt, not noticed
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.6, 2.4);
    this.send = this.ctx.createGain();
    this.send.gain.value = 0.9;
    this.send.connect(this.reverb).connect(this.master);
  }

  private bus(level: number) { const g = this.ctx.createGain(); g.gain.value = level; g.connect(this.master); return g; }

  /** Start (or resume) sound from a user gesture. */
  async unlock() { if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {}); }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* private mode */ }
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 1, t, 0.08);
    this.listeners.forEach((f) => f(m));
  }
  onMute(f: (m: boolean) => void) { this.listeners.add(f); return () => this.listeners.delete(f); }

  /** Sends the final mix to a MediaStream as well, for recordings. */
  record() {
    if (!this.tap) { this.tap = this.ctx.createMediaStreamDestination(); this.master.connect(this.tap); }
    return this.tap.stream;
  }

  /** Cached noise: white, pink (softer) or brown (deep). */
  noise(kind: 'white' | 'pink' | 'brown', seconds = 4) {
    const key = kind + seconds;
    const hit = this.buffers.get(key);
    if (hit) return hit;
    const n = Math.floor(this.ctx.sampleRate * seconds), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    this.buffers.set(key, buf);
    return buf;
  }

  /** A stone hall: decaying stereo noise with a darker tail. */
  private impulse(seconds: number, decay: number) {
    const n = Math.floor(this.ctx.sampleRate * seconds), buf = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.5 - 0.42 * t); // the tail loses its highs, as stone absorbs them
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  // small building blocks the sound designs share ---------------------------------------------------------

  /** A noise source through a filter into a gain, all returned so a design can shape them. */
  noiseVoice(kind: 'white' | 'pink' | 'brown', filter: BiquadFilterType, freq: number, q: number, out: AudioNode, loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise(kind); src.loop = loop;
    const f = this.ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(out);
    return { src, f, g };
  }

  osc(type: OscillatorType, freq: number, out: AudioNode) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(out);
    return { o, g };
  }

  /** An attack-decay envelope on a gain param, starting at t. */
  env(p: AudioParam, t: number, peak: number, attack: number, decay: number) {
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    p.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /**
   * A dry signal plus a share of it into the hall. The share goes through its bus's own send, at the bus's
   * level, so the reverb of a quiet bus (the score) stays as quiet as the bus itself.
   */
  wet(node: AudioNode, amount: number, bus: GainNode = this.forge) {
    let send = this.sends.get(bus);
    if (!send) { send = this.ctx.createGain(); send.gain.value = bus.gain.value; send.connect(this.send); this.sends.set(bus, send); }
    const g = this.ctx.createGain(); g.gain.value = amount; node.connect(g).connect(send);
    return node;
  }
  private sends = new Map<GainNode, GainNode>();
}
