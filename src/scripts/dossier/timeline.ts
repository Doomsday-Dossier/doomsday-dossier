/**
 * The timeline, after Space Voyage. The pinned hero is a run of worlds, one per decade: the current decade
 * fills the screen, and the next waits in a rounded window. Scrolling grows the window until it fills the
 * screen, the photo inside held still so it reads as a way through rather than a picture getting bigger;
 * the decade numerals and that decade's facts change bottom-left. The decades along the top jump the film
 * strip below, which is the v1 strip unchanged.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { filmStrip } from '../motion/filmstrip';
import { glideTo } from '../motion/scroller';
import { reveals } from './reveal';
import { EASE } from './tokens';

gsap.registerPlugin(ScrollTrigger);

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function timelinePage(env: { reduced: boolean }) {
  reveals(document, env.reduced);
  filmStrip(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
  const hero = document.querySelector<HTMLElement>('[data-voyage-decades]');
  if (!hero) return;
  const worlds = [...hero.querySelectorAll<HTMLElement>('[data-vw]')];
  const inner = worlds.map((w) => w.querySelector<HTMLElement>('[data-vw-in]')!);
  const copies = [...hero.querySelectorAll<HTMLElement>('[data-vg-slide]')];
  const dots = [...hero.querySelectorAll<HTMLElement>('[data-vg-dot]')];
  const next = hero.querySelector<HTMLElement>('[data-vg-next]')!;
  const nextD = hero.querySelector<HTMLElement>('[data-vg-next-d]')!;
  const decades = dots.map((d) => d.querySelector<HTMLElement>('[data-vg-go]')!.dataset.vgGo + 's');
  const n = worlds.length;

  // the copy for a decade: numerals rise, the facts settle
  let shown = -1;
  const show = (i: number) => {
    if (i === shown) return;
    const dir = i > shown ? 1 : -1, prev = shown;
    shown = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (prev >= 0) { gsap.to(copies[prev], { opacity: 0, duration: 0.25, overwrite: true, onComplete: () => { if (shown !== prev) gsap.set(copies[prev], { visibility: 'hidden' }); } }); copies[prev].setAttribute('aria-hidden', 'true'); }
    const c = copies[i];
    c.removeAttribute('aria-hidden');
    gsap.set(c, { visibility: 'visible', opacity: 1 });
    if (env.reduced) return;
    gsap.fromTo(c.querySelector('[data-vg-year]'), { yPercent: 40 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: EASE.reveal, overwrite: true });
    gsap.fromTo(c.querySelectorAll('[data-vg-in]'), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: EASE.reveal, delay: 0.1, overwrite: true });
  };

  // where the window waits: right of centre on wide screens, upper middle on phones
  let W = innerWidth, H = innerHeight, phone = W < 760, s0 = 0.3, cx = 0.7, cy = 0.44;
  const measure = () => { W = innerWidth; H = innerHeight; phone = W < 760; s0 = phone ? 0.4 : 0.3; cx = phone ? 0.5 : 0.7; cy = phone ? 0.4 : 0.46; };
  measure();
  addEventListener('resize', () => { measure(); place(lastP); });

  let lastP = 0;
  const place = (p: number) => {
    lastP = p;
    const k = Math.min(Math.floor(p), Math.max(0, n - 2));
    const t = n > 1 ? gsap.utils.clamp(0, 1, (p - k - 0.25) / 0.65) : 0;
    const e = inOut(t);
    worlds.forEach((w, j) => {
      if (j !== k && j !== k + 1) { if (w.style.visibility !== 'hidden') gsap.set(w, { visibility: 'hidden' }); return; }
      if (j === k) {
        // the world you are in pushes gently toward you as you leave it
        gsap.set(w, { visibility: 'visible', zIndex: 1, x: 0, y: 0, scale: 1, borderRadius: 0 });
        gsap.set(inner[j], { scale: 1 + 0.08 * e });
        return;
      }
      // the window: scaled down around its centre; the photo inside counter-scaled so it holds still
      const s = s0 + (1 - s0) * e;
      const r = 28 * (1 - gsap.utils.clamp(0, 1, (e - 0.8) / 0.2)) / s;
      gsap.set(w, { visibility: 'visible', zIndex: 2, x: (1 - e) * (cx * W - W / 2), y: (1 - e) * (cy * H - H / 2), scale: s, borderRadius: r });
      gsap.set(inner[j], { scale: (1 / s) * (1.12 - 0.12 * e) });
    });
    // the label under the window names the next decade, and fades as you travel in
    if (k + 1 < n) {
      nextD.textContent = decades[k + 1];
      const s = s0 + (1 - s0) * e;
      gsap.set(next, { x: cx * W - (s * W) / 2, y: cy * H + (s * H) / 2 + 10, opacity: gsap.utils.clamp(0, 1, 1 - e * 4) });
    } else gsap.set(next, { opacity: 0 });
    show(t > 0.55 ? k + 1 : k);
  };

  if (env.reduced || n < 2) { show(0); return; }
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (st) => place(st.progress * (n - 1)) });
  place(0);

  // a decade from the list: the strip jumps to its first frame and the page glides down to it
  hero.querySelectorAll<HTMLButtonElement>('[data-vg-go]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.vgGo);
    const strip = document.querySelector<HTMLElement>('[data-strip]');
    const frame = [...document.querySelectorAll<HTMLElement>('[data-frame]')].find((f) => !f.hidden && Math.floor(Number(f.dataset.year) / 10) * 10 === d);
    if (strip && frame) strip.scrollTo({ left: frame.offsetLeft - (strip.clientWidth - frame.offsetWidth) / 2, behavior: env.reduced ? 'auto' : 'smooth' });
    const target = document.querySelector<HTMLElement>('[data-timeline-page]');
    if (target) glideTo(target.getBoundingClientRect().top + scrollY + 40, 1);
  }));
}
