// Episode runtimes and which characters appear, from the MCU Wiki episode pages.
// Usage: node scripts/episodes.mjs "Episode title" ... -> JSON lines (minutes, characters seen in the cast lists)
const UA = 'DoomsdayDossier/1.0 (fan research)';
const HOST = 'marvelcinematicuniverse.fandom.com';
// the characters the planner needs, as the wiki links them
const WATCH = { 'joaquin-torres': /\[\[Joaquín Torres[|\]]/, 'john-walker': /\[\[John Walker[|\]]/, loki: /\[\[Loki(?:\/[^\]|]*)?(?:\|[^\]]*)?\]\]/ }; // the wiki links Loki per variant: [[Loki/New York Time Heist|Loki]]

for (const name of process.argv.slice(2)) {
  const u = `https://${HOST}/api.php?action=parse&page=${encodeURIComponent(name.replace(/ /g, '_'))}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  if (!j.parse) { console.log(JSON.stringify({ episode: name, error: 'no page' })); continue; }
  const w = j.parse.wikitext;
  const m = w.match(/\|\s*(?:runtime|running ?time)\s*=\s*([^\n|]*)/i);
  const minutes = m ? Number((m[1].match(/(\d{2,3})\s*min/i) || [])[1]) || null : null;
  // appearances: the cast and characters sections list who is in the episode
  const cast = w.split(/==\s*(?:Cast|Appearances)\s*==/i).slice(1).join('\n');
  const who = Object.entries(WATCH).filter(([, re]) => re.test(cast)).map(([k]) => k);
  console.log(JSON.stringify({ episode: name, page: j.parse.title, minutes, who, source: { label: `Marvel Cinematic Universe Wiki: ${j.parse.title}`, url: `https://${HOST}/wiki/${encodeURIComponent(j.parse.title.replace(/ /g, '_'))}` } }));
}
