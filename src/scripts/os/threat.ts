/**
 * The threat index, decided by the fans (the visitor's choice, 2 November 2026). Adding up Marvel's six power-grid
 * ratings put Nightcrawler level with Thor and John Walker in the top ten, so the ranking is now a fan vote: anyone
 * rates a target's threat to Doom from 1 (a nuisance) to 4 (worthy of Doom), once a day, behind the same bot check as
 * the arena (workers/arena: GET and POST /threat). The average sets the dial, the band and Doom's line; a target needs
 * MIN ratings before it is ranked. Doom is the measure, never his own threat. Marvel's grid stays on each file as its
 * own chart. Everything here is fan opinion and is labelled so wherever it shows.
 */
export const MIN = 3;
export const BANDS = [
  { id: 'nuisance', rating: 1, name: 'Nuisance', cls: 'os-dim', line: 'An irritation. My Doombots will see to it.' },
  { id: 'rival', rating: 2, name: 'Rival', cls: 'os-hi', line: 'Capable. Not capable enough.' },
  { id: 'nemesis', rating: 3, name: 'Nemesis', cls: 'os-amber', line: 'Dangerous. This one I will face myself.' },
  { id: 'worthy', rating: 4, name: 'Worthy of Doom', cls: 'os-red', line: 'At last, something worth my full attention.' },
] as const;
export const SOVEREIGN = { id: 'sovereign', name: 'Sovereign', cls: 'os-hi', line: 'The measure every other threat is taken against.' };
export const AWAITING = { id: 'awaiting', name: 'Awaiting the fans', cls: 'os-dim', line: 'Rate this threat. Once three fans have, I will pass judgement.' };

/** Where the dial's needle sits, 0 to 1, for an average rating of 1 to 4. */
export const dialOf = (avg: number) => Math.min(1, Math.max(0, (avg - 1) / 3));
export const bandOf = (avg: number) => BANDS[Math.min(3, Math.floor(dialOf(avg) * 4))];

type Fan = Record<string, { n: number; avg: number }>;
export type Standing = { n: number; avg: number | null; rank: number | null; of: number; joint: boolean; band: { id: string; name: string; cls: string; line: string } };

/** Every target's fan rating, fetched once a minute at most (kept for the session so page changes do not refetch). */
let pending: Promise<Fan> | null = null;
export function fanThreat(api: string, fresh = false): Promise<Fan> {
  if (!api) return Promise.resolve({});
  const KEY = 'dd-threat-cache';
  if (!fresh) {
    try { const c = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < 60000) return Promise.resolve(c.v); } catch { /* none */ }
    if (pending) return pending;
  }
  pending = fetch(`${api}/threat`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { threat: {} })).then((j) => {
    const v = (j.threat ?? {}) as Fan;
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v })); } catch { /* private mode */ }
    return v;
  }).catch(() => ({})).finally(() => { pending = null; });
  return pending;
}

/** A target's standing: ranked among targets with at least MIN ratings (ties share a rank). */
export function standing(fan: Fan, slug: string): Standing {
  if (slug === 'victor-von-doom') return { n: 0, avg: null, rank: null, of: 0, joint: false, band: SOVEREIGN };
  const ranked = Object.entries(fan).filter(([s, f]) => s !== 'victor-von-doom' && f.n >= MIN).map(([, f]) => f.avg);
  const me = fan[slug];
  if (!me || me.n < MIN) return { n: me?.n ?? 0, avg: null, rank: null, of: ranked.length, joint: false, band: AWAITING };
  return { n: me.n, avg: me.avg, rank: 1 + ranked.filter((a) => a > me.avg).length, of: ranked.length, joint: ranked.filter((a) => a === me.avg).length > 1, band: bandOf(me.avg) };
}

/** Sets a ThreatDial to a standing: the needle (swung in again), the lit band. */
export function setDial(svg: SVGSVGElement | null, st: Standing) {
  if (!svg) return;
  svg.dataset.band = st.band.id;
  const f = st.band.id === 'sovereign' ? 1 : st.avg === null ? null : dialOf(st.avg);
  if (f === null) { svg.removeAttribute('data-f'); return; }
  svg.style.setProperty('--f', f.toFixed(4));
  svg.dataset.f = '';
  svg.classList.remove('swing'); void svg.getBoundingClientRect(); svg.classList.add('swing');
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** One line under a name: "#3 of 18 · Nemesis", or how far a target is from being ranked. */
export function rankLine(st: Standing) {
  if (st.band.id === 'sovereign') return 'The measure of all';
  if (st.rank === null) return st.n ? `${plural(st.n, 'fan rating')} so far` : 'No fan ratings yet';
  return `#${st.rank}${st.joint ? ' joint' : ''} of ${st.of} · ${plural(st.n, 'rating')}`;
}

/** A file's threat panel: the fans' standing, and the four buttons that add one more rating. */
export async function threatPanel(onDone?: (stamp: boolean) => void) {
  const box = document.querySelector<HTMLElement>('[data-th]');
  if (!box) return;
  const slug = box.dataset.slug!, api = box.dataset.api ?? '', key = box.dataset.sitekey ?? '';
  const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
  const paint = (fan: Record<string, { n: number; avg: number }>) => {
    const st = standing(fan, slug);
    if (st.band.id === 'sovereign') return;
    setDial(box.querySelector<SVGSVGElement>('.tdial'), st);
    const avg = $<HTMLElement>('[data-th-avg]')!; avg.textContent = st.avg === null ? '?' : st.avg.toFixed(1); avg.className = st.band.cls;
    const band = $<HTMLElement>('[data-th-band]')!; band.textContent = st.band.name; band.className = `th-band ${st.band.cls}`;
    $<HTMLElement>('[data-th-line]')!.textContent = st.band.line;
    $<HTMLElement>('[data-th-rank]')!.innerHTML = st.rank === null
      ? `${st.n ? `${st.n} of ${MIN} fan ratings needed.` : 'No fan ratings yet.'} <span class="os-label">Be one of them</span>`
      : `<b class="${st.band.cls}">#${st.rank}</b> <span class="os-label">${st.joint ? 'joint ' : ''}of ${st.of} · ${st.n} fan rating${st.n === 1 ? '' : 's'}</span>`;
  };
  paint(await fanThreat(api));
  const vote = $<HTMLElement>('[data-th-vote]'), msg = $<HTMLElement>('[data-th-msg]');
  if (!vote || !msg) return;
  const DAY = new Date().toISOString().slice(0, 10), STORE = 'dd-threat-rated';
  const rated = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const mine = rated()[slug];
  const btns = [...vote.querySelectorAll<HTMLButtonElement>('[data-rate]')];
  const lock = (r: string) => { btns.forEach((b) => { b.disabled = true; b.classList.toggle('on', b.dataset.rate === r.split('@')[0]); }); };
  if (!api || !key) { btns.forEach((b) => (b.disabled = true)); return; }
  if (mine && mine.endsWith(`@${DAY}`)) { lock(mine); msg.textContent = 'Your rating today is in · fan opinion'; }
  btns.forEach((b) => b.addEventListener('click', async () => {
    const rating = Number(b.dataset.rate);
    btns.forEach((x) => (x.disabled = true)); b.classList.add('on');
    msg.textContent = 'Checking you are human…';
    try {
      const { humanToken, dropWidget } = await import('../motion/turnstile');
      const ts = vote.querySelector<HTMLElement>('[data-th-ts]')!;
      const token = await humanToken(ts, key, 'threat');
      const r = await fetch(`${api}/threat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, rating, token }) });
      dropWidget(ts);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const all = rated(); all[slug] = `${rating}@${DAY}`; try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* private mode */ }
      msg.textContent = j.already ? 'You already rated this target today · fan opinion' : 'Rating counted · fan opinion';
      lock(`${rating}`);
      // the counter's reply carries this target's new count and average: use it, rather than a cached list
      const fan = { ...(await fanThreat(api, true)) };
      if (j.n) fan[slug] = { n: j.n, avg: j.avg };
      try { sessionStorage.setItem('dd-threat-cache', JSON.stringify({ t: Date.now(), v: fan })); } catch { /* private mode */ }
      paint(fan);
      onDone?.(!j.already);
    } catch {
      msg.textContent = 'The rating did not go through. Try again in a moment.';
      btns.forEach((x) => { x.disabled = false; x.classList.remove('on'); });
    }
  }));
}
