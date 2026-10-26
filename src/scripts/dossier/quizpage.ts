/**
 * The quiz, design system v2: the v1 quiz (ten questions, shareable result, Dossier-file cards) with a
 * Lena Varga result: the match bursts in, cut out, over their giant name on a flood of their colour.
 */
import { gsap } from 'gsap';
import { quizPage } from '../motion/quiz';
import { reveals } from './reveal';
import { EASE } from './tokens';

export function quizPageV2(env: { reduced: boolean }) {
  reveals(document, env.reduced);
  quizPage(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
  const result = document.querySelector<HTMLElement>('[data-result]');
  const name = document.querySelector<HTMLElement>('[data-r-name]');
  const giant = document.querySelector<HTMLElement>('[data-r-giant]');
  const img = document.querySelector<HTMLElement>('[data-r-img]');
  if (!result || !name || !giant || !img) return;
  // mirror the result's name, in the character's own face, behind the cut-out
  const mirror = () => {
    giant.innerHTML = [...name.querySelectorAll('.ln > span')].map((s) => `<span>${s.textContent}</span>`).join('') || `<span>${name.textContent}</span>`;
    giant.style.setProperty('--gf', name.style.getPropertyValue('--f'));
    giant.style.setProperty('--gw', name.style.getPropertyValue('--wt'));
    if (!env.reduced && !result.hidden) {
      gsap.fromTo(giant.children, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: EASE.reveal, delay: 0.25 });
      gsap.fromTo(img, { yPercent: 16, scale: 0.82 }, { yPercent: 0, scale: 1, duration: 1.1, ease: 'back.out(1.5)', delay: 0.35, overwrite: true });
    }
  };
  new MutationObserver(mirror).observe(name, { childList: true });
  mirror();
}
