import type { SessionLog } from '@/domain';
import { activeSeconds, localDate, mondayOf } from '@/engine';
import { mainSetCounts } from '../../play/format';

export interface HistoryGroup {
  /** `YYYY-MM-DD` of the Monday. */
  weekStart: string;
  /** Newest first; abandoned ones included. */
  logs: SessionLog[];
  /** Completed sessions only. */
  sessions: number;
  activeSec: number;
}

/** Finished sessions (completed or abandoned) grouped by calendar week, newest first. */
export function historyGroups(logs: readonly SessionLog[]): HistoryGroup[] {
  const finished = logs
    .filter((l) => l.status !== 'in-progress')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const groups = new Map<string, HistoryGroup>();
  for (const log of finished) {
    const weekStart = localDate(mondayOf(new Date(log.startedAt)));
    let group = groups.get(weekStart);
    if (!group) {
      group = { weekStart, logs: [], sessions: 0, activeSec: 0 };
      groups.set(weekStart, group);
    }
    group.logs.push(log);
    if (log.status === 'completed') {
      group.sessions++;
      group.activeSec += activeSeconds(log);
    }
  }
  return [...groups.values()];
}

/** Whether a group's Monday is this week, last week, or earlier. */
export function weekDistance(weekStart: string, now: Date): number {
  const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number];
  const diff = mondayOf(now).getTime() - new Date(y, m - 1, d).getTime();
  return Math.round(diff / (7 * 86_400_000));
}

export type RowStatus =
  | { kind: 'abandoned' }
  | { kind: 'early'; done: number; total: number; counts: boolean }
  | { kind: 'own-alone' }
  | { kind: 'plain' };

/** How a row of the history is marked. */
export function rowStatus(log: SessionLog): RowStatus {
  if (log.status === 'abandoned') return { kind: 'abandoned' };
  if (log.endedEarly) {
    const { done, total } = mainSetCounts(log);
    return { kind: 'early', done, total, counts: log.countsAsDone !== false };
  }
  if (log.source.kind === 'custom') return { kind: 'own-alone' };
  return { kind: 'plain' };
}

/** The first exercise a session ended with pain. */
export function painStop(
  log: Pick<SessionLog, 'sets'>,
): { exerciseId: string; set: number } | undefined {
  const set = log.sets.find((s) => s.flag === 'pain');
  return set ? { exerciseId: set.exerciseId, set: set.set } : undefined;
}

/** Performed sets in a log (warm-up excluded), both sides of a per-side set counting once. */
export function performedSets(log: Pick<SessionLog, 'sets'>): number {
  const seen = new Set<string>();
  for (const s of log.sets) {
    if (!s.actual || s.flag === 'skipped' || s.section === 'warmup') continue;
    seen.add(`${s.section}/${s.blockIndex}/${s.itemIndex}/${s.set}`);
  }
  return seen.size;
}
