// Downloads exactly the approved files in research/photos/manifest.json
// (distinct image URLs only) into photo-originals/, a git-ignored folder used
// for nothing else. Verifies type and size against the manifest and records a
// SHA-256 for each file in photo-originals/downloads.json.
// Usage: node scripts/photo-download.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const m = JSON.parse(fs.readFileSync('research/photos/manifest.json', 'utf8'));
const outDir = 'photo-originals';
fs.mkdirSync(outDir, { recursive: true });

const byUrl = new Map();
for (const it of m.items.filter((i) => i.ok)) {
  if (!byUrl.has(it.imageUrl)) byUrl.set(it.imageUrl, { url: it.imageUrl, bytes: it.bytes, type: it.contentType, uses: [] });
  byUrl.get(it.imageUrl).uses.push({ slug: it.slug, rank: it.rank, sourcePage: it.sourcePage, shows: it.shows, owner: it.owner || 'Marvel Studios' });
}

const results = [];
let i = 0;
for (const entry of byUrl.values()) {
  i++;
  const ext = (entry.type.split('/')[1] || 'img').split(';')[0].replace('jpeg', 'jpg');
  const name = `${String(i).padStart(2, '0')}-${entry.uses[0].slug}-${entry.uses[0].rank}.${ext}`;
  const file = path.join(outDir, name);
  let status = 'ok';
  try {
    const r = await fetch(entry.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const type = r.headers.get('content-type') || '';
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (entry.bytes && Math.abs(buf.length - entry.bytes) > 0) status = `size differs from list (${buf.length} vs ${entry.bytes})`;
    fs.writeFileSync(file, buf);
    results.push({ file: name, url: entry.url, bytes: buf.length, type, sha256: crypto.createHash('sha256').update(buf).digest('hex'), status, uses: entry.uses });
  } catch (e) {
    results.push({ file: name, url: entry.url, bytes: 0, status: `failed: ${e.message}`, uses: entry.uses });
  }
  process.stdout.write(`${String(i).padStart(2)} ${results.at(-1).status === 'ok' ? 'ok  ' : 'NOTE'} ${name} ${results.at(-1).status === 'ok' ? '' : results.at(-1).status}\n`);
}
fs.writeFileSync(path.join(outDir, 'downloads.json'), JSON.stringify({ downloadedOn: new Date().toISOString(), files: results }, null, 2));
const okN = results.filter((r) => r.status === 'ok').length;
console.log(`\n${okN} of ${results.length} saved and matched; ${(results.reduce((a, r) => a + r.bytes, 0) / 1048576).toFixed(2)} MB`);
