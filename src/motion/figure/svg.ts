/**
 * Parts to SVG path data. Each part is the outline of a tapered capsule (two circles and their
 * tangents); the parts of a group are one path, so a limb reads as one shape. A limb's gap
 * outline stays open where it joins its parent.
 */
import type { Framing } from './look';
import type { Part } from './parts';
import type { Vec3 } from './pose';

const f = (x: number) => Math.round(x * 10) / 10;

function circle(x: number, y: number, r: number): string {
  return `M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)}Z`;
}

/**
 * Outline of the convex hull of two circles, in screen space. `open` (0..1) leaves the first
 * end out and starts the sides that far along the part.
 */
export function capsulePath(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  open: number | null = null,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  if (d + Math.min(r1, r2) <= Math.max(r1, r2) + 0.05)
    return r1 >= r2 ? circle(x1, y1, r1) : circle(x2, y2, r2);
  const a = Math.atan2(dy, dx);
  const phi = Math.acos((r1 - r2) / d);
  const c1 = Math.cos(a + phi);
  const s1 = Math.sin(a + phi);
  const c2 = Math.cos(a - phi);
  const s2 = Math.sin(a - phi);
  const big2 = 2 * phi > Math.PI ? 1 : 0;
  if (open !== null) {
    const k = open;
    const ax = x1 + r1 * c1 + (x2 + r2 * c1 - x1 - r1 * c1) * k;
    const ay = y1 + r1 * s1 + (y2 + r2 * s1 - y1 - r1 * s1) * k;
    const bx = x1 + r1 * c2 + (x2 + r2 * c2 - x1 - r1 * c2) * k;
    const by = y1 + r1 * s2 + (y2 + r2 * s2 - y1 - r1 * s2) * k;
    return (
      `M${f(ax)} ${f(ay)}L${f(x2 + r2 * c1)} ${f(y2 + r2 * s1)}` +
      `A${f(r2)} ${f(r2)} 0 ${big2} 0 ${f(x2 + r2 * c2)} ${f(y2 + r2 * s2)}L${f(bx)} ${f(by)}`
    );
  }
  return (
    `M${f(x1 + r1 * c1)} ${f(y1 + r1 * s1)}L${f(x2 + r2 * c1)} ${f(y2 + r2 * s1)}` +
    `A${f(r2)} ${f(r2)} 0 ${big2} 0 ${f(x2 + r2 * c2)} ${f(y2 + r2 * s2)}` +
    `L${f(x1 + r1 * c2)} ${f(y1 + r1 * s2)}A${f(r1)} ${f(r1)} 0 ${1 - big2} 0 ${f(x1 + r1 * c1)} ${f(y1 + r1 * s1)}Z`
  );
}

type Pt = [number, number, number];

/** Convex hull of projected points (the corners of a box, a pad, a slab). */
export function hullPath(points: Vec3[], toScreen: (p: Vec3) => Pt): string {
  const pts: Pt[] = points.map(toScreen);
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const turn = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const p of list) {
      while (h.length >= 2 && turn(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  return `M${hull.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
}

export interface GroupPaths {
  /** The group's shape. */
  fill: string;
  /** A slightly wider outline painted under it in the slot's tone, so overlaps stay readable. */
  gap: string;
}

/** Path data per part group for one pose. */
export function groupPaths(parts: Part[], fr: Framing): Map<string, GroupPaths> {
  const out = new Map<string, GroupPaths>();
  const s = fr.scale;
  for (const p of parts) {
    let fill: string;
    let gap: string;
    if (p.hull) fill = gap = hullPath(p.hull, fr.toScreen);
    else {
      const a = fr.toScreen(p.a);
      const b = fr.toScreen(p.b);
      fill = capsulePath(a[0], a[1], p.ra * s, b[0], b[1], p.rb * s);
      gap =
        p.gap === 'none'
          ? ''
          : typeof p.gap === 'number'
            ? capsulePath(a[0], a[1], p.ra * s, b[0], b[1], p.rb * s, p.gap)
            : fill;
    }
    const cur = out.get(p.group) ?? { fill: '', gap: '' };
    out.set(p.group, { fill: cur.fill + fill, gap: cur.gap + gap });
  }
  return out;
}
