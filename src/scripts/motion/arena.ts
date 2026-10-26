/**
 * Fight arena fan vote. One vote per fight per day, sent to the arena worker
 * (workers/arena) with a Cloudflare Turnstile token; the split appears after voting
 * or on request. Votes are fans' opinions and the panel says so. Without a configured
 * API the panel says voting opens soon instead of failing.
 */
import { gsap } from './grammar';

type Opts = { ease: string; pace: number; reduced: boolean };
type Side = { slug: string; name: string; accent: string };
type Tally = { a: string; b: string; votesA: number; votesB: number; total: number; already?: boolean };
declare global { interface Window { turnstile?: any } }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const day = () => new Date().toISOString().slice(0, 10);
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const STORE = 'dd-arena-votes';
const remembered = (): Record<string, { day: string; pick: string }> => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
const remember = (k: string, pick: string) => {
  try { const m = remembered(); for (const x of Object.keys(m)) if (m[x].day !== day()) delete m[x]; m[k] = { day: day(), pick }; localStorage.setItem(STORE, JSON.stringify(m)); } catch { /* private mode: the server still dedupes */ }
};

let tsLoad: Promise<void> | null = null;
const loadTurnstile = () => tsLoad ??= new Promise<void>((res, rej) => {
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true; s.onload = () => res(); s.onerror = () => { tsLoad = null; rej(new Error('turnstile')); };
  document.head.append(s);
});

export function arenaVote(panel: HTMLElement | null, o: Opts) {
  if (!panel) return { update: (_a: Side, _b: Side) => {}, destroy: () => {} };
  const api = (panel.dataset.api || '').replace(/\/$/, '');
  const sitekey = panel.dataset.sitekey || '';
  const btns = { a: panel.querySelector<HTMLButtonElement>('[data-v="a"]')!, b: panel.querySelector<HTMLButtonElement>('[data-v="b"]')! };
  const result = panel.querySelector<HTMLElement>('[data-result]')!;
  const status = panel.querySelector<HTMLElement>('[data-status]')!;
  const peek = panel.querySelector<HTMLButtonElement>('[data-peek]')!;
  const tsBox = panel.querySelector<HTMLElement>('[data-ts]')!;
  let A: Side | null = null, B: Side | null = null, widget: string | null = null, busy = false, gen = 0;

  const say = (t: string) => { status.textContent = t; };
  const enabled = !!(api && sitekey);
  panel.classList.toggle('vote-off', !enabled);

  const show = (t: Tally, mine?: string) => {
    if (!A || !B) return;
    const pa = t.total ? Math.round((t.votesA / t.total) * 100) : 50, pb = 100 - pa;
    result.hidden = false;
    result.innerHTML = `
      <div class="split" style="--ca:${esc(A.accent)};--cb:${esc(B.accent)}"><i class="sa"></i><i class="sb"></i></div>
      <p class="split-nums"><span><b>${esc(A.name)}</b> ${t.total ? `${pa}%` : '&ndash;'}${mine === A.slug ? ' &middot; your pick' : ''}</span><span>${t.total ? `${pb}%` : '&ndash;'} <b>${esc(B.name)}</b>${mine === B.slug ? ' &middot; your pick' : ''}</span></p>
      <p class="split-total">${t.total ? `${t.total.toLocaleString()} fan ${t.total === 1 ? 'vote' : 'votes'}` : 'No fan votes on this fight yet'}. Fan opinion, not a fact.</p>`;
    const sa = result.querySelector<HTMLElement>('.sa')!, sb = result.querySelector<HTMLElement>('.sb')!;
    if (o.reduced) { sa.style.transform = `scaleX(${pa / 100})`; sb.style.transform = `scaleX(${pb / 100})`; }
    else { gsap.fromTo(sa, { scaleX: 0 }, { scaleX: pa / 100, duration: 1, ease: 'power3.out' }); gsap.fromTo(sb, { scaleX: 0 }, { scaleX: pb / 100, duration: 1, ease: 'power3.out' }); }
  };

  const fetchResult = async (mine?: string) => {
    if (!enabled || !A || !B) return;
    const g = gen;
    try {
      const r = await fetch(`${api}/result?a=${encodeURIComponent(A.slug)}&b=${encodeURIComponent(B.slug)}`);
      if (!r.ok) throw new Error(String(r.status));
      const t = (await r.json()) as Tally;
      if (g === gen) show(t, mine);
    } catch { if (g === gen) say('The fan split could not be loaded. Try again in a moment.'); }
  };

  const token = async () => {
    await loadTurnstile();
    return new Promise<string>((res, rej) => {
      const ts = window.turnstile;
      if (widget) ts.remove(widget);
      widget = ts.render(tsBox, {
        sitekey, appearance: 'interaction-only', execution: 'render', action: 'arena-vote',
        callback: (t: string) => res(t), 'error-callback': () => rej(new Error('bot check')), 'timeout-callback': () => rej(new Error('bot check')),
      });
    });
  };

  const vote = async (side: 'a' | 'b') => {
    if (!enabled || busy || !A || !B) return;
    busy = true; panel.classList.add('voting'); say('Checking you are human…');
    const pick = side === 'a' ? A.slug : B.slug, g = gen;
    try {
      const t = await token();
      say('Counting your vote…');
      const r = await fetch(`${api}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: A.slug, b: B.slug, pick, token: t }) });
      if (r.status === 403) throw new Error('bot check');
      if (!r.ok) throw new Error(String(r.status));
      const res = (await r.json()) as Tally;
      remember(pairKey(A.slug, B.slug), pick);
      // the most-wanted board listens for this and refreshes
      document.dispatchEvent(new CustomEvent('dd:voted', { detail: { a: A.slug, b: B.slug } }));
      if (g === gen) { panel.classList.add('voted'); say(res.already ? 'You already voted on this fight today. Here is the fan split.' : 'Vote counted. Here is the fan split.'); show(res, pick); }
    } catch (e) {
      if (g === gen) say((e as Error).message === 'bot check' ? 'The bot check did not pass. Please try again.' : 'Voting is unavailable right now. Please try again later.');
    } finally { busy = false; panel.classList.remove('voting'); }
  };

  const onA = () => vote('a'), onB = () => vote('b'), onPeek = () => { say(''); fetchResult(remembered()[A && B ? pairKey(A.slug, B.slug) : '']?.pick); };
  btns.a.addEventListener('click', onA); btns.b.addEventListener('click', onB); peek.addEventListener('click', onPeek);

  return {
    update(a: Side, b: Side) {
      A = a; B = b; gen++;
      for (const [k, s] of [['a', a], ['b', b]] as const) { btns[k].textContent = s.name; btns[k].style.setProperty('--a', s.accent); }
      result.hidden = true; result.innerHTML = ''; panel.classList.remove('voted');
      if (!enabled) { say('Fan voting opens soon.'); return; }
      const mine = remembered()[pairKey(a.slug, b.slug)];
      if (mine && mine.day === day()) { panel.classList.add('voted'); say('You voted on this fight today. Here is the fan split.'); fetchResult(mine.pick); }
      else say('');
    },
    destroy() { btns.a.removeEventListener('click', onA); btns.b.removeEventListener('click', onB); peek.removeEventListener('click', onPeek); if (widget) window.turnstile?.remove(widget); },
  };
}
