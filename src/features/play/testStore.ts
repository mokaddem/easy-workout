import { repo } from '@/db/repo';
import type { MaxTest, SessionLog, SessionTest } from '@/domain';

/** Gives a session just opened the test it runs; nothing is recorded until the test is. */
export async function attachTest(log: SessionLog, test: SessionTest): Promise<SessionLog> {
  await repo.attachSessionTest(log.id, test);
  return { ...log, test };
}

/** Closes the session's test with its outcome, and stores its result (or pain stop) with it. */
export function closeSessionTest(
  logId: string,
  outcome: NonNullable<SessionTest['outcome']>,
  result?: MaxTest,
): Promise<void> {
  return repo.closeSessionTest(logId, outcome, result);
}
