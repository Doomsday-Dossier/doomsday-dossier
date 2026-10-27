// Builds a character's meshes from its sculpt: every part meshed (mesh.mjs) and written to
// public/models/<slug>-<style>.ddm with its materials, for src/scripts/gl/model.ts. Runs on the CPU only.
// Usage: node scripts/sculpt/build.mjs <slug|all> [statue|collectible|both] [cell size in mm]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { meshSDF, writeDDM, budget } from './mesh.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [which = 'all', styles = 'both', cellMM] = process.argv.slice(2);
const slugs = which === 'all' ? fs.readdirSync(path.join(here, 'characters')).filter((f) => f.endsWith('.mjs') && f !== 'base.mjs').map((f) => f.replace('.mjs', '')) : [which];
const out = path.join(here, '..', '..', 'public', 'models');
fs.mkdirSync(out, { recursive: true });

for (const slug of slugs) {
  const mod = (await import(pathToFileURL(path.join(here, 'characters', `${slug}.mjs`)).href)).default;
  for (const style of styles === 'both' ? ['statue', 'collectible'] : [styles]) {
    if (!mod[style]) continue;
    const m = mod[style].build();
    const h = (Number(cellMM) || (style === 'statue' ? 2.3 : 3.0)) / 1000;
    const parts = [];
    for (const [i, p] of m.parts.entries()) {
      // the main part gets most of the polygon budget; props (a mask, a shield, a hammer) a share each
      const raw = meshSDF(p.sdf, m.bounds[0], m.bounds[1], p.cell ?? h);
      const mesh = await budget(raw, p.tris ?? (i === 0 ? (style === 'statue' ? 150000 : 90000) : 30000));
      console.log(`  meshed ${raw.stats.vertices} vertices, ${raw.stats.triangles} triangles; kept ${mesh.stats.triangles}`);
      const used = new Set(mesh.materials);
      console.log(`${slug} ${style} ${p.name}: ${mesh.stats.vertices} vertices, ${mesh.stats.triangles} triangles, materials ${[...used].join(',')}, ${(mesh.stats.ms / 1000).toFixed(1)} s`);
      if (mesh.stats.vertices) parts.push({ name: p.name, mesh, pivot: p.pivot });
    }
    const file = path.join(out, `${slug}-${style}.ddm`);
    const bytes = writeDDM(file, parts, { slug, style, materials: m.materials, focus: m.focus, face: m.face, frame: m.frame, look: m.look ?? {} });
    console.log(`  -> ${path.relative(process.cwd(), file)} ${(bytes / 1024).toFixed(0)} KB`);
  }
}
