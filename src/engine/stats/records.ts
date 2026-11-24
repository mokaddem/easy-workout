import type { Exercise, Load, MaxTest, Programme, SessionLog, Target } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { DEFAULT_BODYWEIGHT_KG } from '../generate/loads';
import { bodyShare } from '../progress/ladder';
import { levelOf, pointsByExercise, type ExercisePoint, type PointSet } from './history';

/** Past this many reps a set stops adding to the estimated max. */
const SCORE_REPS_CAP = 12;
/** Sessions of an exercise needed before one of its sets can be a record. */
export const RECORD_MIN_EARLIER = 2;
/** A record this much above the previous best (or heavier than anything before) is worth a cue. */
export const NOTABLE_GAIN = 0.05;

export type RecordUnit = 'reps' | 'seconds';

/** A set as a record shows it: what was done, at which load. */
export interface RecordSet {
  value: number;
  unit: RecordUnit;
  load?: Load;
}

export interface ExerciseRecord {
  exerciseId: string;
  logId: string;
  /** Start of the session (ISO). */
  at: string;
  /** The record set: the best one of the session. */
  set: RecordSet & { itemKey: string; set: number };
  /** The best set before it. */
  previous: RecordSet;
  /** Heavier than anything before, or at least 5 % above the previous best. */
  notable: boolean;
}

export interface RecordOptions {
  exercises?: ReadonlyMap<string, Exercise>;
  /** For the share of the body a leg move lifts; the default of progression when unknown. */
  bodyweightKg?: number;
}

interface Score {
  primary: number;
  /** Ties on `primary` go to the higher one. */
  tie: number;
}

interface Scored {
  score: Score;
  set: RecordSet;
  level: number;
}

const unitOf = (target: Target): RecordUnit | undefined =>
  target.kind === 'reps' || target.kind === 'max'
    ? 'reps'
    : target.kind === 'time'
      ? 'seconds'
      : undefined;

/**
 * Where a set stands, one total order per exercise (the number is never shown).
 * - Weights in hand, counted in reps: the load moved (implement plus the share of the body the
 *   move lifts) with the reps added as an estimated max, reps past 12 not counted; ties go to
 *   more reps.
 * - Added load, bands (a lighter assisting band ranks higher), bodyweight and timed holds: the
 *   load level, then reps or seconds.
 */
export function recordScore(
  set: RecordSet,
  exercise: Exercise | undefined,
  bodyweightKg: number = DEFAULT_BODYWEIGHT_KG,
): Score {
  if (set.unit === 'reps' && set.load?.kind === 'kg') {
    const moved = set.load.kg + (exercise ? bodyShare(exercise, false) : 0) * bodyweightKg;
    return {
      primary: moved * (1 + Math.min(set.value, SCORE_REPS_CAP) / 30),
      tie: set.value,
    };
  }
  return { primary: levelOf(set.load, exercise), tie: set.value };
}

/** Positive when `a` is further along than `b`. */
export const compareScores = (a: Score, b: Score): number =>
  Math.abs(a.primary - b.primary) > 1e-9 ? a.primary - b.primary : a.tie - b.tie;

/** The sets of a session that count as lifted: working sets that kept a value. */
const workingSets = (point: ExercisePoint): PointSet[] =>
  point.sets.filter((s) => !s.backOff && !s.flag && s.value !== undefined && s.value > 0);

const toScored = (
  value: number,
  load: Load | undefined,
  unit: RecordUnit,
  exercise: Exercise | undefined,
  bodyweightKg: number,
): Scored => {
  const set: RecordSet = { value, unit, ...(load && { load }) };
  return { score: recordScore(set, exercise, bodyweightKg), set, level: levelOf(load, exercise) };
};

/** A max test as a lifted set; a test stopped by pain is not a result. */
const testAsSet = (test: MaxTest): { value: number; unit: RecordUnit } | undefined =>
  test.stopped
    ? undefined
    : test.result.kind === 'reps'
      ? { value: test.result.reps, unit: 'reps' }
      : { value: test.result.seconds, unit: 'seconds' };

/**
 * An untouched one-tap at a weight the exercise only just moved to: the step is held once, so
 * the set says nothing about what the user can do there.
 */
const heldAtNewWeight = (log: SessionLog | undefined, set: PointSet): boolean => {
  if (!log?.progression?.[set.itemKey]?.newLoad) return false;
  return !log.sets.some(
    (s) =>
      `${s.section}/${s.blockIndex}/${s.itemIndex}` === set.itemKey &&
      s.set === set.set &&
      (s.edited === true || s.feelChosen === true),
  );
};

/**
 * Records along one exercise's sessions, oldest first.
 *
 * What a session is compared with: every earlier session of the exercise (any source;
 * calibration and deload weeks included, they were lifted) and its max tests, working sets only.
 * A set can be a record when it is a working set of a session that is not a calibration or a
 * deload week and did not stop the exercise, with at least two earlier sessions, reaching the
 * bottom of its range, and not a held one-tap at a new weight. A record scores strictly above
 * the best of the history.
 */
export function recordsAlong(
  exerciseId: string,
  points: readonly ExercisePoint[],
  tests: readonly MaxTest[],
  logsById: ReadonlyMap<string, SessionLog>,
  options: RecordOptions = {},
): ExerciseRecord[] {
  const exercise = (options.exercises ?? catalogueById).get(exerciseId);
  if (exercise?.tags.includes('stretch')) return [];
  const bodyweightKg = options.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
  const own = tests
    .filter((t) => t.exerciseId === exerciseId && testAsSet(t))
    .sort((a, b) => a.at.localeCompare(b.at));
  const best: Partial<Record<RecordUnit, Scored>> = {};
  const topLevel: Partial<Record<RecordUnit, number>> = {};
  const earlier: Record<RecordUnit, number> = { reps: 0, seconds: 0 };
  let testIndex = 0;
  const out: ExerciseRecord[] = [];

  const absorb = (item: Scored) => {
    const unit = item.set.unit;
    if (!best[unit] || compareScores(item.score, best[unit].score) > 0) best[unit] = item;
    if (topLevel[unit] === undefined || item.level > topLevel[unit]) topLevel[unit] = item.level;
  };

  for (const point of points) {
    while (testIndex < own.length && own[testIndex]!.at < point.at) {
      const test = own[testIndex++]!;
      const t = testAsSet(test)!;
      absorb(toScored(t.value, test.load, t.unit, exercise, bodyweightKg));
    }
    const unit = unitOf(point.target);
    if (!unit) continue;
    const eligible =
      !point.calibration &&
      point.role !== 'deload' &&
      !point.stopped &&
      earlier[unit] >= RECORD_MIN_EARLIER;
    const previous = best[unit];
    const floor = point.range?.min;
    const log = logsById.get(point.logId);
    const sets = workingSets(point);
    let top: { item: Scored; set: PointSet } | undefined;
    if (eligible && previous)
      for (const set of sets) {
        if (floor !== undefined && set.value! < floor) continue;
        if (heldAtNewWeight(log, set)) continue;
        const item = toScored(set.value!, set.load, unit, exercise, bodyweightKg);
        if (compareScores(item.score, previous.score) <= 0) continue;
        if (!top || compareScores(item.score, top.item.score) > 0) top = { item, set };
      }
    if (top && previous) {
      const heavier = top.item.level > topLevel[unit]! + 1e-9;
      const kgBoth = previous.set.load?.kind === 'kg' && top.item.set.load?.kind === 'kg';
      const gain =
        unit === 'reps' && kgBoth
          ? top.item.score.primary / previous.score.primary - 1
          : top.item.level === previous.level
            ? top.item.set.value / Math.max(1, previous.set.value) - 1
            : 0;
      out.push({
        exerciseId,
        logId: point.logId,
        at: point.at,
        set: { ...top.item.set, itemKey: top.set.itemKey, set: top.set.set },
        previous: previous.set,
        notable: heavier || gain >= NOTABLE_GAIN - 1e-9,
      });
    }
    for (const set of sets) absorb(toScored(set.value!, set.load, unit, exercise, bodyweightKg));
    earlier[unit]++;
  }
  return out;
}

const finishedBefore = (logs: readonly SessionLog[], log: SessionLog): SessionLog[] =>
  logs.filter((l) => l.id !== log.id && l.status !== 'in-progress' && l.startedAt < log.startedAt);

const asFinished = (log: SessionLog): SessionLog =>
  log.status === 'in-progress' ? { ...log, status: 'completed' } : log;

const byId = (logs: readonly SessionLog[]) => new Map(logs.map((l) => [l.id, l]));

/**
 * The record set of each exercise of a session, with the best set before it. Works on a log
 * that is not stored yet (the summary). Max tests are part of the history.
 */
export function sessionRecords(
  log: SessionLog,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  tests: readonly MaxTest[] = [],
  options: RecordOptions = {},
): ExerciseRecord[] {
  const upTo = [...finishedBefore(logs, log), asFinished(log)];
  const exercises = options.exercises ?? catalogueById;
  const points = pointsByExercise(upTo, programmes, exercises);
  const lookup = byId(upTo);
  const out: ExerciseRecord[] = [];
  const ids = new Set(log.sets.filter((s) => s.section !== 'warmup').map((s) => s.exerciseId));
  for (const exerciseId of ids) {
    const record = recordsAlong(exerciseId, points.get(exerciseId) ?? [], tests, lookup, options)
      .filter((r) => r.logId === log.id)
      .at(-1);
    if (record) out.push(record);
  }
  return out;
}

/** Where a set sits in its session. */
export interface SetRef {
  section: 'warmup' | 'main' | 'finisher';
  blockIndex: number;
  itemIndex: number;
  set: number;
}

/**
 * For the rest screen: the record a just-logged set makes, when it is a notable one and also
 * beats every earlier set of the session. `log` may still be in progress; sets logged after
 * this one are ignored.
 */
export function setRecord(
  log: SessionLog,
  ref: SetRef,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  tests: readonly MaxTest[] = [],
  options: RecordOptions = {},
): ExerciseRecord | undefined {
  const matches = (s: SessionLog['sets'][number]) =>
    s.section === ref.section &&
    s.blockIndex === ref.blockIndex &&
    s.itemIndex === ref.itemIndex &&
    s.set === ref.set;
  let last = -1;
  log.sets.forEach((s, i) => {
    if (matches(s)) last = i;
  });
  if (last < 0 || ref.section === 'warmup') return undefined;
  const exerciseId = log.sets[last]!.exerciseId;
  const sofar = asFinished({ ...log, sets: log.sets.slice(0, last + 1) });
  const upTo = [...finishedBefore(logs, log), sofar];
  const points = pointsByExercise(
    upTo,
    programmes,
    options.exercises ?? catalogueById,
    exerciseId,
  ).get(exerciseId);
  const record = recordsAlong(exerciseId, points ?? [], tests, byId(upTo), options)
    .filter((r) => r.logId === log.id)
    .at(-1);
  const itemKey = `${ref.section}/${ref.blockIndex}/${ref.itemIndex}`;
  return record?.notable && record.set.itemKey === itemKey && record.set.set === ref.set
    ? record
    : undefined;
}

/** Every record of an exercise, oldest first: the points to mark on its timeline. */
export function recordPoints(
  exerciseId: string,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  tests: readonly MaxTest[] = [],
  options: RecordOptions = {},
): ExerciseRecord[] {
  const exercises = options.exercises ?? catalogueById;
  const points = pointsByExercise(logs, programmes, exercises, exerciseId).get(exerciseId);
  return recordsAlong(exerciseId, points ?? [], tests, byId(logs), options);
}
