/**
 * The heroes trace you back (a game, labelled so; nothing here is about the film). Every target file His Majesty
 * opens in a session lets the heroes trace the access a little further: a six-step meter climbs in the bar (a line
 * across the dock on phones) and a short message slides in, then out of the way.
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
  const meter = document.querySelector<HTMLElement>('[data-trace-meter]'), toast = document.querySelector<HTMLElement>('[data-trace-toast]');
  if (!meter || !toast) return;
  const by = new Map(index.map((t) => [t.slug, t]));
  const html = document.documentElement, segs = [...meter.querySelectorAll('i')];
  const show = (n: number) => {
    const step = n % EVERY, k = step / EVERY;
    meter.hidden = n === 0;
    segs.forEach((g, i) => g.classList.toggle('on', i < step));
    document.querySelectorAll('[data-trace-pct]').forEach((p) => { p.textContent = `${Math.round(k * 100)}%`; });
    html.style.setProperty('--trace', String(k));
    html.dataset.trace = n === 0 ? '' : k >= 0.66 ? 'hot' : 'on';
  };
  show(read().n);
  // the message slides in for a few seconds each time the trace climbs, then gets out of the way
  let t = 0;
  const say = (msg: string) => {
    toast.querySelector('[data-trace-msg]')!.textContent = msg;
    toast.hidden = false; toast.classList.remove('out');
    clearTimeout(t); t = window.setTimeout(() => { toast.classList.add('out'); t = window.setTimeout(() => { toast.hidden = true; }, 400); }, 4200);
  };
  document.addEventListener('astro:page-load', () => {
    if (document.body.dataset.page !== 'file') return;
    const slug = location.pathname.split('/').filter(Boolean).pop() ?? '';
    const st = read();
    st.n++; if (slug !== 'victor-von-doom' && !st.seen.includes(slug)) st.seen.push(slug);
    write(st); show(st.n);
    const left = EVERY - (st.n % EVERY);
    say(left === EVERY ? 'They are in. Countermeasures standing by.' : `The heroes are tracing Your Majesty's access. ${left} more file${left > 1 ? 's' : ''} and they break in.`);
    if (st.n % EVERY === 0 && st.seen.length) {
      const who = by.get(st.seen[Math.floor(Math.random() * st.seen.length)]);
      if (who) setTimeout(() => breach(who, say), 2600);
    }
  });
}

function breach(t: T, say: (m: string) => void) {
  const s = Sound.get();
  alarm(s);
  const name = t.name.toUpperCase();
  breached(t.name);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    say(`${name} breached the network. Repelled.`);
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
