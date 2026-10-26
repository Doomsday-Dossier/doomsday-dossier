/**
 * Shared v2 reveals for every page: display text fitted to its box, titles that rise word by word,
 * blocks that settle as they arrive. Reduced motion leaves everything in place.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { fitText } from '../motion/grammar';
import { EASE } from './tokens';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function reveals(root: ParentNode, reduced: boolean) {
  fitText(root);
  document.fonts.ready.then(() => { if (fitText(root)) ScrollTrigger.refresh(); }).catch(() => {});
  addEventListener('resize', () => { if (fitText(root)) ScrollTrigger.refresh(); });
  if (reduced) return;
  root.querySelectorAll<HTMLElement>('[data-rise]').forEach((el) => {
    SplitText.create(el, { type: 'lines,words', mask: 'lines', linesClass: 'split-line', autoSplit: true, onSplit: (s) => gsap.from(s.words, { yPercent: 110, duration: 0.9, stagger: 0.05, ease: EASE.reveal, scrollTrigger: { trigger: el, start: 'top 88%', once: true } }) });
  });
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => gsap.from(el, { y: 26, opacity: 0, duration: 0.8, ease: EASE.reveal, scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
}
