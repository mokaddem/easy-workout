/**
 * Paint order of the figure's part groups, far to near. Pure TypeScript.
 *
 * Each group is one path in the picture, so the order is per group, not per part. It starts from
 * the mean depth of each group's parts (the fallback). Then, at sample points where the outlines
 * of parts from different groups overlap on screen, it compares the true front depth of each
 * group there and lets the points vote, per pair of groups, for "A is painted before B". The
 * groups are sorted so that every clear vote holds, taking the fallback order among the free
 * ones. Overlaps with no right answer (a limb at its joint, a hand at its wrist, a held prop at
 * the fist, solids that pass through each other) do not vote; where nothing votes, a limb on the
 * side turned away from the camera goes behind the torso and one on the near side in front of it,
 * the same in every frame.
 */
import type { Camera } from './look';
import type { Part } from './parts';
import { dot, type Vec3 } from './pose';

/* ------------------------------------------------------------------ */
/* Tuning                                                              */
/* ------------------------------------------------------------------ */

/** Depth gaps (m) smaller than this are a graze: no verdict. */
const MIN_GAP = 0.005;
/**
 * A sample votes with the square of its depth gap (m), so a deep mistake counts far more than a
 * shallow one, up to this gap so that one deep overlap does not outvote all the rest.
 */
const MAX_GAP = 0.1;
/** Scales a vote (sample weight × gap²) to a convenient size for the thresholds below. */
const VOTE_SCALE = 20;
/** How deep (m) the farther solid's surface may lie inside the nearer one before the overlap is a pass-through. */
const EMBED = 0.01;
/**
 * Least total vote, and least share of the votes, for a rule between two groups: grazing contacts
 * and mixed evidence make no rule, so the order does not flip from frame to frame on them.
 */
const MIN_EVIDENCE = 0.001;
const MIN_SHARE = 0.65;
/**
 * With the previous frame's order known, a pair changes sides only when the evidence for the other
 * side has this share of the votes and some sample shows a depth gap of at least FLIP_GAP (m): a
 * visible mistake. Smaller disagreements keep the order the viewer already saw, so the outline
 * cut does not jump between two groups from frame to frame.
 */
const FLIP_SHARE = 0.9;
const FLIP_GAP = 0.03;
/** A depth gap this large (m) flips a held pair on any clear majority. */
const FLIP_BIG = 0.08;
/** Samples along each capsule's axis. */
const SAMPLES = 3;
/** Grid of samples across a solid with no axis (a box, a wheel). */
const GRID = 3;
/**
 * Rings of samples around each shoulder and hip, just outside the part of a limb that has no
 * right order: radii (in joint radii), points per ring, weight.
 */
const RING_RADII = [1.7, 2.5];
const RING_POINTS = 6;
const RING_WEIGHT = 0.08;
/** Weight of the side-of-the-body prior: below any measured rule, so a cycle drops it first. */
const PRIOR_WEIGHT = 1e-12;
/** Joint radii (m) and the reach around the joint inside which an overlap is part of the joint. */
const JOINT_R = { shoulder: 0.058, hip: 0.075, wrist: 0.032 } as const;
const JOINT_REACH = 1.5;
/** A prop this close (m) to a fist is held by it. */
const HOLD_DIST = 0.05;
/** Where a fist holds a handle, along the hand segment from the wrist, as a share of its length. */
const GRIP_SHARE = 0.75;

/* ------------------------------------------------------------------ */
/* Solids as seen from the camera                                      */
/* ------------------------------------------------------------------ */

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/**
 * A part's solid in screen space: `u` to the right, `v` up, depth into the screen. `span` gives the
 * depth where the view ray through (u, v) enters the solid, or false when the ray misses it.
 */
interface Solid {
  part: Part;
  group: number;
  /** Outline's box on screen. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  kind: 0 | 1 | 2;
  /** Capsule: axis start (u, v, depth), axis vector, first radius, radius change. */
  au: number;
  av: number;
  ad: number;
  du: number;
  dv: number;
  dd: number;
  ra: number;
  dr: number;
  /** The forearm of an arm (the part a held handle presses on). */
  forearm: boolean;
  /** Box (kind 1) or cylinder (kind 2). */
  box: BoxRay | null;
  cyl: CylRay | null;
}

const CAPSULE = 0;
const BOX = 1;
const CYLINDER = 2;

interface BoxRay {
  r: Vec3;
  u: Vec3;
  v: Vec3;
  o: Vec3;
}

interface CylRay {
  c: Vec3;
  ax: Vec3;
  half: number;
  r: number;
  dp: Vec3;
  da: number;
  right: Vec3;
  up: Vec3;
}

/**
 * The front depth of a tapered capsule on a ray. The capsule is the union of the spheres swept
 * along its axis (radius r(s), centre at depth d(s)); on a ray at screen distance ρ(s) from the
 * centre, a sphere's front is d(s) − sqrt(r(s)² − ρ(s)²), defined where g(s) = r² − ρ² is not
 * negative. With g = al·s² + be·s + ga, the front depth is the least of those over s in 0..1.
 * When the capsule is longer on screen than it tapers (al < 0), g is a downward parabola, the
 * front is convex over the span where g ≥ 0 and its slope runs from −∞ to +∞ across it, so the
 * minimum is in closed form (the zero-slope point, clipped to the part of 0..1 that is in the
 * span). Otherwise (a capsule pointing at the camera) the ends are tried. Infinity: the ray misses.
 */
export function frontDepth(d0: number, dd: number, al: number, be: number, ga: number): number {
  if (al > -1e-9) {
    const g1 = al + be + ga;
    const e0 = ga < 0 ? Infinity : d0 - Math.sqrt(ga);
    const e1 = g1 < 0 ? Infinity : d0 + dd - Math.sqrt(g1);
    return e0 < e1 ? e0 : e1;
  }
  const disc = be * be - 4 * al * ga;
  if (disc < 0) return Infinity;
  const m = -be / (2 * al);
  const h = Math.sqrt(disc) / (-2 * al);
  const lo = Math.max(0, m - h);
  const hi = Math.min(1, m + h);
  if (lo > hi) return Infinity;
  // Zero slope: dd = g'/(2 sqrt g); g' = 2·al·(s − m).
  const s = m - (dd * h) / Math.sqrt(dd * dd - al);
  const t = s < lo ? lo : s > hi ? hi : s;
  const g = (al * t + be) * t + ga;
  return d0 + dd * t - Math.sqrt(g > 0 ? g : 0);
}

/** The front depth found by the last successful `span`. */
let out = 0;

/** Front depth of a solid on the ray through (u, v) into `out`; false when it misses. */
function span(s: Solid, u: number, v: number): boolean {
  if (u < s.x0 || u > s.x1 || v < s.y0 || v > s.y1) return false;
  if (s.kind === CAPSULE) {
    const ex = u - s.au;
    const ey = v - s.av;
    const al = s.dr * s.dr - s.du * s.du - s.dv * s.dv;
    const be = 2 * (s.ra * s.dr + ex * s.du + ey * s.dv);
    const ga = s.ra * s.ra - ex * ex - ey * ey;
    // Quick miss: no sphere along the axis reaches the ray.
    if (al < 0) {
      const t = -be / (2 * al);
      const c = t < 0 ? 0 : t > 1 ? 1 : t;
      if ((al * c + be) * c + ga < 0) return false;
    } else if (ga < 0 && al + be + ga < 0) return false;
    const front = frontDepth(s.ad, s.dd, al, be, ga);
    if (front === Infinity) return false;
    out = front;
    return true;
  }
  return s.kind === BOX ? boxSpan(s.box!, u, v) : cylinderSpan(s.cyl!, u, v);
}

/** A box by slab intersection along the view ray, in the box's own 0..1 coordinates. */
function boxSpan(b: BoxRay, u: number, v: number): boolean {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const c0 = u * b.r[k]! + v * b.u[k]! - b.o[k]!;
    const cd = b.v[k]!;
    if (Math.abs(cd) < 1e-12) {
      if (c0 < 0 || c0 > 1) return false;
      continue;
    }
    let a = -c0 / cd;
    let c = (1 - c0) / cd;
    if (a > c) [a, c] = [c, a];
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
  }
  if (t0 > t1) return false;
  out = t0;
  return true;
}

/** A short cylinder (the ab wheel) by ray intersection with its side and its two ends. */
function cylinderSpan(c: CylRay, u: number, v: number): boolean {
  const px = u * c.right[0] + v * c.up[0];
  const py = u * c.right[1] + v * c.up[1];
  const pz = u * c.right[2] + v * c.up[2];
  const X: Vec3 = [px - c.c[0], py - c.c[1], pz - c.c[2]];
  const xa = dot3(X, c.ax);
  const Xp: Vec3 = [X[0] - c.ax[0] * xa, X[1] - c.ax[1] * xa, X[2] - c.ax[2] * xa];
  let lo = Infinity;
  const a = dot3(c.dp, c.dp);
  if (a > 1e-12) {
    const b = 2 * dot3(Xp, c.dp);
    const k = dot3(Xp, Xp) - c.r * c.r;
    const disc = b * b - 4 * a * k;
    if (disc >= 0) {
      const q = Math.sqrt(disc);
      for (const t of [(-b - q) / (2 * a), (-b + q) / (2 * a)])
        if (Math.abs(xa + t * c.da) <= c.half) lo = Math.min(lo, t);
    }
  }
  if (Math.abs(c.da) > 1e-12)
    for (const sgn of [-1, 1]) {
      const t = (sgn * c.half - xa) / c.da;
      const q: Vec3 = [Xp[0] + t * c.dp[0], Xp[1] + t * c.dp[1], Xp[2] + t * c.dp[2]];
      if (dot3(q, q) <= c.r * c.r) lo = Math.min(lo, t);
    }
  if (lo === Infinity) return false;
  out = lo;
  return true;
}

function inverse3(c0: Vec3, c1: Vec3, c2: Vec3): ((p: Vec3) => Vec3) | null {
  const [a, b, c] = [c0[0], c1[0], c2[0]];
  const [d, e, f] = [c0[1], c1[1], c2[1]];
  const [g, h, i] = [c0[2], c1[2], c2[2]];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const m = [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ] as const;
  return (p) => [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ];
}

function solidOf(part: Part, group: number, cam: Camera): Solid | null {
  const proj = (p: Vec3): Vec3 => [dot(p, cam.right), dot(p, cam.up), dot(p, cam.view)];
  if (!part.hull) {
    const A = proj(part.a);
    const B = proj(part.b);
    return {
      part,
      group,
      x0: Math.min(A[0] - part.ra, B[0] - part.rb),
      x1: Math.max(A[0] + part.ra, B[0] + part.rb),
      y0: Math.min(A[1] - part.ra, B[1] - part.rb),
      y1: Math.max(A[1] + part.ra, B[1] + part.rb),
      kind: CAPSULE,
      au: A[0],
      av: A[1],
      ad: A[2],
      du: B[0] - A[0],
      dv: B[1] - A[1],
      dd: B[2] - A[2],
      ra: part.ra,
      dr: part.rb - part.ra,
      forearm: part.id.startsWith('arm.') && part.id.endsWith('/9'),
      box: null,
      cyl: null,
    };
  }
  const h = part.hull;
  const pr = h.map(proj);
  const solid: Solid = {
    part,
    group,
    x0: Math.min(...pr.map((q) => q[0])),
    x1: Math.max(...pr.map((q) => q[0])),
    y0: Math.min(...pr.map((q) => q[1])),
    y1: Math.max(...pr.map((q) => q[1])),
    kind: BOX,
    au: 0,
    av: 0,
    ad: 0,
    du: 0,
    dv: 0,
    dd: 0,
    ra: 0,
    dr: 0,
    forearm: false,
    box: null,
    cyl: null,
  };
  if (h.length === 8) {
    const o = h[0]!;
    const inv = inverse3(sub3(h[4]!, o), sub3(h[2]!, o), sub3(h[1]!, o));
    if (!inv) return null;
    solid.box = { r: inv(cam.right), u: inv(cam.up), v: inv(cam.view), o: inv(o) };
    return solid;
  }
  // A cylinder: two rims of 16 points.
  const mean = (pts: Vec3[]): Vec3 => {
    const m: Vec3 = [0, 0, 0];
    for (const q of pts) {
      m[0] += q[0] / pts.length;
      m[1] += q[1] / pts.length;
      m[2] += q[2] / pts.length;
    }
    return m;
  };
  const c1 = mean(h.slice(0, h.length / 2));
  const c2 = mean(h.slice(h.length / 2));
  const axv = sub3(c2, c1);
  const half = len3(axv) / 2;
  if (half < 1e-9) return null;
  const ax: Vec3 = [axv[0] / (2 * half), axv[1] / (2 * half), axv[2] / (2 * half)];
  const da = dot3(cam.view, ax);
  solid.kind = CYLINDER;
  solid.cyl = {
    c: [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2],
    ax,
    half,
    r: len3(sub3(h[0]!, c1)),
    da,
    dp: [cam.view[0] - ax[0] * da, cam.view[1] - ax[1] * da, cam.view[2] - ax[2] * da],
    right: cam.right,
    up: cam.up,
  };
  return solid;
}

/* ------------------------------------------------------------------ */
/* Joints and held props                                               */
/* ------------------------------------------------------------------ */

/** The body parts whose first end is a joint (ids from `parts.ts`): shoulder, hip and wrist. */
const JOINT_IDS: Record<string, readonly ['shoulder' | 'hip' | 'wrist', 0 | 1]> = {
  'arm.l/7': ['shoulder', 0],
  'arm.r/7': ['shoulder', 1],
  'leg.l/11': ['hip', 0],
  'leg.r/11': ['hip', 1],
  'hand.l/10': ['wrist', 0],
  'hand.r/10': ['wrist', 1],
};

/** Joint positions by side (0 left, 1 right), and where each fist holds a handle. */
interface Joints {
  shoulder: (Vec3 | undefined)[];
  hip: (Vec3 | undefined)[];
  wrist: (Vec3 | undefined)[];
  grip: (Vec3 | undefined)[];
}

function jointsOf(parts: Part[]): Joints {
  const j: Joints = { shoulder: [], hip: [], wrist: [], grip: [] };
  for (const p of parts) {
    const hit = JOINT_IDS[p.id];
    if (!hit || p.hull) continue;
    const [kind, side] = hit;
    j[kind][side] = p.a;
    if (kind === 'wrist')
      j.grip[side] = [
        p.a[0] + (p.b[0] - p.a[0]) * GRIP_SHARE,
        p.a[1] + (p.b[1] - p.a[1]) * GRIP_SHARE,
        p.a[2] + (p.b[2] - p.a[2]) * GRIP_SHARE,
      ];
  }
  return j;
}

/** Distance from a point to a part's surface; for a box or a wheel, to its solid or rim points. */
function surfaceDistance(q: Vec3, p: Part): number {
  if (!p.hull) {
    const ab = sub3(p.b, p.a);
    const l2 = dot3(ab, ab);
    const s = l2 > 1e-12 ? Math.min(1, Math.max(0, dot3(sub3(q, p.a), ab) / l2)) : 0;
    const c: Vec3 = [p.a[0] + ab[0] * s, p.a[1] + ab[1] * s, p.a[2] + ab[2] * s];
    return len3(sub3(q, c)) - (p.ra + (p.rb - p.ra) * s);
  }
  if (p.hull.length === 8) {
    const o = p.hull[0]!;
    const U = sub3(p.hull[4]!, o);
    const V = sub3(p.hull[2]!, o);
    const W = sub3(p.hull[1]!, o);
    const inv = inverse3(U, V, W);
    if (!inv) return Infinity;
    const c = inv(sub3(q, o)).map((x) => Math.min(1, Math.max(0, x))) as Vec3;
    const near: Vec3 = [
      o[0] + U[0] * c[0] + V[0] * c[1] + W[0] * c[2],
      o[1] + U[1] * c[0] + V[1] * c[1] + W[1] * c[2],
      o[2] + U[2] * c[0] + V[2] * c[1] + W[2] * c[2],
    ];
    return len3(sub3(q, near));
  }
  let best = Infinity;
  for (const c of p.hull) best = Math.min(best, len3(sub3(q, c)));
  return best;
}

/**
 * How deep (m) the point on the view ray through (u, v) at depth d lies inside a part's solid;
 * negative outside. A wheel counts as never entered.
 */
function insideBy(cam: Camera, u: number, v: number, d: number, p: Part): number {
  const x = u * cam.right[0] + v * cam.up[0] + d * cam.view[0];
  const y = u * cam.right[1] + v * cam.up[1] + d * cam.view[1];
  const z = u * cam.right[2] + v * cam.up[2] + d * cam.view[2];
  if (!p.hull) {
    const abx = p.b[0] - p.a[0];
    const aby = p.b[1] - p.a[1];
    const abz = p.b[2] - p.a[2];
    const l2 = abx * abx + aby * aby + abz * abz;
    const qx = x - p.a[0];
    const qy = y - p.a[1];
    const qz = z - p.a[2];
    let s = l2 > 1e-12 ? (qx * abx + qy * aby + qz * abz) / l2 : 0;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    const dx = qx - abx * s;
    const dy = qy - aby * s;
    const dz = qz - abz * s;
    return p.ra + (p.rb - p.ra) * s - Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  if (p.hull.length !== 8) return -Infinity;
  const q: Vec3 = [x, y, z];
  const o = p.hull[0]!;
  const U = sub3(p.hull[4]!, o);
  const V = sub3(p.hull[2]!, o);
  const W = sub3(p.hull[1]!, o);
  const inv = inverse3(U, V, W);
  if (!inv) return -Infinity;
  const c = inv(sub3(q, o));
  const lens = [len3(U), len3(V), len3(W)];
  return Math.min(...c.map((t, k) => Math.min(t, 1 - t) * lens[k]!));
}

/* ------------------------------------------------------------------ */
/* The order                                                           */
/* ------------------------------------------------------------------ */

/** What a group is, for the joint and grip rules: its kind and side (0 left, 1 right, -1 none). */
const TORSO = 1;
const ARM = 2;
const HAND = 3;
const LEG = 4;
const PROP = 0;

interface GroupInfo {
  kind: number;
  side: number;
}

function groupInfo(name: string): GroupInfo {
  const side = name.endsWith('.l') ? 0 : name.endsWith('.r') ? 1 : -1;
  const kind =
    name === 'torso'
      ? TORSO
      : name.startsWith('arm.')
        ? ARM
        : name.startsWith('hand.')
          ? HAND
          : name.startsWith('leg.')
            ? LEG
            : PROP;
  return { kind, side };
}

/**
 * Groups sorted far to near. Walls and doors come first and unsided furniture next, by rule. The
 * rest follow the nearer-than rules found from the overlaps of their parts, and among groups the
 * rules leave free, the mean depth of their parts (measured horizontally, so the camera's slight
 * downward look does not make high parts count as nearer than low ones; the torso sits a little
 * back, as limbs grow out of it).
 */
export function groupOrder(parts: Part[], cam: Camera, previous?: readonly string[]): string[] {
  const fx = cam.view[0];
  const fz = cam.view[2];
  const fl = Math.hypot(fx, fz) || 1;
  const names: string[] = [];
  const index = new Map<string, number>();
  const sum: number[] = [];
  const count: number[] = [];
  for (const p of parts) {
    let d = 0;
    if (p.hull) {
      for (const q of p.hull) d += (q[0] * fx + q[2] * fz) / fl;
      d /= p.hull.length;
    } else d = ((p.a[0] + p.b[0]) * fx + (p.a[2] + p.b[2]) * fz) / (2 * fl);
    const g = p.group;
    // Limbs grow out of the torso: at equal depth they draw over it, so the torso sits a little back.
    const bias =
      g === 'door' || g === 'wall' ? 20 : g === 'support' ? 10 : g === 'torso' ? 0.08 : 0;
    let i = index.get(g);
    if (i === undefined) {
      i = names.length;
      index.set(g, i);
      names.push(g);
      sum.push(0);
      count.push(0);
    }
    sum[i]! += d + bias;
    count[i]! += 1;
  }
  const n = names.length;
  // Far to near by mean depth: the fallback and the tie-break.
  const base = names.map((_, i) => i).sort((a, b) => sum[b]! / count[b]! - sum[a]! / count[a]!);
  if (n < 3) return base.map((i) => names[i]!);
  const rank = new Array<number>(n);
  let prevPos: number[] | null = null;
  if (previous && previous.length) {
    // Groups seen before keep their previous place; new ones slot in by mean depth.
    const list = previous.filter((g) => index.has(g)).map((g) => index.get(g)!);
    const seen = new Set(list);
    for (const g of base)
      if (!seen.has(g)) list.splice(Math.min(base.indexOf(g), list.length), 0, g);
    prevPos = new Array<number>(n).fill(-1);
    for (const g of previous) {
      const i = index.get(g);
      if (i !== undefined) prevPos[i] = previous.indexOf(g);
    }
    list.forEach((g, r) => (rank[g] = r));
  } else {
    base.forEach((g, r) => (rank[g] = r));
  }
  const rules = nearerRules(parts, cam, names, index, prevPos);
  return sortByRules(n, rank, rules, prevPos).map((i) => names[i]!);
}

/**
 * Rules "group i is nearer than group j" with their weights, as a flat n × n matrix: entry
 * i·n + j is the weight of the rule that i is painted after j.
 */
function nearerRules(
  parts: Part[],
  cam: Camera,
  names: string[],
  index: Map<string, number>,
  prevPos: number[] | null,
): Float64Array {
  const n = names.length;
  const solids: Solid[] = [];
  const byGroup: Solid[][] = names.map(() => []);
  for (const p of parts) {
    const g = p.group;
    if (g === 'wall' || g === 'door' || g === 'support') continue;
    const s = solidOf(p, index.get(g)!, cam);
    if (s) {
      solids.push(s);
      byGroup[s.group]!.push(s);
    }
  }
  const info = names.map(groupInfo);
  // Evidence that i is nearer than j at i·n + j.
  const votes = new Float64Array(n * n);
  // The largest depth gap (m) that voted for i nearer than j, at i·n + j.
  const widest = new Float64Array(n * n);
  let joints: Joints | null = null;
  const held = new Int8Array(n * 2).fill(-1);
  const isHeld = (prop: number, side: number): boolean => {
    const key = prop * 2 + side;
    if (held[key]! < 0) {
      joints ??= jointsOf(parts);
      const grip = joints.grip[side];
      held[key] = 0;
      if (grip)
        for (const p of parts)
          if (p.group === names[prop] && surfaceDistance(grip, p) <= HOLD_DIST) {
            held[key] = 1;
            break;
          }
    }
    return held[key] === 1;
  };

  /**
   * Whether the overlap of x (front depth fx) with y is part of a joint or a grip, where no order
   * is right: x a limb against the torso near its joint; x a hand against its forearm near the
   * wrist; x a hand or the forearm against a prop held in that hand.
   */
  const ambiguousFor = (x: Solid, fx: number, y: Solid, fy: number, u: number, v: number) => {
    const gx = info[x.group]!;
    if (gx.side < 0) return false;
    const gy = info[y.group]!;
    if (gx.kind === ARM || gx.kind === LEG) {
      if (gy.kind === TORSO) {
        joints ??= jointsOf(parts);
        const kind = gx.kind === ARM ? 'shoulder' : 'hip';
        const J = joints[kind][gx.side];
        if (J && distance(cam, u, v, fx, J) <= JOINT_REACH * JOINT_R[kind]) return true;
      }
    } else if (gx.kind === HAND && gy.kind === ARM && gy.side === gx.side) {
      joints ??= jointsOf(parts);
      const J = joints.wrist[gx.side];
      if (
        J &&
        Math.min(distance(cam, u, v, fx, J), distance(cam, u, v, fy, J)) <=
          JOINT_REACH * JOINT_R.wrist
      )
        return true;
    }
    return gy.kind === PROP && (gx.kind === HAND || x.forearm) && isHeld(y.group, gx.side);
  };

  // Which solids can share a pixel with each solid: their outlines meet.
  const near: number[][] = solids.map(() => []);
  for (let i = 0; i < solids.length; i++)
    for (let j = i + 1; j < solids.length; j++) {
      const A = solids[i]!;
      const B = solids[j]!;
      if (A.group === B.group) continue;
      if (A.x0 > B.x1 || B.x0 > A.x1 || A.y0 > B.y1 || B.y0 > A.y1) continue;
      if (A.kind === CAPSULE && B.kind === CAPSULE && !outlinesMeet(A, B)) continue;
      near[i]!.push(j);
      near[j]!.push(i);
    }

  // At a sample point, the nearest front depth of every group covering it, and who is nearer.
  const hitSolid = new Int32Array(solids.length);
  const hitFront = new Float64Array(solids.length);
  const front = new Float64Array(n);
  const frontHit = new Int32Array(n).fill(-1);
  const covering = new Int32Array(n);
  // Group pairs that can have no right order somewhere: a limb and the torso, a hand and its
  // forearm, a prop and a hand or arm.
  const mayJoin = new Uint8Array(n * n);
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const ka = info[a]!.kind;
      const kb = info[b]!.kind;
      const limb = (k: number) => k === ARM || k === LEG;
      if (
        (limb(ka) && kb === TORSO) ||
        (ka === HAND && kb === ARM) ||
        ((ka === HAND || ka === ARM) && kb === PROP)
      )
        mayJoin[a * n + b] = mayJoin[b * n + a] = 1;
    }
  const sampleAt = (u: number, v: number, w: number, first: number, others: number[]) => {
    let hits = 0;
    if (first >= 0 && span(solids[first]!, u, v)) {
      hitSolid[hits] = first;
      hitFront[hits++] = out;
    }
    for (let k = 0; k < others.length; k++) {
      const j = others[k]!;
      if (span(solids[j]!, u, v)) {
        hitSolid[hits] = j;
        hitFront[hits++] = out;
      }
    }
    if (hits < 2) return;
    let cover = 0;
    for (let h = 0; h < hits; h++) {
      const g = solids[hitSolid[h]!]!.group;
      if (frontHit[g]! < 0) covering[cover++] = g;
      if (frontHit[g]! < 0 || hitFront[h]! < front[g]!) {
        front[g] = hitFront[h]!;
        frontHit[g] = h;
      }
    }
    for (let x = 0; x < cover; x++)
      for (let y = x + 1; y < cover; y++) {
        const gx = covering[x]!;
        const gy = covering[y]!;
        const gap = front[gy]! - front[gx]!;
        const size = gap < 0 ? -gap : gap;
        if (size < MIN_GAP) continue;
        if (mayJoin[gx * n + gy]) {
          const sx = solids[hitSolid[frontHit[gx]!]!]!;
          const sy = solids[hitSolid[frontHit[gy]!]!]!;
          if (ambiguousFor(sx, front[gx]!, sy, front[gy]!, u, v)) continue;
          if (ambiguousFor(sy, front[gy]!, sx, front[gx]!, u, v)) continue;
        }
        const nearG = gap > 0 ? gx : gy;
        const farG = gap > 0 ? gy : gx;
        // The farther group's surface lying inside a part of the nearer one: they pass through each other.
        let inside = false;
        for (const sol of byGroup[nearG]!)
          if (
            u >= sol.x0 &&
            u <= sol.x1 &&
            v >= sol.y0 &&
            v <= sol.y1 &&
            insideBy(cam, u, v, front[farG]!, sol.part) > EMBED
          ) {
            inside = true;
            break;
          }
        if (inside) continue;
        const gp = size < MAX_GAP ? size : MAX_GAP;
        votes[nearG * n + farG]! += w * gp * gp * VOTE_SCALE;
        if (size > widest[nearG * n + farG]!) widest[nearG * n + farG] = size;
      }
    for (let x = 0; x < cover; x++) frontHit[covering[x]!] = -1;
  };

  const samples: number[] = [];
  for (let i = 0; i < solids.length; i++) {
    const A = solids[i]!;
    const others = near[i]!;
    if (others.length === 0) continue;
    samples.length = 0;
    collect(A, samples);
    if (A.kind === CAPSULE)
      for (const j of others) {
        const B = solids[j]!;
        if (B.kind !== CAPSULE) continue;
        if (j > i) {
          closest(A, B);
          lens(A, spotA, B, spotB, samples);
        }
        // Each sample of A's axis against the closest spot of B's.
        const m = Math.abs(A.du) + Math.abs(A.dv) < 1e-6 ? 1 : SAMPLES;
        for (let q = 0; q < m; q++) {
          const t = m === 1 ? 0.5 : (q + 0.5) / m;
          lens(A, t, B, closestSpot(B, A.au + A.du * t, A.av + A.dv * t), samples);
        }
      }
    for (let k = 0; k < samples.length; k += 3)
      sampleAt(samples[k]!, samples[k + 1]!, samples[k + 2]!, i, others);
  }
  // Around each joint, just outside the part of a limb that has no right order: where the limb
  // comes out of the body.
  joints ??= jointsOf(parts);
  const all = solids.map((_, i) => i);
  for (const kind of ['shoulder', 'hip'] as const)
    for (const J of joints[kind]) {
      if (!J) continue;
      const ju = dot(J, cam.right);
      const jv = dot(J, cam.up);
      for (const f of RING_RADII)
        for (let k = 0; k < RING_POINTS; k++) {
          const a = (k / RING_POINTS) * Math.PI * 2;
          const r = f * JOINT_R[kind];
          sampleAt(ju + r * Math.cos(a), jv + r * Math.sin(a), RING_WEIGHT, -1, all);
        }
    }
  const rules = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const ij = votes[i * n + j]!;
      const ji = votes[j * n + i]!;
      const total = ij + ji;
      if (total < MIN_EVIDENCE) continue;
      const pi = prevPos ? prevPos[i]! : -1;
      const pj = prevPos ? prevPos[j]! : -1;
      const known = pi >= 0 && pj >= 0;
      // i nearer than j means j was painted first.
      const keep = known && (pj < pi ? 1 : -1);
      if (ij >= MIN_SHARE * total) {
        if (
          !known ||
          keep === 1 ||
          (ij >= FLIP_SHARE * total && widest[i * n + j]! >= FLIP_GAP) ||
          widest[i * n + j]! >= FLIP_BIG
        )
          rules[i * n + j] = ij;
      } else if (ji >= MIN_SHARE * total) {
        if (
          !known ||
          keep === -1 ||
          (ji >= FLIP_SHARE * total && widest[j * n + i]! >= FLIP_GAP) ||
          widest[j * n + i]! >= FLIP_BIG
        )
          rules[j * n + i] = ji;
      }
    }
  // Where the overlaps say nothing, a limb on the side turned away from the camera is behind the
  // torso and one on the near side in front of it; the same in every frame, so it cannot flicker.
  const torso = index.get('torso');
  if (torso !== undefined && cam.farSide)
    for (let g = 0; g < n; g++) {
      const gi = info[g]!;
      if (gi.side < 0 || gi.kind === PROP || gi.kind === TORSO) continue;
      if (rules[g * n + torso]! > 0 || rules[torso * n + g]! > 0) continue;
      const far = (gi.side === 0) === (cam.farSide === 'l');
      if (far) rules[torso * n + g] = PRIOR_WEIGHT;
      else rules[g * n + torso] = PRIOR_WEIGHT;
    }
  return rules;
}

/** Distance from the 3D point on the view ray through (u, v) at depth d to a point j. */
function distance(cam: Camera, u: number, v: number, d: number, j: Vec3): number {
  const x = u * cam.right[0] + v * cam.up[0] + d * cam.view[0] - j[0];
  const y = u * cam.right[1] + v * cam.up[1] + d * cam.view[1] - j[1];
  const z = u * cam.right[2] + v * cam.up[2] + d * cam.view[2] - j[2];
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Sample points (u, v, weight) of a solid: along a capsule's axis, or on a grid across anything
 * else. The weight is the stretch of the solid a point stands for.
 */
function collect(s: Solid, into: number[]) {
  if (s.kind === CAPSULE) {
    const l = Math.hypot(s.du, s.dv);
    const r = s.ra > s.ra + s.dr ? s.ra : s.ra + s.dr;
    const m = l < 1e-6 ? 1 : SAMPLES;
    const w = (l + 2 * r) / m;
    for (let k = 0; k < m; k++) {
      const t = m === 1 ? 0.5 : (k + 0.5) / m;
      into.push(s.au + s.du * t, s.av + s.dv * t, w);
    }
    return;
  }
  const w = (Math.hypot(s.x1 - s.x0, s.y1 - s.y0) * 1.2) / GRID;
  for (let a = 0; a < GRID; a++)
    for (let b = 0; b < GRID; b++)
      into.push(
        s.x0 + ((s.x1 - s.x0) * (a + 0.5)) / GRID,
        s.y0 + ((s.y1 - s.y0) * (b + 0.5)) / GRID,
        w,
      );
}

/** The spots on two capsules' axes (0..1) that are closest on screen, set by `closest`. */
let spotA = 0;
let spotB = 0;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Find the spots on A's and B's axes that are closest on screen. */
function closest(A: Solid, B: Solid) {
  const ru = A.au - B.au;
  const rv = A.av - B.av;
  const a = A.du * A.du + A.dv * A.dv;
  const e = B.du * B.du + B.dv * B.dv;
  const f = B.du * ru + B.dv * rv;
  const c = A.du * ru + A.dv * rv;
  let s = 0;
  let t = 0;
  if (a > 1e-12 && e > 1e-12) {
    const b = A.du * B.du + A.dv * B.dv;
    const den = a * e - b * b;
    s = den > 1e-12 ? clamp01((b * f - c * e) / den) : 0;
    t = (b * s + f) / e;
    if (t < 0) {
      t = 0;
      s = clamp01(-c / a);
    } else if (t > 1) {
      t = 1;
      s = clamp01((b - c) / a);
    }
  } else if (a > 1e-12) s = clamp01(-c / a);
  else if (e > 1e-12) t = clamp01(f / e);
  spotA = s;
  spotB = t;
}

/** Whether two capsules' outlines meet on screen. */
function outlinesMeet(A: Solid, B: Solid): boolean {
  closest(A, B);
  const du = A.au + A.du * spotA - (B.au + B.du * spotB);
  const dv = A.av + A.dv * spotA - (B.av + B.dv * spotB);
  const r = A.ra + A.dr * spotA + B.ra + B.dr * spotB;
  return du * du + dv * dv < r * r;
}

/** The spot (0..1) on a capsule's axis closest to a point on screen. */
function closestSpot(B: Solid, u: number, v: number): number {
  const l2 = B.du * B.du + B.dv * B.dv;
  return l2 < 1e-12 ? 0 : clamp01(((u - B.au) * B.du + (v - B.av) * B.dv) / l2);
}

/**
 * A point in the overlap of two outlines, given spot `s` on A's axis and spot `t` on B's: on the
 * line between them, midway between where B's outline begins and where A's ends.
 */
function lens(A: Solid, s: number, B: Solid, t: number, into: number[]) {
  const pu = A.au + A.du * s;
  const pv = A.av + A.dv * s;
  const qu = B.au + B.du * t;
  const qv = B.av + B.dv * t;
  const rA = A.ra + A.dr * s;
  const rB = B.ra + B.dr * t;
  const d = Math.hypot(qu - pu, qv - pv);
  if (d >= rA + rB || d < 1e-9) return;
  const m = (d - rB + rA) / 2 / d;
  into.push(pu + (qu - pu) * m, pv + (qv - pv) * m, 2 * (rA < rB ? rA : rB));
}

/**
 * Topological sort, far to near: a rule puts its farther group first; among the groups with
 * nothing left to wait for, the one the mean depth puts farthest goes next. When rules form a
 * cycle, the weakest rule among those left is dropped.
 */
function sortByRules(
  n: number,
  rank: number[],
  rules: Float64Array,
  prevPos: number[] | null,
): number[] {
  // rules[i·n + j]: i is nearer than j, so j goes before i.
  const before = Uint8Array.from({ length: n * n }, (_, k) => (rules[k]! > 0 ? 1 : 0));
  const done = new Uint8Array(n);
  const order: number[] = [];
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      let free = true;
      for (let j = 0; j < n && free; j++) if (!done[j] && before[i * n + j]) free = false;
      if (free && (pick < 0 || rank[i]! < rank[pick]!)) pick = i;
    }
    if (pick >= 0) {
      done[pick] = 1;
      order.push(pick);
      continue;
    }
    // Weakest rule first, but one that contradicts the previous order goes before any that agrees.
    const against = (k: number): number => {
      if (!prevPos) return 0;
      const a = prevPos[Math.floor(k / n)]!;
      const b = prevPos[k % n]!;
      return a >= 0 && b >= 0 && a < b ? 1 : 0;
    };
    let weakest = -1;
    for (let k = 0; k < n * n; k++)
      if (before[k] && !done[Math.floor(k / n)] && !done[k % n])
        if (
          weakest < 0 ||
          against(k) > against(weakest) ||
          (against(k) === against(weakest) && rules[k]! < rules[weakest]!)
        )
          weakest = k;
    before[weakest] = 0;
  }
  return order;
}
