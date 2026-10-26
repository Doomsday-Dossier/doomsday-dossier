/**
 * Point clouds for the archive's roll call: a character's bust sampled into n points, with depth from the
 * depth map (near = forward) and colour from the photo. Runs in a worker where the browser allows it
 * (OffscreenCanvas), so building a cloud never stalls scrolling; the same code runs on the page otherwise.
 */
export type Cloud = { cut: string; depth: string; crop: [number, number, number, number]; focus: [number, number]; aspect: number };
export type Points = { pos: Float32Array; col: Float32Array };

export const BUST = 2.4; // every figure stands this many units tall, so faces and full figures read at one size

/** A seeded random stream, so every visit draws the same clouds. */
export const stream = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

type Ctx2D = { clearRect(x: number, y: number, w: number, h: number): void; drawImage(...a: any[]): void; getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } };
type Img = { width: number; height: number };

/**
 * Points sit where the cut-out is solid and are sorted top to bottom, so in a morph each one travels to
 * the matching part of the next figure (hair to hair, shoulders to shoulders).
 */
export function sampleFrom(c: Cloud, n: number, cut: Img, dep: Img, canvas: (w: number, h: number) => Ctx2D): Points {
  const [x0, y0, x1, y1] = c.crop;
  const W = 220, H = Math.max(40, Math.round(W * ((y1 - y0) / ((x1 - x0) * c.aspect))));
  const g = canvas(W, H);
  const grab = (im: Img) => {
    g.clearRect(0, 0, W, H);
    g.drawImage(im, x0 * im.width, y0 * im.height, (x1 - x0) * im.width, (y1 - y0) * im.height, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  };
  const px = grab(cut), dp = grab(dep);
  const cand: number[] = [];
  for (let k = 0; k < W * H; k++) if (px[k * 4 + 3] > 140) cand.push(k);
  if (!cand.length) for (let k = 0; k < W * H; k++) cand.push(k);
  const rnd = stream(7);
  const pick = new Uint32Array(n);
  for (let i = 0; i < n; i++) pick[i] = cand[Math.floor(rnd() * cand.length)];
  pick.sort();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), s = BUST / H, fx = c.focus[0] * W;
  for (let i = 0; i < n; i++) {
    const k = pick[i], x = k % W, y = (k / W) | 0;
    pos[i * 3] = (x + rnd() - fx) * s;
    pos[i * 3 + 1] = (H / 2 - y - rnd()) * s;
    pos[i * 3 + 2] = (dp[k * 4] / 255 - 0.45) * 0.9 + (rnd() - 0.5) * 0.02;
    for (let j = 0; j < 3; j++) col[i * 3 + j] = Math.min(1, Math.pow(px[k * 4 + j] / 255, 0.85) * 1.08);
  }
  return { pos, col };
}

const bitmap = (src: string) => fetch(src).then((r) => r.blob()).then((b) => createImageBitmap(b));
export const offscreen = (w: number, h: number) => new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true }) as unknown as Ctx2D;

/** Samples in this thread (a worker, or the page as a fallback). */
export async function sample(c: Cloud, n: number): Promise<Points> {
  const [cut, dep] = await Promise.all([bitmap(c.cut), bitmap(c.depth)]);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? offscreen : (w: number, h: number) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    return cv.getContext('2d', { willReadFrequently: true }) as unknown as Ctx2D;
  };
  const pts = sampleFrom(c, n, cut, dep, canvas);
  cut.close(); dep.close();
  return pts;
}
