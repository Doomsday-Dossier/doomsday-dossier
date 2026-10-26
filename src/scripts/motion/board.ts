/**
 * Most-wanted fights: the matchups fans have voted on most, from the arena worker's /top.
 * Refreshes after a vote (the arena dispatches `dd:voted`) and every 30 s while the board is
 * on screen and the tab is visible. Rows slide to their new rank (Flip) and counts tick up.
 * Every number is a fan vote and is labelled that way.
 */
import { gsap } from './grammar';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

type Opts = { ease: string; pace: number; reduced: boolean };
type Fight = { a: string; b: string; votesA: number; votesB: number; total: number };
type Char = { slug: string; name: string; accent: string; photo: { small: string; focus: string } | null };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function mostWanted(root: ParentNode, all: Char[], open: (a: string, b: string) => void, o: Opts): () => void {
  const board = root.querySelector<HTMLElement>('[data-board]');
  const api = (root.querySelector<HTMLElement>('[data-vote]')?.dataset.api || '').replace(/\/$/, '');
  if (!board) return () => {};
  const list = board.querySelector<HTMLOListElement>('[data-board-list]')!;
  const empty = board.querySelector<HTMLElement>('[data-board-empty]')!;
  const stamp = board.querySelector<HTMLElement>('[data-board-stamp]')!;
  if (!api) { board.hidden = true; return () => {}; }
  const by = new Map(all.map((c) => [c.slug, c]));
  const shown = new Map<string, number>(); // pair -> total last drawn, for the count-up
  let timer = 0, visible = false, busy = false;

  const face = (c: Char) => c.photo
    ? `<img src="${esc(c.photo.small)}" alt="" width="44" height="44" loading="lazy" decoding="async" style="object-position:${esc(c.photo.focus)}">`
    : `<span>${esc(c.name.slice(0, 1))}</span>`;

  const row = (f: Fight, i: number) => {
    const A = by.get(f.a), B = by.get(f.b);
    if (!A || !B) return '';
    const pa = f.total ? Math.round((f.votesA / f.total) * 100) : 50;
    return `<li class="lb-row" data-pair="${esc(f.a)}|${esc(f.b)}" data-flip-id="${esc(f.a)}|${esc(f.b)}">
      <button type="button" class="lb-open" data-a="${esc(f.a)}" data-b="${esc(f.b)}" style="--ca:${esc(A.accent)};--cb:${esc(B.accent)}" aria-label="Open ${esc(A.name)} versus ${esc(B.name)}: ${f.total} fan votes, ${pa} to ${100 - pa}">
        <span class="lb-rank">${String(i + 1).padStart(2, '0')}</span>
        <span class="lb-faces">${face(A)}${face(B)}</span>
        <span class="lb-names"><b>${esc(A.name)}</b> <i>vs</i> <b>${esc(B.name)}</b></span>
        <span class="lb-split"><i class="sa" style="transform:scaleX(${pa / 100})"></i><i class="sb" style="transform:scaleX(${(100 - pa) / 100})"></i></span>
        <span class="lb-pct">${pa}% &middot; ${100 - pa}%</span>
        <span class="lb-total"><b data-count="${f.total}">${shown.get(`${f.a}|${f.b}`) ?? 0}</b> ${f.total === 1 ? 'vote' : 'votes'}</span>
      </button>
    </li>`;
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await fetch(`${api}/top?limit=10`, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const { fights } = (await r.json()) as { fights: Fight[] };
      const state = o.reduced ? null : Flip.getState(list.querySelectorAll('.lb-row'));
      list.innerHTML = fights.map(row).join('');
      empty.hidden = fights.length > 0;
      stamp.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      if (state) Flip.from(state, { duration: 0.7, ease: 'power3.inOut', targets: list.querySelectorAll('.lb-row'), onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04 }) });
      // counts tick up from what was last on screen
      list.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const to = Number(el.dataset.count), key = el.closest<HTMLElement>('.lb-row')!.dataset.pair!, from = shown.get(key) ?? 0;
        shown.set(key, to);
        if (o.reduced || from === to) { el.textContent = to.toLocaleString(); return; }
        const n = { v: from };
        gsap.to(n, { v: to, duration: 1.2, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(n.v).toLocaleString(); } });
      });
    } catch {
      stamp.textContent = 'The leaderboard could not be loaded. It will try again shortly.';
    } finally { busy = false; }
  };

  const schedule = () => { clearInterval(timer); if (visible && document.visibilityState === 'visible') timer = window.setInterval(load, 30000); };
  const io = new IntersectionObserver((es) => { const was = visible; visible = es.some((e) => e.isIntersecting); if (visible && !was) load(); schedule(); }, { rootMargin: '200px' });
  io.observe(board);
  const onVis = () => schedule();
  const onVoted = () => load();
  const onClick = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.lb-open');
    if (b) open(b.dataset.a!, b.dataset.b!);
  };
  document.addEventListener('visibilitychange', onVis);
  document.addEventListener('dd:voted', onVoted);
  list.addEventListener('click', onClick);
  return () => { io.disconnect(); clearInterval(timer); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('dd:voted', onVoted); list.removeEventListener('click', onClick); };
}
