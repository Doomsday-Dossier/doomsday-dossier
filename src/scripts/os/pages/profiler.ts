/**
 * Module 04, the subject profiler: the v1 quiz (motion/quiz.ts, run unchanged: ten questions, number keys, Back,
 * answers in ?a= so a shared link shows the same result, three telling answers and two runners-up, the share cards)
 * as Doom's system profiling the subject before the screen. Each question types in as a terminal prompt and its
 * answers come up line by line. When the last answer is in, the system offers an optional camera scan of the subject
 * (camera.ts: off unless the visitor allows it, video only, four seconds, nothing kept; denied or no camera skips
 * it). Then the match is revealed as a scan of the target's photo (scanner.ts): the reticle locks with their
 * signature sound, the MATCH stamp lands and the name types in. A shared link goes straight to the reveal. Reduced
 * motion: no typing, no sweep, everything at once.
 */
import { quizPage } from '../../motion/quiz';
import { onLeave } from '../../page-scope';
import { tick, sweep, staticBurst } from '../../sound/os';
import { stamp as stampSound } from '../../sound/actions';
import { playSignature } from '../../sound/signatures';
import { glitchIn } from '../hud';
import { createScanner, canScan, type Scanner } from '../scanner';
import { cameraScan, canCamera, type CamScan } from '../camera';
import { lockOn, typeIn, wait, reduced, sound } from '../fx';

type Entry = { slug: string; name: string; href: string; scan: { photo: string; depth: string; head: [number, number] } | null };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function profiler() {
  const page = document.querySelector<HTMLElement>('[data-quiz]'), raw = document.getElementById('qz-data');
  if (!page || !raw) return;
  const rm = reduced(), s = sound(), local = /^(localhost|127\.)/.test(location.hostname);
  const { roster = [], questions = [] } = JSON.parse(raw.textContent || '{}') as { roster: Entry[]; questions: unknown[] };
  const $ = <T extends HTMLElement = HTMLElement>(q: string) => page.querySelector<T>(q)!;
  let gone = false;

  // the v1 quiz; a shared link (?a=) has already opened on its result when this returns
  onLeave(quizPage(document, { ease: 'power3.out', pace: 1, reduced: rm }));
  const result = $('[data-result]'), link = $<HTMLAnchorElement>('[data-r-link]'), gate = $('[data-gate]');
  const shared = !result.hidden;

  // PROMPTS: each question types in (quiz.ts has wrapped its words in .w spans, kept so its own code still finds them)
  const cards = [...page.querySelectorAll<HTMLElement>('.qz-q')];
  const words = new Map<HTMLElement, string[]>(cards.map((q) => [q, [...q.querySelectorAll<HTMLElement>('legend .w')].map((w) => w.textContent ?? '')] as [HTMLElement, string[]]));
  let typing = 0;
  const fillQ = (q: HTMLElement) => {
    const t = words.get(q)!;
    q.querySelectorAll<HTMLElement>('legend .w').forEach((w, i) => { w.textContent = t[i]; });
    q.querySelector('legend')!.classList.remove('os-cursor'); q.classList.remove('typing');
  };
  const prompt = async (q: HTMLElement) => {
    const me = ++typing;
    cards.forEach((c) => { if (c !== q && c.classList.contains('typing')) fillQ(c); });
    if (rm) { fillQ(q); return; }
    // letters not yet typed stay in place as clear glyphs, so the prompt never reflows the page; a zero-width
    // cursor rides the typed edge
    const ws = [...q.querySelectorAll<HTMLElement>('legend .w')], t = words.get(q)!;
    const ghost = (i: number, c: number) => { ws[i].innerHTML = `${esc(t[i].slice(0, c))}<b class="cur"></b><i>${esc(t[i].slice(c))}</i>`; };
    ws.forEach((w, i) => { w.innerHTML = `<i>${esc(t[i])}</i>`; }); q.classList.add('typing');
    let n = 0;
    for (let i = 0; i < ws.length; i++) for (let c = 1; c <= t[i].length; c++) {
      if (me !== typing || gone) { fillQ(q); return; }
      if (c === 1 && i) ws[i - 1].textContent = t[i - 1];
      ghost(i, c);
      if (++n % 3 === 0) tick(s);
      await wait(13);
    }
    fillQ(q);
    // the answers come up as lines, one after another
    q.querySelectorAll<HTMLElement>('.qz-opts button').forEach((b, i) => {
      b.animate([{ opacity: 0, translate: '-12px 0' }, { opacity: 1, translate: '0 0' }], { duration: 240, delay: i * 70, easing: 'steps(5, end)', fill: 'backwards' });
      setTimeout(() => { if (me === typing && !gone) tick(s); }, i * 70);
    });
  };
  const watch = new MutationObserver((ms) => ms.forEach((m) => {
    const q = m.target as HTMLElement;
    if (q.classList.contains('on') && !/\bon\b/.test(m.oldValue ?? '')) prompt(q);
  }));
  cards.forEach((q) => watch.observe(q, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
  onLeave(() => watch.disconnect());
  const first = cards.find((q) => q.classList.contains('on'));
  if (first && !shared) prompt(first);

  // THE MATCH ---------------------------------------------------------------------------------------------------
  const frame = $('.qz-r-frame'), ret = $('[data-r-ret]'), stampEl = $('[data-r-stamp]'), status = $('[data-r-status]'), kicker = $('[data-r-kicker]'), sr = $('[data-r-sr]');
  const camBox = $('[data-cam]'), camRet = $('[data-cam-ret]'), readList = $('[data-cam-read]'), pts = $('[data-cam-pts]'), choice = $('[data-choice]');
  const gl = [...page.querySelectorAll<HTMLElement>('[data-gl]')];
  let run = 0, cam: CamScan | null = null, sc: Scanner | null = null, choose: ((scan: boolean) => void) | null = null;
  const live = (me: number) => me === run && !gone;
  const current = () => roster.find((r) => link.getAttribute('href') === r.href || link.href.endsWith(r.href)) ?? null;
  const flatAt = () => ({ x: frame.clientWidth * 0.5, y: frame.clientHeight * 0.28 });

  const clear = () => {
    run++; choose = null;
    cam?.stop(); cam = null; sc?.dispose(); sc = null;
    gate.hidden = true; result.classList.remove('held'); ret.hidden = true; stampEl.hidden = true;
  };
  onLeave(() => { gone = true; clear(); });

  const reveal = async (me: number, fresh: boolean) => {
    gate.hidden = true; result.classList.remove('held');
    const t = current(); if (!t) return;
    sr.textContent = `Subject profile matches: ${t.name}`;
    // quiz.ts fits the name on resize: measure it now that it can be seen. The letters not yet typed stay in place
    // as clear glyphs, so the name keeps its width and any later fit by quiz.ts still measures the whole name.
    dispatchEvent(new Event('resize'));
    const els = [...result.querySelectorAll<HTMLElement>('[data-r-name] .ln > span')], txt = els.map((e) => e.textContent ?? '');
    const ghost = (i: number, c: number) => { els[i].innerHTML = `${esc(txt[i].slice(0, c))}<i>${esc(txt[i].slice(c))}</i>`; };
    const fillName = () => els.forEach((e, i) => { e.textContent = txt[i]; });
    if (!rm) els.forEach((_, i) => ghost(i, 0));
    ret.hidden = true; stampEl.hidden = true; frame.classList.remove('scanned', 'flat'); status.textContent = 'Matching profile';
    if (fresh) { result.scrollIntoView({ block: 'start', behavior: rm ? 'auto' : 'smooth' }); if (!rm) { glitchIn(result); staticBurst(s); } }
    typeIn(kicker, 'Subject profile matches:', 70);

    // the target scanned in from their photo, or the tinted photo where WebGL is missing
    let at: { x: number; y: number } | null = null;
    if (t.scan && canScan()) {
      // a fresh canvas every time: a disposed scanner has lost its context for good
      const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); frame.querySelector('canvas')!.replaceWith(cv);
      try {
        const sc0 = await createScanner(cv, t.scan.photo, t.scan.depth, t.scan.head);
        if (!live(me)) { sc0.dispose(); return; }
        sc = sc0; frame.classList.add('scanned'); status.textContent = 'Scanning target';
        sweep(s, 2.2);
        await sc0.scan(rm ? 0 : 2.2);
        if (!live(me)) return;
        sc0.colour(1, 1.8); at = sc0.head();
      } catch (e) { if (local) console.warn('scanner', e); }
    }
    if (!live(me)) return;
    if (!at) { frame.classList.add('flat'); at = flatAt(); }
    lockOn(ret, at, () => { if (live(me)) playSignature(s, t.slug); });
    await wait(rm ? 0 : 800);
    if (!live(me)) { fillName(); return; }
    stampEl.hidden = false; stampSound(s);
    if (!rm) stampEl.animate([{ transform: 'rotate(-8deg) scale(2.2)', opacity: 0 }, { transform: 'rotate(-8deg) scale(0.94)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-8deg) scale(1)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' });
    status.textContent = t.slug === 'victor-von-doom' ? 'Identity: Your Majesty' : 'Profile match confirmed';
    // the name types in, letter by letter
    if (!rm) for (let i = 0; i < els.length; i++) for (let c = 1; c <= txt[i].length; c++) {
      if (!live(me)) { fillName(); return; }
      ghost(i, c); tick(s);
      await wait(55);
    }
    fillName();
    dispatchEvent(new Event('resize'));
  };

  // THE SUBJECT SCAN --------------------------------------------------------------------------------------------
  const line = (text: string, warn = false) => {
    const li = document.createElement('li'); if (warn) li.className = 'warn';
    readList.append(li);
    return typeIn(li, text, 80);
  };
  $('[data-cam-yes]').addEventListener('click', () => choose?.(true));
  $('[data-cam-no]').addEventListener('click', () => choose?.(false));
  $('[data-cam-skip]').addEventListener('click', () => { tick(s); cam?.stop(); });

  const offer = async (me: number) => {
    result.classList.add('held'); gate.hidden = false; choice.hidden = false; camBox.hidden = true; camRet.hidden = true;
    gl.forEach((l) => { l.textContent = ''; }); readList.innerHTML = ''; pts.textContent = '0000';
    gate.scrollIntoView({ block: 'start', behavior: rm ? 'auto' : 'smooth' });
    if (!rm) { glitchIn(gate); staticBurst(s); }
    $('[data-cam-yes]').focus({ preventScroll: true });
    const q = String(questions.length).padStart(2, '0');
    typeIn(gl[0], `Profile compiled // ${q} of ${q} responses logged`, 110).then(() => { if (live(me)) typeIn(gl[1], 'Optional: biometric scan of the subject', 110); });
    const want = await new Promise<boolean>((res) => { choose = res; });
    if (!live(me)) return;
    choose = null;
    if (!want) { tick(s); reveal(me, true); return; }

    choice.hidden = true; camBox.hidden = false;
    line('Requesting camera // awaiting your word');
    const scan = cameraScan($<HTMLCanvasElement>('[data-cam-canvas]'), {
      seconds: 4,
      onFrame: (n) => { pts.textContent = String(n).padStart(4, '0'); },
      onLive: () => {
        if (!live(me)) return;
        sweep(s, 4);
        lockOn(camRet, { x: camBox.clientWidth / 2, y: camBox.clientHeight * 0.45 });
        ([['Subject acquired', 300], ['Biometrics: not stored', 1300], ['Frame buffer: volatile', 2200], [`Cross-checking ${roster.length} targets`, 3000]] as const)
          .forEach(([text, ms]) => setTimeout(() => { if (live(me) && cam === scan) line(text); }, rm ? 0 : ms));
      },
    });
    cam = scan;
    const end = await scan.done;
    if (cam === scan) cam = null;
    camRet.hidden = true;
    if (!live(me)) return;
    if (end === 'denied' || end === 'none') {
      await line(end === 'denied' ? 'Camera refused // profiling from answers alone' : 'No camera found // profiling from answers alone', true);
      await wait(rm ? 400 : 1100);
    } else if (end === 'done') {
      await line('Scan complete // camera off // nothing kept');
      await wait(rm ? 0 : 600);
    }
    if (live(me)) reveal(me, true);
  };

  // every new result: offer the scan first where there is a camera to ask for (device kinds are listed without
  // asking permission), then reveal; a restart takes it all down. The check is settled long before the last answer,
  // so its `then` lands before the next paint and the result never flashes up ahead of the offer.
  const hasCam = canCamera() ? navigator.mediaDevices.enumerateDevices().then((d) => d.some((x) => x.kind === 'videoinput'), () => true) : Promise.resolve(false);
  const mo = new MutationObserver(() => {
    clear();
    if (result.hidden) return;
    const me = run;
    result.classList.add('held');
    hasCam.then((ok) => { if (!live(me)) return; if (ok) offer(me); else reveal(me, true); });
  });
  mo.observe(result, { attributes: true, attributeFilter: ['hidden'] });
  onLeave(() => mo.disconnect());
  if (shared) reveal(++run, false);

  // keep the reticle on the face when the screen changes size
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { if (ret.hidden || gone) return; const p = sc ? sc.head() : flatAt(); ret.style.left = `${p.x}px`; ret.style.top = `${p.y}px`; }, 200); });
}
