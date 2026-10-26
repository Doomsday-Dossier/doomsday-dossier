/**
 * Which Doomsday hero are you? One question at a time; every answer gives a point to each
 * character it lists, the highest total wins (ties: whoever scored on the later question,
 * then roster order). Answers live in the URL (?a=abcd…), so a shared link shows the same
 * result. The result can be saved as a Dossier-file card (portrait or wide PNG).
 */
import { gsap } from './grammar';
import { glideTo } from './scroller';
import { drawCard, saveCanvas } from './card';

type Opts = { ease: string; pace: number; reduced: boolean };
type Opt = { id: string; label: string; to: string[] };
type Q = { id: string; text: string; options: Opt[] };
type Char = { slug: string; name: string; team: string; accent: string; font: string; weight: number; kicker: string; href: string; photo: { src: string; card: string; focus: string } | null };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function quizPage(root: ParentNode, o: Opts): () => void {
  const page = root.querySelector<HTMLElement>('[data-quiz]');
  const raw = document.getElementById('qz-data');
  if (!page || !raw) return () => {};
  const { questions, roster, credit, site } = JSON.parse(raw.textContent || '{}') as { questions: Q[]; roster: Char[]; credit: string; site: string };
  const by = new Map(roster.map((c) => [c.slug, c]));
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => page.querySelector<T>(s)!;
  const stage = $('[data-stage]'), result = $('[data-result]'), back = $<HTMLButtonElement>('[data-back]');
  const cards = [...page.querySelectorAll<HTMLElement>('.qz-q')];
  const offs: (() => void)[] = [];
  const on = (t: EventTarget, ev: string, fn: (e: any) => void) => { t.addEventListener(ev, fn); offs.push(() => t.removeEventListener(ev, fn)); };
  const tweens: gsap.core.Animation[] = [];
  const dur = (s: number) => (o.reduced ? 0 : s * o.pace);

  let picks: number[] = [];
  let at = 0, busy = false, winner: { c: Char; why: { q: string; label: string }[]; close: Char[] } | null = null;

  // question words rise in; wrapped once so the split survives Back
  for (const card of cards) {
    const lg = card.querySelector('legend')!;
    lg.innerHTML = lg.textContent!.split(' ').map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
  }

  const score = (p: number[]) => {
    const sc = new Map<string, number>(), last = new Map<string, number>();
    p.forEach((oi, qi) => { for (const s of questions[qi].options[oi].to) { sc.set(s, (sc.get(s) || 0) + 1); last.set(s, qi); } });
    const order = roster.map((c) => c.slug).filter((s) => sc.has(s));
    order.sort((a, b) => sc.get(b)! - sc.get(a)! || last.get(b)! - last.get(a)! || 0);
    const c = by.get(order[0])!;
    // the most telling answers first: the ones shared with the fewest characters
    const why = p.map((oi, qi) => ({ qi, opt: questions[qi].options[oi] })).filter((x) => x.opt.to.includes(c.slug))
      .sort((a, b) => a.opt.to.length - b.opt.to.length || b.qi - a.qi).slice(0, 3)
      .sort((a, b) => a.qi - b.qi).map((x) => ({ q: questions[x.qi].text, label: x.opt.label }));
    return { c, why, close: order.slice(1, 3).map((s) => by.get(s)!) };
  };

  const progress = () => {
    $('[data-count]').textContent = String(Math.min(at + 1, questions.length)).padStart(2, '0');
    back.disabled = at === 0 || busy;
    tweens.push(gsap.to($('[data-bar]'), { scaleX: picks.length / questions.length, duration: dur(0.5), ease: 'power3.out' }));
  };

  const show = (i: number, dir: 1 | -1) => {
    const prev = cards[at], next = cards[i];
    const enter = () => {
      cards.forEach((c) => c.classList.toggle('on', c === next));
      next.querySelectorAll('button').forEach((b, k) => b.classList.toggle('picked', picks[i] === k));
      at = i; progress();
      if (!o.reduced) {
        tweens.push(gsap.fromTo(next.querySelectorAll('.w'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6 * o.pace, stagger: 0.035, ease: o.ease }));
        tweens.push(gsap.fromTo(next.querySelectorAll('button'), { y: 18 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 * o.pace, stagger: 0.04, delay: 0.12, ease: 'power3.out', clearProps: 'transform,opacity' }));
      }
      next.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
      busy = false; back.disabled = at === 0;
      // keep the question in view on small screens
      const r = stage.getBoundingClientRect();
      if (r.top < 0 || r.top > 160) glideTo(scrollY + r.top - 90, dur(0.6) || 0.01);
    };
    busy = true;
    if (o.reduced || prev === next) return enter();
    tweens.push(gsap.to(prev, { x: -40 * dir, opacity: 0, duration: 0.28, ease: 'power2.in', onComplete: () => { gsap.set(prev, { clearProps: 'transform,opacity' }); enter(); } }));
  };

  const pick = (k: number) => {
    if (busy || at >= questions.length) return;
    picks[at] = k; picks = picks.slice(0, at + 1);
    const btn = cards[at].querySelectorAll('button')[k];
    cards[at].querySelectorAll('button').forEach((b, j) => b.classList.toggle('picked', j === k));
    if (!o.reduced) tweens.push(gsap.fromTo(btn, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }));
    if (at + 1 < questions.length) { busy = true; setTimeout(() => show(at + 1, 1), o.reduced ? 0 : 240); }
    else { busy = true; progress(); setTimeout(() => finish(true), o.reduced ? 0 : 320); }
  };

  // names of two or more words stack on two lines, split where the lines come out most even
  const nameLines = (name: string) => {
    const w = name.split(' ');
    let best = [name];
    for (let i = 1; i < w.length; i++) {
      const l = [w.slice(0, i).join(' '), w.slice(i).join(' ')];
      if (best.length === 1 || Math.max(...l.map((x) => x.length)) < Math.max(...best.map((x) => x.length))) best = l;
    }
    return best;
  };

  // the CSS size assumes an average face; very wide faces (Syne, Unbounded) are measured and shrunk to fit
  const fitName = () => {
    const name = $('[data-r-name]');
    name.style.fontSize = '';
    const widest = Math.max(0, ...[...name.querySelectorAll<HTMLElement>('.ln > span')].map((s) => s.offsetWidth));
    if (widest > name.clientWidth) name.style.fontSize = `${(parseFloat(getComputedStyle(name).fontSize) * name.clientWidth / widest) * 0.98}px`;
  };
  on(window, 'resize', () => { if (winner) fitName(); });

  const finish = (fresh: boolean) => {
    winner = score(picks);
    const { c, why, close } = winner;
    const code = picks.map((k, i) => questions[i].options[k].id).join('');
    history.replaceState(history.state, '', `${location.pathname}?a=${code}`);

    result.style.setProperty('--a', c.accent);
    const name = $('[data-r-name]');
    const lines = nameLines(c.name);
    name.style.setProperty('--f', c.font); name.style.setProperty('--wt', String(c.weight)); name.style.setProperty('--lw', String(Math.max(...lines.map((l) => l.length))));
    name.innerHTML = lines.map((l) => `<span class="ln"><span>${esc(l)}</span></span>`).join(' ');
    fitName();
    document.fonts.load(`${c.weight} 100px ${c.font}`, c.name).then(fitName, () => {});
    $('[data-r-team]').textContent = c.team;
    $('[data-r-blurb]').textContent = c.kicker;
    $('[data-r-why]').innerHTML = why.map((w) => `<li><small>${esc(w.q)}</small><span>${esc(w.label)}</span></li>`).join('');
    $('[data-r-close]').innerHTML = close.length ? `Close behind: ${close.map((x) => `<a href="${esc(x.href)}">${esc(x.name)}</a>`).join(' and ')}.` : '';
    $<HTMLAnchorElement>('[data-r-link]').href = c.href;
    $<HTMLAnchorElement>('[data-r-link]').textContent = `Read the ${c.name} dossier`;
    const img = $<HTMLImageElement>('[data-r-img]');
    if (c.photo) { img.src = c.photo.src; img.style.objectPosition = c.photo.focus; img.alt = c.name; img.hidden = false; } else img.hidden = true;

    stage.hidden = true; result.hidden = false; busy = false;
    // measure again once the result is on screen: while hidden every width reads 0, and a face that is already
    // cached resolves its load before the result shows, so neither earlier call could shrink a wide name
    requestAnimationFrame(fitName);
    if (fresh) glideTo(scrollY + result.getBoundingClientRect().top - 90, dur(0.7) || 0.01);
    if (!o.reduced) {
      const tl = gsap.timeline();
      tl.fromTo(result.querySelector('.qz-r-frame'), { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1 * o.pace, ease: 'power4.inOut', clearProps: 'clipPath' })
        .fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.6 * o.pace, ease: 'power3.out' }, 0)
        .fromTo(result.querySelector('.qz-r-kicker'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.3)
        .fromTo(name.querySelectorAll('.ln > span'), { yPercent: 110 }, { yPercent: 0, duration: 0.9 * o.pace, stagger: 0.08, ease: o.ease }, 0.35)
        .fromTo(result.querySelectorAll('.qz-r-team, .qz-r-blurb, .qz-why li, .qz-close, .qz-actions > *, .qz-fine'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' }, 0.7);
      tweens.push(tl);
    }
  };

  const restart = () => {
    picks = []; winner = null;
    history.replaceState(history.state, '', location.pathname);
    result.hidden = true; stage.hidden = false;
    cards.forEach((c) => c.querySelectorAll('button').forEach((b) => b.classList.remove('picked')));
    at = 0; show(0, -1);
  };

  const card = async (kind: 'portrait' | 'wide', btn: HTMLButtonElement) => {
    if (!winner) return;
    const { c, why } = winner, wide = kind === 'wide';
    const label = btn.textContent;
    btn.textContent = 'Drawing…'; btn.disabled = true;
    try {
      const canvas = await drawCard({
        w: wide ? 1200 : 1080, h: wide ? 630 : 1350,
        kicker: 'Which Doomsday hero are you?', name: c.name, font: c.font, weight: c.weight, accent: c.accent, tag: c.team,
        photo: c.photo?.card ?? null, focus: c.photo?.focus ?? '50% 50%',
        lines: [`Picked: ${why.map((w) => w.label).join(' · ')}`],
        file: `FILE ${String(roster.indexOf(c) + 1).padStart(2, '0')} / ${roster.length}`,
        site, fine: `Fan quiz, just for fun · ${credit}`,
      });
      await saveCanvas(canvas, `doomsday-dossier-${c.slug}${wide ? '-wide' : ''}.png`);
    } finally { btn.textContent = label; btn.disabled = false; }
  };

  cards.forEach((cardEl) => cardEl.querySelectorAll<HTMLButtonElement>('button').forEach((b, k) => on(b, 'click', () => pick(k))));
  on(back, 'click', () => { if (!busy && at > 0) show(at - 1, -1); });
  on(document, 'keydown', (e: KeyboardEvent) => {
    if (stage.hidden || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= (questions[at]?.options.length ?? 0)) { e.preventDefault(); pick(n - 1); }
    else if (e.key === 'Backspace' && at > 0 && !busy) { e.preventDefault(); show(at - 1, -1); }
  });
  page.querySelectorAll<HTMLButtonElement>('[data-card]').forEach((b) => on(b, 'click', () => card(b.dataset.card as 'portrait' | 'wide', b)));
  on($('[data-r-again]'), 'click', restart);
  on($('[data-r-copy]'), 'click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    try { await navigator.clipboard.writeText(location.href); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy link'), 1800); } catch { /* blocked */ }
  });

  page.classList.add('live');
  // a shared link (?a=…) opens straight on its result
  const code = new URLSearchParams(location.search).get('a') || '';
  const fromUrl = code.length === questions.length ? [...code].map((ch, i) => questions[i].options.findIndex((x) => x.id === ch)) : [];
  if (fromUrl.length && fromUrl.every((k) => k >= 0)) { picks = fromUrl; at = questions.length; progress(); finish(false); }
  else { cards[0].classList.add('on'); progress(); }

  return () => { offs.forEach((f) => f()); tweens.forEach((t) => t.kill()); };
}
