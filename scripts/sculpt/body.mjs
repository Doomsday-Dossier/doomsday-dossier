/**
 * The shared anatomy every character is sculpted on (CLAUDE.md, "3D characters"): one idealised, anonymous
 * heroic figure, never an actor's likeness. A character is recognised by what goes over it: mask, helmet, hood,
 * hair, armour and gear. Two builds: the statue bust (realistic proportions, a gallery maquette) and the
 * collectible figure (chunky, big head, full body). Head centre near (0, 1.62, 0) for the statue.
 */
import { sphere, ellipsoid, capsule, roundCone, box, cylinder, smooth, union, cut, intersect, move, rotate, rotateAt, mirrorX, halfSpace, inflate, paint } from './sdf.mjs';

const L = (x, y, z) => [x, y, z];

/** The statue's head. `mat` is the skin material; options leave out parts a mask or helmet covers. */
export function statueHead({ mat = 0, ears = true, face = true } = {}) {
  const cranium = move(ellipsoid(0.078, 0.08, 0.096, mat), 0, 1.662, -0.016);
  const back = move(ellipsoid(0.07, 0.07, 0.07, mat), 0, 1.655, -0.045);
  const faceMass = move(ellipsoid(0.064, 0.08, 0.068, mat), 0, 1.6, 0.03);
  const temple = mirrorX(move(ellipsoid(0.02, 0.03, 0.035, mat), 0.06, 1.645, 0.035));
  // a square, heroic jaw: the ramus down from the ear, the jawline forward to a broad chin
  const ramus = mirrorX(roundCone(L(0.062, 1.6, -0.005), L(0.055, 1.548, 0.012), 0.016, 0.015, mat));
  const jawline = mirrorX(roundCone(L(0.054, 1.548, 0.014), L(0.02, 1.522, 0.07), 0.016, 0.017, mat));
  const chin = move(rotate(box(0.019, 0.013, 0.012, 0.011, mat), -10, 0, 0), 0, 1.522, 0.077);
  const cheek = mirrorX(move(ellipsoid(0.027, 0.018, 0.023, mat), 0.045, 1.604, 0.058));
  const fill = mirrorX(move(ellipsoid(0.025, 0.025, 0.025, mat), 0.04, 1.575, 0.05));
  const brow = capsule(L(-0.04, 1.646, 0.084), L(0.04, 1.646, 0.084), 0.0105, mat);
  const browOuter = mirrorX(capsule(L(0.03, 1.647, 0.084), L(0.058, 1.641, 0.066), 0.0095, mat));
  let head = smooth(0.028, cranium, back, faceMass, temple);
  head = smooth(0.016, head, ramus, jawline, chin);
  head = smooth(0.012, head, cheek, brow, browOuter);
  head = smooth(0.02, head, fill);
  if (face) {
    // eyes: sockets pressed in under the brow, the eyeballs set back, heavy upper lids, a statue's blank gaze
    head = cut(head, mirrorX(move(ellipsoid(0.0165, 0.0105, 0.009, mat), 0.031, 1.627, 0.089)), 0.012);
    const eye = mirrorX(move(sphere(0.0118, mat), 0.031, 1.6255, 0.0768));
    const lid = mirrorX(move(rotate(ellipsoid(0.0138, 0.0062, 0.0108, mat), 12, 0, 0), 0.031, 1.6322, 0.0802));
    head = smooth(0.004, head, eye, lid);
    // nose: bridge, tip and wings
    const bridge = roundCone(L(0, 1.638, 0.087), L(0, 1.597, 0.1035), 0.0082, 0.0095, mat);
    const tip = move(sphere(0.0098, mat), 0, 1.5925, 0.1045);
    const wing = mirrorX(move(ellipsoid(0.0085, 0.0072, 0.0085, mat), 0.0115, 1.589, 0.096));
    head = smooth(0.008, head, bridge, tip, wing);
    head = cut(head, mirrorX(move(ellipsoid(0.0028, 0.002, 0.0035, mat), 0.0085, 1.5838, 0.1022)), 0.003);
    // mouth: full lips over a soft line, the philtrum, the corners
    const muzzle = move(ellipsoid(0.03, 0.022, 0.016, mat), 0, 1.566, 0.083);
    const lips = move(ellipsoid(0.021, 0.011, 0.0088, mat), 0, 1.5625, 0.0925);
    head = smooth(0.01, head, muzzle);
    head = smooth(0.006, head, lips);
    head = cut(head, move(ellipsoid(0.02, 0.0007, 0.008, mat), 0, 1.5625, 0.1005), 0.0025);
    head = cut(head, move(ellipsoid(0.012, 0.0035, 0.006, mat), 0, 1.5465, 0.093), 0.009); // under the lower lip
  }
  if (ears) {
    const ear = mirrorX(move(rotate(ellipsoid(0.01, 0.027, 0.016, mat), 0, -20, 0), 0.074, 1.614, -0.008));
    head = smooth(0.009, head, cut(ear, mirrorX(move(rotate(ellipsoid(0.005, 0.016, 0.008, mat), 0, -20, 0), 0.08, 1.612, -0.006)), 0.006));
  }
  return head;
}

/** Neck, shoulders and chest of the statue bust, cut flat below the chest. */
export function statueTorso({ mat = 0, cutY = 1.12, build = 1 } = {}) {
  const b = build;
  const neck = roundCone(L(0, 1.565, -0.016), L(0, 1.43, -0.01), 0.06, 0.072 * b, mat);
  const scm = mirrorX(roundCone(L(0.045, 1.555, -0.01), L(0.014, 1.44, 0.035), 0.012, 0.014, mat));
  const trap = mirrorX(roundCone(L(0.035, 1.52, -0.04), L(0.165 * b, 1.415, -0.03), 0.036, 0.045, mat));
  const chest = move(ellipsoid(0.165 * b, 0.15, 0.098 * b, mat), 0, 1.285, -0.012);
  const pec = mirrorX(move(rotate(ellipsoid(0.078 * b, 0.05, 0.034, mat), 6, -10, -10), 0.064 * b, 1.322, 0.052));
  const delt = mirrorX(move(rotate(ellipsoid(0.058 * b, 0.072, 0.06 * b, mat), 0, 0, 18), 0.185 * b, 1.365, -0.008));
  const arm = mirrorX(roundCone(L(0.198 * b, 1.35, -0.008), L(0.218 * b, 1.1, -0.022), 0.052 * b, 0.045 * b, mat));
  const lat = mirrorX(move(ellipsoid(0.05, 0.11, 0.07, mat), 0.13 * b, 1.24, -0.035));
  const abdomen = move(ellipsoid(0.125 * b, 0.12, 0.082 * b, mat), 0, 1.15, 0.0);
  const clav = mirrorX(capsule(L(0.03, 1.436, 0.04), L(0.15 * b, 1.426, 0.006), 0.007, mat));
  const fossa = mirrorX(move(ellipsoid(0.06, 0.03, 0.05, mat), 0.095 * b, 1.432, -0.005)); // fills the hollow above the collarbone
  const nape = move(ellipsoid(0.06, 0.07, 0.05, mat), 0, 1.47, -0.045);
  let t = smooth(0.045, chest, delt, arm, lat, abdomen, trap, fossa, nape);
  t = smooth(0.05, t, pec);
  t = smooth(0.025, t, neck, scm);
  t = smooth(0.022, t, clav);
  t = cut(t, capsule(L(0, 1.39, 0.085), L(0, 1.24, 0.095), 0.004, mat), 0.02); // the line between the pecs
  return intersect(t, move(halfSpace(0, -1, 0, mat), 0, cutY, 0), 0.005);
}

/** A gallery plinth under the bust. */
export function plinth({ mat = 0, y = 1.12 } = {}) {
  return union(
    move(cylinder(0.02, 0.085, 0.006, mat), 0, y - 0.02, 0),
    move(cylinder(0.035, 0.065, 0.004, mat), 0, y - 0.075, 0),
    move(box(0.12, 0.022, 0.12, 0.006, mat), 0, y - 0.13, 0),
  );
}

/** The whole statue bust: head on torso on plinth. */
export function statueBust({ skin = 0, stone = 0, head = {}, torso = {} } = {}) {
  return smooth(0.025, statueHead({ mat: skin, ...head }), statueTorso({ mat: skin, ...torso }));
}

// THE COLLECTIBLE FIGURE: about 0.6 m tall, head a third of it, standing on a round base ------------------------

/** A chunky full figure. Head centre near (0, 0.47, 0); feet at y = 0. */
export function figureBody({ skin = 0, suit = 1, boots = 2, gloves = 3, build = 1 } = {}) {
  const b = build;
  const torso = smooth(0.04,
    move(ellipsoid(0.105 * b, 0.1, 0.075, suit), 0, 0.27, 0),
    move(ellipsoid(0.09 * b, 0.07, 0.068, suit), 0, 0.19, 0.003),
    mirrorX(move(sphere(0.045 * b, suit), 0.1 * b, 0.32, 0)),
  );
  const neck = capsule(L(0, 0.34, 0), L(0, 0.39, 0), 0.03, skin);
  const arm = mirrorX(smooth(0.03,
    roundCone(L(0.115 * b, 0.31, 0), L(0.15 * b, 0.2, 0.01), 0.036 * b, 0.032 * b, suit),
    roundCone(L(0.15 * b, 0.2, 0.01), L(0.16 * b, 0.12, 0.04), 0.032 * b, 0.03 * b, suit),
  ));
  const hand = mirrorX(move(sphere(0.034 * b, gloves), 0.162 * b, 0.1, 0.05));
  const leg = mirrorX(smooth(0.03,
    roundCone(L(0.05 * b, 0.16, 0), L(0.058 * b, 0.08, 0.005), 0.045 * b, 0.04 * b, suit),
    roundCone(L(0.058 * b, 0.08, 0.005), L(0.06 * b, 0.035, 0.01), 0.04 * b, 0.036 * b, boots),
  ));
  const foot = mirrorX(move(box(0.035 * b, 0.02, 0.055, 0.018, boots), 0.06 * b, 0.02, 0.025));
  return smooth(0.02, torso, neck, arm, hand, leg, foot);
}

/** The collectible's big round head: an anonymous face with simple features. */
export function figureHead({ skin = 0, eyes = 4, face = true } = {}) {
  let h = smooth(0.04,
    move(ellipsoid(0.12, 0.125, 0.115, skin), 0, 0.48, 0),
    move(ellipsoid(0.095, 0.075, 0.09, skin), 0, 0.43, 0.025),
  );
  if (face) {
    h = smooth(0.01, h, move(ellipsoid(0.014, 0.012, 0.012, skin), 0, 0.455, 0.122));
    const eye = mirrorX(move(ellipsoid(0.017, 0.021, 0.008, eyes), 0.042, 0.488, 0.108));
    h = union(h, eye);
    h = smooth(0.008, h, mirrorX(capsule(L(0.03, 0.518, 0.108), L(0.058, 0.514, 0.098), 0.006, skin)));
  }
  return h;
}

/** The round display base the collectible stands on. */
export function figureBase(mat) {
  return move(cylinder(0.012, 0.16, 0.008, mat), 0, -0.012, 0);
}

export { L };
