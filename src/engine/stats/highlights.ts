import type { Exercise, MaxTest, ProgressionNote, Programme, SessionLog } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { DAY_MS } from './dates';
import { pointsByExercise, type ExercisePoint } from './history';
import { recordsAlong, type ExerciseRecord } from './records';
import { itemsByKey } from './timeline';

export const HIGHLIGHT_DAYS = 14;

/** Progression codes worth showing as "what moved up". */
const NOTE_CODES = new Set([
  'load-up',
  'load-up-low',
  'reps-up',
  'band-heavier',
  'added-load-start',
  'beyond-range',
  'work-longer',
  'from-test',
]);

export type Highlight =
  | { kind: 'note'; exerciseId: string; at: string; logId: string; note: ProgressionNote }
  | {
      kind: 'best';
      exerciseId: string;
      at: string;
      logId: string;
      point: ExercisePoint;
      record: ExerciseRecord;
    }
  | { kind: 'test'; exerciseId: string; at: string; test: MaxTest };

const PRIORITY = { note: 0, best: 1, test: 2 } as const;

/**
 * What moved up in the last 14 days: one row per exercise (its latest qualifying event), newest
 * first. Events: automatic steps, a new best (a personal record, see `recordsAlong`),
 * a max test.
 */
export function highlights(
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  tests: readonly MaxTest[],
  now: Date,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): Highlight[] {
  const since = now.getTime() - HIGHLIGHT_DAYS * DAY_MS;
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= since && t <= now.getTime();
  };
  const events: Highlight[] = [];

  const finished = logs
    .filter((l) => l.status !== 'in-progress' && inWindow(l.startedAt))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const beyondSeen = new Set<string>();
  for (const log of finished) {
    if (!log.progression) continue;
    const items = itemsByKey(log.plan);
    for (const [key, note] of Object.entries(log.progression)) {
      const exerciseId = items.get(key)?.exerciseId;
      if (!exerciseId) continue;
      const ok =
        NOTE_CODES.has(note.code) ||
        (note.code === 'band-lighter' && exercises.get(exerciseId)?.loadType === 'band-assisted');
      if (!ok) continue;
      // It fires every session once an exercise sits at the top of its range.
      if (note.code === 'beyond-range') {
        if (beyondSeen.has(exerciseId)) continue;
        beyondSeen.add(exerciseId);
      }
      events.push({ kind: 'note', exerciseId, at: log.startedAt, logId: log.id, note });
    }
  }

  const lookup = new Map(logs.map((l) => [l.id, l]));
  for (const [exerciseId, points] of pointsByExercise(logs, programmes, exercises)) {
    for (const record of recordsAlong(exerciseId, points, tests, lookup, { exercises })) {
      const point = points.find((p) => p.logId === record.logId);
      if (point && inWindow(record.at))
        events.push({
          kind: 'best',
          exerciseId,
          at: record.at,
          logId: record.logId,
          point,
          record,
        });
    }
  }

  for (const test of tests)
    if (inWindow(test.at))
      events.push({ kind: 'test', exerciseId: test.exerciseId, at: test.at, test });

  const latest = new Map<string, Highlight>();
  for (const e of events) {
    const current = latest.get(e.exerciseId);
    if (
      !current ||
      e.at > current.at ||
      (e.at === current.at && PRIORITY[e.kind] < PRIORITY[current.kind])
    )
      latest.set(e.exerciseId, e);
  }
  return [...latest.values()].sort(
    (a, b) => b.at.localeCompare(a.at) || a.exerciseId.localeCompare(b.exerciseId),
  );
}
