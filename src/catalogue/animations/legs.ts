import type {
  AnimationPin,
  AnimationPose,
  AnimationProp,
  ExerciseAnimation,
  LoopStep,
} from '@/domain';
import {
  ANKLE_HEIGHT,
  armsTogether,
  ball,
  body,
  bridgeAt,
  type Foot,
  legAbs,
  type PlanePoint,
  toesAt,
  bandTo,
  doorEdgeOn,
  feet,
  GRIP,
  handOn,
  hold,
  pose,
  rep,
  support,
  wall,
  weightIn,
  weights,
} from './shared';

/*
 * Legs family. Most moves here are planar (squats, lunges, hinges, bridges), so poses are placed
 * with a small solver: give the hip's and the ankle's spots in the vertical plane and it returns
 * the joint angles, with the feet landing where they should. Planted feet are still pinned, so
 * the solver only has to be close; feet that leave the floor (a jump, a free leg, a back foot on
 * its toes) are placed exactly by it at every key pose.
 */

type P = PlanePoint;
type Side = 'l' | 'r';

const rad = (d: number) => (d * Math.PI) / 180;
const rnd = (x: number) => Math.round(x * 10) / 10;
const rnd3 = (x: number) => Math.round(x * 1000) / 1000;

const THIGH = 0.42;
const SHIN = 0.41;
/** Ankle height with the foot flat on the floor. */
const ANKLE = ANKLE_HEIGHT;

/** Both feet flat on the floor under `x`, toes turned out a little. */
const flat = (x = 0, rot = -8): Partial<Record<Side, Foot>> => ({
  l: { ankle: [x, ANKLE], rot },
  r: { ankle: [x, ANKLE], rot },
});

/**
 * A raised head and a flat-ish back for a torso leaning `lean`: a slight arch in the spine and the
 * neck taking the head back toward level. Returns the pose and the chest's own lean.
 */
const upright = (lean: number, arch = 8, gaze = 8): AnimationPose => {
  const chest = lean - arch;
  const up = Math.max(0, chest - gaze);
  return {
    spine: { flex: rnd(-arch * 0.6) },
    chest: { flex: rnd(-arch * 0.4) },
    neck: { flex: rnd(-up * 0.7) },
    head: { flex: rnd(-up * 0.3) },
  };
};
const chestLean = (lean: number, arch = 8) => lean - arch;

/** Arms straight out in front at shoulder height whatever the trunk does. */
const armsForward = (lean: number, arch = 8): AnimationPose => ({
  shoulder: { plane: 90, elev: rnd(90 + chestLean(lean, arch)), rot: 0 },
  elbow: { flex: 6 },
});

/** Arms hanging straight down (or `out` degrees ahead of that) whatever the trunk does. */
const armsHang = (lean: number, arch = 0, out = 0): AnimationPose => ({
  shoulder: { plane: 90, elev: rnd(chestLean(lean, arch) + out), rot: 0 },
  elbow: { flex: 6 },
});

/** Squats and lunges: a little in front of the right side, looking slightly down. */
const SQUAT_CAMERA = { yaw: 24, pitch: 8 };

/** Weight held at the chest (goblet): elbows under it, hands pinned on its sides. */
const GOBLET_ARMS: AnimationPose = {
  shoulder: { plane: 70, elev: 30, rot: 25 },
  elbow: { flex: 125 },
  wrist: { flex: 10, dev: 20 },
};
const GOBLET_PINS: AnimationPin[] = [
  { contact: 'hand.l', mode: 'grip', frame: 'chest', at: [0.165, 0.15, -0.058] },
  { contact: 'hand.r', mode: 'grip', frame: 'chest', at: [0.165, 0.15, 0.058] },
];
const GOBLET: AnimationProp = {
  kind: 'dumbbell',
  id: 'db',
  group: 'db',
  frame: 'chest',
  at: [0.2, 0.12, 0],
  axis: [0, 1, 0],
  size: 'goblet',
};

/** Feet a little wider than the hips, toes out a little. */
const wide = (): Partial<Record<Side, Foot>> => ({
  l: { ankle: [0, ANKLE], rot: -12, plane: 84 },
  r: { ankle: [0, ANKLE], rot: -12, plane: 84 },
});

/** Arms for a jump: back as it loads, overhead as it leaves, forward as it lands. */
const JUMP_ARMS = {
  crouch: { shoulder: { plane: 90, elev: -14, rot: 0 }, elbow: { flex: 12 } },
  air: { shoulder: { plane: 90, elev: 160, rot: 0 }, elbow: { flex: 10 } },
  land: { shoulder: { plane: 90, elev: 25, rot: 0 }, elbow: { flex: 20 } },
} satisfies Record<string, AnimationPose>;

/** Weights racked on the shoulders, elbows forward. */
const RACK: AnimationPose = { elbow: { flex: 140 } };
const RACK_PINS: AnimationPin[] = (['l', 'r'] as const).map((S) =>
  handOn(S, 'chest', [0.13, 0.17, S === 'l' ? -0.17 : 0.17], [1, 0, 0.35]),
);

const WALL_ARMS: AnimationPose = { shoulder: { plane: 90, elev: 12, rot: 0 }, elbow: { flex: 30 } };

/** Standing on the right foot, the left leg out ahead (`reach` from the hip), toes up. */
/** Hip turn at the bottom of a one-leg squat: the knee follows the toes. */
const PISTOL_ROT = -2;
const ONE_LEG = (reach: P, rot = -6): Partial<Record<Side, Foot>> => ({
  r: { ankle: [0, ANKLE], rot },
  l: { ankle: reach, foot: 25, rel: true },
});

/** Hands on the straps ahead, arms about level whatever the trunk does. */
const STRAP_ARMS = (lean: number): AnimationPose => ({
  shoulder: { plane: 90, elev: rnd(80 + chestLean(lean)), rot: 0 },
  elbow: { flex: 6 },
});

/**
 * Standing with the knees soft, the pelvis `z` to the side, each leg opened `l` / `r` degrees
 * (negative: toward the other leg); legs and hips for a side step.
 */
const sideStep = (z: number, l: number, r: number): AnimationPose => ({
  root: { pos: [0, 0.875, z] },
  'hip.l': { plane: 0, elev: l, rot: -6 },
  'hip.r': { plane: 0, elev: r, rot: -6 },
  knee: { flex: 27 },
  ...HIPS_UP,
});

/** Feet shoulder-width apart at the top of a squat, toes out a little. */
const SHOULDER_WIDE: AnimationPose = {
  'hip.l': { plane: 0, elev: 6, rot: -8 },
  'hip.r': { plane: 0, elev: 6, rot: -8 },
};
/** At the bottom the thighs follow the toes, a little outward. */
const OUT_75: AnimationPose = { 'hip.l': { rot: 5 }, 'hip.r': { rot: 5 } };
/** The same on the way to a chair: the hips sit a little further back. */
const OUT_CHAIR: AnimationPose = { 'hip.l': { rot: 3 }, 'hip.r': { rot: 3 } };
/** Knees pressing out against the band. */
const MINI_OUT: AnimationPose = {
  'hip.l': { rot: -5 },
  'hip.r': { rot: -5 },
};

/** Hands on the hips. */
const HIPS: AnimationPin[] = [
  { contact: 'hand.l', mode: 'grip', frame: 'root', at: [0.01, 0.07, -0.165] },
  { contact: 'hand.r', mode: 'grip', frame: 'root', at: [0.01, 0.07, 0.165] },
];
/** Elbows out, upper arms a little forward, for hands on the hips. */
const HIPS_UP: AnimationPose = { shoulder: { plane: -15, elev: 30, rot: 80 }, elbow: { flex: 95 } };

/** Split stance: the near foot 0.42 ahead of the hips, the far foot on its toes behind. */
const SPLIT = (): Partial<Record<Side, Foot>> => ({
  r: { ankle: [0.42, ANKLE], rot: -6 },
  l: toesAt(-0.36),
});

/** The near foot ahead, the far foot hung in a strap handle behind (mid-calf height). */
const SUSPENDED: Partial<Record<Side, Foot>> = {
  r: { ankle: [0.4, ANKLE], rot: -6 },
  l: { ankle: [-0.5, 0.38], foot: -175, rot: 0 },
};

/** The near foot ahead, the far foot laid on a seat behind, laces down. */
const BULGARIAN: Partial<Record<Side, Foot>> = {
  r: { ankle: [0.4, ANKLE], rot: -6 },
  l: { ankle: [-0.5, 0.5], foot: -175, rot: 0 },
};

/** Hinges: from the side, a little in front. */
const HINGE_CAMERA = { yaw: 18, pitch: 8 };

/**
 * A hinged stance for `lean` degrees of trunk: the hips `x` behind the ankles (negative), the
 * knees bent `kneeFlex` degrees, both feet flat. Returns `[hip, lean, legs]` for `body`.
 */
function hingeAt(
  x: number,
  kneeFlex: number,
  lean: number,
): [P, number, Partial<Record<Side, Foot>>] {
  const d = Math.sqrt(THIGH ** 2 + SHIN ** 2 + 2 * THIGH * SHIN * Math.cos(rad(kneeFlex)));
  return [[x, rnd3(ANKLE + Math.sqrt(d * d - x * x))], lean, flat()];
}

/** A flat back with the head following it: a straight line from hips to crown, eyes down. */
const flatBack = (_lean: number): AnimationPose => ({
  spine: { flex: 0 },
  neck: { flex: -8 },
  head: { flex: -6 },
});

/** Hands behind the head, elbows wide. */
const HEAD_ARMS: AnimationPose = { elbow: { flex: 120 } };
const HEAD_PINS: AnimationPin[] = (['l', 'r'] as const).map((S) =>
  handOn(S, 'head', [-0.06, 0.09, S === 'l' ? -0.08 : 0.08], [-0.2, 0.1, 1]),
);

/**
 * One-leg stance: the near leg carries the body, the far leg reaches back in line with the trunk
 * (`lean` degrees), toes pointing down.
 */
const SL_RDL = (lean: number): Partial<Record<Side, Foot>> => {
  const back = lean < 10 ? 25 : lean;
  return {
    r: { ankle: [0, ANKLE], rot: -4 },
    l: {
      ankle: [rnd3(-0.828 * Math.sin(rad(back))), rnd3(-0.828 * Math.cos(rad(back)))],
      foot: -Math.min(70, back),
      rel: true,
    },
  };
};
function slHinge(lean: number): [P, number, Partial<Record<Side, Foot>>] {
  const [hip] = hingeAt(-0.2, 15, lean);
  return [hip, lean, SL_RDL(lean)];
}

/** Floor work on the back: from the side, a little toward the head, looking down. */
const FLOOR_CAMERA = { yaw: -14, pitch: 18 };

/** Upper body for lying on the back: arms along the floor, head resting (or `arms` given). */
function supineUpper(alpha: number, arms?: AnimationPose): AnimationPose {
  return pose(
    {
      neck: { flex: rnd(alpha * 0.8 + 6) },
      shoulder: { plane: 90, elev: rnd(-alpha), rot: 0 },
      elbow: { flex: 4 },
    },
    arms ?? {},
  );
}

/** Both feet flat near the glutes. */
const FEET_NEAR: Partial<Record<Side, Foot>> = {
  l: { ankle: [0.5, ANKLE] },
  r: { ankle: [0.5, ANKLE] },
};
/** The near foot flat, the far leg held straight up and a little forward. */
const ONE_FOOT_NEAR: Partial<Record<Side, Foot>> = {
  r: { ankle: [0.5, ANKLE] },
  l: { ankle: [0.634, 0.532], rel: true, foot: -20 },
};
/** Heels (toes up) near the glutes, and out with the legs nearly straight. */
const heel = (x: number): Foot => ({ ankle: [x, 0.102], foot: 22 });
const FEET_NEAR_HEELS = { l: heel(0.5), r: heel(0.5) };
const HEELS_OUT = { l: heel(0.8), r: heel(0.8) };
const HEELS_MID = { l: heel(0.65), r: heel(0.65) };
const ONE_HEEL_IN: Partial<Record<Side, Foot>> = {
  r: heel(0.5),
  l: { ankle: [0.634, 0.532], rel: true, foot: -20 },
};
const ONE_HEEL_MID: Partial<Record<Side, Foot>> = {
  r: heel(0.65),
  l: { ankle: [0.634, 0.532], rel: true, foot: -20 },
};
const ONE_HEEL_OUT: Partial<Record<Side, Foot>> = {
  r: heel(0.8),
  l: { ankle: [0.634, 0.532], rel: true, foot: -20 },
};
/** Heels hanging in strap handles about 0.34 high, `x` ahead of the hips, toes up. */
const HANGING_HEELS = (x: number, y = 0.34): Partial<Record<Side, Foot>> => ({
  l: { ankle: [x, y], foot: 20 },
  r: { ankle: [x, y], foot: 20 },
});
/** Heels on a seat 0.45 high, legs nearly straight. */
const onChair = (): Foot => ({ ankle: [0.79, 0.45 + 0.09], foot: 35 });
const HEELS_ON_CHAIR: Partial<Record<Side, Foot>> = { l: onChair(), r: onChair() };
const ONE_HEEL_ON_CHAIR: Partial<Record<Side, Foot>> = {
  r: onChair(),
  l: { ankle: [0.634, 0.532], rel: true, foot: -20 },
};
/** A towel or slider on the floor under the heels. */
const SLIDER: AnimationProp = {
  kind: 'box',
  id: 'slider',
  group: 'towel',
  min: [0.3, 0, -0.17],
  max: [1.0, 0.012, 0.17],
};

/** Chin tucked while the upper back rests on a bench. */
const BENCH_UPPER: AnimationPose = { elbow: { flex: 20 }, neck: { flex: 28 } };
/** A bench set across the body, its edge under the shoulder blades (long side along z). */
const BENCH_ACROSS: AnimationProp[] = [
  {
    kind: 'box',
    id: 'bench/pad',
    group: 'door',
    equipment: 'bench',
    min: [-0.7, 0.38, -0.6],
    max: [-0.4, 0.45, 0.6],
  },
  ...([-0.5, 0.5] as const).map((z, i): AnimationProp => ({
    kind: 'box',
    id: `bench/leg${i}`,
    group: 'door',
    equipment: 'bench',
    min: [-0.62, 0, z - 0.03],
    max: [-0.48, 0.38, z + 0.03],
  })),
];

/** A weight on the hip crease, hands holding it. */
const THRUST_WEIGHT: AnimationProp = {
  kind: 'dumbbell',
  id: 'db',
  group: 'db',
  frame: 'root',
  at: [0.14, 0, 0],
  axis: [0, 0, 1],
};
const THRUST_ARMS: AnimationPose = { elbow: { flex: 20 } };
const THRUST_PINS: AnimationPin[] = (['l', 'r'] as const).map((S) =>
  handOn(S, 'root', [0.14, 0, S === 'l' ? -0.1 : 0.1]),
);

/**
 * Upper back on the edge of a bench (shoulders at x = -0.42, resting 0.53 high), the trunk sloping
 * `alpha` degrees down to the hips. Returns `[hip, lean, legs]`.
 */
function benchAt(alpha: number): [P, number, Partial<Record<Side, Foot>>] {
  const a = rad(alpha);
  return [
    [rnd3(-0.42 + 0.42 * Math.cos(a)), rnd3(0.53 + 0.42 * Math.sin(a))],
    -(90 + alpha),
    FEET_NEAR,
  ];
}

/** Both feet on the balls, the legs straight and the hips above the ankles. */
function calfAt(psi: number, _n: number): [P, number, Partial<Record<Side, Foot>>] {
  const f = ball(psi);
  return [[f.ankle[0], rnd3(f.ankle[1] + 0.8295)], 0, { l: f, r: f }];
}
/** Standing on the near foot on a step 0.1 high, the other foot tucked behind. */
function oneCalf(psi: number): [P, number, Partial<Record<Side, Foot>>] {
  const f = ball(psi, 0.1);
  return [
    [f.ankle[0], rnd3(f.ankle[1] + 0.8295)],
    0,
    { r: f, l: { ankle: [-0.48, -0.34], foot: -60, rel: true } },
  ];
}
/** Seated feet: flat (`psi` 0) or with the heels raised on the toes. */
const seatedFeet = (psi: number): Partial<Record<Side, Foot>> => ({ l: ball(psi), r: ball(psi) });
const SEATED_ARMS: AnimationPose = {
  shoulder: { plane: 90, elev: 25, rot: 0 },
  elbow: { flex: 50 },
};

const QUAD_LEAN = 69;
/** All fours: knees under the hips, shins on the floor behind, arms straight down. */
function quad(working: AnimationPose): AnimationPose {
  return body(
    [0, 0.472],
    QUAD_LEAN,
    {},
    pose(
      legAbs('l', 0, 90, -170),
      legAbs('r', 0, 90, -170),
      armsHang(QUAD_LEAN),
      { neck: { flex: 8 } },
      working,
    ),
  );
}

/** Face down, the head ahead, the legs straight behind; the near knee bent `flex`. */
function prone(flex: number): AnimationPose {
  return pose(
    {
      root: { pos: [0, 0.135, 0], lean: 90 },
      neck: { flex: 4 },
      shoulder: { plane: 90, elev: 168, rot: 0 },
      elbow: { flex: 14 },
      hip: { plane: 90, elev: 0 },
      knee: { flex: 0 },
      ankle: { flex: -80 },
    },
    { 'knee.r': { flex } },
  );
}

/** Kneeling and tipping forward from the knees, the body straight, shins on the floor behind. */
function nordic(lean: number, arms: AnimationPose): AnimationPose {
  return pose(
    {
      root: { pos: [0, 0.5, 0], lean },
      neck: { flex: rnd(-lean * 0.3) },
      hip: { plane: 90, elev: 0, rot: 0 },
      knee: { flex: rnd(90 - lean) },
      ankle: { flex: -80 },
    },
    arms,
  );
}
const NORDIC_ARMS_UP: AnimationPose = {
  shoulder: { plane: 70, elev: 30, rot: 25 },
  elbow: { flex: 125 },
};
const NORDIC_ARMS_MID: AnimationPose = {
  shoulder: { plane: 90, elev: 100, rot: 0 },
  elbow: { flex: 60 },
};
const NORDIC_ARMS_DOWN: AnimationPose = {
  shoulder: { plane: 90, elev: 112, rot: 0 },
  elbow: { flex: 40 },
};
const NORDIC_ARMS_FAR: AnimationPose = {
  shoulder: { plane: 90, elev: 160, rot: 0 },
  elbow: { flex: 20 },
};
/** A sofa edge over the ankles. */
const SOFA: AnimationProp = {
  kind: 'box',
  id: 'sofa',
  group: 'door',
  min: [-1.0, 0.1, -0.4],
  max: [-0.34, 0.32, 0.4],
};

/** Lying on the right side, head toward the camera's left, the top (left) leg lifted. */
function side(top: AnimationPose): AnimationPose {
  return pose(
    {
      root: { pos: [0, 0.23, 0], lean: 0, tilt: 90 },
      hip: { plane: 0, elev: 0 },
      knee: { flex: 0 },
      'shoulder.r': { plane: 90, elev: 168, rot: 0 },
      'elbow.r': { flex: 12 },
      'shoulder.l': { plane: 90, elev: 20, rot: 0 },
      'elbow.l': { flex: 90 },
    },
    top,
  );
}
/** Knees bent, feet together; the top knee turning up as the hip turns out. */
const CLAM_LEGS = (rot: number): AnimationPose => ({
  hip: { plane: 90, elev: 45 },
  'hip.l': { plane: 90, elev: 45, rot },
  knee: { flex: 95 },
});

/** A point `u` (0 to 1) of the way from standing to the bottom of a squat, feet flat. */
const squatStep = (u: number, lift = 0.03): AnimationPose =>
  body(
    [rnd3(-0.27 * u), rnd3(0.904 - 0.454 * u)],
    rnd(35 * u),
    { l: { ankle: [0, ANKLE + lift] }, r: { ankle: [0, ANKLE + lift] } },
    pose(upright(35 * u), JUMP_ARMS.land),
  );

/** Steps down from standing to the bottom of a squat (fractions of the way), feet flat. */
const SQUAT_STEPS = [0.03, 0.06, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const SQUAT_KEYS = Object.fromEntries(SQUAT_STEPS.map((u) => [`d${u}`, squatStep(u, 0)]));

/** The standing top: hips over the ankles, knees soft. */
const TOP: P = [0, 0.904];
/** The top with the feet shoulder-width apart: a little lower, the legs slanting out. */
const TOP_WIDE: P = [0, 0.894];

const legsRaw = {
  /* Squat ladder: one camera, hips back and down, heels down, knees over the toes. */

  'bodyweight-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP_WIDE, 0, flat(), pose(armsForward(0, 0), SHOULDER_WIDE)),
      bottom: body([-0.27, 0.45], 35, flat(), pose(upright(35), armsForward(35), OUT_75)),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'goblet-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP_WIDE, 0, flat(), {
        ...SHOULDER_WIDE,
        shoulder: { plane: 70, elev: 30, rot: 25 },
        elbow: { flex: 125 },
        wrist: { flex: 10, dev: 20 },
      }),
      bottom: body([-0.27, 0.45], 35, flat(), {
        ...upright(35),
        ...OUT_75,
        shoulder: { plane: 70, elev: 30, rot: 25 },
        elbow: { flex: 125 },
        wrist: { flex: 10, dev: 20 },
      }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [
      ...feet(),
      { contact: 'hand.l', mode: 'grip', frame: 'chest', at: [0.165, 0.15, -0.058] },
      { contact: 'hand.r', mode: 'grip', frame: 'chest', at: [0.165, 0.15, 0.058] },
    ],
    props: [
      {
        kind: 'dumbbell',
        id: 'db',
        group: 'db',
        frame: 'chest',
        at: [0.2, 0.12, 0],
        axis: [0, 1, 0],
        size: 'goblet',
      },
    ],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'goblet-sumo-squat': {
    camera: { yaw: 68, pitch: 8 },
    poses: {
      top: pose(
        {
          root: { pos: [0, 0.895, 0] },
          hip: { plane: 0, elev: 16, rot: -35 },
          knee: { flex: 4 },
        },
        GOBLET_ARMS,
      ),
      bottom: pose(
        {
          root: { pos: [-0.3, 0.52, 0], lean: 22 },
          spine: { flex: -4 },
          hip: { plane: 0, elev: 62, rot: -72 },
          knee: { flex: 100 },
        },
        GOBLET_ARMS,
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), ...GOBLET_PINS],
    props: [GOBLET],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // Airborne: no foot is pinned, so the solver places each foot at every key pose.
  'jump-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP, 0, flat(0, 0), pose(JUMP_ARMS.land, { straight: ['leg.l', 'leg.r'] })),
      bottom: body([-0.27, 0.45], 35, flat(0, 0), pose(upright(35), JUMP_ARMS.crouch)),
      ...SQUAT_KEYS,
      touch: body(
        [0.0, 0.935],
        0,
        {
          l: { ankle: [0, 0.14], foot: -18, rot: 0 },
          r: { ankle: [0, 0.14], foot: -18, rot: 0 },
        },
        JUMP_ARMS.land,
      ),
      heel: body(
        [-0.05, 0.85],
        6,
        {
          l: { ankle: [0, 0.1], foot: -8, rot: 0 },
          r: { ankle: [0, 0.1], foot: -8, rot: 0 },
        },
        JUMP_ARMS.land,
      ),
      r1: squatStep(0.24, 0),
      r2: squatStep(0.17, 0),
      r3: squatStep(0.1, 0),
      r4: squatStep(0.04, 0),
      heel2: body(
        [-0.08, 0.8],
        9,
        { l: { ankle: [0, 0.084], foot: -3, rot: 0 }, r: { ankle: [0, 0.084], foot: -3, rot: 0 } },
        JUMP_ARMS.land,
      ),
      absorb: body([-0.1, 0.76], 12, flat(0, 0), pose(upright(12), JUMP_ARMS.crouch)),
      air: body(
        [0.02, 1.23],
        0,
        {
          l: { ankle: [0.0, 0.4], foot: -38, rot: 0 },
          r: { ankle: [0.0, 0.4], foot: -38, rot: 0 },
        },
        JUMP_ARMS.air,
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      ...SQUAT_STEPS.map((u): LoopStep => ({ to: `d${u}`, phase: 'eccentric' })),
      { to: 'bottom', phase: 'eccentric' },
      { to: 'bottom', phase: 'pause' },
      ...[...SQUAT_STEPS]
        .reverse()
        .filter((u) => u >= 0.3)
        .map((u): LoopStep => ({ to: `d${u}`, phase: 'concentric', share: 0.04 })),
      { to: 'air', phase: 'concentric', share: 0.45 },
      { to: 'touch', phase: 'concentric', share: 0.17 },
      { to: 'heel', phase: 'concentric', share: 0.08 },
      { to: 'heel2', phase: 'concentric', share: 0.06 },
      { to: 'absorb', phase: 'concentric', share: 0.17 },
      { to: 'r1', phase: 'concentric', share: 0.03 },
      { to: 'r2', phase: 'concentric', share: 0.03 },
      { to: 'r3', phase: 'concentric', share: 0.03 },
      { to: 'r4', phase: 'concentric', share: 0.03 },
      { to: 'top', phase: 'concentric', share: 0.04 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [],
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'chair-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP_WIDE, 0, flat(), pose(armsForward(0, 0), SHOULDER_WIDE)),
      bottom: body([-0.2, 0.53], 28, flat(), pose(upright(28), armsForward(28), OUT_CHAIR)),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [support('chair', [-0.28, 0.45, 0], 0)],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'dumbbell-front-squat': {
    camera: { yaw: 42, pitch: 8 },
    poses: {
      top: body(TOP_WIDE, 0, flat(), pose(RACK, SHOULDER_WIDE)),
      bottom: body([-0.25, 0.45], 26, flat(), pose(upright(26, 4, 4), RACK, OUT_75)),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), ...RACK_PINS],
    props: weights({ bell: 'back' }),
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // From the front, where the knees pressing out against the band show.
  'mini-band-squat': {
    camera: { yaw: 56, pitch: 8 },
    poses: {
      top: body(TOP_WIDE, 0, wide(), pose(armsForward(0, 0), SHOULDER_WIDE)),
      bottom: body([-0.26, 0.45], 32, wide(), pose(upright(32), armsForward(32), MINI_OUT)),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [
      {
        kind: 'mini-band',
        id: 'band',
        group: 'band',
        from: { frame: 'hip.l', at: [0.05, -0.3, 0] },
        to: { frame: 'hip.r', at: [0.05, -0.3, 0] },
      },
    ],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // Back flat on the wall, shins vertical, thighs level; it breathes a little.
  'wall-sit': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      settle: body([-0.42, 0.49], 0, flat(0, -6), WALL_ARMS),
      brace: body([-0.42, 0.51], 0, flat(0, -6), WALL_ARMS),
    },
    start: 'brace',
    still: 'settle',
    loop: hold('settle', 'brace'),
    pins: [
      ...feet(),
      handOn('l', 'hip.l', [0.1, -0.22, 0.02]),
      handOn('r', 'hip.r', [0.1, -0.22, 0.02]),
    ],
    props: [wall([-0.57, 0, 0], [1, 0, 0])],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // Standing on the near leg, the other held out in front; the solver places the free leg.
  'pistol-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP, 0, ONE_LEG([0.8, -0.21]), armsForward(0, 0)),
      bottom: body(
        [-0.28, 0.27],
        40,
        ONE_LEG([0.82, -0.07], PISTOL_ROT),
        pose(upright(40), armsForward(40)),
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'foot.r', mode: 'plant' }],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  'box-pistol-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP, 0, ONE_LEG([0.8, -0.21]), armsForward(0, 0)),
      bottom: body(
        [-0.24, 0.54],
        30,
        ONE_LEG([0.82, -0.1], PISTOL_ROT),
        pose(upright(30), armsForward(30)),
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'foot.r', mode: 'plant' }],
    props: [support('chair', [-0.28, 0.45, 0], 0)],
    working: ['leg.r'],
    perSide: true,
  },

  // Facing the anchor, hands on the straps taut ahead.
  'suspension-assisted-pistol-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body(TOP, 0, ONE_LEG([0.8, -0.21]), STRAP_ARMS(0)),
      bottom: body(
        [-0.28, 0.27],
        40,
        ONE_LEG([0.82, -0.07], PISTOL_ROT),
        pose(upright(40), STRAP_ARMS(40)),
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'foot.r', mode: 'plant' }],
    props: [{ kind: 'suspension', id: 'straps', anchor: [1.0, 2.4, 0] }],
    working: ['leg.r'],
    perSide: true,
  },

  /* Lunges and split squats: hands on the hips, the trunk upright, hips straight down. */

  // The near leg ahead, the back foot on its toes; the hips travel straight down.
  'split-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body([0.02, 0.8], 3, SPLIT(), HIPS_UP),
      mid: body([0.02, 0.64], 3, SPLIT(), HIPS_UP),
      bottom: body([0.02, 0.5], 3, SPLIT(), HIPS_UP),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'foot.r', mode: 'plant' }, ...HIPS],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // Standing, then the far foot steps back and the hips drop straight down behind the near foot.
  'reverse-lunge': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body([0, 0.904], 0, flat(0, 0), HIPS_UP),
      step: body(
        [-0.22, 0.78],
        3,
        { r: { ankle: [0, ANKLE], rot: -6 }, l: { ankle: [-0.5, 0.42], foot: -5 } },
        HIPS_UP,
      ),
      bottom: body(
        [-0.42, 0.5],
        3,
        { r: { ankle: [0, ANKLE], rot: -6 }, l: toesAt(-0.7) },
        HIPS_UP,
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      { to: 'step', phase: 'eccentric', share: 0.45 },
      { to: 'bottom', phase: 'eccentric', share: 0.55 },
      { to: 'bottom', phase: 'pause' },
      { to: 'step', phase: 'concentric', share: 0.55 },
      { to: 'top', phase: 'concentric', share: 0.45 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'foot.r', mode: 'plant' }, ...HIPS],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // The near foot steps ahead and the hips drop; the back foot stays on its toes.
  'walking-lunge': {
    camera: { yaw: 24, pitch: 8 },
    poses: {
      top: body([0, 0.904], 0, flat(0, 0), HIPS_UP),
      roll: body(
        [0.12, 0.86],
        2,
        { r: { ankle: [0, ANKLE], rot: -6 }, l: { ankle: [0.02, 0.17], foot: -12 } },
        HIPS_UP,
      ),
      land: body(
        [0.45, 0.78],
        3,
        { r: { ankle: [0.84, ANKLE], rot: -6 }, l: toesAt(0.145) },
        HIPS_UP,
      ),
      bottom: body(
        [0.42, 0.5],
        3,
        { r: { ankle: [0.84, ANKLE], rot: -6 }, l: toesAt(0.145) },
        HIPS_UP,
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      { to: 'roll', phase: 'eccentric', share: 0.25 },
      { to: 'land', phase: 'eccentric', share: 0.25, swing: 'foot.r' },
      { to: 'bottom', phase: 'eccentric', share: 0.55 },
      { to: 'bottom', phase: 'pause' },
      { to: 'land', phase: 'concentric', share: 0.5 },
      { to: 'roll', phase: 'concentric', share: 0.3, swing: 'foot.r' },
      { to: 'top', phase: 'concentric', share: 0.2 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'foot.r', mode: 'plant', lift: 0.12 }, ...HIPS],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // The near foot on the seat (at the top the other leg hangs; at the bottom it taps the floor).
  'dumbbell-step-up': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      top: body(
        [0.4, 1.355],
        0,
        {
          r: { ankle: [0.4, 0.45 + ANKLE], rot: -6 },
          l: { ankle: [0.12, -0.62], foot: -25, rel: true },
        },
        pose(armsHang(0), { straight: ['leg.r'] }),
      ),
      mid: body(
        [0.22, 1.1],
        12,
        {
          r: { ankle: [0.4, 0.45 + ANKLE], rot: -6 },
          l: { ankle: [-0.12, -0.75], foot: -10, rel: true },
        },
        armsHang(12),
      ),
      bottom: body(
        [0.0, 0.9],
        25,
        {
          r: { ankle: [0.4, 0.45 + ANKLE], rot: -6 },
          l: { ankle: [0.0, ANKLE], rot: -6 },
        },
        pose(upright(25), armsHang(25, 8)),
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'foot.r', mode: 'plant', at: [0.4, 0.45, 0.085] }],
    props: [support('chair', [0.4, 0.45, 0], 180), ...weights()],
    working: ['leg.r'],
    perSide: true,
  },

  // The back foot on the seat behind, laces down; the hips drop between the two.
  'bulgarian-split-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body([0.16, 0.86], 3, BULGARIAN, HIPS_UP),
      mid: body([0.06, 0.7], 3, BULGARIAN, HIPS_UP),
      bottom: body([0, 0.56], 3, BULGARIAN, HIPS_UP),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'foot.r', mode: 'plant' }, ...HIPS],
    props: [support('chair', [-0.52, 0.45, 0], 0)],
    working: ['leg.r'],
    perSide: true,
  },

  // The back foot in a strap handle hung from behind.
  'suspension-split-squat': {
    camera: SQUAT_CAMERA,
    poses: {
      top: body([0.16, 0.86], 3, SUSPENDED, HIPS_UP),
      mid: body([0.06, 0.7], 3, SUSPENDED, HIPS_UP),
      bottom: body([0, 0.56], 3, SUSPENDED, HIPS_UP),
    },
    start: 'top',
    still: 'bottom',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'foot.r', mode: 'plant' }, ...HIPS],
    props: [
      {
        kind: 'capsule',
        id: 'strap',
        group: 'handle',
        equipment: 'suspension-trainer',
        a: [-0.62, 2.0, 0],
        b: [-0.5, 0.4, 0],
        r: 0.012,
      },
    ],
    working: ['leg.r'],
    perSide: true,
  },

  // Seen from the front: a wide stance, the weight shifting over one leg, the other kept straight.
  'cossack-squat': {
    camera: { yaw: 58, pitch: 8 },
    poses: {
      top: {
        root: { pos: [0, 0.82, 0] },
        hip: { plane: 0, elev: 34, rot: -18 },
        shoulder: { plane: -15, elev: 30, rot: 80 },
        elbow: { flex: 95 },
      },
      bottom: {
        root: { pos: [-0.1, 0.5, 0.32], lean: 18 },
        neck: { flex: -10 },
        'hip.r': { plane: 20, elev: 85, rot: -62 },
        'hip.l': { plane: 0, elev: 40, rot: -18 },
        shoulder: { plane: -15, elev: 30, rot: 80 },
        elbow: { flex: 95 },
      },
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [
      { contact: 'foot.l', mode: 'plant', straight: true },
      { contact: 'foot.r', mode: 'plant' },
      ...HIPS,
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  /* Hinges: hips back, flat back, the weights close to the legs. */

  'dumbbell-romanian-deadlift': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(), armsHang(0)),
      bottom: body(...hingeAt(-0.3, 18, 65), pose(flatBack(65), armsHang(65))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights({ bell: 'out' }),
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // Deeper than the Romanian: the knees bend more and the weights go down to the shins.
  'dumbbell-deadlift': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(), armsHang(0)),
      bottom: body(...hingeAt(-0.27, 85, 58), pose(flatBack(58), armsHang(58))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights({ bell: 'out' }),
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // Hands behind the head, hips pushed back until the torso is nearly level.
  'good-morning': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(), HEAD_ARMS),
      bottom: body(...hingeAt(-0.34, 16, 75), pose(flatBack(75), HEAD_ARMS)),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), ...HEAD_PINS],
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'single-leg-romanian-deadlift': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, SL_RDL(0), armsHang(0)),
      bottom: body(...slHinge(78), pose(flatBack(78), armsHang(78))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'foot.r', mode: 'plant' }],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // A hand resting on the wall at the side for balance.
  'supported-single-leg-romanian-deadlift': {
    camera: { yaw: 52, pitch: 8 },
    poses: {
      top: body(TOP, 0, SL_RDL(0), armsHang(0)),
      bottom: body(...slHinge(78), pose(flatBack(78), armsHang(78))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [
      { contact: 'foot.r', mode: 'plant' },
      { contact: 'hand.l', mode: 'plant', at: [0.12, 1.0, -0.5], normal: [0, 0, 1] },
    ],
    props: [wall([0, 0, -0.5], [0, 0, 1])],
    working: ['leg.r'],
    perSide: true,
  },

  // Back to the door, the band between the legs: the hands pass between the thighs.
  'band-pull-through': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(), armsHang(0, 0, 18)),
      bottom: body(...hingeAt(-0.3, 18, 65), pose(flatBack(65), armsHang(65, 0, -30))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [doorEdgeOn(-0.9, -1), ...bandTo([-0.9, 0.12, 0])],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  /* Swings: a hinge that throws the weight forward to chest height. */

  // Held by one end with both hands; it hangs from them at the bottom and the top.
  'dumbbell-swing': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(0, -6), armsTogether(78, 0)),
      bottom: body(...hingeAt(-0.3, 35, 55), pose(flatBack(55), armsTogether(-25, 55))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), { contact: 'hand.l', mode: 'grip', frame: 'wrist.r', at: [0, 0, -0.08] }],
    props: [
      {
        kind: 'dumbbell',
        id: 'db.r',
        group: 'db.r',
        frame: 'wrist.r',
        at: GRIP,
        axis: [0, 1, 0],
        bell: 'down',
      },
    ],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'kettlebell-swing': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(0, -6), armsTogether(78, 0)),
      bottom: body(...hingeAt(-0.3, 35, 55), pose(flatBack(55), armsTogether(-25, 55))),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), { contact: 'hand.l', mode: 'grip', frame: 'wrist.r', at: [0, 0, -0.1] }],
    props: [weightIn('r', { kind: 'kettlebell', bell: 'out', axis: [0, 0, 1] })],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'single-arm-kettlebell-swing': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(
        TOP,
        0,
        flat(0, -6),
        pose(armsHang(0, 0, 78), { 'shoulder.l': { plane: 0, elev: 40 } }),
      ),
      bottom: body(
        ...hingeAt(-0.3, 35, 55),
        pose(flatBack(55), armsHang(55, 0, -25), { 'shoulder.l': { plane: 0, elev: 40 } }),
      ),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [weightIn('r', { kind: 'kettlebell', bell: 'out' })],
    working: ['leg.l', 'leg.r', 'arm.r'],
    perSide: true,
  },

  // From between the legs to the rack at the shoulder, the bell turning over the wrist.
  'kettlebell-clean': {
    camera: HINGE_CAMERA,
    poses: {
      top: body(TOP, 0, flat(0, -6), {
        'shoulder.r': { plane: 90, elev: 18, rot: 0 },
        'elbow.r': { flex: 148 },
        'wrist.r': { flex: -10 },
        'shoulder.l': { plane: 0, elev: 40 },
      }),
      bottom: body(...hingeAt(-0.3, 35, 55), {
        ...flatBack(55),
        'shoulder.r': { plane: 90, elev: 30, rot: 0 },
        'elbow.r': { flex: 6 },
        'shoulder.l': { plane: 0, elev: 40 },
      }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [weightIn('r', { kind: 'kettlebell', bell: 'back' })],
    working: ['leg.l', 'leg.r', 'arm.r'],
    perSide: true,
  },

  /* Bridges and thrusts: on the back, the upper back the pivot, feet planted or sliding. */

  'glute-bridge': {
    camera: FLOOR_CAMERA,
    poses: {
      top: body(...bridgeAt(26, FEET_NEAR), supineUpper(26)),
      bottom: body(...bridgeAt(0, FEET_NEAR), supineUpper(0)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'single-leg-glute-bridge': {
    camera: FLOOR_CAMERA,
    poses: {
      top: body(...bridgeAt(26, ONE_FOOT_NEAR), supineUpper(26)),
      bottom: body(...bridgeAt(0, ONE_FOOT_NEAR), supineUpper(0)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'foot.r', mode: 'plant' }],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // The weight sits on the hip crease and rides up with the hips.
  'floor-hip-thrust': {
    camera: FLOOR_CAMERA,
    poses: {
      top: body(...bridgeAt(26, FEET_NEAR), supineUpper(26, THRUST_ARMS)),
      bottom: body(...bridgeAt(0, FEET_NEAR), supineUpper(0, THRUST_ARMS)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: [...feet(), ...THRUST_PINS],
    props: [THRUST_WEIGHT],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // Upper back on the bench's edge: the hips drop below it and drive up level with it.
  'bench-hip-thrust': {
    camera: FLOOR_CAMERA,
    poses: {
      top: body(...benchAt(-6), supineUpper(-6, BENCH_UPPER)),
      bottom: body(...benchAt(-52), supineUpper(-52, BENCH_UPPER)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: [...feet(), ...THRUST_PINS],
    props: [...BENCH_ACROSS, THRUST_WEIGHT],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // A mini-band above the knees, pressed out at the top.
  'banded-glute-bridge': {
    camera: { yaw: -30, pitch: 22 },
    poses: {
      top: body(...bridgeAt(26, FEET_NEAR), pose(supineUpper(26), { hip: { rot: -14 } })),
      bottom: body(...bridgeAt(0, FEET_NEAR), supineUpper(0)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [
      {
        kind: 'mini-band',
        id: 'band',
        group: 'band',
        from: { frame: 'hip.l', at: [0.0, -0.3, 0] },
        to: { frame: 'hip.r', at: [0.0, -0.3, 0] },
      },
    ],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // The heels walk out and back with the hips held high.
  'hamstring-bridge-walkout': {
    camera: FLOOR_CAMERA,
    poses: {
      in: body(...bridgeAt(26, FEET_NEAR), supineUpper(26)),
      mid: body(...bridgeAt(26, HEELS_MID), supineUpper(26)),
      out: body(...bridgeAt(26, HEELS_OUT), supineUpper(26)),
    },
    start: 'in',
    still: 'in',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'hold' },
    ],
    pins: [],
    props: [],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'sliding-leg-curl': {
    camera: FLOOR_CAMERA,
    poses: {
      in: body(...bridgeAt(26, FEET_NEAR_HEELS), supineUpper(26)),
      mid: body(...bridgeAt(26, HEELS_MID), supineUpper(26)),
      out: body(...bridgeAt(26, HEELS_OUT), supineUpper(26)),
    },
    start: 'in',
    still: 'in',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'hold' },
    ],
    pins: [],
    props: [SLIDER],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'single-leg-sliding-leg-curl': {
    camera: FLOOR_CAMERA,
    poses: {
      in: body(...bridgeAt(26, ONE_HEEL_IN), supineUpper(26)),
      mid: body(...bridgeAt(26, ONE_HEEL_MID), supineUpper(26)),
      out: body(...bridgeAt(26, ONE_HEEL_OUT), supineUpper(26)),
    },
    start: 'in',
    still: 'in',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'hold' },
    ],
    pins: [],
    props: [SLIDER],
    working: ['leg.r'],
    perSide: true,
  },

  // Heels in strap handles hung overhead: the hips stay high while the heels curl in.
  'suspension-hamstring-curl': {
    camera: FLOOR_CAMERA,
    poses: {
      in: body(...bridgeAt(30, HANGING_HEELS(0.2, 0.15)), supineUpper(30)),
      mid: body(...bridgeAt(30, HANGING_HEELS(0.5, 0.3)), supineUpper(30)),
      out: body(...bridgeAt(30, HANGING_HEELS(0.82, 0.4)), supineUpper(30)),
    },
    start: 'in',
    still: 'in',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'eccentric', share: 0.5 },
      { to: 'out', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'concentric', share: 0.5 },
      { to: 'in', phase: 'hold' },
    ],
    pins: [],
    props: [{ kind: 'suspension', id: 'straps', anchor: [0.5, 2.3, 0], on: 'feet' }],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'heels-on-chair-bridge': {
    camera: FLOOR_CAMERA,
    poses: {
      top: body(...bridgeAt(26, HEELS_ON_CHAIR), supineUpper(26)),
      mid: body(...bridgeAt(16, HEELS_ON_CHAIR), supineUpper(16)),
      bottom: body(...bridgeAt(6, HEELS_ON_CHAIR), supineUpper(6)),
    },
    start: 'top',
    still: 'top',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [],
    props: [support('chair', [0.79, 0.45, 0], 180)],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'single-leg-heels-on-chair-bridge': {
    camera: FLOOR_CAMERA,
    poses: {
      top: body(...bridgeAt(26, ONE_HEEL_ON_CHAIR), supineUpper(26)),
      mid: body(...bridgeAt(16, ONE_HEEL_ON_CHAIR), supineUpper(16)),
      bottom: body(...bridgeAt(6, ONE_HEEL_ON_CHAIR), supineUpper(6)),
    },
    start: 'top',
    still: 'top',
    loop: [
      { to: 'mid', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'mid', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [],
    props: [support('chair', [0.79, 0.45, 0], 180)],
    working: ['leg.r'],
    perSide: true,
  },

  /* Calf raises: up on the balls of the feet, a straight leg, a full stretch at the bottom. */

  'calf-raise': {
    camera: { yaw: 16, pitch: 6 },
    poses: {
      bottom: body(...calfAt(0, 2), armsHang(0)),
      top: body(...calfAt(-38, 2), armsHang(0)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: [
      { contact: 'toes', mode: 'anchor', at: [0.145, 0, 0] },
      { contact: 'hand.r', mode: 'plant', at: [0.4, 1.3, 0.2], normal: [-1, 0, 0] },
    ],
    props: [wall([0.4, 0, 0], [-1, 0, 0])],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'dumbbell-calf-raise': {
    camera: { yaw: 16, pitch: 6 },
    poses: {
      bottom: body(...calfAt(0, 2), armsHang(0)),
      top: body(...calfAt(-38, 2), armsHang(0)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'toes', mode: 'anchor', at: [0.145, 0, 0] }],
    props: weights(),
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  // On the edge of a step, a hand on the wall, the free foot tucked behind.
  'single-leg-calf-raise': {
    camera: { yaw: 8, pitch: 6 },
    poses: {
      bottom: body(...oneCalf(18), armsHang(0)),
      top: body(...oneCalf(-38), armsHang(0)),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'hand.r', mode: 'plant', at: [0.4, 1.3, 0.2], normal: [-1, 0, 0] }],
    props: [
      wall([0.4, 0, 0], [-1, 0, 0]),
      {
        kind: 'box',
        id: 'step',
        group: 'handle',
        min: [0.04, 0, -0.3],
        max: [0.6, 0.1, 0.3],
      },
    ],
    working: ['leg.r'],
    perSide: true,
  },

  // Seated, a weight on each thigh near the knee; the heels rise and the knees with them.
  'seated-dumbbell-calf-raise': {
    camera: { yaw: 18, pitch: 8 },
    poses: {
      bottom: body([-0.42, 0.53], 0, seatedFeet(0), SEATED_ARMS),
      top: body([-0.42, 0.53], 0, seatedFeet(-45), SEATED_ARMS),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: (['l', 'r'] as const).map((S) => handOn(S, `hip.${S}`, [0.13, -0.3, 0])),
    props: [
      support('chair', [-0.31, 0.45, 0], 0),
      ...(['l', 'r'] as const).map((S) => ({
        kind: 'dumbbell' as const,
        id: `db.${S}`,
        group: `db.${S}` as const,
        frame: `hip.${S}` as const,
        at: [0.1, -0.3, 0] as [number, number, number],
        axis: [0, 0, 1] as [number, number, number],
      })),
    ],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  /* On all fours: hips over the knees, hands under the shoulders, the back flat. */

  'donkey-kick': {
    camera: { yaw: 14, pitch: 12 },
    poses: {
      down: quad(legAbs('r', 0, 90, -170)),
      up: quad(legAbs('r', -70, 90, -150)),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // Seen from the front and above, where the knee swinging out to the side shows.
  'fire-hydrant': {
    camera: { yaw: -135, pitch: 28 },
    poses: {
      down: quad(legAbs('r', 0, 90, -170)),
      up: quad({
        'hip.r': { plane: 30, elev: 80, rot: -45 },
        'knee.r': { flex: 90 },
        'ankle.r': { flex: -40 },
      }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },

  // Lying face down, feet toward the door; the near heel curls toward the glute against the band.
  'band-leg-curl': {
    camera: { yaw: 16, pitch: 22 },
    poses: {
      straight: prone(8),
      curled: prone(100),
    },
    start: 'curled',
    still: 'curled',
    loop: rep('straight', 'curled'),
    pins: [],
    props: [
      doorEdgeOn(-1.5, -1),
      {
        kind: 'band',
        id: 'band.r',
        group: 'band.r',
        from: [-1.5, 0.1, 0.085],
        to: { frame: 'ankle.r', at: [0, 0, 0] },
      },
    ],
    working: ['leg.r'],
    perSide: true,
  },

  // Kneeling, ankles held down behind: the whole body tips forward from the knees.
  'nordic-curl-eccentric': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      top: nordic(4, NORDIC_ARMS_UP),
      half: nordic(42, NORDIC_ARMS_MID),
      bottom: nordic(72, NORDIC_ARMS_DOWN),
    },
    start: 'top',
    still: 'half',
    loop: [
      { to: 'half', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'half', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'knees', mode: 'anchor', at: [0, 0, 0] }],
    props: [SOFA],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'nordic-curl': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      top: nordic(4, NORDIC_ARMS_UP),
      half: nordic(42, NORDIC_ARMS_MID),
      bottom: nordic(80, NORDIC_ARMS_FAR),
    },
    start: 'top',
    still: 'half',
    loop: [
      { to: 'half', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'eccentric', share: 0.5 },
      { to: 'bottom', phase: 'pause' },
      { to: 'half', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'concentric', share: 0.5 },
      { to: 'top', phase: 'hold' },
    ],
    pins: [{ contact: 'knees', mode: 'anchor', at: [0, 0, 0] }],
    props: [SOFA],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  /* Lying on the right side, seen from the front: the top leg works. */

  'side-lying-leg-raise': {
    camera: { yaw: 84, pitch: 22 },
    poses: {
      down: side({ 'hip.l': { plane: 0, elev: 0 } }),
      up: side({ 'hip.l': { plane: 0, elev: 40 } }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [HIPS[0]!],
    props: [],
    working: ['leg.l'],
    perSide: true,
  },

  clamshell: {
    camera: { yaw: 62, pitch: 38 },
    poses: {
      closed: side(CLAM_LEGS(0)),
      open: side(CLAM_LEGS(-28)),
    },
    start: 'open',
    still: 'open',
    loop: rep('closed', 'open'),
    pins: [
      { contact: 'foot.r', mode: 'plant', at: [-0.017, 0.07, -0.581] },
      { contact: 'foot.l', mode: 'plant', at: [-0.017, 0.155, -0.581] },
      HIPS[0]!,
    ],
    props: [
      {
        kind: 'mini-band',
        id: 'band',
        group: 'band',
        from: { frame: 'hip.l', at: [0.0, -0.3, 0] },
        to: { frame: 'hip.r', at: [0.0, -0.3, 0] },
      },
    ],
    working: ['leg.l'],
    perSide: true,
  },

  /* Band work on the legs, seen from the front. */

  // The outside leg opens against a band anchored low on a door at the side.
  'band-hip-abduction': {
    camera: { yaw: 88, pitch: 6 },
    poses: {
      together: {
        root: { pos: [0, 0.906, 0] },
        hip: { plane: 0, elev: 2 },
        knee: { flex: 0 },
        shoulder: { plane: -15, elev: 30, rot: 80 },
        elbow: { flex: 95 },
      },
      apart: {
        root: { pos: [0, 0.906, 0] },
        'hip.l': { plane: 0, elev: 2 },
        'hip.r': { plane: 0, elev: 30 },
        knee: { flex: 0 },
        shoulder: { plane: -15, elev: 30, rot: 80 },
        elbow: { flex: 95 },
      },
    },
    start: 'apart',
    still: 'apart',
    loop: rep('together', 'apart'),
    pins: [{ contact: 'foot.l', mode: 'plant', straight: true }, ...HIPS],
    props: [
      {
        kind: 'box',
        id: 'door',
        group: 'door',
        equipment: 'door',
        min: [-0.42, 0, -1.04],
        max: [0.42, 2.03, -1.0],
      },
      {
        kind: 'band',
        id: 'band.r',
        group: 'band.r',
        from: [0, 0.12, -1.0],
        to: { frame: 'ankle.r', at: [0, -0.02, 0] },
      },
    ],
    working: ['leg.r'],
    perSide: true,
  },

  // A band at the ankles: a step out to the side, the knees soft, then the other foot follows.
  // Knees soft, a step of 30 cm to the side and the other foot follows; then the same way back.
  'band-lateral-walk': {
    camera: { yaw: 84, pitch: 6 },
    poses: {
      a: sideStep(0, 3, 3),
      b: sideStep(0.15, 13.6, 13.6),
      c: sideStep(0.3, -3, 3),
    },
    start: 'a',
    still: 'b',
    loop: [
      { to: 'b', phase: 'eccentric', share: 0.5, swing: 'foot.r' },
      { to: 'c', phase: 'eccentric', share: 0.5, swing: 'foot.l' },
      { to: 'c', phase: 'pause' },
      { to: 'b', phase: 'concentric', share: 0.5, swing: 'foot.l' },
      { to: 'a', phase: 'concentric', share: 0.5, swing: 'foot.r' },
      { to: 'a', phase: 'hold' },
    ],
    pins: [
      { contact: 'foot.l', mode: 'plant', lift: 0.05 },
      { contact: 'foot.r', mode: 'plant', lift: 0.05 },
      ...HIPS,
    ],
    props: [
      {
        kind: 'band',
        id: 'band',
        group: 'band',
        from: { frame: 'knee.l', at: [0, -0.2, 0] },
        to: { frame: 'knee.r', at: [0, -0.2, 0] },
      },
    ],
    working: ['leg.l', 'leg.r'],
    perSide: false,
  },

  'lateral-lunge': {
    camera: { yaw: 78, pitch: 6 },
    poses: {
      stand: pose({ root: { pos: [0, 0.925, 0] }, hip: { plane: 180, elev: 1.6 } }, HIPS_UP, {
        straight: ['leg.l', 'leg.r'],
      }),
      land: pose(
        {
          root: { pos: [0, 0.8, 0.45] },
          'hip.r': { plane: 0, elev: 29, rot: 0 },
          'hip.l': { plane: 0, elev: 28, rot: 0 },
          'knee.r': { flex: 0 },
        },
        HIPS_UP,
      ),
      bottom: pose(
        {
          root: { pos: [-0.12, 0.5, 0.57], lean: 30 },
          neck: { flex: -10 },
          'hip.r': { plane: 0, elev: 70, rot: -65 },
          'hip.l': { plane: 0, elev: 40, rot: 0 },
        },
        HIPS_UP,
        { straight: ['leg.l'] },
      ),
    },
    start: 'stand',
    still: 'bottom',
    loop: [
      { to: 'land', phase: 'eccentric', share: 0.4, swing: 'foot.r' },
      { to: 'bottom', phase: 'eccentric', share: 0.6 },
      { to: 'bottom', phase: 'pause' },
      { to: 'land', phase: 'concentric', share: 0.55 },
      { to: 'stand', phase: 'concentric', share: 0.45, swing: 'foot.r' },
      { to: 'stand', phase: 'hold' },
    ],
    pins: [
      { contact: 'foot.l', mode: 'plant', straight: true },
      { contact: 'foot.r', mode: 'plant', lift: 0.08 },
      ...HIPS,
    ],
    props: [],
    working: ['leg.r'],
    perSide: true,
  },
} satisfies Record<string, ExerciseAnimation>;

type Legs = ('leg.l' | 'leg.r')[];
const BOTH: Legs = ['leg.l', 'leg.r'];
/** Poses where the steps say the legs are straight or locked out. */
const STRAIGHT: Record<string, Record<string, Legs>> = {
  'bodyweight-squat': { top: BOTH },
  'goblet-squat': { top: BOTH },
  'goblet-sumo-squat': { top: BOTH },
  'chair-squat': { top: BOTH },
  'dumbbell-front-squat': { top: BOTH },
  'mini-band-squat': { top: BOTH },
  'pistol-squat': { top: ['leg.r'] },
  'box-pistol-squat': { top: ['leg.r'] },
  'suspension-assisted-pistol-squat': { top: ['leg.r'] },
  'reverse-lunge': { top: BOTH },
  'walking-lunge': { top: BOTH },
  'dumbbell-deadlift': { top: BOTH },
  'dumbbell-romanian-deadlift': { top: BOTH },
  'good-morning': { top: BOTH },
  'single-leg-romanian-deadlift': { top: ['leg.r'] },
  'supported-single-leg-romanian-deadlift': { top: ['leg.r'] },
  'band-pull-through': { top: BOTH },
  'dumbbell-swing': { top: BOTH },
  'kettlebell-swing': { top: BOTH },
  'single-arm-kettlebell-swing': { top: BOTH },
  'kettlebell-clean': { top: BOTH },
  'calf-raise': { top: BOTH, bottom: BOTH },
  'dumbbell-calf-raise': { top: BOTH, bottom: BOTH },
  'single-leg-calf-raise': { top: ['leg.r'], bottom: ['leg.r'] },
  'cossack-squat': { top: BOTH, bottom: ['leg.l'] },
  'side-lying-leg-raise': { down: BOTH, up: BOTH },
  'band-hip-abduction': { together: BOTH, apart: BOTH },
};

export const legsAnimations = Object.fromEntries(
  Object.entries(legsRaw).map(([id, anim]) => {
    const marks = STRAIGHT[id];
    if (!marks) return [id, anim];
    const poses = Object.fromEntries(
      Object.entries(anim.poses).map(([name, p]) => [
        name,
        marks[name] ? { ...p, straight: marks[name] } : p,
      ]),
    );
    return [id, { ...anim, poses }];
  }),
) as typeof legsRaw;
