// Character photos for the pages that use the original photo interface (timeline, catch-up, credits). Since
// design system v3 they come from the graded set (src/data/photos2.json, iron and green, scripts/grade.mjs),
// so every photo on the site is graded the same way. The first is the hero portrait.
import data2 from './photos2.json';
import { u } from './site';

export interface Photo {
  n: number; w: number; h: number; focus: string; focusM: string;
  srcset: { w: number; src: string }[];
  ht: string; lqip: string; color: string;
}

type P2 = { n: number; w: number; h: number; focus: string; focusM: string; full: { w: number; src: string }[]; lqip: string; color: string };
const PHOTOS = Object.fromEntries(Object.entries(data2 as unknown as Record<string, P2[]>).map(([slug, list]) => [slug, list.map((p) => ({
  n: p.n, w: p.w, h: p.h, focus: p.focus, focusM: p.focusM, srcset: p.full, ht: p.full[0]?.src ?? '', lqip: p.lqip, color: p.color,
}))])) as Record<string, Photo[]>;

export function photosFor(slug: string | undefined | null): Photo[] {
  return (slug && PHOTOS[slug]) || [];
}

export const srcsetOf = (p: Photo) => p.srcset.map((s) => `${u('/' + s.src)} ${s.w}w`).join(', ');
/** Smallest file that still covers `min` pixels wide, else the largest. */
export const srcOf = (p: Photo, min = 0) => u('/' + (p.srcset.find((s) => s.w >= min) ?? p.srcset[p.srcset.length - 1]).src);
export const htOf = (p: Photo) => u('/' + p.ht);

/** Generic credit chosen by the site owner for the supplied photo set. */
export const PHOTO_CREDIT = 'Images belong to their respective owners.';
