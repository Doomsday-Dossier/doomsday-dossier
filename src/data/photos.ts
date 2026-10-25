// Character photos, built by scripts/photos-build.mjs from research/photos/user-set.json.
// Three per character; the first is the hero portrait.
import data from './photos.json';
import { u } from './site';

export interface Photo {
  n: number; w: number; h: number; focus: string; focusM: string;
  srcset: { w: number; src: string }[];
  ht: string; lqip: string; color: string;
}

const PHOTOS = data as Record<string, Photo[]>;

export function photosFor(slug: string | undefined | null): Photo[] {
  return (slug && PHOTOS[slug]) || [];
}

export const srcsetOf = (p: Photo) => p.srcset.map((s) => `${u('/' + s.src)} ${s.w}w`).join(', ');
/** Smallest file that still covers `min` pixels wide, else the largest. */
export const srcOf = (p: Photo, min = 0) => u('/' + (p.srcset.find((s) => s.w >= min) ?? p.srcset[p.srcset.length - 1]).src);
export const htOf = (p: Photo) => u('/' + p.ht);

/** Generic credit chosen by the site owner for the supplied photo set. */
export const PHOTO_CREDIT = 'Images belong to their respective owners.';
