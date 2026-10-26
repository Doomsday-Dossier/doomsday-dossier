/**
 * Catch-up planner. Each ticked character adds their first and most recent appearance with
 * the Doomsday actor; titles shared by several characters count once, and a series counts
 * only the episodes those characters are credited in. Totals, hours a day until release and
 * the list update on every tap (list rows fly with Flip, numbers tick). Picks live in the URL
 * (?c=thor,loki); watched ticks stay on this device.
 */
import { gsap } from './grammar';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

type Opts = { ease: string; pace: number; reduced: boolean };
type Src = { label: string; url: string };
type Ep = { n: number; title: string; minutes: number; who: string[]; source: Src };
type Title = { title: string; year: number; cont: string; kind: 'film' | 'series'; minutes?: number; source?: Src; episodes?: Ep[] };
type Char = { slug: string; name: string; team: string; accent: string; first: string; latest: string | null };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const read = (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export function catchUp(root: ParentNode, o: Opts): () => void {
  const page = root.querySelector<HTMLElement>('[data-catchup]');
  const raw = document.getElementById('cu-data');
  if (!page || !raw) return () => {};
  const { roster, titles, release } = JSON.parse(raw.textContent || '{}') as { roster: Char[]; titles: Record<string, Title>; release: string };
  const by = new Map(roster.map((c) => [c.slug, c]));
  const list = page.querySelector<HTMLOListElement>('[data-list]')!;
  const el = (k: string) => page.querySelector<HTMLElement>(`[data-${k}]`)!;
  const faces = [...page.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const offs: (() => void)[] = [];
  const on = (t: EventTarget, ev: string, fn: (e: Event) => void) => { t.addEventListener(ev, fn); offs.push(() => t.removeEventListener(ev, fn)); };

  const fromUrl = new URLSearchParams(location.search).get('c');
  const picks = new Set((fromUrl ? fromUrl.split(',') : read('dd-catchup-picks')).filter((s) => by.has(s)));
  const watched = new Set(read('dd-catchup-watched'));
  const shown = { hours: 0, titles: 0, pace: 0 };

  const daysLeft = () => {
    const [y, m, d] = release.split('-').map(Number);
    return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000);
  };

  const plan = () => {
    const rows = new Map<string, { t: Title; why: { slug: string; role: 'first' | 'latest' }[]; eps: Set<number> }>();
    for (const slug of picks) {
      const c = by.get(slug)!;
      for (const [k, role] of [[c.first, 'first'], [c.latest, 'latest']] as const) {
        if (!k) continue;
        const t = titles[k];
        if (!rows.has(k)) rows.set(k, { t, why: [], eps: new Set() });
        const r = rows.get(k)!;
        r.why.push({ slug, role });
        if (t.kind === 'series') for (const e of t.episodes!) if (e.who.includes(slug)) r.eps.add(e.n);
      }
    }
    return [...rows.entries()].map(([k, r]) => ({
      k, ...r,
      minutes: r.t.kind === 'film' ? r.t.minutes! : r.t.episodes!.filter((e) => r.eps.has(e.n)).reduce((a, e) => a + e.minutes, 0),
    })).sort((a, b) => a.t.year - b.t.year || a.t.title.localeCompare(b.t.title));
  };

  const tick = (key: keyof typeof shown, node: HTMLElement, to: number, fmt: (n: number) => string) => {
    if (o.reduced) { node.textContent = fmt(to); shown[key] = to; return; }
    const n = { v: shown[key] };
    gsap.to(n, { v: to, duration: 0.7, ease: 'power2.out', overwrite: true, onUpdate: () => { node.textContent = fmt(n.v); } });
    shown[key] = to;
  };

  const render = () => {
    faces.forEach((f) => f.setAttribute('aria-pressed', String(picks.has(f.dataset.pick!))));
    const rows = plan();
    const total = rows.reduce((a, r) => a + r.minutes, 0);
    const left = rows.filter((r) => !watched.has(r.k)).reduce((a, r) => a + r.minutes, 0);
    const days = daysLeft();
    tick('hours', el('hours'), total / 60, (v) => v.toFixed(1));
    tick('titles', el('titles'), rows.length, (v) => String(Math.round(v)));
    tick('pace', el('per-day'), days > 0 ? left / 60 / days : 0, (v) => v.toFixed(1));
    el('progress').style.transform = `scaleX(${total ? (total - left) / total : 0})`;
    el('meta').textContent = !rows.length ? 'Pick at least one character.'
      : days > 0 ? `${hm(left)} still to watch across ${days} ${days === 1 ? 'day' : 'days'} until release. ${hm(total - left)} watched.`
      : 'Avengers: Doomsday is out. Watch these to catch up on the characters.';

    const state = o.reduced ? null : Flip.getState(list.querySelectorAll('li'));
    list.innerHTML = rows.map((r) => {
      const why = r.why.map((w) => { const c = by.get(w.slug)!; return `<b style="--a:${esc(c.accent)}">${esc(c.name)}</b> ${w.role === 'first' ? 'first appears' : 'latest appearance'}`; }).join(' &middot; ');
      const eps = r.t.kind === 'series' ? `<ul class="cu-eps">${r.t.episodes!.filter((e) => r.eps.has(e.n)).map((e) => `<li>Episode ${e.n}: ${esc(e.title)} (${e.minutes} min) <a href="${esc(e.source.url)}" target="_blank" rel="noopener">source</a></li>`).join('')}</ul>` : '';
      const src = r.t.kind === 'film' ? `<span class="cu-src">Runtime: <a href="${esc(r.t.source!.url)}" target="_blank" rel="noopener">${esc(r.t.source!.label)}</a></span>` : '';
      return `<li data-flip-id="${esc(r.k)}" class="${watched.has(r.k) ? 'done' : ''}">
        <input type="checkbox" data-watch="${esc(r.k)}" ${watched.has(r.k) ? 'checked' : ''} aria-label="Watched ${esc(r.t.title)}">
        <span><span class="cu-t">${esc(r.t.title)}</span><span class="cu-y">${r.t.year}</span><span class="cu-tag" data-cont="${esc(r.t.cont)}">${esc(r.t.cont)}</span></span>
        <span class="cu-min">${r.t.kind === 'series' ? `${r.eps.size} ep &middot; ` : ''}${hm(r.minutes)}</span>
        <p class="cu-why">${why}</p>${eps}${src}
      </li>`;
    }).join('');
    if (state) Flip.from(state, { duration: 0.5, ease: 'power3.inOut', targets: list.querySelectorAll('li'), onEnter: (els) => gsap.fromTo(els, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.03 }), onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.2 }) });

    write('dd-catchup-picks', [...picks]);
    const url = new URL(location.href);
    if (picks.size) url.searchParams.set('c', [...picks].join(',')); else url.searchParams.delete('c');
    history.replaceState(null, '', url);
  };

  faces.forEach((f) => on(f, 'click', () => { const s = f.dataset.pick!; picks.has(s) ? picks.delete(s) : picks.add(s); render(); }));
  on(el('all'), 'click', () => { roster.forEach((c) => picks.add(c.slug)); render(); });
  on(el('clear'), 'click', () => { picks.clear(); render(); });
  page.querySelectorAll<HTMLButtonElement>('[data-team]').forEach((b) => on(b, 'click', () => {
    const team = roster.filter((c) => c.team === b.dataset.team);
    const allIn = team.every((c) => picks.has(c.slug));
    team.forEach((c) => (allIn ? picks.delete(c.slug) : picks.add(c.slug)));
    render();
  }));
  on(list, 'change', (e) => {
    const box = e.target as HTMLInputElement;
    if (!box.dataset.watch) return;
    box.checked ? watched.add(box.dataset.watch) : watched.delete(box.dataset.watch);
    write('dd-catchup-watched', [...watched]);
    render();
  });
  const copyBtn = (key: string, text: () => string, done: string) => {
    const b = el(key) as HTMLButtonElement, label = b.textContent;
    on(b, 'click', async () => { try { await navigator.clipboard.writeText(text()); b.textContent = done; setTimeout(() => (b.textContent = label), 1800); } catch { /* clipboard blocked */ } });
  };
  copyBtn('copy', () => {
    const rows = plan();
    return [`My Avengers: Doomsday catch-up (${hm(rows.reduce((a, r) => a + r.minutes, 0))}):`, ...rows.map((r) => `${watched.has(r.k) ? '[x]' : '[ ]'} ${r.t.title} (${r.t.year})${r.t.kind === 'series' ? `, episodes ${[...r.eps].sort().join(', ')}` : ''}, ${hm(r.minutes)}`), location.href].join('\n');
  }, 'List copied');
  copyBtn('share', () => location.href, 'Link copied');
  render();
  return () => offs.forEach((f) => f());
}
