/**
 * The temporal archive's multiverse map (2D canvas, drawn only while something changes, at most 30 times a second).
 * Four universes are rings of light seen at an angle, each turning slowly: the comics (amber), the Fox films (blue),
 * Marvel Studios (green) and other studios (violet). The log entry nearest the middle of the screen sets the year;
 * every sighting up to it is a light on its universe's ring, the newest brightest; threads in a character's own
 * colour join their sightings across universes; Marvel's announcements gather at the centre. From 2019 the rings
 * drift together, and at the release they meet: one ring, Doom's.
 */
import { onLeave } from '../../page-scope';
import { tick, sweep, lock } from '../../sound/os';
import { reduced, sound } from '../fx';

type E = { id: string; u: 'C' | 'F' | 'M' | 'O' | 'N'; y: number; s: number; w: string[]; t: string };
const COL: Record<string, [number, number, number]> = { C: [255, 179, 71], F: [143, 202, 255], M: [61, 255, 143], O: [199, 155, 255], N: [233, 255, 243] };
const NAME: Record<string, string> = { C: 'EARTH-616 // THE COMICS', F: '20TH CENTURY FOX FILMS', M: 'MARVEL STUDIOS // MCU', O: 'OTHER STUDIOS' };
const HOME: Record<string, [number, number]> = { C: [0.28, 0.3], F: [0.72, 0.28], M: [0.7, 0.68], O: [0.3, 0.7] };

export function timeline() {
  const raw = document.querySelector('[data-mv-data]'); if (!raw) return;
  const D = JSON.parse(raw.textContent!) as { evs: E[]; chars: Record<string, { name: string; accent: string }> };
  const canvas = document.querySelector<HTMLCanvasElement>('[data-mv]')!, g = canvas.getContext('2d')!;
  const yearEl = document.querySelector<HTMLElement>('[data-mv-year]')!, nowEl = document.querySelector<HTMLElement>('[data-mv-now]')!, phaseEl = document.querySelector<HTMLElement>('[data-mv-phase]')!;
  const s = sound();
  let alive = true; onLeave(() => { alive = false; });
  const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
  const evs = D.evs.map((e) => ({ ...e, a: hash(e.id) * Math.PI * 2, r: 0.82 + hash(e.id + 'r') * 0.3 }));
  // each character's sightings, in order, for the threads
  const lives = new Map<string, typeof evs>();
  for (const e of evs) for (const w of e.w) { if (!lives.has(w)) lives.set(w, []); lives.get(w)!.push(e); }

  let W = 0, H = 0, dpr = 1;
  const resize = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; dirty = true; };
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  // the year: the log entry nearest the middle of the screen
  const items = [...document.querySelectorAll<HTMLElement>('[data-ev]')];
  let target = evs[0].s, shown = evs[0].s, current: HTMLElement | null = null, dirty = true, lastYear = 0, merged = false;
  const pickNow = () => {
    const mid = innerWidth < 900 ? innerHeight * 0.68 : innerHeight * 0.5;
    let best: HTMLElement | null = null, bd = 1e9;
    for (const it of items) { const r = it.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue; const d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = it; } }
    if (!best) best = scrollY < 200 ? items[0] : items[items.length - 1];
    if (best !== current) {
      current?.classList.remove('now'); best.classList.add('now'); current = best;
      target = Number(best.dataset.s); dirty = true;
      const e = evs.find((x) => x.id === best!.dataset.ev);
      nowEl.textContent = e ? e.t : '';
      tick(s);
    }
  };
  addEventListener('scroll', pickNow, { passive: true }); pickNow();

  const pos = (u: string, k: number, t: number) => {
    // the rings drift together from 2019, meeting at the release
    if (u === 'N') return { x: W / 2, y: H / 2, R: 0 };
    const [hx, hy] = HOME[u], cx = hx * W + (W / 2 - hx * W) * k, cy = hy * H + (H / 2 - hy * H) * k;
    const R = Math.min(W, H) * (0.17 + k * 0.13);
    return { x: cx, y: cy, R, t };
  };
  const ease = (x: number) => x * x * (3 - 2 * x);

  let last = 0, t0 = performance.now();
  const frame = (now: number) => {
    if (!alive) { ro.disconnect(); return; }
    requestAnimationFrame(frame);
    if (document.hidden || !W) return;
    const moving = Math.abs(target - shown) > 1;
    if (!moving && !dirty && now - last < 33) return;
    if (now - last < 16) return;
    last = now; dirty = false;
    shown += (target - shown) * (reduced() ? 1 : 0.12);
    const year = Math.floor(shown / 1000), t = (now - t0) / 1000;
    if (year !== lastYear) { yearEl.textContent = String(year); lastYear = year; }
    const k = ease(Math.min(1, Math.max(0, (shown / 1000 - 2019) / 7.9)));
    if (k > 0.98 && !merged) { merged = true; phaseEl.textContent = 'Convergence // 18 December 2026'; sweep(s, 1.4); setTimeout(() => lock(s), 900); }
    if (k < 0.9 && merged) { merged = false; }
    if (!merged) phaseEl.textContent = k > 0.05 ? 'Universes drifting together' : 'Watching every universe';

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const tilt = 0.36, spin = reduced() ? 0 : t * 0.05;
    const point = (e: (typeof evs)[number]) => {
      const p = pos(e.u, k, t);
      if (e.u === 'N') { const a = e.a + spin * 2; return { x: p.x + Math.cos(a) * 14 * e.r, y: p.y + Math.sin(a) * 14 * e.r * tilt * 2 }; }
      const a = e.a + spin * (e.u === 'C' ? 1 : e.u === 'F' ? -0.8 : e.u === 'M' ? 0.7 : -1.1);
      return { x: p.x + Math.cos(a) * p.R * e.r, y: p.y + Math.sin(a) * p.R * e.r * tilt };
    };
    // the rings
    for (const u of ['C', 'F', 'M', 'O']) {
      const first = evs.find((e) => e.u === u); if (!first || first.s > shown) continue;
      const p = pos(u, k, t), [r, gg, b] = COL[u];
      const age = Math.min(1, (shown - first.s) / 3000);
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = `rgba(${r},${gg},${b},${(0.08 + i * 0.1) * age})`; g.lineWidth = [7, 3, 1][i];
        g.beginPath(); g.ellipse(p.x, p.y, p.R, p.R * tilt, 0, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = `rgba(${r},${gg},${b},${0.75 * age * (1 - k * 0.8)})`; g.font = '600 10px "JetBrains Mono", monospace'; g.textAlign = 'center';
      g.fillText(NAME[u], p.x, p.y - p.R * tilt - 14);
    }
    // the threads: a character's sightings joined across universes
    for (const [slug, list] of lives) {
      const seen = list.filter((e) => e.s <= shown); if (seen.length < 2) continue;
      const acc = D.chars[slug]?.accent ?? '#3dff8f';
      g.strokeStyle = acc + '55'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < seen.length; i++) {
        if (seen[i].u === seen[i - 1].u) continue;
        const a = point(seen[i - 1]), b = point(seen[i]);
        g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2 + (W / 2 - (a.x + b.x) / 2) * 0.5, (a.y + b.y) / 2 + (H / 2 - (a.y + b.y) / 2) * 0.5, b.x, b.y);
      }
      g.stroke();
    }
    // the sightings
    for (const e of evs) {
      if (e.s > shown) break;
      const p = point(e), [r, gg, b] = COL[e.u], fresh = Math.max(0, 1 - (shown - e.s) / 4000);
      const size = 1.6 + Math.min(4, e.w.length * 0.6) + fresh * 3;
      g.fillStyle = `rgba(${r},${gg},${b},${0.12 + fresh * 0.25})`; g.beginPath(); g.arc(p.x, p.y, size * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(${r},${gg},${b},${0.55 + fresh * 0.45})`; g.beginPath(); g.arc(p.x, p.y, size, 0, Math.PI * 2); g.fill();
    }
    // the convergence: one ring, Doom's
    if (k > 0.6) {
      const m = (k - 0.6) / 0.4, R = Math.min(W, H) * 0.36;
      g.strokeStyle = `rgba(61,255,143,${0.5 * m})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(W / 2, H / 2, R, R * tilt, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(61,255,143,${0.08 * m})`; g.beginPath(); g.arc(W / 2, H / 2, R * 0.5 * m, 0, Math.PI * 2); g.fill();
    }
    // the current sighting, called out
    const cur = evs.find((e) => e.id === current?.dataset.ev);
    if (cur) {
      const p = point(cur);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#3dff8f'; g.lineWidth = 1;
      g.beginPath(); g.arc(p.x, p.y, 12 + Math.sin(t * 4) * 2, 0, Math.PI * 2); g.stroke();
      const lx = p.x > W * 0.6 ? p.x - 26 : p.x + 26, ly = p.y - 26;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(lx, ly); g.stroke();
      g.font = '700 11px "JetBrains Mono", monospace'; g.textAlign = p.x > W * 0.6 ? 'right' : 'left';
      const label = cur.t.length > 34 ? cur.t.slice(0, 33) + '…' : cur.t;
      g.fillStyle = 'rgba(2,5,4,0.85)'; const tw = g.measureText(label).width; g.fillRect(p.x > W * 0.6 ? lx - tw - 4 : lx - 4, ly - 12, tw + 8, 17);
      g.fillStyle = '#cdf5df'; g.fillText(label, lx, ly + 1);
    }
    g.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(frame);
}
