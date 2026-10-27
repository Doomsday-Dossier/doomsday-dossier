/**
 * The heroes trace you back (a game, labelled so; nothing here is about the film). Every target file His Majesty
 * opens in a session lets the heroes trace the access a little further: a counter-trace meter climbs in the corner.
 * At six files they break in: the screen floods with the colour of a target he examined, their name glitching over
 * it, a klaxon; a moment later Doom's countermeasure wipes them out in green and the breach goes in the royal log.
 * Then the trace starts again. Reduced motion: the alert and the log only, no flood.
 */
import { Sound } from '../sound/engine';
import { alarm, staticBurst, lock } from '../sound/os';
import { breached } from './reign';

const KEY = 'dd-trace', EVERY = 6;
type T = { slug: string; name: string; accent: string; tile: string };
const read = (): { n: number; seen: string[] } => { try { return JSON.parse(sessionStorage.getItem(KEY) || '') ; } catch { return { n: 0, seen: [] }; } };
const write = (v: { n: number; seen: string[] }) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export function trace(index: T[]) {
  const panel = document.querySelector<HTMLElement>('[data-trace]');
  if (!panel) return;
  const by = new Map(index.map((t) => [t.slug, t]));
  const bar = panel.querySelector<HTMLElement>('i')!, pct = panel.querySelector<HTMLElement>('b')!;
  const show = (n: number) => {
    const k = (n % EVERY) / EVERY;
    panel.hidden = n === 0;
    bar.style.transform = `scaleX(${k})`; pct.textContent = `${Math.round(k * 100)}%`;
    panel.classList.toggle('hot', k >= 0.66);
  };
  show(read().n);
  let newsT = 0;
  document.addEventListener('astro:page-load', () => {
    if (document.body.dataset.page !== 'file') return;
    const slug = location.pathname.split('/').filter(Boolean).pop() ?? '';
    const st = read();
    st.n++; if (slug !== 'victor-von-doom' && !st.seen.includes(slug)) st.seen.push(slug);
    write(st); show(st.n);
    panel.classList.add('news'); clearTimeout(newsT); newsT = window.setTimeout(() => panel.classList.remove('news'), 5000);
    if (!panel.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) panel.animate([{ opacity: 0.3 }, { opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }], { duration: 500, easing: 'steps(4, end)' });
    if (st.n % EVERY === 0 && st.seen.length) {
      const who = by.get(st.seen[Math.floor(Math.random() * st.seen.length)]);
      if (who) setTimeout(() => breach(who, panel), 2600);
    }
  });
}

function breach(t: T, panel: HTMLElement) {
  const s = Sound.get();
  alarm(s);
  const name = t.name.toUpperCase();
  breached(t.name);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    panel.querySelector('span')!.textContent = `${name} breached the network. Repelled.`;
    return;
  }
  const el = document.createElement('div');
  el.className = 'breach'; el.setAttribute('role', 'alert');
  el.style.setProperty('--acc', t.accent);
  el.innerHTML = `<div class="br-flood"></div><img src="${t.tile}" alt="" /><div class="br-text"><p class="br-k">Breach // counter-intrusion</p><p class="br-n"></p><p class="br-s">is inside the network</p><p class="br-game">A game: not part of the film</p></div><div class="br-wipe"><p>Countermeasure deployed<br/><b>DOOM-OS restored</b></p></div>`;
  el.querySelector('.br-n')!.textContent = name;
  document.body.append(el);
  staticBurst(s);
  const flood = el.querySelector<HTMLElement>('.br-flood')!, img = el.querySelector<HTMLElement>('img')!, txt = el.querySelector<HTMLElement>('.br-text')!, wipe = el.querySelector<HTMLElement>('.br-wipe')!;
  flood.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.1 }, { opacity: 0.5, offset: 0.2 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0.8 }], { duration: 1700, fill: 'forwards', easing: 'steps(10, end)' });
  // the intruder's face, torn into slices that jump
  const frames: Keyframe[] = [];
  for (let i = 0; i < 9; i++) { const a = Math.random() * 80; frames.push({ clipPath: `inset(${a}% 0 ${100 - a - 8 - Math.random() * 20}% 0)`, transform: `translate(-50%, -50%) translateX(${(Math.random() - 0.5) * 60}px)`, opacity: 0.9 }); }
  frames.push({ clipPath: 'inset(0 0 0 0)', transform: 'translate(-50%, -50%)', opacity: 0.55 });
  img.animate(frames, { duration: 900, easing: 'steps(10, end)', fill: 'forwards' });
  txt.animate([{ opacity: 0, transform: 'translateX(-30px) skewX(-12deg)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 200, easing: 'steps(5, end)', fill: 'both' });
  // Doom answers
  setTimeout(() => {
    lock(s);
    wipe.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 420, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' });
    setTimeout(() => {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(() => el.remove());
    }, 1100);
  }, 1800);
}
