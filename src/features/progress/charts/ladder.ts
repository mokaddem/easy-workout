import { BAND_LEVELS } from '@/domain';
import type { BandLevel, Exercise } from '@/domain';
import { bucketByWeek, type BestSet, type ExercisePoint } from '@/engine';

/** Past this many sessions the long range draws one column per week. */
export const BUCKET_AFTER = 40;

export type LadderRange = 'cycle' | 'all';
export type LevelKind = 'kg' | 'added' | 'band' | 'assisted';

export interface LadderItem {
  key: string;
  point: ExercisePoint;
  /** 0..1 across the plot. */
  x: number;
  /** What the column shows: reps, seconds, minutes. Absent when nothing was performed. */
  value?: number;
  /** Where the step line sits (kilograms, or band rank). */
  level?: number;
  /** Stopped by pain: drawn hollow. */
  hollow: boolean;
  /** Nothing performed, no equipment: a dash on the baseline. */
  noEquipment: boolean;
  /** Sessions behind the item when it stands for a whole week. */
  sessions: number;
}

export interface Rung {
  value: number;
  band?: BandLevel;
  /** Bodyweight only, no load or no help. */
  sans?: boolean;
}

export interface AxisLabel {
  x: number;
  kind: 'week' | 'month';
  week?: number;
  /** `YYYY-MM-DD` of the first of the month. */
  date?: string;
  current?: boolean;
  later?: boolean;
}

export interface LadderModel {
  items: LadderItem[];
  /** Level changes: the item pair they sit between and the x in between. */
  steps: { x: number; from: number; to: number }[];
  /** Rungs ascending by value. */
  level?: { kind: LevelKind; rungs: Rung[] };
  range?: { min: number; max: number };
  /** Tallest column value. */
  valueMax: number;
  axis: AxisLabel[];
  /** Week slots (cycle range): their x edges and whether it is the current week. */
  slots: { x0: number; x1: number; current: boolean }[];
  bucketed: boolean;
}

export interface LadderInput {
  /** Oldest first. */
  points: readonly ExercisePoint[];
  range: LadderRange;
  /** The programme's weeks and the one the user is in (the cycle range). */
  cycle?: { weeks: number; current: number };
  exercise?: Exercise;
  /** Band levels the user owns (rungs of the band panel); all when unknown. */
  ownedBands?: readonly BandLevel[];
  now: Date;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The number a session's column is drawn at, in the unit of its kind. */
export function columnValue(best: BestSet | undefined): number | undefined {
  if (!best) return undefined;
  return best.unit === 'rounds' ? round1((best.value * (best.workSec ?? 0)) / 60) : best.value;
}

function levelOfLoad(best: BestSet | undefined): number | undefined {
  return best ? best.level : undefined;
}

function placeInCycle(
  points: readonly ExercisePoint[],
  cycle: { weeks: number; current: number },
): number[] {
  // A quick or own session joins the week of the programme session before it.
  let week = 1;
  const weeks = points.map((p) => {
    if (p.week !== undefined) week = p.week;
    return Math.min(Math.max(week, 1), cycle.weeks);
  });
  const counts = new Map<number, number>();
  for (const w of weeks) counts.set(w, (counts.get(w) ?? 0) + 1);
  const seen = new Map<number, number>();
  return weeks.map((w) => {
    const k = seen.get(w) ?? 0;
    seen.set(w, k + 1);
    return (w - 1 + (k + 0.5) / counts.get(w)!) / cycle.weeks;
  });
}

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function levelModel(
  items: readonly LadderItem[],
  exercise: Exercise | undefined,
  owned: readonly BandLevel[] | undefined,
): LadderModel['level'] {
  const loads = items.flatMap((i) => (i.point.best?.load ? [i.point.best.load] : []));
  const bands = loads.filter((l) => l.kind === 'band');
  if (bands.length > 0) {
    const assisted = exercise?.loadType === 'band-assisted';
    const used = new Set(bands.map((l) => l.level));
    const levels = BAND_LEVELS.filter((l) => used.has(l) || (owned ?? BAND_LEVELS).includes(l));
    const rungs: Rung[] = levels.map((band) => {
      const rank = BAND_LEVELS.indexOf(band) + 1;
      return { value: assisted ? -rank : rank, band };
    });
    if (assisted) rungs.push({ value: 0, sans: true });
    return { kind: assisted ? 'assisted' : 'band', rungs: rungs.sort((a, b) => a.value - b.value) };
  }
  const kgs = loads.filter((l) => l.kind === 'kg' || l.kind === 'added-kg');
  if (kgs.length === 0) return undefined;
  const added = kgs.some((l) => l.kind === 'added-kg');
  const values = new Set<number>(items.flatMap((i) => (i.level === undefined ? [] : [i.level])));
  if (added) values.add(0);
  const rungs: Rung[] = [...values]
    .sort((a, b) => a - b)
    .map((value) => ({ value, ...(added && value === 0 && { sans: true }) }));
  return { kind: added ? 'added' : 'kg', rungs };
}

/** Everything the ladder chart draws, in data units; the component turns it into pixels. */
export function ladderModel(input: LadderInput): LadderModel {
  const { range, cycle, now } = input;
  const bucketed = range === 'all' && input.points.length > BUCKET_AFTER;
  const sessions = new Map<string, number>();
  let points: readonly ExercisePoint[] = input.points;
  if (bucketed) {
    const buckets = bucketByWeek(input.points);
    points = buckets.map((b) => b.best);
    for (const b of buckets) sessions.set(b.best.logId, b.count);
  }

  let xs: number[];
  const axis: AxisLabel[] = [];
  const slots: LadderModel['slots'] = [];
  if (range === 'cycle' && cycle) {
    xs = placeInCycle(points, cycle);
    for (let w = 1; w <= cycle.weeks; w++) {
      slots.push({ x0: (w - 1) / cycle.weeks, x1: w / cycle.weeks, current: w === cycle.current });
      axis.push({
        x: (w - 0.5) / cycle.weeks,
        kind: 'week',
        week: w,
        current: w === cycle.current,
        later: w > cycle.current,
      });
    }
  } else {
    const t0 = points.length > 0 ? Date.parse(points[0]!.at) : now.getTime();
    const t1 = Math.max(now.getTime(), points.length > 0 ? Date.parse(points.at(-1)!.at) : 0);
    const span = t1 - t0;
    const at = (t: number) => (span <= 0 ? 0.5 : 0.03 + ((t - t0) / span) * 0.94);
    xs = points.map((p) => (points.length === 1 ? 0.5 : at(Date.parse(p.at))));
    const labels: AxisLabel[] = [];
    if (span > 0) {
      for (let m = monthStart(new Date(t0)); m.getTime() <= t1;) {
        const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        // A month is labelled where its middle falls inside the range.
        const mid = (m.getTime() + next.getTime()) / 2;
        if (mid >= t0 && mid <= t1) labels.push({ x: at(mid), kind: 'month', date: iso(m) });
        m = next;
      }
    }
    // Keep the labels apart: at most five.
    const step = Math.ceil(labels.length / 5) || 1;
    axis.push(...labels.filter((_, i) => i % step === 0));
    if (axis.length === 0 && points.length > 0)
      axis.push({ x: xs[0]!, kind: 'month', date: points[0]!.date });
  }

  const items: LadderItem[] = points.map((point, i) => {
    const value = columnValue(point.best);
    const level = levelOfLoad(point.best);
    return {
      key: point.logId,
      point,
      x: xs[i]!,
      ...(value !== undefined && { value }),
      ...(level !== undefined && { level }),
      hollow: point.stopped === 'pain',
      noEquipment: point.stopped === 'no-equipment' && !point.best,
      sessions: sessions.get(point.logId) ?? 1,
    };
  });

  const steps: LadderModel['steps'] = [];
  let before = -1;
  items.forEach((item, i) => {
    if (item.level === undefined) return;
    if (before >= 0 && items[before]!.level !== item.level)
      steps.push({ x: (items[before]!.x + item.x) / 2, from: before, to: i });
    before = i;
  });

  const latest = points.at(-1);
  const rangeNow = latest?.range;
  return {
    items,
    steps,
    ...(() => {
      const level = levelModel(items, input.exercise, input.ownedBands);
      return level ? { level } : {};
    })(),
    ...(rangeNow && { range: rangeNow }),
    valueMax: Math.max(0, ...items.map((i) => i.value ?? 0)),
    axis,
    slots,
    bucketed,
  };
}
