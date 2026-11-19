import type {
  AnimationPin,
  AnimationPose,
  AnimationProp,
  ExerciseAnimation,
  LoopStep,
} from '@/domain';
import { ARMS_STRAIGHT, body, GRIP, pose, weightIn, type Foot } from './shared';

/*
 * Cardio family. Most of these moves are continuous cycles (a stride, a pedal stroke, a rope turn),
 * so they are generated: a function of the loop's progress gives the pose, sampled every 0.05 s of
 * the neutral loop and spread over the four phases so a paced loop still lines up. The keys of
 * the eased phases are spaced so that time runs evenly through them: the motion has no hitch where
 * the phases meet. Hands and feet that touch something are placed exactly by `reach`, so nothing
 * slides while it is meant to stay put.
 */

type Side = 'l' | 'r';
type V = [number, number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smooth = (x: number) => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};
const frac = (x: number) => x - Math.floor(x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/* ------------------------------------------------------------------ */
/* Sampling a cycle                                                    */
/* ------------------------------------------------------------------ */

/** Samples per phase at 0.05 s each of the neutral pace: lower 1.4 s, pause 0.25, lift 1.1, hold 0.6. */
const PHASE_SAMPLES = { eccentric: 28, pause: 5, concentric: 22, hold: 12 } as const;
const SAMPLES = 67;
/** Length of the neutral loop in seconds. */
const LOOP = 3.35;
const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

const tidy = <T>(v: T): T => {
  if (typeof v === 'number') return (Math.round(v * 1000) / 1000) as T;
  if (Array.isArray(v)) return v.map(tidy) as T;
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)])) as T;
  return v;
};

interface Cycle {
  poses: Record<string, AnimationPose>;
  start: string;
  still: string;
  loop: LoopStep[];
}

/** Keeps each plane / twist angle on the branch nearest the one before it: no swing the long way round. */
function unwrap(list: AnimationPose[]): void {
  const prev = new Map<string, number>();
  for (const p of list)
    for (const [joint, value] of Object.entries(p)) {
      if (!value || Array.isArray(value)) continue;
      const angles = value as Record<string, number | undefined>;
      for (const field of ['plane', 'rot']) {
        const v = angles[field];
        if (v === undefined) continue;
        const key = `${joint}.${field}`;
        const before = prev.get(key);
        const next = before === undefined ? v : v - 360 * Math.round((v - before) / 360);
        angles[field] = next;
        prev.set(key, next);
      }
    }
}

/** The ankle bend chosen for each side at the previous sample: a foot keeps its branch from one sample to the next. */
const ankleLast = new Map<Side, number>();

/**
 * A cycle from a pose function of the loop's progress `u` (0..1; 1 is 0 again). The still is the
 * sample nearest `stillSeconds` into the loop (inside the first phase, so the figure can show it
 * exactly).
 */
function cycle(at: (u: number) => AnimationPose, stillSeconds: number): Cycle {
  const list: AnimationPose[] = [];
  ankleLast.clear();
  for (let k = 0; k < SAMPLES; k++) list.push(tidy(at(k / SAMPLES)));
  unwrap(list);
  const poses: Record<string, AnimationPose> = {};
  list.forEach((p, k) => (poses[`k${k}`] = tidy(p)));
  const loop: LoopStep[] = [];
  let k = 0;
  for (const [phase, count] of Object.entries(PHASE_SAMPLES) as [LoopStep['phase'], number][])
    for (let j = 0; j < count; j++) {
      k++;
      // Eased phases: an equal slice of time is a slice of progress under the easing.
      const share =
        phase === 'eccentric' || phase === 'concentric'
          ? ease((j + 1) / count) - ease(j / count)
          : 1 / count;
      loop.push({ to: `k${k % SAMPLES}`, phase, share });
    }
  const still = Math.min(PHASE_SAMPLES.eccentric - 1, Math.max(1, Math.round(stillSeconds / 0.05)));
  return { poses, start: 'k0', still: `k${still}`, loop };
}

/** A cycle from a pose function of the time in the neutral loop. */
const scripted = (at: (t: number) => AnimationPose, stillSeconds: number): Cycle =>
  cycle((u) => at(u * LOOP), stillSeconds);

type Key = [number, number];
/** A value keyed by time, eased between keys (constant before the first and after the last). */
function track(keys: Key[], t: number): number {
  const first = keys[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!;
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]!;
      return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1]![1];
}
/** A hop of height `h` between `t0` and `t1`. */
const arc = (t: number, t0: number, t1: number, h: number) =>
  t <= t0 || t >= t1 ? 0 : h * 4 * ((t - t0) / (t1 - t0)) * (1 - (t - t0) / (t1 - t0));

/* ------------------------------------------------------------------ */
/* Reaching: a hand or a foot placed exactly, whatever the trunk does  */
/* ------------------------------------------------------------------ */

const vadd = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const vdot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vlen = (a: V) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a: V): V => vmul(a, 1 / (vlen(a) || 1));
const vlerp = (a: V, b: V, u: number): V => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];

/** `v` turned by `angle` radians about the unit axis `a` (right-handed). */
function turn(v: V, a: V, angle: number): V {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vadd(vadd(vmul(v, c), vmul(vcross(a, v), s)), vmul(a, vdot(a, v) * (1 - c)));
}

/** A frame as its three axes in world space. */
type Axes = [V, V, V];
/**
 * The axes of the pelvis (`flex` 0) or of the back above it: the lean about z, the side tilt about
 * x, the turn about the vertical, in the order the skeleton applies them.
 */
const frameAxes = (lean: number, flex = 0, tilt = 0, yaw = 0): Axes =>
  (
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as V[]
  ).map((e) => {
    let v = turn(e, [0, 0, 1], -rad(flex));
    v = turn(v, [1, 0, 0], rad(tilt));
    v = turn(v, [0, 0, 1], -rad(lean));
    return turn(v, [0, 1, 0], rad(yaw));
  }) as Axes;
const leanAxes = (lean: number): Axes => frameAxes(lean);
const local = (M: Axes, w: V): V => [vdot(M[0], w), vdot(M[1], w), vdot(M[2], w)];
const world = (M: Axes, l: V): V =>
  vadd(vadd(vmul(M[0], l[0]), vmul(M[1], l[1])), vmul(M[2], l[2]));

/** The trunk: the pelvis' place, its lean, and the bend of the back on top of it. */
interface Trunk {
  root: V;
  lean: number;
  /** Extra forward bend of the spine and chest together (degrees). */
  flex?: number;
  /** Side tilt and turn of the whole trunk (degrees). */
  tilt?: number;
  turn?: number;
}

/** Where the limbs start: the hip or the shoulder, and the axes they hang from. */
function limbBase(t: Trunk, kind: 'arm' | 'leg', S: Side): { origin: V; axes: Axes } {
  const s = S === 'r' ? 1 : -1;
  const pel = frameAxes(t.lean, 0, t.tilt, t.turn);
  if (kind === 'leg') return { origin: vadd(t.root, world(pel, [0, -0.02, s * 0.085])), axes: pel };
  const flex = t.flex ?? 0;
  const lower = frameAxes(t.lean, flex / 2, t.tilt, t.turn);
  const chest = frameAxes(t.lean, flex, t.tilt, t.turn);
  const neck = vadd(vadd(t.root, vmul(lower[1], 0.19)), vmul(chest[1], 0.26));
  return { origin: vadd(neck, world(chest, [-0.005, -0.035, s * 0.165])), axes: chest };
}

/** The shoulder joint's place. */
const shoulderAt = (t: Trunk, S: Side): V => limbBase(t, 'arm', S).origin;
/** A point of the chest in its own axes (x ahead, y up, z to the right), in the world. */
const onChest = (t: Trunk, p: V): V => {
  const flex = t.flex ?? 0;
  const lower = frameAxes(t.lean, flex / 2, t.tilt, t.turn);
  const chest = frameAxes(t.lean, flex, t.tilt, t.turn);
  return vadd(vadd(t.root, vmul(lower[1], 0.19)), world(chest, p));
};

interface Reach {
  p: V;
  /** The way the elbow or knee points (a world direction; a knee points forward by default). */
  pole?: V;
  /** Foot: the pitch of the sole, toes up (0 flat). */
  pitch?: number;
  /** Hand: how flat the palm lies, fingers forward (0 hanging, 1 flat on the floor). */
  flat?: number;
}

/**
 * Joint angles that put a hand or a foot on `to.p`: the shoulder (or hip) turned so the upper
 * segment points at the elbow (or knee), the twist that makes that hinge fold the right way, and
 * the bend. An unreachable target is approached as far as the limb stretches.
 */
function reach(t: Trunk, kind: 'arm' | 'leg', S: Side, target: Reach): AnimationPose {
  let to = target;
  const [l1, l2] = kind === 'arm' ? [0.28, 0.245] : [0.42, 0.41];
  const s = S === 'r' ? 1 : -1;
  const { origin, axes } = limbBase(t, kind, S);
  if (kind === 'leg') {
    // The sole's lowest point stays on or above the floor: an ankle never goes lower than its foot allows.
    const pitch = to.pitch ?? 0;
    const p = rad(pitch);
    const lowest =
      pitch < 0
        ? 0.025 - 0.145 * Math.sin(p) + 0.05 * Math.cos(p)
        : 0.033 + 0.045 * Math.sin(p) + 0.042 * Math.cos(p);
    to = { ...to, p: [to.p[0], Math.max(to.p[1], lowest + 0.004), to.p[2]] };
  }
  const toTarget = vsub(to.p, origin);
  const d = clamp(vlen(toTarget), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.9995);
  const u = vnorm(toTarget);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pole = to.pole ?? (kind === 'leg' ? [1, 0, 0] : [-1, 0, 0]);
  let w = vsub(pole, vmul(u, vdot(pole, u)));
  if (vlen(w) < 1e-6) w = vsub([0, 0, s], vmul(u, vdot([0, 0, s], u)));
  w = vnorm(w);
  const joint = vadd(origin, vmul(vadd(vmul(u, cosA), vmul(w, sinA)), l1));
  const tl = local(axes, vnorm(vsub(joint, origin)));
  const elev = Math.acos(clamp(-tl[1], -1, 1));
  const plane = Math.atan2(tl[0], s * tl[2]);
  // The hinge must be square to the plane through shoulder, elbow and wrist: twist about the bone.
  const a: V = [-s * Math.cos(plane), 0, Math.sin(plane)];
  const xs = turn([1, 0, 0], a, elev);
  const zs = turn([0, 0, 1], a, elev);
  const wl = local(axes, vnorm(vsub(to.p, joint)));
  let theta = Math.atan2(-vdot(wl, zs), vdot(wl, xs));
  const front = (th: number) => vdot(wl, vsub(vmul(xs, Math.cos(th)), vmul(zs, Math.sin(th))));
  // An arm's forearm folds toward the front of the upper arm, a leg's shin toward the back.
  if (kind === 'arm' ? front(theta) < 0 : front(theta) > 0) theta += Math.PI;
  const rot = ((((deg(theta) / s + 180) % 360) + 360) % 360) - 180;
  const gamma = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  const flex = 180 - deg(gamma);
  const joints = { plane: deg(plane), elev: deg(elev), rot };
  if (kind === 'arm')
    return {
      [`shoulder.${S}`]: joints,
      [`elbow.${S}`]: { flex, ...(to.flat ? { pron: 90 * to.flat } : {}) },
      ...(to.flat ? { [`wrist.${S}`]: { flex: -90 * to.flat } } : {}),
    } as AnimationPose;
  // Foot: the ankle bends so the sole's pitch is `pitch` (toes up) in the world.
  const xl = vsub(vmul(xs, Math.cos(theta)), vmul(zs, Math.sin(theta)));
  const yl = vmul(tl, -1);
  const kf = rad(flex);
  const xk = world(axes, vsub(vmul(xl, Math.cos(kf)), vmul(yl, Math.sin(kf))));
  const yk = world(axes, vadd(vmul(xl, Math.sin(kf)), vmul(yl, Math.cos(kf))));
  const A = xk[1];
  const B = yk[1];
  const R = Math.hypot(A, B) || 1;
  const phi = Math.atan2(B, A);
  const off = Math.acos(clamp(Math.sin(rad(to.pitch ?? 0)) / R, -1, 1));
  const cands = [phi + off, phi - off].map((x) => deg(Math.atan2(Math.sin(x), Math.cos(x))));
  // Of the two bends that give the pitch, the one with the toes ahead (not behind) and nearest the last one.
  const toesAhead = (a: number) => Math.cos(rad(a)) * xk[0] + Math.sin(rad(a)) * yk[0] >= 0;
  const ahead = cands.filter(toesAhead);
  const before = ankleLast.get(S) ?? 0;
  const pool = ahead.length > 0 ? ahead : cands;
  const ankle = pool.reduce((best, c) =>
    Math.abs(c - before) < Math.abs(best - before) ? c : best,
  );
  ankleLast.set(S, ankle);
  return {
    [`hip.${S}`]: joints,
    [`knee.${S}`]: { flex },
    [`ankle.${S}`]: { flex: ankle },
  } as AnimationPose;
}

interface Limbs {
  hands?: Partial<Record<Side, Reach>>;
  feet?: Partial<Record<Side, Reach>>;
}

/** A pose: the trunk, and the hands and feet each placed with `reach`. */
function figure(t: Trunk, limbs: Limbs, extra: AnimationPose = {}): AnimationPose {
  const parts: AnimationPose[] = [
    {
      root: {
        pos: t.root,
        lean: t.lean,
        ...(t.tilt ? { tilt: t.tilt } : {}),
        ...(t.turn ? { turn: t.turn } : {}),
      },
      ...(t.flex ? { spine: { flex: t.flex / 2 }, chest: { flex: t.flex / 2 } } : {}),
    },
  ];
  for (const S of ['l', 'r'] as const) {
    const h = limbs.hands?.[S];
    if (h) parts.push(reach(t, 'arm', S, h));
    const f = limbs.feet?.[S];
    if (f) parts.push(reach(t, 'leg', S, f));
  }
  return pose(...parts, extra);
}

/** Hip-to-ankle distance when the knee is bent `k` degrees. */
const legSpan = (k: number) =>
  Math.sqrt(0.42 ** 2 + 0.41 ** 2 + 2 * 0.42 * 0.41 * Math.cos(rad(k)));

/* ------------------------------------------------------------------ */
/* Machines and props                                                  */
/* ------------------------------------------------------------------ */

type Machine = 'treadmill' | 'stationary-bike' | 'rower' | 'jump-rope';

const part = (
  id: string,
  a: V,
  b: V,
  r: number,
  group: string,
  equipment?: Machine,
): AnimationProp => ({
  kind: 'capsule',
  id,
  group,
  ...(equipment ? { equipment } : {}),
  a,
  b,
  r,
});

/** A round part: a capsule too short to show its length. */
const disc = (id: string, c: V, r: number, group: string, equipment: Machine): AnimationProp =>
  part(id, c, [c[0], c[1] + 0.001, c[2]], r, group, equipment);

/** Height of the treadmill's belt where the figure walks. */
const DECK = 0.17;

/**
 * A treadmill seen from the side, facing +x: the belt rising `slope` degrees toward the console,
 * a low rear frame and a column on each side with a handrail on the far one only (the near one
 * would cross the arms).
 */
function treadmill(slope: number): AnimationProp[] {
  const t = Math.tan(rad(slope));
  const r = 0.045;
  const top = (x: number) => DECK + x * t;
  // The belt's centre line sits one radius under its surface.
  const mid = (x: number): V => [
    x + r * Math.sin(rad(slope)),
    top(x) - r * Math.cos(rad(slope)),
    0,
  ];
  const E: Machine = 'treadmill';
  const consoleY = top(0.62) + 0.95;
  return [
    part('deck', mid(-0.6), mid(0.66), r, 'handle', E),
    part('rear', [-0.6, DECK - 0.1, 0], [-0.6, 0.03, 0], 0.03, 'handle', E),
    part('column.l', [0.64, 0.03, -0.3], [0.62, consoleY, -0.3], 0.024, 'handle.l', E),
    part('column.r', [0.64, 0.03, 0.3], [0.62, consoleY, 0.3], 0.024, 'handle.r', E),
    part('rail.l', [0.62, consoleY - 0.05, -0.3], [0.1, consoleY - 0.2, -0.3], 0.02, 'handle.l', E),
    part('console', [0.5, consoleY + 0.02, 0], [0.7, consoleY + 0.04, 0], 0.07, 'handle', E),
  ];
}

/* ------------------------------------------------------------------ */
/* Walking and running                                                 */
/* ------------------------------------------------------------------ */

interface Gait {
  /** Strides (a left and a right step) in the loop. */
  cycles: number;
  /** Share of a stride a foot spends on the belt. */
  duty: number;
  /** Belt speed in m/s, along the slope. */
  speed: number;
  /** Belt slope in degrees (the body stays upright). */
  slope: number;
  /** Height of the belt's surface under the pelvis. */
  deck: number;
  /** Foot pitch at touchdown (toes up) and where the foot leaves the belt (toes down). */
  strike: number;
  lift: number;
  /**
   * Hip height at its lowest and its rise through the stride; a walker's hip is highest over the
   * planted foot, a runner's lowest, with a flight in between (`catch`: how far through its rise
   * the hip is at touchdown).
   */
  hipLow: number;
  hipRise: number;
  flight: boolean;
  catch: number;
  /** Where the planted foot is under the hip, as a share of its stance. */
  under: number;
  /** The height the swing foot clears. */
  clear: number;
  /** Torso lean, arm swing and elbow bend (swinging back, swinging forward). */
  lean: number;
  swing: number;
  elbow: [number, number];
  /** Seconds into the loop at which the still is taken. */
  still: number;
  /** How far back from the belt's middle the figure stands. */
  back?: number;
}

/** One foot at `q` through its stance (0 touchdown, 1 toe-off): [along the belt, height, pitch]. */
function stance(g: Gait, period: number, q: number): [number, number, number] {
  const q1 = g.strike > 10 ? 0.12 : 0.07;
  const q2 = 0.48;
  const travel = g.speed * g.duty * period;
  const heel = -0.045 + travel * g.under - g.speed * q * g.duty * period;
  if (q < q1) {
    const pitch = g.strike * (1 - ease(q / q1));
    const p = rad(pitch);
    return [
      heel + 0.045 * Math.cos(p) - 0.042 * Math.sin(p),
      0.033 + 0.045 * Math.sin(p) + 0.042 * Math.cos(p),
      pitch,
    ];
  }
  if (q < q2) return [heel + 0.045, 0.075, 0];
  const pitch = -g.lift * ease((q - q2) / (1 - q2));
  const p = rad(pitch);
  const toe = heel + 0.19;
  return [
    toe - 0.145 * Math.cos(p) - 0.05 * Math.sin(p),
    0.025 - 0.145 * Math.sin(p) + 0.05 * Math.cos(p),
    pitch,
  ];
}

/** A foot in a stride at phase `phi` (0..1), in the belt's own axes. */
function stride(g: Gait, period: number, phi: number): [number, number, number] {
  if (phi < g.duty) return stance(g, period, phi / g.duty);
  const u = (phi - g.duty) / (1 - g.duty);
  const [x0, y0, p0] = stance(g, period, 1);
  const [x1, y1, p1] = stance(g, period, 0);
  const m = smooth(u);
  return [
    x0 + (x1 - x0) * m,
    y0 + (y1 - y0) * m + g.clear * Math.sin(Math.PI * Math.pow(u, 0.72)),
    p0 + (p1 - p0) * m,
  ];
}

/** The hip's rise (0..1) a share `p` (0..0.5) of the way through a stride's half. */
function hipRise(g: Gait, p: number): number {
  if (!g.flight) return 0.5 * (1 + Math.cos(4 * Math.PI * (p - g.duty / 2)));
  if (p < g.duty) return g.catch * 0.5 * (1 + Math.cos((2 * Math.PI * p) / g.duty));
  return g.catch + (1 - g.catch) * Math.sin((Math.PI * (p - g.duty)) / (0.5 - g.duty));
}

function gait(g: Gait): Cycle {
  const period = LOOP / g.cycles;
  const slope = rad(g.slope);
  const placed = (phi: number): Foot => {
    const [x, y, pitch] = stride(g, period, phi);
    return {
      ankle: [
        x * Math.cos(slope) - y * Math.sin(slope) - (g.back ?? 0),
        g.deck + x * Math.sin(slope) + y * Math.cos(slope),
      ],
      foot: pitch + g.slope,
      rot: -3,
    };
  };
  return scripted((t) => {
    // The stride starts with the right foot touching down.
    const th = (g.cycles * t) / LOOP;
    const hip = g.hipLow + g.hipRise * hipRise(g, frac(th * 2) / 2);
    const arm = (S: Side) => {
      const sign = S === 'r' ? -1 : 1;
      const c = Math.cos(2 * Math.PI * (th - 0.04));
      return {
        [`shoulder.${S}`]: { plane: 90, elev: sign * g.swing * c + g.lean, rot: 0 },
        [`elbow.${S}`]: { flex: lerp(g.elbow[0], g.elbow[1], 0.5 + 0.5 * sign * c) },
      } as AnimationPose;
    };
    return body(
      [-(g.back ?? 0), g.deck + hip],
      g.lean,
      { r: placed(frac(th)), l: placed(frac(th + 0.5)) },
      { neck: { flex: -g.lean * 0.6 }, ...arm('r'), ...arm('l') },
    );
  }, g.still);
}

const WALK: Gait = {
  cycles: 3,
  duty: 0.62,
  speed: 0.98,
  slope: 0,
  deck: DECK,
  strike: 16,
  lift: 30,
  hipLow: 0.86,
  hipRise: 0.035,
  flight: false,
  catch: 0,
  under: 0.46,
  clear: 0.075,
  lean: 1,
  swing: 24,
  elbow: [18, 38],
  still: 0.05,
};

const RUN: Gait = {
  cycles: 5,
  duty: 0.36,
  speed: 2.5,
  slope: 0,
  deck: DECK,
  strike: 4,
  lift: 30,
  hipLow: 0.845,
  hipRise: 0.05,
  flight: true,
  catch: 0.3,
  under: 0.3,
  clear: 0.28,
  lean: 6,
  swing: 38,
  elbow: [75, 105],
  still: 0.05,
};

const asAnimation = (
  c: Cycle,
  rest: Omit<ExerciseAnimation, 'poses' | 'start' | 'still' | 'loop'>,
): ExerciseAnimation => ({
  ...rest,
  poses: c.poses,
  start: c.start,
  still: c.still,
  loop: c.loop,
});

const SIDE_VIEW = { yaw: 12, pitch: 6 };
const LEGS: ExerciseAnimation['working'] = ['leg.l', 'leg.r'];
const NONE: AnimationPin[] = [];

/* ------------------------------------------------------------------ */
/* Marching, high knees and the rope                                   */
/* ------------------------------------------------------------------ */

interface Hop {
  /** Steps (landings) in the loop; an even number when the feet alternate. */
  steps: number;
  /**
   * Both feet together (`two`), a jog on one foot at a time, a jog with the knee driven to hip
   * height, or a march with no flight.
   */
  style: 'two' | 'jog' | 'knee' | 'march';
  /** Share of a step spent in the air, and how high the body rises. */
  flight: number;
  height: number;
  /** Knee bend at landing, the extra bend at the lowest point, and at take-off (degrees). */
  bend: [number, number, number];
  arms: 'swing' | 'rope';
  swing: number;
  /** Rope turns per hop. */
  turns: number;
  /** Seconds into the loop at which the still is taken. */
  still: number;
}

/** Ankle height on the ball of the foot (the sole pitched 25° toes down). */
const BALL = 0.135;

function hopper(h: Hop): Cycle {
  const c = 1 - h.flight;
  const march = h.style === 'march';
  return scripted((t) => {
    const s = (h.steps * t) / LOOP;
    const i = Math.floor(s + 1e-9);
    const lam = s - i;
    const stanceSide: Side = i % 2 === 0 ? 'r' : 'l';
    const freeSide: Side = stanceSide === 'r' ? 'l' : 'r';
    const air = h.flight > 0 && lam >= c;
    const g = air ? (lam - c) / (1 - c) : 0;
    const lc = air ? 1 : lam / c;
    const [kLand, kLow, kTake] = h.bend;
    const k = air
      ? lerp(kTake, kLand, smooth(g))
      : lerp(kLand, kTake, smooth(lc)) + kLow * Math.sin(Math.PI * lc);
    const rise = air ? h.height * 4 * g * (1 - g) : 0;
    const y0 = march ? 0.075 : BALL;
    const pitch0 = march ? 0 : -25;
    const lean = 2;
    const hy = y0 + legSpan(k) + rise + (march ? 0.008 * Math.sin(2 * Math.PI * lam) : 0);

    const feet: Partial<Record<Side, Foot>> = {};
    const on = (ankle: [number, number], foot: number): Foot => ({ ankle, foot, rot: -3 });
    if (h.style === 'two') {
      const both = on([0, y0 + rise], air ? pitch0 - 5 * Math.sin(Math.PI * g) : pitch0);
      feet.l = both;
      feet.r = both;
    } else if (march) {
      const b = Math.pow(Math.sin(Math.PI * lam), 1.2);
      feet[stanceSide] = on([0, 0.075], 0);
      feet[freeSide] = on([0.38 * b, 0.075 + 0.425 * b], -14 * b);
    } else {
      const knee = h.style === 'knee';
      const back: [number, number] = knee ? [-0.1, 0.34] : [-0.14, 0.34];
      const top: [number, number] = knee ? [0.36, 0.5] : [0, 0.27];
      const home: [number, number] = [0, BALL];
      const mix = (a: [number, number], b: [number, number], m: number): [number, number] => [
        lerp(a[0], b[0], m),
        lerp(a[1], b[1], m),
      ];
      feet[freeSide] = air
        ? on(mix(top, home, smooth(g)), -30 + 5 * smooth(g))
        : on(mix(back, top, smooth(lc)), -30);
      feet[stanceSide] = air ? on(mix(home, back, smooth(g)), -25 - 5 * smooth(g)) : on(home, -25);
    }

    const out = body([0, hy], lean, feet, { neck: { flex: -1 } });
    const root: V = [0.02 * Math.sin(rad(lean)), hy + 0.02 * Math.cos(rad(lean)), 0];
    if (h.arms === 'swing') {
      const a = h.swing * Math.sin(Math.PI * s);
      return pose(out, {
        'shoulder.r': { plane: 90, elev: a + lean, rot: 0 },
        'shoulder.l': { plane: 90, elev: -a + lean, rot: 0 },
        'elbow.r': { flex: 85 + 12 * Math.sin(Math.PI * s - Math.PI / 2) },
        'elbow.l': { flex: 85 - 12 * Math.sin(Math.PI * s - Math.PI / 2) },
      });
    }
    // The wrists turn the rope in small circles, the elbows close to the body.
    const rho = 2 * Math.PI * h.turns * s;
    const trunk: Trunk = { root, lean };
    const hand = (S: Side): Reach => ({
      p: [
        root[0] + 0.2 + 0.05 * Math.cos(rho),
        root[1] + 0.09 + 0.05 * Math.sin(rho),
        S === 'r' ? 0.3 : -0.3,
      ],
      pole: [-0.3, -1, S === 'r' ? 0.3 : -0.3],
    });
    return pose(out, reach(trunk, 'arm', 'r', hand('r')), reach(trunk, 'arm', 'l', hand('l')));
  }, h.still);
}

/**
 * The rope, fist to fist, turning once per hop (twice for a double-under) and passing under the
 * feet at the top of the hop.
 */
const ropeFor = (h: Hop): AnimationProp[] => {
  const apex = 1 - h.flight / 2;
  const turns = h.turns || 1;
  return [
    {
      kind: 'jump-rope',
      id: 'rope',
      turns: h.steps * (h.turns || 1),
      // Several passes per hop are spread evenly about the top of the hop.
      under: (apex - (turns - 1) / (2 * turns)) / h.steps,
    },
  ];
};

const MARCH: Hop = {
  steps: 6,
  style: 'march',
  flight: 0,
  height: 0,
  bend: [7, 0, 7],
  arms: 'swing',
  swing: 26,
  turns: 0,
  still: 0.28,
};
const HIGH_KNEES: Hop = {
  steps: 8,
  style: 'knee',
  flight: 0.4,
  height: 0.05,
  bend: [22, 10, 8],
  arms: 'swing',
  swing: 38,
  turns: 0,
  still: 0.25,
};
const ROPE_BOUNCE: Hop = {
  steps: 7,
  style: 'two',
  flight: 0.42,
  height: 0.11,
  bend: [26, 10, 8],
  arms: 'rope',
  swing: 0,
  turns: 1,
  still: 0.4,
};
const ROPE_ALTERNATE: Hop = { ...ROPE_BOUNCE, steps: 8, style: 'jog', flight: 0.4 };
const ROPE_KNEES: Hop = {
  ...ROPE_BOUNCE,
  steps: 6,
  style: 'knee',
  flight: 0.4,
  height: 0.11,
  still: 0.33,
};
const ROPE_DOUBLE: Hop = {
  ...ROPE_BOUNCE,
  steps: 5,
  flight: 0.72,
  height: 0.22,
  bend: [28, 12, 6],
  turns: 2,
};

/* ------------------------------------------------------------------ */
/* Jacks                                                               */
/* ------------------------------------------------------------------ */

const FRONT_VIEW = { yaw: 60, pitch: 4 };
const ARMS_AND_LEGS: ExerciseAnimation['working'] = ['arm.l', 'arm.r', 'leg.l', 'leg.r'];

/** Arms out to the sides and up: `e` degrees from hanging. */
const armsOut = (e: number): AnimationPose => ({
  shoulder: { plane: 0, elev: e, rot: 0 },
  elbow: { flex: 6 },
});

/** The feet `zl` / `zr` out from the middle at `y0`, on the ball, the pelvis `hy` high. */
function jackFeet(
  hy: number,
  zl: number,
  zr: number,
  y0: number,
  pitch: number,
  lift = 0,
): AnimationPose {
  const trunk: Trunk = { root: [0, hy + 0.02, 0], lean: 0 };
  return pose(
    { root: { pos: trunk.root, lean: 0 } },
    reach(trunk, 'leg', 'l', { p: [0, y0 + lift, -zl], pitch }),
    reach(trunk, 'leg', 'r', { p: [0, y0 + lift, zr], pitch }),
  );
}

function jumpingJacks(): Cycle {
  const together = 0.1;
  const apart = 0.4;
  return cycle((u) => {
    const f = frac(3 * u + 0.1);
    let z: number;
    let k: number;
    let rise = 0;
    let e: number;
    if (f < 0.2 || (f >= 0.5 && f < 0.7)) {
      // On the floor: land, load, push off.
      const a = f < 0.2;
      const lam = a ? f / 0.2 : (f - 0.5) / 0.2;
      z = a ? together : apart;
      k = lerp(22, 8, smooth(lam)) + 14 * Math.sin(Math.PI * lam);
      e = a ? 10 : 168;
    } else {
      const out = f < 0.5;
      const g = out ? (f - 0.2) / 0.3 : (f - 0.7) / 0.3;
      z = out ? lerp(together, apart, smooth(g)) : lerp(apart, together, smooth(g));
      k = lerp(8, 22, smooth(g));
      rise = 0.07 * 4 * g * (1 - g);
      e = out ? lerp(10, 168, smooth(g)) : lerp(168, 10, smooth(g));
    }
    const dz = z - 0.085;
    const hy = BALL + Math.sqrt(Math.max(0.3, legSpan(k) ** 2 - dz * dz)) + rise;
    return pose(jackFeet(hy, z, z, BALL, -25, rise), armsOut(e), { neck: { flex: 0 } });
  }, 0.5);
}

function stepJacks(): Cycle {
  const together = 0.1;
  const wide = 0.36;
  return cycle((u) => {
    const b = 4 * u;
    const i = Math.min(3, Math.floor(b));
    const m = smooth((b - i) / 0.6);
    const goingOut = i % 2 === 0;
    const side = i < 2 ? 'r' : 'l';
    const zs = goingOut ? lerp(together, wide, m) : lerp(wide, together, m);
    const zr = side === 'r' ? zs : together;
    const zl = side === 'l' ? zs : together;
    const e = goingOut ? lerp(10, 168, m) : lerp(168, 10, m);
    const lift = 0.05 * Math.sin(Math.PI * m);
    const dz = Math.max(zr, zl) - 0.085;
    const hy = 0.075 + Math.sqrt(Math.max(0.3, legSpan(20) ** 2 - dz * dz));
    const trunk: Trunk = { root: [0, hy + 0.02, 0], lean: 0 };
    const foot = (S: Side, z: number): Reach => ({
      p: [0, 0.075 + (S === side ? lift : 0), S === 'r' ? z : -z],
    });
    return pose(
      { root: { pos: trunk.root, lean: 0 } },
      reach(trunk, 'leg', 'r', foot('r', zr)),
      reach(trunk, 'leg', 'l', foot('l', zl)),
      armsOut(e),
    );
  }, 0.45);
}

/* ------------------------------------------------------------------ */
/* Stationary bike                                                     */
/* ------------------------------------------------------------------ */

const CRANK: V = [0.12, 0.3, 0];
const CRANK_R = 0.17;
const BIKE_HIP: [number, number] = [0, 1.015];
const BIKE_LEAN = 14;
const BARS: V = [0.46, 1.085, 0.2];

function bikeProps(): AnimationProp[] {
  const E: Machine = 'stationary-bike';
  const strap = (S: Side): AnimationProp => ({
    kind: 'strap',
    id: `crank.${S}`,
    group: `handle.${S}`,
    equipment: E,
    from: { frame: `ankle.${S}`, at: [0.1, -0.095, 0] },
    to: [CRANK[0], CRANK[1], S === 'r' ? 0.11 : -0.11],
    r: 0.014,
  });
  return [
    part('base', [-0.5, 0.03, 0], [0.72, 0.03, 0], 0.03, 'handle', E),
    part('frame', [-0.3, 0.03, 0], CRANK, 0.025, 'handle', E),
    part('seat-tube', [-0.07, 0.905, 0], CRANK, 0.025, 'handle', E),
    part('saddle', [-0.15, 0.92, 0], [0.09, 0.93, 0], 0.032, 'handle', E),
    part('down-tube', CRANK, [0.46, 0.735, 0], 0.025, 'handle', E),
    part('stem', [0.46, 0.735, 0], [BARS[0], BARS[1], 0], 0.022, 'handle', E),
    part('bars', [BARS[0], BARS[1], -BARS[2]], BARS, 0.018, 'handle', E),
    disc('flywheel', [0.46, 0.38, 0], 0.17, 'handle', E),
    part('fork', [0.46, 0.03, 0], [0.46, 0.38, 0], 0.02, 'handle', E),
    disc('chainring', CRANK, 0.05, 'handle', E),
    strap('r'),
    strap('l'),
  ];
}

/** Hands on the bars. */
const bikePins: AnimationPin[] = (['l', 'r'] as const).map((S) => ({
  contact: `hand.${S}`,
  mode: 'plant',
  at: [BARS[0], BARS[1], S === 'l' ? -BARS[2] : BARS[2]],
  rest: 'grip',
  pole: { frame: 'chest', dir: [-0.5, -1, 0.5] },
}));

function bike(): Cycle {
  const foot = (a: number): Foot => {
    // The ball of the foot rides on the pedal, the sole tilting a little through the turn.
    const pitch = -6 - 8 * Math.cos(a);
    const p = rad(pitch);
    const ball: [number, number] = [
      CRANK[0] + CRANK_R * Math.sin(a),
      CRANK[1] + CRANK_R * Math.cos(a) + 0.02,
    ];
    const ox = 0.1 * Math.cos(p) + 0.075 * Math.sin(p);
    const oy = 0.1 * Math.sin(p) - 0.075 * Math.cos(p);
    return { ankle: [ball[0] - ox, ball[1] - oy], foot: pitch, rot: -3 };
  };
  return scripted((t) => {
    const a = (2 * Math.PI * 4 * t) / LOOP;
    return body(
      BIKE_HIP,
      BIKE_LEAN,
      { r: foot(a), l: foot(a + Math.PI) },
      {
        neck: { flex: -6 },
        shoulder: { plane: 90, elev: 62, rot: 0 },
        elbow: { flex: 40 },
      },
    );
  }, 0.4);
}

/* ------------------------------------------------------------------ */
/* Rowing machine                                                      */
/* ------------------------------------------------------------------ */

const ANKLE_ROW: [number, number] = [0, 0.34];
const PLATE = 40;
const PLATE_NORMAL: V = [-Math.sin(rad(PLATE)), Math.cos(rad(PLATE)), 0];
const FLYWHEEL: V = [0.74, 0.52, 0];
const ROW_HIP_Y = 0.365;

function rowerProps(): AnimationProp[] {
  const E: Machine = 'rower';
  // The plate under the soles: a line through the point the sole rests on, along the slope.
  const s: V = [ANKLE_ROW[0] - PLATE_NORMAL[0] * 0.075, ANKLE_ROW[1] - PLATE_NORMAL[1] * 0.075, 0];
  const dir: V = [Math.cos(rad(PLATE)), Math.sin(rad(PLATE)), 0];
  const chain = (S: Side): AnimationProp => ({
    kind: 'strap',
    id: `chain.${S}`,
    group: `handle.${S}`,
    equipment: E,
    hand: S,
    to: FLYWHEEL,
    r: 0.007,
  });
  return [
    part('rail', [-1.15, 0.26, 0], [0.45, 0.26, 0], 0.03, 'handle', E),
    part('rear-leg', [-1.1, 0.26, 0], [-1.1, 0.03, 0], 0.03, 'handle', E),
    part('front-leg', [0.42, 0.26, 0], [0.42, 0.03, 0], 0.03, 'handle', E),
    disc('flywheel', [0.62, 0.36, 0], 0.2, 'handle', E),
    part('plate', vsub(s, vmul(dir, 0.12)), vadd(s, vmul(dir, 0.22)), 0.014, 'handle', E),
    // The seat slides with the pelvis along the rail; the handle is held in both fists.
    {
      kind: 'box',
      id: 'seat',
      group: 'handle',
      equipment: E,
      frame: 'root',
      slide: true,
      min: [-0.14, 0.27, -0.1],
      max: [0.12, 0.3, 0.1],
    },
    {
      kind: 'capsule',
      id: 'handle',
      group: 'handle',
      equipment: E,
      a: { frame: 'wrist.l', at: GRIP },
      b: { frame: 'wrist.r', at: GRIP },
      r: 0.016,
    },
    chain('r'),
    chain('l'),
  ];
}

const rowerPins: AnimationPin[] = (['l', 'r'] as const).map((S) => ({
  contact: `foot.${S}`,
  mode: 'plant',
  at: [
    ANKLE_ROW[0] - PLATE_NORMAL[0] * 0.075,
    ANKLE_ROW[1] - PLATE_NORMAL[1] * 0.075,
    S === 'l' ? -0.09 : 0.09,
  ],
  normal: PLATE_NORMAL,
}));

function rower(): Cycle {
  return scripted((t) => {
    // The legs drive first, then the back swings, then the arms pull; the recovery is the reverse.
    const hx = track(
      [
        [0, -0.826],
        [0.8, -0.826],
        [1.4, -0.31],
        [1.65, -0.31],
        [2.25, -0.826],
        [3.35, -0.826],
      ],
      t,
    );
    const lean = track(
      [
        [0, -24],
        [0.45, -24],
        [1.1, 26],
        [1.65, 26],
        [2.0, 26],
        [2.6, -24],
        [3.35, -24],
      ],
      t,
    );
    const ext = track(
      [
        [0, 0.27],
        [0.5, 0.515],
        [2.3, 0.515],
        [2.75, 0.27],
        [3.35, 0.27],
      ],
      t,
    );
    const hip: [number, number] = [hx, ROW_HIP_Y];
    const trunk: Trunk = {
      root: [hx + 0.02 * Math.sin(rad(lean)), ROW_HIP_Y + 0.02 * Math.cos(rad(lean)), 0],
      lean,
    };
    const pull = clamp((0.515 - ext) / 0.245, 0, 1);
    const hand = (S: Side): Reach => {
      const sh = shoulderAt(trunk, S);
      const toward = vnorm(vsub(FLYWHEEL, [sh[0], sh[1], 0]));
      const p = vadd(vadd(sh, vmul(toward, ext)), [0, -0.17 * pull, S === 'r' ? -0.07 : 0.07]);
      return { p: [p[0], p[1], S === 'r' ? 0.09 : -0.09], pole: [-1, 0.1, S === 'r' ? 0.4 : -0.4] };
    };
    const plate = { ankle: ANKLE_ROW, foot: PLATE, rot: -3 } as Foot;
    return pose(
      body(hip, lean, { l: plate, r: plate }, { neck: { flex: -lean * 0.4 } }),
      reach(trunk, 'arm', 'r', hand('r')),
      reach(trunk, 'arm', 'l', hand('l')),
    );
  }, 1.3);
}

/* ------------------------------------------------------------------ */
/* On the hands: climbers, crawling, squat thrust and burpee           */
/* ------------------------------------------------------------------ */

const PLANK_VIEW = { yaw: 30, pitch: 16 };
/** The push-up position: palms 1.187 m ahead of the toes, the body 17° from level. */
const HANDS_X = 1.187;
const HANDS_Z = 0.215;
const PLANK_LEAN = 72.88;
const PLANK_TOES: Foot = { ankle: [0.026, 0.176], foot: -81, rot: 0 };
/** The climbers' shoulders: those of the push-up, kept over the hands. */
const CLIMB_SHOULDERS: V = [1.232, 0.554, 0];
const CLIMB_LEAN = 79.5;

function mountainClimber(): Cycle {
  // A leg drives in, stays, then goes back and stays: the switch is quick, with a dwell at each end.
  const reachOf = (phi: number) => {
    const p = frac(phi);
    if (p < 0.3) return smooth(p / 0.3);
    if (p < 0.5) return 1;
    if (p < 0.8) return 1 - smooth((p - 0.5) / 0.3);
    return 0;
  };
  return scripted((t) => {
    const th = (4 * t) / LOOP;
    const p = frac(th);
    // The hips rise a few centimetres as the legs pass, so a knee clears the floor; the shoulders stay put.
    const pass =
      p < 0.3
        ? Math.sin((Math.PI * p) / 0.3)
        : p >= 0.5 && p < 0.8
          ? Math.sin((Math.PI * (p - 0.5)) / 0.3)
          : 0;
    const trunk = trunkFrom(CLIMB_SHOULDERS, CLIMB_LEAN + 6 * pass);
    const foot = (phi: number): Reach => {
      const s = reachOf(phi);
      return {
        p: [lerp(0.025, 0.75, s), 0.176 + 0.03 * s + 0.045 * Math.sin(Math.PI * s), 0.085],
        pitch: lerp(-81, -50, s),
      };
    };
    const right = foot(th);
    const left = foot(th + 0.5);
    left.p[2] = -0.085;
    return pose(
      figure(trunk, { feet: { r: right, l: left } }, { neck: { flex: -8 } }),
      ARMS_STRAIGHT,
    );
  }, 0.3);
}

/** The palms flat on the floor, shoulder-width apart, elbows back and out (as in a push-up). */
function palmsOnFloor(): AnimationPin[] {
  return (['l', 'r'] as const).map((S) => ({
    contact: `hand.${S}`,
    mode: 'plant',
    at: [HANDS_X, 0, S === 'l' ? -HANDS_Z : HANDS_Z],
    pole: { frame: 'chest', dir: [-0.55, -0.62, 0.56] },
  }));
}

/** A limb's foot or hand along a stride: the stance slides back under it, the swing carries it forward. */
function crawlPath(phi: number, front: number, back: number, lift: number): [number, number] {
  const p = frac(phi);
  if (p < 0.5) return [lerp(front, back, p / 0.5), 0];
  const u = (p - 0.5) / 0.5;
  return [lerp(back, front, smooth(u)), lift * Math.sin(Math.PI * u)];
}

function bearCrawl(): Cycle {
  return scripted((t) => {
    const th = (3 * t) / LOOP;
    const trunk: Trunk = { root: [0, 0.52 + 0.008 * Math.sin(4 * Math.PI * th), 0], lean: 87 };
    const hand = (S: Side, phi: number): Reach => {
      const sh = shoulderAt(trunk, S);
      const [dx, lift] = crawlPath(phi, 0.11, -0.11, 0.1);
      return {
        p: [sh[0] + dx, 0.033 + lift, S === 'r' ? 0.2 : -0.2],
        flat: 1 - Math.min(0.5, Math.max(0, lift - 0.03) * 7),
        pole: [-0.4, 0, S === 'r' ? 1 : -1],
      };
    };
    const footAt = (S: Side, phi: number): Reach => {
      const [dx, lift] = crawlPath(phi, -0.2, -0.44, 0.14);
      return { p: [dx, 0.18 + lift, S === 'r' ? 0.15 : -0.15], pitch: -70 + lift * 120 };
    };
    // A right hand goes with the left foot, and the other pair half a stride later.
    return figure(
      trunk,
      {
        hands: { r: hand('r', th), l: hand('l', th + 0.5) },
        feet: { l: footAt('l', th), r: footAt('r', th + 0.5) },
      },
      { neck: { flex: -18 } },
    );
  }, 0.3);
}

/* Squat thrust and burpee share one script: the hands stay put on the floor while the feet go back. */

const HAND_FLOOR = (S: Side): V => [HANDS_X, 0.037, S === 'r' ? HANDS_Z : -HANDS_Z];
const STAND_X = 0.92;
/** The shoulders' middle with the hands on the floor, and when standing. */
const SHOULDERS_DOWN: V = [1.234, 0.5575, 0];
const SHOULDERS_UP: V = [STAND_X, 1.345, 0];

/** A trunk leaning `lean` with the middle of the shoulders at `sh`. */
const trunkFrom = (sh: V, lean: number): Trunk => ({
  root: vsub(sh, world(leanAxes(lean), [-0.005, 0.415, 0])),
  lean,
});

interface Hands {
  /** 0 hanging, 1 flat on the floor. */
  floor: number;
  /** 0 not overhead, 1 straight overhead. */
  over: number;
}

function onHands(trunk: Trunk, feet: Limbs['feet'], h: Hands, neck: number): AnimationPose {
  const hand = (S: Side): Reach => {
    const sh = shoulderAt(trunk, S);
    const z = S === 'r' ? 1 : -1;
    const hang: V = [sh[0] + 0.03, sh[1] - 0.5, z * 0.2];
    const over: V = [sh[0] + 0.26, sh[1] + 0.4553, z * 0.14];
    const p = vlerp(vlerp(hang, HAND_FLOOR(S), h.floor), over, h.over);
    return { p, flat: h.floor * (1 - h.over), pole: [-0.6, 0.0, z * 0.7] };
  };
  return figure(trunk, { hands: { l: hand('l'), r: hand('r') }, feet }, { neck: { flex: neck } });
}

/** A foot between its place under the body (`b` = 0) and its place in the plank (`b` = 1), with a lift. */
function footBetween(S: Side, b: number, lift: number, air = 0, tuck = 0): Reach {
  const z = S === 'r' ? 1 : -1;
  const under: V = [STAND_X, 0.081, z * 0.11];
  const back: V = [PLANK_TOES.ankle[0], PLANK_TOES.ankle[1], z * 0.085];
  const p = vlerp(under, back, b);
  return { p: [p[0], p[1] + lift + air, p[2]], pitch: lerp(0, -81, b) - tuck };
}

function squatThrust(): Cycle {
  return scripted((t) => {
    const e = track(
      [
        [0, 0],
        [0.6, 1],
        [2.2, 1],
        [2.75, 0],
        [3.35, 0],
      ],
      t,
    );
    // The hips rise while the feet go back and come in; the shoulders stay over the hands.
    const lean = track(
      [
        [0, 0],
        [0.55, 62],
        [0.72, 95],
        [1.2, 95],
        [1.4, PLANK_LEAN],
        [1.65, PLANK_LEAN],
        [1.72, 95],
        [2.05, 95],
        [2.3, 62],
        [2.75, 0],
        [3.35, 0],
      ],
      t,
    );
    const back = (a: number, b: number, c: number, d: number) =>
      track(
        [
          [0, 0],
          [a, 0],
          [b, 1],
          [c, 1],
          [d, 0],
          [3.35, 0],
        ],
        t,
      );
    const bR = back(0.6, 0.95, 1.7, 2.0);
    const bL = back(0.9, 1.25, 1.95, 2.25);
    const trunk = trunkFrom(vlerp(SHOULDERS_UP, SHOULDERS_DOWN, e), lean);
    return onHands(
      trunk,
      {
        r: footBetween('r', bR, 0.09 * Math.sin(Math.PI * bR)),
        l: footBetween('l', bL, 0.09 * Math.sin(Math.PI * bL)),
      },
      { floor: e, over: 0 },
      -Math.min(lean * 0.1, 7),
    );
  }, 1.3);
}

function burpee(): Cycle {
  return scripted((t) => {
    const jumpBack = (a: number, b: number) => arc(t, a, b, 0.1);
    const up = (t - 2.25) / 0.25;
    const air = t > 2.25 && t < 2.5 ? 0.18 * 4 * up * (1 - up) : 0;
    const e = track(
      [
        [0, 0],
        [0.55, 1],
        [2.0, 1],
        [2.3, 0],
        [3.35, 0],
      ],
      t,
    );
    const sh = vlerp(SHOULDERS_UP, SHOULDERS_DOWN, e);
    // Landing from the jump bends the knees: the shoulders sink a little before the stand.
    sh[1] +=
      air +
      track(
        [
          [2.25, 0],
          [2.5, -0.1],
          [2.75, 0],
        ],
        t,
      );
    const lean = track(
      [
        [0, 0],
        [0.55, 62],
        [0.72, 95],
        [0.85, 95],
        [1.0, PLANK_LEAN],
        [1.65, PLANK_LEAN],
        [1.75, 95],
        [1.95, 95],
        [2.05, 62],
        [2.25, 0],
        [3.35, 0],
      ],
      t,
    );
    const b = track(
      [
        [0, 0],
        [0.6, 0],
        [0.85, 1],
        [1.7, 1],
        [1.95, 0],
        [3.35, 0],
      ],
      t,
    );
    const lift = jumpBack(0.6, 0.85) + jumpBack(1.7, 1.95);
    const tuck = (air > 0 ? 35 * Math.sin(Math.PI * up) : 0) + (lift > 0 ? 10 : 0);
    const over = track(
      [
        [0, 0],
        [2.05, 0],
        [2.3, 1],
        [2.6, 1],
        [3.0, 0],
        [3.35, 0],
      ],
      t,
    );
    const trunk = trunkFrom(sh, lean);
    const feet = {
      r: footBetween('r', b, lift, air, tuck),
      l: footBetween('l', b, lift, air, tuck),
    };
    return onHands(
      trunk,
      feet,
      { floor: e, over },
      -Math.min(lean * 0.1, 7) + (over > 0.5 ? 4 : 0),
    );
  }, 0.72);
}

/* ------------------------------------------------------------------ */
/* Weights: thruster and kettlebell high pull                          */
/* ------------------------------------------------------------------ */

const FEET_FLAT = (z: number, pitch = 0): Limbs['feet'] => ({
  l: { p: [0, 0.075, -z], pitch, pole: [1, 0, -0.25] },
  r: { p: [0, 0.075, z], pitch, pole: [1, 0, 0.25] },
});

function thruster(): Cycle {
  return scripted((t) => {
    const hx = track(
      [
        [0, 0],
        [0.65, 0],
        [1.4, -0.25],
        [1.65, -0.25],
        [2.3, 0],
        [3.35, 0],
      ],
      t,
    );
    const hy = track(
      [
        [0, 0.905],
        [0.65, 0.905],
        [1.4, 0.45],
        [1.65, 0.45],
        [2.3, 0.905],
        [3.35, 0.905],
      ],
      t,
    );
    const lean = track(
      [
        [0, 0],
        [0.65, 0],
        [1.4, 26],
        [1.65, 26],
        [2.3, 0],
        [3.35, 0],
      ],
      t,
    );
    const press = track(
      [
        [0, 1],
        [0.2, 1],
        [0.65, 0],
        [1.65, 0],
        [2.0, 0],
        [2.7, 1],
        [3.35, 1],
      ],
      t,
    );
    const trunk: Trunk = {
      root: [hx + 0.02 * Math.sin(rad(lean)), hy + 0.02 * Math.cos(rad(lean)), 0],
      lean,
    };
    const hand = (S: Side): Reach => {
      const z = S === 'r' ? 1 : -1;
      const rack = onChest(trunk, [0.13, 0.17, z * 0.17]);
      const sh = shoulderAt(trunk, S);
      // Slightly forward of vertical, so the shoulder's plane stays steady through the lockout.
      const over: V = [sh[0] + 0.07, sh[1] + 0.52, z * 0.13];
      return { p: vlerp(rack, over, press), pole: [1 - press, -0.4, z * 0.5] };
    };
    return figure(
      trunk,
      {
        hands: { l: hand('l'), r: hand('r') },
        feet: FEET_FLAT(0.11),
      },
      { neck: { flex: -lean * 0.5 } },
    );
  }, 1.4);
}

function highPull(): Cycle {
  return scripted((t) => {
    const hx = track(
      [
        [0, 0],
        [0.25, 0],
        [1.4, -0.2],
        [1.65, -0.2],
        [2.3, 0],
        [3.35, 0],
      ],
      t,
    );
    const hy = track(
      [
        [0, 0.908],
        [0.25, 0.908],
        [1.4, 0.8],
        [1.65, 0.8],
        [2.3, 0.908],
        [3.35, 0.893],
      ],
      t,
    );
    const lean = track(
      [
        [0, -3],
        [0.25, -3],
        [1.4, 68],
        [1.65, 68],
        [2.3, -3],
        [3.35, -3],
      ],
      t,
    );
    const up = track(
      [
        [0, 1],
        [0.25, 1],
        [1.4, 0],
        [1.65, 0],
        [2.4, 1],
        [3.35, 1],
      ],
      t,
    );
    const trunk: Trunk = {
      root: [hx + 0.02 * Math.sin(rad(lean)), hy + 0.02 * Math.cos(rad(lean)), 0],
      lean,
    };
    const shR = shoulderAt(trunk, 'r');
    const shL = shoulderAt(trunk, 'l');
    const low: V = [shR[0] + 0.03, shR[1] - 0.505, 0.07];
    // The bell comes to the upper chest, the elbow out at shoulder height or a little below.
    const chin = onChest(trunk, [0.12, 0.22, 0.09]);
    const right: Reach = {
      p: vlerp(low, chin, up),
      pole: vlerp([-0.4, 0, 0.5], [0.15, -0.05, 1.3], up),
    };
    const left: Reach = { p: [shL[0] + 0.05, shL[1] - 0.48, -0.17], pole: [-0.3, -0.2, -1] };
    return figure(
      trunk,
      {
        hands: { r: right, l: left },
        feet: {
          l: { p: [0, 0.075, -0.2], pole: [1, 0, -0.4] },
          r: { p: [0, 0.075, 0.2], pole: [1, 0, 0.4] },
        },
      },
      { neck: { flex: -Math.max(0, lean) * 0.5 } },
    );
  }, 0.2);
}

/* ------------------------------------------------------------------ */
/* Shadow boxing                                                       */
/* ------------------------------------------------------------------ */

/** A punch out and back: the share (0..1) of the way to full extension at time `t`. */
const punch = (t: number, t0: number, t1: number, t2: number) =>
  track(
    [
      [t0, 0],
      [t1, 1],
      [t2, 0],
    ],
    t,
  );

function shadowBoxing(): Cycle {
  return scripted((t) => {
    // Left foot forward: the left hand leads (the far arm from the camera).
    const bob = 0.012 * Math.sin((2 * Math.PI * t * 2.4) / 1.0);
    // A slip: the head and trunk go to the side of the line, the guard stays up.
    const slip = track(
      [
        [0, 0],
        [2.3, 0],
        [2.55, 1],
        [2.85, 1],
        [3.1, 0],
        [3.35, 0],
      ],
      t,
    );
    const jab = punch(t, 0.25, 0.35, 0.5);
    const cross1 = punch(t, 0.75, 0.9, 1.05);
    const hook = punch(t, 1.4, 1.55, 1.75);
    const cross2 = punch(t, 2.0, 2.1, 2.3);
    const forward = 0.05 * Math.max(jab, cross1, cross2) + 0.02 * hook;
    const lean = 6 + 5 * Math.max(cross1, cross2) + 4 * slip;
    const root: V = [0.05 + forward, 0.865 + bob - 0.03 * slip, -0.11 * slip];
    // The trunk turns with the crosses (the left shoulder forward at rest).
    const turnAngle = -8 + 4 * jab - 12 * Math.max(cross1, cross2);
    const trunk: Trunk = { root, lean, turn: turnAngle, tilt: -13 * slip };
    const dir: V = [Math.cos(rad(turnAngle)), 0, -Math.sin(rad(turnAngle))];
    const shL = shoulderAt(trunk, 'l');
    const shR = shoulderAt(trunk, 'r');
    const guardL = onChest(trunk, [0.2, 0.3, -0.1]);
    const guardR = onChest(trunk, [0.17, 0.28, 0.1]);
    const guardPole = (z: number): V => [-0.3, -1, z * 0.6];
    // The jab and the crosses run straight from the shoulder, the elbow a little short of locked.
    const straightFrom = (sh: V): V => [
      sh[0] + 0.518 * dir[0],
      sh[1] - 0.02,
      sh[2] + 0.518 * dir[2],
    ];
    const hookFrom = (sh: V, phi: number): V => [
      sh[0] + 0.372 * Math.cos(rad(phi)),
      sh[1] - 0.02,
      sh[2] - 0.372 * Math.sin(rad(phi)),
    ];
    const hookPhi = lerp(78, 22, smooth((t - 1.4) / 0.2));
    const left: Reach = {
      p: vlerp(vlerp(guardL, straightFrom(shL), jab), hookFrom(shL, hookPhi), hook),
      pole: [-0.3, -1 + 0.8 * hook, -0.6 - 0.8 * hook],
    };
    const cross = Math.max(cross1, cross2);
    const right: Reach = {
      p: vlerp(guardR, straightFrom(shR), cross),
      pole: guardPole(1),
    };
    return figure(
      trunk,
      {
        hands: { l: left, r: right },
        feet: {
          l: { p: [0.22 + forward, 0.075, -0.14], pole: [1, 0, -0.3] },
          r: { p: [-0.06, 0.12, 0.14], pitch: -14, pole: [1, 0, 0.3] },
        },
      },
      { neck: { flex: -3 } },
    );
  }, 0.35);
}

/* ------------------------------------------------------------------ */
/* Skater steps and bounds                                             */
/* ------------------------------------------------------------------ */

interface Skater {
  /** Where each foot stands to either side of the middle, and how far the other crosses behind. */
  span: number;
  cross: number;
  /** Share of a step spent in the air (0: a step), and how high the body rises. */
  flight: number;
  height: number;
  /** Knee bend carrying the weight (degrees). */
  bend: number;
  /** Seconds into the loop at which the still is taken. */
  still: number;
}

function skater(k: Skater): Cycle {
  return scripted((t) => {
    // Four steps in the loop: right, left, right, left.
    const s = (4 * t) / LOOP;
    const i = Math.min(3, Math.floor(s));
    const lam = s - i;
    const d = i % 2 === 0 ? 1 : -1;
    const side: Side = d > 0 ? 'l' : 'r'; // the foot the weight leaves
    const other: Side = d > 0 ? 'r' : 'l';
    const zOf = (S: Side, z: number) => (S === 'r' ? z : -z);
    // The air time starts after a load; the stepping foot lands at the end of it.
    const lift0 = k.flight > 0 ? 0.3 : 0.15;
    const land = k.flight > 0 ? lift0 + k.flight : 0.5;
    const settle = (x: number) => smooth(x);
    // The weight moves from the old foot to the new one.
    const shift = settle((lam - (k.flight > 0 ? 0.15 : 0.12)) / (land - 0.1));
    const zs0 = -d * k.span;
    const zs1 = d * k.span;
    const supportZ = lerp(zs0 + d * 0.085, zs1 - d * 0.085, shift);
    const air = k.flight > 0 && lam > lift0 && lam < land ? (lam - lift0) / k.flight : -1;
    const rise = air >= 0 ? k.height * 4 * air * (1 - air) : 0;
    const dip = k.bend > 0 ? 0.03 * Math.sin(Math.PI * clamp((lam - land) / (1 - land), 0, 1)) : 0;
    const stepNo = lam < land ? settle(lam / land) : 1;
    const loadLeg = legSpan(k.bend);
    // The hips sit back of the feet as the trunk hinges.
    const hy =
      0.075 + Math.sqrt(loadLeg ** 2 - 0.16 ** 2) - 0.025 * Math.sin(Math.PI * lam) - dip + rise;
    const trunk: Trunk = { root: [-0.12, hy + 0.02, supportZ], lean: 36 };

    // The stepping foot swings out from behind the standing leg to where it lands.
    const f0: V = [-0.16, 0.15, -d * (k.span + k.cross)];
    const f1: V = [0.04, 0.075, d * k.span];
    const fp = vlerp(f0, f1, stepNo);
    const swingLift = air >= 0 ? 0 : 0.11 * Math.sin(Math.PI * stepNo);
    const free: Reach = {
      p: [fp[0], fp[1] + swingLift + (air >= 0 ? rise + 0.02 : 0), fp[2]],
      pitch: lam < land ? -35 + 25 * stepNo : 0,
      pole: [1, 0, 0],
    };
    // The foot the weight leaves pushes off, then crosses behind the new standing leg.
    const back =
      k.flight > 0 ? clamp((lam - lift0) / (1 - lift0), 0, 1) : clamp((lam - 0.5) / 0.5, 0, 1);
    const g0: V = [0.04, 0.075, zs0];
    const g1: V = [-0.16, 0.15, d * (k.span + k.cross)];
    const gp = vlerp(g0, g1, settle(back));
    const trail: Reach = {
      p: [gp[0], gp[1] + 0.1 * Math.sin(Math.PI * settle(back)) + (air >= 0 ? rise : 0), gp[2]],
      pitch: -35 * settle(back),
      pole: [1, 0, 0],
    };
    // Arms swing across the body against the step.
    const swing = (2 * settle(lam) - 1) * -d;
    const hand = (S: Side): Reach => {
      const sh = shoulderAt(trunk, S);
      return {
        p: [sh[0] + 0.24, sh[1] - 0.32, supportZ + zOf(S, 0.12) + 0.22 * swing],
        pole: [-0.5, -1, zOf(S, 0.5)],
      };
    };
    return figure(
      trunk,
      {
        hands: { l: hand('l'), r: hand('r') },
        feet: { [side]: trail, [other]: free },
      },
      { neck: { flex: -6 } },
    );
  }, k.still);
}

//@@SECTIONS@@

export const cardioAnimations = {
  'treadmill-walk': asAnimation(gait({ ...WALK, back: 0.15 }), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: treadmill(0),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'treadmill-incline-walk': asAnimation(gait({ ...WALK, slope: 8, lean: 7, back: 0.15 }), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: treadmill(8),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'treadmill-run': asAnimation(gait({ ...RUN, back: 0.15 }), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: treadmill(0),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'brisk-walk': asAnimation(gait({ ...WALK, deck: 0, swing: 32, elbow: [55, 85], lean: 2 }), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: [],
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'march-in-place': asAnimation(hopper(MARCH), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: [],
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'high-knees': asAnimation(hopper(HIGH_KNEES), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: [],
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'jump-rope-bounce': asAnimation(hopper(ROPE_BOUNCE), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: ropeFor(ROPE_BOUNCE),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'jump-rope-alternate-foot': asAnimation(hopper(ROPE_ALTERNATE), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: ropeFor(ROPE_ALTERNATE),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'jump-rope-high-knees': asAnimation(hopper(ROPE_KNEES), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: ropeFor(ROPE_KNEES),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'jump-rope-double-under': asAnimation(hopper(ROPE_DOUBLE), {
    camera: SIDE_VIEW,
    pins: NONE,
    props: ropeFor(ROPE_DOUBLE),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'jumping-jacks': asAnimation(jumpingJacks(), {
    camera: FRONT_VIEW,
    pins: NONE,
    props: [],
    working: ARMS_AND_LEGS,
    perSide: false,
    cycle: true,
  }),
  'step-jacks': asAnimation(stepJacks(), {
    camera: FRONT_VIEW,
    pins: NONE,
    props: [],
    working: ARMS_AND_LEGS,
    perSide: false,
    cycle: true,
  }),
  'stationary-bike-ride': asAnimation(bike(), {
    camera: { yaw: 14, pitch: 6 },
    pins: bikePins,
    props: bikeProps(),
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'rowing-machine': asAnimation(rower(), {
    camera: { yaw: 14, pitch: 6 },
    pins: rowerPins,
    props: rowerProps(),
    working: LEGS,
    perSide: false,
  }),
  'mountain-climber': asAnimation(mountainClimber(), {
    camera: PLANK_VIEW,
    pins: palmsOnFloor(),
    props: [],
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'bear-crawl': asAnimation(bearCrawl(), {
    camera: { yaw: 24, pitch: 12 },
    pins: NONE,
    props: [],
    working: ['arm.l', 'arm.r', 'leg.l', 'leg.r'],
    perSide: false,
    cycle: true,
  }),
  'squat-thrust': asAnimation(squatThrust(), {
    camera: PLANK_VIEW,
    pins: NONE,
    props: [],
    working: LEGS,
    perSide: false,
  }),
  burpee: asAnimation(burpee(), {
    camera: PLANK_VIEW,
    pins: NONE,
    props: [],
    working: LEGS,
    perSide: false,
    cycle: true,
  }),
  'dumbbell-thruster': asAnimation(thruster(), {
    camera: { yaw: 24, pitch: 8 },
    pins: NONE,
    props: [weightIn('l', { bell: 'back' }), weightIn('r', { bell: 'back' })],
    working: LEGS,
    perSide: false,
  }),
  'kettlebell-high-pull': asAnimation(highPull(), {
    camera: { yaw: 38, pitch: 8 },
    pins: NONE,
    props: [weightIn('r', { kind: 'kettlebell', bell: 'down' })],
    working: ['arm.r'],
    perSide: true,
  }),
  'shadow-boxing': asAnimation(shadowBoxing(), {
    camera: { yaw: 38, pitch: 6 },
    pins: NONE,
    props: [],
    working: ['arm.l', 'arm.r'],
    perSide: false,
    cycle: true,
  }),
  'skater-step': asAnimation(
    skater({ span: 0.3, cross: 0.1, flight: 0, height: 0, bend: 40, still: 0.6 }),
    {
      camera: { yaw: 62, pitch: 8 },
      pins: NONE,
      props: [],
      working: LEGS,
      perSide: false,
      cycle: true,
    },
  ),
  'skater-jump': asAnimation(
    skater({ span: 0.42, cross: 0.1, flight: 0.35, height: 0.1, bend: 40, still: 0.6 }),
    {
      camera: { yaw: 62, pitch: 8 },
      pins: NONE,
      props: [],
      working: LEGS,
      perSide: false,
      cycle: true,
    },
  ),
} satisfies Record<string, ExerciseAnimation>;
