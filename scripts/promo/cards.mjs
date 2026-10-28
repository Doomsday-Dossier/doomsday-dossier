// Promo stills, drawn as HTML in the site's own fonts and colours and saved as PNG: the end cards (wide and tall), the
// backdrop and phone bezel for the wide video's phone segment, and the mask that rounds the phone's screen.
// node scripts/promo/cards.mjs <base> <outdir> "<made by line>"
import { chromium } from 'playwright';
import fs from 'node:fs';
const [base = 'http://localhost:4322', out = 'screenshots/promo/cards', by = 'Made by Prejith'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const URL_TEXT = 'doomsday-dossier.github.io/doomsday-dossier';
const css = `
  html, body { margin: 0; background: #020504; overflow: hidden; }
  .stage { position: relative; width: 100vw; height: 100vh; overflow: hidden; font-family: 'JetBrains Mono', monospace; color: #cdf5df;
    background: radial-gradient(ellipse at 50% 46%, rgba(61,255,143,.16), transparent 62%), radial-gradient(rgba(61,255,143,.13) 1px, transparent 1.6px) 0 0 / 26px 26px, #020504; }
  .stage::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.2) 2px 3px), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,.6)); }
  .k { display: inline-block; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: #021008; background: #3dff8f; padding: .3em .7em; }
  .t { font-family: 'Tektur Variable', 'Tektur', sans-serif; font-weight: 700; text-transform: uppercase; line-height: .9; color: #3dff8f;
    text-shadow: -2px 0 0 rgba(255,64,96,.45), 2px 0 0 rgba(64,210,255,.45), 0 0 30px rgba(61,255,143,.55); }
  .u { font-weight: 700; color: #eafff3; letter-spacing: .02em; border: 2px solid rgba(61,255,143,.7); padding: .5em .9em; display: inline-block; background: rgba(2,12,7,.8); }
  .s { font-family: 'Inter Tight Variable', 'Inter Tight', sans-serif; color: #d9f7e6; }
  .f { color: #7fae93; letter-spacing: .18em; text-transform: uppercase; }
  .ring { position: absolute; border: 2px solid rgba(61,255,143,.25); border-radius: 50%; }
  .corner { position: absolute; width: 60px; height: 60px; border: 3px solid #3dff8f; }
`;
const endCard = (w, h) => {
  const tall = h > w, fs = (px) => `${px * (tall ? 1.05 : 1)}px`;
  return `<div class="stage" style="width:${w}px;height:${h}px;display:grid;place-content:center;justify-items:center;text-align:center;gap:${tall ? 26 : 30}px">
    <i class="ring" style="width:${tall ? 900 : 1100}px;height:${tall ? 900 : 1100}px;left:50%;top:50%;transform:translate(-50%,-50%)"></i>
    <i class="ring" style="width:${tall ? 700 : 860}px;height:${tall ? 700 : 860}px;left:50%;top:50%;transform:translate(-50%,-50%);border-style:dashed"></i>
    <i class="corner" style="left:48px;top:48px;border-right:0;border-bottom:0"></i><i class="corner" style="right:48px;bottom:48px;border-left:0;border-top:0"></i>
    <span class="k" style="font-size:${fs(24)}">Avengers: Doomsday // fan site</span>
    <div class="t" style="font-size:${tall ? 156 : 168}px">Doomsday<br/>Dossier</div>
    <div class="s" style="font-size:${fs(38)};max-width:${tall ? 880 : 1300}px">All 29 confirmed characters, every film and comic, as Doctor Doom's own surveillance system.</div>
    <div class="u" style="font-size:${tall ? 31 : 40}px">${URL_TEXT}</div>
    <div class="s" style="font-size:${fs(34)};font-weight:600;color:#eafff3">${by}</div>
    <div class="f" style="font-size:${fs(20)}">Unofficial fan project · not affiliated with Marvel or Disney</div>
  </div>`;
};
const phoneBg = `<div class="stage" style="width:1920px;height:1080px">
  <i class="corner" style="left:48px;top:48px;border-right:0;border-bottom:0"></i><i class="corner" style="right:48px;bottom:48px;border-left:0;border-top:0"></i>
  <div style="position:absolute;left:150px;top:250px;width:860px;display:grid;gap:30px">
    <span class="k" style="font-size:22px;justify-self:start">08 // Responsive</span>
    <div class="t" style="font-size:110px">Built for<br/>phones too</div>
    <div class="s" style="font-size:36px;line-height:1.45">Tap a shard or pick a face from the strip. A dock within thumb reach. The same depth scans and sounds, in your pocket.</div>
  </div>
</div>`;
const S = { x: 1190, y: 90, w: 506, h: 900, r: 52 };
const bezel = `<div style="position:relative;width:1920px;height:1080px;background:transparent">
  <div style="position:absolute;left:${S.x - 16}px;top:${S.y - 16}px;width:${S.w + 32}px;height:${S.h + 32}px;border-radius:${S.r + 14}px;border:16px solid #0b1410;box-sizing:border-box;box-shadow:0 0 0 2px rgba(61,255,143,.5), 0 30px 80px rgba(0,0,0,.7), 0 0 60px rgba(61,255,143,.18)"></div>
  <div style="position:absolute;left:${S.x + S.w / 2 - 50}px;top:${S.y - 9}px;width:100px;height:10px;border-radius:6px;background:#0b1410"></div>
</div>`;
const mask = `<div style="width:${S.w}px;height:${S.h}px;background:#000"><div style="width:100%;height:100%;border-radius:${S.r}px;background:#fff"></div></div>`;

const b = await chromium.launch();
const shot = async (html, w, h, file, transparent = false) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(`${base}/about/`); await p.waitForTimeout(800);
  await p.evaluate(([html, css, transparent]) => {
    document.head.querySelectorAll('script').forEach((s) => s.remove());
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    document.body.className = ''; document.body.innerHTML = html;
    document.documentElement.className = ''; document.documentElement.style.background = transparent ? 'transparent' : '#020504'; document.body.style.background = transparent ? 'transparent' : '#020504';
  }, [html, css, transparent]);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${file}`, omitBackground: transparent });
  await ctx.close();
};
await shot(endCard(1920, 1080), 1920, 1080, 'end-wide.png');
await shot(endCard(1080, 1920), 1080, 1920, 'end-tall.png');
await shot(phoneBg, 1920, 1080, 'phone-bg.png');
await shot(bezel, 1920, 1080, 'bezel.png', true);
await shot(mask, S.w, S.h, 'mask.png');
fs.writeFileSync(`${out}/screen.json`, JSON.stringify(S));
await b.close(); console.log('cards done');
