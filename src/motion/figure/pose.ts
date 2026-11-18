/**
 * Skeleton, forward kinematics, two-bone IK, contacts, key-pose interpolation and the tempo
 * timeline. Pure TypeScript: `parts.ts` turns the solved frames into what the renderer draws.
 *
 * World: metres, y up, the figure faces +x and its right side is +z.
 * Angles in animation data are degrees.
 *
 * Joint angles (per side when the joint has one; one value applies to both sides,
 * `name.l` / `name.r` overrides one side):
 *   root     { pos: [x, y, z], lean, turn, tilt }  lean > 0 = pitched forward
 *   spine, chest { flex, bend, twist }              flex > 0 = bent forward
 *   neck, head   { flex }                           flex > 0 = chin down
 *   clav     { elev, prot }                         prot < 0 = shoulder blades squeezed
 *   shoulder, hip { plane, elev, rot }  elevation `elev` away from hanging, in the plane
 *            `plane` (0 = out to the side, 90 = forward, -90 = backward); rot > 0 = internal
 *   elbow    { flex, pron }   knee { flex }   (hinges: flex is clamped to 0..150, never backwards)
 *   wrist    { flex, dev }    ankle { flex }  (ankle flex > 0 = toes up)
 */
import type {
  Contact,
  ExerciseAnimation,
  FrameName,
  LoopPhase,
  AnimationPin,
  AnimationPose as PoseData,
} from '@/domain';

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* Linear algebra: vectors [x, y, z], rotations as row-major 3x3 arrays */
/* ------------------------------------------------------------------ */

export type Vec3 = [number, number, number];
export type Mat = [number, number, number, number, number, number, number, number, number];
export type Side = 'l' | 'r';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const I3: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul(a: Mat, b: Mat): Mat {
  const r: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
  return r as Mat;
}
export const apply = (m: Mat, p: Vec3): Vec3 => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
  m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
  m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
];
const transpose = (m: Mat): Mat => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** Column i of a rotation: the local axis i in world space. */
export const axis = (m: Mat, i: 0 | 1 | 2): Vec3 => [m[i], m[3 + i], m[6 + i]] as Vec3;
export const fromAxes = (x: Vec3, y: Vec3, z: Vec3): Mat => [
  x[0],
  y[0],
  z[0],
  x[1],
  y[1],
  z[1],
  x[2],
  y[2],
  z[2],
];
function rotAxis(a: Vec3, rad: number): Mat {
  const [x, y, z] = norm(a);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}
const rotX = (deg: number) => rotAxis([1, 0, 0], deg * DEG);
const rotY = (deg: number) => rotAxis([0, 1, 0], deg * DEG);
const rotZ = (deg: number) => rotAxis([0, 0, 1], deg * DEG);

export interface Frame {
  o: Vec3;
  m: Mat;
}
export type Frames = Record<FrameName, Frame>;
/** A point given in a frame's own axes, in world space. */
export const at = (f: Frame, p: Vec3): Vec3 => add(f.o, apply(f.m, p));

/** A frame name from a joint and a side. */
type Sided = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';
const sided = (name: Sided, S: Side): `${Sided}.${Side}` => `${name}.${S}`;

/* ------------------------------------------------------------------ */
/* Skeleton: fixed proportions (one gender-neutral, slightly athletic)  */
/* ------------------------------------------------------------------ */

export const BODY = {
  pelvis: 0.925, // root height when standing
  hip: [0, -0.02, 0.085] as Vec3,
  thigh: 0.42,
  shin: 0.41,
  ankle: 0.075, // ankle height with the foot flat
  knee: 0.052, // knee joint height when kneeling
  spine: 0.19,
  chest: 0.26,
  neck: 0.085,
  clav: [-0.005, -0.035, 0.165] as Vec3,
  upperArm: 0.28,
  forearm: 0.245,
  hand: 0.06,
  wrist: 0.033, // wrist height with the palm flat on the floor
  toe: [0.145, -0.05, 0] as Vec3,
  toeR: 0.025,
  grip: [0, -0.045, 0] as Vec3, // where a hand holds a handle, in the hand frame
};

export const SIDES: [Side, number][] = [
  ['r', 1],
  ['l', -1],
];

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

type Angles = Record<string, number | undefined>;
/** A key pose ready to evaluate: angles per joint key (`hip`, `hip.l`…) and the root position. */
interface Pose {
  joints: Record<string, Angles>;
  pos?: Vec3;
}

function toPose(data: PoseData): Pose {
  const joints: Record<string, Angles> = {};
  let pos: Vec3 | undefined;
  for (const [key, value] of Object.entries(data)) {
    // `straight` declares limbs held straight; it is checked, not drawn.
    if (key === 'straight') continue;
    const angles: Angles = {};
    for (const [field, x] of Object.entries(value ?? {})) {
      if (field === 'pos') pos = x as Vec3;
      else angles[field] = x as number;
    }
    joints[key] = angles;
  }
  return pos ? { joints, pos } : { joints };
}

/** Angles of joint `name` on side `side` (`name.l` replaces the shared `name` for that side). */
function joint(pose: Pose, name: string, side?: Side): Angles {
  return (side && pose.joints[`${name}.${side}`]) || pose.joints[name] || {};
}

const DEFAULT_ROOT: Vec3 = [0, BODY.pelvis, 0];

/** Linear blend of two key poses, field by field (missing fields are 0). */
function blend(a: Pose, b: Pose, u: number): Pose {
  const joints: Record<string, Angles> = {};
  for (const k of new Set([...Object.keys(a.joints), ...Object.keys(b.joints)])) {
    // A side-specific override on one side only blends against the shared value.
    const [base = k, side] = k.split('.');
    const ja = a.joints[k] || (side ? a.joints[base] : undefined) || {};
    const jb = b.joints[k] || (side ? b.joints[base] : undefined) || {};
    const j: Angles = {};
    for (const f of new Set([...Object.keys(ja), ...Object.keys(jb)]))
      j[f] = lerp(ja[f] || 0, jb[f] || 0, u);
    joints[k] = j;
  }
  return a.pos || b.pos
    ? { joints, pos: lerp3(a.pos ?? DEFAULT_ROOT, b.pos ?? DEFAULT_ROOT, u) }
    : { joints };
}

/** Swing a hanging limb (-y) by `elev` degrees in the plane `plane`, without twisting it. */
function swing(plane: number, elev: number, s: number): Mat {
  if (!elev) return I3;
  const p = plane * DEG;
  return rotAxis([-s * Math.cos(p), 0, Math.sin(p)], elev * DEG);
}

/** Forward kinematics: world frames { o, m } of every segment. */
export function forward(pose: Pose): Frames {
  const root = joint(pose, 'root');
  const rootFrame: Frame = {
    o: pose.pos ? [...pose.pos] : [0, BODY.pelvis, 0],
    m: mul(mul(rotY(root.turn || 0), rotZ(-(root.lean || 0))), rotX(root.tilt || 0)),
  };
  const sp = joint(pose, 'spine');
  const spine: Frame = {
    o: rootFrame.o,
    m: mul(rootFrame.m, mul(mul(rotZ(-(sp.flex || 0)), rotX(sp.bend || 0)), rotY(sp.twist || 0))),
  };
  const ch = joint(pose, 'chest');
  const chest: Frame = {
    o: at(spine, [0, BODY.spine, 0]),
    m: mul(spine.m, mul(mul(rotZ(-(ch.flex || 0)), rotX(ch.bend || 0)), rotY(ch.twist || 0))),
  };
  const neck: Frame = {
    o: at(chest, [0, BODY.chest, 0]),
    m: mul(chest.m, rotZ(-(joint(pose, 'neck').flex || 0))),
  };
  const head: Frame = {
    o: at(neck, [0, BODY.neck, 0]),
    m: mul(neck.m, rotZ(-(joint(pose, 'head').flex || 0))),
  };
  const F: Partial<Frames> = { root: rootFrame, spine, chest, neck, head };

  for (const [S, s] of SIDES) {
    const cl = joint(pose, 'clav', S);
    const clav = mul(rotY(s * (cl.prot || 0)), rotX(-s * (cl.elev || 0)));
    const c = BODY.clav;
    const sh = joint(pose, 'shoulder', S);
    const shoulder: Frame = {
      o: add(neck.o, apply(chest.m, apply(clav, [c[0], c[1], s * c[2]]))),
      m: mul(chest.m, mul(swing(sh.plane || 0, sh.elev || 0, s), rotY(s * (sh.rot || 0)))),
    };
    const el = joint(pose, 'elbow', S);
    const elbow: Frame = {
      o: at(shoulder, [0, -BODY.upperArm, 0]),
      m: mul(shoulder.m, mul(rotZ(clamp(el.flex || 0, 0, 150)), rotY(s * (el.pron || 0)))),
    };
    const wr = joint(pose, 'wrist', S);
    const wrist: Frame = {
      o: at(elbow, [0, -BODY.forearm, 0]),
      m: mul(elbow.m, mul(rotZ(wr.dev || 0), rotX(s * (wr.flex || 0)))),
    };
    const h = BODY.hip;
    const hp = joint(pose, 'hip', S);
    const hip: Frame = {
      o: at(rootFrame, [h[0], h[1], s * h[2]]),
      m: mul(rootFrame.m, mul(swing(hp.plane || 0, hp.elev || 0, s), rotY(s * (hp.rot || 0)))),
    };
    const knee: Frame = {
      o: at(hip, [0, -BODY.thigh, 0]),
      m: mul(hip.m, rotZ(-clamp(joint(pose, 'knee', S).flex || 0, 0, 150))),
    };
    const ankle: Frame = {
      o: at(knee, [0, -BODY.shin, 0]),
      m: mul(knee.m, rotZ(joint(pose, 'ankle', S).flex || 0)),
    };
    F[sided('shoulder', S)] = shoulder;
    F[sided('elbow', S)] = elbow;
    F[sided('wrist', S)] = wrist;
    F[sided('hip', S)] = hip;
    F[sided('knee', S)] = knee;
    F[sided('ankle', S)] = ankle;
  }
  return F as Frames;
}

/* ------------------------------------------------------------------ */
/* Inverse kinematics                                                  */
/* ------------------------------------------------------------------ */

/**
 * Two-bone IK for one limb. The bend plane comes from the anatomical front of the
 * upper segment (knees bend forward, elbows backward), so a joint can never fold
 * the wrong way; an arm may instead take an explicit `pole` (the way the elbow points,
 * in world space), since the shoulder lets the elbow point anywhere around its axis.
 * `endM` (optional) fixes the hand / foot orientation in world space.
 * Returns how far the end missed its target (0 when reachable).
 */
function solveLimb(
  F: Frames,
  kind: 'arm' | 'leg',
  S: Side,
  target: Vec3,
  endM?: Mat,
  pole?: Vec3,
): number {
  const [up, mid, end, l1, l2, poleSign] =
    kind === 'arm'
      ? ([
          sided('shoulder', S),
          sided('elbow', S),
          sided('wrist', S),
          BODY.upperArm,
          BODY.forearm,
          -1,
        ] as const)
      : ([sided('hip', S), sided('knee', S), sided('ankle', S), BODY.thigh, BODY.shin, 1] as const);
  const A = F[up].o;
  const localEnd = mul(transpose(F[mid].m), F[end].m);
  const t = sub(target, A);
  const d = len(t);
  const u = scale(t, 1 / d);
  const dc = clamp(d, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.99995);
  let w = kind === 'arm' && pole ? pole : scale(axis(F[up].m, 0), poleSign);
  w = sub(w, scale(u, dot(w, u)));
  if (len(w) < 1e-6) w = sub(axis(F[up].m, 2), scale(u, dot(axis(F[up].m, 2), u)));
  w = norm(w);
  const ca = clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1);
  const sa = Math.sqrt(1 - ca * ca);
  const B = add(A, add(scale(u, l1 * ca), scale(w, l1 * sa)));
  const C = add(A, scale(u, dc));
  // Upper segment: y runs back up the bone, x faces the side the joint folds toward.
  const y1 = norm(sub(A, B));
  let x1 = scale(w, poleSign);
  x1 = norm(sub(x1, scale(y1, dot(x1, y1))));
  const z1 = cross(x1, y1);
  F[up] = { o: A, m: fromAxes(x1, y1, z1) };
  const y2 = norm(sub(B, C));
  const x2 = cross(y2, z1);
  F[mid] = { o: B, m: fromAxes(x2, y2, z1) };
  F[end] = { o: C, m: endM || mul(F[mid].m, localEnd) };
  return Math.max(0, d - dc);
}

/** Translate every frame. */
function shift(F: Frames, by: Vec3): void {
  for (const k of Object.keys(F) as FrameName[]) F[k] = { o: add(F[k].o, by), m: F[k].m };
}

/** Raise or lower the body so the leg on a planted foot is straight (a lunge's trailing leg). */
function rideOn(F: Frames, S: Side, spot: Vec3): void {
  const hip = F[sided('hip', S)].o;
  const L = (BODY.thigh + BODY.shin) * 0.9995;
  const h2 = L * L - (hip[0] - spot[0]) ** 2 - (hip[2] - spot[2]) ** 2;
  if (h2 > 0) shift(F, [0, spot[1] + Math.sqrt(h2) - hip[1], 0]);
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

type SidedContact = Extract<Contact, 'foot.l' | 'foot.r' | 'hand.l' | 'hand.r'>;
type Rest = 'flat' | 'grip' | 'toes' | 'heel' | 'forearm';
const sideOf = (contact: SidedContact): Side => (contact.endsWith('.l') ? 'l' : 'r');
const isFoot = (c: Contact): c is 'foot.l' | 'foot.r' => c.startsWith('foot.');
const UP: Vec3 = [0, 1, 0];

/** World position of a contact in the current frames. */
function contactPoint(F: Frames, c: Contact): Vec3 {
  if (c === 'toes') return scale(add(at(F['ankle.l'], BODY.toe), at(F['ankle.r'], BODY.toe)), 0.5);
  if (c === 'feet') return scale(add(F['ankle.l'].o, F['ankle.r'].o), 0.5);
  if (c === 'knees') return scale(add(F['knee.l'].o, F['knee.r'].o), 0.5);
  if (c === 'knee.l' || c === 'knee.r') return F[c].o;
  if (isFoot(c)) return F[sided('ankle', sideOf(c))].o;
  return F[sided('wrist', sideOf(c))].o;
}
/** How far the contact's joint sits from the surface it rests on. */
const groundHeight = (c: Contact): number =>
  c === 'toes'
    ? BODY.toeR
    : c === 'knees' || c === 'knee.l' || c === 'knee.r'
      ? BODY.knee
      : c === 'feet' || isFoot(c)
        ? BODY.ankle
        : BODY.wrist;

/** Height of the elbow joint over a surface the forearm lies on. */
const ELBOW_REST = 0.04;

/** Heading (horizontal unit vector) of a foot; for a hand, the way the body faces (or points, when prone). */
function heading(F: Frames, c: Contact): Vec3 {
  let f = isFoot(c) ? axis(F[sided('ankle', sideOf(c))].m, 0) : axis(F.root.m, 0);
  if (!isFoot(c) && Math.hypot(f[0], f[2]) < 0.5) f = axis(F.root.m, 1);
  return norm([f[0], 0, f[2]]);
}

/**
 * Orientation of a sole or a palm flat on a surface facing `n`, pointing along heading h (up the
 * surface when it is a wall).
 */
function flatOrientation(c: SidedContact, h: Vec3, n: Vec3 = UP): Mat {
  const along = Math.abs(n[1]) < 0.7 ? UP : h;
  const f = norm(sub(along, scale(n, dot(along, n))));
  if (isFoot(c)) return fromAxes(f, n, cross(f, n));
  const s = sideOf(c) === 'r' ? 1 : -1;
  const y = scale(f, -1);
  const z = scale(n, s);
  return fromAxes(cross(y, z), y, z);
}

interface Spot {
  pos: Vec3;
  h: Vec3;
  /** The way the surface under the contact faces. */
  n: Vec3;
}

/**
 * For a hand or foot that does not rest flat: the point of it that touches (in the wrist or ankle
 * frame) and how far that point sits off the surface.
 */
const REST_POINT: Record<'grip' | 'toes' | 'heel', { point: Vec3; lift: number }> = {
  grip: { point: BODY.grip, lift: 0 },
  toes: { point: BODY.toe, lift: BODY.toeR },
  heel: { point: [-0.045, -0.042, 0], lift: 0.033 },
};
const endFrame = (c: SidedContact): FrameName =>
  isFoot(c) ? sided('ankle', sideOf(c)) : sided('wrist', sideOf(c));

/**
 * Where a contact rests in a given pose: on the surface point `at` when given, else on the floor
 * under where the pose puts it. A forearm rests with the elbow on the spot (under the shoulder by
 * default).
 */
function restingSpot(
  F: Frames,
  pin: {
    contact: Contact;
    at?: Vec3 | undefined;
    normal?: Vec3 | undefined;
    rest?: Rest | undefined;
  },
): Spot {
  const n = pin.normal ? norm(pin.normal) : UP;
  if (pin.rest === 'forearm') {
    const c = pin.contact as SidedContact;
    const s = F[sided('shoulder', sideOf(c))].o;
    const base: Vec3 = pin.at ? [...pin.at] : [s[0], 0, s[2]];
    return { pos: add(base, scale(n, ELBOW_REST)), h: heading(F, c), n };
  }
  if (pin.rest && pin.rest !== 'flat') {
    // The touching point itself (a fist on a bar, the tips of the toes) goes to the spot.
    const c = pin.contact as SidedContact;
    const { point, lift } = REST_POINT[pin.rest];
    const p = at(F[endFrame(c)], point);
    const base: Vec3 = pin.at ? [...pin.at] : [p[0], 0, p[2]];
    return { pos: add(base, scale(n, lift)), h: heading(F, c), n };
  }
  const p = contactPoint(F, pin.contact);
  const base: Vec3 = pin.at ? [...pin.at] : [p[0], 0, p[2]];
  return { pos: add(base, scale(n, groundHeight(pin.contact))), h: heading(F, pin.contact), n };
}

/**
 * A forearm flat on a surface from the elbow at `spot`: where the wrist goes, the hand's
 * orientation, and the elbow's way (toward the spot) for the two-bone solve.
 */
function forearmAim(F: Frames, c: SidedContact, spot: Spot) {
  const along = Math.abs(spot.n[1]) < 0.7 ? UP : spot.h;
  const f = norm(sub(along, scale(spot.n, dot(along, spot.n))));
  const drop = ELBOW_REST - BODY.wrist;
  const wrist = add(
    add(spot.pos, scale(f, Math.sqrt(BODY.forearm ** 2 - drop ** 2))),
    scale(spot.n, -drop),
  );
  const A = F[sided('shoulder', sideOf(c))].o;
  const u = norm(sub(wrist, A));
  const e = sub(spot.pos, A);
  return { wrist, orient: flatOrientation(c, f, spot.n), pole: sub(e, scale(u, dot(e, u))) };
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

/** Seconds per phase. */
export type Pace = Record<LoopPhase, number>;
export const NEUTRAL: Pace = { eccentric: 1.4, pause: 0.25, concentric: 1.1, hold: 0.6 };
/** The neutral pace of one animation: the default, with the phases the animation sets for itself. */
export const neutralPace = (anim: Pick<ExerciseAnimation, 'neutral'>): Pace => ({
  eccentric: anim.neutral?.eccentric ?? NEUTRAL.eccentric,
  pause: anim.neutral?.pause ?? NEUTRAL.pause,
  concentric: anim.neutral?.concentric ?? NEUTRAL.concentric,
  hold: anim.neutral?.hold ?? NEUTRAL.hold,
});
/** The player's tempo (down / pause / up seconds) as phase durations: the loop then matches the pacer exactly. */
export const tempoPace = (t: { down: number; pause: number; up: number }): Pace => ({
  eccentric: t.down,
  pause: t.pause,
  concentric: t.up,
  hold: 0,
});

const easeInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

type PlantPin = Extract<AnimationPin, { mode: 'plant' }>;
type AnchorPin = Extract<AnimationPin, { mode: 'anchor' }>;
type GripPin = Extract<AnimationPin, { mode: 'grip' }>;
type Seg = {
  phase: LoopPhase;
  t0: number;
  t1: number;
  parts: { step: number; u0: number; u1: number }[];
};

/** One end of an anchor's move: the anchor and the spot it holds, or the poses' own placement. */
type AnchorEnd = { pin: AnchorPin; target: Vec3 } | null;
/** What the anchor does in a step: holds, moves between two ends, or nothing. */
type AnchorStep = { hold: AnchorEnd & object } | { from: AnchorEnd; to: AnchorEnd } | null;
/** One end of a hand's or foot's move: a plant and its spot, a grip, or the pose itself (null). */
type MoveEnd = { pin: PlantPin; spot: Spot } | { pin: GripPin } | null;
/** A hand or foot travelling between pins during a step. */
interface Move {
  contact: SidedContact;
  from: MoveEnd;
  to: MoveEnd;
}

export interface Prepared {
  anim: ExerciseAnimation;
  poses: Record<string, Pose>;
  segs: Seg[];
  duration: number;
  /** The loop's reps: segment indices, each rep starting where the loop lowers again. */
  reps: number[][];
  /** Per loop step, what the anchor does. */
  anchors: AnchorStep[];
  plants: PlantPin[];
  /** Per pin (in `anim.pins` order) and loop step: whether the pin holds during that step. */
  holds: boolean[][];
  /** Per loop step, the spot every planted contact holds while the step runs. */
  held: Record<string, Spot>[];
  /** Per loop step, the hands and feet moving from one pin to the next. */
  moves: Move[][];
  /** Pose each step starts from, for interpolation. */
  fromPose: string[];
}

/**
 * Which pin holds a contact in each step, and what it does in the steps where none holds: over a
 * gap of one step it moves from the pin before to the pin after; over a longer gap it leaves in
 * the first step and arrives in the last (null: the poses carry it), and follows the poses between.
 */
function schedule(
  holder: number[],
): (
  | { hold: number }
  | { from: number | null; fromStep: number; to: number | null; toStep: number }
  | null
)[] {
  const n = holder.length;
  if (holder.every((h) => h < 0)) return holder.map(() => null);
  return holder.map((h, k) => {
    if (h >= 0) return { hold: h };
    let a = k;
    while (holder[(a - 1 + n) % n]! < 0) a = (a - 1 + n) % n;
    let b = k;
    while (holder[(b + 1) % n]! < 0) b = (b + 1) % n;
    const fromStep = (a - 1 + n) % n;
    const toStep = (b + 1) % n;
    const from = holder[fromStep]!;
    const to = holder[toStep]!;
    if (a === b) return { from, fromStep, to, toStep };
    if (k === a) return { from, fromStep, to: null, toStep };
    if (k === b) return { from: null, fromStep, to, toStep };
    return null;
  });
}

/**
 * The steps at which each run of a pin starts (the step before is not held by it); a pin that
 * holds all loop long runs from step 0.
 */
function runStarts(holder: number[], pin: number): number[] {
  const n = holder.length;
  const starts = holder.flatMap((h, k) =>
    h === pin && holder[(k - 1 + n) % n] !== pin ? [k] : [],
  );
  return starts.length || !holder.includes(pin) ? starts : [0];
}

/**
 * Prepare an animation: phase segments for a pace, the anchor targets and the spot each planted
 * contact holds at the start of every step (so nothing slides between swings), and the moves of
 * contacts that come and go.
 */
export function prepare(anim: ExerciseAnimation, pace: Pace): Prepared {
  const poses: Record<string, Pose> = {};
  for (const [name, data] of Object.entries(anim.poses)) poses[name] = toPose(data);
  const pose = (name: string): Pose => {
    const p = poses[name];
    if (!p) throw new Error(`unknown pose ${name}`);
    return p;
  };

  const segs: Seg[] = [];
  let t = 0;
  for (let i = 0; i < anim.loop.length;) {
    const phase = anim.loop[i]!.phase;
    const steps: number[] = [];
    while (i < anim.loop.length && anim.loop[i]!.phase === phase) steps.push(i++);
    const total = steps.reduce((sum, k) => sum + (anim.loop[k]!.share ?? 1), 0);
    let u = 0;
    const parts = steps.map((k) => {
      const w = (anim.loop[k]!.share ?? 1) / total;
      const part = { step: k, u0: u, u1: u + w };
      u += w;
      return part;
    });
    const dur = pace[phase] ?? 0;
    segs.push({ phase, t0: t, t1: t + dur, parts });
    t += dur;
  }

  // Reps: a new one starts at each lowering after the first; what comes before the first
  // lowering ends the last rep.
  const lowers = segs.flatMap((s, i) => (s.phase === 'eccentric' ? [i] : []));
  const reps: number[][] =
    lowers.length < 2
      ? [segs.map((_, i) => i)]
      : lowers.map((s, r) => {
          const end = r + 1 < lowers.length ? lowers[r + 1]! : segs.length;
          const rep = Array.from({ length: end - s }, (_, i) => s + i);
          return r + 1 < lowers.length
            ? rep
            : [...rep, ...Array.from({ length: lowers[0]! }, (_, i) => i)];
        });

  const n = anim.loop.length;
  // The loop is closed: its first move starts where its last step ends, so nothing snaps at the
  // wrap (`start` names that same pose).
  const fromPose: string[] = [];
  let prev = anim.loop[n - 1]!.to;
  for (const step of anim.loop) {
    fromPose.push(prev);
    prev = step.to;
  }
  const holds = anim.pins.map((p) =>
    anim.loop.map((_, k) => p.mode === 'tether' || !p.steps || p.steps.includes(k)),
  );
  const holderOf = (match: (p: AnimationPin) => boolean) =>
    anim.loop.map((_, k) => anim.pins.findIndex((p, i) => match(p) && holds[i]![k]));

  // The anchor: a target per run, on its `at` or under it in the pose the run starts in.
  const anchorHolder = holderOf((p) => p.mode === 'anchor');
  const anchorTarget: (Vec3 | undefined)[] = anim.loop.map(() => undefined);
  for (const i of new Set(anchorHolder.filter((h) => h >= 0)))
    for (const k0 of runStarts(anchorHolder, i)) {
      const pin = anim.pins[i] as AnchorPin;
      const target = restingSpot(forward(pose(fromPose[k0]!)), pin).pos;
      for (let k = k0, c = 0; anchorHolder[k] === i && c < n; k = (k + 1) % n, c++)
        anchorTarget[k] = target;
    }
  const anchorEnd = (i: number | null, k: number): AnchorEnd =>
    i === null ? null : { pin: anim.pins[i] as AnchorPin, target: anchorTarget[k]! };
  const anchors: AnchorStep[] = schedule(anchorHolder).map((s, k) =>
    !s
      ? null
      : 'hold' in s
        ? { hold: anchorEnd(s.hold, k)! }
        : { from: anchorEnd(s.from, s.fromStep), to: anchorEnd(s.to, s.toStep) },
  );
  const solve0 = (poseName: string, k: number, u: number): Frames => {
    const F = forward(pose(poseName));
    const by = anchorShift(anchors[k] ?? null, F, u);
    if (by) shift(F, by);
    return F;
  };

  // Planted contacts: a spot per run, updated only at the end of a swing. A contact planted all
  // loop long goes round with it: its last swing lands back where the loop starts it.
  const plants = anim.pins.filter((p): p is PlantPin => p.mode === 'plant');
  const held: Record<string, Spot>[] = anim.loop.map(() => ({}));
  anim.pins.forEach((p, i) => {
    if (p.mode !== 'plant') return;
    const holder = holds[i]!.map((on) => (on ? i : -1));
    const lastSwing = holds[i]!.every(Boolean)
      ? anim.loop.findLastIndex((step) => step.swing === p.contact)
      : -1;
    for (const k0 of runStarts(holder, i)) {
      const first = restingSpot(solve0(fromPose[k0]!, k0, 0), p);
      let cur = first;
      for (let k = k0, c = 0; holds[i]![k] && c < n; k = (k + 1) % n, c++) {
        held[k]![p.contact] = cur;
        const step = anim.loop[k]!;
        if (step.swing === p.contact)
          cur =
            k === lastSwing
              ? first
              : restingSpot(solve0(step.to, k, 1), { contact: p.contact, rest: p.rest });
      }
    }
  });

  // Hands and feet that come and go: their moves between pins.
  const moves: Move[][] = anim.loop.map(() => []);
  for (const contact of ['hand.l', 'hand.r', 'foot.l', 'foot.r'] as const) {
    const mine = (p: AnimationPin) => p.mode !== 'anchor' && p.contact === contact;
    if (!anim.pins.some((p) => mine(p) && 'steps' in p && p.steps)) continue;
    const end = (i: number | null, k: number): MoveEnd => {
      if (i === null) return null;
      const pin = anim.pins[i]!;
      if (pin.mode === 'plant') return { pin, spot: held[k]![contact]! };
      return pin.mode === 'grip' ? { pin } : null;
    };
    schedule(holderOf(mine)).forEach((s, k) => {
      if (s && !('hold' in s))
        moves[k]!.push({ contact, from: end(s.from, s.fromStep), to: end(s.to, s.toStep) });
    });
  }

  return { anim, poses, segs, duration: t, reps, anchors, plants, holds, held, moves, fromPose };
}

/** How far the anchor moves the body in a step `u` of the way through it, or null for nowhere. */
function anchorShift(a: AnchorStep, F: Frames, u: number): Vec3 | null {
  if (!a) return null;
  const by = (e: AnchorEnd): Vec3 =>
    e ? sub(e.target, contactPoint(F, e.pin.contact)) : [0, 0, 0];
  if ('hold' in a) return by(a.hold);
  return lerp3(by(a.from), by(a.to), u);
}

/** Where the loop is at time t: step index, interpolation within the step and phase. */
export function locate(prep: Prepared, t: number) {
  const { segs, duration } = prep;
  const first = segs[0]!;
  if (duration <= 0) return { step: 0, u: 0, phase: first.phase, phaseProgress: 0 };
  const tt = ((t % duration) + duration) % duration;
  const seg = segs.find((s) => tt < s.t1) || segs[segs.length - 1]!;
  const raw = seg.t1 > seg.t0 ? (tt - seg.t0) / (seg.t1 - seg.t0) : 1;
  const p = seg.phase === 'eccentric' || seg.phase === 'concentric' ? easeInOut(raw) : raw;
  const part = seg.parts.find((q) => p <= q.u1 + 1e-9) || seg.parts[seg.parts.length - 1]!;
  const u = clamp((p - part.u0) / (part.u1 - part.u0 || 1), 0, 1);
  return { step: part.step, u, phase: seg.phase, phaseProgress: raw };
}

/**
 * Time at which the loop first rests in pose `name`, or passes through it (used for stills): the
 * middle of a pause or hold on it, else the moment a step reaches it.
 */
export function timeOf(prep: Prepared, name: string): number {
  let passing: number | undefined;
  for (const seg of prep.segs)
    for (const part of seg.parts) {
      if (prep.anim.loop[part.step]!.to !== name) continue;
      if (seg.phase === 'pause' || seg.phase === 'hold') return (seg.t0 + seg.t1) / 2;
      if (part.u1 >= 1 - 1e-9) return seg.t1 - 1e-6;
      // Inside an eased phase: invert the easing to find when the step ends.
      passing ??= seg.t0 + (Math.acos(1 - 2 * part.u1) / Math.PI) * (seg.t1 - seg.t0);
    }
  return passing ?? 0;
}

/**
 * Loop time for a point in one phase (0..1 through it) of rep `rep` (counted from 0; a loop of
 * several reps, one per arm, runs through them in turn): how the figure follows an outside clock.
 * A phase with no duration in this pace maps to its start.
 */
export function timeAtPhase(prep: Prepared, phase: LoopPhase, progress: number, rep = 0): number {
  const count = prep.reps.length;
  const r = ((Math.floor(rep) % count) + count) % count;
  const seg =
    prep.reps[r]!.map((i) => prep.segs[i]!).find((s) => s.phase === phase) ??
    prep.segs.find((s) => s.phase === phase);
  if (!seg) return 0;
  return seg.t0 + clamp(progress, 0, 0.9999) * (seg.t1 - seg.t0);
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

/** A pin's elbow direction { frame, dir } in world space (z mirrored on the left). */
function poleOf(F: Frames, pin: AnimationPin, S: Side): Vec3 | undefined {
  if (!('pole' in pin) || !pin.pole) return undefined;
  const d = pin.pole.dir;
  return apply(F[pin.pole.frame].m, [d[0], d[1], S === 'l' ? -d[2] : d[2]]);
}

/** Rotation matrix to unit quaternion [w, x, y, z]. */
function quat(m: Mat): [number, number, number, number] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const tr = a + e + i;
  let q: [number, number, number, number];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [s / 4, (h - f) / s, (c - g) / s, (d - b) / s];
  } else if (a > e && a > i) {
    const s = Math.sqrt(1 + a - e - i) * 2;
    q = [(h - f) / s, s / 4, (b + d) / s, (c + g) / s];
  } else if (e > i) {
    const s = Math.sqrt(1 + e - a - i) * 2;
    q = [(c - g) / s, (b + d) / s, s / 4, (f + h) / s];
  } else {
    const s = Math.sqrt(1 + i - a - e) * 2;
    q = [(d - b) / s, (c + g) / s, (f + h) / s, s / 4];
  }
  const l = Math.hypot(...q);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
function fromQuat([w, x, y, z]: [number, number, number, number]): Mat {
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - w * z),
    2 * (x * z + w * y),
    2 * (x * y + w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z - w * x),
    2 * (x * z - w * y),
    2 * (y * z + w * x),
    1 - 2 * (x * x + y * y),
  ];
}
/** A rotation `u` of the way from `a` to `b`, along the shortest arc. */
function slerp(a: Mat, b: Mat, u: number): Mat {
  if (u <= 0) return a;
  if (u >= 1) return b;
  const qa = quat(a);
  let qb = quat(b);
  let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
  if (d < 0) {
    qb = [-qb[0], -qb[1], -qb[2], -qb[3]];
    d = -d;
  }
  let ka = 1 - u;
  let kb = u;
  if (d < 0.9995) {
    const th = Math.acos(d);
    ka = Math.sin((1 - u) * th) / Math.sin(th);
    kb = Math.sin(u * th) / Math.sin(th);
  }
  const q: [number, number, number, number] = [0, 1, 2, 3].map(
    (j) => ka * qa[j]! + kb * qb[j]!,
  ) as [number, number, number, number];
  const l = Math.hypot(...q);
  return fromQuat([q[0] / l, q[1] / l, q[2] / l, q[3] / l]);
}

/** Bring a planted contact to its spot. Returns how far it missed. */
function reachPlant(F: Frames, pin: PlantPin, spot: Spot): number {
  const kind = isFoot(pin.contact) ? 'leg' : 'arm';
  const S = sideOf(pin.contact);
  if (pin.rest === 'forearm') {
    const aim = forearmAim(F, pin.contact, spot);
    const m = solveLimb(F, 'arm', S, aim.wrist, aim.orient, aim.pole);
    return Math.max(m, len(sub(F[sided('elbow', S)].o, spot.pos)));
  }
  if (pin.rest && pin.rest !== 'flat') {
    // The hand or foot keeps its angle to the limb; aim the joint so its touching point lands.
    const { point } = REST_POINT[pin.rest];
    const end = endFrame(pin.contact);
    let m = 0;
    for (let k = 0; k < 3; k++)
      m = solveLimb(
        F,
        kind,
        S,
        sub(spot.pos, apply(F[end].m, point)),
        undefined,
        poleOf(F, pin, S),
      );
    return m;
  }
  return solveLimb(
    F,
    kind,
    S,
    spot.pos,
    flatOrientation(pin.contact, spot.h, spot.n),
    poleOf(F, pin, S),
  );
}

/** One end of a move as a target: the point that lands, its orientation (none: kept to the limb) and the elbow's way. */
interface Aim {
  pos: Vec3;
  /** The touching point in the end frame, when it is not the joint itself. */
  point?: Vec3 | undefined;
  orient?: Mat | undefined;
  pole?: Vec3 | undefined;
}
function aimOf(F: Frames, end: MoveEnd, c: SidedContact, free: Frame): Aim {
  const S = sideOf(c);
  if (!end) return { pos: free.o, orient: free.m };
  const pin = end.pin;
  if (pin.mode === 'grip') return { pos: at(F[pin.frame], pin.at), pole: poleOf(F, pin, S) };
  const { spot } = end as { spot: Spot };
  if (pin.rest === 'forearm') {
    const aim = forearmAim(F, c, spot);
    return { pos: aim.wrist, orient: aim.orient, pole: aim.pole };
  }
  if (pin.rest && pin.rest !== 'flat')
    return { pos: spot.pos, point: REST_POINT[pin.rest].point, pole: poleOf(F, pin, S) };
  return { pos: spot.pos, orient: flatOrientation(c, spot.h, spot.n), pole: poleOf(F, pin, S) };
}

/**
 * A hand or foot `u` of the way from one pin to the next: from plant to plant on an arc, else
 * eased between the pins and the pose's own path. The limb's own frames still hold the pose.
 */
function travel(F: Frames, move: Move, u: number): void {
  const { contact: c, from, to } = move;
  const S = sideOf(c);
  const kind = isFoot(c) ? 'leg' : 'arm';
  const [up, mid, end] = isFoot(c)
    ? ([sided('hip', S), sided('knee', S), sided('ankle', S)] as const)
    : ([sided('shoulder', S), sided('elbow', S), sided('wrist', S)] as const);
  const free = F[end];
  const localEnd = mul(transpose(F[mid].m), free.m);
  const fallback = scale(axis(F[up].m, 0), -1);
  const a = aimOf(F, from, c, free);
  const b = aimOf(F, to, c, free);
  let lift: Vec3 = [0, 0, 0];
  if (from?.pin.mode === 'plant' && to?.pin.mode === 'plant') {
    const { spot: sa } = from as { spot: Spot };
    const { spot: sb } = to as { spot: Spot };
    const h = to.pin.lift ?? from.pin.lift ?? 0.08;
    lift = scale(norm(add(sa.n, sb.n)), h * Math.sin(Math.PI * u));
  }
  const pole =
    kind === 'arm' && (a.pole || b.pole)
      ? lerp3(a.pole ?? fallback, b.pole ?? fallback, u)
      : undefined;
  for (let k = 0; k < 3; k++) {
    const R = F[end].m;
    const pa = a.point ? sub(a.pos, apply(R, a.point)) : a.pos;
    const pb = b.point ? sub(b.pos, apply(R, b.point)) : b.pos;
    solveLimb(F, kind, S, add(lerp3(pa, pb, u), lift), undefined, pole);
    const kept = mul(F[mid].m, localEnd);
    F[end] = { o: F[end].o, m: slerp(a.orient ?? kept, b.orient ?? kept, u) };
  }
}

export interface Solved {
  frames: Frames;
  /** How far a limb fell short of a contact holding in this step, in metres (0 when all are reached). */
  miss: number;
  phase: LoopPhase;
  /** How far through the loop, counted in steps (step k of n runs from k / n to (k + 1) / n). */
  loop: number;
}

/** Solve the figure at time t: segment frames after anchors, plants, moves, grips and tethers. */
export function evaluate(prep: Prepared, t: number): Solved {
  const { anim } = prep;
  const loc = locate(prep, t);
  const k = loc.step;
  const step = anim.loop[k]!;
  const from = prep.poses[prep.fromPose[k]!]!;
  const to = prep.poses[step.to]!;
  const F = forward(blend(from, to, loc.u));
  const by = anchorShift(prep.anchors[k] ?? null, F, loc.u);
  if (by) shift(F, by);
  const held = prep.held[k]!;
  const holding = (pin: AnimationPin) => prep.holds[anim.pins.indexOf(pin)]![k]!;
  const straight = prep.plants.find((p) => p.straight && holding(p));
  if (straight && isFoot(straight.contact))
    rideOn(F, sideOf(straight.contact), held[straight.contact]!.pos);

  let miss = 0;
  for (const pin of prep.plants) {
    if (!holding(pin)) continue;
    let spot = held[pin.contact]!;
    if (step.swing === pin.contact) {
      const next = prep.held[(k + 1) % anim.loop.length]![pin.contact]!;
      const lift = Math.sin(Math.PI * loc.u) * (pin.lift ?? 0.08);
      const pos = lerp3(spot.pos, next.pos, loc.u);
      pos[1] += lift;
      spot = { pos, h: norm(lerp3(spot.h, next.h, loc.u)), n: spot.n };
    }
    miss = Math.max(miss, reachPlant(F, pin, spot));
  }
  for (const move of prep.moves[k]!) travel(F, move, loc.u);
  for (const pin of anim.pins) {
    if (pin.mode === 'grip' && holding(pin)) {
      const S = sideOf(pin.contact);
      miss = Math.max(
        miss,
        solveLimb(F, 'arm', S, at(F[pin.frame], pin.at), undefined, poleOf(F, pin, S)),
      );
    } else if (pin.mode === 'tether') {
      // The hand holds a strap of fixed length; the strap points from its anchor at the shoulder.
      const S = sideOf(pin.contact);
      let m = 0;
      for (let j = 0; j < 3; j++) {
        const toShoulder = norm(sub(F[sided('shoulder', S)].o, pin.anchor));
        const grip = add(pin.anchor, scale(toShoulder, pin.length));
        m = solveLimb(F, 'arm', S, sub(grip, apply(F[sided('wrist', S)].m, BODY.grip)));
      }
      miss = Math.max(miss, m);
    }
  }
  return { frames: F, miss, phase: loc.phase, loop: (k + loc.u) / anim.loop.length };
}
