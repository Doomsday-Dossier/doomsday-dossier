// Promo captions, injected into the live page by scripts/promo/capture.mjs. They live on <html> (outside <body>),
// so they survive the site's page changes. window.__cap(n, title, sub) shows a lower-third; __cap() hides it;
// window.__tap(x, y) draws a touch ripple for the phone cut.
(() => {
  if (window.__cap) return;
  const css = document.createElement('style');
  css.textContent = `
  .pc { position: fixed; z-index: 2147483000; left: 64px; bottom: 72px; max-width: min(1180px, calc(100vw - 100px)); pointer-events: none; font-family: 'JetBrains Mono', monospace; color: #e9fff3; }
  .pc[hidden] { display: none; }
  .pc .pk { display: inline-block; font-size: 22px; font-weight: 700; letter-spacing: .26em; text-transform: uppercase; color: #021008; background: #3dff8f; padding: 5px 10px; }
  .pc .pt { margin-top: 10px; font-family: 'Tektur Variable', 'Tektur', sans-serif; font-weight: 700; font-size: 92px; line-height: .95; text-transform: uppercase; color: #3dff8f; text-shadow: -1px 0 0 rgba(255,64,96,.4), 1px 0 0 rgba(64,210,255,.4), 0 0 18px rgba(61,255,143,.45), 0 4px 30px #000; }
  .pc .ps { margin-top: 14px; font: 500 34px/1.35 'Inter Tight Variable', 'Inter Tight', sans-serif; color: #e9fff3; text-shadow: 0 2px 16px #000, 0 0 2px #000; max-width: 40ch; }
  .pc .pbg { position: absolute; inset: -40px -70px -40px -64px; z-index: -1; background: radial-gradient(ellipse at 25% 60%, rgba(1,6,3,.94), rgba(1,6,3,.7) 55%, transparent 78%); }
  .pc.in .pk, .pc.in .pt, .pc.in .ps { animation: pcin .55s cubic-bezier(.2,.8,.2,1) both; }
  .pc.in .pt { animation-delay: .08s; } .pc.in .ps { animation-delay: .18s; }
  @keyframes pcin { from { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateX(-14px); } to { opacity: 1; clip-path: inset(0 0 0 0); transform: none; } }
  .pc.out { animation: pcout .35s ease forwards; } @keyframes pcout { to { opacity: 0; transform: translateY(8px); } }
  .pc.ph { left: 18px; right: 18px; bottom: 86px; max-width: none; }
  .pc.ph .pk { font-size: 12px; padding: 3px 8px; } .pc.ph .pt { font-size: 38px; margin-top: 6px; } .pc.ph .ps { font-size: 16px; margin-top: 6px; max-width: 30ch; }
  .pc.ph .pbg { inset: -30px -18px -20px -18px; background: linear-gradient(180deg, transparent, rgba(1,6,3,.9) 30%, rgba(1,6,3,.95)); }
  .ptap { position: fixed; z-index: 2147483001; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; border: 2px solid #eafff3; background: rgba(61,255,143,.25); pointer-events: none; animation: ptap .7s ease-out forwards; }
  @keyframes ptap { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
  `;
  document.documentElement.append(css);
  const el = document.createElement('div'); el.className = document.documentElement.classList.contains('pv-phone') ? 'pc ph' : 'pc'; el.hidden = true;
  el.innerHTML = '<div class="pbg"></div><span class="pk"></span><div class="pt"></div><div class="ps"></div>';
  document.documentElement.append(el);
  window.__cap = (k, t, s) => {
    if (!k) { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, 360); return; }
    el.querySelector('.pk').textContent = k; el.querySelector('.pt').textContent = t; el.querySelector('.ps').textContent = s || '';
    el.hidden = false; el.classList.remove('out', 'in'); void el.offsetWidth; el.classList.add('in');
  };
  window.__tap = (x, y) => { const t = document.createElement('i'); t.className = 'ptap'; t.style.left = x + 'px'; t.style.top = y + 'px'; document.documentElement.append(t); setTimeout(() => t.remove(), 800); };
})();
