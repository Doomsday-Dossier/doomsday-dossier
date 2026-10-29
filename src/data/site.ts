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
  font: string; fontWeight: number; fontCase: 'uppercase' | 'uppercase'; tracking: string;
  ease: string;           // GSAP ease for this page's reveals
  pace: number;           // multiplier on reveal durations
  kicker: string;         // short line under the name, our own words
  heroScale?: number;     // shrink wide display faces so names never break mid-word
  faLabel?: string;       // overrides 'First appearance' when the debut belongs to a different comics character
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
  { id: 'more', name: 'More confirmed', short: 'More', wave: 5, blurb: 'Further names Marvel has confirmed, including Peggy Carter at D23 2026.' },
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
    font: "'Grenze Gotisch Variable', serif", fontWeight: 800, fontCase: 'uppercase', tracking: '0em',
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
    font: "'Fraunces Variable', serif", fontWeight: 700, fontCase: 'uppercase', tracking: '-0.03em',
    ease: 'back.out(1.6)', pace: 0.9, kicker: 'An ex-con electrical engineer who stole a shrinking suit and found out how small, and how big, he could get.',
  },
  'shang-chi': {
    heroScale: 0.95,
    slug: 'shang-chi', wave: 1, scene: 'ink', sceneName: 'Ink and Rings',
    sceneNote: 'Ink blooms in still water. Your cursor stirs it while ten rings of light keep their orbit.',
    bg: '#040605', ink: '#ece9df', dim: '#9d9a8e', accent: '#e7c46a', accent2: '#4fd1a5',
    font: "'Bodoni Moda Variable', serif", fontWeight: 700, fontCase: 'uppercase', tracking: '-0.02em',
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
  'reed-richards': {
    heroScale: 0.82,
    slug: 'reed-richards', wave: 2, scene: 'elastic', sceneName: 'Elastic Lattice',
    sceneNote: 'A blueprint grid behaves like stretched fabric. Drag the cursor through it and the lattice pulls, bulges and snaps back, and the name stretches with you.',
    bg: '#04070f', ink: '#e8eef8', dim: '#93a3bd', accent: '#4fa8ff', accent2: '#dbeaff',
    font: "'Anybody Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '-0.01em',
    ease: 'elastic.out(1, 0.55)', pace: 1.0, kicker: 'A scientist who can stretch his body into any shape and who believes every problem gives way to enough thought.',
  },
  'sue-storm': {
    heroScale: 0.9,
    slug: 'sue-storm', wave: 2, scene: 'ripple', sceneName: 'Force Field',
    sceneNote: 'A live wave simulation ripples under the page. Your cursor drops ripples that bend the light, and anything close to it turns invisible, letters included.',
    bg: '#05060c', ink: '#eef0ff', dim: '#9ea4c4', accent: '#a9b8ff', accent2: '#7df0ff',
    font: "'Italiana', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.04em',
    ease: 'sine.out', pace: 1.35, kicker: 'The member who can vanish from sight and raise force fields strong enough to hold back almost anything.',
  },
  'johnny-storm': {
    heroScale: 0.8,
    slug: 'johnny-storm', wave: 2, scene: 'flame', sceneName: 'Flame On',
    sceneNote: 'A fire of thousands of particles rises from below, and the path your cursor takes catches alight. The name flickers like a flame.',
    bg: '#070403', ink: '#fff3e6', dim: '#b9a593', accent: '#ff6a1f', accent2: '#ffd27a',
    font: "'Bricolage Grotesque Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '-0.03em',
    ease: 'expo.out', pace: 0.8, kicker: 'The youngest of the four, who bursts into flame, takes to the sky and never passes up a chance to show off.',
  },
  'ben-grimm': {
    heroScale: 0.86,
    slug: 'ben-grimm', wave: 2, scene: 'rock', sceneName: 'Clobber',
    sceneNote: 'A wall of real 3D rock leans away from your cursor. Click or tap to throw a punch through it, and scroll to watch it crumble.',
    bg: '#080605', ink: '#f2e9e0', dim: '#b0a090', accent: '#ff8a3a', accent2: '#c9b39a',
    font: "'Alfa Slab One', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'power4.out', pace: 1.2, kicker: 'A test pilot turned to living rock, with a soft heart under the stone and a battle cry everyone knows.',
  },
  'professor-x': {
    heroScale: 0.9,
    slug: 'professor-x', wave: 3, scene: 'cerebro', sceneName: 'Cerebro',
    sceneNote: 'A turning sphere of minds. Wherever your cursor rests, nearby minds light up and link into a network while a scan sweeps the sphere.',
    bg: '#03060f', ink: '#e9f0ff', dim: '#94a4c4', accent: '#8cbcff', accent2: '#ffffff',
    font: "'Gloock', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'power2.out', pace: 1.4, kicker: 'A telepath who founded a school for mutants on the belief that humans and mutants can share one world.',
  },
  'magneto': {
    heroScale: 0.72,
    slug: 'magneto', wave: 3, scene: 'magnet', sceneName: 'Lines of Force',
    sceneNote: 'Hundreds of iron needles follow a live magnetic field. Your cursor is one pole, the letters are pulled toward it, and scrolling flips the polarity.',
    bg: '#07040a', ink: '#f3e9f0', dim: '#a796a6', accent: '#ff3d8b', accent2: '#b3a6c2',
    font: "'Unbounded Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '-0.02em',
    ease: 'power4.inOut', pace: 1.2, kicker: 'A survivor who commands magnetism and metal, sworn that mutants will never again be hunted.',
  },
  'cyclops': {
    heroScale: 1.15,
    slug: 'cyclops', wave: 3, scene: 'optic', sceneName: 'Optic Blast',
    sceneNote: 'A training tunnel seen through a ruby filter. Click or tap to fire a beam at your cursor; it also fires on its own every few seconds.',
    bg: '#080203', ink: '#ffe9ea', dim: '#b39598', accent: '#ff2e43', accent2: '#ffb3bb',
    font: "'Teko Variable', sans-serif", fontWeight: 600, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'expo.out', pace: 0.75, kicker: 'Xavier’s first student and field leader, whose eyes release a force only ruby quartz can hold back.',
  },
  'nightcrawler': {
    heroScale: 0.6,
    slug: 'nightcrawler', wave: 3, scene: 'bamf', sceneName: 'Bamf',
    sceneNote: 'Something teleports around the frame after your cursor, leaving puffs of indigo smoke where it leaves and where it lands. Letters vanish and reappear too.',
    bg: '#04030b', ink: '#ece8ff', dim: '#9f98c0', accent: '#8c6bff', accent2: '#e7c75a',
    font: "'Rye', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'back.out(2)', pace: 0.8, kicker: 'A former circus acrobat with a gentle faith, who vanishes in a puff of smoke and appears somewhere else.',
  },
  'mystique': {
    heroScale: 0.95,
    slug: 'mystique', wave: 3, scene: 'reaction', sceneName: 'Shapeshift',
    sceneNote: 'A living reaction-diffusion pattern that never holds one form, from spots to stripes to maze. Your cursor seeds new growth, and the name keeps changing typeface.',
    bg: '#02040c', ink: '#e8eeff', dim: '#93a0c4', accent: '#3d7bff', accent2: '#ffc14d',
    font: "'DM Serif Display', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '-0.01em',
    ease: 'sine.inOut', pace: 1.1, kicker: 'A shapeshifter who can become anyone, loyal above all to her own idea of mutant survival.',
  },
  'beast': {
    heroScale: 1.1,
    slug: 'beast', wave: 3, scene: 'fur', sceneName: 'Blue Fur',
    sceneNote: 'Real-time 3D fur made of stacked shells. Your cursor brushes through it and the strands bend away.',
    bg: '#03050c', ink: '#e9eeff', dim: '#95a0c2', accent: '#5c8cff', accent2: '#c2d3ff',
    font: "'EB Garamond Variable', serif", fontWeight: 600, fontCase: 'uppercase', tracking: '-0.01em',
    ease: 'power3.out', pace: 1.2, kicker: 'A brilliant scientist whose body caught up with his mutation, leaving a genius covered in blue fur.',
  },
  'gambit': {
    heroScale: 0.95,
    slug: 'gambit', wave: 3, scene: 'cards', sceneName: 'Charged Deck',
    sceneNote: 'A slow swirl of 3D playing cards. Cards that linger near your cursor charge up pink and detonate; click or tap to charge one at once.',
    bg: '#070205', ink: '#f6e8ef', dim: '#b096a3', accent: '#ff46b4', accent2: '#e8d9b0',
    font: "'Abril Fatface', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'back.out(1.4)', pace: 0.9, kicker: 'A charming thief from New Orleans who charges what he touches with explosive energy, playing cards most of all.',
  },
  'yelena-belova': {
    heroScale: 1.15,
    slug: 'yelena-belova', wave: 4, scene: 'shafts', sceneName: 'Red Room',
    sceneNote: 'Light pours through slatted blinds from wherever your cursor is, throwing red shafts through the dust. The letters nearest the light are lit.',
    bg: '#070203', ink: '#f5e9ea', dim: '#b29a9c', accent: '#ff4d5e', accent2: '#ffd0d4',
    font: "'Bebas Neue', sans-serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.02em',
    ease: 'power3.out', pace: 1, kicker: 'A Widow trained in the Red Room alongside Natasha, who now chooses her own missions and her own family.',
  },
  'red-guardian': {
    heroScale: 0.85,
    slug: 'red-guardian', wave: 4, scene: 'bokeh', sceneName: 'Rack Focus',
    sceneNote: 'Snow falls through a shallow depth of field. Move up and down to pull focus through the storm, and left and right to change the wind. The name racks focus too.',
    bg: '#04060a', ink: '#eef2f8', dim: '#9aa6b6', accent: '#ff3b3b', accent2: '#ffb070',
    font: "'Russo One', sans-serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'power2.out', pace: 1.3, kicker: 'The Soviet answer to Captain America, still certain of his own legend long after the world moved on.',
  },
  'john-walker': {
    heroScale: 0.82,
    slug: 'john-walker', wave: 4, scene: 'tags', sceneName: 'Dog Tags',
    sceneNote: 'Two polished steel tags on a ball chain, lit like a product shot, swing toward your cursor and catch the light as they turn.',
    bg: '#050604', ink: '#eef0e6', dim: '#a3a796', accent: '#c8a64a', accent2: '#e8e8e8',
    font: "'Graduate', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'back.out(1.2)', pace: 1, kicker: 'A decorated soldier who was handed the shield and then stripped of it, and who now goes by U.S. Agent.',
  },
  'ghost': {
    heroScale: 0.8,
    faLabel: 'First comics Ghost',
    slug: 'ghost', wave: 4, scene: 'phase', sceneName: 'Phase Echo',
    sceneNote: 'Every frame feeds back into the next, so anything that moves leaves fading echoes and the picture keeps slipping out of phase. Letters slip too.',
    bg: '#040506', ink: '#e9eef2', dim: '#95a0a8', accent: '#9fe7ff', accent2: '#ffffff',
    font: "'Major Mono Display', monospace", fontWeight: 400, fontCase: 'uppercase', tracking: '0em',
    ease: 'steps(8)', pace: 0.9, kicker: 'A woman caught between dimensions by a lab accident, who learned to turn her instability into a weapon.',
  },
  'bob-reynolds': {
    heroScale: 0.85,
    slug: 'bob-reynolds', wave: 4, scene: 'sunvoid', sceneName: 'Sun and Void',
    sceneNote: 'A golden core holds back blobs of absolute darkness that merge like ink. Your cursor is light that pushes the dark away; scroll and the void wins, eating the name as it goes.',
    bg: '#050403', ink: '#fff6e6', dim: '#b8ab93', accent: '#ffc861', accent2: '#8f6bff',
    font: "'Cinzel Variable', serif", fontWeight: 700, fontCase: 'uppercase', tracking: '0.02em',
    ease: 'power2.inOut', pace: 1.4, kicker: 'A man with the power of a million exploding suns, and a darkness inside him to match.',
  },
  'shuri': {
    heroScale: 1,
    slug: 'shuri', wave: 5, scene: 'pins', sceneName: 'Sand Table',
    sceneNote: "A 3D table of thousands of pins sculpts itself into shapes, and your cursor raises the pins beneath it. The letters rise as you pass.",
    bg: '#06040c', ink: '#f2ecff', dim: '#a59bc0', accent: '#9b5cff', accent2: '#e9c46a',
    font: "'Sora Variable', sans-serif", fontWeight: 800, fontCase: 'uppercase', tracking: '-0.02em',
    ease: 'expo.out', pace: 0.85, kicker: "Wakanda’s princess, scientist and inventor, who took up the mantle of the Black Panther.",
  },
  'mbaku': {
    heroScale: 0.85,
    slug: 'mbaku', wave: 5, scene: 'ridges', sceneName: 'Jabari Ridge',
    sceneNote: "Mountain ridgelines stack into the distance and pulse on a drumbeat that rolls from front to back. Your cursor sets where the peaks rise; press to hit the drum.",
    bg: '#070605', ink: '#f1ece4', dim: '#ab9f90', accent: '#e2e8f0', accent2: '#c58a5c',
    font: "'Bowlby One', sans-serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.01em',
    ease: 'power4.out', pace: 1.3, kicker: "Leader of the Jabari mountain tribe, once a rival for Wakanda’s throne and now one of its fiercest defenders.",
  },
  'namor': {
    heroScale: 1,
    slug: 'namor', wave: 5, scene: 'talokan', sceneName: 'Talokan',
    sceneNote: "Caustic light dances in deep water and shafts fall from the surface. Bubbles rise from your cursor, and scrolling sinks you deeper.",
    bg: '#01060a', ink: '#e6f6f6', dim: '#8fb0b3', accent: '#2fd6c1', accent2: '#e9c46a',
    font: "'Yeseva One', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.02em',
    ease: 'sine.inOut', pace: 1.4, kicker: "Ruler of a kingdom beneath the sea, one of Marvel’s very first characters, who answers to no surface nation.",
  },
  'loki': {
    heroScale: 1,
    slug: 'loki', wave: 5, scene: 'timelines', sceneName: 'Branching Timelines',
    sceneNote: "Timelines grow upward and keep forking, far more often near your cursor. Scrolling prunes the youngest branches first.",
    bg: '#030604', ink: '#eef5e8', dim: '#9fb09a', accent: '#5fd36f', accent2: '#e8c35a',
    font: "'Playfair Display Variable', serif", fontWeight: 700, fontCase: 'uppercase', tracking: '-0.01em',
    ease: 'power3.inOut', pace: 1.1, kicker: "Once the god of mischief, now the God of Stories in the comics, and on screen the one holding time itself together.",
  },
  'peggy-carter': {
    heroScale: 0.82,
    slug: 'peggy-carter', wave: 5, scene: 'dance', sceneName: 'The Dance',
    sceneNote: "A mirror ball scatters light across a warm 1940s room. Your cursor turns the ball, and a spotlight sweeps across her name.",
    bg: '#0a0605', ink: '#f6ece2', dim: '#b6a597', accent: '#e0b25a', accent2: '#c8463d',
    font: "'Limelight', serif", fontWeight: 400, fontCase: 'uppercase', tracking: '0.02em',
    ease: 'power2.out', pace: 1.3, kicker: "A wartime agent and co-founder of S.H.I.E.L.D., who never needed a serum to be the strongest person in the room.",
  },
};

const researchFiles = import.meta.glob('../../research/*.json', { eager: true, import: 'default' }) as Record<string, any>;
// Local-only placeholders for testing scenes before research lands. Git-ignored; never deployed.
const previewFiles = import.meta.glob('../../research-preview/*.json', { eager: true, import: 'default' }) as Record<string, any>;
export function getResearch(slug: string): Research | null {
  const hit = Object.entries(researchFiles).find(([p]) => p.endsWith(`/${slug}.json`))
    || Object.entries(previewFiles).find(([p]) => p.endsWith(`/${slug}.json`));
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
  'reed-richards': 'Reed Richards',
  'sue-storm': 'Sue Storm',
  'johnny-storm': 'Johnny Storm',
  'ben-grimm': 'Ben Grimm',
  'professor-x': 'Professor X',
  'magneto': 'Magneto',
  'cyclops': 'Cyclops',
  'nightcrawler': 'Nightcrawler',
  'mystique': 'Mystique',
  'beast': 'Beast',
  'gambit': 'Gambit',
  'yelena-belova': 'Yelena Belova',
  'red-guardian': 'Red Guardian',
  'john-walker': 'John Walker',
  'ghost': 'Ghost',
  'bob-reynolds': 'Bob Reynolds',
  'shuri': 'Shuri',
  'mbaku': "M'Baku",
  'namor': 'Namor',
  'loki': 'Loki',
  'peggy-carter': 'Peggy Carter',
};
export const heroName = (slug: string) => HERO_NAMES[slug] || slug;
