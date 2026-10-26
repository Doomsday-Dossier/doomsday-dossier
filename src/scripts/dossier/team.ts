/**
 * A team (Lena Varga). The pinned stage shows one member at a time. Scrolling past a step sweeps the
 * next one in: their colour field wipes up over the last, they arrive from close to the camera and settle,
 * and their name types in letter by letter while the previous member drops back and fades. On fine
 * pointers the subject leans toward the cursor.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reveals } from './reveal';
import { fitText } from '../motion/grammar';
import { EASE } from './tokens';

gsap.registerPlugin(ScrollTrigger, SplitText);

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
  const count = car.querySelector<HTMLElement>('[data-count]');
  const cue = car.querySelector<HTMLElement>('[data-cue]');
  // names split into letters once their faces have loaded (the split must measure the real face)
  const chars: (Element[] | null)[] = slides.map(() => null);
  const letters = (i: number) => {
    if (!chars[i]) chars[i] = SplitText.create(slides[i].querySelector('[data-name]')!, { type: 'words,chars', charsClass: 'tm-ch' }).chars // words keep each name whole when it wraps;
    return chars[i]!;
  };
  const parts = (s: HTMLElement) => ({ fly: s.querySelector('[data-fly]'), info: s.querySelectorAll('[data-info]') });
  let cur = -1, z = 1;

  const show = (i: number, dir: number) => {
    if (i === cur) return;
    const prev = cur; cur = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (count) count.textContent = String(i + 1).padStart(2, '0');
    document.body.style.setProperty('--accent', getComputedStyle(slides[i]).getPropertyValue('--a'));
    // the new colour wipes up over the last (down, going back)
    gsap.set(bgs[i], { zIndex: ++z });
    gsap.fromTo(bgs[i], { yPercent: prev < 0 ? 0 : 100 * dir }, { yPercent: 0, duration: 0.95, ease: EASE.file, overwrite: true });
    if (prev >= 0) {
      const o = parts(slides[prev]);
      slides[prev].setAttribute('aria-hidden', 'true');
      gsap.to(letters(prev), { yPercent: -110 * dir, opacity: 0, duration: 0.35, stagger: 0.012, ease: 'power2.in', overwrite: true });
      gsap.to(o.info, { opacity: 0, duration: 0.25, overwrite: true });
      gsap.to(o.fly, { scale: 0.82, yPercent: 6, opacity: 0, duration: 0.55, ease: 'power2.in', overwrite: true, onComplete: () => { if (cur !== prev) gsap.set(slides[prev], { visibility: 'hidden' }); } });
    }
    const n = parts(slides[i]);
    fitText(slides[i]);
    slides[i].removeAttribute('aria-hidden');
    gsap.set(slides[i], { visibility: 'visible', zIndex: ++z });
    // arrives from close to the camera, large and low, and settles onto its mark
    gsap.fromTo(n.fly, { scale: dir > 0 ? 1.9 : 0.7, yPercent: dir > 0 ? 22 : -4, opacity: 0 }, { scale: 1, yPercent: 0, opacity: 1, duration: 1.15, ease: EASE.reveal, delay: prev < 0 ? 0.1 : 0.2, overwrite: true });
    gsap.fromTo(letters(i), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, stagger: 0.03, ease: EASE.reveal, delay: 0.35, overwrite: true });
    gsap.fromTo(n.info, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: EASE.reveal, delay: 0.55, overwrite: true });
  };

  slides.forEach((s, k) => { if (k) gsap.set(s, { visibility: 'hidden' }); });
  // GSAP would read the CSS translateY(100%) as pixels: hand it the colour fields in percent from the start
  // the later fields wait hidden below the stage (CSS hides them until this script has placed them)
  bgs.forEach((b, k) => gsap.set(b, { y: 0, yPercent: k ? 100 : 0, visibility: 'visible' }));
  const start = () => {
    ScrollTrigger.create({
      trigger: car, start: 'top top', end: 'bottom bottom',
      onUpdate: (st) => {
        const i = Math.min(slides.length - 1, Math.floor(st.progress * slides.length * 0.999));
        show(i, i >= cur ? 1 : -1);
        if (cue) cue.style.opacity = i === slides.length - 1 ? '0' : '1';
      },
    });
    show(0, 1);
  };
  // every member's name face must be loaded before names are fitted and split: a hidden slide's face can
  // arrive after document.fonts.ready, and a name measured in the fallback font overflows (RED GUARDIA/N)
  const faces = slides.map((s) => { const cs = getComputedStyle(s); return document.fonts.load(cs.getPropertyValue('--fw').trim() + ' 100px ' + cs.getPropertyValue('--f').trim()).catch(() => []); });
  Promise.all([document.fonts.ready, ...faces]).then(() => { fitText(car); start(); }, start);

  // the subject leans toward the cursor (fine pointers only)
  if (matchMedia('(pointer: fine)').matches) {
    const movers = slides.map((s) => { const p = s.querySelector('[data-par]')!; return { x: gsap.quickTo(p, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(p, 'y', { duration: 1.2, ease: 'power3' }) }; });
    car.addEventListener('pointermove', (e) => {
      if (cur < 0) return;
      movers[cur].x((e.clientX / innerWidth - 0.5) * -26);
      movers[cur].y((e.clientY / innerHeight - 0.5) * -14);
    }, { passive: true });
  }
}
