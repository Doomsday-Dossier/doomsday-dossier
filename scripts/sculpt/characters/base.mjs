// The bare anatomy, to check it before any character is built on it.
import { statueBust, plinth, figureBody, figureHead, figureBase } from '../body.mjs';
import { union } from '../sdf.mjs';

const STONE = [{ name: 'stone', color: [0.42, 0.43, 0.45], metal: 0, rough: 0.55 }];

export default {
  statue: {
    build: () => ({
      parts: [{ name: 'body', sdf: union(statueBust({}), plinth({ mat: 0 })) }],
      materials: STONE, focus: [0, 1.42, 0], face: [0, 1.6, 0], frame: 1.45,
    }),
  },
  collectible: {
    build: () => ({
      parts: [{ name: 'body', sdf: union(figureBody({ skin: 0, suit: 1, boots: 2, gloves: 3 }), figureHead({ skin: 0, eyes: 4 }), figureBase(5)) }],
      materials: [
        { name: 'skin', color: [0.85, 0.66, 0.55], rough: 0.4 }, { name: 'suit', color: [0.2, 0.3, 0.6], rough: 0.35 },
        { name: 'boots', color: [0.15, 0.15, 0.17], rough: 0.4 }, { name: 'gloves', color: [0.6, 0.15, 0.15], rough: 0.4 },
        { name: 'eyes', color: [0.05, 0.05, 0.06], rough: 0.1 }, { name: 'base', color: [0.9, 0.9, 0.9], rough: 0.3 },
      ],
      focus: [0, 0.3, 0], face: [0, 0.47, 0], frame: 1.55, look: { bg: [0.2, 0.4, 0.55] },
    }),
  },
};
