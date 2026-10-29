/**
 * Module 06, the briefing schedule. The planner itself is the v1 logic (motion/catchup.ts: picks, the smallest watch
 * list, total hours, hours a day to release, ?c= in the URL, watched ticks on this device); this screen adds the
 * machine around it: a relay tick on every mark, a stamp when an order is carried out, the daily pace read onto the
 * gauge, the count of marked targets, and the schedule's title decrypted in.
 */
import { catchUp } from '../../motion/catchup';
import { onLeave } from '../../page-scope';
import { tick } from '../../sound/os';
import { stamp } from '../../sound/actions';
import { decryptIn, reduced, sound, whenSeen } from '../fx';

const FULL = 3; // hours a day at which the gauge reads full
const BANDS = [{ at: 2, name: 'Punishing', cls: 'red' }, { at: 1, name: 'Demanding', cls: 'amber' }, { at: 0.001, name: 'Light duty', cls: 'hi' }, { at: -1, name: 'Standing by', cls: '' }];

export function briefing() {
  const root = document.querySelector<HTMLElement>('[data-catchup]'); if (!root) return;
  const s = sound();

  // the planner writes ?c= with history.replaceState(null, ...); the client router ignores a null state on Back and stops
  // saving scroll, so while this screen is up a null state keeps the router's own
  const own = History.prototype.replaceState;
  history.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) { return own.call(this, data ?? history.state, unused, url); };
  onLeave(() => { delete (history as { replaceState?: unknown }).replaceState; });

  // the daily pace onto the gauge: the planner ticks the number, the needle follows it frame by frame
  const pace = root.querySelector<HTMLElement>('[data-per-day]')!, gauge = root.querySelector<HTMLElement>('[data-gauge]')!;
  const arc = gauge.querySelector<SVGPathElement>('[data-arc]')!, needle = gauge.querySelector<SVGGElement>('[data-needle]')!, band = gauge.querySelector<HTMLElement>('[data-band]')!;
  const read = () => {
    const v = parseFloat(pace.textContent || '0') || 0, k = Math.min(1, Math.max(0, v / FULL)), b = BANDS.find((x) => v >= x.at)!;
    arc.style.strokeDashoffset = String(100 - k * 100);
    needle.setAttribute('transform', `rotate(${(k * 180 - 90).toFixed(2)} 100 100)`);
    if (band.textContent !== b.name) { band.textContent = b.name; gauge.dataset.lv = b.cls; }
  };
  const mo = new MutationObserver(read);
  mo.observe(pace, { childList: true, characterData: true, subtree: true });
  onLeave(() => mo.disconnect());

  const marked = root.querySelector<HTMLElement>('[data-marked]')!;
  // with nothing marked the orders show one instruction and one button, not a gauge reading zero
  const count = () => { const n = root.querySelectorAll('[data-pick][aria-pressed="true"]').length; marked.textContent = String(n).padStart(2, '0'); root.classList.toggle('bs-none', n === 0); };
  root.querySelector('[data-brief-all]')?.addEventListener('click', () => { root.querySelector<HTMLButtonElement>('[data-all]')?.click(); });

  onLeave(catchUp(document, { ease: 'power3.out', pace: 1, reduced: reduced() }));
  read(); count();

  // the planner's own listeners sit on the buttons and the list, so these on the root run after it has re-rendered
  root.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-pick], [data-all], [data-clear], [data-team], [data-copy], [data-share]')) return;
    tick(s); count();
  });
  root.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement, k = box.dataset?.watch;
    if (!k) return;
    if (!box.checked) { tick(s); return; }
    stamp(s);
    if (!reduced()) [...root.querySelectorAll<HTMLElement>('[data-list] > li')].find((li) => li.dataset.flipId === k)?.classList.add('just');
  });

  const title = root.querySelector<HTMLElement>('[data-decrypt]');
  if (title) onLeave(whenSeen(title, () => decryptIn(title, title.textContent ?? '', 800), '0px'));
}
