import type {
  AnimationPin,
  AnimationPose,
  AnimationProp,
  ExerciseAnimation,
  LoopStep,
} from '@/domain';
import {
  arms,
  armsTogether,
  ARMS_STRAIGHT,
  bandTo,
  body,
  dipBars,
  doorFaceOn,
  dipHands,
  doorwayBar,
  during,
  feet,
  handOn,
  hangFrom,
  hung,
  hipBetween,
  hold,
  leg,
  legAbs,
  onBar,
  forearms,
  onToes,
  plank,
  pose,
  PRONE,
  rep,
  sidePlank,
  STAND,
  support,
  supine,
  trunk,
  wall,
  weightIn,
  weights,
  type Foot,
  type PlanePoint,
} from './shared';

/*
 * Core family. Most moves are on the floor, so poses are placed in the vertical plane with a few
 * small helpers: `arms` gives both arms in absolute angles, `trunk` returns where the shoulders end
 * up for a leaning trunk, and the lying bases put the body on its back or its front.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const rnd = (x: number) => Math.round(x * 10) / 10;

/** Straight arms from `from` toward `to`, for a chest pitched `lean`. */
const armsToward = (from: PlanePoint, to: PlanePoint, lean: number): AnimationPose => {
  const a = deg(Math.atan2(to[0] - from[0], -(to[1] - from[1])));
  return arms(a, a, lean);
};

/* ------------------------------------------------------------------ */
/* Planks on the forearms                                              */
/* ------------------------------------------------------------------ */

/** Planks from the side, a little in front so both forearms show. */
const PLANK_CAMERA = { yaw: 14, pitch: 10 };

/* ------------------------------------------------------------------ */
/* On the back and on the front                                        */
/* ------------------------------------------------------------------ */

/** Floor work seen from the side, a little toward the head, looking down. */
const FLOOR_CAMERA = { yaw: -14, pitch: 18 };

/** On the back, head toward -x, the trunk flat on the floor, the neck resting. */
const LYING: AnimationPose = {
  root: { pos: [0, 0.098, 0], lean: -90 },
  neck: { flex: 10 },
};

/**
 * Arms along the floor overhead (`beta` degrees above it toward the head: 0 = along the floor,
 * 90 = straight up, 180 = by the hips) for a chest tipped up `c` degrees.
 */
const armsOver = (beta: number, c = 0, flex = 6): AnimationPose => ({
  shoulder: { plane: 90, elev: rnd(180 - beta + c), rot: 0 },
  elbow: { flex },
});

/** Legs raised `e` degrees above the floor (a supine pelvis): hip elevation is that angle. */
const legsUp = (e: number, knee = 0): AnimationPose => ({
  hip: { plane: 90, elev: e },
  knee: { flex: knee },
});

/** Hands at the temples, elbows wide. */
const TEMPLES: AnimationPin[] = (['l', 'r'] as const).map((S) =>
  handOn(S, 'head', [-0.06, 0.09, S === 'l' ? -0.08 : 0.08], [-0.2, 0.1, 1]),
);
/** Lifts the pelvis a hair so the elbows resting wide do not dip into the floor. */
const FLOATING: AnimationPose = { root: { pos: [0, 0.112, 0], lean: -90 } };
const TEMPLES_ARMS: AnimationPose = { elbow: { flex: 120 } };

/** Arms along the sides of a body lying face down (toward the feet). */
const ARMS_BY_SIDES: AnimationPose = {
  shoulder: { plane: 90, elev: 0, rot: 0 },
  elbow: { flex: 6 },
};

/** Arms reaching ahead of a body lying face down, `elev` from the feet-side line. */
const REACH_FORWARD = (elev: number): AnimationPose => ({
  shoulder: { plane: 90, elev, rot: 0 },
  elbow: { flex: 6 },
});

/** Hollow: the lower back on the floor, the shoulders and legs `c` degrees up, arms in line. */
function hollow(c: number): AnimationPose {
  return pose(LYING, {
    chest: { flex: c },
    neck: { flex: 4 },
    hip: { plane: 90, elev: c },
    knee: { flex: 0 },
    ankle: { flex: -20 },
    shoulder: { plane: 90, elev: 180, rot: 0 },
    elbow: { flex: 6 },
    straight: ['arm.l', 'arm.r', 'leg.l', 'leg.r'],
  });
}

/** Reverse crunch: the lumbar spine curls `phi` degrees, lifting the pelvis, the knees to the chest. */
function reverseCurl(phi: number): AnimationPose {
  const a = rad(phi);
  return pose(LYING, armsOver(180), {
    root: {
      pos: [rnd3(-0.19 + 0.19 * Math.cos(a)), rnd3(0.098 + 0.19 * Math.sin(a)), 0],
      lean: -90 - phi,
    },
    spine: { flex: phi },
    hip: { plane: 90, elev: 96 },
    knee: { flex: 112 },
  });
}
const rnd3 = (x: number) => Math.round(x * 1000) / 1000;

/** Bicycle: one knee drawn in toward the opposite elbow, the other leg out, the chest turned. */
function bicycle(dir: 1 | -1): AnimationPose {
  const near = dir === 1 ? 'l' : 'r';
  const far = dir === 1 ? 'r' : 'l';
  return pose(LYING, TEMPLES_ARMS, FLOATING, {
    spine: { flex: 6 },
    chest: { flex: 34, twist: 45 * dir },
    neck: { flex: 4 },
    [`hip.${near}`]: { plane: 90, elev: 125 },
    [`knee.${near}`]: { flex: 118 },
    [`hip.${far}`]: { plane: 90, elev: 22 },
    [`knee.${far}`]: { flex: 6 },
  } as AnimationPose);
}

/** V-up: balanced on the sit bones, the trunk `theta` and the straight legs `legE` above the floor. */
function vSit(theta: number, legE: number): AnimationPose {
  const lean = -90 + theta;
  const t = trunk([0, 0.1], lean);
  const shin: PlanePoint = [0.55 * Math.cos(rad(legE)), 0.1 + 0.55 * Math.sin(rad(legE))];
  return pose(
    LYING,
    {
      root: { pos: [rnd3(t.root[0]), rnd3(t.root[1]), 0], lean },
      neck: { flex: 0 },
      hip: { plane: 90, elev: rnd(90 + legE + lean) },
      knee: { flex: 0 },
      straight: ['leg.l', 'leg.r'],
    },
    armsToward(t.shoulder, shin, lean),
  );
}

/** All fours: knees under the hips, shins on the floor behind, arms straight down. */
const QUAD_LEAN = 79.5;
const quad = (working: AnimationPose): AnimationPose =>
  body(
    [0, 0.472],
    QUAD_LEAN,
    {},
    pose(
      legAbs('l', 0, 90, -170, QUAD_LEAN),
      legAbs('r', 0, 90, -170, QUAD_LEAN),
      arms(0, 0, QUAD_LEAN),
      { wrist: { flex: -90 } },
      { neck: { flex: 8 } },
      working,
    ),
  );

/* ------------------------------------------------------------------ */
/* On the side                                                         */
/* ------------------------------------------------------------------ */

/** Seen from the front and above: the body runs across the picture, the head to the left. */
const SIDE_PLANK_CAMERA = { yaw: 62, pitch: 22 };
/** Side plank on the right forearm: the body's angle from level is 90 - tilt. */
const SP_TILT = 76;
const SP_Y = 0.378;

/** The right forearm flat on the floor under the shoulder, pointing forward. */
const SIDE_FOREARM: AnimationPin = {
  contact: 'hand.r',
  mode: 'plant',
  at: [0.24, 0, 0.44],
  pole: { frame: 'chest', dir: [-0.5, -0.26, 0.81] },
};
/** The free hand on the hip. */
const SIDE_HAND_ON_HIP: AnimationPin = handOn('l', 'root', [0.01, 0.07, -0.165], [-0.3, 0.3, -1]);

/** Knee side plank: the thighs in line with the body, the shins folded back along the floor. */
const KSP_TILT = 67;
const KSP_Y = 0.312;
const kneeSide = (tilt: number, y: number): AnimationPose =>
  sidePlank(tilt, y, { knee: { flex: 90 }, ankle: { flex: -30 } });

/** Copenhagen: the top leg on a chair seat, the body a little higher at the hips than the shoulder. */
const COP_TILT = 89;
const COP_Y = 0.474;
const COP_FOREARM: AnimationPin = SIDE_FOREARM;
const copenhagen = (u: number): AnimationPose =>
  sidePlank(COP_TILT - u * 0.5, COP_Y + u * 0.004, {
    'hip.l': { plane: 0, elev: 0 },
    'hip.r': { plane: 0, elev: 14 },
  });

/* ------------------------------------------------------------------ */
/* Hanging and supported on bars                                       */
/* ------------------------------------------------------------------ */

/** Hanging from the bar: a little in front of the side, so the bar and the hands show. */
const HANG_CAMERA = { yaw: 18, pitch: 8 };

/** Hanging by straight arms with the shoulders set (pulled down), the legs as given. */
const hangingBody = (
  lean: number,
  sp: number,
  ch: number,
  l: AnimationPose,
  r: AnimationPose,
  straightLegs = false,
): AnimationPose =>
  pose(hangFrom([-0.03, 1.464], lean, sp, ch), { clav: { elev: -8 } }, l, r, {
    straight: straightLegs ? ['arm.l', 'arm.r', 'leg.l', 'leg.r'] : ['arm.l', 'arm.r'],
  });

/**
 * Strict toes to the bar: from a dead hang the shoulders are pulled down and set, then the legs
 * rise straight in front of the body (the hips flexing, no swing), the trunk leaning back and the
 * back curling a little as they go, until the toes touch the bar. Each stage gives the legs and
 * the trunk together so the legs stay in front of the body all the way up and down. The top thigh
 * angle is written past vertical (the ankle sits just behind the hip's line) as a plain number
 * so the hip never has to turn the long way round between stages.
 */
const T2B_STAGES = [
  // Thigh from hanging (degrees, forward positive), trunk lean, back curl, knee bend, foot pitch.
  { thigh: 6, lean: 0, curl: 0, knee: 4, foot: -10 },
  { thigh: 50, lean: -10, curl: 5, knee: 4, foot: -10 },
  { thigh: 100, lean: -20, curl: 10, knee: 6, foot: 0 },
  { thigh: 135, lean: -30, curl: 15, knee: 8, foot: 30 },
  // The top: the thigh follows from the ankle's spot below.
  { thigh: 0, lean: -40, curl: 20, knee: 12, foot: 60 },
];
const t2bStage = (i: number): AnimationPose => {
  const s = T2B_STAGES[i]!;
  const top = i === T2B_STAGES.length - 1;
  // The shoulders drift back a little as the legs rise; the arms stay straight, so their height
  // follows from the arm's reach in the vertical plane (0.4975 m, a little more as the shoulders move back) below the hands (1.955 m).
  const x = -0.03 - 0.27 * (i / (T2B_STAGES.length - 1));
  const reach = 0.4975 + 0.02 * (i / (T2B_STAGES.length - 1));
  const y = 1.955 - Math.sqrt(reach ** 2 - (0.033 - x) ** 2);
  const trunkPose = pose(hangFrom([rnd3(x), rnd3(y)], s.lean, s.curl, s.curl), {
    clav: { elev: -8 },
  });
  if (!top)
    return pose(
      trunkPose,
      legAbs('l', s.thigh, s.knee, s.foot, s.lean),
      legAbs('r', s.thigh, s.knee, s.foot, s.lean),
      { straight: ['arm.l', 'arm.r', 'leg.l', 'leg.r'] },
    );
  // At the top the knees stay a little bent: the ankles sit where the toes just meet the bar,
  // a leg's length (with that bend) from the hip. A thigh pointing past vertical is written as an
  // angle above 180 so the hip never turns the long way round between stages.
  const [rx, ry] = trunkPose.root!.pos!;
  const hip: PlanePoint = [rx - 0.02 * Math.sin(rad(s.lean)), ry - 0.02 * Math.cos(rad(s.lean))];
  const to: PlanePoint = [0.12 - hip[0], 1.92 - hip[1]];
  const reachLeg = 0.8254 / Math.hypot(...to);
  const ankle: PlanePoint = [hip[0] + to[0] * reachLeg, hip[1] + to[1] * reachLeg];
  const long = (pose: AnimationPose): AnimationPose => {
    const out: Record<string, Record<string, number>> = {};
    for (const [k, v] of Object.entries(pose) as [string, Record<string, number>][]) {
      out[k] = { ...v };
      if (k.startsWith('hip') && v.elev! < 0) out[k]!.elev = rnd3(v.elev! + 360);
      if (k.startsWith('ankle') && v.flex! > 90) out[k]!.flex = rnd3(v.flex! - 360);
    }
    return out as AnimationPose;
  };
  return pose(
    trunkPose,
    long(leg('l', hip, ankle, s.lean, { foot: s.foot })),
    long(leg('r', hip, ankle, s.lean, { foot: s.foot })),
    { straight: ['arm.l', 'arm.r'] },
  );
};
/** A passive hang: the shoulders up by the ears, the arms and legs straight and still. */
const T2B_DEAD: AnimationPose = pose(
  hung([-0.03, 1.415], 0, { clav: { elev: 10 } }),
  legAbs('l', 6, 4, -10, 0),
  legAbs('r', 6, 4, -10, 0),
  { straight: ['arm.l', 'arm.r', 'leg.l', 'leg.r'] },
);

/** Dips and supports: from the side and a touch in front, so both bars and the elbows show. */
const DIP_CAMERA = { yaw: 18, pitch: 8 };
const BARS_Y = 1.0;
const BARS_SHOULDER: PlanePoint = [0, 1.5775];
const CHAIR_SHOULDER: PlanePoint = [0, 1.0275];
const DIP_BARS = dipBars([0.02, BARS_Y, 0]);
/** Two chairs side by side facing ahead, a hand on each seat, their backs against a wall behind. */
const DIP_CHAIRS: AnimationProp[] = [
  support('chair', [0.02, 0.45, -0.36], 0, undefined, 'chair.l'),
  support('chair', [0.02, 0.45, 0.36], 0, undefined, 'chair.r'),
  wall([-0.27, 0, 0], [1, 0, 0]),
];
/** L-sit leaning a little forward so the hips sit behind the hands: shoulders pushed down, the straight legs `thigh` degrees from hanging. */
const lSitLeaning = (shoulder: PlanePoint, thigh: number): AnimationPose =>
  pose(
    hangFrom(shoulder, 10),
    { clav: { elev: -10 } },
    legAbs('l', thigh, 4, -10, 10),
    legAbs('r', thigh, 4, -10, 10),
    { straight: ['arm.l', 'arm.r', 'leg.l', 'leg.r'] },
  );

/* ------------------------------------------------------------------ */
/* Sliding and suspended planks                                        */
/* ------------------------------------------------------------------ */

/** The forearm plank, the whole body slid `dx` along the floor on its towel. */
const sawPose = (dx: number): AnimationPose =>
  pose(plank(83.2), { root: { pos: [rnd3(0.9 + dx), 0.27, 0] } });

/** Fallout: straps overhead, hands in the handles; the toes are the pivot. */
const FALLOUT_ANCHOR: [number, number, number] = [0.45, 2.4, 0];

/**
 * Leaning into the straps on the toes (`lean` from upright), the upper arm at `u` and the forearm
 * at `f` degrees from hanging.
 */
const fallout = (lean: number, u: number, f: number): AnimationPose =>
  pose(plank(lean, { neck: { flex: -6 } }), arms(u, f, lean));

/** Where the straps for feet in cradles hang from. */
const CRADLE_ANCHOR: [number, number, number] = [-0.05, 2.4, 0];
/** Hands flat on the floor, arms straight, the shoulders over them. */
const CRADLE_HAND_X = 1.2;
const cradleHands = (): AnimationPin[] =>
  (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    at: [CRADLE_HAND_X, 0, (S === 'l' ? -0.4 : 0.4) / 2],
    pole: { frame: 'chest', dir: [-0.55, -0.62, 0.56] },
  }));
/** Shoulders over the hands, the arms locked straight down. */
const CRADLE_SHOULDER: PlanePoint = [1.185, 0.5515];

/** The plank in the cradles: feet at `ankle`, legs reaching the hip, the shoulders over the hands. */
function cradlePose(
  hip: PlanePoint,
  ankle: PlanePoint,
  legs: { foot: number },
  extra: AnimationPose = {},
): AnimationPose {
  const lean = deg(Math.atan2(CRADLE_SHOULDER[0] - hip[0], CRADLE_SHOULDER[1] - hip[1]));
  return pose(
    body(
      hip,
      rnd(lean),
      { l: { ankle, foot: legs.foot }, r: { ankle, foot: legs.foot } },
      {
        neck: { flex: -8 },
        ...arms(0, 0, lean),
        straight: ['arm.l', 'arm.r'],
      },
    ),
    extra,
  );
}
const TUCK_OUT = {
  ankle: [-0.06, 0.33] as PlanePoint,
  hip: [0, 0] as PlanePoint,
  legs: { foot: -30 },
};
TUCK_OUT.hip = hipBetween(CRADLE_SHOULDER, TUCK_OUT.ankle, 0.435, 0.828);
const TUCK_IN = {
  ankle: [0.5, 0.43] as PlanePoint,
  hip: [0, 0] as PlanePoint,
  legs: { foot: -40 },
};
TUCK_IN.hip = [
  CRADLE_SHOULDER[0] - 0.435 * Math.sin(rad(98)),
  CRADLE_SHOULDER[1] - 0.435 * Math.cos(rad(98)),
];

/** Pike: the hips over the shoulders' line, the legs straight down to the cradles. */
function pikePose(): AnimationPose {
  const ankle: PlanePoint = [0.22, 0.37];
  return cradlePose(
    hipBetween(CRADLE_SHOULDER, ankle, 0.435, 0.828),
    ankle,
    { foot: -40 },
    {
      straight: ['arm.l', 'arm.r', 'leg.l', 'leg.r'],
    },
  );
}

/* ------------------------------------------------------------------ */
/* Ab wheel                                                            */
/* ------------------------------------------------------------------ */

/** An exercise mat under the knees. */
const MAT: AnimationProp = {
  kind: 'box',
  id: 'mat',
  group: 'towel',
  equipment: 'mat',
  min: [-0.5, 0, -0.32],
  max: [0.5, 0.014, 0.32],
};
/** Height of the hands on the wheel, and the spot on that line a straight arm just reaches. */
const WHEEL_Y = 0.14;
const reachAt = (shoulder: PlanePoint, y: number): PlanePoint => [
  shoulder[0] + Math.sqrt(Math.max(0, 0.524 ** 2 - (shoulder[1] - y) ** 2)),
  y,
];
/** The wheel's radius, and the fists on it: where a straight arm from `shoulder` puts them. */
const WHEEL_R = 0.1;
const WHEEL: AnimationProp = { kind: 'ab-wheel', id: 'wheel', group: 'handle', r: WHEEL_R };
/**
 * Kneeling: the thighs `tilt` degrees from vertical (leaning forward), the trunk `lean` from
 * upright with the back a little rounded, both arms straight toward the wheel at `wheel`.
 */
function kneelingRoll(tilt: number, lean: number): AnimationPose {
  const hip: PlanePoint = [
    rnd3(0.42 * Math.sin(rad(tilt))),
    rnd3(0.052 + 0.42 * Math.cos(rad(tilt))),
  ];
  const t = trunk(hip, lean, 6, 4);
  return body(
    hip,
    lean,
    {},
    pose(
      legAbs('l', -tilt, 90 - tilt, -170, lean),
      legAbs('r', -tilt, 90 - tilt, -170, lean),
      { spine: { flex: 6 }, chest: { flex: 4 }, neck: { flex: 4 } },
      armsToward(t.shoulder, reachAt(t.shoulder, WHEEL_Y), t.chestLean),
      { wrist: { flex: -80 } },
    ),
  );
}

/** Out through the middle (arms straight all the way), pause, back through it, rest. */
const ROLL_LOOP: LoopStep[] = [
  { to: 'mid', phase: 'eccentric' },
  { to: 'out', phase: 'eccentric' },
  { to: 'out', phase: 'pause' },
  { to: 'mid', phase: 'concentric' },
  { to: 'in', phase: 'concentric' },
  { to: 'in', phase: 'hold' },
];

/** Half way out on the toes: the shoulders low over the reach, the legs straight behind. */
function standingMid(): AnimationPose {
  const shoulder: PlanePoint = [0.78, 0.5];
  const ankle: PlanePoint = [0.06, 0.16];
  const hip = hipBetween(shoulder, ankle, 0.435, 0.828);
  const lean = deg(Math.atan2(shoulder[0] - hip[0], shoulder[1] - hip[1]));
  const foot = { ankle, foot: -30 };
  const t = trunk(hip, lean, 6, 4);
  return body(
    hip,
    lean,
    { l: foot, r: foot },
    pose(
      { spine: { flex: 6 }, chest: { flex: 4 }, neck: { flex: -10 } },
      armsToward(t.shoulder, reachAt(t.shoulder, WHEEL_Y), t.chestLean),
      { wrist: { flex: -80 } },
    ),
  );
}

/** Standing with straight legs, folded at the hips, holding the wheel on the floor ahead. */
function standingRoll(): AnimationPose {
  const hip: PlanePoint = [-0.08, 0.895];
  const lean = 128;
  const t = trunk(hip, lean, 6, 4);
  const foot = { ankle: [0, 0.075] as PlanePoint, foot: 0 };
  return body(
    hip,
    lean,
    { l: foot, r: foot },
    pose(
      { spine: { flex: 6 }, chest: { flex: 4 }, neck: { flex: -10 } },
      armsToward(t.shoulder, reachAt(t.shoulder, WHEEL_Y), t.chestLean),
      { wrist: { flex: -80 } },
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Standing, carrying and turning                                      */
/* ------------------------------------------------------------------ */

/** Standing tall, feet under the hips, the arms hanging a touch out from the body. */
const CARRY_STAND: AnimationPose = pose(STAND, {
  shoulder: { plane: 0, elev: 5, rot: 0 },
  elbow: { flex: 6 },
});

/**
 * Arms for a side bend: the right arm kept hanging straight down whatever the trunk's bend of
 * `bend` degrees, the left forearm folded to the hip.
 */
const SIDE_BEND_ARMS = (bend: number): AnimationPose => ({
  'shoulder.r': { plane: 0, elev: rnd(5 + bend), rot: 0 },
  'elbow.r': { flex: 6 },
  'shoulder.l': { plane: -15, elev: 30, rot: 80 },
  'elbow.l': { flex: 95 },
});

/** Hands held together at the chest, elbows down (a handle held at the sternum). */
const GOBLET_HANDS: AnimationPose = {
  shoulder: { plane: 70, elev: 30, rot: 25 },
  elbow: { flex: 125 },
  wrist: { flex: 10, dev: 20 },
};

/** Sitting on the floor leaning back, knees bent and feet on the floor, the chest turned `turn` x 45 degrees. */
function twistPose(turn: number): AnimationPose {
  const foot = { ankle: [0.5, 0.075] as PlanePoint, rot: -6 };
  return body(
    [0, 0.098],
    -38,
    { l: foot, r: foot },
    {
      spine: { twist: 4 * turn },
      chest: { twist: 44 * turn },
      neck: { flex: 20 },
    },
  );
}

/** Woodchop: a wide stance, the torso turning from the door (high) to the far hip (low). */
const CHOP_STAND: AnimationPose = pose(STAND, { hip: { plane: 82, elev: 6 } });
const CHOP_HIGH_BODY: AnimationPose = {
  root: { pos: [0, 0.905, 0], turn: 22 },
  spine: { twist: 3 },
  chest: { twist: 10 },
  knee: { flex: 6 },
};
const CHOP_LOW_BODY: AnimationPose = {
  root: { pos: [0, 0.9, 0], turn: -22 },
  spine: { twist: -3, flex: 3 },
  chest: { twist: -10 },
  knee: { flex: 20 },
};
const CHOP_HIGH_ARMS: AnimationPose = {
  'shoulder.l': { plane: 78.1, elev: 137.8, rot: 38.8 },
  'elbow.l': { flex: 25 },
  'shoulder.r': { plane: 132.3, elev: 124.4, rot: 47.7 },
  'elbow.r': { flex: 30 },
};
const CHOP_LOW_ARMS: AnimationPose = {
  'shoulder.l': { plane: 128.7, elev: 43, rot: -58.9 },
  'elbow.l': { flex: 8 },
  'shoulder.r': { plane: 77.4, elev: 38.2, rot: 74 },
  'elbow.r': { flex: 25 },
};

/** Windmill: feet wide, the hip pushed out toward the weight and the trunk bending away from it. */
const WINDMILL_STAND: AnimationPose = pose(STAND, {
  root: { pos: [0, 0.895, 0] },
  'hip.l': { plane: 0, elev: 13, rot: -45 },
  'hip.r': { plane: 0, elev: 13, rot: 45 },
  knee: { flex: 6 },
});
const WINDMILL_BODY: AnimationPose = {
  root: { pos: [-0.1, 0.88, 0.1], lean: 32, tilt: -24 },
  spine: { bend: -24, flex: 8, twist: 10 },
  chest: { bend: -28, twist: 24 },
  neck: { flex: -14 },
};
const WINDMILL_UP_ARMS: AnimationPose = {
  'shoulder.r': { plane: -132.2, elev: 179.6, rot: 95.5 },
  'elbow.r': { flex: 1.1 },
  'shoulder.l': { plane: 0, elev: 5, rot: 0 },
  'elbow.l': { flex: 8 },
};
const WINDMILL_DOWN_ARMS: AnimationPose = {
  'shoulder.r': { plane: -72.4, elev: 101.6, rot: -122.9 },
  'elbow.r': { flex: 1.1 },
  'shoulder.l': { plane: 55, elev: 42.4, rot: -76.2 },
  'elbow.l': { flex: 1.1 },
};

/* ------------------------------------------------------------------ */
/* Turkish get-up                                                      */
/* ------------------------------------------------------------------ */

/**
 * The right foot stays put all the way up. The free (left) arm and leg come and go: the hand is
 * planted behind and out from the hip from the elbow to the sweep, the heel on the floor until the
 * leg sweeps back, the knee down from the sweep to the half-kneel, then the foot joins.
 */
const RIGHT_FOOT = { ankle: [0.45, 0.075] as PlanePoint, rot: -6 };
/** Where the supporting hand plants: 30 cm behind the hip and out to the side. */
const SUPPORT_HAND: [number, number, number] = [-0.27, 0, -0.22];
const FREE_KNEE: [number, number, number] = [-0.1, 0, -0.09];

/** One stage of the get-up: the hips, the trunk's lean, the free foot, the free arm's [upper, forearm]. */
interface Stage {
  hip: PlanePoint;
  lean: number;
  foot: Foot;
  left: [number, number];
  wrist?: number;
}
const HEEL: Foot = { ankle: [0.83, 0.1] };
const BEHIND: Foot = { ankle: [-0.5, 0.16], foot: -30 };
/** Where the back toes stay planted from the half-kneel to the lunge. */
const TOE_SPOT: [number, number, number] = [-0.38, 0, -0.09];
/** The free hand resting on the floor at about 45° while lying. */
const LIE_HAND: [number, number, number] = [-0.2, 0, -0.55];
const STAGES: Record<
  | 'lie'
  | 'elbow'
  | 'post'
  | 'lift'
  | 'bridge'
  | 'sweepB'
  | 'sweepC'
  | 'tri'
  | 'kneel'
  | 'wiper'
  | 'lunge'
  | 'lunge2'
  | 'carry'
  | 'stand',
  Stage
> = {
  lie: { hip: [0, 0.118], lean: -90, foot: HEEL, left: [160, 160] },
  elbow: { hip: [0, 0.118], lean: -58, foot: HEEL, left: [70, 80] },
  post: { hip: [0, 0.09], lean: -14, foot: HEEL, left: [10, 14], wrist: -70 },
  // Hips on their way up, the shoulder staying within the arm's reach of the hand.
  lift: { hip: [0.1, 0.25], lean: -50, foot: HEEL, left: [10, 14], wrist: -70 },
  // Hips high: shoulder over the hand, a straight line from the hand to the planted heel and foot.
  bridge: {
    hip: [0.2, 0.47],
    lean: -80,
    foot: { ankle: [0.83, 0.17] },
    left: [10, 14],
    wrist: -70,
  },
  // The free foot drawn in along the floor, the knee bent up, the hand still down.
  sweepB: {
    hip: [0.15, 0.42],
    lean: -73,
    foot: { ankle: [0.3, 0.2], foot: -15 },
    left: [10, 14],
    wrist: -70,
  },
  // The knee swung under and back, a hand's breadth off the floor.
  sweepC: {
    hip: [0.12, 0.5],
    lean: -84,
    foot: { ankle: [-0.3, 0.5], foot: -30 },
    left: [10, 14],
    wrist: -70,
  },
  // The free leg swept back under: hand, knee and right foot down.
  tri: { hip: [0.12, 0.42], lean: -74, foot: BEHIND, left: [10, 14], wrist: -70 },
  // Tall half-kneel: the hand has left the floor, the trunk upright.
  kneel: { hip: [-0.1, 0.47], lean: 0, foot: BEHIND, left: [70, 80] },
  // Windshield wiper: the knee comes off the floor, the back toes stay down.
  wiper: { hip: [-0.07, 0.58], lean: 1, foot: BEHIND, left: [90, 90] },
  // Lunge: hips high over the feet, the back leg nearly straight on its toes, the trunk upright.
  lunge: { hip: [0.02, 0.76], lean: 0, foot: BEHIND, left: [60, 70] },
  // Weight over the front foot, the back foot swinging through.
  lunge2: { hip: [0.32, 0.8], lean: 0, foot: { ankle: [-0.14, 0.14], foot: -30 }, left: [40, 50] },
  carry: { hip: [0.42, 0.88], lean: 0, foot: { ankle: [0.1, 0.3], foot: -20 }, left: [30, 30] },
  stand: { hip: [0.42, 0.905], lean: 0, foot: { ankle: [0.45, 0.075], rot: -6 }, left: [5, 5] },
};

/** A stage as a pose: the right arm straight up with the kettlebell. */
function tguPose(st: Stage): AnimationPose {
  const [u, f] = st.left;
  return body(
    st.hip,
    st.lean,
    { l: st.foot, r: RIGHT_FOOT },
    pose(
      { neck: { flex: st.lean < -60 ? 10 : 2 } },
      { 'shoulder.r': { plane: 90, elev: rnd(180 + st.lean), rot: 0 }, 'elbow.r': { flex: 6 } },
      {
        'shoulder.l': { plane: 90, elev: rnd(u + st.lean), rot: 0 },
        'elbow.l': { flex: rnd(Math.max(f - u, 6)) },
        ...(st.wrist === undefined ? {} : { 'wrist.l': { flex: st.wrist } }),
      },
      { straight: ['arm.r'] },
    ),
  );
}

const TGU_POSES: Record<string, AnimationPose> = Object.fromEntries(
  Object.entries(STAGES).map(([name, st]) => [name, tguPose(st)]),
);
type TguStage = keyof typeof STAGES;
/** Up from the floor; a stage twice is a pause there (the contacts settle). */
const TGU_UP: TguStage[] = [
  'elbow',
  'post',
  'lift',
  'bridge',
  'sweepB',
  'sweepC',
  'tri',
  'tri',
  'kneel',
  'kneel',
  'wiper',
  'lunge',
  'lunge',
  'lunge2',
  'lunge2',
  'carry',
  'stand',
];
const TGU_DOWN: TguStage[] = [
  'carry',
  'lunge2',
  'lunge2',
  'lunge',
  'lunge',
  'wiper',
  'kneel',
  'kneel',
  'tri',
  'tri',
  'sweepC',
  'sweepB',
  'bridge',
  'lift',
  'post',
  'elbow',
  'lie',
];
const TGU_LOOP: LoopStep[] = [
  ...TGU_DOWN.map((to) => ({ to, phase: 'eccentric' as const })),
  { to: 'lie', phase: 'pause' },
  ...TGU_UP.map((to) => ({ to, phase: 'concentric' as const })),
  { to: 'stand', phase: 'hold' },
];
/** The loop steps that run from one of `names` to another of them (or stay in one). */
const stepsWithin = (names: TguStage[]): number[] => {
  const seq: TguStage[] = ['stand', ...TGU_LOOP.map((l) => l.to as TguStage)];
  const out: number[] = [];
  TGU_LOOP.forEach((_, k) => {
    if (names.includes(seq[k]!) && names.includes(seq[k + 1]!)) out.push(k);
  });
  return out;
};
const TGU_PINS: AnimationPin[] = [
  { contact: 'foot.r', mode: 'plant', at: [0.45, 0, 0.09] },
  // The hand holds the body up from the elbow to the sweep.
  ...during(stepsWithin(['elbow', 'post', 'lift', 'bridge', 'sweepB', 'sweepC', 'tri']), [
    {
      contact: 'hand.l',
      mode: 'plant',
      at: SUPPORT_HAND,
      pole: { frame: 'chest', dir: [-0.5, -0.5, -1] },
    },
  ]),
  // The heel stays on the floor until the leg sweeps back.
  ...during(stepsWithin(['lie', 'elbow', 'post', 'lift', 'bridge']), [
    { contact: 'foot.l', mode: 'plant', at: [0.78, 0, -0.09] },
  ]),
  // The knee is down from the sweep through the half-kneel.
  ...during(stepsWithin(['tri', 'kneel']), [{ contact: 'knee.l', mode: 'anchor', at: FREE_KNEE }]),
  // The back toes go down in the half-kneel and stay there until the foot steps through.
  ...during(stepsWithin(['kneel', 'wiper', 'lunge']), [
    { contact: 'foot.l', mode: 'plant', rest: 'toes', at: TOE_SPOT, lift: 0 },
  ]),
  // The back toes edge forward under the hips, then the foot steps through.
  ...during(stepsWithin(['lunge2']), [
    { contact: 'foot.l', mode: 'plant', rest: 'toes', at: [-0.04, 0, -0.09], lift: 0 },
  ]),
  // Lying, the free hand rests on the floor out to the side.
  ...during(stepsWithin(['lie']), [
    {
      contact: 'hand.l',
      mode: 'plant',
      at: LIE_HAND,
      pole: { frame: 'chest', dir: [1, 0, -0.5] },
    },
  ]),
  // Standing again, the foot joins.
  ...during(stepsWithin(['stand']), [{ contact: 'foot.l', mode: 'plant', at: [0.45, 0, -0.09] }]),
];

/* Shoulder tap: a push-up position on wide feet, the hands tapping the opposite shoulder in turn. */
const TAP_BODY: AnimationPose = plank(72.8, {
  hip: { plane: 0, elev: 6 },
  shoulder: { plane: 80.8, elev: 64.7, rot: 31.1 },
  elbow: { flex: 8.5 },
  straight: ['arm.l'],
});
const tapSpot = (S: 'l' | 'r'): [number, number, number] => [1.187, 0, S === 'l' ? -0.215 : 0.215];
/** In the chest's axes: in front of the opposite shoulder, a hand's width below the chest. */
const tapAt = (S: 'l' | 'r'): [number, number, number] => [0.17, 0.24, S === 'l' ? 0.12 : -0.12];
const tapGrip = (S: 'l' | 'r', steps: number[]): AnimationPin => ({
  contact: `hand.${S}`,
  mode: 'grip',
  frame: 'chest',
  at: tapAt(S),
  pole: { frame: 'chest', dir: [0.5, -0.2, S === 'l' ? -0.5 : 0.5] },
  steps,
});
const TAP_HANDS: AnimationPin[] = [
  // Each hand taps in its own pause (steps 1 and 5) while the other holds the body up.
  ...during([3, 4, 5, 6, 7], [{ contact: 'hand.r', mode: 'plant', at: tapSpot('r') }]),
  tapGrip('r', [1]),
  ...during([7, 0, 1, 2, 3], [{ contact: 'hand.l', mode: 'plant', at: tapSpot('l') }]),
  tapGrip('l', [5]),
];

export const coreAnimations = {
  /* Planks: one rigid line on the forearms; the knees, then the toes, then the hands move. */

  'knee-plank': {
    camera: PLANK_CAMERA,
    poses: {
      settle: plank(71.6, { knee: { flex: 22 }, ankle: { flex: -80 } }),
      brace: plank(72.2, { knee: { flex: 22 }, ankle: { flex: -80 } }),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: [{ contact: 'knees', mode: 'anchor', at: [0, 0, 0] }, ...forearms(1.06)],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  plank: {
    camera: PLANK_CAMERA,
    poses: {
      settle: plank(83.2),
      brace: plank(83.5),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: [onToes(), ...forearms(1.54)],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  /* On the back: the lower back stays on the floor. */

  'lying-leg-raise': {
    camera: FLOOR_CAMERA,
    poses: {
      down: pose(LYING, legsUp(10), armsOver(180, 0, 22), { straight: ['leg.l', 'leg.r'] }),
      up: pose(LYING, legsUp(90), armsOver(180, 0, 22), { straight: ['leg.l', 'leg.r'] }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [],
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'dead-bug': {
    camera: { yaw: -20, pitch: 22 },
    poses: {
      // Arms to the ceiling, hips and knees at 90 degrees.
      start: pose(LYING, armsOver(90), legsUp(90, 90), { straight: ['arm.l', 'arm.r'] }),
      // The right arm goes overhead and the left leg out, both low and long; the back stays flat.
      lowered: pose(LYING, armsOver(90), legsUp(90, 90), {
        'shoulder.r': { plane: 90, elev: 168, rot: 0 },
        'hip.l': { plane: 90, elev: 14 },
        'knee.l': { flex: 6 },
        straight: ['arm.l', 'arm.r', 'leg.l'],
      }),
    },
    start: 'start',
    still: 'lowered',
    loop: rep('lowered', 'start'),
    pins: [],
    props: [],
    working: ['arm.r', 'leg.l'],
    perSide: true,
  },

  'hollow-body-hold': {
    camera: FLOOR_CAMERA,
    poses: {
      settle: hollow(18),
      brace: hollow(26),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: [],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  crunch: {
    camera: { yaw: -6, pitch: 14 },
    poses: {
      down: pose(supine(), TEMPLES_ARMS, FLOATING),
      up: pose(supine(), TEMPLES_ARMS, FLOATING, {
        spine: { flex: 8 },
        chest: { flex: 24 },
        neck: { flex: 4 },
      }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [...feet(), ...TEMPLES],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'reverse-crunch': {
    camera: FLOOR_CAMERA,
    poses: {
      start: pose(LYING, armsOver(180), legsUp(90, 90)),
      curled: reverseCurl(24),
    },
    start: 'curled',
    still: 'curled',
    loop: rep('start', 'curled'),
    pins: [],
    props: [],
    working: ['leg.l', 'leg.r', 'torso'],
    perSide: false,
  },

  'bicycle-crunch': {
    camera: { yaw: -36, pitch: 24 },
    poses: {
      a: bicycle(1),
      b: bicycle(-1),
    },
    start: 'b',
    still: 'a',
    loop: rep('a', 'b'),
    pins: TEMPLES,
    props: [],
    working: ['torso'],
    perSide: false,
  },

  'v-up': {
    camera: FLOOR_CAMERA,
    poses: {
      down: pose(LYING, legsUp(8), armsOver(8), { straight: ['leg.l', 'leg.r'] }),
      up: vSit(62, 58),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [],
    props: [],
    working: ['torso', 'leg.l', 'leg.r'],
    perSide: false,
  },

  /* Face down. */

  'prone-back-extension': {
    camera: { yaw: 8, pitch: 16 },
    poses: {
      down: pose(PRONE, ARMS_BY_SIDES, { neck: { flex: -2 } }),
      up: pose(PRONE, ARMS_BY_SIDES, {
        shoulder: { plane: 90, elev: -22, rot: 0 },
        spine: { flex: -6 },
        chest: { flex: -16 },
        neck: { flex: 14 },
      }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  superman: {
    camera: { yaw: 8, pitch: 16 },
    poses: {
      down: pose(PRONE, REACH_FORWARD(176), { neck: { flex: -4 } }),
      up: pose(PRONE, REACH_FORWARD(187), {
        spine: { flex: -3 },
        chest: { flex: -7 },
        neck: { flex: 6 },
        hip: { plane: 90, elev: -10 },
        straight: ['leg.l', 'leg.r'],
      }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [],
    props: [],
    working: ['torso', 'leg.l', 'leg.r'],
    perSide: false,
  },

  'bird-dog': {
    camera: { yaw: 14, pitch: 12 },
    poses: {
      home: quad({}),
      reach: quad(
        pose(
          legAbs('l', -90, 6, -40, QUAD_LEAN),
          {
            'shoulder.r': { plane: 90, elev: 90 + QUAD_LEAN, rot: 0 },
            'elbow.r': { flex: 6 },
            'wrist.r': { flex: 0 },
          },
          { straight: ['leg.l'] },
        ),
      ),
    },
    start: 'reach',
    still: 'reach',
    loop: rep('home', 'reach'),
    pins: [],
    props: [],
    working: ['arm.r', 'leg.l'],
    perSide: true,
  },

  // The right hand leaves the floor, crosses to the left shoulder and goes back; then the left
  // hand does the same, the other hand always holding the body up. The hips stay still.
  'plank-shoulder-tap': {
    camera: { yaw: 30, pitch: 16 },
    poses: {
      top: TAP_BODY,
      tap: pose(TAP_BODY),
    },
    start: 'top',
    still: 'tap',
    loop: [
      { to: 'top', phase: 'eccentric' },
      { to: 'tap', phase: 'pause' },
      { to: 'top', phase: 'concentric' },
      { to: 'top', phase: 'hold' },
      { to: 'top', phase: 'eccentric' },
      { to: 'top', phase: 'pause' },
      { to: 'top', phase: 'concentric' },
      { to: 'top', phase: 'hold' },
    ],
    pins: [onToes(), ...TAP_HANDS],
    props: [],
    working: ['torso'],
    perSide: false,
  },

  /* Side planks: seen from the front, the body one diagonal from the forearm to the feet. */

  'side-plank': {
    camera: SIDE_PLANK_CAMERA,
    poses: {
      settle: sidePlank(SP_TILT, SP_Y, { 'ankle.r': { flex: 0 } }),
      brace: sidePlank(SP_TILT - 0.6, SP_Y + 0.004),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: [SIDE_FOREARM, SIDE_HAND_ON_HIP],
    props: [],
    working: ['torso'],
    perSide: true,
  },

  'knee-side-plank': {
    camera: SIDE_PLANK_CAMERA,
    poses: {
      settle: kneeSide(KSP_TILT, KSP_Y),
      brace: kneeSide(KSP_TILT - 0.6, KSP_Y + 0.004),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: [SIDE_FOREARM, SIDE_HAND_ON_HIP],
    props: [],
    working: ['torso'],
    perSide: true,
  },

  'side-plank-leg-raise': {
    camera: SIDE_PLANK_CAMERA,
    poses: {
      down: sidePlank(SP_TILT, SP_Y),
      up: sidePlank(SP_TILT, SP_Y, { 'hip.l': { plane: 0, elev: 38 } }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [SIDE_FOREARM, SIDE_HAND_ON_HIP],
    props: [],
    working: ['leg.l'],
    perSide: true,
  },

  'copenhagen-side-plank': {
    camera: SIDE_PLANK_CAMERA,
    poses: {
      settle: copenhagen(0),
      brace: copenhagen(1),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: [COP_FOREARM, SIDE_HAND_ON_HIP],
    props: [support('chair', [0, 0.45, -0.8], -90)],
    working: ['torso'],
    perSide: true,
  },

  /* Hanging from the doorway bar: the shoulders stay put, the legs and the pelvis curl. */

  'hanging-knee-raise': {
    camera: HANG_CAMERA,
    poses: {
      hang: hangingBody(0, 0, 0, legAbs('l', 4, 16, -10, 0), legAbs('r', 4, 16, -10, 0)),
      raise: hangingBody(
        -20,
        20,
        10,
        legAbs('l', 120, 125, -10, -20),
        legAbs('r', 120, 125, -10, -20),
      ),
    },
    start: 'raise',
    still: 'raise',
    loop: rep('hang', 'raise'),
    pins: onBar(0.52),
    props: doorwayBar(),
    working: ['leg.l', 'leg.r', 'torso'],
    perSide: false,
  },

  'hanging-leg-raise': {
    camera: HANG_CAMERA,
    poses: {
      hang: hangingBody(0, 0, 0, legAbs('l', 6, 4, -10, 0), legAbs('r', 6, 4, -10, 0), true),
      raise: hangingBody(
        -14,
        10,
        8,
        legAbs('l', 108, 4, -15, -14),
        legAbs('r', 108, 4, -15, -14),
        true,
      ),
    },
    start: 'raise',
    still: 'raise',
    loop: rep('hang', 'raise'),
    pins: onBar(0.52),
    props: doorwayBar(),
    working: ['leg.l', 'leg.r', 'torso'],
    perSide: false,
  },

  'toes-to-bar': {
    camera: HANG_CAMERA,
    poses: {
      dead: T2B_DEAD,
      set: t2bStage(0),
      up1: t2bStage(1),
      up2: t2bStage(2),
      up3: t2bStage(3),
      top: t2bStage(4),
    },
    start: 'top',
    still: 'top',
    loop: [
      { to: 'up3', phase: 'eccentric', share: 0.25 },
      { to: 'up2', phase: 'eccentric', share: 0.25 },
      { to: 'up1', phase: 'eccentric', share: 0.2 },
      { to: 'set', phase: 'eccentric', share: 0.15 },
      { to: 'dead', phase: 'eccentric', share: 0.15 },
      { to: 'dead', phase: 'pause' },
      { to: 'set', phase: 'concentric', share: 0.15 },
      { to: 'up1', phase: 'concentric', share: 0.2 },
      { to: 'up2', phase: 'concentric', share: 0.25 },
      { to: 'up3', phase: 'concentric', share: 0.2 },
      { to: 'top', phase: 'concentric', share: 0.2 },
      { to: 'top', phase: 'hold' },
    ],
    pins: onBar(0.52),
    props: doorwayBar(),
    working: ['leg.l', 'leg.r', 'torso'],
    perSide: false,
  },

  /* Held up between parallel bars (or two chairs): the arms stay locked. */

  'dip-bar-knee-raise': {
    camera: DIP_CAMERA,
    poses: {
      hang: pose(
        hangFrom(BARS_SHOULDER, 4),
        { clav: { elev: -10 } },
        legAbs('l', 4, 20, -15, 4),
        legAbs('r', 4, 20, -15, 4),
        ARMS_STRAIGHT,
      ),
      raise: pose(
        hangFrom(BARS_SHOULDER, -6, 8, 6),
        { clav: { elev: -10 } },
        legAbs('l', 118, 122, -10, -6),
        legAbs('r', 118, 122, -10, -6),
        ARMS_STRAIGHT,
      ),
    },
    start: 'raise',
    still: 'raise',
    loop: rep('hang', 'raise'),
    pins: dipHands(BARS_Y),
    props: [DIP_BARS],
    working: ['leg.l', 'leg.r', 'torso'],
    perSide: false,
  },

  // Legs straight out level in front, the arms locked: on bars, or on two chairs braced
  // against a wall, where everything sits half a metre lower.
  'l-sit': {
    camera: DIP_CAMERA,
    poses: {
      settle: lSitLeaning(BARS_SHOULDER, 86),
      brace: lSitLeaning(BARS_SHOULDER, 92),
    },
    start: 'brace',
    still: 'brace',
    loop: hold('settle', 'brace'),
    pins: dipHands(BARS_Y),
    props: [DIP_BARS],
    working: ['leg.l', 'leg.r', 'torso'],
    perSide: false,
    variants: {
      chair: {
        poses: {
          settle: lSitLeaning(CHAIR_SHOULDER, 86),
          brace: lSitLeaning(CHAIR_SHOULDER, 92),
        },
        pins: dipHands(0.45),
        props: DIP_CHAIRS,
      },
    },
  },

  /* A forearm plank on a smooth floor: the towel under the toes lets the body slide. */

  'towel-body-saw': {
    camera: PLANK_CAMERA,
    poses: {
      in: sawPose(0),
      out: sawPose(-0.13),
    },
    start: 'out',
    still: 'out',
    loop: rep('in', 'out'),
    pins: forearms(1.54),
    props: [
      {
        kind: 'box',
        id: 'towel',
        group: 'towel',
        min: [-0.4, 0, -0.2],
        max: [0.2, 0.012, 0.2],
      },
    ],
    working: ['torso'],
    perSide: false,
  },

  /* Suspension trainer: the straps hang from a point overhead. */

  'suspension-fallout': {
    camera: { yaw: 16, pitch: 8 },
    poses: {
      in: fallout(60, 18, 100),
      out: fallout(80, 104, 118),
    },
    start: 'out',
    still: 'out',
    loop: rep('in', 'out'),
    pins: [onToes()],
    props: [{ kind: 'suspension', id: 'straps', anchor: FALLOUT_ANCHOR }],
    working: ['torso'],
    perSide: false,
  },

  'suspension-knee-tuck': {
    camera: { yaw: 22, pitch: 10 },
    poses: {
      out: cradlePose(TUCK_OUT.hip, TUCK_OUT.ankle, TUCK_OUT.legs),
      tucked: cradlePose(TUCK_IN.hip, TUCK_IN.ankle, TUCK_IN.legs),
    },
    start: 'tucked',
    still: 'tucked',
    loop: rep('out', 'tucked'),
    pins: cradleHands(),
    props: [{ kind: 'suspension', id: 'straps', anchor: CRADLE_ANCHOR, on: 'feet' }],
    working: ['torso', 'leg.l', 'leg.r'],
    perSide: false,
  },

  'suspension-pike': {
    camera: { yaw: 22, pitch: 10 },
    poses: {
      out: cradlePose(TUCK_OUT.hip, TUCK_OUT.ankle, TUCK_OUT.legs),
      pike: pikePose(),
    },
    start: 'pike',
    still: 'pike',
    loop: rep('out', 'pike'),
    pins: cradleHands(),
    props: [{ kind: 'suspension', id: 'straps', anchor: CRADLE_ANCHOR, on: 'feet' }],
    working: ['torso', 'leg.l', 'leg.r'],
    perSide: false,
  },

  /* Ab wheel: the hands travel along the floor on the wheel while the body lengthens. */

  'ab-wheel-kneeling-rollout': {
    camera: { yaw: 12, pitch: 10 },
    poses: {
      in: kneelingRoll(0, 70),
      mid: kneelingRoll(38, 76),
      out: kneelingRoll(74, 80),
    },
    start: 'in',
    still: 'out',
    loop: ROLL_LOOP,
    pins: [{ contact: 'knees', mode: 'anchor', at: [0, 0, 0] }],
    props: [MAT, WHEEL],
    working: ['torso'],
    perSide: false,
  },

  'ab-wheel-standing-rollout': {
    camera: { yaw: 12, pitch: 10 },
    poses: {
      in: standingRoll(),
      mid: standingMid(),
      out: pose(plank(87, { neck: { flex: -6 } }), arms(79, 79, 87), { wrist: { flex: -80 } }),
    },
    start: 'in',
    still: 'out',
    loop: ROLL_LOOP,
    pins: [onToes()],
    props: [WHEEL],
    working: ['torso'],
    perSide: false,
  },

  /* Standing and carrying. */

  'dumbbell-farmer-carry': {
    camera: { yaw: 50, pitch: 8 },
    poses: {
      settle: pose(CARRY_STAND, { clav: { elev: 2 } }),
      tall: pose(CARRY_STAND, { clav: { elev: -5 }, root: { pos: [0, 0.922, 0] } }),
    },
    start: 'tall',
    still: 'tall',
    loop: hold('settle', 'tall'),
    pins: feet(),
    props: weights({ bell: 'out' }),
    working: ['torso'],
    perSide: false,
  },

  'dumbbell-suitcase-carry': {
    camera: { yaw: 82, pitch: 8 },
    poses: {
      settle: pose(CARRY_STAND, { 'shoulder.r': { plane: 0, elev: 6, rot: 0 } }),
      tall: pose(CARRY_STAND, {
        clav: { elev: -4 },
        'shoulder.r': { plane: 0, elev: 6, rot: 0 },
        root: { pos: [0, 0.922, 0] },
      }),
    },
    start: 'tall',
    still: 'tall',
    // A slow step in place, left foot then right, the trunk staying upright over the weight.
    loop: [
      { to: 'tall', phase: 'eccentric', swing: 'foot.l' },
      { to: 'tall', phase: 'pause' },
      { to: 'tall', phase: 'concentric', swing: 'foot.r' },
      { to: 'tall', phase: 'hold' },
    ],
    pins: feet().map((p) => ({ ...p, lift: 0.08 })),
    props: [weightIn('r', { bell: 'out' })],
    working: ['torso'],
    perSide: true,
  },

  'dumbbell-side-bend': {
    camera: { yaw: 82, pitch: 8 },
    poses: {
      up: pose(CARRY_STAND, SIDE_BEND_ARMS(0)),
      down: pose(CARRY_STAND, { spine: { bend: 18 }, chest: { bend: 14 } }, SIDE_BEND_ARMS(32)),
    },
    start: 'up',
    still: 'down',
    loop: rep('down', 'up'),
    pins: [...feet(), handOn('l', 'root', [0.01, 0.07, -0.165], [-0.15, 0.1, -1])],
    props: [weightIn('r', { bell: 'out' })],
    working: ['torso'],
    perSide: true,
  },

  'russian-twist': {
    camera: { yaw: 52, pitch: 24 },
    poses: {
      center: twistPose(0),
      twist: twistPose(1),
    },
    start: 'twist',
    still: 'twist',
    loop: rep('center', 'twist'),
    pins: [
      ...feet(),
      ...(['l', 'r'] as const).map((S) =>
        handOn(S, 'chest', [0.2, 0.1, S === 'l' ? -0.045 : 0.045], [0.3, -0.5, S === 'l' ? -1 : 1]),
      ),
    ],
    props: [],
    working: ['torso'],
    perSide: true,
  },

  'band-pallof-press': {
    camera: { yaw: 28, pitch: 8 },
    poses: {
      in: pose(STAND, { hip: { plane: 84, elev: 5 } }, GOBLET_HANDS),
      out: pose(STAND, { hip: { plane: 84, elev: 5 } }, armsTogether(90, 0), {
        straight: ['arm.l', 'arm.r'],
      }),
    },
    start: 'out',
    still: 'out',
    loop: rep('in', 'out'),
    pins: feet(),
    props: [doorFaceOn(0.45, -0.9, -1), ...bandTo([0.1, 1.2, -0.88], ['l'])],
    working: ['torso'],
    perSide: true,
  },

  'band-woodchop': {
    camera: { yaw: 66, pitch: 10 },
    poses: {
      high: pose(CHOP_STAND, CHOP_HIGH_BODY, CHOP_HIGH_ARMS),
      low: pose(CHOP_STAND, CHOP_LOW_BODY, CHOP_LOW_ARMS),
    },
    start: 'low',
    still: 'low',
    loop: rep('high', 'low'),
    pins: feet(),
    props: [doorFaceOn(0.45, -0.9, -1), ...bandTo([0.1, 1.95, -0.88], ['l'])],
    working: ['torso'],
    perSide: true,
  },

  'kettlebell-windmill': {
    camera: { yaw: 84, pitch: 10 },
    poses: {
      up: pose(WINDMILL_STAND, WINDMILL_UP_ARMS, { straight: ['arm.r'] }),
      down: pose(WINDMILL_STAND, WINDMILL_BODY, WINDMILL_DOWN_ARMS, { straight: ['arm.r'] }),
    },
    start: 'up',
    still: 'down',
    loop: rep('down', 'up'),
    pins: feet(),
    props: [weightIn('r', { kind: 'kettlebell', bell: 'back' })],
    working: ['torso'],
    perSide: true,
  },

  // From the floor to standing and back, the kettlebell locked out overhead: lying, up on the
  // elbow, up on the hand, the free leg swept back into a lunge, then standing.
  'kettlebell-turkish-get-up': {
    camera: { yaw: 24, pitch: 14 },
    poses: TGU_POSES,
    start: 'stand',
    still: 'bridge',
    loop: TGU_LOOP,
    pins: TGU_PINS,
    props: [weightIn('r', { kind: 'kettlebell', bell: 'back' })],
    working: ['torso'],
    perSide: true,
  },
} satisfies Record<string, ExerciseAnimation>;
