/**
 * Fight arena (/versus/). Two characters' cards slam together; each card cycles through
 * its documented feats with their sources; fans vote (fan opinion, labelled). Two characters face off: photos, the official Handbook power grids drawn as
 * one glowing radar (shapes morph when a side changes), mirrored stat bars, abilities,
 * sourced feats and connections. The pair lives in the URL (?a=thor&b=magneto) so any
 * matchup can be shared. Stats are the comics'; the page never declares a winner.
 */
import { gsap } from './grammar';
import { arenaVote } from './arena';
import { mostWanted } from './board';
import { glideTo } from './scroller';

type Opts = { ease: string; pace: number; reduced: boolean };
type Src = { label: string; url: string };
type Char = {
  slug: string; name: string; alias: string; actor: string; team: string; teamId: string; accent: string; font: string; weight: string | number; url: string;
  photo: { small: string; big: string; focus: string } | null;
  grid: Record<string, number> | null; gridSource: Src | null; gridNote: string | null; powerType: string | null;
  origins: { key: string; detail: string; sources: Src[] }[]; abilities: { name: string; detail: string; sources: Src[] }[];
  feats: { medium: string; text: string; where: string; sources: Src[] }[]; screens: { k: string; title: string; year: number }[]; ready: boolean;
};

const STATS: [string, string][] = [['intelligence', 'Intellect'], ['strength', 'Strength'], ['speed', 'Speed'], ['durability', 'Durability'], ['energyProjection', 'Energy'], ['fightingSkills', 'Fighting']];
const TYPES: Record<string, string> = { tech: 'Tech', mystic: 'Mystic', mutant: 'Mutant', cosmic: 'Cosmic', serum: 'Serums and experiments', none: 'No powers' };
const ORIGINS: Record<string, string> = { serum: 'a serum', 'cosmic-rays': 'cosmic rays', 'pym-particles': 'Pym Particles', 'mutant-gene': 'the mutant gene', asgardian: 'Asgardian birth', mystic: 'magic', tech: 'technology', training: 'training alone', atlantean: 'Atlantean or Talokanil biology', 'heart-shaped-herb': 'the heart-shaped herb', quantum: 'quantum energy', other: 'other means' };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const R = 100;
const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / 6; return [Math.cos(a) * R * v, Math.sin(a) * R * v]; };
const poly = (g: Record<string, number> | null) => STATS.map(([k], i) => pt(i, g ? g[k] / 7 : 0).map((n) => n.toFixed(1)).join(',')).join(' ');

export function versusPage(root: ParentNode, o: Opts): () => void {
  const page = root.querySelector<HTMLElement>('[data-versus]');
  const raw = document.getElementById('vs-data');
  if (!page || !raw) return () => {};
  const all: Char[] = JSON.parse(raw.textContent || '[]');
  const by = new Map(all.map((c) => [c.slug, c]));
  const sides = { a: page.querySelector<HTMLElement>('[data-side="a"]')!, b: page.querySelector<HTMLElement>('[data-side="b"]')! };
  const body = page.querySelector<HTMLElement>('[data-body]')!;
  const svg = page.querySelector<SVGSVGElement>('[data-radar]')!;
  const slots = [...page.querySelectorAll<HTMLButtonElement>('[data-slot]')];
  const picks = [...page.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const offs: (() => void)[] = [];
  const stage = page.querySelector<HTMLElement>('.vs-stage')!;
  const flash = page.querySelector<HTMLElement>('.vs-flash')!, shock = page.querySelector<HTMLElement>('.vs-shock')!;
  const arena = arenaVote(page.querySelector<HTMLElement>('[data-vote]'), o);
  offs.push(() => arena.destroy());
  const on = (el: EventTarget, ev: string, fn: (e: Event) => void) => { el.addEventListener(ev, fn); offs.push(() => el.removeEventListener(ev, fn)); };

  // radar scaffolding: rings at 1 to 7, six axes, labels
  const NS = 'http://www.w3.org/2000/svg';
  const rings = svg.querySelector('.rings')!, axes = svg.querySelector('.axes')!, labels = svg.querySelector('.labels')!;
  for (let r = 1; r <= 7; r++) { const p = document.createElementNS(NS, 'polygon'); p.setAttribute('points', STATS.map((_, i) => pt(i, r / 7).join(',')).join(' ')); rings.append(p); }
  STATS.forEach(([, label], i) => {
    const [x, y] = pt(i, 1); const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', '0'); l.setAttribute('y1', '0'); l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y)); axes.append(l);
    const [tx, ty] = pt(i, 1.17); const t = document.createElementNS(NS, 'text'); t.setAttribute('x', tx.toFixed(1)); t.setAttribute('y', (ty + 3).toFixed(1)); t.setAttribute('text-anchor', Math.abs(tx) < 5 ? 'middle' : tx > 0 ? 'start' : 'end'); t.textContent = label; labels.append(t);
  });
  const shapes = { a: svg.querySelector<SVGGElement>('.shape-a')!, b: svg.querySelector<SVGGElement>('.shape-b')! };
  (['a', 'b'] as const).forEach((s) => shapes[s].querySelectorAll('polygon').forEach((p) => p.setAttribute('points', poly(null))));

  const params = new URLSearchParams(location.search);
  const state = { a: by.has(params.get('a') || '') ? params.get('a')! : 'victor-von-doom', b: by.has(params.get('b') || '') ? params.get('b')! : 'steve-rogers', slot: 'a' as 'a' | 'b' };
  if (state.a === state.b) state.b = all.find((c) => c.slug !== state.a)!.slug;

  const sideHtml = (c: Char) => {
    const lw = Math.max(...c.name.split(/\s+/).map((w) => w.length));
    return `${c.photo ? `<img src="${esc(c.photo.big)}" alt="${esc(c.name)}" decoding="async" style="object-position:${esc(c.photo.focus)}">` : ''}
      ${c.feats.length ? `<div class="vs-feat" style="--a:${esc(c.accent)}" aria-live="off">${c.feats.map((f, i) => `<p class="feat${i ? '' : ' on'}"><span class="where ${f.medium === 'screen' ? 'screen' : ''}">${f.medium === 'screen' ? 'On screen' : 'Comics'}: ${esc(f.where)}</span> ${esc(f.text)} <a href="${esc(f.sources[0]?.url)}" target="_blank" rel="noopener" aria-label="Source: ${esc(f.sources[0]?.label)}">source</a></p>`).join('')}</div>` : ''}
      <div class="vs-info" style="--a:${esc(c.accent)};--f:${esc(c.font)};--w:${esc(c.weight)};--lw:${lw}">
        <p class="vs-alias">${esc(c.alias)}</p>
        <h2 class="vs-name">${esc(c.name)}</h2>
        <p class="vs-meta">${esc(c.actor)} &middot; ${esc(c.team)}</p>
        ${c.powerType ? `<span class="vs-type">${esc(TYPES[c.powerType] || c.powerType)}</span>` : ''}
        <a class="vs-open" href="${esc(c.url)}">Open dossier &rarr;</a>
      </div>`;
  };

  // decode a portrait off the main thread before it is shown (started on hover, awaited on click)
  const ready = new Map<string, Promise<void>>();
  const preload = (slug: string) => {
    const c = by.get(slug);
    if (!c?.photo) return Promise.resolve();
    if (!ready.has(slug)) { const im = new Image(); im.src = c.photo.big; ready.set(slug, im.decode().catch(() => {})); }
    return ready.get(slug)!;
  };
  const soon = (slug: string) => Promise.race([preload(slug), new Promise<void>((r) => setTimeout(r, 300))]);

  // the slam: changed cards fly in from their side and hit the middle; shockwave, flash, shake, recoil
  const slam = (changed: ('a' | 'b')[]) => {
    const dir = (el: Element) => ((el as HTMLElement).dataset.side === 'a' ? -1 : 1);
    const movers = changed.map((s) => sides[s]);
    gsap.killTweensOf([...movers, stage, flash, shock]);
    gsap.timeline()
      .fromTo(movers, { x: (_i: number, el: Element) => dir(el) * innerWidth * 0.55, rotation: (_i: number, el: Element) => dir(el) * 9, opacity: 0 },
        { x: (_i: number, el: Element) => -dir(el) * Math.min(40, innerWidth * 0.03), rotation: 0, opacity: 1, duration: 0.42, ease: 'power4.in' })
      .addLabel('hit')
      .fromTo(shock, { scale: 0.2, opacity: 0.9 }, { scale: 3, opacity: 0, duration: 0.75, ease: 'power2.out' }, 'hit')
      .fromTo(flash, { opacity: 0.5 }, { opacity: 0, duration: 0.6, ease: 'power2.out' }, 'hit')
      .to(stage, { keyframes: { x: [-12, 10, -7, 4, -2, 0] }, duration: 0.42, ease: 'none' }, 'hit')
      .to(movers, { x: 0, duration: 0.7, ease: 'back.out(2.2)' }, 'hit+=0.04')
      .fromTo('.vs-badge', { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(3)' }, 'hit');
  };

  // each card shows one documented feat at a time, cycling every few seconds
  let featTimer = 0;
  const cycleFeats = () => {
    clearInterval(featTimer);
    if (o.reduced) return;
    featTimer = window.setInterval(() => {
      for (const s of ['a', 'b'] as const) {
        const items = [...sides[s].querySelectorAll<HTMLElement>('.feat')];
        if (items.length < 2) continue;
        const i = items.findIndex((x) => x.classList.contains('on'));
        items[i].classList.remove('on'); items[(i + 1) % items.length].classList.add('on');
      }
    }, 5200);
  };
  offs.push(() => clearInterval(featTimer));

  let bodyTimer = 0, first = true;
  offs.push(() => clearTimeout(bodyTimer));
  const render = (changed: ('a' | 'b')[]) => {
    const A = by.get(state.a)!, B = by.get(state.b)!;
    for (const s of changed) {
      const c = s === 'a' ? A : B;
      sides[s].style.setProperty('--a', c.accent);
      sides[s].innerHTML = sideHtml(c);
      if (!o.reduced) gsap.fromTo(sides[s].querySelector('.vs-info'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: 'power3.out' });
      shapes[s].querySelector<SVGPolygonElement>('.fill')!.style.fill = c.accent;
      shapes[s].querySelectorAll('polygon').forEach((p) => { p.style.stroke = c.accent; });
      const target = poly(c.grid);
      shapes[s].querySelectorAll('polygon').forEach((p) => {
        if (o.reduced) p.setAttribute('points', target);
        else gsap.to(p, { attr: { points: target }, duration: 0.9, ease: 'power3.inOut' });
      });
      gsap.to(shapes[s], { opacity: c.grid ? 1 : 0, duration: 0.4 });
    }
    if (!o.reduced && changed.length) slam(changed);
    arena.update({ slug: A.slug, name: A.name, accent: A.accent }, { slug: B.slug, name: B.name, accent: B.accent });
    // the v2 cloth posters follow the pair
    document.dispatchEvent(new CustomEvent('dd:pair', { detail: { a: A.slug, b: B.slug, changed } }));
    cycleFeats();

    // the comparison below the fold is rebuilt once the slam has played and the browser is idle,
    // so the click itself stays light (it used to cost one ~75 ms frame)
    const fillBody = () => {
      body.classList.remove('stale');
      // numbered sources, one list per side
      const lists: Record<'a' | 'b', Src[]> = { a: [], b: [] };
      const cite = (s: 'a' | 'b', srcs: Src[]) => srcs.map((x) => { let i = lists[s].findIndex((y) => y.url === x.url); if (i < 0) { lists[s].push(x); i = lists[s].length - 1; } return `<sup><a href="#vs-src-${s}">${s.toUpperCase()}${i + 1}</a></sup>`; }).join('');

      const statRows = STATS.map(([k, label]) => {
        const bar = (s: 'a' | 'b', c: Char) => c.grid ? `<div class="bar ${s}" style="--a:${esc(c.accent)}"><i data-v="${c.grid[k] / 7}"></i><b>${c.grid[k]}</b></div>` : `<div class="bar none">Not rated</div>`;
        return `<div class="stat">${bar('a', A)}<span class="stat-name">${label}</span>${bar('b', B)}</div>`;
      }).join('');
      const gridSrc = (s: 'a' | 'b', c: Char) => c.grid && c.gridSource ? `${esc(c.name)}: ${cite(s, [c.gridSource])}` : `${esc(c.name)}: not rated in the Handbook`;

      const col = (s: 'a' | 'b', c: Char, html: string) => `<div class="col" style="--a:${esc(c.accent)}"><h3>${esc(c.name)}</h3>${html}</div>`;
      const abil = (s: 'a' | 'b', c: Char) => c.ready ? `<ul>${c.abilities.map((x) => `<li><b>${esc(x.name)}</b>${cite(s, x.sources)}<p>${esc(x.detail)}</p></li>`).join('')}</ul>` : `<p class="pending">Research for this character is still being added.</p>`;
      const feats = (s: 'a' | 'b', c: Char) => c.ready ? `<ul>${c.feats.map((f) => `<li><span class="where ${f.medium === 'screen' ? 'screen' : ''}">${f.medium === 'screen' ? 'On screen' : 'Comics'}: ${esc(f.where)}</span>${cite(s, f.sources)}<p>${esc(f.text)}</p></li>`).join('')}</ul>` : `<p class="pending">Research for this character is still being added.</p>`;

      const shared = A.screens.filter((x) => B.screens.some((y) => y.k === x.k));
      const sharedOrigins = [...new Set(A.origins.map((x) => x.key))].filter((k) => B.origins.some((y) => y.key === k));
      const links = [
        shared.length ? `<li><b>${shared.length} shared ${shared.length === 1 ? 'title' : 'titles'} on screen:</b> ${shared.map((x) => `${esc(x.title)} (${x.year})`).join(', ')}.</li>` : `<li>They have not shared a live-action title yet.</li>`,
        A.teamId === B.teamId ? `<li><b>Same group on this site:</b> ${esc(A.team)}.</li>` : '',
        sharedOrigins.length ? `<li><b>Same source of power:</b> both got their abilities from ${sharedOrigins.map((k) => ORIGINS[k] || k).join(' and ')}.</li>` : '',
      ].join('');

      body.innerHTML = `
        <section><h2>Documented feats</h2><div class="cols">${col('a', A, feats('a', A))}${col('b', B, feats('b', B))}</div></section>
        <section><h2>Power grid</h2><div class="stats">${statRows}</div><p class="srcs">Official Marvel Handbook ratings, comics only. ${gridSrc('a', A)}. ${gridSrc('b', B)}.</p></section>
        <section><h2>Abilities</h2><div class="cols">${col('a', A, abil('a', A))}${col('b', B, abil('b', B))}</div></section>
        <section><h2>Connections</h2><ul class="links">${links}</ul></section>
        <section class="srcs"><h2>Sources</h2><div class="cols">
          <div id="vs-src-a"><h3>${esc(A.name)}</h3><ol>${lists.a.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`).join('')}</ol></div>
          <div id="vs-src-b"><h3>${esc(B.name)}</h3><ol>${lists.b.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`).join('')}</ol></div>
        </div></section>`;
      body.querySelectorAll<HTMLElement>('.bar i').forEach((i) => {
        const v = Number(i.dataset.v);
        if (o.reduced) i.style.transform = `scaleX(${v})`;
        else gsap.fromTo(i, { scaleX: 0 }, { scaleX: v, duration: 0.9, ease: 'power3.out', delay: 0.1 });
      });

    };
    clearTimeout(bodyTimer);
    if (first || o.reduced) fillBody();
    else { body.classList.add('stale'); bodyTimer = window.setTimeout(() => (window.requestIdleCallback || setTimeout)(fillBody), 1100); }
    first = false;

    picks.forEach((p) => { p.classList.toggle('is-a', p.dataset.pick === state.a); p.classList.toggle('is-b', p.dataset.pick === state.b); });
    const url = new URL(location.href); url.searchParams.set('a', state.a); url.searchParams.set('b', state.b);
    history.replaceState(null, '', url);
    document.title = `${A.name} vs ${B.name} | Arena | Doomsday Dossier`;
  };

  slots.forEach((b) => on(b, 'click', () => { state.slot = b.dataset.slot as 'a' | 'b'; slots.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  picks.forEach((b) => { on(b, 'pointerenter', () => preload(b.dataset.pick!)); on(b, 'focus', () => preload(b.dataset.pick!)); });
  picks.forEach((b) => on(b, 'click', async () => {
    const slug = b.dataset.pick!, other = state.slot === 'a' ? 'b' : 'a';
    await soon(slug);
    if (slug === state[state.slot]) return;
    if (slug === state[other]) { [state.a, state.b] = [state.b, state.a]; render(['a', 'b']); return; }
    state[state.slot] = slug; render([state.slot]);
    // after picking the left side, the next pick goes to the right
    if (state.slot === 'a') { state.slot = 'b'; slots.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.slot === 'b'))); }
  }));
  on(page.querySelector('[data-swap]')!, 'click', () => { [state.a, state.b] = [state.b, state.a]; render(['a', 'b']); });
  const share = page.querySelector<HTMLButtonElement>('[data-share]')!;
  on(share, 'click', async () => {
    const A = by.get(state.a)!, B = by.get(state.b)!;
    try {
      if (navigator.share && matchMedia('(hover: none)').matches) await navigator.share({ title: `${A.name} vs ${B.name}`, url: location.href });
      else { await navigator.clipboard.writeText(location.href); share.textContent = 'Link copied'; setTimeout(() => (share.textContent = 'Copy link'), 1800); }
    } catch { /* share cancelled */ }
  });
  render(['a', 'b']);
  // most-wanted fights: clicking a row loads that matchup and glides back up to the stage
  offs.push(mostWanted(page, all, (a, b) => {
    if (!by.has(a) || !by.has(b)) return;
    const changed = (['a', 'b'] as const).filter((s) => state[s] !== (s === 'a' ? a : b));
    state.a = a; state.b = b;
    glideTo(stage.getBoundingClientRect().top + scrollY - 90, 0.9);
    window.setTimeout(() => render(changed.length ? [...changed] : ['a', 'b']), o.reduced ? 0 : 500);
  }, o));
  // a cloth poster flung into the other one (v2 arena) slams the cards too
  const onFling = () => { if (!o.reduced) slam(['a', 'b']); };
  document.addEventListener('dd:fling', onFling);
  offs.push(() => document.removeEventListener('dd:fling', onFling));
  return () => offs.forEach((f) => f());
}
