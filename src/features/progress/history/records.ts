import type { MaxTest, Programme, SessionLog } from '@/domain';
import { sessionRecords, type ExerciseRecord } from '@/engine';

/** The records a stored session set, by exercise: the same definition as the summary and the timeline. */
export function recordsIn(
  log: SessionLog,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  tests: readonly MaxTest[] = [],
  bodyweightKg?: number,
): Map<string, ExerciseRecord> {
  return new Map(
    sessionRecords(log, logs, programmes, tests, {
      ...(bodyweightKg !== undefined && { bodyweightKg }),
    }).map((record) => [record.exerciseId, record]),
  );
}
