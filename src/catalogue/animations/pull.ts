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
  doorwayBar,
  feetAt,
  floorDumbbell,
  hung,
  KNEEL,
  onBar,
  PRONE,
  tableEdge,
  doorEdgeOn,
  feet,
  GRIP,
  handOn,
  hinge,
  hold,
  onToes,
  plank,
  pose,
  rep,
  reclined,
  seated,
  SPLIT_STANCE,
  STAND,
  support,
  underFoot,
  weightIn,
  weights,
} from './shared';

type Vec3 = [number, number, number];

/*
 * Pull family. Each ladder (pull-ups, rows, band pulls, curls) keeps one camera and one set of
 * arm positions, so its steps read as one move getting harder. Those shared pieces come first.
 */

/* ------------------------------------------------------------------ */
/* Doorway pull-up bar                                                 */
/* ------------------------------------------------------------------ */

/** The pull-ups' camera: nearly the side, turned a little so the bar and both hands show. */
const BAR_CAMERA = { yaw: 24, pitch: 6 };

/** The pull-up loop: hang, then the shoulder blades set, then the pull. */
const pullLoop = (hang: string, set: string, top: string): LoopStep[] => [
  { to: hang, phase: 'eccentric' },
  { to: hang, phase: 'pause' },
  { to: set, phase: 'concentric', share: 0.15 },
  { to: top, phase: 'concentric', share: 0.85 },
  { to: top, phase: 'hold' },
];

/** A band looped over the bar and under the right foot. */
const assistBand = (barY = 2.0): AnimationProp[] =>
  [0.03, -0.03].map((dx, i) => ({
    kind: 'band',
    id: `band.${i}`,
    group: 'band',
    from: [dx, barY, 0.09] as Vec3,
    to: { frame: 'ankle.r' as const, at: [dx, -0.06, 0] as Vec3 },
  }));

/** Deep hip hinge, wide stance, knees over the feet: the base of the gorilla row. */
const GORILLA = (extra: AnimationPose): AnimationPose =>
  pose(
    {
      root: { pos: [-0.2, 0.594, 0], lean: 68 },
      spine: { flex: -4 },
      neck: { flex: -16 },
      head: { flex: -6 },
      hip: { plane: 76, elev: 136 },
      knee: { flex: 68 },
    },
    extra,
  );

/** The standing curl: elbows pinned at the sides, the forearms turning to `pron`. */
const curlPose = (elbow: number, pron: number, extra: AnimationPose = {}): AnimationPose =>
  pose(
    STAND,
    { clav: { prot: 0 }, shoulder: { plane: 90, elev: 6 }, elbow: { flex: elbow, pron } },
    extra,
  );

/** The band stood on, a hand in each end. */
const bandUnderFeet = (): AnimationProp[] => bandTo([underFoot('l'), underFoot('r')]);

/** Leaning over the thighs, legs apart, the working arm hanging between them. */
const CONCENTRATION: AnimationPose = {
  spine: { flex: 30 },
  chest: { flex: 22 },
  neck: { flex: -10 },
  hip: { plane: 66 },
  'shoulder.r': { plane: 110, elev: 36 },
};

/** The right leg straight down under the bar, in the band; the left trails behind. */
const BAND_LEG: AnimationPose = {
  'hip.r': { plane: 90, elev: 0 },
  'knee.r': { flex: 8 },
  'ankle.r': { flex: -10 },
};

/* ------------------------------------------------------------------ */
/* Rows from underneath                                                */
/* ------------------------------------------------------------------ */

/** Straps rows: the arm positions of the door and table rows, braced on the floor. */
const ROW_TOP: AnimationPose = {
  clav: { prot: -14 },
  shoulder: { plane: 90, elev: 8, rot: 0 },
  elbow: { flex: 115 },
};
const ROW_HANG: AnimationPose = {
  clav: { prot: 6 },
  shoulder: { plane: 88, elev: 48 },
  elbow: { flex: 2 },
};

/** Braced and leaning back from the straps, feet planted: the base of the raises and the curl. */
const leanBack = (lean: number): AnimationPose => ({ root: { lean }, hip: { plane: 90, elev: 0 } });
/** Body angles at which the hands stay one strap length from the anchor in each raise and the curl. */
const T_LEAN = -15;
const Y_LEAN = -37;
const CURL_LEAN = -35;

/** Face down on a bench inclined 35 degrees, chest on the pad, head up the slope, legs trailing to the floor. */
const PRONE_BENCH: AnimationPose = {
  root: { pos: [0.037, 0.643, 0], lean: 55 },
  neck: { flex: 10 },
  hip: { plane: 90, elev: 7 },
};

/** Where the straps hang from. */
const STRAPS: Vec3 = [0.04, 2.4, 0];

/** Straps rows: down through the middle key keeps the hands at one strap length from the anchor. */
const SUSPENSION_ROW_LOOP: LoopStep[] = [
  { to: 'q2', phase: 'eccentric', share: 0.25 },
  { to: 'mid', phase: 'eccentric', share: 0.25 },
  { to: 'q1', phase: 'eccentric', share: 0.25 },
  { to: 'hang', phase: 'eccentric', share: 0.25 },
  { to: 'hang', phase: 'pause' },
  { to: 'q1', phase: 'concentric', share: 0.25 },
  { to: 'mid', phase: 'concentric', share: 0.25 },
  { to: 'q2', phase: 'concentric', share: 0.25 },
  { to: 'top', phase: 'concentric', share: 0.25 },
  { to: 'top', phase: 'hold' },
];
/** Standing on the chair seat (top 0.5 m), feet flat on it, hands on the bar, chin over it. */
const NEG_CHAIR: AnimationPose = {
  root: { pos: [0.16, 1.4153, 0], lean: -10 },
  neck: { flex: -14 },
  clav: { elev: -6 },
  hip: { plane: 90, elev: 0 },
  knee: { flex: 3 },
  ankle: { flex: -7 },
};
/** Where the ankles stand over the seat in `NEG_CHAIR`. */
const NEG_FOOT_X = 0.2864;
/**
 * Step off at the top and lower into the hang; knees up, feet forward onto the seat, then stand
 * up on it.
 */
const NEG_LOOP: LoopStep[] = [
  { to: 'stepOff', phase: 'eccentric', share: 0.2 },
  { to: 'hang', phase: 'eccentric', share: 0.8 },
  { to: 'hang', phase: 'pause' },
  { to: 'knees', phase: 'concentric', share: 0.1 },
  { to: 'reach', phase: 'concentric', share: 0.1 },
  { to: 'seat', phase: 'concentric', share: 0.2 },
  { to: 'rise1', phase: 'concentric', share: 0.2 },
  { to: 'rise2', phase: 'concentric', share: 0.2 },
  { to: 'rise3', phase: 'concentric', share: 0.1 },
  { to: 'chair', phase: 'concentric', share: 0.1 },
  { to: 'chair', phase: 'hold' },
];
/** The loop steps with the feet on the seat: from landing on it to the step-off. */
const NEG_STANDING = NEG_LOOP.flatMap((_, i) =>
  i > NEG_LOOP.findIndex((s) => s.to === 'seat') ? [i] : [],
);
/** The step-off: the knees drawn up, the feet lifted well clear of the seat. */
const STEP_HIP = 55;
const STEP_KNEE = 105;
const STEP_ANKLE = 35;
export const pullAnimations = {
  /* Pull-up ladder: one doorway bar, one camera; the grip, the band or the chair change. */

  'pull-up': {
    camera: BAR_CAMERA,
    poses: {
      hang: pose(hung([-0.03, 1.415], 0, { clav: { elev: 10 } }), ARMS_STRAIGHT),
      set: pose(hung([-0.03, 1.47], 0, { clav: { elev: -8 } }), ARMS_STRAIGHT),
      top: hung([-0.1, 1.95], -12, { neck: { flex: -12 }, clav: { elev: -6 } }),
    },
    start: 'top',
    still: 'top',
    loop: pullLoop('hang', 'set', 'top'),
    pins: onBar(0.52),
    props: doorwayBar(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'chin-up': {
    camera: BAR_CAMERA,
    poses: {
      hang: pose(hung([-0.03, 1.407], 0, { clav: { elev: 10 } }), ARMS_STRAIGHT),
      set: pose(hung([-0.03, 1.46], 0, { clav: { elev: -8 } }), ARMS_STRAIGHT),
      top: hung([-0.14, 1.95], -14, { neck: { flex: -14 }, clav: { elev: -6 } }),
    },
    start: 'top',
    still: 'top',
    loop: pullLoop('hang', 'set', 'top'),
    // Narrower grip, elbows travelling forward and down toward the hips.
    pins: onBar(0.34, [0.5, -1, 0.1]),
    props: doorwayBar(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // The band hangs straight down from the bar to the foot under it; the other leg trails behind.
  'band-assisted-pull-up': {
    camera: { yaw: 18, pitch: 6 },
    poses: {
      hang: pose(hung([-0.03, 1.415], 0, { clav: { elev: 10 }, ...BAND_LEG }), ARMS_STRAIGHT),
      set: pose(hung([-0.03, 1.47], 0, { clav: { elev: -8 }, ...BAND_LEG }), ARMS_STRAIGHT),
      top: hung([-0.1, 1.95], -12, { neck: { flex: -12 }, clav: { elev: -6 }, ...BAND_LEG }),
    },
    start: 'top',
    still: 'top',
    loop: pullLoop('hang', 'set', 'top'),
    pins: onBar(0.52),
    props: [...doorwayBar(), ...assistBand()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Step off the seat at the top, lower into the hang, feet down onto the seat, then stand up
  // with the legs: the arms only follow. The bar is a little lower for the chair moves: the chin
  // clears it standing on the seat.
  'negative-pull-up': {
    camera: { yaw: 70, pitch: 6 },
    poses: {
      // Standing on the seat, feet flat on its top, the chin over the bar.
      chair: NEG_CHAIR,
      // At the top, the knees come up and the feet lift off the seat; they swing back past its
      // front edge, well above it, as the body lowers.
      stepOff: pose(NEG_CHAIR, {
        hip: { elev: STEP_HIP },
        knee: { flex: STEP_KNEE },
        ankle: { flex: STEP_ANKLE },
      }),
      hang: pose(
        hung([-0.03, 1.345], 0, {
          clav: { elev: 0 },
          hip: { elev: 14 },
          knee: { flex: 100 },
          ankle: { flex: -22 },
        }),
        ARMS_STRAIGHT,
      ),
      // The knees come up and the feet tuck under the body, above the seat's height ...
      knees: pose(
        hung([-0.03, 1.345], 0, {
          clav: { elev: 0 },
          hip: { elev: 75 },
          knee: { flex: 145 },
          ankle: { flex: 30 },
        }),
        ARMS_STRAIGHT,
      ),
      // ... then swing forward above its front edge, and step down onto it.
      reach: pose(
        hung([-0.03, 1.345], 0, {
          clav: { elev: 0 },
          hip: { elev: 104 },
          knee: { flex: 140 },
          ankle: { flex: 36 },
        }),
        ARMS_STRAIGHT,
      ),
      // Standing up on the seat: the feet stay flat on it while the legs straighten.
      rise1: {
        root: { pos: [0.033, 1.085, 0], lean: -3.3 },
        neck: { flex: -4.7 },
        clav: { elev: -2 },
        hip: { plane: 90, elev: 77 },
        knee: { flex: 97 },
        ankle: { flex: 16 },
      },
      rise3: {
        root: { pos: [0.1275, 1.3275, 0], lean: -8.3 },
        neck: { flex: -11.7 },
        clav: { elev: -5 },
        hip: { plane: 90, elev: 33 },
        knee: { flex: 56 },
        ankle: { flex: 18 },
      },
      rise2: {
        root: { pos: [0.095, 1.245, 0], lean: -6.6 },
        neck: { flex: -9.3 },
        clav: { elev: -4 },
        hip: { plane: 90, elev: 50 },
        knee: { flex: 76 },
        ankle: { flex: 18 },
      },
      // Feet down flat on the seat, where they stand at the top.
      seat: pose(
        hung([-0.03, 1.345], 0, {
          clav: { elev: 0 },
          hip: { elev: 99.3 },
          knee: { flex: 113.2 },
          ankle: { flex: 13.8 },
        }),
        ARMS_STRAIGHT,
      ),
    },
    start: 'chair',
    still: 'chair',
    loop: NEG_LOOP,
    pins: [
      ...onBar(0.52, [-0.3, -1, 0.35], 1.9),
      // The feet stand flat on the seat from the moment they land until the step-off.
      ...(['l', 'r'] as const).map((S): AnimationPin => ({
        contact: `foot.${S}`,
        mode: 'plant',
        at: [NEG_FOOT_X, 0.5, S === 'l' ? -0.085 : 0.085],
        steps: NEG_STANDING,
      })),
    ],
    props: [...doorwayBar(0.46, 1.9), support('chair', [0.42, 0.5, 0], 180)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'scapular-pull-up': {
    camera: BAR_CAMERA,
    poses: {
      hang: pose(hung([-0.03, 1.397], 0, { clav: { elev: 16 } }), ARMS_STRAIGHT),
      set: pose(hung([-0.03, 1.482], 0, { clav: { elev: -12 } }), ARMS_STRAIGHT),
    },
    start: 'set',
    still: 'set',
    loop: rep('hang', 'set'),
    pins: onBar(0.52),
    props: doorwayBar(),
    working: ['torso'],
    perSide: false,
  },

  // Chin over the bar, the chair under the feet it was climbed from.
  'flexed-arm-hang': {
    camera: BAR_CAMERA,
    poses: {
      settle: hung([-0.1, 1.9], -12, { neck: { flex: -12 }, clav: { elev: -2 } }),
      tall: hung([-0.1, 1.95], -12, { neck: { flex: -12 }, clav: { elev: -8 } }),
    },
    start: 'tall',
    still: 'tall',
    loop: hold('settle', 'tall'),
    pins: onBar(0.52, [-0.3, -1, 0.35], 2.0),
    props: [...doorwayBar(), support('chair', [-0.1, 0.45, 0], 180)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Very wide grip: the torso stays nearly upright, the right elbow drops down and out, the left
  // arm stays straight along the bar.
  'archer-pull-up': {
    camera: { yaw: 48, pitch: 8 },
    poses: {
      hang: pose(hung([-0.03, 1.53], 0, { clav: { elev: 0 } }), ARMS_STRAIGHT),
      top: hung([-0.06, 1.93], -6, {
        root: { pos: [-0.1, 1.46, 0.25], tilt: -8 },
        neck: { flex: -12 },
        straight: ['arm.l'],
      }),
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: onBar(0.93, [-0.6, -0.8, 0.9], 2.0, { l: [0, -0.2, 1] }),
    props: doorwayBar(0.62),
    working: ['arm.r'],
    perSide: true,
  },

  /* Rows: the elbows drive back past the ribs, the shoulder blades squeeze at the end. */

  'door-towel-row': {
    camera: { yaw: 0, pitch: 8 },
    poses: {
      top: {
        root: { lean: -11 },
        hip: { plane: 0, elev: 0.5 },
        clav: { prot: -14 },
        shoulder: { plane: -75, elev: 32, rot: 15 },
        elbow: { flex: 100 },
      },
      hang: {
        ...ARMS_STRAIGHT,
        root: { lean: -32 },
        hip: { plane: 0, elev: 0.5 },
        clav: { prot: 6 },
        shoulder: { plane: 88, elev: 48 },
        elbow: { flex: 2 },
      },
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: [
      { contact: 'feet', mode: 'anchor', at: [0, 0, 0] },
      ...feet(),
      { contact: 'hand.l', mode: 'tether', anchor: [0.18, 1.0, -0.072], length: 0.2895 },
      { contact: 'hand.r', mode: 'tether', anchor: [0.18, 1.0, 0.072], length: 0.2895 },
    ],
    props: [
      { kind: 'box', id: 'door', group: 'door', min: [0.12, 0, -0.02], max: [0.92, 2.03, 0.02] },
      {
        kind: 'capsule',
        id: 'handle.l/0',
        group: 'handle.l',
        a: [0.175, 1.0, -0.02],
        b: [0.175, 1.0, -0.068],
        r: 0.011,
      },
      {
        kind: 'capsule',
        id: 'handle.l/1',
        group: 'handle.l',
        a: [0.175, 1.0, -0.072],
        b: [0.29, 1.0, -0.072],
        r: 0.012,
      },
      {
        kind: 'capsule',
        id: 'handle.r/0',
        group: 'handle.r',
        a: [0.175, 1.0, 0.02],
        b: [0.175, 1.0, 0.068],
        r: 0.011,
      },
      {
        kind: 'capsule',
        id: 'handle.r/1',
        group: 'handle.r',
        a: [0.175, 1.0, 0.072],
        b: [0.29, 1.0, 0.072],
        r: 0.012,
      },
      {
        kind: 'strap',
        id: 'towel.l',
        group: 'towel.l',
        hand: 'l',
        to: [0.18, 1.0, -0.072],
        r: 0.022,
      },
      {
        kind: 'strap',
        id: 'towel.r',
        group: 'towel.r',
        hand: 'r',
        to: [0.18, 1.0, 0.072],
        r: 0.022,
      },
      {
        kind: 'capsule',
        id: 'towel.l/wrap',
        group: 'towel.l',
        a: [0.18, 1.0, -0.072],
        b: [0.11, 1.0, -0.03],
        r: 0.02,
      },
      {
        kind: 'capsule',
        id: 'towel.r/wrap',
        group: 'towel.r',
        a: [0.18, 1.0, 0.072],
        b: [0.11, 1.0, 0.03],
        r: 0.02,
      },
    ],
    working: ['arm.l', 'arm.r'],
    perSide: false,
    frameHints: [
      [0.2, 1.15, 0],
      [0.35, 0, 0],
    ],
  },

  // Under a table, hands on its edge; the chest travels up to the edge, body in one line.
  'inverted-row': {
    camera: { yaw: 14, pitch: 10 },
    poses: {
      hang: {
        ...ARMS_STRAIGHT,
        root: { lean: -84.2 },
        hip: { plane: 90, elev: 0 },
        clav: { prot: 6 },
        shoulder: { plane: 90, elev: 88 },
        elbow: { flex: 4 },
      },
      top: {
        root: { lean: -66 },
        hip: { plane: 90, elev: 0 },
        clav: { prot: -14 },
        shoulder: { plane: -80, elev: 30 },
        elbow: { flex: 110 },
      },
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: [{ contact: 'feet', mode: 'anchor', at: [0, 0, 0] }, ...feet(), ...tableEdge(-1.07, 0.7)],
    props: [support('table', [-0.87, 0.75, 0], 180)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Feet up on a chair: the body slopes down to the table edge and is hauled level.
  'feet-elevated-inverted-row': {
    camera: { yaw: 14, pitch: 10 },
    poses: {
      hang: {
        ...ARMS_STRAIGHT,
        root: { lean: -105.3 },
        hip: { plane: 90, elev: 0 },
        clav: { prot: 6 },
        shoulder: { plane: 90, elev: 88 },
        elbow: { flex: 4 },
      },
      top: {
        root: { lean: -89 },
        hip: { plane: 90, elev: 0 },
        clav: { prot: -14 },
        shoulder: { plane: -80, elev: 30 },
        elbow: { flex: 110 },
      },
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: [...feetAt(0.45), ...tableEdge(-1.07, 0.7)],
    props: [support('table', [-0.87, 0.75, 0], 180), support('chair', [0, 0.45, 0], 180)],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Leaning back from the straps, body braced, arms square to the body at the bottom, the
  // handles hauled to the lower chest.
  'suspension-row': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      hang: pose({ root: { lean: -55 }, hip: { plane: 90, elev: 0 } }, ROW_HANG, ARMS_STRAIGHT, {
        shoulder: { elev: 95 },
      }),
      top: pose({ root: { lean: -35 }, hip: { plane: 90, elev: 0 } }, ROW_TOP),
      mid: pose({ root: { lean: -46 }, hip: { plane: 90, elev: 0 } }, ROW_TOP, {
        shoulder: { plane: 90, elev: 45, rot: 0 },
        elbow: { flex: 56 },
      }),
      q1: pose({ root: { lean: -51 }, hip: { plane: 90, elev: 0 } }, ROW_TOP, {
        shoulder: { plane: 90, elev: 68, rot: 0 },
        elbow: { flex: 31 },
      }),
      q2: pose({ root: { lean: -41 }, hip: { plane: 90, elev: 0 } }, ROW_TOP, {
        shoulder: { plane: 90, elev: 26, rot: 0 },
        elbow: { flex: 86 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: SUSPENSION_ROW_LOOP,
    pins: feetAt(),
    props: [{ kind: 'suspension', id: 'straps', anchor: STRAPS }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // One handle: the free hand rests on the hip and the torso stays square to the floor.
  'suspension-single-arm-row': {
    camera: { yaw: 30, pitch: 10 },
    poses: {
      hang: pose(
        { root: { lean: -55 }, hip: { plane: 90, elev: 0 } },
        ROW_HANG,
        { straight: ['arm.r'] },
        {
          shoulder: { elev: 95 },
        },
      ),
      top: pose({ root: { lean: -35 }, hip: { plane: 90, elev: 0 } }, ROW_TOP),
      mid: pose({ root: { lean: -46 }, hip: { plane: 90, elev: 0 } }, ROW_TOP, {
        shoulder: { plane: 90, elev: 45, rot: 0 },
        elbow: { flex: 56 },
      }),
      q1: pose({ root: { lean: -51 }, hip: { plane: 90, elev: 0 } }, ROW_TOP, {
        shoulder: { plane: 90, elev: 68, rot: 0 },
        elbow: { flex: 31 },
      }),
      q2: pose({ root: { lean: -41 }, hip: { plane: 90, elev: 0 } }, ROW_TOP, {
        shoulder: { plane: 90, elev: 26, rot: 0 },
        elbow: { flex: 86 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: SUSPENSION_ROW_LOOP,
    pins: [...feetAt(0, 0.12), handOn('l', 'root', [0.02, 0.06, -0.16], [-0.6, 0, 0.8])],
    // One strap only, from the right hand to the anchor.
    props: [{ kind: 'suspension', id: 'straps', anchor: STRAPS, sides: ['r'] }],
    working: ['arm.r'],
    perSide: true,
  },

  /* Suspension raises and curls: the hands stay at one strap length from the anchor, so the body
     rises as the arms open or the elbows bend. */

  'suspension-t-raise': {
    camera: { yaw: 55, pitch: 10 },
    poses: {
      closed: pose(leanBack(-55), ARMS_STRAIGHT, {
        clav: { prot: 0 },
        shoulder: { plane: 90, elev: 95 },
        elbow: { flex: 6 },
      }),
      open: pose(leanBack(T_LEAN), ARMS_STRAIGHT, {
        clav: { prot: -14 },
        shoulder: { plane: 0, elev: 90 },
        elbow: { flex: 6 },
      }),
    },
    start: 'open',
    still: 'open',
    loop: rep('closed', 'open'),
    pins: feetAt(),
    props: [{ kind: 'suspension', id: 'straps', anchor: STRAPS }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'suspension-y-raise': {
    camera: { yaw: 55, pitch: 10 },
    poses: {
      closed: pose(leanBack(-55), ARMS_STRAIGHT, {
        clav: { prot: 0 },
        shoulder: { plane: 90, elev: 95 },
        elbow: { flex: 6 },
      }),
      open: pose(leanBack(Y_LEAN), ARMS_STRAIGHT, {
        clav: { prot: -8, elev: -4 },
        shoulder: { plane: 30, elev: 150, rot: -50 },
        elbow: { flex: 6 },
      }),
    },
    start: 'open',
    still: 'open',
    loop: rep('closed', 'open'),
    pins: feetAt(),
    props: [{ kind: 'suspension', id: 'straps', anchor: STRAPS }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'suspension-biceps-curl': {
    camera: { yaw: 40, pitch: 8 },
    poses: {
      straight: pose(leanBack(-55), ARMS_STRAIGHT, {
        shoulder: { plane: 90, elev: 100 },
        elbow: { flex: 6, pron: -80 },
      }),
      curled: pose(leanBack(CURL_LEAN), {
        shoulder: { plane: 90, elev: 100 },
        elbow: { flex: 128, pron: -80 },
      }),
    },
    start: 'curled',
    still: 'curled',
    loop: rep('straight', 'curled'),
    pins: feetAt(),
    props: [{ kind: 'suspension', id: 'straps', anchor: STRAPS }],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Dumbbell rows: a flat back, the elbow driving back past the ribs. */

  // One knee and the same-side hand on the bench, the weight pulled to the hip.
  'one-arm-dumbbell-row': {
    camera: { yaw: 14, pitch: 10 },
    poses: {
      hang: {
        ...ARMS_STRAIGHT,
        root: { pos: [-0.29, 0.89, 0.07], lean: 78 },
        spine: { flex: -4 },
        neck: { flex: -16 },
        head: { flex: -6 },
        'hip.l': { plane: 90, elev: 103 },
        'knee.l': { flex: 118 },
        'ankle.l': { flex: -40 },
        'hip.r': { plane: 90, elev: 78 },
        'knee.r': { flex: 4 },
        'clav.r': { prot: 4 },
        'shoulder.r': { plane: 90, elev: 78 },
        'elbow.r': { flex: 4 },
      },
      top: {
        root: { pos: [-0.29, 0.89, 0.07], lean: 78 },
        spine: { flex: -4 },
        neck: { flex: -16 },
        head: { flex: -6 },
        'hip.l': { plane: 90, elev: 103 },
        'knee.l': { flex: 118 },
        'ankle.l': { flex: -40 },
        'hip.r': { plane: 90, elev: 78 },
        'knee.r': { flex: 4 },
        'clav.r': { prot: -14 },
        'shoulder.r': { plane: -88, elev: 10 },
        'elbow.r': { flex: 100 },
      },
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: [
      {
        contact: 'hand.l',
        mode: 'plant',
        at: [0.12, 0.45, -0.09],
        pole: { frame: 'chest', dir: [-0.5, 0, 0.8] },
      },
      { contact: 'foot.r', mode: 'plant', at: [-0.31, 0, 0.24] },
    ],
    props: [support('bench', [0.12, 0.45, -0.09], 0), weightIn('r')],
    working: ['arm.r'],
    perSide: true,
  },

  'bent-over-dumbbell-row': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      hang: pose(hinge(52), ARMS_STRAIGHT, {
        clav: { prot: 4 },
        shoulder: { plane: 90, elev: 52 },
        elbow: { flex: 4 },
      }),
      top: pose(hinge(52), {
        clav: { prot: -14 },
        shoulder: { plane: -86, elev: 14 },
        elbow: { flex: 102 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Face down on an incline bench, chest on the pad: the arms hang straight, then the elbows go back.
  'chest-supported-dumbbell-row': {
    camera: { yaw: 14, pitch: 8 },
    poses: {
      hang: pose(PRONE_BENCH, ARMS_STRAIGHT, {
        clav: { prot: 4 },
        shoulder: { plane: 90, elev: 55 },
        elbow: { flex: 4 },
      }),
      top: pose(PRONE_BENCH, {
        clav: { prot: -14 },
        shoulder: { plane: -86, elev: 12 },
        elbow: { flex: 102 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: rep('hang', 'top'),
    pins: feet(),
    props: [support('bench', [-0.2, 0.45, 0], 180, 35), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Reverse fly: the arms sweep out and up from a hang, shoulder blades squeezing. */

  'dumbbell-reverse-fly': {
    camera: { yaw: 48, pitch: 12 },
    poses: {
      bottom: pose(hinge(60), {
        clav: { prot: 2 },
        shoulder: { plane: 90, elev: 60 },
        elbow: { flex: 14 },
      }),
      top: pose(hinge(60), {
        clav: { prot: -14 },
        shoulder: { plane: 0, elev: 88 },
        elbow: { flex: 14 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: rep('bottom', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Feet wide, hips back, a bell on the floor by each foot; one is pulled to the hip at a time.
  'kettlebell-gorilla-row': {
    camera: { yaw: 36, pitch: 12 },
    poses: {
      down: GORILLA({ ...ARMS_STRAIGHT, shoulder: { plane: 90, elev: 68 }, elbow: { flex: 4 } }),
      up: GORILLA({
        shoulder: { plane: 90, elev: 68 },
        elbow: { flex: 4 },
        'clav.r': { prot: -14 },
        'shoulder.r': { plane: -86, elev: 10 },
        'elbow.r': { flex: 104 },
      }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: feet(),
    props: [
      weightIn('l', { kind: 'kettlebell', bell: 'down' }),
      weightIn('r', { kind: 'kettlebell', bell: 'down' }),
    ],
    working: ['arm.r'],
    perSide: true,
  },

  // High plank on two dumbbells: one is rowed while the other arm holds the body still.
  'renegade-row': {
    camera: { yaw: 28, pitch: 20 },
    poses: {
      down: plank(69.3, {
        ...ARMS_STRAIGHT,
        hip: { plane: 0, elev: 15 },
        'shoulder.r': { plane: 90, elev: 70 },
        'elbow.r': { flex: 4 },
      }),
      up: plank(69.3, {
        hip: { plane: 0, elev: 15 },
        'clav.r': { prot: -14 },
        'shoulder.r': { plane: -86, elev: 12 },
        'elbow.r': { flex: 104 },
      }),
    },
    start: 'up',
    still: 'up',
    loop: rep('down', 'up'),
    pins: [
      onToes(),
      {
        contact: 'hand.l',
        mode: 'plant',
        at: [1.16, 0.062, -0.215],
        pole: { frame: 'chest', dir: [-0.55, -0.62, 0.56] },
      },
    ],
    props: [
      ...floorDumbbell('l', 1.19, -0.215),
      {
        kind: 'dumbbell',
        id: 'db.r',
        group: 'db.r',
        frame: 'wrist.r',
        at: [0, -0.037, 0],
        axis: [1, 0, 0],
      },
    ],
    working: ['arm.r'],
    perSide: true,
  },

  /* Band pulls from a door anchor. */

  'band-horizontal-row': {
    camera: { yaw: 34, pitch: 8 },
    poses: {
      reach: pose(ARMS_STRAIGHT, SPLIT_STANCE, {
        clav: { prot: 6 },
        shoulder: { plane: 90, elev: 86 },
        elbow: { flex: 4 },
      }),
      pulled: pose(SPLIT_STANCE, {
        spine: { flex: -3 },
        clav: { prot: -14 },
        shoulder: { plane: -80, elev: 24, rot: -10 },
        elbow: { flex: 112 },
      }),
    },
    start: 'pulled',
    still: 'pulled',
    loop: rep('reach', 'pulled'),
    pins: feet(),
    props: [doorEdgeOn(1.15, 1), ...bandTo([1.15, 1.3, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-face-pull': {
    camera: { yaw: 42, pitch: 10 },
    poses: {
      reach: pose(ARMS_STRAIGHT, SPLIT_STANCE, {
        clav: { prot: 6 },
        shoulder: { plane: 90, elev: 96 },
        elbow: { flex: 4 },
      }),
      pulled: pose(SPLIT_STANCE, {
        spine: { flex: -3 },
        clav: { prot: -14 },
        shoulder: { plane: 22, elev: 92, rot: -84 },
        elbow: { flex: 108, pron: 70 },
      }),
    },
    start: 'pulled',
    still: 'pulled',
    loop: rep('reach', 'pulled'),
    pins: feet(),
    props: [doorEdgeOn(1.15, 1), ...bandTo([1.15, 1.55, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Kneeling tall, facing the door; the band comes down from its top edge.
  'band-lat-pulldown': {
    camera: { yaw: 32, pitch: 8 },
    poses: {
      reach: pose(KNEEL, ARMS_STRAIGHT, {
        clav: { elev: 6 },
        shoulder: { plane: 84, elev: 160 },
        elbow: { flex: 4 },
      }),
      pulled: pose(KNEEL, {
        clav: { elev: -6 },
        shoulder: { plane: 40, elev: 34 },
        elbow: { flex: 128, pron: 40 },
      }),
    },
    start: 'pulled',
    still: 'pulled',
    loop: rep('reach', 'pulled'),
    pins: [{ contact: 'knees', mode: 'anchor', at: [0, 0, 0] }],
    props: [doorEdgeOn(0.6, 1), ...bandTo([0.6, 1.95, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Standing, arms almost straight: the hands sweep from above the head down to the thighs.
  'band-straight-arm-pulldown': {
    camera: { yaw: 16, pitch: 6 },
    poses: {
      reach: pose(ARMS_STRAIGHT, SPLIT_STANCE, {
        clav: { elev: 4 },
        shoulder: { plane: 90, elev: 140 },
        elbow: { flex: 8 },
      }),
      down: pose(SPLIT_STANCE, ARMS_STRAIGHT, {
        spine: { flex: 6 },
        clav: { elev: -4 },
        shoulder: { plane: 90, elev: 18 },
        elbow: { flex: 8 },
      }),
    },
    start: 'down',
    still: 'down',
    loop: rep('reach', 'down'),
    pins: feet(),
    props: [doorEdgeOn(1.0, 1), ...bandTo([1.0, 1.95, 0])],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // From the front: the band across the chest as the straight arms open into a T.
  'band-pull-apart': {
    camera: { yaw: 74, pitch: 6 },
    poses: {
      together: pose(STAND, ARMS_STRAIGHT, {
        shoulder: { plane: 88, elev: 90 },
        elbow: { flex: 4 },
      }),
      apart: pose(STAND, ARMS_STRAIGHT, {
        clav: { prot: -14 },
        shoulder: { plane: 14, elev: 90 },
        elbow: { flex: 4 },
      }),
    },
    start: 'apart',
    still: 'apart',
    loop: rep('together', 'apart'),
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

  /* Prone raises: face down on the floor, the arms lift off it by the shoulder blades. */

  'prone-t-raise': {
    camera: { yaw: 66, pitch: 24 },
    poses: {
      floor: pose(PRONE, { shoulder: { plane: 6, elev: 90 }, elbow: { flex: 4 } }),
      lifted: pose(PRONE, {
        clav: { prot: -14 },
        shoulder: { plane: -10, elev: 90, rot: -70 },
        elbow: { flex: 4 },
      }),
    },
    start: 'lifted',
    still: 'lifted',
    loop: rep('floor', 'lifted'),
    pins: [],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'prone-y-raise': {
    camera: { yaw: 35, pitch: 45 },
    poses: {
      floor: pose(PRONE, { shoulder: { plane: 6, elev: 148 }, elbow: { flex: 4 } }),
      lifted: pose(PRONE, {
        clav: { prot: -8 },
        shoulder: { plane: -26, elev: 148, rot: -70 },
        elbow: { flex: 4 },
      }),
    },
    start: 'lifted',
    still: 'lifted',
    loop: rep('floor', 'lifted'),
    pins: [],
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  /* Curls: the upper arms stay beside the body, only the forearms swing. */

  'dumbbell-biceps-curl': {
    camera: { yaw: 45, pitch: 8 },
    poses: {
      down: curlPose(4, -80),
      top: curlPose(142, -80, { shoulder: { elev: 10 } }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'dumbbell-hammer-curl': {
    camera: { yaw: 45, pitch: 8 },
    poses: {
      down: curlPose(4, 0, { shoulder: { plane: 60, elev: 10 } }),
      top: curlPose(142, 0, { shoulder: { elev: 10 } }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Palms down all the way: the wrists stay level with the forearms.
  'dumbbell-reverse-curl': {
    camera: { yaw: 45, pitch: 8 },
    poses: {
      down: curlPose(4, 80),
      top: curlPose(142, 80, { shoulder: { elev: 10 } }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Up palms up, turned palms down at the top, lowered palms down, turned back at the bottom.
  'dumbbell-zottman-curl': {
    camera: { yaw: 45, pitch: 8 },
    poses: {
      downUp: curlPose(4, -80),
      topUp: curlPose(142, -80, { shoulder: { elev: 10 } }),
      topDown: curlPose(142, 80, { shoulder: { elev: 10 } }),
      downDown: curlPose(4, 80),
    },
    start: 'topUp',
    still: 'topDown',
    loop: [
      { to: 'topDown', phase: 'eccentric', share: 0.15 },
      { to: 'downDown', phase: 'eccentric', share: 0.85 },
      { to: 'downDown', phase: 'pause' },
      { to: 'downUp', phase: 'concentric', share: 0.15 },
      { to: 'topUp', phase: 'concentric', share: 0.85 },
      { to: 'topUp', phase: 'hold' },
    ],
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // The three parts of the set in turn: the bottom half, the full range, then the top half.
  'dumbbell-21s': {
    camera: { yaw: 45, pitch: 8 },
    poses: {
      down: curlPose(4, -80),
      half: curlPose(90, -80, { shoulder: { elev: 8 } }),
      top: curlPose(142, -80, { shoulder: { elev: 10 } }),
    },
    start: 'top',
    still: 'half',
    loop: [...rep('down', 'half'), ...rep('down', 'top'), ...rep('half', 'top')],
    pins: feet(),
    props: weights(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  'band-biceps-curl': {
    camera: { yaw: 45, pitch: 8 },
    poses: {
      down: curlPose(4, -80),
      top: curlPose(142, -80, { shoulder: { elev: 10 } }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: feet(),
    props: bandUnderFeet(),
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Back against an inclined bench, arms hanging behind the torso for a full stretch at the bottom.
  'dumbbell-incline-curl': {
    camera: { yaw: 8, pitch: 6 },
    poses: {
      down: pose(reclined(60), {
        shoulder: { plane: -90, elev: 30 },
        elbow: { flex: 4, pron: -80 },
      }),
      top: pose(reclined(60), {
        shoulder: { plane: -90, elev: 30 },
        elbow: { flex: 140, pron: -80 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: feet(),
    props: [support('bench', [0, 0.45, 0], 0, 60), ...weights()],
    working: ['arm.l', 'arm.r'],
    perSide: false,
  },

  // Seated, leaning over, the elbow on the inner thigh; the other hand rests on its knee.
  'dumbbell-concentration-curl': {
    camera: { yaw: 40, pitch: 14 },
    poses: {
      down: pose(seated(), CONCENTRATION, { 'elbow.r': { flex: 6, pron: -80 } }),
      top: pose(seated(), CONCENTRATION, { 'elbow.r': { flex: 140, pron: -80 } }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: [...feet(), handOn('l', 'knee.l', [0.05, 0.06, 0], [-0.6, 0, 0.8])],
    props: [support('bench', [0, 0.45, 0], 0), weightIn('r')],
    working: ['arm.r'],
    perSide: true,
  },

  /* Shrug: the shoulders rise straight up toward the ears, arms hanging. */

  'dumbbell-shrug': {
    camera: { yaw: 62, pitch: 6 },
    poses: {
      down: pose(STAND, {
        clav: { elev: -6 },
        shoulder: { plane: 90, elev: 4 },
        elbow: { flex: 4 },
      }),
      top: pose(STAND, {
        clav: { elev: 36 },
        shoulder: { plane: 90, elev: 4 },
        elbow: { flex: 4 },
      }),
    },
    start: 'top',
    still: 'top',
    loop: rep('down', 'top'),
    pins: feet(),
    props: weights(),
    working: ['torso'],
    perSide: false,
  },
} satisfies Record<string, ExerciseAnimation>;
