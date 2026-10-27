/**
 * Thor (CLAUDE.md, "3D characters"). Sources: the winged helmet, the six discs on the chest, the red cape and
 * Mjolnir (Journey into Mystery #83, 1962, Kirby); the long hair and beard of his later runs (Thor: God of
 * Thunder, 2012). The face is the shared anonymous statue face behind a beard, never an actor's.
 */
import { mirrorY, mirrorZ, sphere, ellipsoid, capsule, roundCone, box, cylinder, torus, smooth, union, cut, intersect, shell, inflate, relief, paint, move, rotate, mirrorX, halfSpace, bound } from '../sdf.mjs';
import { statueHead, statueTorso, plinth, figureBody, figureHead, figureBase, L } from '../body.mjs';

const SKIN = 0, ARMOUR = 1, STEEL = 2, HAIR = 3, CAPE = 4, STONE = 5, LEATHER = 6, SHADOW = 7;

/** A big swept wing of stacked feathers, pointing back (-Z) and up. */
function bigWing(mat, s = 1) {
  return union(...[0, 1, 2, 3].map((i) => roundCone(L(0, -i * 0.006 * s, 0), L(-0.008 * s, (0.04 - i * 0.012) * s, -(0.07 - i * 0.012) * s), 0.0045 * s, 0.0014 * s, mat)));
}

/** Mjolnir, handle along -Y from the head, centred on the head. */
function hammer(s, mats) {
  const { steel, leather } = mats;
  let head = box(0.058 * s, 0.034 * s, 0.034 * s, 0.006 * s, steel);
  // the panels inset on each face of the head, and the rim round each end
  head = cut(head, union(
    mirrorZ(move(box(0.04 * s, 0.021 * s, 0.004 * s, 0.002 * s, steel), 0, 0, 0.034 * s)),
    mirrorY(move(box(0.04 * s, 0.004 * s, 0.021 * s, 0.002 * s, steel), 0, 0.034 * s, 0)),
  ), 0.0015 * s);
  head = smooth(0.003 * s, head, mirrorX(move(rotate(cylinder(0.003 * s, 0.03 * s, 0.002 * s, steel), 0, 0, 90), 0.056 * s, 0, 0)));
  const handle = relief(move(cylinder(0.075 * s, 0.009 * s, 0.003 * s, leather), 0, -0.105 * s, 0), (x, y) => (Math.sin(y / s * 520) > 0.6 ? -0.0006 * s : 0));
  const pommel = move(cylinder(0.006 * s, 0.012 * s, 0.003 * s, steel), 0, -0.185 * s, 0);
  const strap = move(rotate(torus(0.016 * s, 0.0022 * s, leather), 90, 0, 0), 0, -0.205 * s, 0);
  return union(head, smooth(0.004 * s, handle, pommel), strap);
}

/** Long hair: locks from the crown down behind the neck and over the shoulders, combed in strands. */
function statueHair() {
  const locks = [];
  for (let i = 0; i < 15; i++) {
    const a = -1.45 + (i / 14) * 2.9; // around the back of the head, ear to ear
    const sx = Math.sin(a), sz = -Math.cos(a);
    locks.push(roundCone(L(sx * 0.07, 1.665, sz * 0.085 - 0.012), L(sx * 0.118, 1.43 + Math.abs(sx) * 0.02, sz * 0.075 - 0.045), 0.03, 0.022, HAIR));
  }
  // two locks fall forward over each shoulder
  locks.push(mirrorX(roundCone(L(0.07, 1.62, 0.01), L(0.12, 1.4, 0.05), 0.017, 0.013, HAIR)));
  // the hair over the scalp below the helmet, behind the ears
  const scalp = intersect(inflate(statueHead({ mat: HAIR, face: false, ears: false }), 0.006), move(halfSpace(0, 0, 1, HAIR), 0, 0, 0.02));
  let hair = smooth(0.03, scalp, ...locks);
  hair = relief(hair, (x, y, z) => Math.sin(Math.atan2(x, -z) * 60 + y * 25) * 0.0016);
  return hair;
}

function statueBody() {
  const head = statueHead({ mat: SKIN, ears: false });
  // the helmet: a steel cap with a band, and the wings
  const plain = statueHead({ mat: STEEL, face: false, ears: false });
  let helm = intersect(inflate(plain, 0.008), move(halfSpace(0, -1, 0, STEEL), 0, 1.662, 0));
  const band = intersect(shell(inflate(plain, 0.0095), 0.0035), intersect(move(halfSpace(0, -1, 0, STEEL), 0, 1.664, 0), move(halfSpace(0, 1, 0, STEEL), 0, 1.68, 0)));
  const wings = mirrorX(move(rotate(bigWing(STEEL, 1.75), 0, 16, -14), 0.084, 1.672, -0.004));
  // beard and moustache over the lower face
  const beard = relief(smooth(0.02,
    move(ellipsoid(0.067, 0.045, 0.07, HAIR), 0, 1.548, 0.035),
    move(ellipsoid(0.03, 0.03, 0.025, HAIR), 0, 1.515, 0.075),
    mirrorX(move(ellipsoid(0.02, 0.04, 0.03, HAIR), 0.055, 1.585, 0.035)),
  ), (x, y, z) => Math.sin(x * 900 + y * 120) * 0.0009);
  const lipsWindow = move(ellipsoid(0.02, 0.012, 0.03, HAIR), 0, 1.561, 0.105);
  const moustache = mirrorX(roundCone(L(0.004, 1.574, 0.1), L(0.024, 1.556, 0.092), 0.0055, 0.0035, HAIR));
  const face = smooth(0.006, cut(beard, lipsWindow, 0.006), moustache);
  // the armour: dark scales, six discs down the chest, the cape clasped at the shoulders
  const torso = statueTorso({ mat: ARMOUR, build: 1.1 });
  const disc = (x, y, z, tilt) => move(rotate(union(cylinder(0.0045, 0.022, 0.002, STEEL), move(torus(0.015, 0.0018, STEEL), 0, 0.0045, 0)), 90 - tilt, 0, 0), x, y, z);
  const discs = mirrorX(union(disc(0.057, 1.372, 0.084, 10), disc(0.059, 1.312, 0.094, 2), disc(0.055, 1.252, 0.088, -8)));
  let cape = intersect(shell(inflate(statueTorso({ mat: CAPE, build: 1.1 }), 0.024), 0.006), move(halfSpace(0, 0, 1, CAPE), 0, 0, 0.035));
  cape = intersect(cape, move(halfSpace(0, -1, 0, CAPE), 0, 1.15, 0));
  cape = relief(cape, (x, y, z) => (z < 0 ? Math.sin(x * 55) * 0.004 * Math.min(1, (1.42 - y) * 6) : 0));
  const clasps = mirrorX(move(rotate(cylinder(0.006, 0.02, 0.003, STEEL), 90, -30, 0), 0.155, 1.405, 0.05));
  const body = union(smooth(0.006, head, face), helm, band, wings, statueHair(), torso, discs, cape, clasps, plinth({ mat: STONE }));
  return bound(body, 0, 1.4, 0, 0.45);
}

function statueHammer() {
  return move(rotate(hammer(1.15, { steel: STEEL, leather: LEATHER }), 0, -25, -18), 0.3, 1.36, 0.04);
}

const STATUE = [
  { name: 'skin', color: [0.32, 0.25, 0.21], rough: 0.5, sheen: 0.3 },
  { name: 'armour', color: [0.035, 0.04, 0.055], rough: 0.4, metal: 0.4 },
  { name: 'steel', color: [0.72, 0.74, 0.76], metal: 1, rough: 0.26 },
  { name: 'hair', color: [0.26, 0.17, 0.06], rough: 0.55, sheen: 0.7 },
  { name: 'cape', color: [0.16, 0.01, 0.015], rough: 0.8, sheen: 0.8 },
  { name: 'stone', color: [0.02, 0.022, 0.024], rough: 0.6 },
  { name: 'leather', color: [0.12, 0.07, 0.04], rough: 0.65 },
  { name: 'shadow', color: [0.01, 0.01, 0.012], rough: 0.9 },
];

// THE COLLECTIBLE --------------------------------------------------------------------------------------------

function collectible() {
  const body = figureBody({ skin: SKIN, suit: ARMOUR, boots: ARMOUR, gloves: ARMOUR, build: 1.15 });
  const head = figureHead({ skin: SKIN, eyes: SHADOW });
  const skull = move(ellipsoid(0.12, 0.125, 0.115, STEEL), 0, 0.48, 0);
  const helm = intersect(inflate(skull, 0.008), move(halfSpace(0, -1, 0, STEEL), 0, 0.53, 0));
  const wings = mirrorX(move(rotate(bigWing(STEEL, 1.7), 0, 14, -16), 0.118, 0.54, 0));
  let hair = smooth(0.02,
    move(ellipsoid(0.13, 0.12, 0.11, HAIR), 0, 0.46, -0.035),
    roundCone(L(0, 0.44, -0.06), L(0, 0.3, -0.07), 0.11, 0.09, HAIR),
  );
  hair = cut(hair, move(ellipsoid(0.11, 0.13, 0.12, HAIR), 0, 0.46, 0.07), 0.01);
  hair = relief(hair, (x, y, z) => Math.sin(Math.atan2(x, -z) * 26) * 0.003);
  const beard = smooth(0.015, move(ellipsoid(0.085, 0.05, 0.07, HAIR), 0, 0.41, 0.045), move(ellipsoid(0.04, 0.04, 0.03, HAIR), 0, 0.385, 0.085));
  const discs = mirrorX(union(...[0.31, 0.27, 0.23].map((y) => move(rotate(cylinder(0.005, 0.016, 0.003, STEEL), 90, 0, 0), 0.045, y, 0.075))));
  let cape = shell(roundCone(L(0, 0.35, -0.04), L(0, 0.06, -0.08), 0.1, 0.13, CAPE), 0.008);
  cape = intersect(cape, move(halfSpace(0, 0, 1, CAPE), 0, 0, -0.02));
  const ham = move(rotate(hammer(0.85, { steel: STEEL, leather: LEATHER }), 180, 0, 0), 0.18, 0.21, 0.05);
  return union(smooth(0.006, head, beard), helm, wings, hair, body, discs, cape, ham, figureBase(STONE));
}

const VINYL = [
  { name: 'skin', color: [0.9, 0.7, 0.58], rough: 0.4 },
  { name: 'armour', color: [0.05, 0.06, 0.09], rough: 0.3, clearcoat: 0.8 },
  { name: 'steel', color: [0.82, 0.84, 0.86], metal: 1, rough: 0.22 },
  { name: 'hair', color: [0.92, 0.7, 0.3], rough: 0.4, clearcoat: 0.5 },
  { name: 'cape', color: [0.75, 0.06, 0.07], rough: 0.35, clearcoat: 0.7 },
  { name: 'base', color: [0.9, 0.9, 0.92], rough: 0.3, clearcoat: 1 },
  { name: 'leather', color: [0.3, 0.18, 0.1], rough: 0.5 },
  { name: 'shadow', color: [0.03, 0.03, 0.04], rough: 0.2 },
];

export default {
  statue: {
    build: () => ({
      parts: [{ name: 'body', sdf: statueBody() }, { name: 'hammer', sdf: statueHammer(), pivot: [0.3, 1.36, 0.04] }],
      materials: STATUE, focus: [0, 1.43, 0], face: [0, 1.6, 0.02], frame: 1.5,
      look: { bg: [0.012, 0.014, 0.02], rimColor: [0.65, 0.8, 1], rimI: 1, keyI: 1.1, ambient: 0.18 },
      bounds: [[-0.3, 0.96, -0.22], [0.42, 1.82, 0.2]],
    }),
  },
  collectible: {
    build: () => ({
      parts: [{ name: 'body', sdf: collectible() }],
      materials: VINYL, focus: [0, 0.3, 0], face: [0, 0.47, 0.02], frame: 1.6,
      look: { bg: [0.12, 0.2, 0.34], rimColor: [0.85, 0.9, 1], ambient: 0.32 },
      bounds: [[-0.26, -0.03, -0.22], [0.3, 0.7, 0.2]],
    }),
  },
};
