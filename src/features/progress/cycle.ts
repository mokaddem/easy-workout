import type { Programme, SessionLog } from '@/domain';
import type { CycleCellState, CycleStripWeek } from '@/ui/components';

/** Sessions that moved the programme's rotation, in the order they were started. */
export function countedLogs(
  programme: Pick<Programme, 'id'>,
  logs: readonly SessionLog[],
): SessionLog[] {
  return logs
    .filter(
      (log) =>
        log.status === 'completed' &&
        log.countsAsDone !== false &&
        log.source.kind === 'programme' &&
        log.source.programmeId === programme.id,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export interface CycleProgress {
  weeks: CycleStripWeek[];
  /** Sessions done in full or ended early that counted. */
  done: number;
  planned: number;
  /** The programme week the next session belongs to. */
  week: number;
  /** Sessions of that week already done. */
  doneInWeek: number;
  finished: boolean;
}

/**
 * One column per programme week, one cell per planned session. Counted sessions fill the cells in
 * order, the same way the rotation moves on; the rest of the current week is still to do.
 */
export function cycleProgress(
  programme: Pick<Programme, 'id' | 'weeks' | 'sessionsPerWeek'>,
  logs: readonly SessionLog[],
  weekLabel: (week: number) => string,
): CycleProgress {
  const counted = countedLogs(programme, logs);
  const perWeek = programme.sessionsPerWeek;
  const planned = perWeek * programme.weeks;
  const done = Math.min(counted.length, planned);
  const finished = counted.length >= planned;
  const week = finished ? programme.weeks : Math.floor(done / perWeek) + 1;
  const weeks: CycleStripWeek[] = [];
  for (let w = 1; w <= programme.weeks; w++) {
    const cells: CycleCellState[] = [];
    for (let k = 0; k < perWeek; k++) {
      const log = counted[(w - 1) * perWeek + k];
      cells.push(log ? (log.endedEarly ? 'early' : 'done') : w <= week ? 'remaining' : 'later');
    }
    weeks.push({ label: weekLabel(w), cells, ...(w === week && !finished && { current: true }) });
  }
  return {
    weeks,
    done,
    planned,
    week,
    doneInWeek: finished ? perWeek : done % perWeek,
    finished,
  };
}

/** The rotation slots still to come in a programme week, in order. */
export function slotsLeft<T>(
  rotation: readonly T[],
  week: number,
  perWeek: number,
  doneInWeek: number,
): T[] {
  const out: T[] = [];
  for (let k = doneInWeek; k < perWeek; k++)
    out.push(rotation[((week - 1) * perWeek + k) % rotation.length]!);
  return out;
}
