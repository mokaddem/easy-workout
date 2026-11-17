import type { SessionLog } from '../../domain';

const DAY_MS = 86_400_000;
/** Runs of the same session of the user's own, within this many days, before suggesting the programme. */
export const NUDGE_RUNS = 3;
export const NUDGE_DAYS = 21;

/** Run often enough on its own that it would do better in the programme, where it progresses. */
export function suggestPlacing(logs: readonly SessionLog[], sessionId: string, now: Date): boolean {
  const since = now.getTime() - NUDGE_DAYS * DAY_MS;
  return (
    logs.filter(
      (l) =>
        l.status !== 'in-progress' &&
        l.source.kind === 'custom' &&
        l.source.sessionId === sessionId &&
        Date.parse(l.startedAt) >= since,
    ).length >= NUDGE_RUNS
  );
}
