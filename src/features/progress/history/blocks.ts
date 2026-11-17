import type { Feel, Load, Section, SessionLog, SetFlag, Side } from '@/domain';
import { itemKey } from '@/engine';
import { itemsOf } from '../../programme/format';

export type RowUnit = 'reps' | 'seconds' | 'minutes' | 'rounds';

/** One logged set, as the detail's table shows it. */
export interface SetRow {
  /** 1-based set or round. */
  n: number;
  side?: Side;
  /** What was done; absent for a flagged set that kept nothing. */
  value?: number;
  unit: RowUnit;
  load?: Load;
  /** What the set aimed for. */
  goal?: number;
  feel?: Feel;
  flag?: SetFlag;
}

export interface ExerciseBlock {
  key: string;
  section: Section;
  exerciseId: string;
  rows: SetRow[];
  /** Pain or missing equipment ended the exercise. */
  stopped?: Extract<SetFlag, 'pain' | 'no-equipment'>;
  /** No set was logged for it. */
  notReached: boolean;
  /** Part of a superset or circuit. */
  group: boolean;
}

function rowOf(set: SessionLog['sets'][number]): SetRow {
  const kind = set.planned.target.kind;
  const unit: RowUnit =
    kind === 'time'
      ? 'seconds'
      : kind === 'cardio'
        ? 'minutes'
        : kind === 'interval'
          ? 'rounds'
          : 'reps';
  const a = set.actual;
  let value: number | undefined;
  if (a) {
    if (unit === 'reps') value = a.reps;
    else if (unit === 'seconds') value = a.durationSec ?? a.reps;
    else if (unit === 'minutes')
      value = a.durationSec === undefined ? undefined : Math.round(a.durationSec / 60);
    else value = a.rounds;
  }
  const load = a?.load ?? set.planned.load;
  return {
    n: set.set,
    ...(set.side && { side: set.side }),
    ...(value !== undefined && { value }),
    unit,
    ...(load && load.kind !== 'bodyweight' && { load }),
    ...(set.planned.goal !== undefined && unit !== 'minutes' && { goal: set.planned.goal }),
    ...(set.feel && { feel: set.feel }),
    ...(set.flag && { flag: set.flag }),
  };
}

/** Every exercise of the session as it was run, in order, with the sets logged for it. */
export function exerciseBlocks(log: Pick<SessionLog, 'plan' | 'sets'>): ExerciseBlock[] {
  const out: ExerciseBlock[] = [];
  for (const section of ['warmup', 'main', 'finisher'] as const) {
    log.plan[section].forEach((block, blockIndex) => {
      itemsOf(block).forEach((item, itemIndex) => {
        const sets = log.sets
          .filter(
            (s) =>
              s.section === section && s.blockIndex === blockIndex && s.itemIndex === itemIndex,
          )
          .sort(
            (a, b) => a.set - b.set || (a.side === 'right' ? 1 : 0) - (b.side === 'right' ? 1 : 0),
          );
        const stopped = sets.find((s) => s.flag === 'pain' || s.flag === 'no-equipment')?.flag as
          'pain' | 'no-equipment' | undefined;
        out.push({
          key: itemKey(section, blockIndex, itemIndex),
          section,
          exerciseId: item.exerciseId,
          rows: sets.map(rowOf),
          ...(stopped && { stopped }),
          notReached: sets.length === 0,
          group: block.type === 'group',
        });
      });
    });
  }
  return out;
}
