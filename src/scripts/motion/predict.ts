/**
 * Prediction board. Pick one answer per question, lock in (Turnstile), and the worker keeps
 * the set under a random id stored in this browser; locking again before the seal replaces
 * it. Once locked in, each option shows the fan split. A live countdown runs to the seal,
 * after which the board is read-only. Everything here is fan prediction and says so.
 */
import { gsap } from './grammar';
import { humanToken, dropWidget } from './turnstile';

type Opts = { ease: string; pace: number; reduced: boolean };
type Q = { id: string; text: string; options: { id: string; label: string }[] };
type Split = { total: number; q: Record<string, Record<string, number>> };

const KEY = 'dd-predictions';
const load = (): { pid?: string; picks: Record<string, string>; locked?: boolean } => { try { return JSON.parse(localStorage.getItem(KEY) || '') || { picks: {} }; } catch { return { picks: {} }; } };
const save = (v: object) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export function predictionBoard(root: ParentNode, o: Opts): () => void {
  const page = root.querySelector<HTMLElement>('[data-predict]');
  const raw = document.getElementById('pr-data');
  if (!page || !raw) return () => {};
  const { seal, questions } = JSON.parse(raw.textContent || '{}') as { seal: string; questions: Q[] };
  const api = (page.dataset.api || '').replace(/\/$/, ''), sitekey = page.dataset.sitekey || '';
  const enabled = !!(api && sitekey);
  const q$ = (s: string) => page.querySelector<HTMLElement>(s)!;
  const status = q$('[data-status]'), lock = q$('[data-lock]') as HTMLButtonElement, copy = q$('[data-copy]') as HTMLButtonElement;
  const tsBox = q$('[data-ts]'), stamp = q$('[data-stamp]'), count = q$('[data-seal-count]');
  const sealAt = Date.parse(seal);
  const offs: (() => void)[] = [];
  const on = (t: EventTarget, ev: string, fn: (e: Event) => void) => { t.addEventListener(ev, fn); offs.push(() => t.removeEventListener(ev, fn)); };
  let state = load(), busy = false;
  const sealed = () => Date.now() >= sealAt;

  q$('[data-seal-at]').textContent = `on ${new Date(sealAt).toLocaleString([], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} your time, the first moment 18 December begins anywhere on Earth`;

  const paint = () => {
    for (const q of questions) page.querySelectorAll<HTMLButtonElement>(`[data-q="${q.id}"] [data-opt]`).forEach((b) => b.setAttribute('aria-checked', String(state.picks[q.id] === b.dataset.opt)));
    const n = questions.filter((q) => state.picks[q.id]).length;
    q$('[data-answered]').textContent = String(n);
    lock.disabled = !enabled || sealed() || n < questions.length || busy;
    lock.textContent = state.locked ? 'Update my predictions' : 'Lock in my predictions';
    copy.hidden = !state.locked;
    if (!enabled) status.textContent = 'The prediction board opens soon.';
    else if (sealed()) status.textContent = state.locked ? 'The board is sealed. Your predictions are locked in.' : 'The board is sealed.';
    else if (!status.dataset.keep) status.textContent = state.locked ? 'Locked in. You can change your picks and update until the board seals.' : n < questions.length ? `Answer all ${questions.length} to lock in.` : 'Ready to lock in.';
    page.classList.toggle('sealed', sealed());
  };

  const showSplit = (s: Split) => {
    for (const q of questions) {
      const counts = s.q[q.id] || {}, sum = Object.values(counts).reduce((a, b) => a + b, 0);
      page.querySelectorAll<HTMLButtonElement>(`[data-q="${q.id}"] [data-opt]`).forEach((b) => {
        const pct = sum ? Math.round(((counts[b.dataset.opt!] || 0) / sum) * 100) : 0;
        b.querySelector('.pr-o-pct')!.textContent = `${pct}%`;
        const bar = b.querySelector<HTMLElement>('.pr-o-bar i')!;
        if (o.reduced) bar.style.transform = `scaleX(${pct / 100})`;
        else gsap.to(bar, { scaleX: pct / 100, duration: 1, ease: 'power3.out' });
      });
    }
  };

  const fetchSplit = async () => {
    try { const r = await fetch(`${api}/predict/split`); if (r.ok) showSplit(await r.json()); } catch { /* split is a bonus */ }
  };

  const tickSeal = () => {
    const ms = sealAt - Date.now();
    if (ms <= 0) { count.textContent = 'Sealed'; paint(); return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    count.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };
  tickSeal();
  const timer = window.setInterval(tickSeal, 1000);
  offs.push(() => clearInterval(timer));

  page.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) => on(b, 'click', () => {
    if (sealed()) return;
    const q = b.closest<HTMLElement>('[data-q]')!.dataset.q!;
    state.picks[q] = b.dataset.opt!;
    save(state);
    delete status.dataset.keep;
    if (!o.reduced) gsap.fromTo(b, { scale: 0.94 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
    paint();
    // the v2 particle tree grows a branch for every answered question
    document.dispatchEvent(new CustomEvent('dd:picks', { detail: { picks: { ...state.picks }, q } }));
  }));

  on(lock, 'click', async () => {
    if (lock.disabled) return;
    busy = true; paint(); status.dataset.keep = '1'; status.textContent = 'Checking you are human…';
    try {
      const token = await humanToken(tsBox, sitekey, 'predict');
      status.textContent = 'Locking in…';
      const r = await fetch(`${api}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid: state.pid, picks: state.picks, token }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || String(r.status));
      state = { ...state, pid: j.pid, locked: true }; save(state);
      status.textContent = 'Locked in. Here is how fans are calling it so far.';
      document.dispatchEvent(new CustomEvent('dd:locked'));
      showSplit(j);
      if (!o.reduced) gsap.timeline().set(stamp, { opacity: 0, scale: 3, rotate: -12, xPercent: -50, yPercent: -50 })
        .to(stamp, { opacity: 1, scale: 1, duration: 0.35, ease: 'power4.in' })
        .to(stamp, { opacity: 0, duration: 0.5, delay: 0.9 });
    } catch (e) {
      const m = (e as Error).message;
      status.textContent = m === 'bot check' || m === 'bot check failed' ? 'The bot check did not pass. Please try again.'
        : m === 'sealed' ? 'The board has sealed.' : m.startsWith('too many') ? 'Too many new prediction sets from this browser today. Try again tomorrow.'
        : 'The board is unavailable right now. Please try again later.';
    } finally { busy = false; paint(); }
  });

  on(copy, 'click', async () => {
    const text = ['My Avengers: Doomsday predictions (fan predictions, not facts):', ...questions.map((q, i) => `${i + 1}. ${q.text} ${q.options.find((x) => x.id === state.picks[q.id])?.label ?? '-'}`), location.href].join('\n');
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; setTimeout(() => (copy.textContent = 'Copy my predictions'), 1800); } catch { /* blocked */ }
  });

  paint();
  document.dispatchEvent(new CustomEvent('dd:picks', { detail: { picks: { ...state.picks }, q: null } }));
  if (enabled && (state.locked || sealed())) fetchSplit();
  return () => { offs.forEach((f) => f()); dropWidget(tsBox); };
}
