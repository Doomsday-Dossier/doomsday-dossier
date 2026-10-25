// Builds contact sheets of the downloaded originals, grouped by character, with
// real pixel dimensions, and writes photo-originals/dimensions.json.
// Usage: node scripts/photo-sheet.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dl = JSON.parse(fs.readFileSync('photo-originals/downloads.json', 'utf8'));
const order = ['home', ...JSON.parse(fs.readFileSync('research/official.json', 'utf8')).cast.map((c) => c.slug).filter(Boolean)];
const bySlug = new Map();
for (const f of dl.files) for (const u of f.uses) {
  if (!bySlug.has(u.slug)) bySlug.set(u.slug, []);
  bySlug.get(u.slug).push({ file: f.file, rank: u.rank, shows: u.shows, bytes: f.bytes });
}
const slugs = order.filter((s) => bySlug.has(s));
const abs = (f) => pathToFileURL(path.resolve('photo-originals', f)).href;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#ccc;font:13px ui-monospace,monospace;padding:10px}
.row{display:flex;gap:10px;align-items:flex-start;border-top:1px solid #333;padding:10px 0}
.lab{width:150px;flex:none;color:#3dff8a}
.it{width:260px;flex:none}.it img{width:260px;height:260px;object-fit:contain;background:#000;display:block}
.it small{display:block;color:#999;margin-top:4px;line-height:1.3}
</style></head><body>${slugs.map((s) => `<div class="row"><div class="lab">${s}</div>${bySlug.get(s).sort((a, b) => a.rank - b.rank).map((x) => `<div class="it"><img src="${abs(x.file)}" data-f="${x.file}"><small>#${x.rank} ${x.file}<br><span class="dim"></span> · ${Math.round(x.bytes / 1024)} KB</small></div>`).join('')}</div>`).join('')}</body></html>`;
fs.mkdirSync('screenshots/qa', { recursive: true });
const sheetFile = path.resolve('screenshots/qa/photo-sheet.html');
fs.writeFileSync(sheetFile, html);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
await p.goto(pathToFileURL(sheetFile).href, { waitUntil: 'load' });
await p.waitForTimeout(1200);
const dims = await p.evaluate(() => {
  const out = {};
  document.querySelectorAll('img').forEach((img) => {
    out[img.dataset.f] = { w: img.naturalWidth, h: img.naturalHeight };
    img.parentElement.querySelector('.dim').textContent = `${img.naturalWidth}x${img.naturalHeight}`;
  });
  return out;
});
fs.writeFileSync('photo-originals/dimensions.json', JSON.stringify(dims, null, 2));
// split into a few sheets so each stays readable
const rows = await p.$$('.row');
const per = 8;
for (let i = 0; i < rows.length; i += per) {
  await p.evaluate(([a, z]) => { document.querySelectorAll('.row').forEach((r, k) => { r.style.display = k >= a && k < z ? 'flex' : 'none'; }); }, [i, i + per]);
  await p.screenshot({ path: `screenshots/qa/photo-sheet-${i / per + 1}.jpg`, fullPage: true, type: 'jpeg', quality: 80 });
}
await b.close();
console.log(`${Object.keys(dims).length} images measured; ${Math.ceil(rows.length / per)} sheets`);
for (const [f, d] of Object.entries(dims)) if (d.w < 900) console.log('small:', f, `${d.w}x${d.h}`);
