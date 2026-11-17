import type { ProgrammeRecord } from '@/db';
import type { SessionLog } from '@/domain';
import { countedLogs, cycleNumber, isFinished } from '@/features/cycle/review';

export interface PastEntry {
  record: ProgrammeRecord;
  cycle: number;
  /** Every planned session was done (or it was closed as completed): it has a review. */
  finished: boolean;
  /** Sessions that counted. */
  sessions: number;
  from?: string;
  to?: string;
  /** For a replaced programme: the week it was in. */
  week: number;
  /** Sort key and year heading: when it ended. */
  endedAt: string;
}

/** Finished and replaced programmes, newest first. The active one is not past. */
export function pastEntries(
  programmes: readonly ProgrammeRecord[],
  logs: readonly SessionLog[],
): PastEntry[] {
  return programmes
    .filter((p) => p.status !== 'active')
    .map((record): PastEntry => {
      const counted = countedLogs(record, logs);
      const own = logs.filter(
        (l) =>
          l.status !== 'in-progress' &&
          l.source.kind === 'programme' &&
          l.source.programmeId === record.id,
      );
      const first = own.map((l) => l.startedAt).sort()[0] ?? record.startedAt;
      const last = own
        .map((l) => l.endedAt ?? l.startedAt)
        .sort()
        .at(-1);
      const to = record.endedAt ?? last;
      return {
        record,
        cycle: cycleNumber(record),
        finished: isFinished(record, logs),
        sessions: counted.length,
        ...(first && { from: first }),
        ...(to && { to }),
        week: Math.min(
          record.weeks,
          Math.floor(counted.length / Math.max(1, record.sessionsPerWeek)) + 1,
        ),
        endedAt: to ?? record.createdAt ?? '',
      };
    })
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}

/** Entries grouped under the year they ended, newest first. */
export function byYear(entries: readonly PastEntry[]): { year: string; entries: PastEntry[] }[] {
  const out: { year: string; entries: PastEntry[] }[] = [];
  for (const entry of entries) {
    const year = entry.endedAt.slice(0, 4);
    const group = out.find((g) => g.year === year);
    if (group) group.entries.push(entry);
    else out.push({ year, entries: [entry] });
  }
  return out;
}
