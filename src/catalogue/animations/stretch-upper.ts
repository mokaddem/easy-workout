import type { AnimationPin, AnimationPose, AnimationProp, ExerciseAnimation } from '@/domain';
import {
  aim,
  body,
  during,
  feet,
  handOn,
  handOnWall,
  hinge,
  hold,
  palms,
  pose,
  seated,
  sidePlank,
  supine,
  support,
  STAND,
  wall,
} from './shared';

/** A held stretch breathes slowly: ease in, settle, ease back a little, rest. */
const SLOW = { eccentric: 2.4, pause: 0.8, concentric: 2, hold: 0.8 } as const;

/** A breathing drill: a long exhale, a slower pause, an inhale, a rest. */
const BREATH = { eccentric: 4.5, pause: 0.8, concentric: 3.5, hold: 0.8 } as const;

/** Kneeling: the shin lies on the floor behind the knee (ankle given from the origin). */
const KNEEL_FOOT = { ankle: [-0.41, 0.075] as [number, number], foot: 0 };

/** Kneeling on all fours: the spine in `lean`, the arms vertical (`arm` degrees). */
const allFours = (lean: number, extra: AnimationPose): AnimationPose =>
  pose(
    {
      root: { pos: [0, 0.472, 0], lean },
      hip: { plane: 90, elev: lean + 0.8 },
      knee: { flex: 90 },
      ankle: { flex: -70 },
      shoulder: { plane: 90, elev: 79 },
      elbow: { flex: 0 },
    },
    extra,
  );

/**
 * Kneeling sat back toward the heels, the trunk folded over the thighs (`lean` from upright, the
 * back curling `spine` and `chest` degrees more), the arms long overhead with the palms on the
 * floor and the forehead down between them.
 */
const childsPose = (hip: [number, number], lean: number, spine: number, chest: number) =>
  pose(
    body(
      hip,
      lean,
      { l: KNEEL_FOOT, r: KNEEL_FOOT },
      {
        'ankle.l': { flex: -70 },
        'ankle.r': { flex: -70 },
        spine: { flex: spine },
        chest: { flex: chest },
        neck: { flex: 34 },
        clav: { elev: 20 },
        'shoulder.l': { plane: 90, elev: 170 },
        'shoulder.r': { plane: 90, elev: 170 },
        elbow: { flex: 4 },
      },
    ),
  );

/** A door frame seen from the front: two jambs and a header in the plane x = 0, `half` either side. */
const doorFrame = (half = 0.46): AnimationProp[] => [
  {
    kind: 'box',
    id: 'jamb.l',
    group: 'door',
    equipment: 'door',
    min: [-0.04, 0, -half - 0.06],
    max: [0.04, 2.1, -half],
  },
  {
    kind: 'box',
    id: 'jamb.r',
    group: 'door',
    equipment: 'door',
    min: [-0.04, 0, half],
    max: [0.04, 2.1, half + 0.06],
  },
  {
    kind: 'box',
    id: 'header',
    group: 'door',
    equipment: 'door',
    min: [-0.04, 2.04, -half],
    max: [0.04, 2.1, half],
  },
];

/**
 * On the back, knees drawn up (`elev` at the hips, knees bent) and dropped to the right: the pelvis
 * rolls `roll` degrees with them (negative: onto its right side) and the back untwists as much, so
 * the shoulders stay flat with the arms out; the thighs `drop` further toward the floor at the
 * hips. Rolled this way, the root takes its turn and tilt as well as its lean, and the left leg
 * comes to lie on the right one.
 */
const twist = (roll: number, elev: number, drop = 0): AnimationPose =>
  pose(supine(), {
    root: {
      pos: [
        0,
        Math.round((0.098 + 0.06 * Math.sin((Math.abs(roll) * Math.PI) / 180)) * 1000) / 1000,
        0,
      ],
      lean: -(90 + roll),
      turn: -90,
      tilt: 90,
    },
    spine: { twist: Math.round(-roll * 4.5) / 10 },
    chest: { twist: Math.round(-roll * 5.5) / 10 },
    'hip.r': { plane: 90 - drop, elev, rot: 0 },
    'hip.l': { plane: 90 + drop, elev, rot: 0 },
    knee: { flex: 112 },
    neck: { flex: 8 },
    shoulder: { plane: 0, elev: 88 },
    elbow: { flex: 6 },
  });

export const stretchUpperAnimations = {
  'clasped-hands-chest-opener': {
    camera: { yaw: 5, pitch: 6 },
    poses: {
      into: pose(STAND, {
        clav: { prot: -4 },
        shoulder: aim([-0.5, -0.82, -0.3]),
        elbow: { flex: 4 },
        straight: ['arm.l', 'arm.r'],
      }),
      held: pose(STAND, {
        spine: { flex: -3 },
        chest: { flex: -10 },
        clav: { prot: -14 },
        shoulder: aim([-0.64, -0.74, -0.2]),
        elbow: { flex: 4 },
        straight: ['arm.l', 'arm.r'],
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: feet(),
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'standing-upper-back-reach': {
    camera: { yaw: 10, pitch: 6 },
    poses: {
      into: pose(STAND, {
        chest: { flex: 6 },
        clav: { prot: 8 },
        shoulder: aim([1, 0.02, -0.12]),
        elbow: { flex: 6 },
      }),
      held: pose(STAND, {
        spine: { flex: 5 },
        chest: { flex: 24 },
        neck: { flex: 10 },
        clav: { prot: 24 },
        shoulder: aim([1, 0.12, -0.12]),
        elbow: { flex: 6 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: feet(),
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'standing-wrist-flexor-stretch': {
    camera: { yaw: 160, pitch: 6 },
    poses: {
      into: pose(STAND, {
        chest: { twist: -8 },
        'shoulder.r': aim([1, 0.1, -0.5]),
        'elbow.r': { flex: 4, pron: 90 },
        'wrist.r': { flex: 0 },
        'shoulder.l': aim([0.7, -0.6, -0.1]),
        'elbow.l': { flex: 70 },
        straight: ['arm.r'],
      }),
      held: pose(STAND, {
        chest: { twist: -16 },
        'shoulder.r': aim([1, 0.1, -0.5]),
        'elbow.r': { flex: 4, pron: 90 },
        'wrist.r': { flex: 60 },
        'shoulder.l': aim([0.7, -0.6, -0.1]),
        'elbow.l': { flex: 70 },
        straight: ['arm.r'],
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), handOn('l', 'wrist.r', [0.0, -0.05, 0.0], [0, -1, -0.4])],
    props: [],
    working: ['arm.r'],
    perSide: true,
    neutral: SLOW,
  },

  'wall-pec-stretch': {
    camera: { yaw: 145, pitch: 28 },
    poses: {
      into: pose(STAND, {
        spine: { twist: 3 },
        chest: { twist: 10 },
        'shoulder.r': aim([0, 0.05, 1]),
        'elbow.r': { flex: 90 },
        'shoulder.l': { plane: 0, elev: 12 },
      }),
      held: pose(STAND, {
        spine: { twist: 8 },
        chest: { twist: 26 },
        neck: { flex: 0 },
        'clav.r': { prot: -8 },
        'shoulder.r': aim([0, 0.05, 1]),
        'elbow.r': { flex: 90 },
        'shoulder.l': { plane: 0, elev: 12 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), handOnWall([0.1, 1.57, 0.48], [0, 0, -1], [-0.3, -0.5, 0.3], 'r')],
    props: [wall([0, 0, 0.48], [0, 0, -1])],
    working: ['torso'],
    perSide: true,
    neutral: SLOW,
  },

  'doorway-pec-stretch': {
    camera: { yaw: 30, pitch: 6 },
    poses: {
      into: pose(STAND, {
        root: { pos: [-0.05, 0.9, 0] },
        'hip.r': { plane: 90, elev: 18 },
        'hip.l': { plane: 90, elev: -8 },
        'knee.r': { flex: 8 },
        'shoulder.r': aim([0, 0.05, 1]),
        'shoulder.l': aim([0, 0.05, 1]),
        elbow: { flex: 90 },
      }),
      held: pose(STAND, {
        root: { pos: [0.0, 0.9, 0] },
        spine: { flex: -2 },
        chest: { flex: -4 },
        'hip.r': { plane: 90, elev: 18 },
        'hip.l': { plane: 90, elev: -8 },
        'knee.r': { flex: 8 },
        'shoulder.r': aim([0, 0.05, 1]),
        'shoulder.l': aim([0, 0.05, 1]),
        elbow: { flex: 90 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      ...feet(),
      handOnWall([0, 1.52, -0.46], [0, 0, 1], [0, -0.3, 1], 'l'),
      handOnWall([0, 1.52, 0.46], [0, 0, -1], [0, -0.3, 1], 'r'),
    ],
    props: doorFrame(),
    working: ['torso'],
    perSide: false,
    neutral: SLOW,
  },

  'wall-lat-stretch': {
    camera: { yaw: 10, pitch: 6 },
    poses: {
      into: pose(hinge(68), { shoulder: { plane: 90, elev: 100 }, elbow: { flex: 12 } }),
      held: pose(hinge(80), {
        chest: { flex: -6 },
        shoulder: { plane: 90, elev: 100 },
        elbow: { flex: 12 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      ...feet(),
      ...palms({
        x: 0.74,
        width: 0.4,
        height: 0.95,
        normal: [-1, 0, 0],
        elbows: [0.45, -0.85, 0.3],
      }),
    ],
    props: [wall([0.74, 0, 0], [-1, 0, 0])],
    working: ['torso'],
    perSide: false,
    neutral: SLOW,
  },

  'door-frame-lat-stretch': {
    camera: { yaw: 35, pitch: 6 },
    poses: {
      into: pose(hinge(30), {
        root: { pos: [-0.12, 0.88, 0] },
        chest: { twist: 6 },
        'shoulder.r': { plane: 90, elev: 70 },
        'elbow.r': { flex: 20 },
        'shoulder.l': { plane: 0, elev: 12 },
        'elbow.l': { flex: 40 },
      }),
      held: pose(hinge(52), {
        root: { pos: [-0.26, 0.85, 0] },
        chest: { twist: 14 },
        'shoulder.r': { plane: 90, elev: 100 },
        'elbow.r': { flex: 10 },
        'shoulder.l': { plane: 0, elev: 12 },
        'elbow.l': { flex: 40 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      ...feet(),
      { contact: 'hand.r', mode: 'plant', rest: 'grip', at: [0.6, 1.2, 0.12] },
      handOn('l', 'root', [0, 0.02, -0.16], [-0.5, -0.3, -1]),
    ],
    props: [
      {
        kind: 'box',
        id: 'jamb',
        group: 'door',
        equipment: 'door',
        min: [0.58, 0, 0.06],
        max: [0.68, 2.05, 0.18],
      },
    ],
    working: ['torso'],
    perSide: true,
    neutral: SLOW,
  },

  'cross-body-shoulder-stretch': {
    camera: { yaw: 88, pitch: 6 },
    poses: {
      into: pose(STAND, {
        'shoulder.r': aim([0.55, 0.05, -0.7]),
        'elbow.r': { flex: 6 },
        'shoulder.l': { plane: 90, elev: 60 },
        'elbow.l': { flex: 90 },
      }),
      held: pose(STAND, {
        spine: { twist: -3 },
        chest: { twist: -8 },
        'clav.r': { prot: 14 },
        'shoulder.r': aim([0.45, 0.05, -0.9]),
        'elbow.r': { flex: 6 },
        'shoulder.l': { plane: 90, elev: 60 },
        'elbow.l': { flex: 90 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), handOn('l', 'shoulder.r', [0, -0.2, 0], [0.2, -1, 0.3])],
    props: [],
    working: ['arm.r'],
    perSide: true,
    neutral: SLOW,
  },

  'seated-neck-side-tilt': {
    camera: { yaw: 80, pitch: 4 },
    poses: {
      into: pose(seated(), {
        chest: { bend: 2 },
        'clav.r': { elev: 0 },
        'clav.l': { elev: 0 },
        'shoulder.l': { plane: 0, elev: 10 },
      }),
      held: pose(seated(), {
        chest: { bend: 3 },
        'clav.r': { elev: 1 },
        'clav.l': { elev: -1 },
        'shoulder.l': { plane: 0, elev: 10 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      ...feet(),
      {
        contact: 'hand.l',
        mode: 'plant',
        at: [0.02, 0.45, -0.2],
        pole: { frame: 'chest', dir: [-0.3, -1, -0.5] },
      },
      handOn('r', 'hip.r', [0.07, -0.2, 0], [-0.3, -1, 0.5]),
    ],
    props: [support('chair', [0, 0.45, 0], 0)],
    working: ['torso'],
    perSide: true,
    neutral: SLOW,
  },

  'overhead-triceps-stretch': {
    camera: { yaw: 70, pitch: 4 },
    poses: {
      into: pose(STAND, {
        'shoulder.r': { plane: 90, elev: 150 },
        'elbow.r': { flex: 130 },
        'shoulder.l': { plane: 90, elev: 100 },
        'elbow.l': { flex: 100 },
      }),
      held: pose(STAND, {
        spine: { flex: -2 },
        'shoulder.r': { plane: 90, elev: 162 },
        'elbow.r': { flex: 146 },
        'shoulder.l': { plane: 90, elev: 100 },
        'elbow.l': { flex: 100 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), handOn('l', 'elbow.r', [0, 0.02, 0], [0.1, -1, 0.3])],
    props: [],
    working: ['arm.r'],
    perSide: true,
    neutral: SLOW,
  },

  'wall-biceps-stretch': {
    camera: { yaw: 210, pitch: 22 },
    poses: {
      into: pose(STAND, {
        spine: { twist: 7 },
        chest: { twist: 24 },
        'clav.r': { prot: -4 },
        'shoulder.r': aim([-0.5, -0.4, 0.75]),
        'elbow.r': { flex: 4 },
        'shoulder.l': { plane: 0, elev: 8 },
      }),
      held: pose(STAND, {
        spine: { twist: 8 },
        chest: { twist: 30 },
        'clav.r': { prot: -6 },
        'shoulder.r': aim([-0.5, -0.4, 0.75]),
        'elbow.r': { flex: 4 },
        'shoulder.l': { plane: 0, elev: 8 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      ...feet(),
      {
        contact: 'hand.r',
        mode: 'plant',
        rest: 'grip',
        at: [-0.42, 1.225, 0.39],
        normal: [0, 0, -1],
        pole: { frame: 'chest', dir: [-0.2, -1, 0.4] },
      },
    ],
    props: [wall([0, 0, 0.42], [0, 0, -1])],
    working: ['arm.r'],
    perSide: true,
    neutral: SLOW,
  },

  'standing-side-bend': {
    camera: { yaw: 82, pitch: 4 },
    poses: {
      into: pose(STAND, {
        spine: { bend: -4 },
        chest: { bend: -8 },
        'shoulder.r': aim([0, 1, 0.3]),
        'elbow.r': { flex: 6 },
        'shoulder.l': { plane: 0, elev: 6 },
      }),
      held: pose(STAND, {
        root: { pos: [0, 0.918, 0.03] },
        spine: { bend: -10 },
        chest: { bend: -15 },
        'shoulder.r': aim([0, 1, 0.3]),
        'elbow.r': { flex: 6 },
        'shoulder.l': { plane: 0, elev: 6 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: feet(),
    props: [],
    working: ['torso'],
    perSide: true,
    neutral: SLOW,
  },

  'standing-wrist-extensor-stretch': {
    camera: { yaw: 160, pitch: 6 },
    poses: {
      into: pose(STAND, {
        chest: { twist: -8 },
        'shoulder.r': aim([1, 0.1, -0.5]),
        'elbow.r': { flex: 4, pron: 90 },
        'wrist.r': { flex: 0 },
        'shoulder.l': aim([0.7, -0.6, -0.1]),
        'elbow.l': { flex: 70 },
        straight: ['arm.r'],
      }),
      held: pose(STAND, {
        chest: { twist: -20 },
        'shoulder.r': aim([1, 0.1, -0.5]),
        'elbow.r': { flex: 4, pron: 90 },
        'wrist.r': { flex: -60 },
        'shoulder.l': aim([0.7, -0.6, -0.1]),
        'elbow.l': { flex: 70 },
        straight: ['arm.r'],
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), handOn('l', 'wrist.r', [0.0, -0.04, 0.0], [0, -1, -0.4])],
    props: [],
    working: ['arm.r'],
    perSide: true,
    neutral: SLOW,
  },

  'seated-slow-breathing': {
    camera: { yaw: 35, pitch: 4 },
    poses: {
      exhaled: pose(seated(), {
        spine: { flex: 1.5 },
        chest: { flex: 2 },
        clav: { elev: -3 },
        shoulder: { plane: 90, elev: 12 },
        elbow: { flex: 30 },
      }),
      inhaled: pose(seated(), {
        spine: { flex: -1 },
        chest: { flex: -4 },
        clav: { elev: 2 },
        shoulder: { plane: 90, elev: 12 },
        elbow: { flex: 30 },
      }),
    },
    start: 'inhaled',
    still: 'inhaled',
    loop: hold('exhaled', 'inhaled'),
    pins: [
      ...feet(),
      handOn('l', 'hip.l', [0.07, -0.2, 0], [-0.3, -1, -0.5]),
      handOn('r', 'hip.r', [0.07, -0.2, 0], [-0.3, -1, 0.5]),
    ],
    props: [support('chair', [0, 0.45, 0], 0)],
    working: ['torso'],
    perSide: false,
    neutral: BREATH,
  },

  'chair-legs-breathing': {
    camera: { yaw: 14, pitch: 12 },
    poses: {
      exhaled: pose(supine(), {
        root: { pos: [0, 0.127, 0] },
        chest: { flex: 1 },
        hip: { plane: 90, elev: 90, rot: 0 },
        knee: { flex: 90 },
        ankle: { flex: 0 },
      }),
      inhaled: pose(supine(), {
        root: { pos: [0, 0.127, 0] },
        spine: { flex: -1.5 },
        chest: { flex: -4 },
        hip: { plane: 90, elev: 90, rot: 0 },
        knee: { flex: 90 },
        ankle: { flex: 0 },
      }),
    },
    start: 'inhaled',
    still: 'exhaled',
    loop: hold('exhaled', 'inhaled'),
    pins: [
      handOn('l', 'chest', [0.03, 0.06, -0.17], [-0.3, -0.2, 1]),
      handOn('r', 'chest', [0.03, 0.06, 0.17], [-0.3, -0.2, 1]),
    ],
    props: [support('chair', [0.27, 0.45, 0], 180)],
    working: ['torso'],
    perSide: false,
    neutral: BREATH,
  },

  'legs-up-the-wall': {
    camera: { yaw: 12, pitch: 10 },
    poses: {
      exhaled: pose(supine(), {
        root: { pos: [0, 0.127, 0] },
        chest: { flex: 1 },
        hip: { plane: 90, elev: 90, rot: 0 },
        knee: { flex: 4 },
        ankle: { flex: 0 },
        shoulder: aim([-0.1, -0.95, 0.3]),
        elbow: { flex: 6 },
      }),
      inhaled: pose(supine(), {
        root: { pos: [0, 0.127, 0] },
        spine: { flex: -1.5 },
        chest: { flex: -4 },
        hip: { plane: 90, elev: 90, rot: 0 },
        knee: { flex: 4 },
        ankle: { flex: 0 },
        shoulder: aim([-0.1, -0.95, 0.3]),
        elbow: { flex: 6 },
      }),
    },
    start: 'inhaled',
    still: 'exhaled',
    loop: hold('exhaled', 'inhaled'),
    pins: [],
    props: [wall([0.12, 0, 0], [-1, 0, 0])],
    working: ['leg.l', 'leg.r'],
    perSide: false,
    neutral: BREATH,
  },

  'knees-to-chest-stretch': {
    camera: { yaw: 3, pitch: 8 },
    poses: {
      into: pose(supine(), {
        hip: { plane: 90, elev: 124, rot: 0 },
        knee: { flex: 116 },
        neck: { flex: 8 },
      }),
      held: pose(supine(), {
        hip: { plane: 90, elev: 130, rot: 0 },
        knee: { flex: 122 },
        neck: { flex: 8 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      handOn('l', 'knee.l', [0.03, -0.1, 0], [-0.5, -0.3, 1]),
      handOn('r', 'knee.r', [0.03, -0.1, 0], [-0.5, -0.3, 1]),
    ],
    props: [],
    working: ['torso'],
    perSide: false,
    neutral: SLOW,
  },

  'seated-chair-twist': {
    camera: { yaw: 60, pitch: 20 },
    poses: {
      into: pose(seated(), {
        root: { pos: [0, 0.548, -0.1] },
        spine: { twist: -8 },
        chest: { twist: -22 },
        shoulder: { plane: 90, elev: 30 },
        elbow: { flex: 40 },
      }),
      held: pose(seated(), {
        root: { pos: [0, 0.548, -0.1] },
        spine: { twist: -16 },
        chest: { twist: -50 },
        shoulder: { plane: 90, elev: 30 },
        elbow: { flex: 40 },
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      ...feet(),
      {
        contact: 'hand.l',
        mode: 'plant',
        rest: 'grip',
        at: [0.14, 0.9, 0.2],
        pole: { frame: 'chest', dir: [0.2, -0.8, 0.5] },
      },
      {
        contact: 'hand.r',
        mode: 'plant',
        rest: 'grip',
        at: [-0.06, 0.9, 0.2],
        pole: { frame: 'chest', dir: [0.2, -0.8, 0.5] },
      },
    ],
    props: [support('chair', [0.1, 0.45, 0], 90)],
    working: ['torso'],
    perSide: true,
    neutral: SLOW,
  },

  'thread-the-needle': {
    camera: { yaw: 140, pitch: 22 },
    poses: {
      start: allFours(79, {
        neck: { flex: 6 },
        'shoulder.r': { plane: 90, elev: 79 },
        'shoulder.l': { plane: 90, elev: 79 },
      }),
      mid: allFours(79, {
        spine: { twist: 5, flex: 8 },
        chest: { twist: 20, flex: 12 },
        neck: { flex: 10 },
        'shoulder.l': { plane: 90, elev: 75 },
        'elbow.l': { flex: 20 },
        'shoulder.r': { plane: 90, elev: 100, rot: 0 },
        'elbow.r': { flex: 20 },
      }),
      held: allFours(79, {
        spine: { twist: 10, flex: 14 },
        chest: { twist: 38, flex: 22 },
        neck: { flex: 14 },
        'shoulder.l': { plane: 90, elev: 70 },
        'elbow.l': { flex: 40 },
        'shoulder.r': { plane: 110, elev: 90, rot: 0 },
        'elbow.r': { flex: 0 },
      }),
    },
    start: 'start',
    still: 'held',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'held', phase: 'eccentric', share: 0.5 },
      { to: 'held', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'start', phase: 'concentric', share: 0.5 },
      { to: 'start', phase: 'hold' },
    ],
    pins: [
      { contact: 'knees', mode: 'anchor', at: [0, 0, 0] },
      ...during(
        [4, 5, 0],
        palms({ x: 0.424, height: 0.003, width: 0.33, elbows: [0, 0.2, 1] }).filter(
          (p) => p.contact === 'hand.r',
        ),
      ),
      {
        contact: 'hand.r',
        mode: 'plant',
        at: [0.26, 0.003, -0.35],
        steps: [2],
        pole: { frame: 'chest', dir: [-0.5, 0, 1] },
      },
      ...palms({ x: 0.424, height: 0.003, width: 0.33, elbows: [0, 0.2, 1] }).filter(
        (p) => p.contact === 'hand.l',
      ),
    ],
    props: [],
    working: ['arm.r', 'torso'],
    perSide: true,
    neutral: SLOW,
  },

  'chair-elbows-lat-triceps-stretch': {
    camera: { yaw: 20, pitch: 8 },
    poses: {
      into: pose(
        body(
          [-0.1, 0.41],
          50,
          { l: KNEEL_FOOT, r: KNEEL_FOOT },
          {
            'ankle.l': { flex: -70 },
            'ankle.r': { flex: -70 },
            chest: { flex: 6 },
            neck: { flex: -10 },
            'shoulder.l': { plane: 90, elev: 100 },
            'shoulder.r': { plane: 90, elev: 100 },
            elbow: { flex: 120 },
          },
        ),
      ),
      held: pose(
        body(
          [-0.22, 0.3],
          62,
          { l: KNEEL_FOOT, r: KNEEL_FOOT },
          {
            'ankle.l': { flex: -70 },
            'ankle.r': { flex: -70 },
            chest: { flex: 8 },
            neck: { flex: -18 },
            'shoulder.l': { plane: 90, elev: 110 },
            'shoulder.r': { plane: 90, elev: 110 },
            elbow: { flex: 120 },
          },
        ),
      ),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'knees', mode: 'anchor', at: [0, 0, 0] },
      handOn('l', 'head', [-0.07, 0.08, -0.06], [1, -0.3, 0.8]),
      handOn('r', 'head', [-0.07, 0.08, 0.06], [1, -0.3, 0.8]),
    ],
    props: [support('chair', [0.5, 0.45, 0], 180)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
    neutral: SLOW,
  },

  'childs-pose': {
    camera: { yaw: 35, pitch: 24 },
    poses: {
      into: childsPose([-0.33, 0.2], 87, 7, 16),
      held: childsPose([-0.34, 0.18], 86, 7, 16),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'knees', mode: 'anchor', at: [0, 0, 0] },
      ...palms({ x: 0.66, width: 0.36, height: 0, elbows: [0, 0.2, 1] }),
    ],
    props: [],
    working: ['torso'],
    perSide: false,
    neutral: SLOW,
  },

  'open-book-stretch': {
    camera: { yaw: 128, pitch: 46 },
    poses: {
      closed: pose(sidePlank(-90, 0.228), {
        hip: { plane: 90, elev: 88, rot: 0 },
        knee: { flex: 90 },
        neck: { flex: 4 },
        'shoulder.l': aim([1, 0, -0.1]),
        'shoulder.r': aim([1, 0, -0.25]),
        elbow: { flex: 6 },
      }),
      open: pose(sidePlank(-90, 0.228), {
        hip: { plane: 90, elev: 88, rot: 0 },
        knee: { flex: 90 },
        spine: { twist: -12 },
        chest: { twist: -42 },
        neck: { flex: 4 },
        'shoulder.l': aim([1, 0, -0.1]),
        'shoulder.r': aim([-0.9, 0, 0.62]),
        elbow: { flex: 6 },
      }),
    },
    start: 'closed',
    still: 'open',
    loop: hold('open', 'closed'),
    pins: [
      {
        contact: 'hand.l',
        mode: 'plant',
        at: [0.5, 0.03, -0.42],
        pole: { frame: 'chest', dir: [0.4, 0, -1] },
      },
    ],
    props: [],
    working: ['arm.r', 'torso'],
    perSide: true,
    neutral: SLOW,
  },

  'supine-spinal-twist': {
    camera: { yaw: 20, pitch: 70 },
    poses: {
      into: twist(0, 112),
      mid: twist(-32, 105, 6),
      held: twist(-62, 100, 12),
    },
    start: 'into',
    still: 'held',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'held', phase: 'eccentric', share: 0.5 },
      { to: 'held', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'into', phase: 'concentric', share: 0.5 },
      { to: 'into', phase: 'hold' },
    ],
    pins: [],
    props: [],
    working: ['torso'],
    perSide: true,
    neutral: SLOW,
  },

  'kneeling-wrist-flexor-stretch': {
    camera: { yaw: 30, pitch: 20 },
    poses: {
      into: pose(
        body(
          [0, 0.452],
          86,
          { l: KNEEL_FOOT, r: KNEEL_FOOT },
          {
            'ankle.l': { flex: -70 },
            'ankle.r': { flex: -70 },
            shoulder: { plane: 90, elev: 79 },
            elbow: { flex: 0, pron: 180 },
            wrist: { dev: -85 },
          },
        ),
      ),
      held: pose(
        body(
          [-0.2, 0.42],
          87,
          { l: KNEEL_FOOT, r: KNEEL_FOOT },
          {
            'ankle.l': { flex: -70 },
            'ankle.r': { flex: -70 },
            shoulder: { plane: 90, elev: 84 },
            elbow: { flex: 0, pron: 180 },
            wrist: { dev: -85 },
          },
        ),
      ),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'knees', mode: 'anchor', at: [0, 0, 0] },
      ...(['l', 'r'] as const).map((S): AnimationPin => ({
        contact: `hand.${S}`,
        mode: 'plant',
        rest: 'grip',
        at: [0.38, 0.045, S === 'l' ? -0.165 : 0.165],
        pole: { frame: 'chest', dir: [0, 0.2, 1] },
      })),
    ],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
    neutral: SLOW,
  },
} satisfies Record<string, ExerciseAnimation>;
