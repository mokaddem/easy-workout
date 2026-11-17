/** Scales and ticks shared by the three charts. Pure, so they are tested without a DOM. */

/** Maps a domain onto a pixel range; a flat domain lands in the middle. */
export function linear(d0: number, d1: number, r0: number, r1: number): (value: number) => number {
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** The index of the entry closest to `x` (the plot snaps to a session, never to a pixel). */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = 0;
  let distance = Infinity;
  xs.forEach((candidate, index) => {
    const d = Math.abs(candidate - x);
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return best;
}

/**
 * Whole-number axis for a body measure: from the floor of (min − 0.4) to the ceiling of
 * (max + 0.4), at most five ticks (every other one past that).
 */
export function bodyAxis(values: readonly number[]): { min: number; max: number; ticks: number[] } {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const min = Math.floor(Math.min(...values) - 0.4);
  const max = Math.ceil(Math.max(...values) + 0.4);
  const count = max - min + 1;
  const step = Math.max(1, Math.ceil((count - 1) / 4));
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  return { min, max, ticks };
}

/** Top of the reps panel: the larger of the range's top and the best value, with headroom. */
export const columnCeiling = (rangeMax: number | undefined, bestMax: number): number =>
  Math.max(rangeMax ?? 0, bestMax, 1) * 1.18;

/** Sleep columns always read from 0 to 9 h. */
export const SLEEP_AXIS = { min: 0, max: 9, ticks: [0, 3, 6, 9] } as const;

/** X centres (0..1) of `count` equal slots. */
export const slotCentres = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => (i + 0.5) / count);

/** Width of a column: 55 % of the narrowest gap, between 4 px and `max`. */
export function columnWidth(gaps: readonly number[], max: number): number {
  if (gaps.length === 0) return max;
  return Math.max(4, Math.min(max, Math.round(Math.min(...gaps) * 0.55)));
}

/** Evenly spaced picks of `labels` so at most `limit` remain (first and last kept). */
export function thin<T>(labels: readonly T[], limit: number): T[] {
  if (labels.length <= limit) return [...labels];
  const out: T[] = [];
  for (let i = 0; i < limit; i++)
    out.push(labels[Math.round((i * (labels.length - 1)) / (limit - 1))]!);
  return out;
}
