import { describe, expect, it } from 'vitest';
import { ANIMATION_FAMILIES, animationFor } from '../src/catalogue/animations';
import type { ExerciseAnimation } from '../src/domain';
import { camera, frame, groupOrder } from '../src/motion/figure/look';
import { frontDepth } from '../src/motion/figure/order';
import { buildParts, isBodyGroup, type CapsulePart, type Part } from '../src/motion/figure/parts';
import { evaluate, neutralPace, prepare } from '../src/motion/figure/pose';

/** The groups of an animation in paint order, far to near, `t` seconds into its neutral loop. */
function orderAt(anim: ExerciseAnimation, t: number): { order: string[]; parts: Part[] } {
  const fr = frame(anim, 350, 240);
  const { frames, loop } = evaluate(prepare(anim, neutralPace(anim)), t);
  const parts = buildParts(frames, anim, { minR: fr.minR, loop });
  return { order: groupOrder(parts, fr.cam), parts };
}

describe('paint order of the figure', () => {
  it('paints the far arm under the chest in a close-grip push-up', () => {
    const anim = animationFor('close-grip-push-up')!;
    for (const t of [0.63, 1.13, 1.99]) {
      const { order } = orderAt(anim, t);
      // The far arm and hand are behind the chest at this moment; the near ones in front of it.
      expect(order.indexOf('arm.l')).toBeLessThan(order.indexOf('torso'));
      expect(order.indexOf('hand.l')).toBeLessThan(order.indexOf('torso'));
      expect(order.indexOf('arm.r')).toBeGreaterThan(order.indexOf('torso'));
    }
  });

  it('keeps the order steady through a loop where nothing changes sides', () => {
    const anim = animationFor('close-grip-push-up')!;
    const prep = prepare(anim, neutralPace(anim));
    const fr = frame(anim, 350, 240);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { frames, loop } = evaluate(prep, (prep.duration * i) / 60);
      seen.add(groupOrder(buildParts(frames, anim, { minR: fr.minR, loop }), fr.cam).join());
    }
    expect(seen.size).toBe(1);
  });

  it('paints a wall first, and furniture under the figure', () => {
    const wallPushUp = animationFor('wall-push-up')!;
    const { order } = orderAt(wallPushUp, 0.5);
    expect(order[0]).toBe('wall');

    const bench = animationFor('dumbbell-bench-press')!;
    const { order: benchOrder } = orderAt(bench, 0.5);
    const furniture = benchOrder.indexOf('support');
    expect(furniture).toBeGreaterThanOrEqual(0);
    for (const g of benchOrder.filter(isBodyGroup))
      expect(benchOrder.indexOf(g)).toBeGreaterThan(furniture);
  });

  it('puts walls and doors first and furniture next, and every group once, in every animation', () => {
    const all = Object.assign({}, ...Object.values(ANIMATION_FAMILIES)) as Record<
      string,
      ExerciseAnimation
    >;
    for (const [id, anim] of Object.entries(all)) {
      const { order, parts } = orderAt(anim, 0.5);
      expect(new Set(order).size, id).toBe(order.length);
      expect([...order].sort(), id).toEqual([...new Set(parts.map((p) => p.group))].sort());
      const scenery = order.filter((g) => g === 'wall' || g === 'door').length;
      expect(
        order.slice(0, scenery).every((g) => g === 'wall' || g === 'door'),
        id,
      ).toBe(true);
      const furniture = order.indexOf('support');
      if (furniture >= 0) {
        for (const g of order)
          if (g !== 'wall' && g !== 'door' && g !== 'support')
            expect(order.indexOf(g), id).toBeGreaterThan(furniture);
      }
    }
  });
});

/** A side view from the figure's right: the screen's right is -z and nearer is larger x. */
const sideView = camera({ camera: { yaw: 90 } } as ExerciseAnimation);

const capsule = (
  id: string,
  group: string,
  a: [number, number, number],
  b: [number, number, number],
  r: number,
): CapsulePart => ({
  id,
  group,
  a,
  ra: r,
  b,
  rb: r,
});

describe('paint order from the overlaps', () => {
  const scene = (armX: number): Part[] => [
    capsule('torso/1', 'torso', [0, 0, 0], [0, 0.5, 0], 0.1),
    // A forearm crossing the chest at the same height, in front of or behind it.
    capsule('arm.l/9', 'arm.l', [armX, 0.3, 0.2], [armX, 0.3, -0.2], 0.04),
    capsule('leg.l/12', 'leg.l', [0, -0.5, 0.3], [0, -0.1, 0.3], 0.05),
  ];

  it('paints the nearer of two overlapping groups last', () => {
    const behind = groupOrder(scene(-0.3), sideView);
    expect(behind.indexOf('arm.l')).toBeLessThan(behind.indexOf('torso'));
    const front = groupOrder(scene(0.3), sideView);
    expect(front.indexOf('arm.l')).toBeGreaterThan(front.indexOf('torso'));
  });
});

describe('front depth of a tapered capsule', () => {
  /** The same depth by walking along the axis in small steps. */
  const brute = (d0: number, dd: number, al: number, be: number, ga: number) => {
    let best = Infinity;
    for (let k = 0; k <= 2000; k++) {
      const s = k / 2000;
      const g = (al * s + be) * s + ga;
      if (g >= 0) best = Math.min(best, d0 + dd * s - Math.sqrt(g));
    }
    return best;
  };

  it('matches a walk along the axis, and misses where the ray misses', () => {
    // A small deterministic generator, so the test is repeatable.
    let seed = 12345;
    const rnd = (a: number, b: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return a + (seed / 4294967296) * (b - a);
    };
    let checked = 0;
    for (let i = 0; i < 4000; i++) {
      const ra = rnd(0.02, 0.1);
      const rb = rnd(0.02, 0.1);
      const du = rnd(-0.5, 0.5);
      const dv = rnd(-0.5, 0.5);
      const dd = rnd(-0.5, 0.5);
      const ex = rnd(-0.4, 0.4);
      const ey = rnd(-0.4, 0.4);
      const dr = rb - ra;
      const al = dr * dr - (du * du + dv * dv);
      const be = 2 * (ra * dr + ex * du + ey * dv);
      const ga = ra * ra - ex * ex - ey * ey;
      const d0 = rnd(-1, 1);
      const fast = frontDepth(d0, dd, al, be, ga);
      const slow = brute(d0, dd, al, be, ga);
      if (slow === Infinity) continue;
      // A ray that only grazes the capsule can fall between the steps of the walk.
      if (fast === Infinity) continue;
      checked++;
      expect(Math.abs(fast - slow)).toBeLessThan(2e-3);
    }
    expect(checked).toBeGreaterThan(200);
  });
});
