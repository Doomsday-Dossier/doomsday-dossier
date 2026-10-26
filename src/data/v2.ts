// Design system v2 data: approved accents (research/accents.json), HD photos and cut-outs
// (src/data/photos2.json, built by scripts/photos2-build.mjs) and the particle-figure framing derived
// from each subject's measured cut-out.
import accents from '../../research/accents.json';
import photos2 from './photos2.json';
import { u } from './site';

export type P2 = {
  n: number; w: number; h: number; hd: boolean; focus: string; focusM: string;
  full: { w: number; src: string }[]; cut: { w: number; src: string }[];
  bbox: [number, number, number, number] | null; head: [number, number] | null;
  figure: { crop: [number, number, number, number]; focus: [number, number] } | null;
  lqip: string; color: string;
};

const P = photos2 as unknown as Record<string, P2[]>;
const A = Object.fromEntries((accents as { characters: { slug: string; hex: string }[] }).characters.map((c) => [c.slug, c.hex]));

export const accentOf = (slug: string) => A[slug] ?? '#1fd47a';
export const photos2For = (slug: string) => P[slug] ?? [];
export const srcset2 = (list: { w: number; src: string }[]) => list.map((s) => `${u('/' + s.src)} ${s.w}w`).join(', ');
export const pick2 = (list: { w: number; src: string }[], min: number) => u('/' + (list.find((s) => s.w >= min) ?? list[list.length - 1]).src);

/** Figure settings for a character's lead photo: sampled from its cut-out, framed on the subject. */
export function figureFor(slug: string) {
  const p = photos2For(slug)[0];
  if (!p) return null;
  const f = p.figure ?? { crop: [0.2, 0, 0.8, 1] as [number, number, number, number], focus: [0.5, 0.45] as [number, number] };
  return { src: p.cut.length ? pick2(p.cut, 640) : pick2(p.full, 640), alphaCut: p.cut.length > 0, photoAspect: p.w / p.h, crop: f.crop, focus: f.focus, height: 3.5, depth: 0.45, cut: p.cut.length ? 0.02 : 0.1 };
}

/** Four callout anchors on the subject (photo coordinates): head, chest, and both sides. */
export function anchorsFor(slug: string): [number, number][] {
  const p = photos2For(slug)[0];
  if (!p?.bbox || !p.head) return [[0.5, 0.35], [0.5, 0.55], [0.35, 0.7], [0.65, 0.7]];
  const [x0, y0, x1, y1] = p.bbox, w = x1 - x0, h = y1 - y0;
  return [p.head, [(x0 + x1) / 2, y0 + h * 0.46], [x0 + w * 0.22, y0 + h * 0.72], [x1 - w * 0.22, y0 + h * 0.66]];
}
