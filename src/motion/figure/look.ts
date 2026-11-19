/**
 * The look: camera, framing, tones, draw order and the floor. Pure TypeScript.
 */
import type { EquipmentKind, ExerciseAnimation } from '@/domain';
import { buildParts, isBodyGroup, mirrorGroup, variantFor } from './parts';
import { cross, dot, evaluate, neutralPace, norm, prepare, scale, timeOf, type Vec3 } from './pose';

const DEG = Math.PI / 180;

export interface Camera {
  toCam: Vec3;
  view: Vec3;
  right: Vec3;
  up: Vec3;
  /** The side of the figure turned away from the camera, if any (front views have none). */
  farSide: 'l' | 'r' | null;
}

/** Orthographic camera from the animation's yaw / pitch, looking at the origin. */
export function camera(anim: ExerciseAnimation): Camera {
  const yaw = anim.camera.yaw * DEG;
  const pitch = (anim.camera.pitch ?? 0) * DEG;
  const toCam: Vec3 = [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ];
  const view = scale(toCam, -1);
  const right = norm(cross(view, [0, 1, 0]));
  const up = cross(right, view);
  const facing = dot([0, 0, 1], toCam);
  const farSide = facing > 0.35 ? 'l' : facing < -0.35 ? 'r' : null;
  return { toCam, view, right, up, farSide };
}

/** [u, v, depth]: u to the right, v up, depth into the screen. */
export const project = (cam: Camera, p: Vec3): Vec3 => [
  dot(p, cam.right),
  dot(p, cam.up),
  dot(p, cam.view),
];

/** Padding in px: top, right, bottom, left. */
type Pad = [number, number, number, number];

/** Hand-tuned padding for the real slot sizes ("width x height"). */
const PADDING: Record<string, Pad> = {
  '350x96': [9, 18, 11, 18],
  '350x240': [22, 24, 28, 24],
  '72x72': [7, 6, 9, 6],
  '56x56': [5, 4, 7, 4],
};

/** Padding for a slot: the tuned one for the known sizes, proportional to the height otherwise. */
export function padFor(w: number, h: number): Pad {
  const known = PADDING[`${w}x${h}`];
  if (known) return known;
  const side = Math.max(2, Math.round(Math.min(w * 0.075, h * 0.1)));
  return [Math.round(h * 0.093), side, Math.round(h * 0.118), side];
}

/** Gap drawn around each part in the slot's centre tone, and the thinnest a limb may get. */
const gapPx = (s: number) => Math.min(1.8, Math.max(0.8, 0.6 + s * 0.007));
const MIN_R_PX = 0.85;

export interface Framing {
  w: number;
  h: number;
  scale: number;
  ox: number;
  oy: number;
  cam: Camera;
  /** The thinnest radius in metres that still draws at least a pixel or so. */
  minR: number;
  /** Width in px of the gap drawn around each part. */
  gap: number;
  footprint: { x0: number; x1: number; z0: number; z1: number };
  /** Spots on the floor under what touches it ([x, z, radius]), for the contact shadow. */
  contacts: [number, number, number][];
  toScreen: (p: Vec3) => Vec3;
}

/**
 * Fixed framing for a slot size, standing on the floor at the bottom padding. A looping figure
 * is framed so the whole loop fits; a still frames its key pose only, so the figure fills a
 * thumbnail. The figure is centred, so side 2 (the picture flipped) fits the same framing.
 * Scenery (walls, doors, straps to their anchor) is left to the slot's edges.
 */
export function frame(
  animation: ExerciseAnimation,
  w: number,
  h: number,
  {
    still = false,
    equipment,
  }: { still?: boolean; equipment?: readonly EquipmentKind[] | undefined } = {},
): Framing {
  const anim = variantFor(animation, equipment);
  const pad = padFor(w, h);
  const cam = camera(anim);
  const prep = prepare(anim, neutralPace(anim));
  let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity];
  const grow = (p: Vec3, r = 0) => {
    const [u, v] = project(cam, p);
    u0 = Math.min(u0, u - r);
    u1 = Math.max(u1, u + r);
    v0 = Math.min(v0, v - r);
    v1 = Math.max(v1, v + r);
  };
  // The contact shadow lies under what touches the floor: the body and what it holds, else the
  // support it is on (a body up on bars), else under the whole body. Spots are kept on a grid.
  type Spots = Map<string, [number, number, number]>;
  const spots = { body: new Map(), support: new Map(), all: new Map() } as Record<
    'body' | 'support' | 'all',
    Spots
  >;
  const mark = (into: Spots, c: Vec3, r: number) => {
    const key = `${Math.round(c[0] / SPOT_GRID)},${Math.round(c[2] / SPOT_GRID)}`;
    const had = into.get(key);
    if (!had || had[2] < r) into.set(key, [c[0], c[2], r]);
  };
  // Thumbnail tiles (a still in a small box) use the tile rule below.
  const tile = still && h <= TILE_MAX && w <= TILE_MAX;
  let headU = 0;
  const times = still
    ? [timeOf(prep, anim.still)]
    : Array.from({ length: 48 }, (_, i) => (prep.duration * i) / 48);
  for (const time of times) {
    const { frames, loop } = evaluate(prep, time);
    headU = project(cam, frames.head.o)[0];
    for (const p of buildParts(frames, anim, { equipment, loop })) {
      if (p.layer === 'scenery') continue;
      if (p.hull) {
        for (const c of p.hull) {
          grow(c);
          // Something carried that touches the floor (a wheel) shades it like the body does.
          if (!p.layer && c[1] < 0.05) mark(spots.body, c, SPOT_MARGIN);
        }
        continue;
      }
      grow(p.a, p.ra);
      grow(p.b, p.rb);
      if (p.group.startsWith('towel') || p.group.startsWith('rope')) continue;
      // Sample along the part: a back or a foot lying on the floor touches all along.
      const n = Math.max(1, Math.ceil(Math.hypot(...sub3(p.b, p.a)) / SPOT_GRID));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const c: Vec3 = [
          p.a[0] + (p.b[0] - p.a[0]) * u,
          p.a[1] + (p.b[1] - p.a[1]) * u,
          p.a[2] + (p.b[2] - p.a[2]) * u,
        ];
        const r = p.ra + (p.rb - p.ra) * u;
        if (!p.layer && (i === 0 || i === n)) mark(spots.all, c, r);
        if (c[1] - r < 0.05) mark(p.layer ? spots.support : spots.body, c, r + SPOT_MARGIN);
      }
    }
  }
  const chosen = [spots.body, spots.support, spots.all].find((m) => m.size > 0)!;
  const contacts = [...chosen.values()];
  const footprint = {
    x0: Math.min(...contacts.map((c) => c[0])),
    x1: Math.max(...contacts.map((c) => c[0])),
    z0: Math.min(...contacts.map((c) => c[1])),
    z1: Math.max(...contacts.map((c) => c[1])),
  };
  if (!still) for (const p of anim.frameHints ?? []) grow(p);
  const aw = w - pad[1] - pad[3];
  const ah = h - pad[0] - pad[2];
  const bw = u1 - u0;
  const bh = v1 - v0;
  const fit = Math.min(aw / bw, ah / bh);
  // Tile rule: a wide pose (at least 2:1) is enlarged to fill the tile's height while keeping at
  // least 55 % of its width in view; what leaves the tile is the end away from the head.
  const s = tile && bw / bh >= 2 ? Math.max(fit, Math.min(ah / bh, aw / (0.55 * bw))) : fit;
  const ox =
    bw * s <= aw + 0.01
      ? pad[3] + (aw - bw * s) / 2 - u0 * s
      : headU - u0 < u1 - headU
        ? pad[3] - u0 * s
        : w - pad[1] - u1 * s;
  const oy = h - pad[2] + v0 * s;
  return {
    w,
    h,
    scale: s,
    ox,
    oy,
    cam,
    minR: MIN_R_PX / s,
    gap: gapPx(s),
    footprint,
    contacts,
    toScreen: (p) => {
      const [u, v, d] = project(cam, p);
      return [ox + u * s, oy - v * s, d];
    },
  };
}

/** The largest box (px, each way) a still is framed as a thumbnail tile in. */
const TILE_MAX = 80;

/** Grid step for contact spots, and how far a shadow reaches past what touches the floor. */
const SPOT_GRID = 0.05;
const SPOT_MARGIN = 0.03;
const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Floor hairline and contact shadow, in screen space. The shadow is the union of small discs on
 * the floor under each spot that touches it, so it hugs the contacts (hands, feet, a back) rather
 * than spreading under the whole figure.
 */
export function floorShapes(fr: Framing): { lineY: number; shadow: string } {
  const { footprint: f, toScreen } = fr;
  const disc = (x: number, z: number, r: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const [px, py] = toScreen([x + r * Math.cos(a), 0, z + r * Math.sin(a)]);
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  const [, lineY] = toScreen([(f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2]);
  return { lineY, shadow: fr.contacts.map(([x, z, r]) => disc(x, z, r)).join('') };
}

/* ------------------------------------------------------------------ */
/* Tones                                                               */
/* ------------------------------------------------------------------ */

/**
 * Each tone reads a CSS custom property and falls back to a palette step (light, dark), so the
 * fallbacks live here and nowhere else. They follow the root's colour scheme.
 */
const pair = (light: string, dark: string) => `light-dark(${light}, ${dark})`;
const tone = (name: string, light: string, dark: string) => `var(${name}, ${pair(light, dark)})`;

export const TONE_CSS = {
  body: tone('--figure-body', '#6a7080', '#aab0bd'),
  /** The working limb: one grey step lighter. */
  limb: tone('--figure-limb', '#333845', '#dfe2e8'),
  far: tone('--figure-far', '#aab0bd', '#6a7080'),
  limbFar: tone('--figure-limb-far', '#9197a6', '#9197a6'),
  prop: tone('--figure-prop', '#9197a6', '#656c7c'),
  propFar: tone('--figure-prop-far', '#c4c9d2', '#4a505e'),
  /** Contact shadow on the floor. */
  shadow: tone('--figure-shadow', '#e8eaee', 'color-mix(in srgb, #11131a 70%, transparent)'),
  /** Fixed scenery: a door, a wall. */
  door: `var(--figure-door, var(--color-surface-sunken, ${pair('#e8eaee', '#292d38')}))`,
  floor: `var(--figure-floor, var(--color-line, ${pair('#dfe2e8', '#333845')}))`,
  /** The gap drawn around each part: the slot's own surface. */
  cut: `var(--figure-cut, var(--color-surface-raised, ${pair('#ffffff', '#20242e')}))`,
} as const;
export type ToneKey = keyof typeof TONE_CSS;

/**
 * The tone of a part group. `mirror` is true when the second side is drawn. Props take the prop
 * tone (far side: the far prop tone); furniture the far prop tone, so it sits back under the
 * figure; walls and doors the scenery tone.
 */
export function toneOf(
  group: string,
  anim: ExerciseAnimation,
  mirror: boolean,
  cam: Camera,
): ToneKey {
  const side = /\.(l|r)$/.exec(group)?.[1];
  const far = side !== undefined && side === cam.farSide;
  if (group === 'door' || group === 'wall') return 'door';
  if (group.startsWith('support')) return 'propFar';
  if (!isBodyGroup(group)) return far ? 'propFar' : 'prop';
  const limb = group.replace(/^hand\./, 'arm.');
  const working: string[] = mirror ? anim.working.map(mirrorGroup) : anim.working;
  if (working.includes(limb)) return far ? 'limbFar' : 'limb';
  return far ? 'far' : 'body';
}

/* ------------------------------------------------------------------ */
/* Draw order                                                          */
/* ------------------------------------------------------------------ */

export { groupOrder } from './order';
