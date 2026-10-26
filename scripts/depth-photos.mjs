// Depth maps for the supplied photos (Depth Anything V2 Small, run locally through transformers.js;
// Apache-2.0). Near is white, far is black. Writes photo-originals/depth/<name>.png at the photo's own
// size; photos2-build turns them into the depth textures the 3D photo renderer reads. Resumable.
// Usage: node scripts/depth-photos.mjs [name filter]
import { pipeline, env } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';

// model files in photo-originals/models (fetched once with Windows curl: this PC's network re-signs TLS for Node)
env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = path.resolve('photo-originals/models') + '/';
const src = path.resolve('photo-originals/user'), out = path.resolve('photo-originals/depth');
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const depth = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'q8' });
const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && (!only || only.test(f))).sort();
let n = 0;
for (const f of files) {
  const dest = path.join(out, f.replace(/\.[^.]+$/, '.png'));
  if (fs.existsSync(dest)) continue;
  const t0 = Date.now();
  const r = await depth(path.join(src, f));
  // the pipeline returns a depth image already resized to the photo
  await r.depth.save(dest);
  n++;
  console.log(n, f, `${r.depth.width}x${r.depth.height}`, `${Date.now() - t0}ms`);
}
console.log('finished', n, 'depth maps');
