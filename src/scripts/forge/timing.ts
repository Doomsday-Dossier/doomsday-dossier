/**
 * The forge's beats, in seconds from the click, for each version. The scene and the sound read the same
 * table, so picture and sound land together. See CLAUDE.md, "The forge".
 */
export type Timing = {
  id: 'a' | 'b' | 'return';
  total: number;            // when the title and countdown have settled
  rumble: [number, number]; // the furnace builds
  pour: [number, number];   // molten iron runs into the mould (empty for the return visit: already cast)
  coolDur: number;          // how long a stretch of metal takes to cool from orange to iron after it fills
  seep: [number, number];   // green light seeps through the cracks
  crack: number;            // the mould splits
  stand: [number, number];  // the cast title rises to stand
  etch: [number, number];   // the countdown etches in
};

/** A, the slow burn: a slow push over the mould, long holds. */
export const SLOW: Timing = { id: 'a', total: 6.8, rumble: [0, 1.6], pour: [1.0, 3.0], coolDur: 1.9, seep: [4.0, 5.25], crack: 5.3, stand: [5.35, 6.35], etch: [5.9, 6.8] };
/** B, the strike: a low angle, tight beats, a harder crack. */
export const STRIKE: Timing = { id: 'b', total: 4.8, rumble: [0, 0.9], pour: [0.45, 1.75], coolDur: 1.1, seep: [2.35, 3.2], crack: 3.25, stand: [3.3, 4.1], etch: [3.95, 4.8] };
/** Return visits: the iron is already cast; the last of the seep, the split and the title, in two seconds. */
export const RETURN: Timing = { id: 'return', total: 2.0, rumble: [0, 0.4], pour: [-9, -8.5], coolDur: 0.1, seep: [0, 0.9], crack: 0.95, stand: [1.0, 1.6], etch: [1.4, 2.0] };
