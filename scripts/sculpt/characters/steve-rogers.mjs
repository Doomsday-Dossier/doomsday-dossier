/**
 * Steve Rogers (CLAUDE.md, "3D characters"). Sources: the cowl with the "A" and the wings at the temples, the
 * star on the chest and the striped mid-section (Captain America Comics #1, 1941, Simon and Kirby); the round
 * shield, concentric rings round a star (Captain America Comics #2, 1941). The face under the cowl is the shared,
 * anonymous statue face, never an actor's.
 */
import { sphere, ellipsoid, capsule, roundCone, box, cylinder, star, smooth, union, cut, intersect, shell, inflate, relief, paint, move, rotate, mirrorX, halfSpace, bound } from '../sdf.mjs';
import { statueHead, statueTorso, plinth, figureBody, figureHead, figureBase, L } from '../body.mjs';

const SKIN = 0, SUIT = 1, SILVER = 2, RED = 3, WHITE = 4, STONE = 5, SHADOW = 6, EYE = 7;

/** Three swept feathers: the wings on the cowl. */
function wing(mat, s = 1) {
  return union(...[0, 1, 2].map((i) => roundCone(L(0, -i * 0.007 * s, 0), L(-0.012 * s, 0.012 * s - i * 0.009 * s, -(0.042 - i * 0.008) * s), 0.0035 * s, 0.0012 * s, mat)));
}

/** The letter A, raised, facing +Z, about h tall. */
function letterA(h, t, mat) {
  const w = h * 0.38;
  return union(
    capsule(L(-w, -h / 2, 0), L(0, h / 2, 0), t, mat),
    capsule(L(w, -h / 2, 0), L(0, h / 2, 0), t, mat),
    capsule(L(-w * 0.52, -h * 0.08, 0), L(w * 0.52, -h * 0.08, 0), t * 0.9, mat),
  );
}

/** The shield: a shallow dish of concentric rings round a star. Radius r, facing +Z. */
function shield(r, mats) {
  const { red, white, blue, silver } = mats;
  // a dish: a thin slice of a large sphere, rim rolled
  const R = r * 2.6;
  let dish = intersect(shell(move(sphere(R, red), 0, 0, -R + r * 0.12), r * 0.025), rotate(cylinder(r * 0.3, r, r * 0.02, red), 90, 0, 0));
  dish = paint(dish, (x, y) => {
    const q = Math.hypot(x, y) / r;
    return q < 0.42 ? blue : q < 0.62 ? red : q < 0.81 ? white : red;
  });
  // grooves between the rings, and the star standing proud in the middle
  dish = relief(dish, (x, y) => { const q = Math.hypot(x, y) / r; return [0.42, 0.62, 0.81].some((b) => Math.abs(q - b) < 0.008) ? 0.0012 : 0; });
  const st = move(star(r * 0.38, 0.42, r * 0.02, silver), 0, 0, r * 0.11);
  return smooth(r * 0.01, dish, st);
}

function statueBody() {
  const head = statueHead({ mat: SKIN });
  // the cowl: over the whole head and neck but the lower face; eye holes; the A and the wings
  const plain = statueHead({ mat: SUIT, face: false, ears: true });
  const lowerFace = smooth(0.012,
    move(ellipsoid(0.058, 0.052, 0.07, SUIT), 0, 1.552, 0.06),
    move(ellipsoid(0.035, 0.03, 0.05, SUIT), 0, 1.6, 0.08),
  );
  let cowl = cut(inflate(plain, 0.0032), lowerFace, 0.004);
  cowl = cut(cowl, mirrorX(move(ellipsoid(0.017, 0.0105, 0.04, SUIT), 0.031, 1.627, 0.09)), 0.003);
  cowl = intersect(cowl, move(halfSpace(0, -1, 0, SUIT), 0, 1.5, 0));
  const A = move(rotate(letterA(0.034, 0.0032, WHITE), -24, 0, 0), 0, 1.688, 0.086);
  const wings = mirrorX(move(rotate(wing(WHITE, 1), 0, 8, -14), 0.077, 1.655, 0.012));
  // the suit: high collar into the cowl, the star, the stripes, a hint of mail
  const torso = statueTorso({ mat: SUIT, build: 1.06 });
  const suit = paint(torso, (x, y, z) => {
    if (y < 1.235 && Math.abs(x) < 0.125 && z > -0.02) return Math.floor((x + 0.125) / 0.025) % 2 ? WHITE : RED;
    return SUIT;
  });
  const chestStar = move(rotate(star(0.05, 0.44, 0.005, SILVER), -8, 0, 0), 0, 1.318, 0.097);
  const collar = roundCone(L(0, 1.55, -0.016), L(0, 1.44, -0.01), 0.062, 0.074, SUIT);
  const body = union(smooth(0.008, smooth(0.01, head, cowl), collar, suit), A, wings, chestStar, plinth({ mat: STONE }));
  return bound(body, 0, 1.4, 0, 0.42);
}

function statueShield() {
  // carried on the back: a halo behind the shoulders, tipped back a little
  return move(rotate(shield(0.27, { red: RED, white: WHITE, blue: SUIT, silver: SILVER }), -8, 0, 0), 0, 1.45, -0.17);
}

const STATUE = [
  { name: 'skin', color: [0.32, 0.25, 0.21], rough: 0.5, sheen: 0.3 },
  { name: 'suit', color: [0.012, 0.02, 0.06], rough: 0.5, sheen: 0.6 },
  { name: 'silver', color: [0.7, 0.72, 0.74], metal: 1, rough: 0.28 },
  { name: 'red', color: [0.2, 0.015, 0.02], rough: 0.5 },
  { name: 'white', color: [0.45, 0.45, 0.44], rough: 0.45 },
  { name: 'stone', color: [0.02, 0.022, 0.024], rough: 0.6 },
  { name: 'shadow', color: [0.01, 0.01, 0.012], rough: 0.9 },
  { name: 'eye', color: [0.85, 0.85, 0.82], rough: 0.2 },
];

// THE COLLECTIBLE --------------------------------------------------------------------------------------------

function collectible() {
  const body = paint(figureBody({ skin: SKIN, suit: SUIT, boots: RED, gloves: RED, build: 1.12 }), (x, y, z, m) => {
    if (m === SUIT && y > 0.15 && y < 0.24 && Math.abs(x) < 0.1 && z > 0) return Math.floor((x + 0.1) / 0.025) % 2 ? WHITE : RED;
    return m;
  });
  const head = figureHead({ skin: SKIN, eyes: SHADOW });
  // the cowl over the top of the head, open from the eyes down; the A and the wings
  const top = intersect(inflate(move(ellipsoid(0.12, 0.125, 0.115, SUIT), 0, 0.48, 0), 0.006), move(halfSpace(0, -1, 0, SUIT), 0, 0.468, 0));
  const back = cut(inflate(move(ellipsoid(0.12, 0.125, 0.115, SUIT), 0, 0.48, 0), 0.006), move(ellipsoid(0.11, 0.1, 0.14, SUIT), 0, 0.44, 0.06), 0.01);
  let cowl = cut(union(top, back), mirrorX(move(ellipsoid(0.026, 0.028, 0.06, SUIT), 0.042, 0.488, 0.1)), 0.004);
  const A = move(rotate(letterA(0.05, 0.0055, WHITE), -30, 0, 0), 0, 0.565, 0.088);
  const wings = mirrorX(move(rotate(wing(WHITE, 1.6), 0, 10, -14), 0.118, 0.5, 0.01));
  const chestStar = move(star(0.04, 0.44, 0.006, WHITE), 0, 0.29, 0.078);
  // the shield on the left arm, facing out
  const sh = move(rotate(shield(0.13, { red: RED, white: WHITE, blue: SUIT, silver: WHITE }), 0, 22, 0), -0.17, 0.2, 0.08);
  return union(smooth(0.006, head, cowl), body, A, wings, chestStar, sh, figureBase(STONE));
}

const VINYL = [
  { name: 'skin', color: [0.88, 0.68, 0.56], rough: 0.4 },
  { name: 'suit', color: [0.03, 0.07, 0.32], rough: 0.32, clearcoat: 0.8 },
  { name: 'silver', color: [0.8, 0.82, 0.85], metal: 1, rough: 0.25 },
  { name: 'red', color: [0.5, 0.012, 0.018], rough: 0.32, clearcoat: 0.8 },
  { name: 'white', color: [0.92, 0.92, 0.9], rough: 0.32, clearcoat: 0.8 },
  { name: 'base', color: [0.9, 0.9, 0.92], rough: 0.3, clearcoat: 1 },
  { name: 'shadow', color: [0.03, 0.03, 0.04], rough: 0.2 },
  { name: 'eye', color: [0.03, 0.03, 0.04], rough: 0.1 },
];

export default {
  statue: {
    build: () => ({
      parts: [{ name: 'body', sdf: statueBody() }, { name: 'shield', sdf: statueShield(), pivot: [0, 1.45, -0.17] }],
      materials: STATUE, focus: [0, 1.43, 0], face: [0, 1.6, 0.02], frame: 1.5,
      look: { bg: [0.012, 0.014, 0.02], rimColor: [0.7, 0.8, 1], rimI: 0.9, keyI: 1.1, ambient: 0.18 },
      bounds: [[-0.3, 0.96, -0.25], [0.3, 1.8, 0.2]],
    }),
  },
  collectible: {
    build: () => ({
      parts: [{ name: 'body', sdf: collectible() }],
      materials: VINYL, focus: [0, 0.3, 0], face: [0, 0.47, 0.02], frame: 1.6,
      look: { bg: [0.1, 0.2, 0.45], rimColor: [0.85, 0.9, 1], ambient: 0.32 },
      bounds: [[-0.32, -0.03, -0.2], [0.26, 0.66, 0.2]],
    }),
  },
};
