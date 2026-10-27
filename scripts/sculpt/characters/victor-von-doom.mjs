/**
 * Victor von Doom (CLAUDE.md, "3D characters"). Sources: the iron mask he forged and pressed on while hot
 * (Fantastic Four Annual #2, 1964); the armour, green tunic, hood and cloak (Fantastic Four #5, 1962, Kirby).
 * The mask is a separate part, so it can lift away; the face under it is never shown.
 */
import { sphere, ellipsoid, capsule, roundCone, box, cylinder, torus, smooth, union, cut, intersect, shell, inflate, relief, paint, move, rotate, mirrorX, around, halfSpace, bound } from '../sdf.mjs';
import { statueHead, statueTorso, plinth, figureBody, figureHead, figureBase, L } from '../body.mjs';

const IRON = 0, CLOTH = 1, SHADOW = 2, GLOW = 3, STONE = 4, CHAIN = 5;
const MATERIALS = [
  { name: 'iron', color: [0.5, 0.52, 0.52], metal: 1, rough: 0.38 },
  { name: 'cloth', color: [0.008, 0.026, 0.014], rough: 0.85, sheen: 0.8 },
  { name: 'shadow', color: [0.012, 0.014, 0.014], rough: 0.9 },
  { name: 'glow', color: [0.25, 1, 0.55], rough: 0.5, glow: 2.2 },
  { name: 'stone', color: [0.02, 0.022, 0.024], rough: 0.6 },
  { name: 'chain', color: [0.62, 0.6, 0.52], metal: 1, rough: 0.3 },
];

/** The iron mask over the statue's face. */
function statueMask() {
  const face = statueHead({ mat: IRON, face: false, ears: false });
  // a plate following the face, from the brow to under the chin, wrapping back to the cheeks
  let mask = intersect(inflate(face, 0.0065), move(halfSpace(0, 0, -1, IRON), 0, 0, -0.012));
  mask = intersect(mask, move(halfSpace(0, 1, 0, IRON), 0, 1.7, 0));
  mask = intersect(mask, move(halfSpace(0, -1, 0, IRON), 0, 1.508, 0));
  // the stern brow, a hard V down to the nose; a straight, sharp nose
  const brow = mirrorX(roundCone(L(0.062, 1.652, 0.07), L(0.006, 1.637, 0.1), 0.0085, 0.0072, IRON));
  const nose = roundCone(L(0, 1.637, 0.1), L(0, 1.586, 0.116), 0.0062, 0.0105, IRON);
  const noseBase = move(box(0.013, 0.006, 0.01, 0.005, IRON), 0, 1.584, 0.108);
  const cheekPlate = mirrorX(move(rotate(box(0.026, 0.03, 0.01, 0.008, IRON), 0, 32, -6), 0.048, 1.574, 0.073));
  mask = smooth(0.006, mask, brow, nose, noseBase);
  mask = smooth(0.012, mask, cheekPlate);
  // eye slits and the mouth slot are cut through to the dark; the eyes glow faintly green inside
  const slit = mirrorX(move(rotate(box(0.019, 0.0042, 0.04, 0.0015, IRON), 0, 0, 6), 0.032, 1.6265, 0.1));
  mask = cut(mask, slit, 0.0015, SHADOW);
  const mouth = move(box(0.024, 0.0042, 0.04, 0.0015, IRON), 0, 1.5565, 0.11);
  mask = cut(mask, mouth, 0.0015, SHADOW);
  const grille = union(...[-0.016, -0.008, 0, 0.008, 0.016].map((x) => move(box(0.0017, 0.0048, 0.006, 0.0008, IRON), x, 1.5565, 0.093)));
  mask = union(mask, grille);
  // seams where the plates meet, and rivets down the cheeks and at the temples
  const seam = mirrorX(union(
    capsule(L(0.054, 1.612, 0.074), L(0.04, 1.535, 0.083), 0.0012, IRON),
    capsule(L(0.022, 1.6, 0.098), L(0.03, 1.545, 0.093), 0.0011, IRON),
  ));
  mask = cut(mask, seam, 0.0008, SHADOW);
  const rivets = mirrorX(union(...[[0.063, 1.6], [0.06, 1.578], [0.055, 1.556], [0.047, 1.536], [0.068, 1.648], [0.067, 1.67]].map(([x, y]) => move(sphere(0.0036, IRON), x, y, (x > 0.065 ? 0.04 : 0.06) + (1.6 - y) * 0.2))));
  mask = smooth(0.0015, mask, rivets);
  const eyes = mirrorX(move(ellipsoid(0.012, 0.0028, 0.004, GLOW), 0.032, 1.6262, 0.079));
  return bound(union(mask, eyes), 0, 1.6, 0.04, 0.13);
}

/** Hood, cloak, collar, tunic and armour. */
function statueBody() {
  // what shows through any gap is shadow
  const headCore = statueHead({ mat: SHADOW, face: false, ears: false });
  // the hood: a heavy cowl around the head, open at the front to frame the mask, falling into the cloak
  const cowl = move(rotate(ellipsoid(0.112, 0.124, 0.13, CLOTH), -8, 0, 0), 0, 1.648, -0.004);
  const drape = roundCone(L(0, 1.6, -0.03), L(0, 1.4, -0.045), 0.118, 0.17, CLOTH);
  let hood = shell(smooth(0.06, cowl, drape), 0.006);
  hood = cut(hood, move(rotate(ellipsoid(0.07, 0.1, 0.12, CLOTH), 10, 0, 0), 0, 1.595, 0.11), 0.012, SHADOW);
  hood = cut(hood, move(box(0.06, 0.12, 0.12, 0.04, CLOTH), 0, 1.4, 0.16), 0.02, SHADOW);
  hood = intersect(hood, move(halfSpace(0, -1, 0, CLOTH), 0, 1.33, 0));
  // a thick rolled rim round the hood's opening
  const rim = intersect(shell(move(rotate(ellipsoid(0.078, 0.107, 0.125, CLOTH), 10, 0, 0), 0, 1.595, 0.11), 0.0055), shell(smooth(0.06, cowl, drape), 0.014));
  // the cloak over the shoulders and down the back, open at the front, in heavy vertical folds
  const torso = statueTorso({ mat: CLOTH, cutY: 1.12, build: 1.04 });
  let cloak = intersect(shell(inflate(torso, 0.02), 0.0055), move(halfSpace(0, -1, 0, CLOTH), 0, 1.15, 0));
  cloak = cut(cloak, move(box(0.11, 0.2, 0.12, 0.05, CLOTH), 0, 1.26, 0.13), 0.03, SHADOW);
  cloak = relief(cloak, (x, y, z) => (y < 1.4 ? Math.sin(Math.atan2(x, -z) * 13 + y * 9) * 0.0045 * Math.min(1, (1.4 - y) * 8) : 0));
  // under the cloak: the green tunic over the chest, the iron collar round the neck
  const chest = statueTorso({ mat: CLOTH, cutY: 1.12 });
  const tunic = paint(chest, (x, y, z) => (Math.abs(x) > 0.14 || y > 1.43 ? IRON : CLOTH));
  const gorget = move(union(
    shell(cylinder(0.04, 0.08, 0.01, IRON), 0.006),
    move(torus(0.082, 0.007, IRON), 0, 0.04, 0),
    move(around(move(sphere(0.0045, IRON), 0.087, 0, 0), 14), 0, 0.012, 0),
  ), 0, 1.49, -0.01);
  // the clasps that hold the cloak, joined by a chain
  const clasp = mirrorX(move(rotate(union(cylinder(0.005, 0.024, 0.003, IRON), move(cylinder(0.003, 0.016, 0.002, IRON), 0, 0.006, 0)), 90, 0, 0), 0.105, 1.395, 0.09));
  const links = union(...Array.from({ length: 9 }, (_, i) => {
    const t = (i + 0.5) / 9, x = -0.09 + t * 0.18, y = 1.392 - Math.sin(t * Math.PI) * 0.03;
    return move(rotate(torus(0.0065, 0.0016, CHAIN), 90, 0, i % 2 ? 90 : 0), x, y, 0.1);
  }));
  const body = union(headCore, smooth(0.008, hood, rim), cloak, tunic, gorget, clasp, links, plinth({ mat: STONE }));
  return body;
}

// THE COLLECTIBLE --------------------------------------------------------------------------------------------

const VINYL = [
  { name: 'iron', color: [0.62, 0.64, 0.66], metal: 1, rough: 0.28 },
  { name: 'cloth', color: [0.015, 0.11, 0.045], rough: 0.4, clearcoat: 0.5 },
  { name: 'shadow', color: [0.02, 0.025, 0.025], rough: 0.6 },
  { name: 'glow', color: [0.4, 1, 0.6], rough: 0.4, glow: 1.6 },
  { name: 'base', color: [0.08, 0.09, 0.1], rough: 0.35, clearcoat: 1 },
  { name: 'gold', color: [0.85, 0.66, 0.3], metal: 1, rough: 0.3 },
];

function collectible() {
  const body = figureBody({ skin: IRON, suit: CLOTH, boots: IRON, gloves: IRON, build: 1.08 });
  const head = figureHead({ skin: IRON, face: false });
  // the mask: a flat iron face, slits for eyes and mouth, the brow in a frown
  let mask = head;
  mask = smooth(0.006, mask, mirrorX(roundCone(L(0.075, 0.51, 0.09), L(0.01, 0.493, 0.118), 0.011, 0.009, IRON)));
  mask = smooth(0.006, mask, roundCone(L(0, 0.493, 0.118), L(0, 0.452, 0.13), 0.008, 0.014, IRON));
  mask = cut(mask, mirrorX(move(rotate(box(0.022, 0.0055, 0.04, 0.002, IRON), 0, 0, 6), 0.043, 0.484, 0.11)), 0.002, SHADOW);
  mask = cut(mask, move(box(0.03, 0.005, 0.05, 0.002, IRON), 0, 0.418, 0.11), 0.002, SHADOW);
  mask = union(mask, mirrorX(move(ellipsoid(0.014, 0.0035, 0.004, GLOW), 0.043, 0.484, 0.098)));
  mask = smooth(0.002, mask, mirrorX(union(...[[0.09, 0.44], [0.085, 0.415], [0.075, 0.395]].map(([x, y]) => move(sphere(0.0055, IRON), x, y, 0.06)))));
  // hood and cloak: a big rounded cowl and a cape to the ankles
  const cowl = move(ellipsoid(0.148, 0.148, 0.15, CLOTH), 0, 0.478, -0.012);
  let hood = shell(cowl, 0.008);
  hood = cut(hood, move(ellipsoid(0.105, 0.12, 0.14, CLOTH), 0, 0.46, 0.11), 0.015, SHADOW);
  let cape = shell(roundCone(L(0, 0.37, -0.03), L(0, 0.1, -0.055), 0.11, 0.145, CLOTH), 0.007);
  cape = intersect(cape, move(halfSpace(0, -1, 0, CLOTH), 0, 0.035, 0));
  cape = cut(cape, move(box(0.1, 0.22, 0.15, 0.06, CLOTH), 0, 0.2, 0.11), 0.03, SHADOW);
  cape = relief(cape, (x, y, z) => Math.sin(Math.atan2(x, -z) * 9) * 0.006 * Math.min(1, (0.34 - y) * 4));
  // a green tunic with a belt; the clasp chain at the collar
  const tunic = move(roundCone(L(0, 0.3, 0), L(0, 0.13, 0.002), 0.095, 0.112, CLOTH), 0, 0, 0);
  const belt = move(torus(0.1, 0.012, VINYL.findIndex((m) => m.name === 'gold')), 0, 0.165, 0.005);
  const links = mirrorX(move(rotate(cylinder(0.004, 0.02, 0.002, 5), 90, 0, 0), 0.085, 0.36, 0.085));
  return union(smooth(0.01, body, tunic), mask, hood, cape, belt, links, figureBase(4));
}

export default {
  statue: {
    build: () => ({
      parts: [{ name: 'body', sdf: statueBody() }, { name: 'mask', sdf: statueMask(), pivot: [0, 1.6, 0.04], cell: 0.0011, tris: 70000 }],
      materials: MATERIALS, focus: [0, 1.43, 0], face: [0, 1.6, 0.02], frame: 1.45,
      look: { bg: [0.012, 0.014, 0.014], rimColor: [0.55, 1, 0.7], rimI: 0.9, keyI: 1.05, ambient: 0.16 },
      bounds: [[-0.27, 0.96, -0.2], [0.27, 1.8, 0.2]],
    }),
  },
  collectible: {
    build: () => ({
      parts: [{ name: 'body', sdf: collectible() }],
      materials: VINYL, focus: [0, 0.3, 0], face: [0, 0.47, 0.02], frame: 1.6,
      look: { bg: [0.06, 0.32, 0.17], rimColor: [0.8, 1, 0.85], ambient: 0.32 },
      bounds: [[-0.24, -0.03, -0.2], [0.24, 0.66, 0.2]],
    }),
  },
};
