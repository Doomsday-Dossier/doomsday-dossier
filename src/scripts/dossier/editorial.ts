/**
 * Editorial pages, design system v2 (Oyla): the planner, sources and credits. Each print in the band
 * comes toward the reader as it passes, the photo settling inside its frame. The planner keeps its v1
 * logic (smallest watch list, hours a day to release).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { catchUp } from '../motion/catchup';
import { reveals } from './reveal';

gsap.registerPlugin(ScrollTrigger);

export function editorialPage(env: { reduced: boolean }, page: string) {
  reveals(document, env.reduced);
  if (page === 'catchup') catchUp(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
  if (env.reduced) return;
  document.querySelectorAll<HTMLElement>('[data-oy]').forEach((oy, i) => {
    const frame = oy.querySelector('.oy-frame'), img = oy.querySelector('img');
    gsap.fromTo(frame, { scale: 0.84, y: 40 + i * 30 }, { scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: oy, start: 'top bottom', end: 'center 55%', scrub: 0.4 } });
    gsap.fromTo(img, { scale: 1.35 }, { scale: 1.02, ease: 'none', scrollTrigger: { trigger: oy, start: 'top bottom', end: 'bottom top', scrub: 0.4 } });
  });
}
