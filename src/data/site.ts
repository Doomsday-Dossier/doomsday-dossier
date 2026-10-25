import official from '../../research/official.json';

export type Source = { label: string; url: string };
export type Era = { era: string; years: string; title: string; summary: string; keyIssues: string[]; sources: Source[] };
export type Screen = { title: string; year: number; continuity: string; actor: string; cameo: boolean; summary: string; sources: Source[] };
export type Research = {
  slug: string; name: string; alias: string;
  origin: { firstAppearance: { title: string; issue: string; coverDate: string }; creators: string[]; summary: string[]; sources: Source[] };
  comics: Era[]; screen: Screen[]; trivia: { fact: string; sources: Source[] }[]; unverified?: string[];
};

export type Design = {
  slug: string;
  wave: number;
  scene: string;          // hero scene id in src/scripts/gl/scenes
  sceneName: string;      // human name of the motion idea
  sceneNote: string;      // one line describing the motion idea
  bg: string; ink: string; dim: string; accent: string; accent2: string;
  font: string; fontWeight: number; fontCase: 'none' | 'uppercase'; tracking: string;
  ease: string;           // GSAP ease for this page's reveals
  pace: number;           // multiplier on reveal durations
  kicker: string;         // short line under the name, our own words
  heroScale?: number;     // shrink wide display faces so names never break mid-word
};

export const RELEASE = official.film.releaseDate; // 2026-12-18
export const OFFICIAL = official;
export const SRC = official.sources as Record<string, Source>;

export const TEAMS = [
  { id: 'adversary', name: 'The Adversary', short: 'Adversary', wave: 1, blurb: 'The villain at the centre of the film, named by Marvel at Comic-Con 2024.' },
  { id: 'avengers', name: 'Avengers', short: 'Avengers', wave: 1, blurb: 'Returning heroes from across the MCU, including the man who first carried the shield and the one who carries it now.' },
  { id: 'fantastic-four', name: 'Fantastic Four', short: 'Fantastic Four', wave: 2, blurb: 'Marvel’s first family, fresh from The Fantastic Four: First Steps (2025).' },
  { id: 'x-men', name: 'X-Men', short: 'X-Men', wave: 3, blurb: 'Mutants whose film history began at 20th Century Fox, teased by Marvel in January 2026.' },
  { id: 'thunderbolts', name: 'Thunderbolts*', short: 'Thunderbolts*', wave: 4, blurb: 'The unlikely team assembled in Thunderbolts* (2025).' },
  { id: 'wakanda-talokan', name: 'Wakanda and Talokan', short: 'Wakanda + Talokan', wave: 5, blurb: 'Two hidden nations, both featured in Marvel’s fourth teaser.' },
  { id: 'more', name: 'More confirmed', short: 'More', wave: 6, blurb: 'Further names Marvel has confirmed, including Peggy Carter at D23 2026.' },
] as const;

export const DESIGN: Record<string, Design> = {
  'victor-von-doom': {
    heroScale: 0.9,
    slug: 'victor-von-doom', wave: 1, scene: 'forge', sceneName: 'The Forge',
    sceneNote: 'Molten iron churns under the surface. Your cursor is heat, and the metal cools to dark iron behind it.',
    bg: '#040605', ink: '#e6e3da', dim: '#9a978e', accent: '#3dff8a', accent2: '#b8ffd6',
    font: "'Cormorant Garamond Variable', serif", fontWeight: 600, fontCase: 'uppercase', tracking: '0.04em',
    ease: 'power4.out', pace: 1.5, kicker: 'Monarch of Latveria. Scientist. Sorcerer. The man who believes only he can save the world.',
  },
  'steve-rogers': {
    heroScale: 1,
    slug: 'steve-rogers', wave: 1, scene: 'ice', sceneName: 'The Ice',
    sceneNote: 'A sheet of frost covers the page. Your cursor thaws it, and scrolling shatters the ice.',
    bg: '#060a10', ink: '#eef2f5', dim: '#9fb0bf', accent: '#9fd8ff', accent2: '#f1e2c6',
    font: "'Big Shoulders Stencil Display Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'power3.out', pace: 1.1, kicker: 'A kid from Brooklyn who was given a super-soldier serum, lost decades in the ice and kept his convictions.',
  },
  'thor': {
    heroScale: 1.05,
    slug: 'thor', wave: 1, scene: 'storm', sceneName: 'The Storm',
    sceneNote: 'Clouds roll behind the page and lightning hunts for your cursor.',
    bg: '#05070c', ink: '#e9eef9', dim: '#9aa6bf', accent: '#8fd3ff', accent2: '#ffffff',
    font: "'Grenze Gotisch Variable', serif", fontWeight: 800, fontCase: 'none', tracking: '0em',
    ease: 'expo.out', pace: 1.0, kicker: 'Prince of Asgard and god of thunder, who had to prove himself worthy of his own power.',
  },
  'sam-wilson': {
    heroScale: 0.74,
    slug: 'sam-wilson', wave: 1, scene: 'slipstream', sceneName: 'Slipstream',
    sceneNote: 'Air streams past at speed. Move the cursor and the airflow bends around it.',
    bg: '#04080d', ink: '#f2f5f8', dim: '#9eb0c2', accent: '#ff5a4e', accent2: '#cfe7ff',
    font: "'Syne Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '-0.02em',
    ease: 'expo.out', pace: 0.85, kicker: 'A pararescue veteran and counsellor who flew as the Falcon, then took up the shield.',
  },
  'bucky-barnes': {
    heroScale: 0.9,
    slug: 'bucky-barnes', wave: 1, scene: 'cryo', sceneName: 'Cold Storage',
    sceneNote: 'Frost creeps across a failing monitor. The signal glitches where your cursor passes.',
    bg: '#050607', ink: '#e3e6e8', dim: '#8e979c', accent: '#c7d3da', accent2: '#ff3b3b',
    font: "'Tektur Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '0.02em',
    ease: 'steps(12)', pace: 1.0, kicker: 'Steve Rogers’ oldest friend, presumed dead in the war, then turned into a weapon. Now his own man.',
  },
  'scott-lang': {
    heroScale: 0.92,
    slug: 'scott-lang', wave: 1, scene: 'quantum', sceneName: 'Quantum Scale',
    sceneNote: 'An endless zoom through nested worlds. Your cursor is a lens that shrinks and grows what it touches.',
    bg: '#07040d', ink: '#f1ebfb', dim: '#a99bc0', accent: '#ff4fd8', accent2: '#7c6bff',
    font: "'Fraunces Variable', serif", fontWeight: 700, fontCase: 'none', tracking: '-0.03em',
    ease: 'back.out(1.6)', pace: 0.9, kicker: 'An ex-con electrical engineer who stole a shrinking suit and found out how small, and how big, he could get.',
  },
  'shang-chi': {
    heroScale: 0.95,
    slug: 'shang-chi', wave: 1, scene: 'ink', sceneName: 'Ink and Rings',
    sceneNote: 'Ink blooms in still water. Your cursor stirs it while ten rings of light keep their orbit.',
    bg: '#040605', ink: '#ece9df', dim: '#9d9a8e', accent: '#e7c46a', accent2: '#4fd1a5',
    font: "'Bodoni Moda Variable', serif", fontWeight: 700, fontCase: 'none', tracking: '-0.02em',
    ease: 'power2.inOut', pace: 1.25, kicker: 'A martial artist raised to be his father’s weapon, who walked away to choose his own path.',
  },
  'joaquin-torres': {
    heroScale: 0.82,
    slug: 'joaquin-torres', wave: 1, scene: 'radar', sceneName: 'Drone Sweep',
    sceneNote: 'A radar sweep maps the ground below, and your cursor becomes the targeting reticle.',
    bg: '#06070a', ink: '#f4efe8', dim: '#a8a196', accent: '#ff8a3d', accent2: '#3de0d0',
    font: "'Chakra Petch', sans-serif", fontWeight: 700, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'power3.out', pace: 0.9, kicker: 'An Air Force lieutenant who flew support for the Falcon, then earned the wings himself.',
  },
};

const researchFiles = import.meta.glob('../../research/*.json', { eager: true, import: 'default' }) as Record<string, any>;
export function getResearch(slug: string): Research | null {
  const hit = Object.entries(researchFiles).find(([p]) => p.endsWith(`/${slug}.json`));
  return hit ? (hit[1] as Research) : null;
}

export type CastEntry = (typeof official.cast)[number] & { lastRole?: string; roleSource?: string; note?: string };
export const CAST = official.cast as CastEntry[];

export function castFor(slug: string) { return CAST.find((c) => c.slug === slug); }

/** A character page is published when it has design + research. */
export function isPublished(slug: string | null) {
  return !!slug && !!DESIGN[slug] && !!getResearch(slug);
}

export function displayName(c: CastEntry) {
  if (c.character) return c.character;
  if (c.lastRole) return c.lastRole.split(' / ')[0];
  return 'Role not yet named';
}

export function u(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Ordered list of published characters, for next/prev links. */
export function publishedOrder() {
  const order: string[] = [];
  for (const t of TEAMS) for (const c of CAST) if (c.team === t.id && isPublished(c.slug)) order.push(c.slug!);
  return order;
}

/** Collect unique sources in order and return index lookups, for numbered citations. */
export class Citer {
  list: Source[] = [];
  cite(sources: Source[] | undefined) {
    return (sources || []).map((s) => {
      let i = this.list.findIndex((x) => x.url === s.url);
      if (i === -1) { this.list.push(s); i = this.list.length - 1; }
      return i + 1;
    });
  }
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return d ? `${d} ${months[m - 1]} ${y}` : `${months[m - 1]} ${y}`;
}

/** Short display names for hero titles and links. */
export const HERO_NAMES: Record<string, string> = {
  'victor-von-doom': 'Victor von Doom',
  'steve-rogers': 'Steve Rogers',
  'thor': 'Thor',
  'sam-wilson': 'Sam Wilson',
  'bucky-barnes': 'Bucky Barnes',
  'scott-lang': 'Scott Lang',
  'shang-chi': 'Shang-Chi',
  'joaquin-torres': 'Joaquín Torres',
};
export const heroName = (slug: string) => HERO_NAMES[slug] || slug;
