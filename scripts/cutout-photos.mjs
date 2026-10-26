// Cuts each supplied photo's subject out of its background with briaai/RMBG-1.4 (run locally through
// transformers.js; non-commercial licence, which this fan site is). Writes a greyscale alpha mask at the
// photo's own size to photo-originals/masks/<name>.png; photos-build applies it to the upscaled photo.
// Resumable. Usage: node scripts/cutout-photos.mjs [name filter]
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';

// the model files live in photo-originals/models (fetched once with Windows curl; this PC's network re-signs TLS for Node)
env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = path.resolve('photo-originals/models') + '/';
const src = path.resolve('photo-originals/user'), out = path.resolve('photo-originals/masks');
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;

const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', { config: { model_type: 'custom' }, dtype: 'q8' });
const processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
  config: { do_normalize: true, do_pad: false, do_rescale: true, do_resize: true, image_mean: [0.5, 0.5, 0.5], feature_extractor_type: 'ImageFeatureExtractor', image_std: [1, 1, 1], resample: 2, rescale_factor: 1 / 255, size: { width: 1024, height: 1024 } },
});

const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && (!only || only.test(f))).sort();
let n = 0;
for (const f of files) {
  const dest = path.join(out, f.replace(/\.[^.]+$/, '.png'));
  if (fs.existsSync(dest)) continue;
  const t0 = Date.now();
  const image = await RawImage.read(path.join(src, f));
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
  await mask.save(dest);
  n++;
  console.log(n, f, `${image.width}x${image.height}`, `${Date.now() - t0}ms`);
}
console.log('finished', n, 'masks');
