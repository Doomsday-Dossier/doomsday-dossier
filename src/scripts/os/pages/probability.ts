/**
 * Module 05, the probability engine: the v1 prediction board (motion/predict.ts: picks kept in this browser, the
 * Turnstile lock-in, the worker, the seal countdown, the fan split, copy my picks) runs unchanged, and DOOM-OS reads
 * its `dd:picks` and `dd:locked` events. Each query types its prompt as it comes on screen; each answer decrypts that
 * query's readout and the engine's total (the odds of a perfect set by chance alone, which is arithmetic, not a
 * forecast); locking in lands the SEALED stamp with a thud and a burst of static; once the fan split arrives, each
 * option shows it as a bar and the readout counts the calls that match the fan majority. All fan prediction.
 */
import { onLeave } from '../../page-scope';
import { decrypt } from '../../sound/os';
import { stamp as stampSound } from '../../sound/actions';
import { predictionBoard } from '../../motion/predict';
import { glitchIn } from '../hud';
import { decryptIn, typeIn, whenSeen, reduced, sound } from '../fx';
import { log } from '../reign';

type Q = { id: string; text: string; options: { id: string; label: string }[] };
const KEY = 'dd-predictions';
const pct = (p: number) => (p >= 1 ? p.toFixed(1) : p.toPrecision(2));

export function probability() {
  const page = document.querySelector<HTMLElement>('[data-predict]'), raw = document.getElementById('pr-data');
  if (!page || !raw) return;
  const { questions } = JSON.parse(raw.textContent || '{}') as { questions: Q[] };
  const s = sound(), rm = reduced();
  const $ = <E extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = page) => root.querySelector<E>(sel)!;
  const odds = $('[data-pb-odds]'), oddsK = $('[data-pb-oddsk]'), agree = $('[data-pb-agree]'), sealedChip = $('[data-pb-sealed]'), dock = $('[data-dock]');
  const li = (id: string) => $(`[data-q="${id}"]`);
  const fanPct = (b: HTMLElement) => parseInt(b.querySelector('.pr-o-pct')?.textContent || '', 10);
  let picks: Record<string, string> = {}, gone = false;
  onLeave(() => { gone = true; });

  // one query's readout: the call, its odds by chance alone, and how many fans made the same call once the split is in
  const readQ = (q: Q, animate: boolean) => {
    const el = li(q.id), read = $('[data-pb-read]', el), n = q.options.length, pick = q.options.find((o) => o.id === picks[q.id]);
    const fan = pick ? fanPct($(`[data-opt="${pick.id}"]`, el)) : NaN;
    el.classList.toggle('done', !!pick);
    $('[data-pb-qst]', el).textContent = pick ? 'Input accepted' : 'Awaiting input';
    const text = pick
      ? `> Your call: ${pick.label} · chance alone: 1 in ${n} (${pct(100 / n)}%)${Number.isNaN(fan) ? '' : ` · fans with you: ${fan}%`}`
      : `Chance alone: 1 in ${n} (${pct(100 / n)}%) · awaiting input`;
    if (animate) decryptIn(read, text, 500); else read.textContent = text;
  };

  // the engine's total: every answered call multiplies the odds against a perfect set by chance
  const readAll = (animate: boolean) => {
    const done = questions.filter((q) => picks[q.id]);
    const n = done.reduce((a, q) => a * q.options.length, 1);
    const text = done.length ? `1 in ${n.toLocaleString('en-GB')}` : '—';
    if (animate) decryptIn(odds, text, 420); else odds.textContent = text;
    oddsK.textContent = done.length ? `${done.length} call${done.length === 1 ? '' : 's'} · ${pct(100 / n)}% if every option were equally likely` : 'if every option were equally likely';
    page.querySelectorAll<HTMLElement>('[data-cell]').forEach((c) => c.classList.toggle('on', !!picks[c.dataset.cell!]));
  };

  // the fan split, read back from the bars the v1 board fills in after locking in
  const readSplit = () => {
    if (gone) return;
    let known = 0, withFans = 0;
    for (const q of questions) {
      const btns = [...li(q.id).querySelectorAll<HTMLElement>('[data-opt]')], ps = btns.map(fanPct);
      const cell = page.querySelector<HTMLElement>(`[data-cell="${q.id}"]`);
      if (ps.some((p) => Number.isNaN(p))) { cell?.classList.remove('agree'); continue; }
      known++;
      const mine = btns.findIndex((b) => b.dataset.opt === picks[q.id]), top = Math.max(...ps);
      const on = mine >= 0 && top > 0 && ps[mine] === top;
      if (on) withFans++;
      cell?.classList.toggle('agree', on);
    }
    page.classList.toggle('has-split', known > 0);
    agree.hidden = !known;
    if (known) agree.textContent = `Your calls match the fan majority on ${withFans} of ${known}. Fan prediction, not fact.`;
    questions.forEach((q) => readQ(q, false));
  };
  let queued = 0;
  const mo = new MutationObserver(() => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; readSplit(); }); });
  page.querySelectorAll('.pr-o-pct').forEach((el) => mo.observe(el, { childList: true, characterData: true, subtree: true }));
  onLeave(() => mo.disconnect());

  // listening before the v1 board starts: it announces the saved picks as it boots
  document.addEventListener('dd:picks', (e) => {
    const d = (e as CustomEvent).detail as { picks: Record<string, string>; q: string | null };
    picks = { ...d.picks };
    const live = !!d.q && !rm;
    readAll(live);
    questions.forEach((q) => readQ(q, live && q.id === d.q));
    if (d.q) decrypt(s);
  });
  // SEALED: the v1 stamp slams down in 0.35 s; the thud, the static and the readout tearing in land with it
  document.addEventListener('dd:locked', () => {
    sealedChip.hidden = false;
    log('Sealed a set of fan predictions for Doomsday.');
    setTimeout(() => { if (gone) return; stampSound(s); glitchIn(dock); }, rm ? 0 : 350);
  });
  try { sealedChip.hidden = !JSON.parse(localStorage.getItem(KEY) || '{}')?.locked; } catch { /* private mode */ }

  onLeave(predictionBoard(document, { ease: 'power3.out', pace: 1, reduced: rm }));

  // each query types its prompt as it comes on screen
  if (!rm) page.querySelectorAll<HTMLElement>('.pb-prompt').forEach((p) => {
    const cmd = p.lastChild;
    if (!cmd || cmd.nodeType !== Node.TEXT_NODE) return;
    const line = cmd.textContent ?? '', span = document.createElement('span');
    cmd.replaceWith(span);
    onLeave(whenSeen(p, () => { if (!gone) typeIn(span, line, 70, false); }));
  });
  // phones: the readout's Details toggle
  const dockEl = document.querySelector<HTMLElement>('.pb-dock'), ex = document.querySelector<HTMLButtonElement>('[data-pb-expand]');
  ex?.addEventListener('click', () => { const open = !dockEl!.classList.contains('open'); dockEl!.classList.toggle('open', open); ex.setAttribute('aria-expanded', String(open)); });
}
