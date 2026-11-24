import type { AnimationPin, AnimationPose, ExerciseAnimation } from '@/domain';
import {
  aim,
  bandTo,
  body,
  feet,
  onForearms,
  PRONE,
  handOn,
  handOnWall,
  hold,
  pose,
  support,
  underFoot,
  wall,
} from './shared';

/*
 * Lower-body static stretches: an easing-in pose and a held pose that settles a little, looped at
 * a slow breathing pace. Supine and prone poses are placed by angles from the lying bases (hip
 * elevation = degrees above the floor); standing and seated ones by the vertical-plane solver;
 * legs crossed out of that plane (the figure-fours) by where their ankle rests (`legTo`).
 */

/** A slow, breathing pace for every stretch: ease in, rest, ease off, rest. */
const SLOW = { eccentric: 2.2, pause: 1.2, concentric: 1.6, hold: 0.5 };

/** One item for each side, left then right. */
const both = <T>(make: (S: 'l' | 'r') => T): T[] => [make('l'), make('r')];

/* A leg placed by where its knee and ankle go, for crossed legs out of the vertical plane. */

type V3 = [number, number, number];
const RAD = Math.PI / 180;
const r1 = (x: number) => Math.round(x * 10) / 10;
const minus = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dotOf = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => times(a, 1 / Math.hypot(...a));
/** `v` turned `deg` degrees about the unit axis `k`. */
const turned = (v: V3, k: V3, deg: number): V3 => {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const kx: V3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return plus(plus(times(v, c), times(kx, s)), times(k, dotOf(k, v) * (1 - c)));
};

/** Where the pelvis is: its position and the root's lean, turn and tilt (as in a pose). */
interface Pelvis {
  pos: V3;
  lean: number;
  turn?: number;
  tilt?: number;
}
/** A point of the room in the pelvis's own axes (x forward, y up the spine, z to the right). */
const inPelvis = ({ pos, lean, turn = 0, tilt = 0 }: Pelvis, p: V3): V3 => {
  // The root turns by tilt about x, then lean about z, then turn about y: undo them in reverse.
  let v = minus(p, pos);
  v = turned(v, [0, 1, 0], -turn);
  v = turned(v, [0, 0, 1], lean);
  return turned(v, [1, 0, 0], -tilt);
};

/**
 * A leg's hip and knee angles that put its ankle at `ankle` (a point of the room), the knee
 * sitting off the line from the hip to the ankle the way `toward` points; thigh and shin keep
 * their lengths (an ankle out of reach leaves the leg straight toward it). The left side mirrors
 * the right, as the figure does.
 */
function legTo(S: 'l' | 'r', pelvis: Pelvis, ankle: V3, toward: V3): AnimationPose {
  const hip: V3 = [0, -0.02, 0.085];
  const side = (v: V3): V3 => (S === 'l' ? [v[0], v[1], -v[2]] : v);
  const a = side(inPelvis(pelvis, ankle));
  const w0 = side(minus(inPelvis(pelvis, plus(pelvis.pos, toward)), inPelvis(pelvis, pelvis.pos)));
  const d = Math.min(Math.hypot(...minus(a, hip)), 0.829);
  const u = unit(minus(a, hip));
  const w = unit(minus(w0, times(u, dotOf(w0, u))));
  const along = (0.42 ** 2 - 0.41 ** 2 + d ** 2) / (2 * d);
  const knee = plus(hip, plus(times(u, along), times(w, Math.sqrt(0.42 ** 2 - along ** 2))));
  const t = unit(minus(knee, hip));
  const sh = unit(minus(plus(hip, times(u, d)), knee));
  // Hanging is -y; plane 0 is out to the side, 90 forward.
  const p = r1(Math.atan2(t[0], t[2]) / RAD);
  const e = r1(Math.acos(Math.max(-1, Math.min(1, -t[1]))) / RAD);
  const axis: V3 = [-Math.cos(p * RAD), 0, Math.sin(p * RAD)];
  const x0 = turned([1, 0, 0], axis, e);
  const z0 = turned([0, 0, 1], axis, e);
  // The front of the thigh faces away from the way the shin folds.
  const f = times(unit(minus(sh, times(t, dotOf(sh, t)))), -1);
  const rot = Math.atan2(-dotOf(f, z0), dotOf(f, x0)) / RAD;
  const flex = Math.acos(Math.max(-1, Math.min(1, dotOf(t, sh)))) / RAD;
  return {
    [`hip.${S}`]: { plane: p, elev: e, rot: r1(rot) },
    [`knee.${S}`]: { flex: r1(flex) },
  } as AnimationPose;
}

/** On the back, head toward -x, the trunk flat on the floor, the neck resting. */
const LYING: AnimationPose = {
  root: { pos: [0, 0.102, 0], lean: -90 },
  neck: { flex: 10 },
};

/** Hands resting on the raised thigh of a leg on a chair. */
const HANDS_THIGH: AnimationPose = {
  shoulder: { plane: 90, elev: 60 },
  elbow: { flex: 20 },
};

/** Facing a wall, leaning in with the body in one line from the back foot: feet at `ankles`. */
const wallLean = (
  hip: [number, number],
  lean: number,
  ankles: { r: [number, number]; l: [number, number] },
): AnimationPose =>
  pose(body(hip, lean, { r: { ankle: ankles.r }, l: { ankle: ankles.l } }), {
    neck: { flex: -lean * 0.5 },
    shoulder: { plane: 90, elev: 100 },
    elbow: { flex: 25 },
  });

/** Both palms on a wall at `x`, `y` high, shoulder-width apart. */
const wallHands = (x: number, y: number): AnimationPin[] =>
  both((S) =>
    handOnWall([x, y, S === 'l' ? -0.2 : 0.2], [-1, 0, 0], [0.4, -0.9, S === 'l' ? -0.3 : 0.3], S),
  );

/** Sitting on the floor reaching forward over a straight right leg, the left foot at its thigh. */
const floorReach = (lean: number): AnimationPose =>
  pose(body([0, 0.094], lean, { r: { ankle: [0.826, 0.08] } }), {
    root: { pos: [0, 0.114, 0], lean },
    'ankle.r': { flex: 4 },
    'hip.l': { plane: 35, elev: 90, rot: -90 },
    neck: { flex: -lean * 0.5 },
    shoulder: { plane: 90, elev: 70 },
    elbow: { flex: 12 },
  });

/** Lying on the right side, the top (left) heel drawn toward the buttock. */
const sideQuad = (elev: number, flex: number): AnimationPose =>
  pose({
    root: { pos: [0, 0.236, 0], lean: 0, tilt: 90 },
    neck: { flex: 6 },
    'hip.r': { plane: 90, elev: 60 },
    'knee.r': { flex: 105 },
    'hip.l': { plane: 90, elev },
    'knee.l': { flex },
    'ankle.l': { flex: -30 },
    'shoulder.r': { plane: 60, elev: 168, rot: 0 },
    'elbow.r': { flex: 12 },
    'clav.l': { prot: -12 },
    'shoulder.l': { plane: 90, elev: 20, rot: 0 },
    'elbow.l': { flex: 90 },
  });

/** Standing on the left leg, the right heel drawn to the buttock. */
const standQuad = (lean: number, elev: number, flex: number): AnimationPose =>
  pose(body([0, 0.9], lean, { l: { ankle: [0, 0.075] }, r: { ankle: [-0.2, 0.85] } }), {
    'hip.r': { plane: 90, elev },
    'knee.r': { flex },
    shoulder: { plane: 90, elev: 30 },
  });

/** Long split stance, the right foot back on its toes. */
const splitStance = (hip: [number, number], lean: number): AnimationPose =>
  pose(body(hip, lean, { l: { ankle: [0.38, 0.075] }, r: { ankle: [-0.58, 0.162], foot: -22 } }), {
    'knee.r': { flex: 0 },
    shoulder: { plane: -15, elev: 30, rot: 80 },
    elbow: { flex: 95 },
    straight: ['leg.r'],
  });

/** Low lunge, the right knee on the floor behind, the torso tall. */
const kneeling = (hip: [number, number], lean: number): AnimationPose =>
  pose(body(hip, lean, { l: { ankle: [0.42, 0.075] }, r: { ankle: [-0.5, 0.07] } }), {
    'ankle.r': { flex: -90 },
    shoulder: { plane: -15, elev: 30, rot: 80 },
    elbow: { flex: 95 },
  });

/** On the edge of a chair, the right leg straight forward on its heel, hinging over it. */
const chairReach = (lean: number): AnimationPose =>
  pose(body([0, 0.53], lean, { l: { ankle: [0.42, 0.075] }, r: { ankle: [0.694, 0.075] } }), {
    root: { pos: [0, 0.548, 0], lean },
    'ankle.r': { flex: 8 },
    neck: { flex: -lean * 0.6 },
    shoulder: { plane: 90, elev: 55 },
    elbow: { flex: 25 },
  });

/** Long sitting, back tall, the right foot pulled back toward the shin. */
const longSit = (flex: number): AnimationPose =>
  pose(body([0, 0.094], -4, { l: { ankle: [0.826, 0.08] }, r: { ankle: [0.826, 0.08] } }), {
    root: { pos: [0, 0.114, 0], lean: -4 },
    'ankle.l': { flex: 4 },
    'ankle.r': { flex },
    shoulder: { plane: 90, elev: 50 },
    elbow: { flex: 25 },
  });

/**
 * Sitting on a chair, the right ankle across the left thigh just above the knee and the right knee
 * dropped out to the side (the "4"), leaning over it from the hips: the pelvis tips `SEAT_TIP`,
 * the back adds `back` degrees.
 */
const SEAT_TIP = 14;
const SEAT: Pelvis = { pos: [0, 0.548, 0], lean: SEAT_TIP };
const seatedFour = (back: number): AnimationPose =>
  pose(body([0, 0.53], SEAT_TIP, { l: { ankle: [0.42, 0.075] } }), {
    root: { pos: SEAT.pos, lean: SEAT_TIP },
    ...legTo('r', SEAT, [0.32, 0.585, -0.1], [0.15, -0.2, 1]),
    'ankle.r': { flex: 12 },
    spine: { flex: r1(back * 0.55) },
    chest: { flex: r1(back * 0.45) },
    neck: { flex: -(SEAT_TIP + back) * 0.55 },
    shoulder: { plane: 90, elev: 40 },
    elbow: { flex: 40 },
  });

/**
 * On the back, the left thigh drawn `elev` degrees toward the chest, the right ankle across its
 * front just above the knee and the right knee open to the side (the "4").
 */
const LYING_PELVIS: Pelvis = { pos: [0, 0.102, 0], lean: -90 };
const lyingFour = (elev: number): AnimationPose => {
  const a = elev * RAD;
  // The left thigh runs from its hip along `thigh`; its front faces `front` (toward the face).
  const thigh: V3 = [Math.cos(a), Math.sin(a), 0];
  const front: V3 = [-Math.sin(a), Math.cos(a), 0];
  const onThigh = plus([0.02, 0.102, -0.085], times(thigh, 0.33));
  const ankle = plus(plus(onThigh, times(front, 0.09)), [0, 0, -0.03]);
  return pose(LYING, {
    'hip.l': { plane: 90, elev },
    'knee.l': { flex: 72 },
    'ankle.l': { flex: 8 },
    ...legTo('r', LYING_PELVIS, ankle, [-0.1, 0, 1]),
    'ankle.r': { flex: 12 },
    shoulder: { plane: 90, elev: 150 },
    elbow: { flex: 30 },
  });
};

/** Sitting tall on the floor, soles together, knees open to the sides. */
const butterfly = (lean: number): AnimationPose => ({
  root: { pos: [0, 0.114, 0], lean },
  neck: { flex: -lean * 0.4 },
  hip: { plane: 90, elev: 90, rot: -60 },
  shoulder: { plane: 90, elev: 40 },
  elbow: { flex: 40 },
});

/** Wide stance, weight over the bent left knee, the right leg straight. */
const sideLunge = (z: number, shift: number): AnimationPose => ({
  root: { pos: [0, 0.66, z], lean: 0 },
  'hip.r': { plane: 0, elev: 55 },
  'hip.l': { plane: 0, elev: 35 },
  'knee.l': { flex: 70 },
  'knee.r': { flex: 2 },
  spine: { bend: shift },
  chest: { bend: shift },
  shoulder: { plane: 90, elev: 40 },
  elbow: { flex: 40 },
  straight: ['leg.r'],
});

/** On all fours widened into a frog, forearms down, hips back. */
const frog = (lean: number, y: number, plane: number): AnimationPose => ({
  root: { pos: [-0.3, y, 0], lean },
  neck: { flex: -8 },
  hip: { plane, elev: 90, rot: -38 },
  knee: { flex: 90 },
  ankle: { flex: -30 },
});

/** Standing beside a wall, the outer leg crossed behind, hip pushed out, leaning in. */
const crossedLeg = (bend: number): AnimationPose => ({
  root: { pos: [0, 0.88, 0.05], lean: 0 },
  spine: { bend },
  chest: { bend: bend * 0.6 },
  'hip.l': { plane: 90, elev: 0 },
  'hip.r': { plane: 90, elev: -6 },
  'knee.l': { flex: 3 },
  'knee.r': { flex: 3 },
  'ankle.r': { flex: -25 },
  'shoulder.l': { plane: 0, elev: 85 },
  'shoulder.r': { plane: 180, elev: 150 },
  elbow: { flex: 12 },
});

/**
 * On the back, the right knee drawn up and across the body: the pelvis rolls `roll` degrees onto
 * its left side with the knee while the back untwists, so both shoulders stay flat on the floor.
 * Rolled this way, the root takes its turn and tilt as well as its lean.
 */
const rolled = (roll: number): Pelvis => ({
  pos: [0, Math.round((0.102 + 0.06 * Math.sin(roll * RAD)) * 1000) / 1000, 0],
  lean: -(90 + roll),
  turn: -90,
  tilt: 90,
});
const crossKnee = (roll: number, plane: number): AnimationPose => {
  const pelvis = rolled(roll);
  return pose(LYING, {
    root: { pos: pelvis.pos, lean: pelvis.lean, turn: pelvis.turn, tilt: pelvis.tilt },
    spine: { twist: r1(-roll * 0.55) },
    chest: { twist: r1(-roll * 0.45) },
    ...legTo('l', pelvis, [0.86, 0.085, -0.11], [0, 1, 0]),
    'ankle.l': { flex: 4 },
    'hip.r': { plane, elev: 100, rot: 0 },
    'knee.r': { flex: 100 },
    'shoulder.r': { plane: 0, elev: 85 },
    'elbow.r': { flex: 8 },
    'shoulder.l': { plane: 90, elev: 100 },
    'elbow.l': { flex: 40 },
  });
};

/**
 * Face down, the right heel drawn toward the buttock by a band looped over the front of the ankle,
 * both ends in the right hand beside the hip; the left arm rests along the body.
 */
const proneQuad = (flex: number): AnimationPose =>
  pose(PRONE, {
    root: { pos: [0, 0.133, 0], lean: 90 },
    'knee.r': { flex },
    'ankle.r': { flex: -35 },
    'knee.l': { flex: 6 },
    'ankle.l': { flex: -35 },
    shoulder: aim([0.08, -0.98, 0.14]),
    elbow: { flex: 10 },
  });

export const stretchLowerAnimations = {
  'lying-band-hamstring-stretch': {
    camera: { yaw: -14, pitch: 16 },
    poses: {
      into: pose(LYING, {
        'hip.r': { plane: 90, elev: 82 },
        'knee.r': { flex: 4 },
        'ankle.r': { flex: 14 },
        'hip.l': { plane: 90, elev: 2 },
        'knee.l': { flex: 3 },
        shoulder: { plane: 90, elev: 150, rot: 0 },
        elbow: { flex: 12 },
        straight: ['leg.r', 'leg.l'],
      }),
      held: pose(LYING, {
        'hip.r': { plane: 90, elev: 98 },
        'knee.r': { flex: 4 },
        'ankle.r': { flex: 18 },
        'hip.l': { plane: 90, elev: 2 },
        'knee.l': { flex: 3 },
        shoulder: { plane: 90, elev: 150, rot: 0 },
        elbow: { flex: 12 },
        straight: ['leg.r', 'leg.l'],
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: both((S) => handOn(S, 'ankle.r', [0.32, 0.45, S === 'l' ? -0.1 : 0.1], [0.3, -0.6, 1])),
    props: bandTo(underFoot('r')),
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },
  'standing-chair-hamstring-stretch': {
    camera: { yaw: 18, pitch: 6 },
    poses: {
      into: pose(body([0, 0.895], 24, { l: { ankle: [0, 0.075] }, r: { ankle: [0.745, 0.54] } }), {
        neck: { flex: -14 },
        'ankle.r': { flex: 2 },
        ...HANDS_THIGH,
      }),
      held: pose(body([0, 0.895], 40, { l: { ankle: [0, 0.075] }, r: { ankle: [0.745, 0.54] } }), {
        neck: { flex: -26 },
        'ankle.r': { flex: 2 },
        ...HANDS_THIGH,
      }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant' },
      { contact: 'foot.r', mode: 'plant', rest: 'heel', at: [0.765, 0.45, 0.085] },
      handOn('l', 'root', [0.01, 0.03, -0.19], [-0.4, -0.4, 1]),
      handOn('r', 'knee.r', [0.06, 0.16, 0.04], [0, -0.6, 1]),
    ],
    props: [support('chair', [0.845, 0.45, 0], 180), wall([1.105, 0, 0], [-1, 0, 0])],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'wall-calf-stretch': {
    camera: { yaw: 5, pitch: 6 },
    poses: {
      into: wallLean([-0.134, 0.864], 18, { r: [-0.39, 0.075], l: [0.1, 0.075] }),
      held: wallLean([0.025, 0.794], 30, { r: [-0.39, 0.075], l: [0.1, 0.075] }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), ...wallHands(0.55, 1.25)],
    props: [wall([0.55, 0, 0], [-1, 0, 0])],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'bent-knee-wall-calf-stretch': {
    camera: { yaw: 5, pitch: 6 },
    poses: {
      into: wallLean([-0.1, 0.8], 15, { r: [-0.33, 0.075], l: [0.3, 0.075] }),
      held: wallLean([0, 0.76], 24, { r: [-0.33, 0.075], l: [0.3, 0.075] }),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [...feet(), ...wallHands(0.52, 1.2)],
    props: [wall([0.52, 0, 0], [-1, 0, 0])],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },
  'seated-hamstring-reach': {
    camera: { yaw: 34, pitch: 12 },
    poses: {
      into: floorReach(22),
      held: floorReach(48),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant', at: [0.3, 0, -0.03] },
      handOn('l', 'knee.r', [0.07, -0.05, -0.03], [0, -0.6, -1]),
      handOn('r', 'knee.r', [0.07, -0.12, 0.03], [0, -0.6, 1]),
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'side-lying-quad-stretch': {
    camera: { yaw: 66, pitch: 64 },
    poses: {
      into: sideQuad(-14, 146),
      held: sideQuad(-10, 150),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [handOn('l', 'ankle.l', [0, 0.02, -0.045], [-0.6, -0.4, -1])],
    props: [],
    working: ['leg.l'],
    perSide: true,
    neutral: SLOW,
  },

  'standing-quad-stretch': {
    camera: { yaw: 5, pitch: 6 },
    poses: {
      into: standQuad(2, -6, 150),
      held: standQuad(-6, -8, 152),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant' },
      handOnWall([0.45, 1.2, -0.12], [-1, 0, 0], [0.4, -0.9, -0.3], 'l'),
      handOn('r', 'ankle.r', [0.02, 0.04, 0], [-1, -0.2, 1]),
    ],
    props: [wall([0.45, 0, 0], [-1, 0, 0])],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'standing-hip-flexor-stretch': {
    camera: { yaw: 22, pitch: 8 },
    poses: {
      into: splitStance([-0.04, 0.788], 4),
      held: splitStance([0.04, 0.709], -4),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant' },
      handOn('l', 'root', [-0.02, 0.1, -0.19], [-0.6, -0.1, -1]),
      handOn('r', 'root', [-0.02, 0.1, 0.19], [-0.6, -0.1, 1]),
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'half-kneeling-hip-flexor-stretch': {
    camera: { yaw: 22, pitch: 8 },
    poses: {
      into: kneeling([-0.04, 0.47], 4),
      held: kneeling([0.04, 0.465], -4),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant' },
      handOn('l', 'root', [-0.02, 0.1, -0.19], [-0.6, -0.1, -1]),
      handOn('r', 'root', [-0.02, 0.1, 0.19], [-0.6, -0.1, 1]),
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'chair-seated-hamstring-stretch': {
    camera: { yaw: 22, pitch: 8 },
    poses: {
      into: chairReach(18),
      held: chairReach(42),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant' },
      { contact: 'foot.r', mode: 'plant', rest: 'heel' },
      handOn('l', 'knee.r', [0.07, 0.17, -0.03], [0, -0.6, -1]),
      handOn('r', 'knee.r', [0.07, 0.12, 0.03], [0, -0.6, 1]),
    ],
    props: [support('chair', [-0.1, 0.45, 0], 0)],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'seated-band-calf-stretch': {
    camera: { yaw: 16, pitch: 8 },
    poses: {
      into: longSit(12),
      held: longSit(34),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: both((S) =>
      handOn(S, 'root', [0.32, 0.3, S === 'l' ? -0.1 : 0.1], [-0.2, -0.8, S === 'l' ? -0.5 : 0.5]),
    ),
    props: [...bandTo({ frame: 'ankle.r', at: [0.11, -0.055, 0] })],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },
  'seated-figure-four-stretch': {
    camera: { yaw: 90, pitch: 38 },
    poses: {
      into: seatedFour(9),
      held: seatedFour(16),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant' },
      handOn('r', 'hip.r', [0.065, -0.3, 0], [0, -0.6, 1]),
      handOn('l', 'hip.l', [0.075, -0.2, -0.03], [0, -0.6, 1]),
    ],
    props: [support('chair', [0, 0.45, 0], 0)],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'lying-figure-four-stretch': {
    camera: { yaw: 68, pitch: 40 },
    poses: {
      into: lyingFour(118),
      held: lyingFour(126),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      handOn('l', 'hip.l', [-0.05, -0.22, -0.085], [-0.2, -0.3, -1]),
      handOn('r', 'hip.l', [-0.05, -0.21, 0.085], [-0.2, -0.3, 1]),
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'seated-butterfly-stretch': {
    camera: { yaw: 84, pitch: 16 },
    poses: {
      into: butterfly(4),
      held: butterfly(14),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant', at: [0.24, 0, -0.03] },
      { contact: 'foot.r', mode: 'plant', at: [0.24, 0, 0.03] },
      handOn('l', 'ankle.l', [0.06, 0.04, 0], [0, -0.6, -1]),
      handOn('r', 'ankle.r', [0.06, 0.04, 0], [0, -0.6, 1]),
    ],
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
    neutral: SLOW,
  },

  'standing-side-lunge-adductor-stretch': {
    camera: { yaw: 78, pitch: 8 },
    poses: {
      into: sideLunge(-0.06, -2),
      held: sideLunge(-0.15, -7),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant', at: [0, 0, -0.58] },
      { contact: 'foot.r', mode: 'plant', at: [0, 0, 0.58], straight: true },
      handOn('l', 'root', [0.1, 0.0, -0.17], [-0.4, -0.6, -1]),
      handOn('r', 'root', [0.1, 0.0, -0.08], [-0.4, -0.6, 0.3]),
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'kneeling-frog-stretch': {
    camera: { yaw: -100, pitch: 45 },
    poses: {
      into: frog(93, 0.336, 42),
      held: frog(96, 0.359, 47),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: onForearms(),
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
    neutral: SLOW,
  },

  'standing-crossed-leg-side-stretch': {
    camera: { yaw: 84, pitch: 6 },
    poses: {
      into: crossedLeg(-8),
      held: crossedLeg(-16),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [
      { contact: 'foot.l', mode: 'plant', at: [0, 0, -0.06] },
      { contact: 'foot.r', mode: 'plant', rest: 'toes', at: [-0.14, 0.004, -0.14] },
      handOnWall([0, 1.35, -0.5], [0, 0, 1], [0.2, -0.9, -0.5], 'l'),
    ],
    props: [wall([0, 0, -0.5], [0, 0, 1])],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'lying-cross-body-knee-stretch': {
    camera: { yaw: 64, pitch: 44 },
    poses: {
      into: crossKnee(24, 113),
      held: crossKnee(30, 118),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [handOn('l', 'hip.r', [0.03, -0.34, 0.085], [0.3, -0.6, -1])],
    props: [],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },

  'band-prone-quad-stretch': {
    camera: { yaw: 40, pitch: 28 },
    poses: {
      into: proneQuad(105),
      held: proneQuad(128),
    },
    start: 'into',
    still: 'held',
    loop: hold('held', 'into'),
    pins: [handOn('r', 'root', [-0.02, -0.02, 0.2], [-0.6, -0.2, 0.5])],
    props: [...bandTo({ frame: 'ankle.r', at: [0.03, 0, 0.045] }, ['r'])],
    working: ['leg.r'],
    perSide: true,
    neutral: SLOW,
  },
} as const satisfies Record<string, ExerciseAnimation>;
