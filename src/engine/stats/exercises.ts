import type { Exercise, Programme, SessionLog } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { pointsByExercise, type BestSet } from './history';

export interface ExerciseListItem {
  exerciseId: string;
  /** Start of the latest session containing it (ISO). */
  lastAt: string;
  lastLogId: string;
  sessions: number;
  /** Where it stands now: the best set of the latest session. */
  latest?: BestSet;
  /** The latest session ended it with pain. */
  pain: boolean;
}

/** Exercises done in finished sessions (main and finisher, any source), latest first. */
export function exerciseList(
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): ExerciseListItem[] {
  const out: ExerciseListItem[] = [];
  for (const [exerciseId, points] of pointsByExercise(logs, programmes, exercises)) {
    const last = points.at(-1)!;
    out.push({
      exerciseId,
      lastAt: last.at,
      lastLogId: last.logId,
      sessions: points.length,
      ...(last.best && { latest: last.best }),
      pain: last.stopped === 'pain',
    });
  }
  return out.sort(
    (a, b) => b.lastAt.localeCompare(a.lastAt) || a.exerciseId.localeCompare(b.exerciseId),
  );
}
