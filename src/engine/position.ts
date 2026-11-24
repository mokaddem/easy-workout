import type { Programme, SessionLog } from '../domain';

export interface Position {
  /** 1-based week. */
  week: number;
  /** Index in the rotation of the next session to run. */
  index: number;
  sessionId: string;
  /** Every session of every week is done. */
  finished: boolean;
}

/**
 * The next session in the rotation. No calendar: each completed session of this programme
 * that counts as done moves the rotation on by one, and a week ends after `sessionsPerWeek` sessions.
 */
export function nextSession(
  programme: Programme & { id: string },
  logs: readonly SessionLog[] = [],
): Position {
  const size = programme.rotation.length;
  const perWeek = programme.sessionsPerWeek;
  const done = logs.filter(
    (log) =>
      log.status === 'completed' &&
      log.countsAsDone !== false &&
      log.source.kind === 'programme' &&
      log.source.programmeId === programme.id,
  ).length;
  const total = perWeek * programme.weeks;
  const finished = done >= total;
  const step = Math.min(done, total - 1);
  const index = step % size;
  return {
    week: Math.floor(step / perWeek) + 1,
    index,
    sessionId: programme.rotation[index]!.id,
    finished,
  };
}
