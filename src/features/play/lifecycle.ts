import { navigate } from '@/app/router';
import type { SessionLog } from '@/domain';
import { abandonOpenSession, finishOpenSession } from './start';

/**
 * The session whose summary the player screen shows next. Set before going to the player
 * from outside it (the resume banner, the "already open" dialog); cleared once the summary
 * is left or another session starts.
 */
let summaryFor: string | null = null;

export const peekSummary = (): string | null => summaryFor;
export const showSummaryFor = (id: string): void => {
  summaryFor = id;
};
export const clearSummary = (): void => {
  summaryFor = null;
};

/** Finishes the open session from outside the player. With nothing logged there is nothing to summarise: it is simply removed. */
export async function finishFromOutside(log: SessionLog, goToSummary = true): Promise<void> {
  if (log.sets.length === 0) {
    await abandonOpenSession(log);
    return;
  }
  await finishOpenSession(log);
  showSummaryFor(log.id);
  if (goToSummary) navigate({ name: 'play' });
}
