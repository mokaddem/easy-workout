import type {
  AnimationPin,
  AnimationPose,
  AnimationProp,
  ExerciseAnimation,
  LoopStep,
} from '@/domain';
import {
  ARMS_STRAIGHT,
  bandTo,
  dipBars,
  doorEdgeOn,
  feet,
  handOn,
  hinge,
  hold,
  onToes,
  palms,
  plank,
  pose,
  reclined,
  rep,
  seated,
  SPLIT_STANCE,
  STAND,
  supine,
  support,
  underFoot,
  wall,
  weightIn,
  weights,
} from './shared';

/*
 * Push family. Each ladder (push-ups, pikes, dips, lying presses, flyes, triceps, standing chest
 * work, overhead presses and raises) keeps one camera and one set of arm positions, so its steps
 * read as one move getting harder. Those shared pieces come first.
 */

/** The push-up ladder's camera: a little in front of the right side, looking down. */
const PUSH_UP_CAMERA = { yaw: 30, pitch: 16 };
/** Wall push-up: body angles at the top (arms locked) and the bottom. */
const WALL_TOP = 18.13;
const WALL_BOTTOM = 32.6;
/** Higher, for the variants that move the hands: their width and the elbows' path show. */
const HANDS_CAMERA = { yaw: 38, pitch: 30 };

/** The pike ladder's camera: the side, where the inverted V and the head's path read best. */
const PIKE_CAMERA = { yaw: 0, pitch: 8 };
/** Hands-elevated pike: where the hands rest, a little in from the seat's front edge. */
const HEP_HANDS = 0.85;
/** In a pike press the elbows travel back toward the feet and out, the head going ahead of them. */
const PIKE_ELBOWS: [number, number, number] = [0.45, -0.55, 0.7];

/**
 * Hips high, head down: the torso `lean` degrees from upright (past 90: head lower than hips),
 * hips flexed `hips` degrees, legs straight, arms reaching on past the head.
 */
const pike = (lean: number, hips: number, extra: AnimationPose = {}): AnimationPose =>
  pose(
    {
      root: { lean },
      neck: { flex: -20 },
      hip: { plane: 90, elev: hips },
      knee: { flex: 4 },
      ankle: { flex: 6 },
    },
    extra,
  );

/** Dips: from the side and a touch in front, so both bars and the elbows' path show. */
const DIP_CAMERA = { yaw: 18, pitch: 8 };
/** Bar and seat heights; the hands sit on them a little in front of the shoulders' line. */
const BARS_HEIGHT = 1.0;
const SEAT = 0.45;
const DIP_BARS = dipBars([0.02, BARS_HEIGHT, 0]);
/** Two chairs facing the figure, one under each hand, their backs against a wall ahead. */
const DIP_CHAIRS: AnimationProp[] = [
  support('chair', [0.17, SEAT, -0.4], 180, undefined, 'chair.l'),
  support('chair', [0.17, SEAT, 0.4], 180, undefined, 'chair.r'),
  wall([0.42, 0, 0], [-1, 0, 0]),
];
/** Shoulder heights: arms locked at the top; elbows at about 90° at the bottom. */
const BAR_TOP = 1.5798;
const BAR_BOTTOM = 1.4065;
const BAR_SUPPORT = 1.559;
const CHAIR_TOP = 1.0306;
const CHAIR_BOTTOM = 0.853;
const CHAIR_SUPPORT = 1.009;
const BENCH_DIP_TOP = 1.0295;
const BENCH_DIP_BOTTOM = 0.844;
/** Pushing tall through depressed shoulders lifts the body this much. */
const TALL = 0.032;
/** Legs on bars: slightly in front for the support; knees bent, feet behind in the dip. */
const SUPPORT_LEGS: AnimationPose = { hip: { elev: 34 }, knee: { flex: 30 }, ankle: { flex: -20 } };
/** Between chairs the hips are low: thighs back, shins folded up behind. */
const CHAIR_LEGS: AnimationPose = { hip: { elev: -18 }, knee: { flex: 112 }, ankle: { flex: -30 } };
const CHAIR_LEGS_LOW: AnimationPose = {
  hip: { elev: -34 },
  knee: { flex: 138 },
  ankle: { flex: -30 },
};
/** Legs trailing back with the feet flat on the floor: hip, knee and ankle angles. */
const FEET_BACK = (elev: number, knee: number, ankle: number): AnimationPose => ({
  hip: { elev },
  knee: { flex: knee },
  ankle: { flex: ankle },
});
/** Lower slowly, pause, hop back up to the top. */
const NEGATIVE_LOOP: LoopStep[] = [
  { to: 'bottom', phase: 'eccentric' },
  { to: 'bottom', phase: 'pause' },
  { to: 'hop', phase: 'concentric', share: 0.5 },
  { to: 'top', phase: 'concentric', share: 0.5 },
  { to: 'top', phase: 'hold' },
];

/** Hands on the bars or seats `height` high, elbows travelling straight back. */
const dipHands = (height: number): AnimationPin[] =>
  palms({ x: 0.02, width: 0.5, height, elbows: [-1, 0, 0.1] });

/**
 * Held up between the bars with the shoulders at `shoulder` ([x, height]) and the torso leaning
 * `lean` degrees forward; knees bent, feet behind.
 */
const dipBody = (
  shoulder: [number, number],
  lean: number,
  extra: AnimationPose = {},
): AnimationPose => {
  const a = (lean * Math.PI) / 180;
  return pose(
    {
      root: { pos: [shoulder[0] - 0.43 * Math.sin(a), shoulder[1] - 0.43 * Math.cos(a), 0], lean },
      clav: { elev: -6 },
      neck: { flex: 4 },
      hip: { plane: 90, elev: 16 },
      knee: { flex: 80 },
      ankle: { flex: -24 },
    },
    extra,
  );
};

/** Lying presses: from the side, a little toward the head, looking down. */
const LYING_CAMERA = { yaw: -22, pitch: 16 };
/** Arms straight up over the chest, shoulder blades set. */
const PRESS_TOP: AnimationPose = {
  clav: { prot: -6 },
  shoulder: { plane: 84, elev: 88, rot: 0 },
  elbow: { flex: 6, pron: 80 },
};
/** Elbows about 45° out from the body, a little below it; forearms vertical. */
const PRESS_BOTTOM: AnimationPose = {
  clav: { prot: -12 },
  shoulder: { plane: -18, elev: 52, rot: 0 },
  elbow: { flex: 96, pron: 80 },
};
/** Upper arms tipped a little toward the head and kept there; only the forearms move. */
const EXTENSION_TOP: AnimationPose = {
  shoulder: { plane: 90, elev: 108, rot: -4 },
  elbow: { flex: 6 },
};

/** Flyes: from the head end, raised, so the arms' arc opens across the picture. */
const FLY_CAMERA = { yaw: -64, pitch: 26 };
/** Arms together over the chest, elbows slightly bent and turned out. */
const FLY_CLOSED: AnimationPose = {
  clav: { prot: -4 },
  shoulder: { plane: 88, elev: 90, rot: 80 },
  elbow: { flex: 20 },
};
/** Arms open wide to the sides, the same slight bend. */
const FLY_OPEN: AnimationPose = {
  clav: { prot: -12 },
  shoulder: { plane: 0, elev: 88, rot: 0 },
  elbow: { flex: 20 },
};

/** Presses overhead: from the front, a little to the right. */
const PRESS_CAMERA = { yaw: 62, pitch: 8 };
/** Raises: nearly square on, so the arms rise across the picture. */
const RAISE_CAMERA = { yaw: 80, pitch: 6 };
/** Sitting back against a backrest. */
const SEAT_BACK: AnimationPose = { root: { pos: [-0.06, 0.548, 0] } };
/** Weights at ear level: upper arms out to the sides and a little forward, forearms vertical. */
const OVERHEAD_BOTTOM: AnimationPose = {
  shoulder: { plane: 22, elev: 84, rot: -84 },
  elbow: { flex: 100, pron: 70 },
};
/** Arms straight overhead, the weights just in front of the head. */
const OVERHEAD_TOP: AnimationPose = {
  clav: { elev: 6 },
  shoulder: { plane: 26, elev: 166, rot: -84 },
  elbow: { flex: 6, pron: 70 },
};
/** Arms raised to the sides, no higher than the shoulders, elbows slightly bent. */
const RAISE_TOP: AnimationPose = {
  spine: { flex: 4 },
  clav: { elev: 4 },
  shoulder: { plane: 20, elev: 86 },
  elbow: { flex: 14 },
};
const RAISE_BOTTOM: AnimationPose = {
  spine: { flex: 4 },
  shoulder: { plane: 20, elev: 13 },
  elbow: { flex: 14 },
};

/** Overhead extensions: from behind the right side, so the forearms drop behind the head in view. */
const TRICEPS_CAMERA = { yaw: -50, pitch: 8 };
/** Upper arms up beside the head, elbows pointing up and kept close. */
const OVERHEAD_EXTENSION: AnimationPose = {
  shoulder: { plane: -40, elev: 194, rot: 130 },
};
/**
 * The forearms swing behind the head about a shoulder that turns a little as they go, so the two
 * hands stay the same distance apart on either side of the weight the whole way. Each key gives
 * the elbow's bend and the shoulder plane that keeps the wrists about 5 cm off the midline.
 */
const EXTENSION_KEYS = [
  { name: 'mid1', flex: 30, plane: -26.5 },
  { name: 'mid2', flex: 70, plane: -29.5 },
  { name: 'mid3', flex: 110, plane: -34.5 },
] as const;
const extensionMid = (key: (typeof EXTENSION_KEYS)[number]): AnimationPose => ({
  shoulder: { plane: key.plane },
  elbow: { flex: key.flex },
});
const EXTENSION_LOOP: LoopStep[] = [
  { to: 'mid1', phase: 'eccentric', share: 0.18 },
  { to: 'mid2', phase: 'eccentric', share: 0.32 },
  { to: 'mid3', phase: 'eccentric', share: 0.32 },
  { to: 'bottom', phase: 'eccentric', share: 0.18 },
  { to: 'bottom', phase: 'pause' },
  { to: 'mid3', phase: 'concentric', share: 0.18 },
  { to: 'mid2', phase: 'concentric', share: 0.32 },
  { to: 'mid1', phase: 'concentric', share: 0.32 },
  { to: 'top', phase: 'concentric', share: 0.18 },
  { to: 'top', phase: 'hold' },
];
/** Elbows tucked at the sides, torso leaning a little over the hands. */
const PUSHDOWN: AnimationPose = {
  spine: { flex: 6 },
  chest: { flex: 3 },
  shoulder: { plane: 90, elev: 12, rot: 0 },
  elbow: { pron: 70 },
};

/** Band presses: from the front-right, the band running back to its anchor. */
const BAND_CAMERA = { yaw: 34, pitch: 0 };

export const pushAnimations = {
  /* Push-up ladder: one plank; the hands' height, width and the feet change. */

  // Seen from the side: from in front, the camera would sit inside the wall.
  'wall-push-up': {
    camera: { yaw: 0, pitch: 8 },
    poses: {
      top: plank(WALL_TOP, { ankle: { flex: 16 }, straight: ['arm.l', 'arm.r'] }),
      // The nose stops a hand's width short of the wall.
      bottom: plank(WALL_BOTTOM, { ankle: { flex: 31 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [
      { contact: 'feet', mode: 'anchor', at: [0, 0, 0] },
      ...feet(),
      // Hands at shoulder height; the elbows travel down and out, about 45° from the body.
      ...palms({
        x: 0.93,
        width: 0.44,
        height: 1.16,
        normal: [-1, 0, 0],
        elbows: [0.45, -0.85, 0.3],
      }),
    ],
    props: [wall([0.93, 0, 0], [-1, 0, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'incline-push-up': {
    camera: PUSH_UP_CAMERA,
    poses: {
      top: plank(49.12, ARMS_STRAIGHT),
      bottom: plank(64, { ankle: { flex: -2 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes(), ...palms({ x: 0.93, width: 0.42, height: 0.45 })],
    // The chair braced against a wall so it cannot slide.
    props: [support('chair', [0.93, 0.45, 0], 180), wall([1.18, 0, 0], [-1, 0, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'knee-push-up': {
    camera: PUSH_UP_CAMERA,
    poses: {
      top: plank(54.49, { knee: { flex: 62 }, ankle: { flex: -30 }, ...ARMS_STRAIGHT }),
      bottom: plank(79, { knee: { flex: 52 }, ankle: { flex: -30 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [{ contact: 'knees', mode: 'anchor', at: [0, 0, 0] }, ...palms({ x: 0.75, width: 0.42 })],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'push-up': {
    camera: PUSH_UP_CAMERA,
    poses: {
      top: plank(72.88, ARMS_STRAIGHT),
      bottom: plank(88, { ankle: { flex: -2 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes(), ...palms({ x: 1.187, width: 0.43 })],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'feet-elevated-push-up': {
    camera: PUSH_UP_CAMERA,
    poses: {
      top: plank(91.55, { ankle: { flex: -24 }, ...ARMS_STRAIGHT }),
      bottom: plank(104, { ankle: { flex: -14 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes([0, 0.45, 0]), ...palms({ x: 1.36, width: 0.43 })],
    props: [support('chair', [-0.1, 0.45, 0], 0)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'wide-push-up': {
    camera: HANDS_CAMERA,
    poses: {
      top: plank(74, ARMS_STRAIGHT),
      bottom: plank(88, { ankle: { flex: -2 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes(), ...palms({ x: 1.2, width: 0.66, elbows: [-0.5, -0.5, 0.72] })],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'close-grip-push-up': {
    camera: HANDS_CAMERA,
    poses: {
      top: plank(72.95, ARMS_STRAIGHT),
      bottom: plank(87, { ankle: { flex: -2 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    // Elbows brush past the ribs, pointing back toward the feet.
    pins: [onToes(), ...palms({ x: 1.17, width: 0.24, elbows: [-0.55, -0.8, 0.12] })],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // The near (right) arm bends and takes the weight as the body shifts over it; the far arm
  // stays straight out to the side. Seen nearly from the front, where the shift shows.
  'archer-push-up': {
    camera: { yaw: 75, pitch: 28 },
    poses: {
      top: pose(plank(75.33), ARMS_STRAIGHT),
      bottom: plank(86.37, {
        root: { turn: -16, tilt: -6 },
        ankle: { flex: -2 },
        straight: ['arm.l'],
      }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [
      onToes(),
      { contact: 'hand.l', mode: 'plant', at: [1.21, 0, -0.4] },
      {
        contact: 'hand.r',
        mode: 'plant',
        at: [1.21, 0, 0.4],
        pole: { frame: 'chest', dir: [-0.5, -0.5, 0.72] },
      },
    ],
    props: [],
    working: ['arm.r'],
    perSide: true,
  },

  'suspension-push-up': {
    camera: PUSH_UP_CAMERA,
    poses: {
      top: plank(65.72, ARMS_STRAIGHT),
      bottom: plank(83, { ankle: { flex: -2 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes(), ...palms({ x: 1.22, width: 0.4, height: 0.15 })],
    props: [{ kind: 'suspension', id: 'straps', anchor: [0.75, 2.6, 0] }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },
  /* Pike ladder: hips high, the head travels down between the hands; seen from the side. */

  'pike-push-up': {
    camera: PIKE_CAMERA,
    poses: {
      top: pike(150.3, 125, ARMS_STRAIGHT),
      bottom: pike(170, 125, { neck: { flex: -28 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes(), ...palms({ x: 0.74, width: 0.42, elbows: PIKE_ELBOWS })],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Hands near the seat's front edge, on tiptoe, hips high: the shoulders come over the hands
  // and the head goes down toward the seat's edge, the forearms about 55° from vertical.
  'hands-elevated-pike-push-up': {
    camera: PIKE_CAMERA,
    poses: {
      top: pike(127.94, 122, { ankle: { flex: -30 }, ...ARMS_STRAIGHT }),
      bottom: pike(140, 122, { neck: { flex: -28 }, ankle: { flex: -30 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [
      onToes(),
      ...palms({ x: HEP_HANDS, width: 0.42, height: SEAT, elbows: [0.25, -0.75, 0.62] }),
    ],
    // The chair's back against the wall.
    props: [
      support('chair', [HEP_HANDS + 0.15, SEAT, 0], 180),
      wall([HEP_HANDS + 0.39, 0, 0], [-1, 0, 0]),
    ],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'feet-elevated-pike-push-up': {
    camera: PIKE_CAMERA,
    poses: {
      top: pike(166, 102.73, { ankle: { flex: -30 }, ...ARMS_STRAIGHT }),
      // The head comes down to the floor; the torso stops at vertical.
      bottom: pike(179, 102.73, { neck: { flex: -28 }, ankle: { flex: -30 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [onToes([0, 0.45, 0]), ...palms({ x: 0.8, width: 0.42, elbows: PIKE_ELBOWS })],
    props: [support('chair', [-0.1, 0.45, 0], 0), wall([-0.34, 0, 0], [1, 0, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Chest to the wall, hands a short step from it, toes resting on it.
  'wall-handstand-hold': {
    camera: PIKE_CAMERA,
    poses: {
      settle: {
        root: { pos: [0.1, 0.969, 0], lean: 176 },
        straight: ['arm.l', 'arm.r'],
        neck: { flex: -12 },
        hip: { plane: 90, elev: 0 },
        ankle: { flex: -42 },
      },
      tall: {
        root: { pos: [0.1, 1.009, 0], lean: 176 },
        straight: ['arm.l', 'arm.r'],
        neck: { flex: -12 },
        clav: { elev: 14 },
        hip: { plane: 90, elev: 0 },
        ankle: { flex: -42 },
      },
    },
    start: 'tall',
    still: 'tall',
    loop: hold('settle', 'tall'),
    pins: [...palms({ x: 0.1, width: 0.4, elbows: PIKE_ELBOWS })],
    props: [wall([-0.085, 0, 0], [1, 0, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // From the inverted V the chest dives low toward the hands, presses up into an arch, then the
  // hips push back up into the V.
  'hindu-push-up': {
    camera: PIKE_CAMERA,
    poses: {
      vee: pike(118.54, 71, { hip: { plane: 80 }, ...ARMS_STRAIGHT }),
      dive: pike(131, 70, { hip: { plane: 80 }, neck: { flex: -34 } }),
      skim: pike(100, 30, { hip: { plane: 80 }, neck: { flex: -34 }, ankle: { flex: -14 } }),
      // On the way back the chest drops back between the arms, then the hips rise.
      push: pike(67.43, -6, { hip: { plane: 80 }, neck: { flex: -16 }, ankle: { flex: -24 } }),
      rise: pike(118.15, 70, { hip: { plane: 80 }, neck: { flex: -10 }, ankle: { flex: -14 } }),
      arch: {
        root: { lean: 73.14 },
        straight: ['arm.l', 'arm.r'],
        spine: { flex: -12 },
        chest: { flex: -14 },
        neck: { flex: -26 },
        // Hips extended: a negative elevation in the legs' own plane, so blends stay in it.
        hip: { plane: 80, elev: -6 },
        ankle: { flex: -34 },
      },
    },
    start: 'vee',
    still: 'arch',
    // The way back from the arch to the start is unhurried, slower than the swoop.
    neutral: { concentric: 1.6 },
    loop: [
      { to: 'dive', phase: 'eccentric' },
      { to: 'dive', phase: 'pause' },
      { to: 'skim', phase: 'concentric', share: 0.2 },
      { to: 'arch', phase: 'concentric', share: 0.2 },
      { to: 'push', phase: 'concentric', share: 0.2 },
      { to: 'rise', phase: 'concentric', share: 0.2 },
      { to: 'vee', phase: 'concentric', share: 0.2 },
      { to: 'vee', phase: 'hold' },
    ],
    pins: [onToes(), ...palms({ x: 1.2, width: 0.44 })],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Dips: the elbows bend straight back, shoulders kept down. */

  // Hands on the seat's front edge; the back stays close to it, elbows stop at about 90°.
  'bench-dip': {
    camera: DIP_CAMERA,
    poses: {
      top: pose(
        dipBody([0.03, BENCH_DIP_TOP], 4, { hip: { elev: 84 }, knee: { flex: 88 } }),
        ARMS_STRAIGHT,
      ),
      bottom: dipBody([0.12, BENCH_DIP_BOTTOM], 8, { hip: { elev: 70 }, knee: { flex: 72 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), ...palms({ x: -0.07, width: 0.4, height: SEAT, elbows: [-1, 0, 0.12] })],
    props: [support('chair', [-0.25, SEAT, 0], 0)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // On bars (listed first); between two chairs the body sits much lower, so the chairs have
  // their own poses: knees bent, feet up behind, clear of the floor.
  'dip-bar-support-hold': {
    camera: DIP_CAMERA,
    poses: {
      settle: pose(
        dipBody([0.0, BAR_SUPPORT], 4, SUPPORT_LEGS),
        { clav: { elev: 2 } },
        ARMS_STRAIGHT,
      ),
      tall: pose(
        dipBody([0.0, BAR_SUPPORT + TALL], 4, SUPPORT_LEGS),
        { clav: { elev: -10 } },
        ARMS_STRAIGHT,
      ),
    },
    start: 'tall',
    still: 'tall',
    loop: hold('settle', 'tall'),
    pins: dipHands(BARS_HEIGHT),
    props: [DIP_BARS],
    working: ['arm.l', 'arm.r'],
    perSide: false,
    variants: {
      chair: {
        poses: {
          settle: pose(
            dipBody([0.0, CHAIR_SUPPORT], 4, CHAIR_LEGS),
            { clav: { elev: 2 } },
            ARMS_STRAIGHT,
          ),
          tall: pose(
            dipBody([0.0, CHAIR_SUPPORT + TALL], 4, CHAIR_LEGS),
            { clav: { elev: -10 } },
            ARMS_STRAIGHT,
          ),
        },
        pins: dipHands(SEAT),
        props: DIP_CHAIRS,
      },
    },
  },

  // Lowered slowly to 90° at the elbows; the way back up is a small hop, legs reaching down.
  'dip-bar-negative-dip': {
    camera: DIP_CAMERA,
    poses: {
      top: pose(dipBody([0.0, BAR_TOP], 8), ARMS_STRAIGHT),
      bottom: dipBody([0.15, BAR_BOTTOM], 26, { hip: { elev: 30 } }),
      hop: dipBody([0.08, BAR_BOTTOM + 0.14], 16, {
        hip: { elev: 6 },
        knee: { flex: 20 },
        ankle: { flex: -16 },
      }),
    },
    start: 'top',
    still: 'bottom',
    loop: NEGATIVE_LOOP,
    pins: dipHands(BARS_HEIGHT),
    props: [DIP_BARS],
    working: ['arm.l', 'arm.r'],
    perSide: false,
    variants: {
      chair: {
        poses: {
          top: pose(dipBody([0.0, CHAIR_TOP], 6, FEET_BACK(-42, 8, 56)), ARMS_STRAIGHT),
          bottom: dipBody([0.15, CHAIR_BOTTOM], 24, FEET_BACK(-24, 34, 78)),
          // The seats are low: the feet stay on the floor behind the body and the legs drive it
          // back up; the arms only follow.
          hop: dipBody([0.08, 0.97], 14, FEET_BACK(-34, 16, 64)),
        },
        // The toes stay where they are on the floor.
        pins: [
          ...dipHands(SEAT),
          { contact: 'foot.l', mode: 'plant', rest: 'toes', at: [-0.557, 0.006, -0.085] },
          { contact: 'foot.r', mode: 'plant', rest: 'toes', at: [-0.557, 0.006, 0.085] },
        ],
        props: DIP_CHAIRS,
      },
    },
  },

  // Between two chairs (listed first): knees bent, feet up behind, clear of the floor.
  dip: {
    camera: DIP_CAMERA,
    poses: {
      top: pose(dipBody([0.0, CHAIR_TOP], 6, CHAIR_LEGS), ARMS_STRAIGHT),
      bottom: dipBody([0.15, CHAIR_BOTTOM], 24, CHAIR_LEGS_LOW),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: dipHands(SEAT),
    props: DIP_CHAIRS,
    working: ['arm.l', 'arm.r'],
    perSide: false,
    variants: {
      'dip-bars': {
        poses: {
          top: pose(dipBody([0.0, BAR_TOP], 8), ARMS_STRAIGHT),
          bottom: dipBody([0.15, BAR_BOTTOM], 26, { hip: { elev: 30 } }),
        },
        pins: dipHands(BARS_HEIGHT),
        props: [DIP_BARS],
      },
    },
  },

  /* Lying presses and extensions: from the head end's side, so both arms and the elbows' angle show. */

  'dumbbell-bench-press': {
    camera: LYING_CAMERA,
    poses: {
      top: pose(supine(0.45), PRESS_TOP, ARMS_STRAIGHT),
      bottom: pose(supine(0.45), PRESS_BOTTOM),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [support('bench', [0.02, 0.45, 0], 0), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'dumbbell-floor-press': {
    camera: LYING_CAMERA,
    poses: {
      top: pose(supine(), PRESS_TOP, ARMS_STRAIGHT),
      // Upper arms rest on the floor, about 45° from the body.
      bottom: pose(supine(), PRESS_BOTTOM, { shoulder: { plane: 0, elev: 50 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights({ bell: 'back' }),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'incline-dumbbell-press': {
    camera: LYING_CAMERA,
    poses: {
      top: pose(reclined(38), {
        clav: { prot: -6 },
        shoulder: { plane: 90, elev: 122, rot: 0 },
        elbow: { flex: 6, pron: 80 },
        straight: ['arm.l', 'arm.r'],
      }),
      // Elbows about 45° out, at the bench's line; forearms vertical under the weights.
      bottom: pose(reclined(38), {
        clav: { prot: -12 },
        shoulder: { plane: -20, elev: 46, rot: -42 },
        elbow: { flex: 118, pron: 80 },
      }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [support('bench', [0, 0.45, 0], 0, 38), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'dumbbell-lying-triceps-extension': {
    camera: LYING_CAMERA,
    poses: {
      top: pose(supine(0.45), EXTENSION_TOP, ARMS_STRAIGHT),
      bottom: pose(supine(0.45), EXTENSION_TOP, { elbow: { flex: 128 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [support('bench', [0.02, 0.45, 0], 0), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'dumbbell-floor-triceps-extension': {
    camera: LYING_CAMERA,
    poses: {
      top: pose(supine(), EXTENSION_TOP, { shoulder: { elev: 102 } }, ARMS_STRAIGHT),
      bottom: pose(supine(), EXTENSION_TOP, { shoulder: { elev: 102 }, elbow: { flex: 112 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Flyes: a hugging arc across the body, elbows slightly bent and fixed. */

  'dumbbell-floor-fly': {
    camera: FLY_CAMERA,
    poses: {
      top: pose(supine(), FLY_CLOSED),
      // The floor stops the upper arms.
      bottom: pose(supine(), FLY_OPEN, { shoulder: { plane: 6 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'incline-dumbbell-fly': {
    // In front: from the head end the camera would look at the bench's back.
    camera: { yaw: 58, pitch: 14 },
    poses: {
      top: pose(reclined(38), FLY_CLOSED, { shoulder: { elev: 116 } }),
      bottom: pose(reclined(38), FLY_OPEN, { shoulder: { plane: -14, elev: 96 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [support('bench', [0, 0.45, 0], 0, 38), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Triceps: the upper arms stay put, only the forearms move. */

  // One weight in both hands: a dumbbell held upright by its top end, or a kettlebell by the horns.
  'overhead-dumbbell-triceps-extension': {
    camera: TRICEPS_CAMERA,
    poses: {
      top: pose(STAND, OVERHEAD_EXTENSION, { elbow: { flex: 8 } }, ARMS_STRAIGHT),
      mid1: pose(STAND, OVERHEAD_EXTENSION, extensionMid(EXTENSION_KEYS[0])),
      mid2: pose(STAND, OVERHEAD_EXTENSION, extensionMid(EXTENSION_KEYS[1])),
      mid3: pose(STAND, OVERHEAD_EXTENSION, extensionMid(EXTENSION_KEYS[2])),
      bottom: pose(STAND, OVERHEAD_EXTENSION, { elbow: { flex: 132 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: EXTENSION_LOOP,
    pins: feet(),
    props: [
      {
        kind: 'dumbbell',
        id: 'db',
        group: 'db',
        frame: 'wrist.r',
        // Between the hands, hanging from them.
        at: [0.04, -0.04, -0.046],
        axis: [0, 1, 0],
        bell: 'down',
      },
    ],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-overhead-triceps-extension': {
    camera: TRICEPS_CAMERA,
    poses: {
      top: pose(SPLIT_STANCE, OVERHEAD_EXTENSION, { elbow: { flex: 8 } }, ARMS_STRAIGHT),
      mid1: pose(SPLIT_STANCE, OVERHEAD_EXTENSION, extensionMid(EXTENSION_KEYS[0])),
      mid2: pose(SPLIT_STANCE, OVERHEAD_EXTENSION, extensionMid(EXTENSION_KEYS[1])),
      mid3: pose(SPLIT_STANCE, OVERHEAD_EXTENSION, extensionMid(EXTENSION_KEYS[2])),
      bottom: pose(SPLIT_STANCE, OVERHEAD_EXTENSION, { elbow: { flex: 132 } }),
    },
    start: 'top',
    still: 'bottom',
    loop: EXTENSION_LOOP,
    pins: feet(),
    props: [
      {
        kind: 'band',
        id: 'band',
        group: 'band',
        from: underFoot('r'),
        to: { frame: 'wrist.r', at: [0.05, -0.02, -0.046] },
      },
    ],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Hinged over, the free hand braced on its thigh; seen from behind the working side.
  'dumbbell-triceps-kickback': {
    camera: { yaw: -34, pitch: 14 },
    poses: {
      bent: pose(hinge(58), {
        'shoulder.r': { plane: -84, elev: 32, rot: 0 },
        'elbow.r': { flex: 96 },
      }),
      straight: pose(hinge(58), {
        'shoulder.r': { plane: -84, elev: 32, rot: 0 },
        'elbow.r': { flex: 4 },
        straight: ['arm.r'],
      }),
    },
    start: 'straight',
    still: 'straight',
    loop: rep('bent', 'straight'),
    pins: [...feet(), handOn('l', 'hip.l', [0.08, -0.17, 0], [-0.3, 0, -0.9])],
    props: [weightIn('r')],
    working: ['arm.r'],
    perSide: true,
  },

  // Facing the door, the band anchored at its top.
  'band-triceps-pushdown': {
    camera: { yaw: 0, pitch: 6 },
    poses: {
      bent: pose(STAND, PUSHDOWN, { elbow: { flex: 92 } }),
      straight: pose(STAND, PUSHDOWN, { elbow: { flex: 6 } }, ARMS_STRAIGHT),
    },
    start: 'straight',
    still: 'bent',
    loop: rep('bent', 'straight'),
    pins: feet(),
    props: [doorEdgeOn(0.6, 1), ...bandTo([0.6, 1.98, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Facing away from the anchor, leaning on the straps; the body lowers as the elbows bend.
  'suspension-triceps-extension': {
    camera: { yaw: 22, pitch: 8 },
    poses: {
      straight: {
        root: { lean: 24 },
        hip: { plane: 90, elev: 0 },
        ankle: { flex: 24 },
        shoulder: { plane: 84, elev: 118, rot: -10 },
        elbow: { flex: 6 },
        straight: ['arm.l', 'arm.r'],
      },
      bent: {
        root: { lean: 36 },
        neck: { flex: -6 },
        hip: { plane: 90, elev: 0 },
        ankle: { flex: 36 },
        shoulder: { plane: 84, elev: 128, rot: -10 },
        elbow: { flex: 126 },
      },
    },
    start: 'straight',
    still: 'bent',
    loop: rep('bent', 'straight'),
    pins: [{ contact: 'feet', mode: 'anchor', at: [0, 0, 0] }, ...feet()],
    props: [{ kind: 'suspension', id: 'straps', anchor: [-0.7, 2.4, 0] }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Standing chest work against a band or straps: the press and fly arms of the lying moves. */

  // The band runs back to an anchor at the edge of the door behind, at chest height.
  'band-chest-press': {
    camera: BAND_CAMERA,
    poses: {
      // Hands beside the chest, elbows about 45° out and a little below the shoulders.
      bottom: pose(SPLIT_STANCE, {
        spine: { flex: 6 },
        clav: { prot: -12 },
        shoulder: { plane: -28, elev: 62, rot: -30 },
        elbow: { flex: 122, pron: 80 },
      }),
      top: pose(SPLIT_STANCE, { spine: { flex: 6 } }, PRESS_TOP, ARMS_STRAIGHT),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: [doorEdgeOn(-0.72, -1), ...bandTo([-0.72, 1.3, 0.38])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-chest-fly': {
    camera: { yaw: 50, pitch: 10 },
    poses: {
      open: pose(SPLIT_STANCE, { spine: { flex: 6 } }, FLY_OPEN, { shoulder: { plane: -6 } }),
      closed: pose(SPLIT_STANCE, { spine: { flex: 6 } }, FLY_CLOSED),
    },
    start: 'closed',
    still: 'open',
    loop: rep('open', 'closed'),
    pins: feet(),
    props: [doorEdgeOn(-0.72, -1), ...bandTo([-0.72, 1.3, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Leaning on the straps: the body lowers as the arms open, no further than the chest.
  'suspension-chest-fly': {
    camera: { yaw: 46, pitch: 10 },
    poses: {
      closed: pose(
        { root: { lean: 22 }, hip: { plane: 90, elev: 0 }, ankle: { flex: 22 } },
        FLY_CLOSED,
        // Arms straight in front at the start and the finish; slightly bent through the arc.
        { shoulder: { elev: 84 }, elbow: { flex: 6 } },
        ARMS_STRAIGHT,
      ),
      open: pose(
        { root: { lean: 34 }, hip: { plane: 90, elev: 0 }, ankle: { flex: 34 } },
        FLY_OPEN,
        { shoulder: { plane: -4, elev: 96 } },
      ),
    },
    start: 'closed',
    still: 'open',
    loop: rep('open', 'closed'),
    pins: [{ contact: 'feet', mode: 'anchor', at: [0, 0, 0] }, ...feet()],
    props: [{ kind: 'suspension', id: 'straps', anchor: [-0.3, 2.6, 0] }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Shoulder presses and raises: from the front, a little to the side. */

  'seated-dumbbell-shoulder-press': {
    camera: PRESS_CAMERA,
    poses: {
      bottom: pose(seated(), SEAT_BACK, OVERHEAD_BOTTOM),
      top: pose(seated(), SEAT_BACK, OVERHEAD_TOP, ARMS_STRAIGHT),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    // An adjustable bench set upright: the back rests against it, as the cue asks.
    props: [support('bench', [-0.02, SEAT, 0], 0, 84), ...weights({ bell: 'back' })],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'standing-dumbbell-shoulder-press': {
    camera: PRESS_CAMERA,
    poses: {
      bottom: pose(STAND, OVERHEAD_BOTTOM),
      top: pose(STAND, OVERHEAD_TOP, ARMS_STRAIGHT),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights({ bell: 'back' }),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Palms toward the face with the elbows in front, then the arms open and turn as they press.
  'dumbbell-arnold-press': {
    camera: { yaw: 48, pitch: 8 },
    poses: {
      front: pose(seated(), SEAT_BACK, {
        clav: { prot: 4 },
        shoulder: { plane: 84, elev: 34, rot: 4 },
        elbow: { flex: 136, pron: -10 },
      }),
      open: pose(seated(), SEAT_BACK, OVERHEAD_BOTTOM, { shoulder: { elev: 96 } }),
      top: pose(seated(), SEAT_BACK, OVERHEAD_TOP, ARMS_STRAIGHT),
    },
    start: 'top',
    still: 'front',
    loop: [
      { to: 'open', phase: 'eccentric', share: 0.45 },
      { to: 'front', phase: 'eccentric', share: 0.55 },
      { to: 'front', phase: 'pause' },
      { to: 'open', phase: 'concentric', share: 0.55 },
      { to: 'top', phase: 'concentric', share: 0.45 },
      { to: 'top', phase: 'hold' },
    ],
    pins: feet(),
    props: [support('bench', [-0.02, SEAT, 0], 0, 84), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-overhead-press': {
    camera: PRESS_CAMERA,
    poses: {
      // Hands at the shoulders, elbows below them and a little forward.
      bottom: pose(STAND, OVERHEAD_BOTTOM, {
        hip: { plane: 0, elev: 5 },
        shoulder: { plane: 60, elev: 35, rot: -20 },
        elbow: { flex: 130 },
      }),
      top: pose(STAND, OVERHEAD_TOP, { hip: { plane: 0, elev: 5 } }, ARMS_STRAIGHT),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: bandTo([
      { frame: 'ankle.l', at: [0.05, -0.06, -0.04] },
      { frame: 'ankle.r', at: [0.05, -0.06, 0.04] },
    ]),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Bell up over the fist, wrist straight, elbow close; the free hand rests on the hip.
  'kettlebell-bottoms-up-press': {
    camera: PRESS_CAMERA,
    poses: {
      // Elbow tucked in front of the ribs, forearm vertical under the bell.
      bottom: pose(STAND, {
        'shoulder.r': { plane: 74, elev: 28, rot: -12 },
        'elbow.r': { flex: 148, pron: 20 },
      }),
      top: pose(STAND, {
        'clav.r': { elev: 6 },
        'shoulder.r': { plane: 40, elev: 168, rot: -70 },
        'elbow.r': { flex: 6, pron: 20 },
        straight: ['arm.r'],
      }),
    },
    start: 'top',
    still: 'bottom',
    loop: rep('bottom', 'top'),
    pins: [...feet(), handOn('l', 'root', [0.02, 0.06, -0.16], [-0.6, 0, 0.8])],
    props: [weightIn('r', { kind: 'kettlebell', bell: 'out', axis: [1, 0, 0] })],
    working: ['arm.r'],
    perSide: true,
  },

  'dumbbell-lateral-raise': {
    camera: RAISE_CAMERA,
    poses: {
      top: pose(STAND, RAISE_TOP),
      bottom: pose(STAND, RAISE_BOTTOM),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-lateral-raise': {
    camera: RAISE_CAMERA,
    poses: {
      top: pose(STAND, RAISE_TOP),
      bottom: pose(STAND, RAISE_BOTTOM),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: bandTo([underFoot('l'), underFoot('r')]),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },
} satisfies Record<string, ExerciseAnimation>;
