/**
 * The target register: team, verdict and order filters, His Majesty's verdict on each card, and Doom's will: as it
 * spreads (minutes on the throne, files examined, reign.ts) his mask settles over more of the targets' faces, in
 * green line (this site's own drawing, not a Marvel design).
 */
import { tick } from '../../sound/os';
import { reign, will, VERDICTS } from '../reign';
import { sound, reduced } from '../fx';

export const MASK = `<svg class="dmask" viewBox="0 0 40 50" aria-hidden="true"><path d="M6 5 Q20 0 34 5 L36 30 Q34 44 20 49 Q6 44 4 30 Z"/><path d="M20 9 L20 31" fill="none"/><rect class="slit" x="8.5" y="17" width="9.5" height="2.6"/><rect class="slit" x="22" y="17" width="9.5" height="2.6"/><path d="M13 36 L27 36 M14 39 L26 39 M15.5 42 L24.5 42" fill="none"/></svg>`;

/** Puts Doom's mask over the face in an image box (object-fit cover, positioned 50% 20%). */
export function maskFace(box: HTMLElement) {
  if (box.querySelector('.dmask')) return;
  const [hx, hy] = (box.dataset.head ?? '0.5,0.2').split(',').map(Number), [x0, , x1] = (box.dataset.bbox ?? '0,0,1,1').split(',').map(Number), a = Number(box.dataset.aspect || 0.75);
  const w = box.clientWidth, h = box.clientHeight, iw = 1000 * a, ih = 1000, sc = Math.max(w / iw, h / ih);
  const ox = (w - iw * sc) * 0.5, oy = (h - ih * sc) * 0.2;
  box.insertAdjacentHTML('beforeend', MASK);
  const m = box.querySelector<SVGSVGElement>('.dmask')!;
  const size = Math.max(22, Math.min(w * 0.5, (x1 - x0) * iw * sc * 0.3));
  m.style.width = `${size}px`; m.style.left = `${ox + hx * iw * sc}px`; m.style.top = `${oy + hy * ih * sc}px`;
  if (!reduced()) m.animate([{ opacity: 0, transform: 'translate(-50%, -38%) scale(1.6)' }, { opacity: 0.2 }, { opacity: 0.9 }, { opacity: 0.3 }, { opacity: 0.85, transform: 'translate(-50%, -38%)' }], { duration: 700, easing: 'steps(6, end)' });
}

export function register() {
  const root = document.querySelector<HTMLElement>('[data-register]'); if (!root) return;
  const cards = [...root.querySelectorAll<HTMLAnchorElement>('[data-card]')];
  const grid = root.querySelector<HTMLElement>('[data-grid]')!, count = root.querySelector<HTMLElement>('[data-count]')!;
  const s = sound();
  const st = { team: root.dataset.teamStart ?? '', verdict: '', sort: 'no' };
  const r = reign();

  // verdicts on the cards
  for (const c of cards) {
    const v = r.verdicts[c.dataset.slug!], el = c.querySelector<HTMLElement>('[data-v]')!;
    if (v) { el.textContent = VERDICTS[v].name; el.className = `c-v ${VERDICTS[v].cls}`; }
  }

  const apply = () => {
    let shown = 0;
    for (const c of cards) {
      const v = r.verdicts[c.dataset.slug!] ?? 'none';
      const ok = (!st.team || c.dataset.teamOf === st.team) && (!st.verdict || v === st.verdict);
      c.hidden = !ok; if (ok) shown++;
    }
    const key = st.sort, val = (c: HTMLElement) => Number(c.dataset[key === 'no' ? 'no' : key] ?? 0);
    const sorted = [...cards].sort((a, b) => (key === 'threat' || key === 'screens' ? val(b) - val(a) : val(a) - val(b)) || Number(a.dataset.no) - Number(b.dataset.no));
    sorted.forEach((c) => grid.append(c));
    count.textContent = shown ? `${shown} target${shown === 1 ? '' : 's'} shown` : 'No targets match. Judge more of them first.';
    if (!reduced()) cards.filter((c) => !c.hidden).forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: Math.min(i, 20) * 25, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  };
  const group = (sel: string, key: 'team' | 'verdict') => root.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll(sel).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    st[key] = (key === 'team' ? b.dataset.team : b.dataset.verdict) ?? ''; tick(s); apply();
  }));
  group('[data-team]', 'team'); group('[data-verdict]', 'verdict');
  root.querySelector<HTMLSelectElement>('[data-sort]')!.addEventListener('change', (e) => { st.sort = (e.target as HTMLSelectElement).value; tick(s); apply(); });
  apply();

  // Doom's will: the mask over as many faces as his will has reached, the same faces every time
  const n = Math.floor(will() * cards.length);
  const order = [...cards].sort((a, b) => ((Number(a.dataset.no) * 7) % 29) - ((Number(b.dataset.no) * 7) % 29)).filter((c) => c.dataset.slug !== 'victor-von-doom');
  const willed = order.slice(0, n);
  const place = () => willed.forEach((c) => {
    const box = c.querySelector<HTMLElement>('.c-img')!;
    box.querySelector('.dmask')?.remove();
    c.classList.add('willed');
    if (!c.querySelector('.willed-tag')) box.insertAdjacentHTML('beforeend', '<span class="willed-tag">Doom\'s will</span>');
    maskFace(box);
  });
  requestAnimationFrame(place);
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(place, 200); });
}
