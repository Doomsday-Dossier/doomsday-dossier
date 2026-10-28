/**
 * Module 03, the combat simulation: the v1 arena (motion/versus.ts: the pair in the URL, the card slam and clash,
 * cycling feats, the comparison below, the fan vote with Turnstile and the most-wanted board) runs unchanged, and
 * DOOM-OS rides on its `dd:pair` event. Every time a pair is chosen the simulation runs: the static bursts, the
 * radar tears back in with both power grids (A solid green, B dashed amber), and both targets are scanned again from
 * their photo and depth map and locked. The crosshair locks on either face. No winner is ever computed.
 */
import { onLeave } from '../../page-scope';
import { sweep, tick } from '../../sound/os';
import { versusPage } from '../../motion/versus';
import { radar, glitchIn, setLockPoints } from '../hud';
import { createScanner, canScan, type Scanner } from '../scanner';
import { lockOn, decryptIn, wait, reduced, sound, pad, RETICLE } from '../fx';
import { log } from '../reign';

type Side = 'a' | 'b';
type T = { slug: string; name: string; no: number; grid: Record<string, number> | null; scan: { photo: string; depth: string; head: [number, number]; bbox?: [number, number, number, number] } | null };

export function combat() {
  const page = document.querySelector<HTMLElement>('[data-versus]'), raw = document.getElementById('vs-data');
  if (!page || !raw) return;
  const by = new Map((JSON.parse(raw.textContent || '[]') as T[]).map((t) => [t.slug, t]));
  const s = sound(), rm = reduced(), scannable = canScan();
  const sides = { a: page.querySelector<HTMLElement>('[data-side="a"]')!, b: page.querySelector<HTMLElement>('[data-side="b"]')! };
  const host = page.querySelector<HTMLElement>('[data-cb-radar]')!, note = page.querySelector<HTMLElement>('[data-cb-note]')!;
  const legA = page.querySelector<HTMLElement>('[data-leg-a]')!, legB = page.querySelector<HTMLElement>('[data-leg-b]')!;
  const simState = page.querySelector<HTMLElement>('[data-sim-state]')!, simLine = page.querySelector<HTMLElement>('[data-sim-line]')!;
  const simTag = page.querySelector<HTMLElement>('[data-simtag]')!;
  const NOTE = note.textContent ?? '';
  const live: Record<Side, { sc: Scanner | null; gen: number; t: T | null }> = { a: { sc: null, gen: 0, t: null }, b: { sc: null, gen: 0, t: null } };
  let gone = false, runs = 0;
  onLeave(() => { gone = true; setLockPoints(null); for (const k of ['a', 'b'] as Side[]) { live[k].gen++; live[k].sc?.dispose(); live[k].sc = null; } });

  // one target into its card: a fresh canvas each time (a lost context cannot be revived), swept, coloured, locked
  const mount = async (k: Side, t: T, delay: number) => {
    const st = live[k], g = ++st.gen;
    st.sc?.dispose(); st.sc = null; st.t = t;
    sides[k].querySelector('.cb-scan')?.remove();
    sides[k].insertAdjacentHTML('afterbegin', `<div class="cb-scan">${t.scan ? `<img class="cb-still" src="${t.scan.photo}" alt="" decoding="async">` : ''}<canvas aria-hidden="true"></canvas>` +
      `<div class="os-reticle" hidden>${RETICLE}<span class="lock os-label os-hi">Locked</span></div><span class="cb-tag os-label">T-${pad(t.no)} // ${k.toUpperCase()}</span><span class="cb-st os-label os-hi">Acquiring</span></div>`);
    const box = sides[k].querySelector<HTMLElement>('.cb-scan')!, status = box.querySelector<HTMLElement>('.cb-st')!;
    const still = () => { box.classList.add('still'); status.textContent = 'Target on file'; };
    if (!t.scan || !scannable) { still(); return; }
    let sc: Scanner;
    try { [sc] = await Promise.all([createScanner(box.querySelector('canvas')!, t.scan.photo, t.scan.depth, t.scan.head, 2.4, t.scan.bbox), wait(rm ? 0 : delay)]); }
    catch (e) { if (/^(localhost|127\.)/.test(location.hostname)) console.warn('scanner', e); if (st.gen === g) still(); return; }
    if (gone || st.gen !== g) { sc.dispose(); return; }
    st.sc = sc;
    status.textContent = 'Scanning';
    await sc.scan(rm ? 0 : 1.8);
    if (gone || st.gen !== g) return;
    sc.colour(1, 1.4);
    lockOn(box.querySelector<HTMLElement>('.os-reticle')!, sc.head());
    status.textContent = 'Target locked';
  };

  // both power grids on one radar: A solid green, B dashed amber; a side Marvel never rated is left off and said so
  const drawRadar = (A: T, B: T) => {
    host.innerHTML = ''; host.classList.remove('only-b');
    if (A.grid) radar(host, A.grid, B.grid);
    else if (B.grid) { host.classList.add('only-b'); radar(host, B.grid); }
    else host.innerHTML = '<p class="none">Neither target is rated in Marvel\'s power grid</p>';
    legA.textContent = A.name; legB.textContent = B.name;
    legA.parentElement!.hidden = !A.grid; legB.parentElement!.hidden = !B.grid;
    const off = [A, B].filter((x) => !x.grid).map((x) => x.name);
    note.textContent = NOTE + (off.length && off.length < 2 ? ` ${off[0]}: not rated in Marvel's power grid.` : '');
    host.setAttribute('aria-label', [A, B].map((x) => x.grid ? `${x.name}: ${Object.entries(x.grid).map(([k, v]) => `${k} ${v}`).join(', ')}` : `${x.name}: not rated`).join('. '));
    glitchIn(host);
  };

  // the simulate moment, on every pair: the stamp flashes, static bursts, the line decrypts, both targets re-sweep
  const simulate = (a: string, b: string) => {
    const A = by.get(a), B = by.get(b); if (!A || !B) return;
    runs++;
    drawRadar(A, B);
    simState.textContent = 'Simulating';
    decryptIn(simLine, `RUN ${pad(runs)} // T-${pad(A.no)} ${A.name.toUpperCase()} :: T-${pad(B.no)} ${B.name.toUpperCase()}`, 700);
    if (!rm) {
      simTag.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 1, offset: 0.5 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 900, easing: 'steps(6, end)' });
      for (let i = 0; i < 4; i++) setTimeout(() => { if (!gone) tick(s); }, i * 70);
    }
    // the cards fly in and hit first (v1 slam, 0.42 s), then the sensors sweep both
    const delay = runs === 1 ? 250 : 480;
    if (scannable && !rm) setTimeout(() => { if (!gone) sweep(s, 1.8); }, delay);
    Promise.all([mount('a', A, delay), mount('b', B, delay + 120)]).then(() => {
      if (gone || live.a.t !== A || live.b.t !== B) return;
      simState.textContent = 'Simulation stable';
      decryptIn(simLine, `T-${pad(A.no)} ${A.name.toUpperCase()} :: T-${pad(B.no)} ${B.name.toUpperCase()} // NO VERDICT COMPUTED // FAN VOTE BELOW`, 600);
    });
    // the royal log keeps the pairs His Majesty chose (not the default pair every visit opens on)
    if (runs > 1 || /[?&]a=/.test(location.search)) log(`Ran a combat simulation: ${A.name} against ${B.name}.`);
    // the v1 arena names the page "Arena"; this screen is the combat simulation
    setTimeout(() => { if (!gone) document.title = `${A.name} vs ${B.name} | Combat simulation | Doomsday Dossier`; }, 0);
  };
  // listening before the v1 arena starts: it announces the first pair as it boots
  document.addEventListener('dd:pair', (e) => { const d = (e as CustomEvent).detail as { a: string; b: string }; simulate(d.a, d.b); });

  onLeave(versusPage(document, { ease: 'power3.out', pace: 1, reduced: rm }));

  // the crosshair locks on either face
  setLockPoints(() => (['a', 'b'] as Side[]).flatMap((k) => {
    const { sc, t } = live[k]; if (!sc || !t) return [];
    const r = sc.el.getBoundingClientRect(), h = sc.head();
    return [{ x: r.left + h.x, y: r.top + h.y, label: `LOCKED // ${t.name.toUpperCase()}` }];
  }));
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => {
    if (gone) return;
    for (const k of ['a', 'b'] as Side[]) {
      const sc = live[k].sc, ret = sides[k].querySelector<HTMLElement>('.os-reticle');
      if (sc && ret) { const h = sc.head(); ret.style.left = `${h.x}px`; ret.style.top = `${h.y}px`; }
    }
  }, 200); });
}
