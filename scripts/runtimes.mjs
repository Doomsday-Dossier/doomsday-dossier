// Film running times for the catch-up planner, each from the title's own wiki page.
// MCU Wiki first (Marvel Studios titles), then the Marvel Fandom wiki (Fox titles).
// Usage: node scripts/runtimes.mjs "Thor|2011" "X2|2003" ...   -> JSON lines
const UA = 'DoomsdayDossier/1.0 (fan research)';
const WIKIS = [
  { host: 'marvelcinematicuniverse.fandom.com', label: 'Marvel Cinematic Universe Wiki' },
  { host: 'marvel.fandom.com', label: 'Marvel Fandom wiki' },
];

async function page(host, title) {
  const u = `https://${host}/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  return j.parse ? { title: j.parse.title, text: j.parse.wikitext } : null;
}

async function runtime(name, year) {
  const base = name.replace(/ /g, '_');
  const tries = [`${base}_(film)`, base, `${base}_(${year}_film)`];
  for (const w of WIKIS) for (const t of tries) {
    const p = await page(w.host, t).catch(() => null);
    if (!p || /^#REDIRECT/i.test(p.text)) continue;
    // the infobox must be for this release: its date field should mention the year
    const m = p.text.match(/\|\s*(?:runtime|running ?time)\s*=\s*([^\n|]*)/i);
    const mins = m && Number((m[1].match(/(\d{2,3})\s*min/i) || [])[1]);
    if (mins && p.text.includes(String(year))) {
      return { title: name, year, minutes: mins, source: { label: `${w.label}: ${p.title}`, url: `https://${w.host}/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}` } };
    }
  }
  return { title: name, year, minutes: null, source: null };
}

for (const arg of process.argv.slice(2)) {
  const [name, year] = arg.split('|');
  console.log(JSON.stringify(await runtime(name, Number(year))));
}
