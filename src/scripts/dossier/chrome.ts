/**
 * Site-wide finish, design system v2. A custom cursor on fine pointers (a dot and a trailing ring that
 * swells over anything you can use and names it: Open, Read, Drag), and page changes that close like a
 * file drawer and open on the next page instead of a bare reload. Reduced motion keeps the system
 * cursor and plain navigation.
 */
import { gsap } from 'gsap';
import { EASE } from './tokens';

export function cursor(reduced: boolean) {
  if (reduced || !matchMedia('(pointer: fine)').matches) return;
  const el = document.createElement('div');
  el.className = 'cur';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="cur-dot"></i><i class="cur-ring"><b class="cur-lbl"></b></i>';
  document.body.append(el);
  document.documentElement.classList.add('has-cur');
  const dot = el.querySelector<HTMLElement>('.cur-dot')!, ring = el.querySelector<HTMLElement>('.cur-ring')!, lbl = el.querySelector<HTMLElement>('.cur-lbl')!;
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3.out' }), ry = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3.out' });
  let label = '';
  addEventListener('pointermove', (e) => {
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor], a, button, [role="radio"], summary, select, label');
    const next = t ? (t.dataset.cursor ?? (t.tagName === 'A' ? 'Open' : '')) : '';
    const active = !!t;
    if (next !== label || el.classList.contains('on') !== active) {
      label = next; lbl.textContent = next;
      el.classList.toggle('on', active); el.classList.toggle('lbl', !!next);
    }
  }, { passive: true });
  addEventListener('pointerdown', () => gsap.to(ring, { scale: 0.8, duration: 0.15, yoyo: true, repeat: 1 }));
  document.addEventListener('pointerleave', () => el.classList.add('out'));
  document.addEventListener('pointerenter', () => el.classList.remove('out'));
}

const KEY = 'dd-pt';
/** Page changes: the drawer closes over this page, the next page opens from under it. */
export function transitions(reduced: boolean) {
  const pt = document.querySelector<HTMLElement>('[data-pt]');
  if (!pt) return;
  // GSAP owns the cover's transform from here (it would otherwise read the CSS offset as extra pixels)
  gsap.set(pt, { y: 0, yPercent: document.documentElement.classList.contains('pt-in') ? 0 : 101 });
  // arriving: the cover was put up by the inline script; lift it
  if (document.documentElement.classList.contains('pt-in')) {
    gsap.fromTo(pt, { yPercent: 0 }, { yPercent: -101, duration: reduced ? 0 : 0.75, ease: EASE.file, delay: 0.05, onComplete: () => { document.documentElement.classList.remove('pt-in'); gsap.set(pt, { yPercent: 101 }); } });
  }
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
  if (reduced) return;
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.noPt !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    const name = pt.querySelector<HTMLElement>('[data-pt-name]');
    if (name) name.textContent = (a.dataset.ptLabel || a.querySelector('b')?.textContent || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode */ }
    gsap.fromTo(pt, { yPercent: 101 }, { yPercent: 0, duration: 0.6, ease: EASE.file, onComplete: () => { location.href = url.href; } });
  });
  // coming back through the browser's history restores the page as it was: make sure the cover is gone
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) { gsap.set(pt, { yPercent: 101 }); document.documentElement.classList.remove('pt-in'); } });
}
