import type { BodyPoint } from '@/engine';
import { bodyAxis, linear, SLEEP_AXIS } from './scales';

export interface BodyLayout {
  /** X of each point, 0..1 across the plot (10 px padding is applied by the component). */
  xs: number[];
  axis: { min: number; max: number; ticks: readonly number[] };
  /** Indices that get a date label under them. */
  labelled: number[];
  /** Labels are months rather than days. */
  monthLabels: boolean;
}

const day = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Where the check-ins of one measure sit: dates in time, whole-number y axis (sleep: 0–9 h). */
export function bodyLayout(points: readonly BodyPoint[], sleep: boolean): BodyLayout {
  const axis = sleep ? SLEEP_AXIS : bodyAxis(points.map((p) => p.value));
  const t0 = points.length > 0 ? day(points[0]!.date) : 0;
  const t1 = points.length > 0 ? day(points.at(-1)!.date) : 0;
  const x = linear(t0, t1, 0, 1);
  const xs = points.map((p) => (points.length === 1 ? 0.5 : x(day(p.date))));
  if (points.length <= 7)
    return { xs, axis, labelled: points.map((_, i) => i), monthLabels: false };
  // One label per month, where its first check-in falls; the last one is always named.
  const labelled: number[] = [];
  let month = '';
  points.forEach((p, i) => {
    if (p.date.slice(0, 7) !== month) {
      month = p.date.slice(0, 7);
      labelled.push(i);
    }
  });
  const last = points.length - 1;
  if (!labelled.includes(last)) {
    // Drop a label that would crowd the last one.
    if (labelled.length > 0 && xs[last]! - xs[labelled.at(-1)!]! < 0.12) labelled.pop();
    labelled.push(last);
  }
  return { xs, axis, labelled, monthLabels: true };
}
