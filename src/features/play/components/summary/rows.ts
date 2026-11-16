import { BAND_LEVELS, setLogKey } from '@/domain';
import type { Load, SessionLog, SetFlag } from '@/domain';
import { itemKey, playSteps, type Prescribed } from '@/engine';

/** What happened to one main exercise in a session, from the stored sets. */
export interface ExerciseDone {
  key: string;
  exerciseId: string;
  /** Planned sets (or rounds). */
  total: number;
  /** Reps or seconds of each set performed, in order (one side of a per-side set). */
  values: number[];
  unit: 'reps' | 'seconds';
  /** Part of a superset or circuit: the sets are rounds. */
  group: boolean;
  /** Load of the last performed set. */
  load?: Load;
  /** Stopped by pain or missing equipment. */
  flag?: Exclude<SetFlag, 'skipped'>;
  /** Nothing was logged for it (ended early before it). */
  notReached: boolean;
  /** The target range, when the exercise has one. */
  min?: number;
  max?: number;
}

/** One entry per main exercise in session order, plus any finisher exercise that was stopped. */
export function mainExercises(
  log: Pick<SessionLog, 'plan' | 'adjustments' | 'sets'>,
): ExerciseDone[] {
  const byKey = new Map(log.sets.map((set) => [setLogKey(set), set]));
  const rows = new Map<string, ExerciseDone & { sets: Set<number> }>();
  for (const step of playSteps(log.plan, log.adjustments)) {
    if (step.section === 'warmup') continue;
    const key = itemKey(step.section, step.blockIndex, step.itemIndex);
    const target = step.item.target;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        exerciseId: step.item.exerciseId,
        total: 0,
        values: [],
        unit: target.kind === 'reps' || target.kind === 'max' ? 'reps' : 'seconds',
        group: step.block.type === 'group',
        notReached: true,
        sets: new Set(),
        ...(target.kind === 'reps' && { min: target.min, max: target.max }),
        ...(target.kind === 'time' && { min: target.minSec, max: target.maxSec }),
      };
      rows.set(key, row);
    }
    const logged = byKey.get(setLogKey(step));
    if (step.side !== 'right') row.total++;
    if (!logged || (logged.flag === 'skipped' && !logged.actual)) continue;
    if (logged.flag !== 'skipped') row.notReached = false;
    if (logged.flag && logged.flag !== 'skipped') row.flag ??= logged.flag;
    if (logged.actual && !row.sets.has(step.set)) {
      row.sets.add(step.set);
      const value =
        row.unit === 'reps'
          ? logged.actual.reps
          : (logged.actual.durationSec ?? logged.actual.reps);
      if (value !== undefined) row.values.push(value);
      if (logged.actual.load) row.load = logged.actual.load;
    }
  }
  return [...rows.values()]
    .filter((row) => row.key.startsWith('main/') || row.flag !== undefined)
    .map(({ sets: _sets, ...row }) => row);
}

/** Weight of a load on one scale, for comparing two of the same exercise. */
const weight = (load: Load | undefined): number => {
  if (!load || load.kind === 'bodyweight') return 0;
  if (load.kind === 'band') return BAND_LEVELS.indexOf(load.level) + 1;
  return load.kg;
};

/**
 * Does next time ask for more than this time? A heavier load (a lighter band when assisted),
 * a slower tempo at the same load, or a higher goal at the same load and tempo.
 */
export function movesUp(before: Prescribed, after: Prescribed, assisted = false): boolean {
  const b = weight(before.load);
  const a = weight(after.load);
  if (a !== b) return assisted && before.load?.kind === 'band' ? a < b : a > b;
  const tempo = (p: Prescribed) => (p.tempo ? JSON.stringify(p.tempo) : '');
  if (tempo(before) !== tempo(after)) return true;
  const goal = (p: Prescribed) => p.goal;
  return goal(after) !== undefined && goal(before) !== undefined && goal(after)! > goal(before)!;
}

/** Splits a figure like "20 kg" or "14 reps" into its numeral and unit; words stay whole. */
export function splitFigure(text: string): { n: string; unit: string } {
  const match = /^([+\u2212-]?\d[\d.,]*(?:-\d[\d.,]*)*)[\s\u00a0\u202f]*(.*)$/u.exec(text);
  return match ? { n: match[1]!, unit: match[2]! } : { n: text, unit: '' };
}
