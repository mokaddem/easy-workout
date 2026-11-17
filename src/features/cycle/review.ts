import type { Answer, Programme, SessionLog } from '@/domain';
import type { LiftChange, LiftReading } from '@/engine';
import type { CycleCellState, CycleStripWeek } from '@/ui/components';

/** The programme's own sessions that were finished and count, in the order they were done. */
export function countedLogs(programme: Pick<Programme, 'id'>, logs: readonly SessionLog[]) {
  return logs
    .filter(
      (l) =>
        l.status === 'completed' &&
        l.countsAsDone !== false &&
        l.source.kind === 'programme' &&
        l.source.programmeId === programme.id,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** One column per week, one cell per planned session: done in full, ended early, or never done. */
export function stripWeeks(
  programme: Pick<Programme, 'id' | 'weeks' | 'sessionsPerWeek'>,
  logs: readonly SessionLog[],
): CycleStripWeek[] {
  const counted = countedLogs(programme, logs);
  return Array.from({ length: programme.weeks }, (_, w) => ({
    label: String(w + 1),
    cells: Array.from({ length: programme.sessionsPerWeek }, (_, k): CycleCellState => {
      const log = counted[w * programme.sessionsPerWeek + k];
      return !log ? 'later' : log.endedEarly ? 'early' : 'done';
    }),
  }));
}

export type LiftFigure =
  | { kind: 'percent'; value: number }
  | { kind: 'reps'; value: number }
  | { kind: 'harder' }
  | { kind: 'held' }
  | { kind: 'none' };

/** Reps at a reserve of two, so readings at different efforts compare. */
const repsAtTwo = (r: LiftReading) => r.value + (r.rir ?? 2) - 2;
const weighted = (r: LiftReading) => r.load?.kind === 'kg';

/**
 * What stands in the big cell of a lift row: a strength change for weighted lifts up to 12 reps,
 * reps at equal effort for bodyweight ones, a harder version as progress in itself; held lifts
 * say so; anything else (a band, many reps) leaves the cell to the start and end lines.
 */
export function liftFigure(lift: LiftChange): LiftFigure {
  if (lift.variantChanged) return { kind: 'harder' };
  if (lift.percent !== undefined && lift.percent > 0)
    return { kind: 'percent', value: lift.percent };
  const { start, end } = lift;
  if (
    start &&
    end &&
    start.exerciseId === end.exerciseId &&
    !weighted(start) &&
    !weighted(end) &&
    lift.status === 'progressed'
  ) {
    const gain = Math.round(repsAtTwo(end) - repsAtTwo(start));
    if (gain >= 1) return { kind: 'reps', value: gain };
  }
  return lift.status === 'progressed' ? { kind: 'none' } : { kind: 'held' };
}

export interface PainRow {
  exerciseId: string;
  /** When it last hurt in the cycle. */
  at: string;
  logId: string;
  answer?: Answer['answer'];
  /** `again`: it hurt again later in the cycle; `clear`: sessions since without pain. */
  after?: { kind: 'clear' } | { kind: 'again'; at: string };
}

/** The cycle's pain stops with the answer given and whether pain came back. */
export function painRows(
  programme: Pick<Programme, 'id'>,
  exerciseIds: readonly string[],
  logs: readonly SessionLog[],
  answers: readonly Answer[],
): PainRow[] {
  const own = logs
    .filter(
      (l) =>
        l.status !== 'in-progress' &&
        l.source.kind === 'programme' &&
        l.source.programmeId === programme.id,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return exerciseIds.flatMap((exerciseId): PainRow[] => {
    const touching = own.filter((l) => l.sets.some((s) => s.exerciseId === exerciseId));
    const hurt = touching.filter((l) =>
      l.sets.some((s) => s.exerciseId === exerciseId && s.flag === 'pain'),
    );
    const first = hurt[0];
    if (!first) return [];
    const last = hurt[hurt.length - 1]!;
    const answer = answers
      .filter((a) => a.exerciseId === exerciseId && a.kind === 'pain' && a.logId === first.id)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const later = touching.filter((l) => l.startedAt > last.startedAt);
    const sinceFirst = touching.filter((l) => l.startedAt > first.startedAt);
    const again = hurt.find((l) => l.startedAt > first.startedAt);
    return [
      {
        exerciseId,
        at: first.startedAt,
        logId: first.id,
        ...(answer && { answer: answer.answer }),
        ...(again
          ? { after: { kind: 'again' as const, at: again.startedAt } }
          : sinceFirst.length > 0 || later.length > 0
            ? { after: { kind: 'clear' as const } }
            : {}),
      },
    ];
  });
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const roundHalf = (n: number) => Math.round(n * 2) / 2;

/** Start and end of a body trend: the mean of the first two and of the last two values, to 0.5. */
export function bodyFigure(points: readonly { value: number }[]): { from: number; to: number } {
  return {
    from: roundHalf(mean(points.slice(0, 2).map((p) => p.value))),
    to: roundHalf(mean(points.slice(-2).map((p) => p.value))),
  };
}

/** The cycle a programme counts as (a programme without generation data is cycle 1). */
export const cycleNumber = (programme: Pick<Programme, 'generation'>): number =>
  programme.generation?.cycle ?? 1;

/** "Done" for a programme: every planned session counted, or it was closed as completed. */
export const isFinished = (
  programme: Pick<Programme, 'id' | 'weeks' | 'sessionsPerWeek'> & { status?: string },
  logs: readonly SessionLog[],
): boolean =>
  programme.status === 'completed' ||
  countedLogs(programme, logs).length >= programme.weeks * programme.sessionsPerWeek;

/** A no-break space: between a number and its unit. */
export const NBSP = String.fromCharCode(0xa0);
