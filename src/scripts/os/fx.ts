/**
 * DOOM-OS's small effects, shared by every page: text typed in by the terminal, text decrypted out of Latverian
 * glyphs, the reticle locking on, and a helper that starts something the first time it comes on screen. All of
 * them finish at once under reduced motion.
 */
import { Sound } from '../sound/engine';
import { tick, lock } from '../sound/os';

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const pad = (n: number) => String(n).padStart(2, '0');
export const sound = () => Sound.get();

/** Types text into an element, a relay tick every few characters. */
export async function typeIn(el: HTMLElement, text: string, cps = 90, ticks = true) {
  if (reduced()) { el.textContent = text; return; }
  el.classList.add('os-cursor');
  const step = Math.max(1, Math.round(text.length / 60));
  for (let i = 0; i <= text.length; i += step) {
    el.textContent = text.slice(0, i);
    if (ticks && i % (step * 4) === 0) tick(sound());
    await wait(1000 / cps * step);
  }
  el.textContent = text; el.classList.remove('os-cursor');
}

const GLYPHS = '░▒▓█▚▞▙▟ΔΞΣΨΩ#%&@$0123456789';
/** Text decrypted in place: every character starts as noise and settles left to right over `ms`. */
export function decryptIn(el: HTMLElement, text = el.textContent ?? '', ms = 900) {
  if (reduced()) { el.textContent = text; return Promise.resolve(); }
  return new Promise<void>((res) => {
    const s = performance.now();
    const frame = (now: number) => {
      const k = Math.min(1, (now - s) / ms), solid = Math.floor(text.length * k);
      let out = text.slice(0, solid);
      // only a short band of noise ahead of the settled text, so long paragraphs stay calm
      for (let i = solid; i < Math.min(text.length, solid + 14); i++) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (k < 1) requestAnimationFrame(frame); else { el.textContent = text; res(); }
    };
    requestAnimationFrame(frame);
  });
}

export const RETICLE = `<svg viewBox="0 0 120 120" aria-hidden="true"><g class="spin" fill="none" stroke="#3dff8f" stroke-width="1.2"><circle cx="60" cy="60" r="44" stroke-dasharray="10 8" /></g><g fill="none" stroke="#3dff8f" stroke-width="1.5"><path d="M60 4v18M60 98v18M4 60h18M98 60h18" /><circle cx="60" cy="60" r="3" fill="#3dff8f" /></g></svg>`;

/** Puts a reticle on a face: it flies in from wide and locks, with the lock tone. */
export function lockOn(ret: HTMLElement, at: { x: number; y: number }, onLocked?: () => void) {
  ret.hidden = false; ret.classList.remove('locked');
  ret.style.left = `${at.x}px`; ret.style.top = `${at.y}px`;
  const done = () => { ret.classList.add('locked'); lock(sound()); onLocked?.(); };
  if (reduced()) { done(); return; }
  ret.animate([{ transform: 'scale(2.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  setTimeout(done, 700);
}

/** Runs `fn` the first time `el` comes within a fifth of a screen of view. */
export function whenSeen(el: Element, fn: () => void, margin = '0px 0px -12% 0px') {
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}

/** Blocks marked [data-os-in] settle in as they come on screen (a class, so CSS does the moving). */
export function settleIn(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-os-in]').forEach((el) => {
    if (reduced()) { el.classList.add('in'); return; }
    whenSeen(el, () => el.classList.add('in'));
  });
}
