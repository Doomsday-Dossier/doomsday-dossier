/**
 * "Dossier file" share cards, drawn on a canvas in the browser: void black, the character's
 * photo, their name in their own display face, mono labels, doom-green accent, the unofficial
 * marker, the generic image credit and the site address. Portrait 1080x1350 or wide 1200x630.
 */
export type CardSpec = {
  w: number; h: number;
  kicker: string;            // mono label above the name
  name: string;              // drawn uppercase in `font`
  font: string; weight: number;
  accent: string;
  tag: string;               // mono line under the name (team)
  photo: string | null; focus: string;
  lines: string[];           // short body lines under the tag
  file: string;              // "FILE 07 / 29"
  site: string;              // address printed at the foot
  fine: string;              // credit / fan-content line
};

const VOID = '#050607', BONE = '#e8e6e1', DIM = '#a9a7a1', IRON = '#2a3033', DOOM = '#3dff8a';
const css = (v: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Draw `img` covering the box, centred on the CSS object-position `focus` ("40% 30%"). */
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focus: string) {
  const [fx, fy] = (focus || '50% 50%').split(/\s+/).map((p) => parseFloat(p) / 100);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  const sx = (img.naturalWidth - sw) * (isNaN(fx) ? 0.5 : fx), sy = (img.naturalHeight - sh) * (isNaN(fy) ? 0.5 : fy);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, em: number, align: 'left' | 'right' = 'left') {
  // canvas letterSpacing is not everywhere yet, so space mono labels by hand
  const size = parseFloat(g.font.match(/(\d+(?:\.\d+)?)px/)?.[1] || '16');
  const gap = size * em;
  const width = [...text].reduce((a, ch) => a + g.measureText(ch).width + gap, -gap);
  let cx = align === 'right' ? x - width : x;
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + gap; }
  return width;
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = []; let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > max && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Biggest size (capped) at which the name fits `max` wide, on one line or split over two. */
function fitName(g: CanvasRenderingContext2D, spec: CardSpec, max: number, cap: number) {
  const at = (s: number, t: string) => { g.font = `${spec.weight} ${s}px ${spec.font}`; return g.measureText(t).width; };
  const fit = (t: string) => Math.min(cap, (max / at(100, t)) * 100);
  const name = spec.name.toUpperCase(), words = name.split(' ');
  let best = { size: fit(name), lines: [name] };
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const s = Math.min(fit(a), fit(b));
    if (s > best.size * 1.25) best = { size: s, lines: [a, b] };
  }
  return best;
}

export async function drawCard(spec: CardSpec): Promise<HTMLCanvasElement> {
  const mono = css('--font-mono', 'monospace'), sans = css('--font-sans', 'sans-serif');
  await Promise.all([
    document.fonts.load(`${spec.weight} 100px ${spec.font}`, spec.name),
    document.fonts.load(`400 20px ${mono}`), document.fonts.load(`400 20px ${sans}`),
  ]).catch(() => {});
  const img = spec.photo ? await loadImg(spec.photo).catch(() => null) : null;

  const c = document.createElement('canvas');
  c.width = spec.w; c.height = spec.h;
  const g = c.getContext('2d')!;
  g.fillStyle = VOID; g.fillRect(0, 0, spec.w, spec.h);
  g.textBaseline = 'alphabetic';

  const wide = spec.w > spec.h;
  const pad = wide ? 56 : 64;
  // photo: the top of a portrait card, the left of a wide one, fading into the void
  const px = 0, py = 0, pw = wide ? Math.round(spec.w * 0.46) : spec.w, ph = wide ? spec.h : Math.round(spec.h * 0.62);
  if (img) {
    cover(g, img, px, py, pw, ph, spec.focus);
    const fade = wide ? g.createLinearGradient(pw * 0.45, 0, pw, 0) : g.createLinearGradient(0, ph * 0.45, 0, ph);
    fade.addColorStop(0, 'rgba(5,6,7,0)'); fade.addColorStop(1, VOID);
    g.fillStyle = fade; g.fillRect(px, py, pw, ph);
  } else {
    const glow = g.createRadialGradient(pw / 2, ph / 2, 0, pw / 2, ph / 2, Math.max(pw, ph) * 0.6);
    glow.addColorStop(0, spec.accent + '55'); glow.addColorStop(1, VOID);
    g.fillStyle = glow; g.fillRect(px, py, pw, ph);
  }
  // shade behind the header so it reads over any photo
  const top = g.createLinearGradient(0, 0, 0, 170);
  top.addColorStop(0, 'rgba(5,6,7,0.85)'); top.addColorStop(1, 'rgba(5,6,7,0)');
  g.fillStyle = top; g.fillRect(0, 0, spec.w, 170);

  // header: site mark left, unofficial pill right
  const hs = wide ? 17 : 22;
  g.font = `400 ${hs}px ${mono}`; g.fillStyle = BONE;
  g.beginPath(); g.arc(pad + hs * 0.35, pad + 2 - hs * 0.35, hs * 0.32, 0, Math.PI * 2); g.fill();
  spaced(g, 'DOOMSDAY DOSSIER', pad + hs * 1.1, pad + 2, 0.22);
  g.font = `400 ${hs * 0.82}px ${mono}`;
  const pillText = 'UNOFFICIAL FAN SITE';
  const tw = [...pillText].reduce((a, ch) => a + g.measureText(ch).width + hs * 0.82 * 0.2, 0);
  const pr = spec.w - pad, pH = hs * 1.9, pW = tw + hs * 1.4, pY = pad + 2 - hs * 1.25;
  g.strokeStyle = BONE; g.lineWidth = 2; g.beginPath(); g.roundRect(pr - pW, pY, pW, pH, pH / 2); g.stroke();
  spaced(g, pillText, pr - pW + hs * 0.7, pY + pH / 2 + hs * 0.3, 0.2);

  // text column
  const tx = wide ? pw + 8 : pad, tMax = wide ? spec.w - tx - pad : spec.w - pad * 2;
  let y = wide ? 190 : ph - 10;
  g.font = `400 ${wide ? 15 : 22}px ${mono}`; g.fillStyle = DOOM;
  spaced(g, spec.kicker.toUpperCase(), tx, y, 0.2);
  g.fillStyle = DIM; spaced(g, spec.file, wide ? spec.w - pad : spec.w - pad, y, 0.2, 'right');

  const fit = fitName(g, spec, tMax, wide ? 104 : 168);
  g.font = `${spec.weight} ${fit.size}px ${spec.font}`; g.fillStyle = BONE;
  y += fit.size * 0.98 + (wide ? 14 : 22);
  for (const line of fit.lines) { g.fillText(line, tx, y); y += fit.size * 0.92; }
  y -= fit.size * 0.92;

  // accent rule and tag
  y += wide ? 40 : 58;
  g.fillStyle = spec.accent; g.fillRect(tx, y - (wide ? 12 : 16), wide ? 40 : 56, 4);
  g.font = `400 ${wide ? 15 : 21}px ${mono}`;
  spaced(g, spec.tag.toUpperCase(), tx + (wide ? 54 : 74), y - (wide ? 6 : 8), 0.18);

  // body lines
  g.font = `400 ${wide ? 20 : 29}px ${sans}`; g.fillStyle = BONE;
  y += wide ? 24 : 36;
  for (const l of spec.lines) for (const part of wrap(g, l, tMax)) { y += wide ? 28 : 40; g.fillText(part, tx, y); }

  // foot: rule, credit, address
  const fy = spec.h - pad;
  g.fillStyle = IRON; g.fillRect(tx, fy - (wide ? 56 : 74), spec.w - tx - pad, 1);
  g.font = `400 ${wide ? 12 : 16}px ${mono}`; g.fillStyle = DIM;
  spaced(g, spec.fine.toUpperCase(), tx, fy - (wide ? 30 : 40), 0.12);
  g.fillStyle = DOOM; g.font = `400 ${wide ? 14 : 19}px ${mono}`;
  spaced(g, spec.site, tx, fy, 0.1);
  return c;
}

export function saveCanvas(c: HTMLCanvasElement, file: string) {
  return new Promise<Blob | null>((res) => c.toBlob((b) => {
    if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    res(b);
  }, 'image/png'));
}
