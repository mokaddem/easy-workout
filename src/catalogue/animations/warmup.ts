import type { AnimationPin, AnimationPose, ExerciseAnimation, LoopStep } from '@/domain';
import {
  aim,
  ARMS_STRAIGHT,
  body,
  doorwayBar,
  during,
  feet,
  GRIP,
  handOn,
  handOnWall,
  hold,
  hung,
  keys,
  onBar,
  onToes,
  palms,
  plank,
  pose,
  rep,
  STAND,
  through,
  wall,
} from './shared';

type Vec3 = [number, number, number];

/*
 * Warm-up and mobility family. Most drills here move a limb around a joint (circles, swings,
 * rotations), so limb directions are given as vectors and turned into shoulder / hip angles by
 * `aim`, then sampled around a circle.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/* ------------------------------------------------------------------ */
/* Arm circles                                                         */
/* ------------------------------------------------------------------ */

/** Arms out to the sides, hands drawing a circle of radius `r` (of the arm's length) at angle `a`. */
const circleArm = (a: number, r: number): AnimationPose => {
  const t = rad(a);
  const out = Math.sqrt(1 - r * r);
  return pose(STAND, {
    clav: { elev: -4 },
    shoulder: aim([r * Math.sin(t), r * Math.cos(t), out]),
    elbow: { flex: 4 },
    straight: ['arm.l', 'arm.r'],
  });
};

const CIRCLE_KEYS = 8;
const circleKeys = (): Record<string, AnimationPose> =>
  Object.fromEntries(
    Array.from({ length: CIRCLE_KEYS + 1 }, (_, i) => [
      `c${i}`,
      circleArm((360 * i) / CIRCLE_KEYS, 0.2 + (0.42 * i) / CIRCLE_KEYS),
    ]),
  );

/* ------------------------------------------------------------------ */
/* Wrist circles                                                       */
/* ------------------------------------------------------------------ */

const WRIST_KEYS = 8;
const wristPose = (a: number): AnimationPose =>
  pose(STAND, {
    spine: { flex: 0 },
    shoulder: { plane: 90, elev: 62, rot: 0 },
    elbow: { flex: 52, pron: 70 },
    wrist: { flex: r1(38 * Math.cos(rad(a))), dev: r1(26 * Math.sin(rad(a))) },
  });

/* ------------------------------------------------------------------ */
/* Cross-body arm swing                                                */
/* ------------------------------------------------------------------ */

/** Arms out wide at shoulder height, opened back and the chest proud. */
const SWING_OPEN: AnimationPose = pose(STAND, {
  clav: { prot: -10 },
  shoulder: { plane: -6, elev: 92 },
  elbow: { flex: 8 },
});
/** Arms hugged across the chest; the arm on top is a little higher and further forward. */
const swingCross = (top: 'l' | 'r'): AnimationPose => {
  const under = top === 'r' ? 'l' : 'r';
  return pose(STAND, {
    clav: { prot: 12 },
    [`shoulder.${top}`]: { plane: 122, elev: 100 },
    [`shoulder.${under}`]: { plane: 152, elev: 84 },
    elbow: { flex: 18 },
  });
};

/* ------------------------------------------------------------------ */
/* Band dislocate                                                      */
/* ------------------------------------------------------------------ */

/**
 * Straight arms with a wide grip (hands about a metre apart), turning over the shoulders from the
 * front of the thighs (`a` near 0) up and over (180) to behind the hips (about 320).
 */
const dislocate = (a: number): AnimationPose => {
  const t = rad(a);
  const r = 0.768;
  return pose(STAND, {
    clav: { elev: a > 100 && a < 260 ? 6 : -2 },
    shoulder: aim([r * Math.sin(t), -r * Math.cos(t), 0.64]),
    elbow: { flex: 4 },
    straight: ['arm.l', 'arm.r'],
  });
};
const DISLOCATE_FRONT = 14;
const DISLOCATE_BACK = 322;
const DISLOCATE_ANGLES = [14, 40, 70, 100, 130, 160, 190, 220, 250, 280, 322];

/* ------------------------------------------------------------------ */
/* Standing torso rotation                                             */
/* ------------------------------------------------------------------ */

const twist = (angle: number): AnimationPose =>
  pose(STAND, {
    // The upper back turns; the lower back only follows a little. The arms hang loose.
    spine: { twist: r1(angle * 0.15) },
    chest: { twist: r1(angle * 0.85) },
    shoulder: { plane: 14, elev: 32 },
    elbow: { flex: 46 },
  });

/* ------------------------------------------------------------------ */
/* Dead hang                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Wall slide                                                          */
/* ------------------------------------------------------------------ */

/** The wall's face: the back and the arms rest on it. */
const WALL_X = -0.09;
/** Elbows level with the shoulders, forearms up the wall: a W. */
const SLIDE_W: AnimationPose = pose(STAND, {
  clav: { elev: -6 },
  shoulder: { plane: -10, elev: 92, rot: -90 },
  elbow: { flex: 90 },
});
/** Arms slid up the wall, elbows nearly straight: a Y. */
const SLIDE_Y: AnimationPose = pose(STAND, {
  clav: { elev: 4 },
  shoulder: { plane: -18, elev: 152, rot: -90 },
  elbow: { flex: 10 },
});

/* ------------------------------------------------------------------ */
/* Band external rotation                                              */
/* ------------------------------------------------------------------ */

/** Right elbow at the side bent to 90°, forearm turned `rot` degrees (negative: outward). */
const externalRotation = (rot: number): AnimationPose =>
  pose(STAND, {
    shoulder: { plane: 90, elev: 6 },
    'shoulder.r': { rot },
    'shoulder.l': { rot: 32 },
    elbow: { flex: 90 },
    wrist: { flex: 0 },
  });

/* ------------------------------------------------------------------ */
/* Floor work: all fours, plank                                        */
/* ------------------------------------------------------------------ */

/** Kneeling on all fours: shoulders over the wrists, thighs vertical, shins back along the floor. */
const QUADRUPED_PINS = (): AnimationPin[] => [
  { contact: 'knees', mode: 'anchor', at: [0, 0, 0] },
  ...palms({ x: 0.424, height: 0.003, width: 0.33, elbows: [0, 0.2, 1] }),
];
/** The spine in `lean` (pelvis), `spine` + `chest` (back) and `neck`: thighs and arms stay vertical. */
const allFours = (
  lean: number,
  extra: AnimationPose,
  arm: number,
  elbows: AnimationPose = ARMS_STRAIGHT,
): AnimationPose =>
  pose(
    {
      root: { pos: [0, 0.472, 0], lean },
      hip: { plane: 90, elev: r1(lean + 0.8) },
      knee: { flex: 90 },
      ankle: { flex: -70 },
      shoulder: { plane: 90, elev: arm },
      elbow: { flex: 0 },
    },
    elbows,
    extra,
  );

/** Plank on the toes with straight arms, the shoulder blades spread (`spread`) or squeezed. */
const scapular = (lean: number, chest: number, prot: number, spine: number): AnimationPose =>
  pose(plank(lean, { shoulder: { plane: 90, elev: 72.88 }, elbow: { flex: 0 } }), {
    spine: { flex: spine },
    chest: { flex: chest },
    clav: { prot },
    ...ARMS_STRAIGHT,
  });

/* ------------------------------------------------------------------ */
/* Standing on one leg at a wall: swings and circles                   */
/* ------------------------------------------------------------------ */

/** The left foot on the floor, the leg held straight: the body rides on it. */
const STANDING_LEG: AnimationPin = { contact: 'foot.l', mode: 'plant', straight: true };

/** The right leg at `thigh` degrees from hanging (forward positive), knee bent `knee`. */
const frontBack = (thigh: number, knee: number, foot: number): AnimationPose =>
  pose(STAND, {
    'hip.r': { plane: 90, elev: thigh },
    'knee.r': { flex: knee },
    'ankle.r': { flex: foot },
    'shoulder.r': { plane: 24, elev: 26 },
    'elbow.r': { flex: 18 },
    spine: { flex: 0 },
  });

/** The right leg pointing along `dir` ([forward, up, out]) with the knee bent `knee`. */
const legAlong = (dir: Vec3, knee: number, near?: number): AnimationPose => {
  const a = aim(dir, near);
  return pose(STAND, {
    'hip.r': { plane: a.plane, elev: a.elev, rot: 0 },
    'knee.r': { flex: knee },
    'shoulder.r': { plane: 24, elev: 26 },
    'elbow.r': { flex: 18 },
  });
};

/** Hip circle: where the thigh points, and how far the knee is bent, around the circle. */
const HIP_CIRCLE: [Vec3, number][] = [
  [[0.95, 0.05, 0.2], 100],
  [[0.6, 0.1, 0.75], 96],
  [[0.1, 0.05, 1.0], 90],
  [[-0.35, -0.15, 0.9], 70],
  [[-0.3, -0.55, 0.6], 55],
  [[0.2, -0.6, 0.35], 75],
  [[0.95, 0.05, 0.2], 100],
];
const hipCirclePoses = (): Record<string, AnimationPose> => {
  const out: Record<string, AnimationPose> = {};
  let near = 0;
  HIP_CIRCLE.forEach(([dir, knee], i) => {
    const p = legAlong(dir, knee, near);
    near = (p['hip.r'] as { plane: number }).plane;
    out[`k${i}`] = p;
  });
  return out;
};

/* ------------------------------------------------------------------ */
/* World's greatest stretch                                            */
/* ------------------------------------------------------------------ */

/** Deep lunge, right foot forward and wide, both hands down inside it: legs and left arm fixed. */
const LUNGE_BASE: AnimationPose = {
  root: { pos: [0.016, 0.383, 0], lean: 68 },
  neck: { flex: -14 },
  'hip.r': { plane: 97, elev: 104.6, rot: -28 },
  'knee.r': { flex: 80 },
  'ankle.r': { flex: 10 },
  'hip.l': { plane: 90, elev: -79.3 },
  'knee.l': { flex: 0 },
  'ankle.l': { flex: -60 },
  'shoulder.l': { plane: 90, elev: 68 },
  elbow: { flex: 0 },
};

/* ------------------------------------------------------------------ */
/* 90/90 hip switch                                                    */
/* ------------------------------------------------------------------ */

/**
 * The 90/90 switch as windshield wipers: seated on the floor, heels wide (about x 0.40, z ±0.52),
 * hands down behind. Each leg turns about the line from its hip to its heel; the foot rolls from
 * one edge to the other about a point halfway between ankle and heel, which stays on its spot,
 * and the knees go up and over together.
 *
 * Knees down on the right: the right leg is the front one (hip turned out, thigh out to the side,
 * shin across the front) and the left the back one (hip turned in, thigh forward, the knee on its
 * own side of the body, the shin out and back); both knees bent about 90°, thighs about 90° apart.
 * The pelvis turns 24° toward the knees and shifts 2 cm onto that side; the chest turns back most
 * of it, so the trunk stays square between the hands.
 *
 * One row per key, from knees up (0) to knees down on the right (1): how far through the wipe,
 * then the right and the left leg's hip plane, elevation and rotation, knee flex and ankle flex.
 * The keys hold that point on its spot with the foot resting on the floor; they crowd toward the
 * middle, where the hips turn fastest. The knees-left keys are their mirror image.
 */
const WIPE: number[][] = [
  [0, 49.8, 127.5, -29, 92.4, 30, 49.8, 127.5, -29, 92.4, 30],
  [0.12, 42.6, 127.4, -50.1, 91.9, 26.4, 56, 125.6, -9.9, 92.1, 24],
  [0.25, 35.4, 125, -72, 91.3, 22.5, 61.3, 121.6, 8.3, 91.6, 17.5],
  [0.38, 29.4, 120.4, -91.1, 90.7, 18.6, 64.7, 116, 23.1, 91, 11],
  [0.5, 25.5, 114.7, -105.8, 90, 15, 66.2, 109.9, 33.9, 90.4, 5],
  [0.64, 22.8, 106.7, -119.4, 89.1, 10.8, 66.2, 101.8, 43.6, 89.7, -2],
  [0.8, 21.7, 96.3, -131.4, 88.1, 6, 64.2, 92, 51.7, 88.7, -10],
  [1, 23, 82.4, -142.4, 86.7, 0, 59, 79.6, 58.8, 87.3, -20],
];
/** How far the pelvis turns toward the knees, and shifts onto that side, at the end of a wipe. */
const WIPE_TURN = 24;
const WIPE_SHIFT = 0.02;
/** Key `i` of `WIPE` with the knees going right (1) or, mirrored, left (-1). */
const wipe = (i: number, side: 1 | -1): AnimationPose => {
  const [f = 0, ...v] = WIPE[i]!;
  // The mirror image swaps the legs and turns the other way.
  const [a, b] = side === 1 ? (['r', 'l'] as const) : (['l', 'r'] as const);
  const turn = r1(-side * WIPE_TURN * f);
  return {
    root: { pos: [0, 0.105, side * WIPE_SHIFT * f], lean: -12, turn },
    spine: { twist: r1(-turn * 0.4) },
    chest: { twist: r1(-turn * 0.4) },
    shoulder: { plane: 60, elev: 16 },
    elbow: { flex: 10 },
    [`hip.${a}`]: { plane: v[0], elev: v[1], rot: v[2] },
    [`knee.${a}`]: { flex: v[3] },
    [`ankle.${a}`]: { flex: v[4] },
    [`hip.${b}`]: { plane: v[5], elev: v[6], rot: v[7] },
    [`knee.${b}`]: { flex: v[8] },
    [`ankle.${b}`]: { flex: v[9] },
  };
};
/** The name of key `i` on one side: `mid`, then `quarterRight` / `right` and the ones between. */
const wipeName = (i: number, side: 'Left' | 'Right'): string =>
  i === 0
    ? 'mid'
    : i === WIPE.length - 1
      ? side.toLowerCase()
      : WIPE[i]![0] === 0.5
        ? `quarter${side}`
        : `${side.toLowerCase()}${i}`;
/** Every key from knees down on the left to knees down on the right, and how far through it is. */
const WIPE_KEYS: { name: string; f: number; pose: AnimationPose }[] = [
  ...WIPE.map((row, i) => ({ name: wipeName(i, 'Left'), f: -row[0]!, pose: wipe(i, -1) }))
    .slice(1)
    .reverse(),
  ...WIPE.map((row, i) => ({ name: wipeName(i, 'Right'), f: row[0]!, pose: wipe(i, 1) })),
];
/** Through the keys in order, each step's share of the phase as long as its part of the wipe. */
const sweep = (keys: typeof WIPE_KEYS, phase: 'eccentric' | 'concentric'): LoopStep[] =>
  keys.slice(1).map((k, i) => ({ to: k.name, phase, share: Math.abs(k.f - keys[i]!.f) }));

/* ------------------------------------------------------------------ */
/* Inchworm                                                            */
/* ------------------------------------------------------------------ */

/**
 * Folded over straight legs with the hands on the floor (`INCH_HANDS.fold` ahead of the toes),
 * then the pike and the plank as the hands walk out. The walk-in keys below follow the same shapes
 * back, from the plank to the fold.
 */
const INCH_FOLD: AnimationPose = {
  root: { lean: 140.5 },
  neck: { flex: -10 },
  hip: { plane: 90, elev: 132 },
  knee: { flex: 4 },
  ankle: { flex: 12.6 },
  shoulder: { plane: 90, elev: 142 },
  elbow: { flex: 0 },
  wrist: { dev: 88.5 },
};
const INCH_MID: AnimationPose = {
  root: { lean: 155.74 },
  neck: { flex: -10 },
  hip: { plane: 90, elev: 135.04 },
  knee: { flex: 4 },
  ankle: { flex: -4.66 },
  shoulder: { plane: 90, elev: 180.35 },
  elbow: { flex: 0 },
  wrist: { dev: 65.4 },
};
const INCH_WALK: AnimationPose = {
  root: { lean: 140.59 },
  neck: { flex: -10 },
  hip: { plane: 90, elev: 106.93 },
  knee: { flex: 4 },
  ankle: { flex: -13.46 },
  shoulder: { plane: 90, elev: 165.2 },
  elbow: { flex: 0 },
  wrist: { dev: 65.4 },
};
/** How far the hands are ahead of the toes at each stop on the way out. */
const INCH_HANDS = { fold: 0.295, mid: 0.615, walk: 0.925, plank: 1.187 };
/** The plank, knees a touch soft (1.5°). */
const plankShape: AnimationPose = pose(
  plank(72.88, {
    shoulder: { plane: 90, elev: 72.88 },
    elbow: { flex: 0 },
    wrist: { dev: 90 },
  }),
  { root: { pos: [0.8457, 0.4153, 0] }, knee: { flex: 1.5 }, straight: ['leg.l', 'leg.r'] },
);
/**
 * The feet walking in from the plank to the fold in twelve small steps on their toes, right then
 * left, each landing a little past the other foot (4 cm at first, 10 cm once the hips are up),
 * while the hips rise into the pike. Three keys per step: the stepping foot lifted a third and two
 * thirds of the way, then landed. Each row: the pelvis (x, y, lean), the right and the left leg
 * (hip, knee, ankle), the shoulders, the neck and the wrists. The keys were solved for the toes
 * resting exactly on their spots, the hands within reach of the floor, and the knees within 6° of
 * straight; the feet need no contact while the keys place them.
 */
const INCH_IN: number[][] = [
  [0.8481, 0.4294, 74.99, 0.58, 1.63, 0.13, 3.4, 1.71, -11.88, 75.2, -6.1, 89.38],
  [0.8466, 0.4409, 76.62, 3.02, 1.6, 3.66, 6.07, 1.93, -13.66, 77.52, -6.2, 88.76],
  [0.8418, 0.4498, 77.78, 7.3, 1.5, 2.14, 8.01, 2.2, -13.41, 79.84, -6.3, 88.15],
  [0.842, 0.4834, 82.52, 14.85, 1.91, -5.15, 12.32, 1.98, -0.42, 85.55, -6.55, 86.62],
  [0.836, 0.5137, 86.58, 21.56, 2.35, -10.14, 18.67, 1.64, 6.87, 91.26, -6.8, 85.1],
  [0.8256, 0.5401, 90.05, 27.43, 2.88, -12.97, 26.97, 1.5, 7.35, 96.97, -7.04, 83.58],
  [0.8207, 0.5837, 95.79, 33.69, 2.23, 1.28, 36.4, 2.27, -2.28, 104.33, -7.36, 81.62],
  [0.808, 0.6219, 100.81, 42.09, 1.61, 8.31, 44.95, 3.03, -9.26, 111.68, -7.68, 79.66],
  [0.7906, 0.6538, 105.28, 52.49, 1.5, 6.7, 52.61, 3.89, -13.67, 119.04, -8, 77.7],
  [0.78, 0.6991, 111.54, 62.85, 2.71, -4.78, 60.01, 2.84, 0.55, 127.39, -8.36, 75.47],
  [0.7614, 0.7356, 117.28, 72.39, 3.75, -12.86, 69.65, 1.92, 6.03, 135.74, -8.72, 73.25],
  [0.7393, 0.7629, 122.69, 81.06, 4.82, -17.62, 81.35, 1.77, 1.24, 144.09, -9.09, 71.02],
  [0.7335, 0.7967, 129.16, 88.19, 3.58, -2.75, 91.12, 3.14, -10.72, 151.42, -9.39, 69.15],
  [0.7213, 0.8189, 135.39, 97.62, 2.5, 2.21, 100.06, 4.15, -17.98, 158.74, -9.7, 67.27],
  [0.7086, 0.8308, 141.38, 109.02, 2.33, -3.94, 107.99, 5.2, -21, 166.07, -10, 65.4],
  [0.7251, 0.8435, 143.7, 112.14, 3.36, -12.46, 108.91, 3.54, -3.11, 167.42, -10, 65.4],
  [0.7324, 0.8489, 144.99, 114.06, 4.2, -16.43, 111.98, 2.46, 3.31, 168.77, -10, 65.4],
  [0.7346, 0.8499, 145.51, 115.14, 5.25, -17.14, 116.86, 2.25, -2.13, 170.13, -10, 65.4],
  [0.7515, 0.8614, 147.79, 116.68, 4.02, 0.39, 119.6, 3.17, -9.71, 171.56, -10, 65.4],
  [0.7591, 0.8663, 149.12, 120.19, 3.04, 6.04, 121.46, 4.08, -13.13, 172.99, -10, 65.4],
  [0.7611, 0.867, 149.82, 125.2, 2.26, -0.88, 122.77, 5.3, -13.52, 174.42, -10, 65.4],
  [0.7785, 0.8773, 151.95, 127.49, 3.08, -7.46, 125.1, 5.05, 3.73, 175.92, -10, 65.4],
  [0.786, 0.8814, 153.4, 129.38, 4.11, -10.16, 128.81, 3.57, 8.31, 177.42, -10, 65.4],
  [0.7882, 0.882, 154.26, 130.83, 5.38, -10.37, 133.97, 2.39, -0.35, 178.92, -10, 65.4],
  [0.805, 0.89, 154.21, 131.21, 4.64, 6.69, 133.89, 3.28, -5.05, 176.74, -10, 67],
  [0.813, 0.8926, 153.48, 133.12, 3.28, 10.58, 133.42, 4.29, -6.57, 174.57, -10, 68.6],
  [0.8167, 0.8907, 152.1, 136.31, 2.67, 1.4, 132.4, 5.57, -5.54, 172.39, -10, 70.19],
  [0.8326, 0.8961, 151.08, 135.09, 3.61, -1.38, 131.93, 3.87, 10.67, 168.43, -10, 72.58],
  [0.843, 0.8954, 149.28, 133.18, 4.59, -1.25, 133.06, 2.82, 14.16, 164.47, -10, 74.97],
  [0.8524, 0.8898, 146.89, 130.62, 5.82, 1.17, 135.27, 2.99, 5.03, 160.5, -10, 77.36],
  [0.8678, 0.892, 146.09, 130.91, 3.89, 16.64, 133.94, 3.7, 4.06, 156.41, -10, 79.82],
  [0.8794, 0.8884, 144.53, 132.41, 2.66, 19.47, 131.98, 4.57, 5.62, 152.32, -10, 82.28],
  [0.8913, 0.8809, 142.44, 134.77, 2.9, 9.6, 129.45, 5.65, 8.83, 148.23, -10, 84.75],
  [0.8986, 0.8812, 142.24, 134.23, 3.16, 9.62, 129.29, 3.88, 22.41, 146.15, -10, 86],
  [0.905, 0.8789, 141.62, 133.33, 3.55, 10.77, 130.18, 3.1, 23.65, 144.08, -10, 87.25],
];
/** The fold the feet walk in to (toes at 0.892), the legs straight. */
const INCH_FOLD_IN: AnimationPose = pose(INCH_FOLD, { root: { pos: [0.9105, 0.875, 0] } });
/** A walk-in key from its row of `INCH_IN`. */
const inchIn = (row: number[]): AnimationPose => {
  const [x = 0, y = 0, lean, hipR, kneeR, ankleR, hipL, kneeL, ankleL, shoulder, neck, dev] = row;
  return {
    root: { pos: [x, y, 0], lean },
    neck: { flex: neck },
    'hip.r': { plane: 90, elev: hipR },
    'knee.r': { flex: kneeR },
    'ankle.r': { flex: ankleR },
    'hip.l': { plane: 90, elev: hipL },
    'knee.l': { flex: kneeL },
    'ankle.l': { flex: ankleL },
    shoulder: { plane: 90, elev: shoulder },
    elbow: { flex: 0 },
    wrist: { dev },
  };
};
/** Keys per step: the foot in the air, then landed. */
const INCH_IN_KEYS = 3;
/** Names of the walk-in keys, in order: `in1a`, `in1b`, `in1`, `in2a`… the last step lands in the fold. */
const INCH_IN_NAMES = INCH_IN.map((_, i) => {
  const j = i % INCH_IN_KEYS;
  return `in${Math.floor(i / INCH_IN_KEYS) + 1}${j === INCH_IN_KEYS - 1 ? '' : 'abcd'[j]}`;
});
/** Halfway up from the fold: the back still rounded, the head down, the arms hanging. */
const INCH_ROLL: AnimationPose = {
  root: { pos: [0.7527, 0.9075, 0], lean: 80 },
  spine: { flex: 22 },
  chest: { flex: 28 },
  neck: { flex: 25 },
  hip: { plane: 90, elev: 75 },
  knee: { flex: 4 },
  shoulder: { plane: 90, elev: 128 },
  elbow: { flex: 8 },
};
/** Toe spots of each foot walking back from the fold to the start, the right foot first. */
const BACK_R = [0.892, 0.7, 0.32, 0];
const BACK_L = [0.892, 0.51, 0.13, 0];
/**
 * A foot standing flat, its toes at `x` (the ankle 0.145 behind), during loop `steps`; with
 * `straight`, the body rides on that leg, held straight.
 */
const flatFoot = (
  side: 'l' | 'r',
  x: number,
  steps: number[],
  straight = false,
  lift = 0.05,
): AnimationPin[] =>
  during(steps, [
    {
      contact: `foot.${side}`,
      mode: 'plant',
      at: [x - 0.145, 0, side === 'l' ? -0.085 : 0.085],
      lift,
      ...(straight ? { straight } : {}),
    },
  ]);
/**
 * Standing with the pelvis at `x`, feet flat with the ankles 0.014 m ahead of it, the legs exactly
 * as long as a leg the body rides on (knees 3.6°).
 */
const standAt = (x: number, y = 0.92447): AnimationPose =>
  pose(STAND, {
    root: { pos: [x, y, 0] },
    hip: { plane: 90, elev: 2.76 },
    knee: { flex: 3.63 },
    ankle: { flex: 0.87 },
    shoulder: { plane: 90, elev: 4 },
  });
/**
 * Walking back, both feet down (toes at `a` and `b`): the pelvis halfway between them, as high as
 * the straight leg it rides on lets it.
 */
const walkBack = (a: number, b: number): AnimationPose => {
  const half = Math.abs(a - b) / 2;
  return standAt((a + b) / 2 - 0.145, r3(0.095 + Math.sqrt(0.8296 ** 2 - half ** 2)));
};
/**
 * Loop steps through one phase, each taking about the given seconds at the animation's neutral
 * pace: the phase eases in and out as a whole, so a step's share is the part of that curve its
 * time covers.
 */
const seconds = (steps: [string, number][]) => steps.reduce((t, [, s]) => t + s, 0);
const timed = (phase: LoopStep['phase'], steps: [string, number][]): LoopStep[] => {
  const total = seconds(steps);
  const ease = (r: number) => (1 - Math.cos(Math.PI * r)) / 2;
  let t = 0;
  return steps.map(([to, s]) => {
    const share = ease((t + s) / total) - ease(t / total);
    t += s;
    return { to, phase, share };
  });
};
/**
 * The inchworm's way down, and up and back, with each step's seconds: the hinge, a beat with the
 * hands down, three hand steps out (a beat between them); then a beat in the plank, twelve small
 * steps in (right, left), the roll up, and six steps back to the start.
 */
const INCH_DOWN: [string, number][] = [
  ['fold', 1.25],
  ['fold', 0.15],
  ['mid', 0.45],
  ['mid', 0.12],
  ['walk', 0.45],
  ['walk', 0.12],
  ['plank', 0.45],
];
const INCH_UP: [string, number][] = [
  ['plank', 0.12],
  ...INCH_IN_NAMES.map((name): [string, number] => [name, 0.34 / INCH_IN_KEYS]),
  ['foldOn', 0.34 / INCH_IN_KEYS],
  ['rollUp', 0.65],
  ['standOut', 0.65],
  ['back1', 0.55],
  ['back2', 0.55],
  ['back3', 0.55],
  ['back4', 0.55],
  ['back5', 0.55],
  ['stand', 0.55],
];
/** The loop step `n` steps after the roll up starts (the plank pause comes after the way down). */
const afterRoll = (n: number) =>
  INCH_DOWN.length + 1 + INCH_UP.findIndex(([to]) => to === 'rollUp') + n;

/* ------------------------------------------------------------------ */
/* Deep squat                                                          */
/* ------------------------------------------------------------------ */

/**
 * Squatting as low as it goes, hips `hipY` high behind the heels, the torso leaning `lean`, feet
 * flat and wide with the toes turned out, the hands together at the chest.
 */
const deepSquat = (hipY: number, lean: number): AnimationPose =>
  pose(
    body([-0.14, hipY], lean, {
      l: { ankle: [0, 0.075], rot: 0, plane: 78 },
      r: { ankle: [0, 0.075], rot: 0, plane: 78 },
    }),
    {
      spine: { flex: -6 },
      neck: { flex: -14 },
      shoulder: { plane: 60, elev: 60 },
      elbow: { flex: 110 },
    },
  );

export const warmupAnimations = {
  'arm-circles': {
    camera: { yaw: 62, pitch: 8 },
    poses: circleKeys(),
    start: 'c0',
    still: 'c2',
    // A turn forward with the circles growing, then back along the same path: the direction changes.
    loop: [
      ...through(keys('c', 1, CIRCLE_KEYS), 'eccentric'),
      ...through(keys('c', CIRCLE_KEYS - 1, 0), 'concentric'),
    ],
    pins: feet(),
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'wrist-circles': {
    camera: { yaw: 40, pitch: 8 },
    poses: Object.fromEntries(
      Array.from({ length: WRIST_KEYS + 1 }, (_, i) => [
        `w${i}`,
        wristPose((360 * i) / WRIST_KEYS),
      ]),
    ),
    start: 'w0',
    still: 'w2',
    loop: [
      ...through(keys('w', 1, WRIST_KEYS), 'eccentric'),
      ...through(keys('w', WRIST_KEYS - 1, 0), 'concentric'),
    ],
    pins: feet(),
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'cross-body-arm-swing': {
    camera: { yaw: 74, pitch: 8 },
    poses: { open: SWING_OPEN, crossR: swingCross('r'), crossL: swingCross('l') },
    start: 'open',
    still: 'crossR',
    // Two reps: the right arm on top, then the left.
    loop: [
      { to: 'crossR', phase: 'eccentric' },
      { to: 'crossR', phase: 'pause' },
      { to: 'open', phase: 'concentric' },
      { to: 'open', phase: 'hold' },
      { to: 'crossL', phase: 'eccentric' },
      { to: 'crossL', phase: 'pause' },
      { to: 'open', phase: 'concentric' },
      { to: 'open', phase: 'hold' },
    ],
    pins: feet(),
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-dislocate': {
    camera: { yaw: 36, pitch: 8 },
    poses: Object.fromEntries(DISLOCATE_ANGLES.map((a) => [`a${a}`, dislocate(a)])),
    start: `a${DISLOCATE_FRONT}`,
    still: 'a160',
    loop: [
      ...through(
        DISLOCATE_ANGLES.slice(1).map((a) => `a${a}`),
        'eccentric',
      ),
      { to: `a${DISLOCATE_BACK}`, phase: 'pause' },
      ...through(
        DISLOCATE_ANGLES.slice(0, -1)
          .reverse()
          .map((a) => `a${a}`),
        'concentric',
      ),
      { to: `a${DISLOCATE_FRONT}`, phase: 'hold' },
    ],
    pins: feet(),
    props: [
      {
        kind: 'band',
        id: 'band',
        group: 'band',
        from: { frame: 'wrist.l', at: GRIP },
        to: { frame: 'wrist.r', at: GRIP },
      },
    ],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'torso-rotation': {
    camera: { yaw: 72, pitch: 14 },
    poses: { left: twist(-52), right: twist(52) },
    start: 'left',
    still: 'right',
    loop: [
      { to: 'right', phase: 'eccentric' },
      { to: 'right', phase: 'pause' },
      { to: 'left', phase: 'concentric' },
      { to: 'left', phase: 'hold' },
    ],
    pins: feet(),
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'dead-hang': {
    camera: { yaw: 24, pitch: 6 },
    poses: {
      relaxed: pose(hung([-0.03, 1.415], 0, { clav: { elev: 10 } }), ARMS_STRAIGHT),
      settled: pose(hung([-0.03, 1.443], 0, { clav: { elev: 1 } }), ARMS_STRAIGHT),
    },
    start: 'relaxed',
    still: 'relaxed',
    loop: hold('settled', 'relaxed'),
    pins: onBar(0.52),
    props: doorwayBar(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'wall-slide': {
    camera: { yaw: 80, pitch: 4 },
    poses: { w: SLIDE_W, y: SLIDE_Y },
    start: 'y',
    still: 'w',
    loop: rep('w', 'y'),
    pins: feet(),
    props: [wall([WALL_X, 0, 0], [1, 0, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-external-rotation': {
    camera: { yaw: 52, pitch: 28 },
    poses: { in: externalRotation(18), out: externalRotation(-58) },
    start: 'out',
    still: 'out',
    loop: rep('in', 'out'),
    pins: feet(),
    props: [
      {
        kind: 'band',
        id: 'band',
        group: 'band',
        from: { frame: 'wrist.l', at: GRIP },
        to: { frame: 'wrist.r', at: GRIP },
      },
    ],
    working: ['arm.r'],
    perSide: true,
  },

  'scapular-push-up': {
    camera: { yaw: 24, pitch: 14 },
    poses: {
      spread: scapular(72.88, -6.1, 8.4, 0),
      squeeze: scapular(72.88, 2.1, -2.8, 0),
    },
    start: 'spread',
    still: 'squeeze',
    loop: rep('squeeze', 'spread'),
    pins: [onToes(), ...palms({ x: 1.187, width: 0.43 })],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'cat-cow': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      // The upper back does most of the rounding and arching; the pelvis tilts about 13-17°.
      cow: allFours(
        92,
        {
          hip: { elev: 92 },
          spine: { flex: 5 },
          chest: { flex: -34.4 },
          neck: { flex: -22 },
          head: { flex: -8 },
        },
        62,
        {},
      ),
      flat: allFours(79, {}, 79, {}),
      cat: allFours(
        62,
        {
          hip: { elev: 62 },
          spine: { flex: -2.2 },
          chest: { flex: 36.7 },
          neck: { flex: 22 },
          head: { flex: 8 },
        },
        100,
        {},
      ),
    },
    start: 'cow',
    still: 'cat',
    loop: [
      { to: 'flat', phase: 'eccentric', share: 0.5 },
      { to: 'cat', phase: 'eccentric', share: 0.5 },
      { to: 'cat', phase: 'pause' },
      { to: 'flat', phase: 'concentric', share: 0.5 },
      { to: 'cow', phase: 'concentric', share: 0.5 },
      { to: 'cow', phase: 'hold' },
    ],
    pins: QUADRUPED_PINS(),
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'thoracic-rotation': {
    camera: { yaw: 76, pitch: 12 },
    poses: {
      // The support arm stays straight; the working elbow turns up. The turn is the upper back's
      // (chest 48°, lower back 5°).
      closed: allFours(79.4, { neck: { flex: 6 } }, 79, {
        straight: ['arm.l'],
      }),
      open: allFours(
        73,
        {
          hip: { elev: 78.15 },
          knee: { flex: 95.1 },
          spine: { twist: -5, bend: 6, flex: -6 },
          chest: { twist: -48, bend: 2, flex: -6 },
          neck: { flex: 0 },
        },
        79,
        { straight: ['arm.l'] },
      ),
    },
    start: 'open',
    still: 'open',
    loop: rep('closed', 'open'),
    pins: [
      { contact: 'knees', mode: 'anchor', at: [0, 0, 0] },
      palms({ x: 0.44, width: 0.26, elbows: [0, 0.2, 1] })[0]!,
      handOn('r', 'head', [-0.07, 0.05, 0], [0, 0.4, 1]),
    ],
    props: [],
    working: ['torso', 'arm.r'],
    perSide: true,
  },

  'leg-swing-front-back': {
    camera: { yaw: 0, pitch: 6 },
    poses: { front: frontBack(66, 4, 8), back: frontBack(-14, 20, 12) },
    start: 'front',
    still: 'front',
    loop: [
      { to: 'back', phase: 'eccentric' },
      { to: 'front', phase: 'concentric' },
    ],
    pins: [STANDING_LEG, handOnWall([0, 1.2, -0.55], [0, 0, 1], [0, -0.4, 1])],
    props: [wall([0, 0, -0.55], [0, 0, 1])],
    working: ['leg.r'],
    perSide: true,
  },

  'leg-swing-lateral': {
    camera: { yaw: 70, pitch: 8 },
    poses: {
      out: legAlong([0.05, -0.8, 0.6], 4),
      across: legAlong([0.2, -0.86, -0.46], 6, 160),
    },
    start: 'out',
    still: 'across',
    loop: [
      { to: 'across', phase: 'eccentric' },
      { to: 'out', phase: 'concentric' },
    ],
    pins: [
      STANDING_LEG,
      ...palms({
        x: 0.46,
        width: 0.4,
        height: 1.3,
        normal: [-1, 0, 0],
        elbows: [0.45, -0.85, 0.3],
      }),
    ],
    props: [wall([0.46, 0, 0], [-1, 0, 0])],
    working: ['leg.r'],
    perSide: true,
  },

  'hip-circles': {
    camera: { yaw: 54, pitch: 8 },
    poses: hipCirclePoses(),
    start: 'k0',
    still: 'k1',
    // A circle, then back round the other way.
    loop: [...through(keys('k', 1, 6), 'eccentric'), ...through(keys('k', 5, 0), 'concentric')],
    pins: [STANDING_LEG, handOnWall([0, 1.2, -0.55], [0, 0, 1], [0, -0.4, 1])],
    props: [wall([0, 0, -0.55], [0, 0, 1])],
    working: ['leg.r'],
    perSide: true,
  },

  'worlds-greatest-stretch': {
    camera: { yaw: 40, pitch: 10 },
    poses: {
      down: pose(LUNGE_BASE, {
        spine: { flex: -2 },
        'shoulder.r': { plane: 90, elev: 68.9, rot: 0 },
        'wrist.r': { dev: 90 },
        straight: ['arm.l', 'arm.r', 'leg.l'],
      }),
      reach: pose(LUNGE_BASE, {
        spine: { flex: -2 },
        'shoulder.r': { plane: 70, elev: 100, rot: 0 },
        'elbow.r': { flex: 10 },
      }),
      up: pose(LUNGE_BASE, {
        root: { lean: 62.2 },
        spine: { flex: -8, twist: -12 },
        chest: { twist: -30, flex: -4.5 },
        neck: { flex: -26 },
        'shoulder.r': { plane: -49.6, elev: 130, rot: -57.6 },
        'elbow.r': { flex: 4 },
        straight: ['arm.l', 'arm.r', 'leg.l'],
      }),
    },
    start: 'up',
    still: 'up',
    loop: [
      { to: 'reach', phase: 'eccentric', share: 0.5 },
      { to: 'down', phase: 'eccentric', share: 0.5 },
      { to: 'down', phase: 'pause' },
      { to: 'reach', phase: 'concentric', share: 0.5 },
      { to: 'up', phase: 'concentric', share: 0.5 },
      { to: 'up', phase: 'hold' },
    ],
    pins: [
      { contact: 'foot.r', mode: 'plant', at: [0.42, 0, 0.36] },
      { contact: 'foot.l', mode: 'plant', rest: 'toes', at: [-0.92, 0.006, -0.09] },
      palms({ x: 0.42, width: 0.24, elbows: [0, 0.2, 1] })[0]!,
    ],
    props: [],
    working: ['torso', 'arm.r'],
    perSide: true,
  },

  'hip-90-90-switch': {
    camera: { yaw: 90, pitch: 55 },
    poses: Object.fromEntries(WIPE_KEYS.map((k) => [k.name, k.pose])),
    // The wipe takes its time.
    neutral: { eccentric: 2, pause: 0.4, concentric: 2, hold: 0.4 },
    start: 'left',
    still: 'right',
    loop: [
      ...sweep(WIPE_KEYS, 'eccentric'),
      { to: 'right', phase: 'pause' },
      ...sweep([...WIPE_KEYS].reverse(), 'concentric'),
      { to: 'left', phase: 'hold' },
    ],
    // The hands stay down behind; the keys keep the heels on their spots.
    pins: palms({ x: -0.22, width: 0.5, elbows: [-0.6, 0.1, 0.8] }),
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  inchworm: {
    camera: { yaw: 8, pitch: 10 },
    poses: {
      stand: standAt(-0.159),
      fold: INCH_FOLD,
      mid: INCH_MID,
      walk: INCH_WALK,
      plank: plankShape,
      ...Object.fromEntries(INCH_IN.map((row, i) => [INCH_IN_NAMES[i]!, inchIn(row)])),
      foldOn: INCH_FOLD_IN,
      rollUp: INCH_ROLL,
      standOut: standAt(0.733),
      back1: walkBack(BACK_R[1]!, BACK_L[0]!),
      back2: walkBack(BACK_R[1]!, BACK_L[1]!),
      back3: walkBack(BACK_R[2]!, BACK_L[1]!),
      back4: walkBack(BACK_R[2]!, BACK_L[2]!),
      back5: walkBack(BACK_R[3]!, BACK_L[2]!),
    },
    // The whole move needs its time: unhurried hand and foot steps, a slow roll up, a calm walk back.
    neutral: { eccentric: seconds(INCH_DOWN), pause: 0.4, concentric: seconds(INCH_UP), hold: 0.4 },
    start: 'stand',
    still: 'mid',
    loop: [
      ...timed('eccentric', INCH_DOWN),
      { to: 'plank', phase: 'pause' },
      ...timed('concentric', INCH_UP),
      { to: 'stand', phase: 'hold' },
    ],
    pins: [
      // The toes stay put while the hands walk out, and let go in the plank before the first step.
      ...during([0, 1, 2, 3, 4, 5, 6, 7], [onToes([0, 0, 0])]),
      // The hands: down at the fold, then each stop on the way out, held while the feet walk in.
      ...during([1], palms({ x: INCH_HANDS.fold, width: 0.4 })),
      ...during([3], palms({ x: INCH_HANDS.mid, width: 0.4 })),
      ...during([5], palms({ x: INCH_HANDS.walk, width: 0.4 })),
      ...during(
        Array.from({ length: afterRoll(0) - INCH_DOWN.length }, (_, i) => INCH_DOWN.length + i),
        palms({ x: INCH_HANDS.plank, width: 0.43, height: 0.003 }),
      ),
      // The keys place the feet as they walk in; from the fold they stand flat, heels down, and the
      // body rides on the straight left leg through the roll up.
      ...flatFoot('r', 0.892, [afterRoll(0), afterRoll(1)]),
      ...flatFoot('l', 0.892, [afterRoll(0), afterRoll(1), afterRoll(2)], true),
      // Walking back, the feet alternating: each step lands, and the body rides on that straight
      // leg while the other foot steps past it.
      ...flatFoot('r', BACK_R[1]!, [afterRoll(3)], true),
      ...flatFoot('l', BACK_L[1]!, [afterRoll(4)], true),
      ...flatFoot('r', BACK_R[2]!, [afterRoll(5)], true),
      ...flatFoot('l', BACK_L[2]!, [afterRoll(6)], true),
      ...flatFoot('r', BACK_R[3]!, [afterRoll(7), afterRoll(8)], true),
      ...flatFoot('l', BACK_L[3]!, [afterRoll(8)]),
    ],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'ankle-rocks': {
    camera: { yaw: 6, pitch: 6 },
    poses: {
      upright: pose(
        body([0.08, 0.86], 4, {
          r: { ankle: [0.2, 0.075] },
          l: { ankle: [-0.14, 0.075] },
        }),
        { shoulder: { plane: 70, elev: 60 }, elbow: { flex: 30 } },
      ),
      knee: pose(
        body([0.11, 0.8], 12, {
          r: { ankle: [0.2, 0.075] },
          l: { ankle: [-0.14, 0.075] },
        }),
        { shoulder: { plane: 70, elev: 68 }, elbow: { flex: 30 } },
      ),
    },
    start: 'upright',
    still: 'knee',
    loop: rep('knee', 'upright'),
    pins: [
      ...feet(),
      ...palms({
        x: 0.45,
        width: 0.4,
        height: 1.05,
        normal: [-1, 0, 0],
        elbows: [0.45, -0.85, 0.3],
      }),
    ],
    props: [wall([0.41, 0, 0], [-1, 0, 0])],
    working: ['leg.r'],
    perSide: true,
  },

  'deep-squat-hold': {
    camera: { yaw: 48, pitch: 8 },
    poses: {
      settled: deepSquat(0.235, 34),
      tall: deepSquat(0.27, 28),
    },
    start: 'tall',
    still: 'settled',
    loop: hold('settled', 'tall'),
    pins: [
      { contact: 'foot.l', mode: 'plant', at: [0, 0, -0.22] },
      { contact: 'foot.r', mode: 'plant', at: [0, 0, 0.22] },
      handOn('l', 'chest', [0.15, 0.17, -0.03], [0, -0.6, 1]),
      handOn('r', 'chest', [0.15, 0.17, 0.03], [0, -0.6, 1]),
    ],
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'walking-knee-hug': {
    camera: { yaw: 16, pitch: 6 },
    poses: {
      hug: pose(STAND, {
        // Up on the ball of the standing foot (the toe stays where it was).
        root: { pos: [0.11, 1.0, 0], lean: 4 },
        neck: { flex: -4 },
        'ankle.l': { flex: -30 },
        'hip.r': { plane: 90, elev: 138 },
        'knee.r': { flex: 132 },
        'ankle.r': { flex: 0 },
        'shoulder.r': { plane: 121.2, elev: 23.6, rot: -8.2 },
        'elbow.r': { flex: 74.8 },
        'shoulder.l': { plane: 119, elev: 32.1, rot: 32 },
        'elbow.l': { flex: 56.8 },
      }),
      step: pose(STAND, {
        root: { pos: [0, 0.936, 0] },
        'hip.r': { plane: 90, elev: 30 },
        'knee.r': { flex: 12 },
        'ankle.r': { flex: 8 },
        shoulder: { plane: 90, elev: 8 },
        elbow: { flex: 14 },
      }),
    },
    start: 'hug',
    still: 'hug',
    loop: rep('step', 'hug'),
    pins: [],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },
} satisfies Record<string, ExerciseAnimation>;
