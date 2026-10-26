// Upscales the user's supplied photos 4x with Real-ESRGAN (realesrgan-x4plus, ncnn/Vulkan, runs on
// this PC; nothing leaves it). Only photos whose short side is under 1200 px are upscaled; the rest
// are already sharp. Resumable: finished files are skipped. Output: photo-originals/upscaled/<name>.png
// Usage: node scripts/upscale-photos.mjs <path to realesrgan-ncnn-vulkan.exe>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const exe = process.argv[2];
// absolute paths: the upscaler runs from its own folder
const src = path.resolve('photo-originals/user'), out = path.resolve('photo-originals/upscaled');
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
let done = 0, skipped = 0;
for (const f of files) {
  const dest = path.join(out, f.replace(/\.[^.]+$/, '.png'));
  if (fs.existsSync(dest)) { done++; continue; }
  const meta = await sharp(path.join(src, f)).metadata();
  if (Math.min(meta.width, meta.height) >= 1200) { skipped++; continue; }
  // the ncnn build reads png/jpg/webp; feed it a png so odd encodings never trip it
  const tmp = path.join(out, '_in.png');
  await sharp(path.join(src, f)).png().toFile(tmp);
  const t0 = Date.now();
  // a starved GPU writes an all-black image without reporting an error (19 files on 26 October, while
  // browser tests shared the GPU): check every output and retry with smaller tiles before giving up
  let ok = false, r;
  for (const tile of ['200', '100', '64']) {
    r = spawnSync(exe, ['-i', tmp, '-o', dest, '-n', 'realesrgan-x4plus', '-s', '4', '-t', tile, '-f', 'png'], { cwd: path.dirname(exe), stdio: 'pipe' });
    if (r.status === 0 && fs.existsSync(dest)) {
      const st = await sharp(dest).stats();
      if (st.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3 > 10) { ok = true; break; }
      console.log('black output, retrying with smaller tiles', f, tile);
    }
    fs.rmSync(dest, { force: true });
  }
  fs.rmSync(tmp, { force: true });
  if (!ok) { console.log('FAILED', f, String(r.stderr).slice(-300)); continue; }
  done++;
  console.log(`${done}/${files.length - skipped}`, f, `${meta.width}x${meta.height} -> ${meta.width * 4}x${meta.height * 4}`, `${Math.round((Date.now() - t0) / 1000)}s`);
}
console.log('finished', done, 'upscaled,', skipped, 'already sharp');
