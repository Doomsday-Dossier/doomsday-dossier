/**
 * The mask (the Royal chamber): His Majesty puts on Doom's mask. The mask is forged and put on hot in the comics
 * (Fantastic Four Annual #2, 1964); the drawing is this site's own, not a Marvel design.
 *
 * Opt-in from a button. The camera feeds this page only: each frame is drawn mirrored into a small buffer, turned to
 * green phosphor and painted with the mask as a dashed guide to line the face up with. "Seal the mask" counts down,
 * takes one frame, welds the mask on in iron with burning eye slits, and stops the camera at once. The still exists
 * only in this page's memory, until the visitor saves a card (16:9 or 9:16) to their own device. Nothing is uploaded,
 * recorded or stored; leaving the page or hiding the tab also stops the camera.
 */
import { tick, lock, slam, staticBurst } from '../sound/os';
import { reduced, sound } from './fx';
import { reign, log, daysBefore } from './reign';

// the mask, in the 40 x 50 box the site draws it in everywhere (the register's Doom's will, the seal)
const SHELL = new Path2D('M6 5 Q20 0 34 5 L36 30 Q34 44 20 49 Q6 44 4 30 Z');
const BROW = new Path2D('M20 9 L20 31');
const GRILLE = new Path2D('M13 36 L27 36 M14 39 L26 39 M15.5 42 L24.5 42');
const SLITS: [number, number, number, number][] = [[8.5, 17, 9.5, 2.6], [22, 17, 9.5, 2.6]];
const G = '#3dff8f', BG = '#020504', DIM = '#5f8f74', TXT = '#cdf5df';
// where the mask sits on the square frame: centred, a little high, a face's width
const MX = 0.5, MY = 0.47, MW = 0.44;

/** Puts the mask's box into the frame: an origin and a scale, so the 40 x 50 drawing lands over the face. */
const place = (g: CanvasRenderingContext2D, size: number) => { const s = (size * MW) / 40; g.translate(size * MX - 20 * s, size * MY - 25 * s); g.scale(s, s); return s; };

/** The mask as a dashed guide over the live picture. */
function guide(g: CanvasRenderingContext2D, size: number, t: number) {
  g.save(); place(g, size);
  g.lineWidth = 0.45; g.strokeStyle = 'rgba(61,255,143,0.9)'; g.setLineDash([1.6, 1.2]); g.lineDashOffset = -t * 0.004;
  g.stroke(SHELL); g.setLineDash([]); g.lineWidth = 0.3; g.strokeStyle = 'rgba(61,255,143,0.45)'; g.stroke(BROW); g.stroke(GRILLE);
  for (const [x, y, w, h] of SLITS) { g.fillStyle = 'rgba(61,255,143,0.35)'; g.fillRect(x, y, w, h); }
  g.restore();
}

/** The mask welded on: dark iron, a lit edge, burning slits. */
function weld(g: CanvasRenderingContext2D, size: number) {
  g.save(); const s = place(g, size);
  const iron = g.createLinearGradient(0, 0, 40, 50); iron.addColorStop(0, '#3b4a43'); iron.addColorStop(0.45, '#18221d'); iron.addColorStop(1, '#070b09');
  g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 6 * s; g.fillStyle = iron; g.fill(SHELL); g.shadowBlur = 0;
  // a sheen down the brow, as worn metal catches the light
  const sheen = g.createLinearGradient(12, 0, 28, 0); sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(205,245,223,0.16)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fill(SHELL);
  g.lineWidth = 0.7; g.strokeStyle = G; g.shadowColor = G; g.shadowBlur = 3 * s; g.stroke(SHELL);
  g.lineWidth = 0.4; g.strokeStyle = 'rgba(61,255,143,0.55)'; g.shadowBlur = 0; g.stroke(BROW); g.stroke(GRILLE);
  g.shadowColor = G; g.shadowBlur = 5 * s; g.fillStyle = '#b8ffd6';
  for (const [x, y, w, h] of SLITS) g.fillRect(x, y, w, h);
  g.restore();
}

/** A video frame, mirrored and cropped square, turned to green phosphor at `px` pixels. */
function phosphor(video: HTMLVideoElement, px: number, buf: HTMLCanvasElement) {
  buf.width = buf.height = px;
  const b = buf.getContext('2d', { willReadFrequently: true })!;
  const vw = video.videoWidth, vh = video.videoHeight, side = Math.min(vw, vh);
  b.save(); b.translate(px, 0); b.scale(-1, 1);
  b.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, px, px); b.restore();
  const img = b.getImageData(0, 0, px, px), d = img.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 16) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (l < lo) lo = l; if (l > hi) hi = l; }
  const k = 255 / Math.max(40, hi - lo);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = Math.floor(p / px), l = Math.min(1, ((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) - lo) * k / 255);
    const row = y % 3 === 2 ? 0.72 : 1;
    d[i] = (12 + l * 120) * row; d[i + 1] = (24 + l * 231) * row; d[i + 2] = (16 + l * 140) * row;
  }
  b.putImageData(img, 0, 0);
  return buf;
}

export function crown(root: HTMLElement, o: { site: string; seal: string }) {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const stage = $<HTMLElement>('[data-cr-stage]'), cam = $<HTMLCanvasElement>('[data-cr-cam]'), msg = $<HTMLElement>('[data-cr-msg]');
  const start = $<HTMLButtonElement>('[data-cr-start]'), sealBtn = $<HTMLButtonElement>('[data-cr-seal]'), again = $<HTMLButtonElement>('[data-cr-again]');
  const saves = [...root.querySelectorAll<HTMLButtonElement>('[data-cr-save]')], preview = $<HTMLImageElement>('[data-cr-preview]');
  const s = sound(), rm = reduced(), g = cam.getContext('2d')!, buf = document.createElement('canvas');
  let stream: MediaStream | null = null, raf = 0, still: HTMLCanvasElement | null = null;
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.setAttribute('playsinline', '');

  const show = (state: 'idle' | 'live' | 'done') => {
    start.hidden = state !== 'idle'; sealBtn.hidden = state !== 'live'; again.hidden = state !== 'done';
    saves.forEach((b) => (b.hidden = state !== 'done')); stage.hidden = state === 'idle'; preview.hidden = state !== 'done'; cam.hidden = state === 'done';
  };
  const stop = () => {
    cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stream = null;
    video.pause(); video.srcObject = null; document.removeEventListener('visibilitychange', vis);
  };
  const vis = () => { if (document.hidden && stream) { stop(); show('idle'); msg.textContent = 'The camera turned off when the page was hidden.'; } };
  addEventListener('astro:before-swap', stop, { once: true });

  const frame = (t: number) => {
    if (!stream) return;
    raf = requestAnimationFrame(frame);
    if (video.readyState < 2) return;
    const size = cam.width;
    g.imageSmoothingEnabled = true; g.drawImage(phosphor(video, 200, buf), 0, 0, size, size);
    guide(g, size, t);
    // a scan line passing down the face
    if (!rm) { const y = ((t * 0.12) % (size + 40)) - 20; const sg = g.createLinearGradient(0, y - 18, 0, y + 2); sg.addColorStop(0, 'rgba(61,255,143,0)'); sg.addColorStop(1, 'rgba(61,255,143,0.35)'); g.fillStyle = sg; g.fillRect(0, y - 18, size, 20); }
  };

  start.addEventListener('click', async () => {
    msg.textContent = 'Asking for the camera…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
    } catch {
      msg.textContent = 'No camera, or it was not allowed. Nothing was recorded.'; return;
    }
    video.srcObject = stream; await video.play().catch(() => {});
    // show the stage first: a hidden box measures 0 wide, which would make the canvas empty
    show('live'); msg.textContent = 'Line your face up with the mask, then seal it.';
    const px = Math.min(720, Math.round((stage.clientWidth || 360) * Math.min(2, devicePixelRatio || 1))); cam.width = cam.height = px;
    document.addEventListener('visibilitychange', vis);
    staticBurst(s); raf = requestAnimationFrame(frame);
  });

  sealBtn.addEventListener('click', async () => {
    if (!stream) return;
    sealBtn.disabled = true;
    if (!rm) for (const n of [3, 2, 1]) { msg.textContent = `Hold still… ${n}`; tick(s); await new Promise((r) => setTimeout(r, 650)); }
    // one frame, then the camera goes off
    const size = 720; still = document.createElement('canvas'); still.width = still.height = size;
    const sg = still.getContext('2d')!; sg.drawImage(phosphor(video, 360, document.createElement('canvas')), 0, 0, size, size);
    stop(); weld(sg, size);
    lock(s); setTimeout(() => slam(s), 120);
    if (!rm) stage.animate([{ boxShadow: '0 0 0 0 rgba(184,255,214,0)', filter: 'brightness(3)' }, { boxShadow: '0 0 60px 10px rgba(61,255,143,0.5)', filter: 'brightness(1)' }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
    preview.src = card('story').toDataURL('image/jpeg', 0.9);
    show('done'); sealBtn.disabled = false;
    msg.textContent = 'The mask is on. The camera is off, and nothing left this device.';
    log('His Majesty put on the mask.');
  });

  again.addEventListener('click', () => { still = null; preview.removeAttribute('src'); show('idle'); start.click(); });

  /** The royal identity card, drawn from the still, as a 16:9 picture or a 9:16 story. */
  const card = (fmt: 'wide' | 'story') => {
    const tall = fmt === 'story', W = tall ? 1080 : 1920, H = tall ? 1920 : 1080;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const k = c.getContext('2d')!;
    k.fillStyle = BG; k.fillRect(0, 0, W, H);
    k.fillStyle = 'rgba(61,255,143,0.08)'; for (let y = 0; y < H; y += 22) for (let x = 0; x < W; x += 22) k.fillRect(x, y, 1.5, 1.5);
    k.strokeStyle = G; k.lineWidth = 3; const b = 34;
    k.beginPath(); k.moveTo(24, 24 + b); k.lineTo(24, 24); k.lineTo(24 + b, 24); k.moveTo(W - 24 - b, H - 24); k.lineTo(W - 24, H - 24); k.lineTo(W - 24, H - 24 - b); k.stroke();
    // the portrait, framed
    const ps = tall ? 760 : 820, px = tall ? (W - ps) / 2 : 110, py = tall ? 300 : (H - ps) / 2;
    if (still) k.drawImage(still, px, py, ps, ps);
    k.strokeStyle = 'rgba(61,255,143,0.6)'; k.lineWidth = 2; k.strokeRect(px, py, ps, ps);
    const days = daysBefore(), since = daysBefore(reign().since);
    const lines: [string, string, string][] = [
      ['700 26px "JetBrains Mono"', DIM, 'ROYAL IDENTITY // LATVERIA'],
      ['700 92px "Tektur Variable"', G, 'DOCTOR DOOM'],
      ['400 34px "JetBrains Mono"', TXT, 'Monarch of Latveria'],
      ['400 34px "JetBrains Mono"', TXT, `Reign began ${since} days before Doomsday`],
      ['700 34px "JetBrains Mono"', G, days > 0 ? `${days} days to Doomsday` : 'Doomsday has come'],
    ];
    const tx = tall ? W / 2 : px + ps + 90; let ty = tall ? py + ps + 110 : py + 120;
    k.textAlign = tall ? 'center' : 'left';
    lines.forEach(([font, col, text], i) => {
      k.font = font; k.fillStyle = col;
      if (i === 1) { k.shadowColor = G; k.shadowBlur = 18; }
      k.fillText(text, tx, ty); k.shadowBlur = 0;
      ty += i === 0 ? 100 : i === 1 ? 70 : 52;
    });
    k.textAlign = 'left';
    k.font = '400 18px "JetBrains Mono"'; k.fillStyle = DIM;
    const fy = tall ? H - 210 : H - 64;
    k.fillText('A fan card · Unofficial fan site, not affiliated with Marvel or Disney', 48, fy);
    k.fillText(`This site's own mask drawing, not a Marvel design · ${o.site}`, 48, fy + 26);
    return c;
  };
  const sealImg = new Image(); sealImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(o.seal.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));

  saves.forEach((b) => b.addEventListener('click', async () => {
    await Promise.all(['700 40px "Tektur Variable"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f).catch(() => {})));
    const fmt = b.dataset.crSave === 'story' ? 'story' : 'wide', c = card(fmt);
    if (sealImg.complete && sealImg.naturalWidth) { const k = c.getContext('2d')!; const sz = fmt === 'story' ? 180 : 220; k.drawImage(sealImg, c.width - sz - 70, fmt === 'story' ? 70 : 70, sz, sz); }
    c.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fmt === 'story' ? 'doom-identity-story.png' : 'doom-identity.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  }));

  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { start.disabled = true; msg.textContent = 'This browser cannot open a camera here.'; }
  show('idle');
}
