/**
 * The quiz: the v1 quiz (ten questions, shareable result, Dossier-file cards) in the archive's dress. When the
 * result arrives the match is revealed as a file being opened: redaction bars tear off the graded print, which
 * then settles with a slow push, the stamp lands, and the character's signature sound plays (design system v3:
 * photos are never assembled from particles). Reduced motion shows the print at once.
 */
import { gsap } from 'gsap';
import type Lenis from 'lenis';
import { quizPage } from '../motion/quiz';
import { reveals } from './reveal';
import { Sound } from '../sound/engine';
import { tear, stamp } from '../sound/actions';
import { playSignature } from '../sound/signatures';

type Env = { lenis: Lenis | null; reduced: boolean; phone: boolean };
type Entry = { slug: string; href: string };

export async function quizPageV2(env: Env) {
  reveals(document, env.reduced);
  quizPage(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
  const result = document.querySelector<HTMLElement>('[data-result]');
  const link = document.querySelector<HTMLAnchorElement>('[data-r-link]');
  const frame = document.querySelector<HTMLElement>('[data-swarm-result]');
  const raw = document.getElementById('qz-data');
  if (!result || !link || !frame || !raw) return;
  const roster = (JSON.parse(raw.textContent || '{}').roster ?? []) as Entry[];
  const img = frame.querySelector('img')!;
  const sound = Sound.get();

  // the bars that cover the print until the result is opened
  const bars = [0.18, 0.36, 0.54, 0.72].map((top, i) => {
    const b = document.createElement('i');
    b.className = 'qz-bar'; b.setAttribute('aria-hidden', 'true');
    b.style.top = `${top * 100}%`; b.style.width = `${[92, 76, 88, 64][i]}%`;
    frame.append(b);
    return b;
  });

  let shownFor = '';
  const open = () => {
    if (result.hidden) { shownFor = ''; return; }
    const i = roster.findIndex((r) => link.href.endsWith(r.href) || link.getAttribute('href') === r.href);
    if (i < 0 || roster[i].slug === shownFor) return;
    shownFor = roster[i].slug;
    if (env.reduced) { gsap.set(bars, { scaleX: 0 }); playSignature(sound, shownFor); return; }
    const slug = shownFor;
    gsap.timeline()
      .set(bars, { scaleX: 1 })
      .set(img, { scale: 1.14, filter: 'brightness(0.35)' })
      .to(bars, { scaleX: 0, duration: 0.3, ease: 'power3.in', stagger: { each: 0.12, onStart: () => tear(sound, undefined, 0.18) } }, 0.35)
      .to(img, { filter: 'brightness(1)', duration: 0.8, ease: 'power2.out' }, 0.6)
      .to(img, { scale: 1, duration: 2.6, ease: 'power3.out' }, 0.6)
      .call(() => { stamp(sound); playSignature(sound, slug); }, [], 1.05);
  };
  new MutationObserver(open).observe(result, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(open).observe(link, { attributes: true, attributeFilter: ['href'] });
  open();
}
