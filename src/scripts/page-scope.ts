/**
 * Seamless page changes (CLAUDE.md, fifth interview: the next page swaps in without a reload, so the score and
 * the WebGL canvas never stop). What a page sets up on the window and document (event listeners, intervals)
 * belongs to that page and is taken down when the next one swaps in; what the whole session shares (smooth
 * scroll, the renderer, the sound engine, the header) is set up inside `asGlobal` and stays.
 *
 * Only `addEventListener` on window and document and `setInterval` are tracked. Timeouts and animation frames
 * are left alone, because the libraries (GSAP's ticker, ScrollTrigger, Lenis) run on them: a page's own frame
 * loop checks `alive(epoch)` instead, and anything else a page must undo goes to `onLeave`.
 */
type Off = () => void;

let epoch = 1;
let global = 0; // depth of asGlobal calls on the stack
const offs = new Map<number, Off[]>();

const own = (f: Off) => {
  if (global) return;
  let list = offs.get(epoch);
  if (!list) offs.set(epoch, (list = []));
  list.push(f);
};

/** The page now on screen; a loop started on a page keeps the value and stops once it is no longer live. */
export const pageEpoch = () => epoch;
export const alive = (e: number) => e === epoch;

/** Something to undo when the page is left. Ignored inside `asGlobal`. */
export function onLeave(f: Off) { own(f); }

/** Runs set-up that belongs to the whole session, not to the page on screen. */
export function asGlobal<T>(fn: () => T): T {
  global++;
  try { return fn(); } finally { global--; }
}

/** Takes down everything the page set up, and makes the next page live. */
export function leavePage() {
  const list = offs.get(epoch) ?? [];
  offs.delete(epoch);
  epoch++;
  for (const f of list.reverse()) { try { f(); } catch { /* already gone */ } }
}

let installed = false;
/** Starts tracking. Call once, before any page code runs. */
export function installPageScope() {
  if (installed) return;
  installed = true;
  for (const target of [window, document] as EventTarget[]) {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = function (type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) {
      add(type, fn, opts);
      if (fn) own(() => remove(type, fn, opts));
    };
  }
  const si = window.setInterval.bind(window);
  window.setInterval = function (handler: TimerHandler, ms?: number, ...args: unknown[]) {
    const id = si(handler, ms, ...args);
    own(() => clearInterval(id));
    return id;
  } as typeof window.setInterval;
}
