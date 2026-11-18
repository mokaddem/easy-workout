/**
 * What the renderer draws, in world space: the body as tapered capsules and the props, with the
 * implement in use drawn at the props' anchors. Pure TypeScript.
 */
import type { AnimationProp, EquipmentKind, ExerciseAnimation, FrameName } from '@/domain';
import {
  add,
  apply,
  at,
  axis,
  BODY,
  cross,
  dot,
  len,
  norm,
  scale,
  SIDES,
  sub,
  type Frame,
  type Frames,
  type Vec3,
} from './pose';

/**
 * Body volumes: tapered capsules in a segment frame. `S` in a group or frame name is the
 * side (l / r); for sided shapes z is mirrored on the left. `gap` tells the renderer how
 * to separate the part from what is behind it: a number opens the attached end (a), starting
 * the outline that far down the part, so a limb grows out of its parent without a ring;
 * 'none' draws no outline.
 */
interface Shape {
  g: string;
  f: string;
  a: Vec3;
  ra: number;
  b: Vec3;
  rb: number;
  gap?: number | 'none';
  sided?: boolean;
}
const SHAPES: Shape[] = [
  {
    g: 'torso',
    f: 'root',
    a: [0.005, -0.01, -0.06],
    ra: 0.094,
    b: [0.005, -0.01, 0.06],
    rb: 0.094,
    gap: 'none',
  },
  {
    g: 'torso',
    f: 'spine',
    a: [0, 0, 0.055],
    ra: 0.093,
    b: [0.01, 0.19, 0.052],
    rb: 0.088,
    sided: true,
  },
  {
    g: 'torso',
    f: 'chest',
    a: [0.01, 0, 0.055],
    ra: 0.09,
    b: [0.015, 0.2, 0.09],
    rb: 0.115,
    sided: true,
  },
  { g: 'torso', f: 'spine', a: [0.01, 0, 0], ra: 0.09, b: [0.015, 0.19, 0], rb: 0.088 },
  { g: 'torso', f: 'chest', a: [0.015, 0, 0], ra: 0.088, b: [0.025, 0.19, 0], rb: 0.108 },
  { g: 'torso', f: 'neck', a: [0, 0, 0], ra: 0.048, b: [0, 0.085, 0], rb: 0.044 },
  { g: 'torso', f: 'head', a: [0.016, 0.045, 0], ra: 0.066, b: [0, 0.11, 0], rb: 0.09 },
  { g: 'arm.S', f: 'shoulder.S', a: [0, 0, 0], ra: 0.058, b: [0, 0, 0], rb: 0.058, gap: 'none' },
  { g: 'arm.S', f: 'shoulder.S', a: [0, 0, 0], ra: 0.048, b: [0, -0.28, 0], rb: 0.037, gap: 0.2 },
  { g: 'arm.S', f: 'elbow.S', a: [0, 0, 0], ra: 0.039, b: [0, -0.245, 0], rb: 0.026 },
  { g: 'hand.S', f: 'wrist.S', a: [0, 0, 0], ra: 0.028, b: [0, -0.06, 0], rb: 0.032, gap: 0.3 },
  { g: 'leg.S', f: 'hip.S', a: [0, 0, 0], ra: 0.075, b: [0, -0.42, 0], rb: 0.05, gap: 0.24 },
  { g: 'leg.S', f: 'knee.S', a: [0, 0, 0], ra: 0.052, b: [0, -0.41, 0], rb: 0.033 },
  { g: 'leg.S', f: 'ankle.S', a: [-0.045, -0.042, 0], ra: 0.033, b: [0.145, -0.05, 0], rb: 0.025 },
];

/**
 * How a prop part sits in the picture. `scenery` (a wall, a door, straps running off to their
 * anchor) never sets the framing: it runs off the slot's edge. `support` (furniture, bars) is
 * framed but casts no contact shadow. Walls and doors are painted first and furniture under the
 * figure (see the draw order in `look.ts`).
 */
export type Layer = 'scenery' | 'support';

/** A tapered capsule: two circles in world space and the hull between them. */
export interface CapsulePart {
  id: string;
  group: string;
  a: Vec3;
  ra: number;
  b: Vec3;
  rb: number;
  gap?: number | 'none' | undefined;
  layer?: Layer | undefined;
  hull?: undefined;
}
/** A solid drawn as the convex hull of its corners (boxes, pads, slabs). */
export interface HullPart {
  id: string;
  group: string;
  hull: Vec3[];
  layer?: Layer | undefined;
}
export type Part = CapsulePart | HullPart;

/* ------------------------------------------------------------------ */
/* Implements in use                                                   */
/* ------------------------------------------------------------------ */

/** Implements that stand in for each other at the same anchors, without changing the pose. */
export const PROP_SWAPS: readonly (readonly EquipmentKind[])[] = [
  ['dumbbell', 'kettlebell'],
  ['chair', 'bench', 'table'],
  ['band', 'mini-band'],
];

/**
 * The props as drawn with the equipment in use: a prop of a swap family becomes the family's
 * member in use, unless its own kind is in use. Without equipment, the props as authored.
 */
export function propsInUse(
  props: readonly AnimationProp[],
  equipment?: readonly EquipmentKind[],
): AnimationProp[] {
  if (!equipment?.length) return [...props];
  return props.map((p) => {
    const kind = p.kind as EquipmentKind;
    const family = PROP_SWAPS.find((f) => f.includes(kind));
    if (!family || equipment.includes(kind)) return p;
    const use = family.find((k) => equipment.includes(k));
    return use ? ({ ...p, kind: use } as AnimationProp) : p;
  });
}

/**
 * The animation as drawn with the equipment in use: when an implement in use has a variant (it
 * changes the body's position), its poses, contacts, props, camera and still replace the base's.
 */
export function variantFor(
  anim: ExerciseAnimation,
  equipment?: readonly EquipmentKind[],
): ExerciseAnimation {
  if (!anim.variants || !equipment?.length) return anim;
  for (const [kind, v] of Object.entries(anim.variants)) {
    if (!v || !equipment.includes(kind as EquipmentKind)) continue;
    return {
      ...anim,
      ...(v.camera ? { camera: v.camera } : {}),
      ...(v.still ? { still: v.still } : {}),
      ...(v.pins ? { pins: v.pins } : {}),
      ...(v.props ? { props: v.props } : {}),
      ...(v.frameHints ? { frameHints: v.frameHints } : {}),
      poses: { ...anim.poses, ...v.poses },
    };
  }
  return anim;
}

/* ------------------------------------------------------------------ */
/* Prop drawings                                                       */
/* ------------------------------------------------------------------ */

const UP: Vec3 = [0, 1, 0];

const capsule = (
  id: string,
  group: string,
  a: Vec3,
  b: Vec3,
  r: number,
  layer?: Layer,
  rb = r,
): CapsulePart => ({ id, group, a, ra: r, b, rb, ...(layer ? { layer } : {}) });

/** The eight corners of a box spanned by `o` + i·u + j·v + k·w for i, j, k in 0..1. */
function corners(o: Vec3, u: Vec3, v: Vec3, w: Vec3): Vec3[] {
  const out: Vec3[] = [];
  for (const i of [0, 1])
    for (const j of [0, 1])
      for (const k of [0, 1]) out.push(add(o, add(scale(u, i), add(scale(v, j), scale(w, k)))));
  return out;
}

function dumbbellParts(
  id: string,
  group: string,
  c: Vec3,
  ax: Vec3,
  size: 'goblet' | undefined,
): CapsulePart[] {
  const [handle, headLen, headR] = size === 'goblet' ? [0.15, 0.05, 0.058] : [0.13, 0.04, 0.045];
  const h = handle / 2;
  return [
    capsule(`${id}/h`, group, add(c, scale(ax, -h)), add(c, scale(ax, h)), 0.016),
    capsule(`${id}/1`, group, add(c, scale(ax, h)), add(c, scale(ax, h + headLen)), headR),
    capsule(`${id}/2`, group, add(c, scale(ax, -h)), add(c, scale(ax, -h - headLen)), headR),
  ];
}

/** A kettlebell: a handle through `c` along `ax`, its bell `drop` away along `d`. */
function kettlebellParts(
  id: string,
  group: string,
  c: Vec3,
  ax: Vec3,
  d: Vec3,
  size: 'goblet' | undefined,
): CapsulePart[] {
  const [half, bellR, drop] = size === 'goblet' ? [0.07, 0.1, 0.15] : [0.06, 0.086, 0.128];
  // The handle runs square to the way the bell hangs.
  const a = norm(sub(ax, scale(d, dot(ax, d))));
  const bell = add(c, scale(d, drop));
  const e1 = add(c, scale(a, half));
  const e2 = add(c, scale(a, -half));
  const shoulder = add(bell, scale(d, -bellR * 0.55));
  return [
    capsule(`${id}/h`, group, e1, e2, 0.013),
    capsule(`${id}/1`, group, e1, add(shoulder, scale(a, half * 0.85)), 0.013, undefined, 0.017),
    capsule(`${id}/2`, group, e2, add(shoulder, scale(a, -half * 0.85)), 0.013, undefined, 0.017),
    capsule(`${id}/b`, group, bell, bell, bellR),
  ];
}

/** Where a kettlebell's bell sits from its handle, in world space. */
function bellDirection(F: Frames, frame: FrameName, bell: 'back' | 'out' | undefined): Vec3 {
  const fr: Frame = F[frame];
  if (bell === 'out') return scale(axis(fr.m, 1), -1);
  // On the back of the wrist, toward the forearm.
  const s = frame.endsWith('.l') ? -1 : 1;
  return norm(add(scale(axis(fr.m, 2), s), scale(axis(fr.m, 1), 0.7)));
}

type HandWeightProp = Extract<AnimationProp, { kind: 'dumbbell' | 'kettlebell' }>;

function handWeightParts(prop: HandWeightProp, F: Frames): CapsulePart[] {
  const fr = F[prop.frame];
  const c = at(fr, prop.at);
  if (prop.bell === 'down') {
    // Held at its top with both hands: it hangs straight down from `at`, across the body.
    const across = axis(F.root.m, 2);
    if (prop.kind === 'kettlebell')
      return kettlebellParts(prop.id, prop.group, c, across, [0, -1, 0], prop.size);
    const reach = prop.size === 'goblet' ? 0.125 : 0.105;
    return dumbbellParts(prop.id, prop.group, add(c, [0, -reach, 0]), [0, 1, 0], prop.size);
  }
  const ax = norm(
    add(
      scale(axis(fr.m, 0), prop.axis[0]),
      add(scale(axis(fr.m, 1), prop.axis[1]), scale(axis(fr.m, 2), prop.axis[2])),
    ),
  );
  if (prop.kind === 'dumbbell') return dumbbellParts(prop.id, prop.group, c, ax, prop.size);
  return kettlebellParts(
    prop.id,
    prop.group,
    c,
    ax,
    bellDirection(F, prop.frame, prop.bell),
    prop.size,
  );
}

type SupportProp = Extract<AnimationProp, { kind: 'chair' | 'bench' | 'table' }>;

/** Furniture, laid out in its own axes: u toward its front, w to its right, y up from the floor. */
function supportParts(prop: SupportProp): Part[] {
  const yaw = (prop.facing * Math.PI) / 180;
  const f: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const r: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)];
  const h = prop.at[1];
  const P = (u: number, y: number, w: number): Vec3 => [
    prop.at[0] + f[0] * u + r[0] * w,
    y,
    prop.at[2] + f[2] * u + r[2] * w,
  ];
  // A support on one side (a chair under each hand) takes its place by depth, like bars do;
  // a single one is painted under the figure.
  const side = /\.(l|r)$/.exec(prop.id)?.[1];
  const g = side ? `support.${side}` : 'support';
  const L: Layer = 'support';
  const slab = (
    id: string,
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    w0: number,
    w1: number,
  ): HullPart => {
    const o = P(u0, y0, w0);
    return {
      id,
      group: g,
      layer: L,
      hull: corners(o, sub(P(u1, y0, w0), o), sub(P(u0, y1, w0), o), sub(P(u0, y0, w1), o)),
    };
  };
  const leg = (id: string, u: number, w: number, top: number, r0 = 0.017) =>
    capsule(id, g, P(u, top, w), P(u, r0, w), r0, L);
  const id = prop.id;

  if (prop.kind === 'chair') {
    const parts: Part[] = [slab(`${id}/seat`, -0.21, 0.21, h - 0.045, h, -0.21, 0.21)];
    [-0.18, 0.18].forEach((u, i) =>
      [-0.18, 0.18].forEach((w, j) => parts.push(leg(`${id}/leg${i}${j}`, u, w, h - 0.045))),
    );
    [-0.18, 0.18].forEach((w, j) =>
      parts.push(capsule(`${id}/post${j}`, g, P(-0.19, h, w), P(-0.215, h + 0.44, w), 0.016, L)),
    );
    parts.push(slab(`${id}/back`, -0.235, -0.2, h + 0.25, h + 0.46, -0.2, 0.2));
    return parts;
  }

  if (prop.kind === 'table') {
    const parts: Part[] = [slab(`${id}/top`, -0.7, 0.2, h - 0.035, h, -0.45, 0.45)];
    [0.14, -0.64].forEach((u, i) =>
      [-0.39, 0.39].forEach((w, j) => parts.push(leg(`${id}/leg${i}${j}`, u, w, h - 0.035, 0.02))),
    );
    return parts;
  }

  // Bench: a flat pad reaching back from the seat, or a seat and a back pad raised behind it.
  const pad = 0.07;
  const half = 0.14;
  const foot = (fid: string, u: number) =>
    capsule(fid, g, P(u, 0.02, -0.19), P(u, 0.02, 0.19), 0.02, L);
  const incline = prop.incline ?? 0;
  if (incline < 1) {
    return [
      slab(`${id}/pad`, -0.95, 0.2, h - pad, h, -half, half),
      leg(`${id}/leg0`, 0.08, 0, h - pad, 0.022),
      leg(`${id}/leg1`, -0.83, 0, h - pad, 0.022),
      foot(`${id}/foot0`, 0.08),
      foot(`${id}/foot1`, -0.83),
    ];
  }
  const a = (incline * Math.PI) / 180;
  const back = 0.82;
  const hinge = -0.13;
  // The back pad's top surface runs from the hinge up and back; its thickness lies under it.
  const du = -Math.cos(a);
  const dy = Math.sin(a);
  const nu = -Math.sin(a);
  const ny = -Math.cos(a);
  const o = P(hinge, h, -half);
  const along = sub(P(hinge + du * back, h + dy * back, -half), o);
  const thick = sub(P(hinge + nu * pad, h + ny * pad, -half), o);
  const across = sub(P(hinge, h, half), o);
  const tail = hinge + du * back * 0.95;
  const mid = 0.55;
  return [
    slab(`${id}/seat`, hinge, 0.2, h - pad, h, -half, half),
    { id: `${id}/back`, group: g, layer: L, hull: corners(o, along, thick, across) },
    leg(`${id}/leg0`, 0.06, 0, h - pad, 0.022),
    capsule(
      `${id}/strut`,
      g,
      P(hinge + du * back * mid + nu * pad, h + dy * back * mid + ny * pad, 0),
      P(hinge + du * back * mid + nu * pad, 0.03, 0),
      0.022,
      L,
    ),
    capsule(`${id}/rail`, g, P(0.06, 0.03, 0), P(Math.min(tail, -0.5), 0.03, 0), 0.022, L),
    foot(`${id}/foot0`, 0.06),
    foot(`${id}/foot1`, Math.min(tail, -0.5)),
  ];
}

const pointOf = (F: Frames, p: Vec3 | { frame: FrameName; at: Vec3 }): Vec3 =>
  Array.isArray(p) ? p : at(F[p.frame], p.at);

/** Where each fist holds a handle. */
const grips = (F: Frames): [Vec3, Vec3] => [
  at(F['wrist.l'], BODY.grip),
  at(F['wrist.r'], BODY.grip),
];

/** A short cylinder (a wheel, a disc) as the hull of its two rims: centre, axis, radius, width. */
function cylinder(
  id: string,
  group: string,
  c: Vec3,
  ax: Vec3,
  r: number,
  width: number,
): HullPart {
  const e1 = Math.abs(ax[1]) > 0.9 ? norm(cross(ax, [1, 0, 0])) : norm(cross(ax, UP));
  const e2 = cross(e1, ax);
  const hull: Vec3[] = [];
  for (const side of [-0.5, 0.5])
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      hull.push(
        add(
          add(c, scale(ax, side * width)),
          add(scale(e1, r * Math.cos(a)), scale(e2, r * Math.sin(a))),
        ),
      );
    }
  return { id, group, hull };
}

type RopeProp = Extract<AnimationProp, { kind: 'jump-rope' }>;

/** Segments of a jump rope from fist to fist. */
const ROPE_SEGMENTS = 24;
const ROPE_R = 0.009;
/** Height of the rope's middle when it passes under the feet, and its clearance over the head. */
const ROPE_LOW = 0.012;
const ROPE_OVER_HEAD = 0.06;
/** The top of the head over the point 0.11 m up the head segment. */
const HEAD_TOP = 0.09;

/**
 * A jump rope turning forward around the line between the fists, `loop` (0..1, counted in steps)
 * through the loop. Its middle runs round an oval about the body: just over the floor under the
 * feet, `reach` in front of the body, a little over the head, `reach` behind.
 */
function ropeParts(prop: RopeProp, F: Frames, loop: number | undefined): CapsulePart[] {
  const [gl, gr] = grips(F);
  let ax = sub(gr, gl);
  if (len(ax) < 1e-6) ax = axis(F.root.m, 2);
  ax = norm(ax);
  const down = norm(sub([0, -1, 0], scale(ax, -ax[1])));
  const fwd = cross(ax, down);
  const mid = scale(add(gl, gr), 0.5);
  const dy = Math.max(0.2, -down[1]);
  // Where the feet and the head are, along the way the rope sweeps.
  const feet = scale(
    add(
      add(F['ankle.l'].o, F['ankle.r'].o),
      add(at(F['ankle.l'], BODY.toe), at(F['ankle.r'], BODY.toe)),
    ),
    0.25,
  );
  const head = at(F.head, [0, 0.11, 0]);
  const feetAt = dot(sub(feet, mid), fwd);
  const headAt = dot(sub(head, mid), fwd);
  const below = Math.max(0.05, (mid[1] - ROPE_LOW) / dy);
  const above = Math.max(0.05, (head[1] + HEAD_TOP + ROPE_OVER_HEAD - mid[1]) / dy);
  const under = prop.under ?? 0;
  const th = -2 * Math.PI * (prop.turns ?? 1) * ((loop ?? under) - under);
  const c = Math.cos(th);
  const s = Math.sin(th);
  const along = feetAt + ((headAt - feetAt) * (1 - c)) / 2 + s * (prop.reach ?? 0.5);
  const out = add(scale(fwd, along), scale(down, c * (c >= 0 ? below : above)));
  const point = (i: number): Vec3 => {
    const u = i / ROPE_SEGMENTS;
    return add(add(gl, scale(sub(gr, gl), u)), scale(out, Math.pow(Math.sin(Math.PI * u), 0.6)));
  };
  return Array.from({ length: ROPE_SEGMENTS }, (_, i) => {
    const S = i < ROPE_SEGMENTS / 2 ? 'l' : 'r';
    return capsule(`${prop.id}.${S}/${i}`, `rope.${S}`, point(i), point(i + 1), ROPE_R);
  });
}

/** The parts of one prop in the frames of a pose, `loop` (0..1, in steps) through the loop. */
function propParts(prop: AnimationProp, F: Frames, loop?: number): Part[] {
  switch (prop.kind) {
    case 'dumbbell':
    case 'kettlebell':
      return handWeightParts(prop, F);
    case 'chair':
    case 'bench':
    case 'table':
      return supportParts(prop);
    case 'band':
    case 'mini-band':
      return [
        capsule(
          prop.id,
          prop.group,
          pointOf(F, prop.from),
          pointOf(F, prop.to),
          prop.kind === 'band' ? 0.009 : 0.02,
        ),
      ];
    case 'wall': {
      const n = norm([prop.normal[0], 0, prop.normal[2]]);
      const side = cross(UP, n);
      const o = add(add([prop.at[0], 0, prop.at[2]], scale(n, -1.2)), scale(side, -2.5));
      return [
        {
          id: prop.id,
          group: 'wall',
          layer: 'scenery',
          hull: corners(o, scale(n, 1.2), [0, 2.6, 0], scale(side, 5)),
        },
      ];
    }
    case 'dip-bars': {
      const [x, y, z] = prop.at;
      return SIDES.flatMap(([S, s]) => {
        const g = `bars.${S}`;
        const zz = z + (s * prop.width) / 2;
        const id = `${prop.id}.${S}`;
        return [
          capsule(`${id}/bar`, g, [x - 0.33, y, zz], [x + 0.29, y, zz], 0.022, 'support'),
          capsule(`${id}/post0`, g, [x - 0.27, y, zz], [x - 0.27, 0.03, zz], 0.018, 'support'),
          capsule(`${id}/post1`, g, [x + 0.23, y, zz], [x + 0.23, 0.03, zz], 0.018, 'support'),
          capsule(`${id}/foot`, g, [x - 0.38, 0.02, zz], [x + 0.34, 0.02, zz], 0.02, 'support'),
        ];
      });
    }
    case 'suspension': {
      const sides = prop.sides ?? ['l', 'r'];
      const feet = prop.on === 'feet';
      return SIDES.filter(([S]) => sides.includes(S)).flatMap(([S, s]) => {
        // A handle across the fist, or a cradle across the foot at the ankle.
        const end = feet ? F[`ankle.${S}`] : F[`wrist.${S}`];
        const hold = feet ? at(end, [0.03, -0.035, 0]) : at(end, BODY.grip);
        const across = feet ? axis(end.m, 2) : axis(end.m, 0);
        const half = feet ? 0.055 : 0.065;
        const spread = sides.length > 1 ? s * 0.02 : 0;
        const top: Vec3 = [prop.anchor[0], prop.anchor[1], prop.anchor[2] + spread];
        const g = `strap.${S}`;
        const id = `${prop.id}.${S}`;
        return [
          capsule(`${id}/strap`, g, hold, top, 0.011, 'scenery'),
          capsule(
            `${id}/grip`,
            g,
            add(hold, scale(across, -half)),
            add(hold, scale(across, half)),
            0.018,
          ),
        ];
      });
    }
    case 'box': {
      const [x0, y0, z0] = prop.min;
      const [x1, y1, z1] = prop.max;
      const size: [Vec3, Vec3, Vec3] = [
        [x1 - x0, 0, 0],
        [0, y1 - y0, 0],
        [0, 0, z1 - z0],
      ];
      if (!prop.frame)
        return [
          { id: prop.id, group: prop.group, layer: 'scenery', hull: corners(prop.min, ...size) },
        ];
      const fr = F[prop.frame];
      // Carried: turning with the segment, or sliding along the floor with it, level.
      if (prop.slide)
        return [
          {
            id: prop.id,
            group: prop.group,
            hull: corners([fr.o[0] + x0, y0, fr.o[2] + z0], ...size),
          },
        ];
      const [u, v, w] = size.map((d) => apply(fr.m, d)) as [Vec3, Vec3, Vec3];
      return [{ id: prop.id, group: prop.group, hull: corners(at(fr, prop.min), u, v, w) }];
    }
    case 'capsule':
      return [capsule(prop.id, prop.group, pointOf(F, prop.a), pointOf(F, prop.b), prop.r)];
    case 'strap': {
      const start = prop.hand
        ? at(F[`wrist.${prop.hand}`], BODY.grip)
        : pointOf(F, prop.from ?? [0, 0, 0]);
      return [capsule(prop.id, prop.group, start, prop.to, prop.r)];
    }
    case 'ab-wheel': {
      // On the floor under the middle of the fists, its axle level, the handle through both.
      const [gl, gr] = grips(F);
      let ax = sub(gr, gl);
      ax = [ax[0], 0, ax[2]];
      if (len(ax) < 1e-6) ax = [axis(F.root.m, 2)[0], 0, axis(F.root.m, 2)[2]];
      ax = norm(ax);
      const mid = scale(add(gl, gr), 0.5);
      const c: Vec3 = [mid[0], prop.r, mid[2]];
      const reach = len(sub(gr, gl)) / 2 + 0.05;
      return [
        cylinder(`${prop.id}/wheel`, prop.group, c, ax, prop.r, prop.width ?? 0.06),
        capsule(
          `${prop.id}/handle`,
          prop.group,
          sub(c, scale(ax, reach)),
          add(c, scale(ax, reach)),
          0.014,
        ),
      ];
    }
    case 'jump-rope':
      return ropeParts(prop, F, loop);
  }
}

/* ------------------------------------------------------------------ */
/* Parts of a pose                                                     */
/* ------------------------------------------------------------------ */

/** Limb groups and their world sides, for the depth tone and the working limb on side 2. */
export const mirrorGroup = (g: string): string =>
  g.replace(/\.(l|r)\b/g, (_, x: string) => (x === 'l' ? '.r' : '.l'));

/** The body's own groups (everything else is a prop). */
export const isBodyGroup = (g: string): boolean => /^(torso|arm\.|hand\.|leg\.)/.test(g);

/**
 * Everything to draw, in world space. `minR` thickens thin parts at small sizes; `mirror` gives
 * the body mirrored in depth (the figure itself draws side 2 as a flip of the picture);
 * `equipment` (the implements in use) picks a variant and swaps props for the ones in use; `loop`
 * is how far through the loop the frames are (`Solved.loop`), for props that move with it (a
 * jump rope; without it, the rope is under the feet).
 */
export function buildParts(
  F: Frames,
  anim: ExerciseAnimation,
  {
    minR = 0,
    mirror = false,
    equipment,
    loop,
  }: {
    minR?: number;
    mirror?: boolean;
    equipment?: readonly EquipmentKind[] | undefined;
    loop?: number | undefined;
  } = {},
): Part[] {
  const parts: Part[] = [];
  SHAPES.forEach(({ g: group, f: frame, a, ra, b, rb, sided: perSide, gap }, i) => {
    const isSided = frame.includes('S') || !!perSide;
    for (const [S, s] of isSided ? SIDES : ([['', 1]] as [string, number][])) {
      const fr = F[frame.replace('S', S) as FrameName];
      const flip = (p: Vec3): Vec3 => (isSided ? [p[0], p[1], s * p[2]] : p);
      const g = group.replace('S', S);
      parts.push({
        id: perSide ? `${g}/${i}${S}` : `${g}/${i}`,
        group: g,
        a: at(fr, flip(a)),
        ra,
        b: at(fr, flip(b)),
        rb,
        gap,
      });
    }
  });
  for (const prop of propsInUse(variantFor(anim, equipment).props, equipment))
    parts.push(...propParts(prop, F, loop));
  for (const p of parts) {
    if (p.hull) continue;
    p.ra = Math.max(p.ra, minR);
    p.rb = Math.max(p.rb, minR);
  }
  return mirror ? parts.map(mirrored) : parts;
}

const flipZ = (p: Vec3): Vec3 => [p[0], p[1], -p[2]];

/** The part as seen from the other side: z reflected, left and right swapped. */
function mirrored(p: Part): Part {
  const id = mirrorGroup(p.id);
  const group = mirrorGroup(p.group);
  if (p.hull) return { ...p, id, group, hull: p.hull.map(flipZ) };
  return { ...p, id, group, a: flipZ(p.a), b: flipZ(p.b) };
}
