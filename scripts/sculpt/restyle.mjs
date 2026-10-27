// Rewrites only the materials and lighting notes in built models, from the character files, without meshing
// again (colours and finishes are tuned far more often than shapes).
// Usage: node scripts/sculpt/restyle.mjs [slug|all]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models');
const which = process.argv[2] ?? 'all';
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.ddm'))) {
  const [, slug, style] = f.match(/^(.*)-(statue|collectible)\.ddm$/) ?? [];
  if (!slug || (which !== 'all' && which !== slug)) continue;
  const mod = (await import(pathToFileURL(path.join(here, 'characters', `${slug}.mjs`)).href)).default;
  const m = mod[style].build();
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, f)));
  const len = raw.readUInt32LE(4), head = JSON.parse(raw.subarray(8, 8 + len).toString());
  Object.assign(head, { materials: m.materials, look: m.look ?? {}, focus: m.focus, face: m.face, frame: m.frame });
  const json = Buffer.from(JSON.stringify(head)), pad = (4 - ((8 + json.length) % 4)) % 4;
  const hdr = Buffer.alloc(8); hdr.write('DDM1', 0); hdr.writeUInt32LE(json.length + pad, 4);
  fs.writeFileSync(path.join(dir, f), zlib.gzipSync(Buffer.concat([hdr, json, Buffer.alloc(pad, 0x20), raw.subarray(8 + len)]), { level: 9 }));
  console.log('restyled', f);
}
