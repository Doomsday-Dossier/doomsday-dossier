// Contact sheet of frames from a recorded video, for checking motion before sending it.
// Usage: node scripts/video-sheet.mjs <video> <out.jpg> [frames=20] [cols=10]
import { chromium } from '@playwright/test';
import path from 'node:path';
const [video, out, n = '20', cols = '10'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 } });
await p.goto('file:///' + path.resolve(video).split(path.sep).join('/'));
const size = await p.evaluate(async ([n, cols]) => {
  const v = document.querySelector('video'); v.pause(); v.muted = true;
  await new Promise((r) => (v.readyState >= 2 ? r() : v.addEventListener('loadeddata', r, { once: true })));
  // webm from a recorder may report Infinity until the end is seeked
  if (!isFinite(v.duration)) { v.currentTime = 1e6; await new Promise((r) => v.addEventListener('seeked', r, { once: true })); }
  const W = 1800 / cols, H = Math.round((W * v.videoHeight) / v.videoWidth);
  const c = document.createElement('canvas'); c.width = 1800; c.height = H * Math.ceil(n / cols);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = '13px monospace';
  for (let i = 0; i < n; i++) {
    v.currentTime = (v.duration * (i + 0.5)) / n; await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    const x = (i % cols) * W, y = Math.floor(i / cols) * H; g.drawImage(v, x, y, W, H); g.fillText(v.currentTime.toFixed(1) + 's', x + 4, y + 14);
  }
  document.body.innerHTML = ''; document.body.style.margin = '0'; document.body.appendChild(c);
  return [c.width, c.height];
}, [Number(n), Number(cols)]);
await p.setViewportSize({ width: size[0], height: size[1] });
await p.screenshot({ path: out, type: 'jpeg', quality: 70 });
console.log(out);
await b.close();
