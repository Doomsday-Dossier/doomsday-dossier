/**
 * DOOM-OS data (CLAUDE.md, "Design system v4"): the modules, and every target as the system sees it, built once
 * from the research files, the briefings, the power grids and the photo set.
 */
import { publishedOrder, heroName, getResearch, castFor, TEAMS, u } from './site';
import { photos2For, pick2 } from './v2';

const BRIEFS = Object.values(import.meta.glob('../../research/briefs.json', { eager: true, import: 'default' }))[0] as Record<string, any>;
const VS = import.meta.glob('../../research/versus/*.json', { eager: true, import: 'default' }) as Record<string, any>;

export const MODULES = [
  { id: 'targets', no: '01', name: 'Target register', short: 'Targets', href: '/targets/', line: 'All 29 targets on file' },
  { id: 'timeline', no: '02', name: 'Temporal archive', short: 'Archive', href: '/timeline/', line: 'Every appearance, in order' },
  { id: 'versus', no: '03', name: 'Combat simulation', short: 'Combat', href: '/versus/', line: 'Two targets, side by side' },
  { id: 'quiz', no: '04', name: 'Subject profiler', short: 'Profiler', href: '/quiz/', line: 'Which of them are you' },
  { id: 'predictions', no: '05', name: 'Probability engine', short: 'Predict', href: '/predictions/', line: 'Fan predictions, sealed at release' },
  { id: 'catchup', no: '06', name: 'Briefing schedule', short: 'Briefing', href: '/catch-up/', line: 'What to watch before release' },
  { id: 'chamber', no: '07', name: 'Royal chamber', short: 'Chamber', href: '/chamber/', line: 'Your verdicts, conquests, decrees' },
];

// the photo each target is scanned from: the clearest, most complete figure. Reed's photo 2 is not used: the head
// finder takes the top of the subject, which there is the rocket's tip, so every face crop of him came out empty.
export const PICK: Record<string, number> = { 'victor-von-doom': 2, 'steve-rogers': 1, thor: 1, 'sam-wilson': 2, 'bucky-barnes': 1, 'scott-lang': 2, 'shang-chi': 2, 'joaquin-torres': 3, 'reed-richards': 3, 'sue-storm': 2, 'johnny-storm': 2, 'ben-grimm': 2, 'professor-x': 3, magneto: 1, cyclops: 1, nightcrawler: 1, mystique: 2, beast: 2, gambit: 1, 'yelena-belova': 1, 'red-guardian': 1, 'john-walker': 1, ghost: 2, 'bob-reynolds': 3, shuri: 3, mbaku: 1, namor: 3, loki: 1, 'peggy-carter': 3 };

export const versusOf = (slug: string) => VS[`../../research/versus/${slug}.json`];
export const briefOf = (slug: string) => BRIEFS[slug] ?? null;

/**
 * The threat index: Marvel's six power-grid ratings (1 to 7 each) added up, 6 to 42, judged in Doom's own words.
 * Bands are this site's reading of the numbers; the numbers are Marvel's. Doom is the measure, not a threat.
 */
export const BANDS = [
  { min: 32, id: 'worthy', name: 'Worthy of Doom', cls: 'os-red', line: 'At last, something worth my full attention.' },
  { min: 27, id: 'nemesis', name: 'Nemesis', cls: 'os-amber', line: 'Dangerous. This one I will face myself.' },
  { min: 21, id: 'rival', name: 'Rival', cls: 'os-hi', line: 'Capable. Not capable enough.' },
  { min: 0, id: 'nuisance', name: 'Nuisance', cls: 'os-dim', line: 'An irritation. My Doombots will see to it.' },
] as const;
export const SOVEREIGN = { id: 'sovereign', name: 'Sovereign', cls: 'os-hi', line: 'The measure every other threat is taken against.' };
export const UNMEASURED = { id: 'unmeasured', name: 'Unmeasured', cls: 'os-dim', line: 'Marvel never rated this one. I watch instead.' };
export const threatLevel = (n: number) => BANDS.find((b) => n >= b.min)!;
const gridTotal = (slug: string) => { const g = versusOf(slug)?.powerGrid?.values as Record<string, number> | undefined; return g ? Object.values(g).reduce((a, v) => a + v, 0) : null; };

/** A target's threat: the total, its rank among the rated targets other than Doom (ties share a rank), its band. */
export function threatOf(slug: string) {
  const total = gridTotal(slug);
  if (slug === 'victor-von-doom') return { total, rank: null, of: 0, joint: false, band: SOVEREIGN };
  const rated = publishedOrder().filter((s) => s !== 'victor-von-doom').map(gridTotal).filter((x): x is number => x !== null);
  if (total === null) return { total, rank: null, of: rated.length, joint: false, band: UNMEASURED };
  return { total, rank: 1 + rated.filter((x) => x > total).length, of: rated.length, joint: rated.filter((x) => x === total).length > 1, band: threatLevel(total) };
}
export type Threat = ReturnType<typeof threatOf>;

export function scanPhoto(slug: string, n = PICK[slug], size = 1280) {
  const ph = photos2For(slug), p = ph.find((x) => x.n === n) ?? ph[0];
  if (!p) return null;
  const src = p.cut.length ? p.cut : p.full;
  return {
    tile: pick2(src, 640), photo: pick2(src, size), full: pick2(p.full, 1280), cut: p.cut.length > 0,
    depth: p.cdepth ? u('/' + p.cdepth) : pick2(p.depth, 1024), head: (p.head ?? [0.5, 0.15]) as [number, number], bbox: (p.bbox ?? [0, 0, 1, 1]) as [number, number, number, number],
  };
}

export function targets() {
  return publishedOrder().map((slug, i) => {
    const r = getResearch(slug)!, c = castFor(slug)!, vs = versusOf(slug), b = briefOf(slug);
    const grid = (vs?.powerGrid?.values ?? null) as Record<string, number> | null;
    const threat = grid ? Object.values(grid).reduce((a, v) => a + v, 0) : null;
    const team = TEAMS.find((t) => t.id === c.team)!;
    return {
      slug, no: i + 1, name: heroName(slug), alias: r.alias, real: r.name, team: team.name, teamId: team.id, actor: c.actor, href: u(`/c/${slug}/`),
      ...scanPhoto(slug)!,
      threat, threatOf: threatOf(slug), grid, powerType: (vs?.powerType ?? null) as string | null,
      brief: b ? { who: b.who as string, powers: b.powers as string } : null,
      first: `${r.origin.firstAppearance.title} ${r.origin.firstAppearance.issue} (${r.origin.firstAppearance.coverDate})`,
      firstYear: Number((r.origin.firstAppearance.coverDate.match(/\d{4}/) ?? ['0'])[0]),
      screens: r.screen.length,
    };
  });
}
export type Target = ReturnType<typeof targets>[number];
