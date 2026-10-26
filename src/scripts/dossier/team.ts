/**
 * A team (Lena Varga, Space Voyage). Scrolling the pinned stage brings members on one at a time: the
 * page takes the newcomer's colour, the previous member steps out, the new one bursts in over their
 * giant name, and the list down the side marks who is on stage.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reveals } from './reveal';
import { EASE } from './tokens';

gsap.registerPlugin(ScrollTrigger);

type Env = { reduced: boolean };

export function teamPage(env: Env) {
  const root = document.querySelector<HTMLElement>('[data-team]');
  if (!root) return;
  reveals(root, env.reduced);
  const car = root.querySelector<HTMLElement>('[data-carousel]');
  if (!car || env.reduced) return;
  const slides = [...car.querySelectorAll<HTMLElement>('[data-slide]')];
  const bgs = [...car.querySelectorAll<HTMLElement>('[data-bg]')];
  const dots = [...car.querySelectorAll<HTMLElement>('[data-dot]')];
  const cue = car.querySelector<HTMLElement>('[data-cue]');
  const parts = (s: HTMLElement) => ({ lines: s.querySelectorAll('[data-name] .ln'), cut: s.querySelector('[data-cut]'), info: s.querySelector('[data-info]') });
  let cur = -1;

  const show = (i: number, dir: number) => {
    if (i === cur) return;
    const prev = cur; cur = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    document.body.style.setProperty('--accent', getComputedStyle(slides[i]).getPropertyValue('--a'));
    bgs.forEach((b, k) => gsap.to(b, { opacity: k === i ? 1 : 0, duration: 0.7, ease: EASE.glow, overwrite: true }));
    if (prev >= 0) {
      const o = parts(slides[prev]);
      slides[prev].setAttribute('aria-hidden', 'true');
      gsap.to(o.lines, { yPercent: -60 * dir, opacity: 0, duration: 0.4, stagger: 0.04, ease: 'power2.in', overwrite: true });
      if (o.cut) gsap.to(o.cut, { xPercent: -14 * dir, scale: 0.9, opacity: 0, duration: 0.45, ease: 'power2.in', overwrite: true });
      gsap.to(o.info, { opacity: 0, duration: 0.25, overwrite: true, onComplete: () => { if (cur !== prev) gsap.set(slides[prev], { visibility: 'hidden' }); } });
    }
    const n = parts(slides[i]);
    slides[i].removeAttribute('aria-hidden');
    gsap.set(slides[i], { visibility: 'visible' });
    gsap.fromTo(n.lines, { yPercent: 70 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: EASE.reveal, delay: 0.15, overwrite: true });
    if (n.cut) gsap.fromTo(n.cut, { xPercent: 10 * dir, yPercent: 10, scale: 0.8, opacity: 0 }, { xPercent: 0, yPercent: 0, scale: 1, opacity: 1, duration: 1, ease: 'back.out(1.5)', delay: 0.2, overwrite: true });
    gsap.fromTo(n.info, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.reveal, delay: 0.45, overwrite: true });
  };

  slides.forEach((s, k) => { if (k) gsap.set(s, { visibility: 'hidden' }); });
  ScrollTrigger.create({
    trigger: car, start: 'top top', end: 'bottom bottom',
    onUpdate: (st) => {
      const i = Math.min(slides.length - 1, Math.floor(st.progress * slides.length * 0.999));
      show(i, i >= cur ? 1 : -1);
      if (cue) cue.style.opacity = i === slides.length - 1 ? '0' : '1';
    },
  });
  show(0, 1);
}
