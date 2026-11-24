import type { SessionLog } from '@/domain';

/**
 * Which re-entry session the next one is: one more than the programme sessions in a row, most
 * recent first, that ran at the lighter volume and counted as done.
 */
export function reentryPosition(logs: readonly SessionLog[]): number {
  let n = 0;
  const programme = logs
    .filter((l) => l.source.kind === 'programme' && l.status === 'completed')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const log of programme) {
    if (log.countsAsDone === false) continue;
    if (log.adjustments?.reentry === undefined) break;
    n++;
  }
  return n + 1;
}
