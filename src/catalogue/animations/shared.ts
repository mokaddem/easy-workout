/**
 * Building blocks shared by every family's animations: loops, base poses, contacts and props.
 *
 * Conventions (see `src/motion/figure/pose.ts`): metres, y up, the figure faces +x with its
 * right side at +z; camera yaw 0 looks at the right side, 90 at the front. Base poses are
 * partial key poses; combine them with `pose(base, { …changes })`, later values winning joint by
 * joint and field by field.
 *
 * Habits that keep poses honest:
 * - Lean a standing figure with `spine.flex`: the root's own lean tips the legs with the pelvis.
 * - Keep a joint's `plane` the same across a loop's poses and move `elev` (negative = the other
 *   way): blending two far-apart planes swings the limb out sideways on the way.
 * - Pin what touches something (feet, palms, a hand on a thigh) so it never slides, and give
 *   contacts on a seat, a wall or a step their `at`.
 */
import type {
  AnimationPin,
  AnimationPose,
  AnimationProp,
  EquipmentKind,
  FrameName,
  LoopStep,
} from '@/domain';

type Vec3 = [number, number, number];
type Side = 'l' | 'r';

/* ------------------------------------------------------------------ */
/* Loops                                                               */
/* ------------------------------------------------------------------ */

/** The usual loop: lower to the bottom, pause, lift to the top, hold. */
export const rep = (bottom: string, top: string): LoopStep[] => [
  { to: bottom, phase: 'eccentric' },
  { to: bottom, phase: 'pause' },
  { to: top, phase: 'concentric' },
  { to: top, phase: 'hold' },
];

/**
 * A timed hold: the body settles a little (`settle`), stays, then braces back (`brace`) and
 * stays. The figure keeps breathing without leaving the position.
 */
export const hold = (settle: string, brace: string): LoopStep[] => rep(settle, brace);

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

type Joint = Record<string, number | Vec3 | undefined>;

/** Merge key poses joint by joint: later fields win (a list, such as `straight`, is replaced). */
export function pose(...parts: AnimationPose[]): AnimationPose {
  const out: Record<string, Joint | string[]> = {};
  for (const part of parts)
    for (const [key, value] of Object.entries(part) as [string, Joint | string[] | undefined][])
      if (Array.isArray(value)) out[key] = [...value];
      else if (value) out[key] = { ...(out[key] as Joint | undefined), ...value };
  return out as AnimationPose;
}

/** Arms held straight in a pose (a lockout, a support): checked on the solved pose. */
export const ARMS_STRAIGHT: AnimationPose = { straight: ['arm.l', 'arm.r'] };

/** Standing tall, feet under the hips, knees soft, arms hanging. */
export const STAND: AnimationPose = {
  root: { pos: [0, 0.918, 0] },
  hip: { plane: 0, elev: 3 },
  knee: { flex: 4 },
  elbow: { flex: 8 },
};

/**
 * Staggered stance, left foot ahead: for presses and pulls against a band where the body braces
 * forward or back. Root height suits the knees' soft bend.
 */
export const SPLIT_STANCE: AnimationPose = {
  root: { pos: [0, 0.885, 0] },
  'hip.l': { plane: 90, elev: 16 },
  'hip.r': { plane: -90, elev: 14 },
  'knee.l': { flex: 14 },
  'knee.r': { flex: 6 },
  'ankle.l': { flex: 2 },
  'ankle.r': { flex: -4 },
};

/**
 * Hinged forward from the hips with a flat back: the base of kickbacks, bent-over rows and
 * Romanian deadlifts. `lean` is the torso's angle from upright. The hips sit back, about 12 cm
 * behind the heels, over near-vertical shins with the knees soft (28°); the neck stays in line
 * with the back, so the gaze lands on the floor about a metre ahead. The pelvis stays at x = -0.12
 * and its height is set so the feet stand flat on the floor.
 */
export const hinge = (lean = 55): AnimationPose => {
  const thigh = 26; // the thigh's tilt forward of vertical
  const knee = 28; // knee bend: the shin ends up near vertical, a touch forward
  const d = Math.PI / 180;
  // Hip joints sit 2 cm below the pelvis; thigh 0.42 m, shin 0.41 m, ankle 0.075 m off the floor.
  const height =
    0.075 +
    0.41 * Math.cos((thigh - knee) * d) +
    0.42 * Math.cos(thigh * d) +
    0.02 * Math.cos(lean * d);
  return {
    root: { pos: [-0.12, height - 0.001, 0], lean },
    spine: { flex: -4 },
    neck: { flex: 2 },
    hip: { plane: 90, elev: lean + thigh },
    knee: { flex: knee },
    ankle: { flex: knee - thigh },
  };
};

/**
 * A rigid plank from the toes (or the knees) to the head, `lean` degrees from upright (90: level,
 * face down; more: head lower than the feet). The base of push-ups and planks; pair with
 * `onToes()` and `palms()`.
 */
export const plank = (lean: number, extra: AnimationPose = {}): AnimationPose =>
  pose(
    {
      root: { lean },
      neck: { flex: -6 },
      hip: { plane: 90, elev: 0 },
      knee: { flex: 0 },
      ankle: { flex: -8 },
    },
    extra,
  );

/**
 * Seated upright on a support whose top is `height` high (a chair seat or a bench, 0.45 m),
 * thighs level, shins vertical, feet flat: pair with `feet()`.
 */
export const seated = (height = 0.45): AnimationPose => ({
  root: { pos: [0, height + 0.098, 0] },
  hip: { plane: 92, elev: 90, rot: -6 },
  knee: { flex: 88 },
});

/**
 * Lying on the back, head toward -x, hips at x = 0: on the floor (`height` 0, knees bent, feet
 * flat) or on a bench top (hips near its front end, shins down to the floor). Pair with
 * `feet()`; hip angles stay in the forward plane (negative elevation = extended), so blends
 * with other poses never swing the legs sideways.
 */
export const supine = (height = 0): AnimationPose =>
  height > 0
    ? {
        root: { pos: [0, height + 0.096, 0], lean: -90 },
        neck: { flex: 6 },
        hip: { plane: 90, elev: -6, rot: -8 },
        knee: { flex: 96 },
        ankle: { flex: 4 },
      }
    : {
        root: { pos: [0, 0.098, 0], lean: -90 },
        neck: { flex: 10 },
        hip: { plane: 90, elev: 50, rot: -6 },
        knee: { flex: 104 },
      };

/**
 * Lying back on a bench inclined `incline` degrees, sitting on its seat (`height` high, seat
 * middle at x = 0) facing +x, thighs level, shins down to the floor. Pair with `feet()`.
 */
export const reclined = (incline: number, height = 0.45): AnimationPose => ({
  root: { pos: [-0.02, height + 0.1, 0], lean: incline - 90 },
  neck: { flex: 8 },
  hip: { plane: 90, elev: incline, rot: -6 },
  knee: { flex: 92 },
});

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

/** The body pivots on the toes, resting on the floor or on a surface at `at` (a chair seat). */
export const onToes = (at: Vec3 = [0, 0, 0]): AnimationPin => ({
  contact: 'toes',
  mode: 'anchor',
  at,
});

/** Both feet held where they stand (on the floor under the start pose). */
export const feet = (): AnimationPin[] => [
  { contact: 'foot.l', mode: 'plant' },
  { contact: 'foot.r', mode: 'plant' },
];

/**
 * Both palms flat on a surface, `width` apart (centre to centre of the wrists), at `x` (and
 * `height`, for a seat or a step). `elbows` is the way the elbows travel, in the chest's axes
 * (x forward, y toward the head, z out to the side): the default sends them back and out at
 * about 45° from the body, as in a push-up.
 */
export const palms = ({
  x,
  width,
  height = 0,
  elbows = [-0.55, -0.62, 0.56],
  normal,
}: {
  x: number;
  width: number;
  height?: number;
  elbows?: Vec3;
  normal?: Vec3;
}): AnimationPin[] =>
  (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    at: [x, height, (S === 'l' ? -width : width) / 2],
    ...(normal ? { normal } : {}),
    pole: { frame: 'chest', dir: elbows },
  }));

/** A hand on a point of a body segment: hands on the hips, on a knee, a grip at the chest. */
export const handOn = (side: Side, frame: FrameName, at: Vec3, elbow?: Vec3): AnimationPin => ({
  contact: `hand.${side}`,
  mode: 'grip',
  frame,
  at,
  ...(elbow ? { pole: { frame: 'chest', dir: elbow } } : {}),
});

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

/** Where a hand holds a handle, in its wrist frame. */
export const GRIP: Vec3 = [0, -0.045, 0];

/**
 * A weight in one hand, its handle through the fist. `axis` is the handle's direction in the
 * wrist frame ([1, 0, 0]: thumb to little finger, the usual grip). `bell` places a kettlebell's
 * bell when one is drawn instead (see the prop schema).
 */
export const weightIn = (
  side: Side,
  {
    axis = [1, 0, 0],
    bell,
    kind = 'dumbbell',
  }: { axis?: Vec3; bell?: 'back' | 'out' | 'down'; kind?: 'dumbbell' | 'kettlebell' } = {},
): AnimationProp => ({
  kind,
  id: `db.${side}`,
  group: `db.${side}`,
  frame: `wrist.${side}`,
  at: GRIP,
  axis,
  ...(bell ? { bell } : {}),
});

/** A weight in each hand. */
export const weights = (opts: Parameters<typeof weightIn>[1] = {}): AnimationProp[] => [
  weightIn('l', opts),
  weightIn('r', opts),
];

/**
 * A chair, bench or table: `at` is the middle of its seat area (y = its height; the front edge is
 * 0.2 m ahead of it), `facing` the way its front looks (degrees, 0 = +x). The figure draws the one
 * in use at the same spot. A chair or bench seat is 0.45 m high.
 */
export const support = (
  kind: Extract<EquipmentKind, 'chair' | 'bench' | 'table'>,
  at: Vec3,
  facing: number,
  incline?: number,
  /** Needed when two stand in one picture (a chair under each hand). */
  id: string = kind,
): AnimationProp => ({
  kind,
  id,
  at,
  facing,
  ...(incline !== undefined ? { incline } : {}),
});

/** A wall whose surface passes through `at`, facing `normal` (into the room). */
export const wall = (at: Vec3, normal: Vec3): AnimationProp => ({
  kind: 'wall',
  id: 'wall',
  at,
  normal,
});

/** A point fixed in the room ([x, y, z]) or carried by a body segment. */
export type PropPoint = Vec3 | { frame: FrameName; at: Vec3 };

/**
 * A band from a fixed point (a door anchor) or a body point (under a foot) to each hand's grip.
 * `from` is one point for both hands, or a pair: the left hand's start, then the right's.
 */
export const bandTo = (
  from: PropPoint | [PropPoint, PropPoint],
  hands: Side[] = ['l', 'r'],
): AnimationProp[] =>
  hands.map((S) => {
    const start = Array.isArray(from) && from.length === 2 ? from[S === 'l' ? 0 : 1] : from;
    return {
      kind: 'band',
      id: `band.${S}`,
      group: `band.${S}`,
      from: start as PropPoint,
      to: { frame: `wrist.${S}`, at: GRIP },
    };
  });

/** Under the sole of a planted foot, on the floor: where a band is stood on. */
export const underFoot = (side: Side): { frame: FrameName; at: Vec3 } => ({
  frame: `ankle.${side}`,
  at: [0.05, -0.06, 0],
});

/**
 * A door seen edge on, its face at `x` toward the figure; the door's thickness lies toward
 * `away` (+1: the figure faces it, -1: it stands behind the figure). For a band anchored in it.
 */
export const doorEdgeOn = (x: number, away: 1 | -1): AnimationProp => ({
  kind: 'box',
  id: 'door',
  group: 'door',
  equipment: 'door',
  min: [away > 0 ? x : x - 0.04, 0, -0.42],
  max: [away > 0 ? x + 0.04 : x, 2.03, 0.42],
});

/** Parallel bars along x, `width` apart, centred on `at` (y: the bars' height, about 1 m). */
export const dipBars = (at: Vec3, width = 0.5): AnimationProp => ({
  kind: 'dip-bars',
  id: 'bars',
  at,
  width,
});

/**
 * A door seen face on from a side camera, its latch edge at `x` (it reaches back toward -x when
 * `toward` is -1), standing `z` behind the figure: the scenery for a door anchor at the side.
 */
export const doorFaceOn = (x: number, z = -0.45, toward: 1 | -1 = -1): AnimationProp => ({
  kind: 'box',
  id: 'door',
  group: 'door',
  equipment: 'door',
  min: [toward < 0 ? x - 0.82 : x, 0, z - 0.02],
  max: [toward < 0 ? x : x + 0.82, 2.03, z + 0.02],
});

/* ------------------------------------------------------------------ */
/* Bars, tables, straps and kneeling or prone bases                    */
/* ------------------------------------------------------------------ */

/**
 * A pull-up bar across a door frame in the plane x = 0: two jambs and a header (door scenery) and
 * the bar itself, `barY` high, `half` wide each side.
 */
export const doorwayBar = (half = 0.46, barY = 2.0): AnimationProp[] => [
  {
    kind: 'box',
    id: 'jamb.l',
    group: 'door',
    min: [-0.035, 0, -half - 0.05],
    max: [0.035, barY + 0.1, -half],
  },
  {
    kind: 'box',
    id: 'jamb.r',
    group: 'door',
    min: [-0.035, 0, half],
    max: [0.035, barY + 0.1, half + 0.05],
  },
  {
    kind: 'box',
    id: 'header',
    group: 'door',
    min: [-0.035, barY + 0.06, -half],
    max: [0.035, barY + 0.1, half],
  },
  {
    kind: 'capsule',
    id: 'bar',
    group: 'handle',
    equipment: 'pull-up-bar',
    a: [0, barY, -half],
    b: [0, barY, half],
    r: 0.016,
  },
];

/**
 * Both hands on a bar at x = 0, `barY` high, `width` apart: palms against its front, fingers up,
 * elbows pointing `elbows` (chest axes); `poles` sets one side's elbow apart. For a fist closed
 * around a bar, a plant with `rest: 'grip'` is the other way.
 */
export const onBar = (
  width: number,
  elbows: Vec3 = [-0.3, -1, 0.35],
  barY = 2.0,
  poles: { l?: Vec3; r?: Vec3 } = {},
): AnimationPin[] =>
  (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    at: [0.033, barY - 0.045, (S === 'l' ? -width : width) / 2],
    normal: [-1, 0, 0],
    pole: { frame: 'chest', dir: poles[S] ?? elbows },
  }));

/**
 * Hanging by the hands with the shoulders at `shoulder` ([x, height]) and the torso `lean`
 * degrees from upright (negative: leaning back); the legs bent behind.
 */
export const hung = (
  shoulder: [number, number],
  lean: number,
  extra: AnimationPose = {},
): AnimationPose => {
  const a = (lean * Math.PI) / 180;
  return pose(
    {
      root: { pos: [shoulder[0] - 0.42 * Math.sin(a), shoulder[1] - 0.42 * Math.cos(a), 0], lean },
      hip: { plane: 90, elev: -6 },
      knee: { flex: 76 },
      ankle: { flex: -22 },
    },
    extra,
  );
};

/** Both hands over the edge of a table whose front edge is at `x`, `y` high: fingers up. */
export const tableEdge = (x: number, y: number, width = 0.46): AnimationPin[] =>
  (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    at: [x + 0.033, y, (S === 'l' ? -width : width) / 2],
    normal: [-1, 0, 0],
    pole: { frame: 'chest', dir: [-0.9, -0.9, 0.25] },
  }));

/** Hands held by straps of `length` from an anchor overhead: the straps stay taut. */
export const strapped = (
  anchor: Vec3,
  length: number,
  sides: Side[] = ['l', 'r'],
): AnimationPin[] =>
  sides.map((S) => ({
    contact: `hand.${S}`,
    mode: 'tether',
    anchor: [anchor[0], anchor[1], anchor[2] + (S === 'l' ? -0.02 : 0.02)],
    length,
  }));

/**
 * Feet side by side at x = 0 (`half` either side of the middle), on the floor or on a seat
 * `height` high; the body pivots on them.
 */
export const feetAt = (height = 0, half = 0.09): AnimationPin[] => [
  { contact: 'feet', mode: 'anchor', at: [0, height, 0] },
  { contact: 'foot.l', mode: 'plant', at: [0, height, -half] },
  { contact: 'foot.r', mode: 'plant', at: [0, height, half] },
];

/** A dumbbell lying on the floor (under a planted hand), its handle along x at `x`, `z` across. */
export const floorDumbbell = (side: Side, x: number, z: number): AnimationProp[] => [
  {
    kind: 'capsule',
    id: `db.${side}/h`,
    group: `db.${side}`,
    equipment: 'dumbbell',
    a: [x - 0.065, 0.045, z],
    b: [x + 0.065, 0.045, z],
    r: 0.016,
  },
  {
    kind: 'capsule',
    id: `db.${side}/1`,
    group: `db.${side}`,
    equipment: 'dumbbell',
    a: [x + 0.065, 0.045, z],
    b: [x + 0.105, 0.045, z],
    r: 0.045,
  },
  {
    kind: 'capsule',
    id: `db.${side}/2`,
    group: `db.${side}`,
    equipment: 'dumbbell',
    a: [x - 0.065, 0.045, z],
    b: [x - 0.105, 0.045, z],
    r: 0.045,
  },
];

/** Kneeling tall on the floor, thighs vertical, shins behind: pair with a `knees` anchor. */
export const KNEEL: AnimationPose = {
  hip: { plane: 90, elev: 0 },
  knee: { flex: 90 },
  ankle: { flex: -70 },
};

/** Lying face down, head toward +x, arms to be placed: pair with nothing; the floor holds it. */
export const PRONE: AnimationPose = {
  root: { pos: [0, 0.153, 0], lean: 90 },
  neck: { flex: -12 },
  hip: { plane: 90, elev: 0 },
  knee: { flex: 0 },
  ankle: { flex: -35 },
};

/* ------------------------------------------------------------------ */
/* Legs in the vertical plane: a small solver                          */
/* ------------------------------------------------------------------ */

/** A point in the vertical plane: [x forward, y up]. */
export type PlanePoint = [number, number];

const THIGH = 0.42;
const SHIN = 0.41;
/** Ankle height with the foot flat on the floor. */
export const ANKLE_HEIGHT = 0.075;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const rnd = (x: number) => Math.round(x * 10) / 10;
const rnd3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * One leg in the vertical plane: the joint angles that put the ankle at `ankle` with the hip at
 * `hip` (the knee always forward of the line between them), the trunk leaning `lean` degrees.
 * `foot` is the foot's own pitch (0 flat, positive toes up); `rot` turns the leg out (negative)
 * or in.
 */
export function leg(
  S: Side,
  hip: PlanePoint,
  ankle: PlanePoint,
  lean: number,
  { foot = 0, rot = 0, plane = 90 }: { foot?: number; rot?: number; plane?: number } = {},
): AnimationPose {
  const dx = ankle[0] - hip[0];
  const dy = ankle[1] - hip[1];
  const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.002);
  const beta = deg(Math.atan2(dx, -dy));
  const alpha = deg(Math.acos((THIGH ** 2 + d ** 2 - SHIN ** 2) / (2 * THIGH * d)));
  const gamma = deg(Math.acos((THIGH ** 2 + SHIN ** 2 - d ** 2) / (2 * THIGH * SHIN)));
  const absElev = beta + alpha;
  const flex = 180 - gamma;
  return {
    [`hip.${S}`]: { plane, elev: rnd(absElev + lean), rot },
    [`knee.${S}`]: { flex: rnd(flex) },
    [`ankle.${S}`]: { flex: rnd(foot - absElev + flex) },
  } as AnimationPose;
}

/** Where a leg ends up for `body()`: the ankle's spot, the foot's pitch, the leg's turn. */
export interface Foot {
  ankle: PlanePoint;
  foot?: number;
  rot?: number;
  plane?: number;
  /** The ankle is given from the hip instead of from the floor's origin. */
  rel?: boolean;
}

/**
 * The pelvis with its hip joints at `hip` (the point halfway between them, in the vertical plane),
 * the trunk leaning `lean` from upright, and each leg reaching its `Foot`.
 */
export function body(
  hip: PlanePoint,
  lean: number,
  legs: Partial<Record<Side, Foot>>,
  extra: AnimationPose = {},
): AnimationPose {
  const L = rad(lean);
  const parts: AnimationPose[] = [
    {
      root: {
        pos: [rnd3(hip[0] + 0.02 * Math.sin(L)), rnd3(hip[1] + 0.02 * Math.cos(L)), 0],
        lean,
      },
    },
  ];
  for (const S of ['l', 'r'] as const) {
    const f = legs[S];
    if (!f) continue;
    const ankle: PlanePoint = f.rel ? [hip[0] + f.ankle[0], hip[1] + f.ankle[1]] : f.ankle;
    parts.push(leg(S, hip, ankle, lean, f));
  }
  return pose(...parts, extra);
}

/**
 * A foot on its toes (the ball of the foot at `toeX`), heel up: the ankle sits where the foot
 * pivots about the toes.
 */
export const toesAt = (toeX: number, rot = 0): Foot => ({
  ankle: [rnd3(toeX - 0.1), 0.162],
  foot: -30,
  rot,
});

/**
 * Up on the ball of the foot (the toe at x = `toeX`) on a surface `surface` high: the foot pitched
 * `psi` degrees (negative: heel raised). The ankle sits where the foot pivots about the toe.
 */
export function ball(psi: number, surface = 0, toeX = 0.145): Foot {
  const phi = rad(-psi);
  const dx = 0.145 * Math.cos(phi) - 0.05 * Math.sin(phi);
  const dy = -0.145 * Math.sin(phi) - 0.05 * Math.cos(phi);
  return { ankle: [rnd3(toeX - dx), rnd3(surface + 0.033 - dy)], foot: psi, rot: 0 };
}

/**
 * On the back with the upper back as the pivot (shoulders at x = `sx`): the hips at `alpha` degrees
 * above level, so the trunk rises from the shoulders to the hips. Returns `[hip, lean, legs]`, the
 * arguments of `body()`.
 */
export function bridgeAt(
  alpha: number,
  legs: Partial<Record<Side, Foot>>,
  sx = -0.36,
): [PlanePoint, number, Partial<Record<Side, Foot>>] {
  const a = rad(alpha);
  return [[rnd3(sx + 0.4 * Math.cos(a)), rnd3(0.125 + 0.4 * Math.sin(a))], -(90 + alpha), legs];
}

/**
 * Both arms swung to `abs` degrees from hanging (positive forward) and brought together toward
 * the midline, for two hands on one handle, whatever the trunk's `lean`.
 */
export function armsTogether(abs: number, lean: number): AnimationPose {
  const phi = rad(abs + lean);
  const v: Vec3 = [Math.sin(phi), -Math.cos(phi), -0.27];
  const e = deg(Math.acos(-v[1] / Math.hypot(...v)));
  const plane = deg(Math.atan2(v[0], v[2]));
  return { shoulder: { plane: rnd(plane), elev: rnd(e), rot: 0 }, elbow: { flex: 6 } };
}

/**
 * One leg from absolute angles (degrees from hanging, forward positive, in the vertical plane)
 * for a trunk leaning `lean` (default 69°: on all fours): the thigh at `thigh`, the knee bent
 * `flex`, the foot pitched `foot`.
 */
export function legAbs(
  S: Side,
  thigh: number,
  flex: number,
  foot: number,
  lean = 69,
): AnimationPose {
  return {
    [`hip.${S}`]: { plane: 90, elev: rnd(thigh + lean), rot: 0 },
    [`knee.${S}`]: { flex },
    [`ankle.${S}`]: { flex: rnd(foot - thigh + flex) },
  } as AnimationPose;
}

/* ------------------------------------------------------------------ */
/* Loops through many keys                                             */
/* ------------------------------------------------------------------ */

/**
 * Key names `<name><from>` to `<name><to>`, counting up or down (`keys('c', 0, 3)`: c0, c1, c2, c3),
 * for loops sampled around a circle or along a path.
 */
export const keys = (name: string, from: number, to: number): string[] => {
  const out: string[] = [];
  const step = from <= to ? 1 : -1;
  for (let i = from; i !== to + step; i += step) out.push(`${name}${i}`);
  return out;
};

/** One loop step to each of `names`, all in one phase (which shares its time between them). */
export const through = (names: string[], phase: LoopStep['phase']): LoopStep[] =>
  names.map((to) => ({ to, phase }));

/* ------------------------------------------------------------------ */
/* Limbs aimed by direction, arms by absolute angles                   */
/* ------------------------------------------------------------------ */

/**
 * Shoulder or hip angles that point a hanging limb along `[forward, up, out]` (out: away from the
 * body on that limb's own side, so the same numbers serve both sides). `near` keeps `plane`
 * on the branch closest to that angle, so a path never swings the long way round.
 */
export function aim(dir: Vec3, near?: number): { plane: number; elev: number } {
  const [f, u, l] = dir;
  const n = Math.hypot(f, u, l);
  const elev = deg(Math.acos(Math.max(-1, Math.min(1, -u / n))));
  let plane = Math.hypot(f, l) < 1e-6 ? (near ?? 0) : deg(Math.atan2(f, l));
  if (near !== undefined) {
    while (plane - near > 180) plane -= 360;
    while (plane - near < -180) plane += 360;
  }
  return { plane: rnd(plane), elev: rnd(elev) };
}

/**
 * Both arms in the vertical plane from absolute angles: degrees from hanging, forward positive
 * (90 = level ahead, 180 = straight up); the forearm at `f`. `lean` is the chest's own pitch (root
 * lean plus spine and chest flex).
 */
export const arms = (u: number, f: number = u, lean = 0): AnimationPose => ({
  shoulder: { plane: 90, elev: rnd(u + lean), rot: 0 },
  elbow: { flex: rnd(Math.max(f - u, 6)) },
});

/* ------------------------------------------------------------------ */
/* The trunk in the vertical plane, hanging and supports               */
/* ------------------------------------------------------------------ */

/**
 * Where the trunk's points land when the hip joints are at `hip` and the trunk leans `lean`, with
 * the spine flexed `sp` and the chest `ch` more: the root (pelvis), the top of the spine (`chest`),
 * the neck, the shoulder joints, and the chest's own pitch (`chestLean`).
 */
export function trunk(hip: PlanePoint, lean: number, sp = 0, ch = 0) {
  const u = (l: number): PlanePoint => [Math.sin(rad(l)), Math.cos(rad(l))];
  const f = (l: number): PlanePoint => [Math.cos(rad(l)), -Math.sin(rad(l))];
  const root: PlanePoint = [hip[0] + 0.02 * u(lean)[0], hip[1] + 0.02 * u(lean)[1]];
  const l1 = lean + sp;
  const l2 = l1 + ch;
  const chest: PlanePoint = [root[0] + 0.19 * u(l1)[0], root[1] + 0.19 * u(l1)[1]];
  const neck: PlanePoint = [chest[0] + 0.26 * u(l2)[0], chest[1] + 0.26 * u(l2)[1]];
  const shoulder: PlanePoint = [
    neck[0] - 0.005 * f(l2)[0] - 0.035 * u(l2)[0],
    neck[1] - 0.005 * f(l2)[1] - 0.035 * u(l2)[1],
  ];
  return { root, chest, neck, shoulder, chestLean: l2 };
}

/**
 * The pelvis placed so the shoulders land at `shoulder` with the trunk leaning `lean` and the spine
 * and chest curling `sp` and `ch` degrees more: hanging from a bar, supported on bars or seats.
 */
export function hangFrom(shoulder: PlanePoint, lean: number, sp = 0, ch = 0): AnimationPose {
  const t = trunk([0, 0], lean, sp, ch);
  return {
    root: {
      pos: [
        rnd3(shoulder[0] - t.shoulder[0] + t.root[0]),
        rnd3(shoulder[1] - t.shoulder[1] + t.root[1]),
        0,
      ],
      lean,
    },
    spine: { flex: sp },
    chest: { flex: ch },
  };
}

/**
 * The hips between the shoulders and the ankles: the upper crossing of a circle of radius
 * `trunkLen` round the shoulder and one of radius `legLen` round the ankle.
 */
export function hipBetween(
  shoulder: PlanePoint,
  ankle: PlanePoint,
  trunkLen: number,
  legLen: number,
): PlanePoint {
  const dx = ankle[0] - shoulder[0];
  const dy = ankle[1] - shoulder[1];
  const d = Math.hypot(dx, dy);
  const a = (trunkLen ** 2 - legLen ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, trunkLen ** 2 - a ** 2));
  const mx = shoulder[0] + (a * dx) / d;
  const my = shoulder[1] + (a * dy) / d;
  const c1: PlanePoint = [mx + (h * dy) / d, my - (h * dx) / d];
  const c2: PlanePoint = [mx - (h * dy) / d, my + (h * dx) / d];
  return c1[1] > c2[1] ? c1 : c2;
}

/** Palms flat on bars or chair seats `height` high, the elbows pointing straight back: dips, supports. */
export const dipHands = (height: number): AnimationPin[] =>
  palms({ x: 0.02, width: 0.5, height, elbows: [-1, 0, 0.1] });

/** L-sit: the trunk upright, shoulders pushed down, the straight legs `thigh` degrees from hanging. */
export const lSit = (shoulder: PlanePoint, thigh: number): AnimationPose =>
  pose(
    hangFrom(shoulder, 4),
    { clav: { elev: -10 } },
    legAbs('l', thigh, 4, -10, 4),
    legAbs('r', thigh, 4, -10, 4),
    { straight: ['arm.l', 'arm.r', 'leg.l', 'leg.r'] },
  );

/**
 * Lying on the right side, head toward +z, the body in one line: `tilt` is the roll about the x
 * axis (90: level), `y` the pelvis height. The legs hang straight along the body. The base of side
 * planks.
 */
export const sidePlank = (tilt: number, y: number, extra: AnimationPose = {}): AnimationPose =>
  pose(
    {
      root: { pos: [0, y, 0], lean: 0, tilt },
      neck: { flex: 0 },
      hip: { plane: 90, elev: 0 },
      knee: { flex: 0 },
    },
    extra,
  );

/* ------------------------------------------------------------------ */
/* More contacts                                                       */
/* ------------------------------------------------------------------ */

/**
 * Both wrists on the floor `x` ahead, the elbows (an upper arm's length under the shoulders) kept
 * `width` apart: forearm planks with the hands placed. For forearms lying flat with the elbows
 * under the shoulders, see `onForearms`.
 */
export const forearms = (x: number, width = 0.34): AnimationPin[] =>
  (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    at: [x, 0, (S === 'l' ? -width : width) / 2],
    pole: { frame: 'chest', dir: [0.55, -0.6, 0] },
  }));

/**
 * Both forearms flat on the floor, pointing the way the body faces: the elbows under the
 * shoulders, or at `x` and `width` apart when given. The shoulders must sit an upper arm's length
 * (0.28 m) over the elbows' spots.
 */
export const onForearms = (x?: number, width = 0.34): AnimationPin[] =>
  (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    rest: 'forearm',
    ...(x === undefined ? {} : { at: [x, 0, (S === 'l' ? -width : width) / 2] as Vec3 }),
  }));

/** A hand flat on a wall `at` its spot, `normal` pointing into the room, the elbow toward `elbow` (chest axes). */
export const handOnWall = (
  at: Vec3,
  normal: Vec3,
  elbow: Vec3,
  side: Side = 'l',
): AnimationPin => ({
  contact: `hand.${side}`,
  mode: 'plant',
  at,
  normal,
  pole: { frame: 'chest', dir: elbow },
});

/**
 * The same pins, holding only during loop `steps` (indices into the loop): a hand that leaves the
 * floor and comes back, a foot that steps.
 */
export const during = (steps: number[], pins: AnimationPin[]): AnimationPin[] =>
  pins.map((p) => (p.mode === 'tether' ? p : { ...p, steps }));
