/**
 * The subject scan (Module 04, the profiler): the visitor's own camera, read for a few seconds and drawn as Doom's
 * green wireframe. Opt-in from a button, video only, never recorded. Each frame is drawn mirrored into a 160 px
 * buffer, reduced to luminance (auto-gained, so a dim room still reads) and its Sobel edges, then painted as
 * phosphor rows lifted by brightness, contour dots on the edges and a sweeping scan line; the next frame overwrites
 * it. Nothing is uploaded, stored or kept: when the scan ends, is skipped, the tab is hidden or the page is left,
 * every track is stopped, the video detached, the buffers wiped and the canvas cleared.
 */
import { reduced } from './fx';

export type CamEnd = 'done' | 'denied' | 'none' | 'stopped';
export type CamScan = { done: Promise<CamEnd>; stop(): void };

/** True when the browser can ask for a camera at all (a secure page with getUserMedia). */
export const canCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

export function cameraScan(canvas: HTMLCanvasElement, o: { seconds?: number; onLive?: () => void; onFrame?: (points: number) => void } = {}): CamScan {
  const rm = reduced(), len = (o.seconds ?? 4) * 1000;
  let stream: MediaStream | null = null, raf = 0, over = false, resolve!: (e: CamEnd) => void;
  const done = new Promise<CamEnd>((r) => { resolve = r; });
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true'); video.className = 'cam-vid';
  const buf = document.createElement('canvas'), bg = buf.getContext('2d', { willReadFrequently: true })!, g = canvas.getContext('2d')!;
  let W = 0, H = 0, lum = new Float32Array(0), mag = new Float32Array(0), lo = 0, hi = 1;

  const end = (why: CamEnd) => {
    if (over) return;
    over = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis);
    stream?.getTracks().forEach((t) => t.stop()); stream = null;
    video.pause(); video.srcObject = null; video.remove();
    bg.clearRect(0, 0, buf.width, buf.height); buf.width = buf.height = 0;
    lum.fill(0); mag.fill(0); lum = mag = new Float32Array(0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    resolve(why);
  };
  // a hidden tab stops the camera at once
  const vis = () => { if (document.hidden) end('stopped'); };
  document.addEventListener('visibilitychange', vis);

  const draw = (ms: number) => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the frame, mirrored like a looking glass, read once and overwritten by the next
    bg.setTransform(-1, 0, 0, 1, W, 0); bg.drawImage(video, 0, 0, W, H);
    const px = bg.getImageData(0, 0, W, H).data;
    let mn = 1, mx = 0;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) { const v = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255; lum[i] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
    lo += (mn - lo) * 0.2; hi += (mx - hi) * 0.2;
    // stretched no further than five times, or a dark room's sensor noise turns into a field of dots
    const span = Math.max(0.2, hi - lo);
    for (let i = 0; i < W * H; i++) lum[i] = Math.min(1, Math.max(0, (lum[i] - lo) / span));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, a = lum[i - W - 1], b = lum[i - W], c = lum[i - W + 1], d = lum[i - 1], f = lum[i + 1], p = lum[i + W - 1], q = lum[i + W], r = lum[i + W + 1];
      const gx = c + 2 * f + r - a - 2 * d - p, gy = p + 2 * q + r - a - 2 * b - c;
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
    // cover the panel; fade in over the first 0.4 s and out over the last
    const sc = Math.max(cw / W, ch / H), ox = (cw - W * sc) / 2, oy = (ch - H * sc) / 2;
    const fade = Math.max(0, Math.min(1, ms / 400, (len - ms) / 400));
    g.fillStyle = rm ? '#020504' : 'rgba(2, 5, 4, 0.55)'; g.fillRect(0, 0, cw, ch);
    const sweep = rm ? -99 : ((ms / 1500) % 1) * H;
    // scan rows, lifted by brightness like a depth mesh, bright where the sweep passes
    g.lineWidth = 1;
    for (let y = 2; y < H; y += 4) {
      const near = Math.max(0, 1 - Math.abs(y - sweep) / 10);
      g.strokeStyle = `rgba(61, 255, 143, ${((0.16 + near * 0.6) * fade).toFixed(3)})`;
      g.beginPath();
      for (let x = 0; x < W; x += 2) { const X = ox + x * sc, Y = oy + y * sc - lum[y * W + x] * sc * 3; if (x) g.lineTo(X, Y); else g.moveTo(X, Y); }
      g.stroke();
    }
    // contour dots on the edges, two strengths
    const mid = new Path2D(), strong = new Path2D(), dot = Math.max(1.2, sc * 0.55);
    let n = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const m = mag[y * W + x]; if (m < 0.55) continue;
      n++; (m > 1.1 ? strong : mid).rect(ox + x * sc - dot / 2, oy + y * sc - dot / 2, dot, dot);
    }
    g.fillStyle = `rgba(61, 255, 143, ${(0.5 * fade).toFixed(3)})`; g.fill(mid);
    g.fillStyle = `rgba(175, 255, 210, ${(0.95 * fade).toFixed(3)})`; g.fill(strong);
    // the sweep: a soft band trailing a bright line
    if (!rm) {
      const Y = oy + sweep * sc, gr = g.createLinearGradient(0, Y - 28, 0, Y);
      gr.addColorStop(0, 'rgba(61, 255, 143, 0)'); gr.addColorStop(1, `rgba(61, 255, 143, ${(0.32 * fade).toFixed(3)})`);
      g.fillStyle = gr; g.fillRect(0, Y - 28, cw, 28);
      g.fillStyle = `rgba(190, 255, 220, ${(0.9 * fade).toFixed(3)})`; g.fillRect(0, Y, cw, 1.5);
    }
    o.onFrame?.(n);
  };

  (async () => {
    let s: MediaStream;
    try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); }
    catch (e) { const nm = (e as DOMException)?.name; end(nm === 'NotAllowedError' || nm === 'SecurityError' || nm === 'PermissionDeniedError' ? 'denied' : 'none'); return; }
    // skipped while the browser was asking: the camera goes straight off again
    if (over) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s; video.srcObject = s; canvas.parentElement?.append(video);
    video.play().catch(() => { /* a muted stream may play; frames are checked below */ });
    await new Promise<void>((r) => { if (video.readyState >= 2) return r(); video.addEventListener('loadeddata', () => r(), { once: true }); setTimeout(r, 4000); });
    if (over) return;
    if (!video.videoWidth) { end('none'); return; }
    W = 160; H = Math.max(60, Math.round((W * video.videoHeight) / video.videoWidth));
    buf.width = W; buf.height = H; lum = new Float32Array(W * H); mag = new Float32Array(W * H);
    o.onLive?.();
    const t0 = performance.now();
    const frame = (now: number) => {
      if (over) return;
      const ms = now - t0;
      if (ms >= len) { end('done'); return; }
      raf = requestAnimationFrame(frame);
      draw(ms);
    };
    raf = requestAnimationFrame(frame);
  })();

  return { done, stop: () => end('stopped') };
}
