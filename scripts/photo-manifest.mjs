// Merges research/photos/group-*.json into one download list for approval.
// Re-checks every image with a header-only request (no download), enforces the
// allowed-source rule, and writes research/photos/manifest.json, manifest.md
// and manifest.html (thumbnails load from the official servers in the viewer).
// Usage: node scripts/photo-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';

const dir = 'research/photos';
const ALLOWED = [/(^|\.)marvel\.com$/, /(^|\.)d23\.com$/, /(^|\.)disneyplus\.com$/, /(^|\.)dgepress\.com$/, /(^|\.)thewaltdisneycompany\.com$/, /(^|\.)disney\.com$/];
const allowed = (u) => { try { const h = new URL(u).hostname; return ALLOWED.some((r) => r.test(h)); } catch { return false; } };

const groups = fs.readdirSync(dir).filter((f) => /^group-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const order = JSON.parse(fs.readFileSync('research/official.json', 'utf8')).cast.map((c) => c.slug).filter(Boolean);
order.unshift('home');

async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    return { ok: r.ok, status: r.status, bytes: Number(r.headers.get('content-length') || 0), type: r.headers.get('content-type') || '' };
  } catch (e) { return { ok: false, status: 0, bytes: 0, type: String(e).slice(0, 60) }; }
}

const rows = [];
const notFound = [];
for (const g of groups) {
  for (const it of g.items || []) rows.push(it);
  for (const nf of g.notFound || []) notFound.push(nf);
}
rows.sort((a, b) => (order.indexOf(a.slug) - order.indexOf(b.slug)) || (a.rank - b.rank));

const out = [];
for (const it of rows) {
  const h = await head(it.imageUrl);
  const problems = [];
  if (!allowed(it.imageUrl)) problems.push('image host not allowed');
  if (!allowed(it.sourcePage)) problems.push('source page not allowed');
  if (!h.ok) problems.push(`HEAD ${h.status}`);
  if (h.ok && !/^image\//.test(h.type)) problems.push(`not an image (${h.type})`);
  const ext = (h.type.split('/')[1] || 'img').replace('jpeg', 'jpg').split(';')[0];
  out.push({ ...it, bytes: h.bytes || it.bytes || 0, contentType: h.type || it.contentType, file: `${it.slug}-${it.rank}.${ext}`, ok: problems.length === 0, problems });
}

const ok = out.filter((r) => r.ok);
const uniq = (list) => [...new Map(list.map((r) => [r.imageUrl, r])).values()];   // shared images download once
const total = uniq(ok).reduce((a, r) => a + r.bytes, 0);
const firstPicks = uniq(ok.filter((r) => r.rank === 1));
const fmt = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(0)} KB`);
const covered = new Set(ok.map((r) => r.slug));
const missing = order.filter((s) => s !== 'home' && !covered.has(s));

fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ builtOn: new Date().toISOString().slice(0, 10), totalBytes: total, items: out, notFound, missing }, null, 2));

const md = [
  '# Photo download list (awaiting approval)',
  '',
  `${ok.length} candidates (${uniq(ok).length} distinct files) from official sources, ${fmt(total)} in total. First choices only: ${firstPicks.length} files, ${fmt(firstPicks.reduce((a, r) => a + r.bytes, 0))}.`,
  '',
  '| File | Character | Shows | Size | Image URL | Published on |',
  '|---|---|---|---|---|---|',
  ...out.map((r) => `| ${r.ok ? '' : '~~'}${r.file}${r.ok ? '' : '~~'} | ${r.slug} (#${r.rank}) | ${r.shows.replace(/\|/g, '/')} | ${fmt(r.bytes)} | ${r.imageUrl} | ${r.sourcePage} |${r.problems.length ? ` REJECTED: ${r.problems.join(', ')}` : ''}`),
  '',
  missing.length ? `No usable official photo found for: ${missing.join(', ')}. Their pages keep the abstract hero and say so.` : 'Every character has at least one usable official photo.',
].join('\n');
fs.writeFileSync(path.join(dir, 'manifest.md'), md);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Photo download list</title>
<style>:root{--bg:#0b0c0d;--ink:#e8e6e1;--dim:#9a978e;--line:#24282a;--ok:#3dff8a;--bad:#ff5a5a}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif;padding:24px 16px}
h1{font-weight:500;margin:0 0 6px}p{color:var(--dim);margin:0 0 18px;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.c{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#111314}
.c img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;background:#1a1d1f}
.c div{padding:10px 12px}.c b{display:block}.c small{color:var(--dim);display:block;margin-top:4px;word-break:break-word}
.c a{color:var(--ink)}.rank{font:11px ui-monospace,monospace;color:var(--ok)}.bad{color:var(--bad)}</style></head><body>
<h1>Photo download list</h1>
<p>${ok.length} candidates (${uniq(ok).length} distinct files), ${fmt(total)} in total (first choices only: ${firstPicks.length} files, ${fmt(firstPicks.reduce((a, r) => a + r.bytes, 0))}). Thumbnails load directly from the official sites in your browser; nothing has been downloaded yet.${missing.length ? ` No usable official photo was found for: ${esc(missing.join(', '))}.` : ''}</p>
<div class="grid">${out.map((r) => `<div class="c"><img loading="lazy" src="${esc(r.imageUrl)}" alt="${esc(r.shows)}"><div><span class="rank">${esc(r.slug)} · choice ${r.rank}${r.ok ? '' : ' · <span class="bad">rejected: ' + esc(r.problems.join(', ')) + '</span>'}</span><b>${esc(r.file)} · ${fmt(r.bytes)}</b><small>${esc(r.shows)}</small><small>Published on <a href="${esc(r.sourcePage)}" target="_blank" rel="noopener">${esc(new URL(r.sourcePage).hostname + new URL(r.sourcePage).pathname)}</a></small></div></div>`).join('')}</div></body></html>`;
fs.writeFileSync(path.join(dir, 'manifest.html'), html);

console.log(`items ${out.length}, ok ${ok.length}, rejected ${out.length - ok.length}, total ${fmt(total)}, first picks ${firstPicks.length}, missing: ${missing.join(', ') || 'none'}`);
