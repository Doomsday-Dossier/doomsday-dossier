// Contact sheet: lays images matching a prefix out in a labelled grid, for reviewing motion as frames.
// Usage: node scripts/sheet.mjs <dir> <prefix> <out.jpg> [columns] [cell width]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [dir, prefix, out, cols = '3', cell = '640'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && /\.(jpe?g|png)$/.test(f)).sort();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(cols) * (Number(cell) + 8) + 8, height: 600 } });
const imgs = files.map((f) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}"><figcaption>${f}</figcaption></figure>`).join('');
await p.setContent(`<body style="margin:0;background:#111;color:#9a9;font:12px monospace"><div style="display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;padding:8px">${imgs}</div><style>figure{margin:0}img{width:100%;display:block}</style></body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 70 });
await b.close();
console.log(out, files.length, 'frames');
