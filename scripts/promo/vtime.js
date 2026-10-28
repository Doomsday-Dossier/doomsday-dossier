// Virtual time for frame-perfect promo capture (scripts/promo/vcapture.mjs). Injected before any page script, it takes
// over the page's clock: performance.now, Date, timers and animation frames only move when window.__advance(ms) is
// called, and every Web Animation (CSS ones included) is paused and set to the virtual time each step. The page's
// AudioContext becomes an OfflineAudioContext whose currentTime is the virtual clock, so every sound the site schedules
// lands at its exact moment, rendered at the end with window.__renderAudio(). Nothing here runs on the real site.
(() => {
  if (window.__advance) return;
  let vt = 0; // virtual milliseconds since the page started
  const realNow = performance.now.bind(performance), p0 = realNow(), d0 = Date.now();
  window.__vt = () => vt;
  performance.now = () => p0 + vt;
  const RDate = Date;
  function VDate(...a) { if (!new.target) return new RDate(d0 + vt).toString(); return a.length ? new RDate(...a) : new RDate(d0 + vt); }
  VDate.prototype = RDate.prototype; VDate.now = () => d0 + vt; VDate.parse = RDate.parse; VDate.UTC = RDate.UTC;
  window.Date = VDate;
  let id = 1;
  const timers = new Map(), frames = new Map();
  window.setTimeout = (fn, ms = 0, ...args) => { const i = id++; timers.set(i, { fn, at: vt + Math.max(0, +ms || 0), args }); return i; };
  window.setInterval = (fn, ms = 0, ...args) => { const i = id++; const every = Math.max(1, +ms || 0); timers.set(i, { fn, at: vt + every, every, args }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  window.requestAnimationFrame = (cb) => { const i = id++; frames.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { frames.delete(i); };
  const run = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(fn); } catch (e) { console.error(e); } };
  const syncAnimations = () => {
    for (const a of document.getAnimations()) {
      if (a.__v0 === undefined) { a.__v0 = vt - (a.currentTime || 0); try { a.pause(); } catch {} }
      const end = a.effect?.getComputedTiming?.().endTime;
      const t = (vt - a.__v0) * (a.playbackRate || 1);
      if (typeof end === 'number' && isFinite(end) && t >= end) { try { a.finish(); } catch {} continue; }
      try { a.currentTime = t; } catch {}
    }
  };
  /** Moves the clock on by ms: due timers fire in order, then one animation frame. */
  window.__advance = (ms) => {
    const target = vt + ms;
    for (let guard = 0; guard < 5000; guard++) {
      let next = null;
      for (const [i, t] of timers) if (t.at <= target && (!next || t.at < next[1].at)) next = [i, t];
      if (!next) break;
      const [i, t] = next;
      vt = Math.max(vt, t.at);
      if (t.every) t.at += t.every; else timers.delete(i);
      run(t.fn, t.args);
    }
    vt = target;
    const cbs = [...frames.values()]; frames.clear();
    for (const cb of cbs) run(cb, [p0 + vt]);
    syncAnimations();
  };
  // sound: rendered offline on the virtual clock
  const SECONDS = 200, RATE = 48000;
  class VirtualAudioContext extends OfflineAudioContext {
    constructor() {
      super({ numberOfChannels: 2, length: SECONDS * RATE, sampleRate: RATE });
      Object.defineProperty(this, 'currentTime', { get: () => vt / 1000 });
      Object.defineProperty(this, 'state', { get: () => 'running' });
    }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
  }
  window.AudioContext = VirtualAudioContext; window.webkitAudioContext = VirtualAudioContext;
  /** Renders every sound scheduled so far and returns it as a base64 16-bit stereo WAV. */
  window.__renderAudio = async (ctx) => {
    const buf = await OfflineAudioContext.prototype.startRendering.call(ctx);
    const n = Math.min(buf.length, Math.ceil((vt / 1000 + 1) * RATE)), L = buf.getChannelData(0), R = buf.getChannelData(1);
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, RATE, true); out.setUint32(28, RATE * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(out.buffer); let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(bin);
  };
})();
