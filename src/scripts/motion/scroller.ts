/**
 * The page's smooth scroller (Lenis), shared with motion code that needs to scroll.
 * Scroll through it rather than window.scrollTo or ScrollTrigger's snap: those fight
 * Lenis and stall the page for a second when they meet.
 */
import type Lenis from 'lenis';

let lenis: Lenis | null = null;
export const setScroller = (l: Lenis | null) => { lenis = l; };

export function glideTo(y: number, duration = 0.6) {
  if (lenis) lenis.scrollTo(y, { duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: y, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
