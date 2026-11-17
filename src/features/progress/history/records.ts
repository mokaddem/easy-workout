import type { Programme, SessionLog } from '@/domain';
import { compareBest, pointsByExercise, type BestSet } from '@/engine';

/**
 * Exercises whose best set in this session beat every earlier session's. Needs two sessions
 * before it, and a calibration week or a stop never counts.
 */
export function recordsIn(
  log: Pick<SessionLog, 'id'>,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
): Set<string> {
  const out = new Set<string>();
  for (const [exerciseId, points] of pointsByExercise(logs, programmes)) {
    const index = points.findIndex((p) => p.logId === log.id);
    const point = points[index];
    if (index < 2 || !point?.best || point.calibration || point.stopped) continue;
    let top: BestSet | undefined;
    for (const earlier of points.slice(0, index))
      if (earlier.best && (!top || compareBest(earlier.best, top) > 0)) top = earlier.best;
    if (!top || compareBest(point.best, top) > 0) out.add(exerciseId);
  }
  return out;
}
