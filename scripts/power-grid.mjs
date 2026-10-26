// Reads the official power grid from an archived marvel.com Marvel Universe wiki page.
// Marvel drew each rating as a bar 21 px wide per point on a 1 to 7 scale.
// Usage: node scripts/power-grid.mjs "Doctor_Doom_(Victor_von_Doom)" [more names...]
// Prints JSON: { name, archived, snapshot, grid | null }. An all-1 grid is Marvel's blank placeholder and is reported as null.
const STATS = { intelligence: 'intelligence', strength: 'strength', speed: 'speed', durability: 'durability', energy: 'energyProjection', fighting: 'fightingSkills' };

async function lookup(name) {
  const target = `marvel.com/universe/${name}`;
  const avail = await (await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}`)).json();
  const snap = avail.archived_snapshots?.closest;
  if (!snap?.available) return { name, archived: null, snapshot: null, grid: null, note: 'no archived copy' };
  const raw = snap.url.replace(/\/web\/(\d+)\//, '/web/$1id_/');
  const html = await (await fetch(raw)).text();
  const grid = {};
  const re = /<div class="p-left"><p>(\w+)<\/p><\/div><div style="width:(\d+)px;" class="p-right ratingvalue">/g;
  let m;
  while ((m = re.exec(html))) if (STATS[m[1]]) grid[STATS[m[1]]] = Math.round(Number(m[2]) / 21);
  const complete = Object.keys(grid).length === 6 && Object.values(grid).every((v) => v >= 1 && v <= 7);
  // Marvel drew every bar at 1 for characters it never rated: that is a blank, not a rating
  if (complete && Object.values(grid).every((v) => v === 1)) return { name, archived: snap.url.replace(/^http:/, 'https:'), snapshot: snap.timestamp, grid: null, note: 'blank placeholder grid (every bar at 1): not rated' };
  return { name, archived: snap.url.replace(/^http:/, 'https:'), snapshot: snap.timestamp, grid: complete ? grid : null, note: complete ? undefined : `grid incomplete or absent (${JSON.stringify(grid)})` };
}

const out = [];
for (const n of process.argv.slice(2)) out.push(await lookup(n));
console.log(JSON.stringify(out, null, 1));
