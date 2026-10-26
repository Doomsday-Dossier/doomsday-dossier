/**
 * The timeline, design system v2. A pinned Space Voyage hero travels the decades: each decade's window
 * opens on a character who first appeared in it, over the giant decade, with that decade's numbers
 * beside it; the decades down the side jump the film strip there. Below, the v1 film strip.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { filmStrip } from '../motion/filmstrip';
import { glideTo } from '../motion/scroller';
import { reveals } from './reveal';
import { EASE } from './tokens';

gsap.registerPlugin(ScrollTrigger);

export function timelinePage(env: { reduced: boolean }) {
  reveals(document, env.reduced);
  filmStrip(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
  const hero = document.querySelector<HTMLElement>('[data-voyage-decades]');
  if (!hero) return;
  const slides = [...hero.querySelectorAll<HTMLElement>('[data-vg-slide]')];
  const dots = [...hero.querySelectorAll<HTMLElement>('[data-vg-dot]')];
  let cur = -1;
  const show = (i: number) => {
    if (i === cur) return;
    const prev = cur; cur = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (env.reduced) { slides.forEach((s, k) => gsap.set(s, { visibility: k === i ? 'visible' : 'hidden' })); return; }
    if (prev >= 0) {
      const p = slides[prev];
      p.setAttribute('aria-hidden', 'true');
      gsap.to(p.querySelector('.vg-window'), { scale: 0.6, opacity: 0, duration: 0.4, ease: 'power2.in', overwrite: true });
      gsap.to(p.querySelectorAll('.vg-year, .vg-data'), { opacity: 0, duration: 0.3, overwrite: true, onComplete: () => { if (cur !== prev) gsap.set(p, { visibility: 'hidden' }); } });
    }
    const n = slides[i];
    n.removeAttribute('aria-hidden');
    gsap.set(n, { visibility: 'visible' });
    gsap.fromTo(n, { opacity: 0 }, { opacity: 1, duration: 0.5, overwrite: true });
    gsap.fromTo(n.querySelector('.vg-window'), { scale: 1.25, opacity: 0, rotate: -3 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.9, ease: EASE.reveal, overwrite: true });
    gsap.fromTo(n.querySelector('.vg-window img'), { yPercent: 18 }, { yPercent: 0, duration: 1.1, ease: 'back.out(1.3)', overwrite: true });
    gsap.fromTo(n.querySelector('.vg-year'), { yPercent: -40, opacity: 0 }, { yPercent: -50, opacity: 1, duration: 0.8, ease: EASE.reveal, overwrite: true });
    gsap.fromTo(n.querySelectorAll('.vg-data > div'), { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.07, ease: EASE.reveal, delay: 0.2, overwrite: true });
  };
  slides.forEach((s, k) => { if (k) gsap.set(s, { visibility: 'hidden' }); });
  if (!env.reduced) ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (st) => show(Math.min(slides.length - 1, Math.floor(st.progress * slides.length * 0.999))) });
  show(0);
  // a decade from the side list: the strip jumps to its first frame and the page glides down to it
  hero.querySelectorAll<HTMLButtonElement>('[data-vg-go]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.vgGo);
    const strip = document.querySelector<HTMLElement>('[data-strip]');
    const frame = [...document.querySelectorAll<HTMLElement>('[data-frame]')].find((f) => !f.hidden && Math.floor(Number(f.dataset.year) / 10) * 10 === d);
    if (strip && frame) strip.scrollTo({ left: frame.offsetLeft - (strip.clientWidth - frame.offsetWidth) / 2, behavior: env.reduced ? 'auto' : 'smooth' });
    const target = document.querySelector<HTMLElement>('[data-timeline-page]');
    if (target) glideTo(target.getBoundingClientRect().top + scrollY + 40, 1);
  }));
}
