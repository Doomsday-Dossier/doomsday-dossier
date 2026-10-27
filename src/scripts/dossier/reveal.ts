/**
 * Shared v2 reveals for every page: display text fitted to its box, titles that rise word by word,
 * blocks that settle as they arrive. Reduced motion leaves everything in place.
 *
 * The reveals are CSS transitions started by a class (system.css, "reveals"): setting them up reads nothing from
 * the page. A GSAP `from` per element reads that element's computed style first, and on a page change, with the
 * new page's styles not yet calculated, that forced a style recalculation per word (CLAUDE.md, "Page changes").
 * The compositor runs the transitions, so they stay smooth on a busy main thread. Titles are split into words
 * only as they come near.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { gsap } from 'gsap';
import { fitText } from '../motion/grammar';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Blocks that settle in as they arrive; `from` offsets one (x in px, y in px, a slight turn in degrees). */
export function settle(els: HTMLElement[], start = 'top 88%', from?: (el: HTMLElement, i: number) => { x?: number; y?: number; r?: number }) {
  if (!els.length) return;
  els.forEach((el, i) => {
    const f = from?.(el, i);
    if (f) el.style.cssText += `;--sx:${f.x ?? 0}px;--sy:${f.y ?? 26}px;--sr:${f.r ?? 0}deg`;
    el.setAttribute('data-settle', '');
  });
  ScrollTrigger.batch(els, { start, once: true, onEnter: (b) => b.forEach((el) => el.classList.add('in')) });
}

/** Titles whose words rise from behind their line, split as they come near. */
export function rise(els: HTMLElement[], start = 'top 85%') {
  if (!els.length) return;
  ScrollTrigger.batch(els, {
    start: 'top 160%', once: true,
    onEnter: (b) => b.forEach((el) => {
      SplitText.create(el, {
        type: 'lines,words', mask: 'lines', linesClass: 'split-line', wordsClass: 'split-w', autoSplit: true,
        onSplit: (s) => { s.words.forEach((w, i) => (w as HTMLElement).style.setProperty('--i', String(i))); el.classList.add('split'); },
      });
      ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => el.classList.add('in') });
    }),
  });
}

export function reveals(root: ParentNode, reduced: boolean) {
  fitText(root);
  document.fonts.ready.then(() => { if (fitText(root)) ScrollTrigger.refresh(); }).catch(() => {});
  addEventListener('resize', () => { if (fitText(root)) ScrollTrigger.refresh(); });
  if (reduced) return;
  rise([...root.querySelectorAll<HTMLElement>('[data-rise]')], 'top 88%');
  settle([...root.querySelectorAll<HTMLElement>('[data-reveal]')], 'top 90%');
}
