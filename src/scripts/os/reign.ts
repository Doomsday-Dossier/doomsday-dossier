/**
 * His Majesty's reign, kept on this device only (localStorage `dd-reign`): the visitor is Doom. It holds the
 * verdict passed on each target, the order of conquest, the royal log, the files examined and how far Doom's will
 * has spread. Nothing leaves the browser. Every verdict and ranking is the visitor's own fan opinion, labelled so
 * wherever it shows.
 */
import { RELEASE } from '../dossier/tokens';

export type Verdict = 'ally' | 'pawn' | 'obstacle' | 'beneath';
export const VERDICTS: Record<Verdict, { name: string; line: string; cls: string }> = {
  ally: { name: 'Ally', line: 'Useful, for now', cls: 'v-ally' },
  pawn: { name: 'Pawn', line: 'To be moved', cls: 'v-pawn' },
  obstacle: { name: 'Obstacle', line: 'To be removed', cls: 'v-obstacle' },
  beneath: { name: 'Beneath notice', line: 'Not worth the ink', cls: 'v-beneath' },
};

type Log = { t: number; text: string };
// stolen: a file a breaching hero got away with (slug of the file to the thief's name), redacted until taken back
type Reign = { since: number; verdicts: Record<string, Verdict>; order: string[]; log: Log[]; seen: Record<string, number>; decree: string; minutes: number; breaches: number; stolen: Record<string, string> };
const KEY = 'dd-reign';
const blank = (): Reign => ({ since: Date.now(), verdicts: {}, order: [], log: [], seen: {}, decree: '', minutes: 0, breaches: 0, stolen: {} });

let cache: Reign | null = null;
export function reign(): Reign {
  if (cache) return cache;
  try { cache = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || 'null') }; } catch { cache = null; }
  return (cache ??= blank());
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(reign())); } catch { /* private mode */ } dispatchEvent(new CustomEvent('dd:reign')); };

/** Days left before release, as the royal log counts them. */
export const daysBefore = (t = Date.now()) => Math.max(0, Math.floor((new Date(RELEASE + 'T00:00:00').getTime() - t) / 86400000));

export function log(text: string) {
  const r = reign();
  if (r.log[0] && r.log[0].text === text && Date.now() - r.log[0].t < 600000) return;
  r.log.unshift({ t: Date.now(), text }); r.log.length = Math.min(r.log.length, 60); save();
}
export const logLine = (l: Log) => `${daysBefore(l.t)} days before Doomsday: ${l.text}`;

export function setVerdict(slug: string, v: Verdict | null, name: string) {
  const r = reign();
  if (v) { r.verdicts[slug] = v; log(`His Majesty judged ${name}: ${VERDICTS[v].name.toLowerCase()}.`); } else delete r.verdicts[slug];
  save();
}
export function setOrder(order: string[]) { reign().order = order; save(); }
/** Ends the reign: verdicts, plans, decree and log, all gone from this device. */
export function eraseReign() { cache = blank(); try { localStorage.removeItem(KEY); } catch { /* private mode */ } dispatchEvent(new CustomEvent('dd:reign')); }
export function setDecree(text: string) { reign().decree = text; save(); }

/** A file examined: counted, and noted in the log the first time. Returns how many files have been opened. */
export function examined(slug: string, name: string) {
  const r = reign();
  if (!r.seen[slug]) log(`His Majesty examined ${name}.`);
  r.seen[slug] = (r.seen[slug] ?? 0) + 1; save();
  return Object.keys(r.seen).length;
}
export function breached(name: string) { const r = reign(); r.breaches++; log(`${name} breached the network. Repelled.`); save(); }
/** A breach His Majesty lost: the thief takes a file, which stays redacted until he takes it back. */
export function stole(file: string, fileName: string, thief: string) { const r = reign(); r.stolen[file] = thief; log(`${thief} breached the network and stole the file on ${fileName}.`); save(); }
export function reclaim(file: string, fileName: string) { const r = reign(); if (!r.stolen[file]) return; delete r.stolen[file]; log(`His Majesty took back the file on ${fileName}.`); save(); }

/** Doom's will, 0 to 1: it spreads with the minutes spent and the files examined. */
export const will = () => { const r = reign(); return Math.min(1, r.minutes / 40 + Object.keys(r.seen).length / 40); };
let ticking = false;
/** Counts the minutes His Majesty spends on the throne (only while the tab is visible). */
export function keepTime() {
  if (ticking) return; ticking = true;
  window.setInterval(() => { if (!document.hidden) { reign().minutes += 0.25; save(); } }, 15000);
}
