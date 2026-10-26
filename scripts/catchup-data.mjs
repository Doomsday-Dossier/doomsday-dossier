// Builds research/catchup.json for the catch-up planner.
// "Ready" (user's choice): each character's first and most recent live-action appearance with
// their Doomsday actor. Re-releases do not count. Films count in full; series count only the
// episodes the character is credited in. Every runtime carries its source.
// Usage: node scripts/catchup-data.mjs   (runs scripts/runtimes.mjs and scripts/episodes.mjs)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const key = (t, y) => `${t}|${y}`;
// series in the plan: the wiki pages of their episodes, in order
const SERIES = {
  'The Falcon and The Winter Soldier|2021': ['New World Order', 'The Star-Spangled Man', 'Power Broker', 'The Whole World Is Watching', 'Truth', 'One World, One People'],
  'Loki (season 2)|2023': ['Ouroboros (episode)', 'Breaking Brad', '1893', 'Heart of the TVA', 'Science/Fiction', 'Glorious Purpose (Loki Season Two)'],
};
// runtimes missing from the fan wikis, taken from the episode's Wikipedia article
const WIKIPEDIA = {
  'Power Broker': { minutes: 53, source: { label: 'Wikipedia: Power Broker (The Falcon and the Winter Soldier)', url: 'https://en.wikipedia.org/wiki/Power_Broker_(The_Falcon_and_the_Winter_Soldier)' } },
};

const official = JSON.parse(fs.readFileSync('research/official.json', 'utf8'));
const characters = {};
const needed = new Map();
for (const c of official.cast.filter((x) => x.slug)) {
  const r = JSON.parse(fs.readFileSync(`research/${c.slug}.json`, 'utf8'));
  // credits vary ("Tenoch Huerta" on screen, "Tenoch Huerta Mejia" in Marvel's cast list): compare the first two names
  const two = (n) => fold(n.replace(/ Jr\.$/, '')).split(/\s+/).slice(0, 2).join(' ');
  const actor = two(c.actor);
  const mine = r.screen.filter((s) => s.actor && two(s.actor) === actor && !/re-release|encore/i.test(s.title)).sort((a, b) => a.year - b.year);
  if (!mine.length) throw new Error(`no screen appearance for ${c.slug}`);
  const first = mine[0], latest = mine[mine.length - 1];
  characters[c.slug] = { first: key(first.title, first.year), latest: latest === first ? null : key(latest.title, latest.year) };
  for (const s of [first, latest]) needed.set(key(s.title, s.year), { title: s.title, year: s.year, cont: s.continuity });
}

const titles = {};
const films = [...needed.keys()].filter((k) => !SERIES[k]);
const filmOut = execFileSync('node', ['scripts/runtimes.mjs', ...films], { encoding: 'utf8' }).trim().split('\n').map((l) => JSON.parse(l));
for (const f of filmOut) {
  if (!f.minutes) throw new Error(`no runtime for ${f.title}`);
  const k = key(f.title, f.year);
  titles[k] = { title: f.title, year: f.year, cont: needed.get(k).cont, kind: 'film', minutes: f.minutes, source: f.source };
}
for (const [k, eps] of Object.entries(SERIES)) {
  if (!needed.has(k)) continue;
  const rows = execFileSync('node', ['scripts/episodes.mjs', ...eps], { encoding: 'utf8' }).trim().split('\n').map((l) => JSON.parse(l));
  const episodes = rows.map((e, i) => {
    const fix = WIKIPEDIA[eps[i]];
    const minutes = e.minutes || fix?.minutes;
    if (!minutes) throw new Error(`no runtime for episode ${eps[i]}`);
    return { n: i + 1, title: e.page.replace(/ \((?:episode|Loki Season Two)\)$/, ''), minutes, who: e.who, source: e.minutes ? e.source : fix.source };
  });
  titles[k] = { title: needed.get(k).title, year: needed.get(k).year, cont: needed.get(k).cont, kind: 'series', episodes };
}
fs.writeFileSync('research/catchup.json', JSON.stringify({ rule: 'first and latest appearance with the Doomsday actor; re-releases excluded; series by credited episode', characters, titles }, null, 1) + '\n');
console.log(`${Object.keys(characters).length} characters, ${Object.keys(titles).length} titles`);
