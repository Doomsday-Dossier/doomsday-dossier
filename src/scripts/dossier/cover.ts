/**
 * Page changes hide their heavy work (CLAUDE.md, "Page changes"). While the next page is covered (the handoff
 * or the redaction wipe), it swaps in, builds its scene, compiles its shaders, uploads its photos and fits its
 * type; the cover lifts only when that is done (or after a time limit), so nothing animates on top of a busy
 * main thread. A page starts its entrance with `revealed()`, which waits for the lift when a cover is up and
 * resolves at once on a direct load.
 */
export type Arrival = 'load' | 'handoff' | 'wipe';

let covered = false;
let arrival: Arrival = 'load';
let waiting: (() => void)[] = [];

/** How the page on screen arrived: a direct load, the next-file handoff, or the redaction wipe. */
export const arrivedBy = () => arrival;
export const isCovered = () => covered;

/** A cover is going up for a page change of this kind. */
export function coverUp(kind: Exclude<Arrival, 'load'>) { covered = true; arrival = kind; }

/** The cover is lifting: the page's entrance can play. */
export function coverDown() {
  covered = false;
  const w = waiting; waiting = [];
  w.forEach((f) => f());
}

/** Resolves as the page is revealed. */
export function revealed(): Promise<void> {
  return covered ? new Promise((res) => waiting.push(res)) : Promise.resolve();
}
