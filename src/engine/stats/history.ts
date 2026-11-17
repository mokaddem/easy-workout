import type {
  Exercise,
  Feel,
  Load,
  Programme,
  SessionLog,
  SessionSource,
  SetLog,
  Side,
  Target,
} from '../../domain';
import { BAND_LEVELS } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { itemKey } from '../play';
import { weekRole, type WeekRole } from '../progress/exposures';
import { localDate, weekStartOf } from './dates';

export type PointUnit = 'reps' | 'seconds' | 'minutes' | 'rounds';

/** The set a session is remembered by. */
export interface BestSet {
  value: number;
  unit: PointUnit;
  load?: Load;
  /** Orders loads: kilograms, or band rank (an assisted band ranks lower the more it helps). 0 without a load. */
  level: number;
  speedKmh?: number;
  inclinePct?: number;
  /** Interval work phase, seconds. */
  workSec?: number;
}

/** One working set as logged, both sides merged (the worse side counts). */
export interface PointSet {
  itemKey: string;
  set: number;
  /** Reps, seconds, minutes or rounds; absent for a set that was flagged and kept nothing. */
  value?: number;
  load?: Load;
  weakerSide?: Side;
  feel?: Feel;
  /** A lighter set after a hard first one; never the best set. */
  backOff: boolean;
  flag?: 'pain' | 'no-equipment';
}

/** One session of an exercise, for the chart and its readout. */
export interface ExercisePoint {
  logId: string;
  /** Start of the session (ISO). */
  at: string;
  /** Local `YYYY-MM-DD`. */
  date: string;
  source: SessionSource['kind'];
  sessionId: string;
  sessionName: SessionLog['plan']['name'];
  /** Programme week, for programme sessions. */
  week?: number;
  role: WeekRole;
  /** The target of the item that day. */
  target: Target;
  /** Its range, for the chart's band: reps, seconds or minutes. Absent for max and intervals. */
  range?: { min: number; max: number };
  /** Absent when nothing was performed (equipment missing, pain before any rep). */
  best?: BestSet;
  /** The best set comes from a set stopped by pain (reps done before the stop). */
  partial?: boolean;
  sets: PointSet[];
  /** Pain or missing equipment ended the exercise this day. */
  stopped?: 'pain' | 'no-equipment';
  /** First build-week exposure of the exercise: the loads were estimates, not earned. */
  calibration: boolean;
}

/** The ordering of loads and the unit of one exercise's sets. */
export const levelOf = (load: Load | undefined, exercise: Exercise | undefined): number => {
  if (!load) return 0;
  if (load.kind === 'kg' || load.kind === 'added-kg') return load.kg;
  if (load.kind === 'band') {
    const rank = BAND_LEVELS.indexOf(load.level) + 1;
    return exercise?.loadType === 'band-assisted' ? -rank : rank;
  }
  return 0;
};

const sameLoad = (a: Load | undefined, b: Load | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

const valueOf = (set: SetLog): { value: number; unit: PointUnit } | undefined => {
  const a = set.actual;
  if (!a) return undefined;
  switch (set.planned.target.kind) {
    case 'reps':
    case 'max':
      return a.reps === undefined ? undefined : { value: a.reps, unit: 'reps' };
    case 'time':
      return a.durationSec === undefined ? undefined : { value: a.durationSec, unit: 'seconds' };
    case 'cardio':
      return a.durationSec === undefined
        ? undefined
        : { value: Math.round((a.durationSec / 60) * 10) / 10, unit: 'minutes' };
    case 'interval':
      return a.rounds === undefined ? undefined : { value: a.rounds, unit: 'rounds' };
  }
};

const rangeOf = (t: Target): ExercisePoint['range'] => {
  if (t.kind === 'reps') return { min: t.min, max: t.max };
  if (t.kind === 'time') return { min: t.minSec, max: t.maxSec };
  if (t.kind === 'cardio') return { min: t.minMinutes, max: t.maxMinutes };
  return undefined;
};

/** Which of two best sets is further along: the heavier load, then more reps. */
export const compareBest = (a: BestSet, b: BestSet): number =>
  a.level !== b.level ? a.level - b.level : a.value - b.value;

interface Merged {
  point: PointSet;
  level: number;
  unit?: PointUnit;
  best: Pick<BestSet, 'speedKmh' | 'inclinePct'>;
}

/** The sets of one exercise in a log, the two sides of a per-side set merged. */
function mergeSets(log: SessionLog, sets: SetLog[], exercise: Exercise | undefined): Merged[] {
  const groups = new Map<string, SetLog[]>();
  for (const s of sets) {
    const key = `${s.section}/${s.blockIndex}/${s.itemIndex}/${s.set}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const out: Merged[] = [];
  for (const sides of groups.values()) {
    const first = sides[0]!;
    const ik = itemKey(first.section, first.blockIndex, first.itemIndex);
    const flag = sides.find((s) => s.flag === 'pain' || s.flag === 'no-equipment')?.flag as
      'pain' | 'no-equipment' | undefined;
    const valued = sides
      .map((s) => ({ s, v: valueOf(s) }))
      .filter((x): x is { s: SetLog; v: { value: number; unit: PointUnit } } => x.v !== undefined);
    const worse = valued.sort((a, b) => a.v.value - b.v.value)[0];
    const lowestLevel = Math.min(
      ...sides.map((s) => levelOf(s.actual?.load ?? s.planned.load, exercise)),
    );
    const weaker =
      valued.length === 2 && valued[0]!.v.value !== valued[1]!.v.value
        ? valued[0]!.s.side
        : undefined;
    const load = (worse?.s ?? first).actual?.load ?? (worse?.s ?? first).planned.load;
    const backOffLoad = log.adjustments?.backOffLoads?.[ik];
    const feel = sides.find((s) => s.feel === 'hard')?.feel ?? sides.find((s) => s.feel)?.feel;
    out.push({
      point: {
        itemKey: ik,
        set: first.set,
        ...(worse && { value: worse.v.value }),
        ...(load && { load }),
        ...(weaker && { weakerSide: weaker }),
        ...(feel && { feel }),
        backOff:
          first.set > 1 && backOffLoad !== undefined && sameLoad(first.planned.load, backOffLoad),
        ...(flag && { flag }),
      },
      level: lowestLevel,
      ...(worse && { unit: worse.v.unit }),
      best: {
        ...(worse?.s.actual?.speedKmh !== undefined && { speedKmh: worse.s.actual.speedKmh }),
        ...(worse?.s.actual?.inclinePct !== undefined && { inclinePct: worse.s.actual.inclinePct }),
      },
    });
  }
  return out.sort((a, b) => a.point.set - b.point.set);
}

function bestOf(
  merged: Merged[],
  pick: (m: Merged) => boolean,
  target: Target,
): BestSet | undefined {
  let best: { m: Merged; set: BestSet } | undefined;
  for (const m of merged) {
    if (!pick(m) || m.point.value === undefined || m.unit === undefined) continue;
    const candidate: BestSet = {
      value: m.point.value,
      unit: m.unit,
      level: m.level,
      ...(m.point.load && { load: m.point.load }),
      ...m.best,
      ...(target.kind === 'interval' && { workSec: target.workSec }),
    };
    if (!best || compareBest(candidate, best.set) > 0) best = { m, set: candidate };
  }
  return best?.set;
}

/** Local `YYYY-MM-DD` and Monday-start week key of an ISO instant. */
export const dayOf = (iso: string): string => localDate(new Date(iso));

/**
 * Every session of every exercise (main and finisher, any source, finished logs only), oldest
 * first, per exercise. With `only`, just that exercise.
 */
export function pointsByExercise(
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
  only?: string,
): Map<string, ExercisePoint[]> {
  const byProgramme = new Map(programmes.map((p) => [p.id, p]));
  const out = new Map<string, ExercisePoint[]>();
  const calibrated = new Set<string>();
  const finished = logs
    .filter((l) => l.status !== 'in-progress')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const log of finished) {
    const programmeSource = log.source.kind === 'programme' ? log.source : undefined;
    const role = weekRole(
      programmeSource && byProgramme.get(programmeSource.programmeId),
      programmeSource?.week,
    );
    const byExercise = new Map<string, SetLog[]>();
    for (const s of log.sets) {
      if (s.section === 'warmup' || (only && s.exerciseId !== only)) continue;
      byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
    }
    for (const [exerciseId, sets] of byExercise) {
      const exercise = exercises.get(exerciseId);
      const entry = sets.map((s) => planItem(log, s)).find((i) => i !== undefined);
      if (!entry) continue;
      const merged = mergeSets(log, sets, exercise);
      const clean = merged.filter((m) => !m.point.flag);
      const nonBackOff = (m: Merged) => !m.point.backOff;
      let best = bestOf(clean, nonBackOff, entry.target) ?? bestOf(clean, () => true, entry.target);
      let partial = false;
      if (!best) {
        best = bestOf(
          merged.filter((m) => m.point.flag === 'pain'),
          () => true,
          entry.target,
        );
        partial = best !== undefined;
      }
      const stopped = merged.find((m) => m.point.flag)?.point.flag;
      // Estimates of the first build week aren't earned values.
      const first =
        programmeSource !== undefined && role === 'build' && !calibrated.has(exerciseId);
      if (first) calibrated.add(exerciseId);
      const range = rangeOf(entry.target);
      const point: ExercisePoint = {
        logId: log.id,
        at: log.startedAt,
        date: dayOf(log.startedAt),
        source: log.source.kind,
        sessionId: log.plan.id,
        sessionName: log.plan.name,
        ...(programmeSource && { week: programmeSource.week }),
        role,
        target: entry.target,
        ...(range && { range }),
        ...(best && { best }),
        ...(partial && { partial }),
        sets: merged.map((m) => m.point),
        ...(stopped && { stopped }),
        calibration: first,
      };
      out.set(exerciseId, [...(out.get(exerciseId) ?? []), point]);
    }
  }
  return out;
}

/** The plan item a set belongs to. */
function planItem(log: SessionLog, set: SetLog): { target: Target } | undefined {
  const block = log.plan[set.section][set.blockIndex];
  const item = block && (block.type === 'straight' ? block.item : block.items[set.itemIndex]);
  return item ? { target: item.target } : { target: set.planned.target };
}

/** One point per finished session containing the exercise, oldest first. */
export function exerciseHistory(
  exerciseId: string,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): ExercisePoint[] {
  return pointsByExercise(logs, programmes, exercises, exerciseId).get(exerciseId) ?? [];
}

/** The points of one Monday-start week, with the one that stands for it. */
export interface WeekBucket {
  /** `YYYY-MM-DD` of the Monday. */
  weekStart: string;
  /** The week's best point (heaviest load, then most reps); the latest on a tie. */
  best: ExercisePoint;
  count: number;
}

/** Points grouped per calendar week, best of the week each, oldest first. For long ranges. */
export function bucketByWeek(points: readonly ExercisePoint[]): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>();
  for (const p of points) {
    const key = weekStartOf(p.at);
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, { weekStart: key, best: p, count: 1 });
      continue;
    }
    current.count++;
    if (!current.best.best || (p.best && compareBest(p.best, current.best.best) >= 0))
      current.best = p;
  }
  return [...buckets.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
