/**
 * Draws a classified file cover onto a canvas, used as a WebGL texture for the floating files in
 * the archive fly-through: aged-iron folder with a tab, a clipped print, the subject's name,
 * typed clearance lines, redaction bars and an accent stamp.
 */
import { C } from './tokens';

export type FileInfo = { slug: string; no: number; total: number; name: string; team: string; accent: string; photo: string | null; focus: string; href: string };

const TITLE = "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif";
const TYPE = "'Courier Prime', 'Courier New', monospace";

export async function fontsReady() {
  await Promise.all([document.fonts.load(`800 60px ${TITLE}`, 'DOOM'), document.fonts.load(`400 20px ${TYPE}`, 'FILE'), document.fonts.load(`700 20px ${TYPE}`, 'FILE')]).catch(() => {});
}

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focus: string) {
  const [fx, fy] = focus.split(/\s+/).map((v) => parseFloat(v) / 100);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  g.drawImage(img, (img.naturalWidth - sw) * (isNaN(fx) ? 0.5 : fx), (img.naturalHeight - sh) * (isNaN(fy) ? 0.5 : fy), sw, sh, x, y, w, h);
}

function spaced(g: CanvasRenderingContext2D, t: string, x: number, y: number, em: number) {
  const size = parseFloat(g.font.match(/(\d+(?:\.\d+)?)px/)?.[1] || '16');
  for (const ch of t) { g.fillText(ch, x, y); x += g.measureText(ch).width + size * em; }
}

/** Draws the cover at `w` px wide (height = 1.25w). Returns the canvas; the print is drawn once loaded. */
export async function drawCover(f: FileInfo, w: number): Promise<HTMLCanvasElement> {
  const h = Math.round(w * 1.25), k = w / 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  // folder body: aged iron with a cold gradient and speckle
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#2a3034'); grad.addColorStop(0.55, '#1b2023'); grad.addColorStop(1, '#121618');
  g.fillStyle = grad;
  g.beginPath(); g.roundRect(0, 26 * k, w, h - 26 * k, 6 * k); g.fill();
  // tab
  g.beginPath(); g.roundRect(22 * k, 0, 170 * k, 46 * k, 6 * k); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 900 * k; i++) g.fillRect(Math.random() * w, Math.random() * h, 1.2 * k, 1.2 * k);
  // edge wear
  g.strokeStyle = 'rgba(231,228,220,0.12)'; g.lineWidth = 2 * k;
  g.beginPath(); g.roundRect(1 * k, 27 * k, w - 2 * k, h - 28 * k, 6 * k); g.stroke();
  g.fillStyle = f.accent; g.fillRect(0, 26 * k, w, 3 * k);

  g.fillStyle = C.bone; g.font = `700 ${18 * k}px ${TYPE}`;
  spaced(g, `FILE ${String(f.no).padStart(2, '0')}`, 40 * k, 31 * k, 0.12);

  // print
  const px = 40 * k, py = 70 * k, pw = w - 80 * k, ph = 300 * k;
  g.fillStyle = '#d9d5ca'; g.fillRect(px - 8 * k, py - 8 * k, pw + 16 * k, ph + 34 * k);
  g.fillStyle = '#0a0c0d'; g.fillRect(px, py, pw, ph);
  const img = f.photo ? await loadImg(f.photo) : null;
  if (img) { g.save(); g.filter = 'saturate(0.85) contrast(1.06)'; cover(g, img, px, py, pw, ph, f.focus); g.restore(); }
  g.fillStyle = '#2b2a26'; g.font = `400 ${13 * k}px ${TYPE}`;
  spaced(g, `EXHIBIT ${String(f.no).padStart(2, '0')}-A`, px, py + ph + 19 * k, 0.1);
  // paper clip
  g.strokeStyle = '#9aa1a4'; g.lineWidth = 3 * k; g.beginPath(); g.roundRect(pw - 10 * k, py - 26 * k, 22 * k, 70 * k, 11 * k); g.stroke();

  // name, fitted to the width
  let size = 78 * k;
  g.font = `800 ${size}px ${TITLE}`;
  const nameW = g.measureText(f.name).width;
  if (nameW > w - 80 * k) { size *= (w - 80 * k) / nameW; g.font = `800 ${size}px ${TITLE}`; }
  g.fillStyle = C.bone; g.fillText(f.name, 40 * k, 452 * k + size * 0.35);

  g.font = `400 ${15 * k}px ${TYPE}`; g.fillStyle = f.accent;
  spaced(g, f.team.toUpperCase(), 40 * k, 510 * k, 0.14);
  g.fillStyle = C.ash;
  spaced(g, 'CLEARANCE: OMEGA', 40 * k, 536 * k, 0.14);
  // redacted lines
  g.fillStyle = C.redact;
  [[40, 556, 300], [40, 574, 380], [40, 592, 220]].forEach(([x, y, ww]) => g.fillRect(x * k, y * k, ww * k, 11 * k));
  // stamp
  g.save(); g.translate(w - 120 * k, 520 * k); g.rotate(-0.22);
  g.strokeStyle = f.accent; g.fillStyle = f.accent; g.globalAlpha = 0.85; g.lineWidth = 3 * k;
  g.beginPath(); g.roundRect(-74 * k, -26 * k, 148 * k, 52 * k, 6 * k); g.stroke();
  g.font = `700 ${18 * k}px ${TYPE}`; g.textAlign = 'center'; g.fillText('CLASSIFIED', 0, 7 * k);
  g.restore();
  return c;
}
