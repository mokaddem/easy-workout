import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionLog } from '@/domain';
import { asPlanned, playSteps, setLogBase } from '@/engine';
import { db } from '@/db';
import { repo } from '@/db/repo';
import { abandonOpenSession, finishOpenSession, startQuickSession } from './start';
import { IDLE_GAP_MS } from './usePlayer';

const plan: Session = {
  id: 'q',
  name: { fr: 'Séance express', en: 'Quick session' },
  estimatedMinutes: 10,
  warmup: [],
  main: [
    {
      type: 'straight',
      item: { exerciseId: 'push-up', target: { kind: 'reps', min: 8, max: 12 } },
      sets: 4,
      restSec: 60,
    },
  ],
  finisher: [],
};

const T0 = Date.UTC(2026, 10, 12, 18, 0, 0);

async function openWithSets(count: number): Promise<SessionLog> {
  vi.setSystemTime(T0);
  const log = await startQuickSession(plan);
  const steps = playSteps(plan);
  await repo.logSets(
    log.id,
    steps.slice(0, count).map((step, i) => ({
      ...setLogBase(step),
      actual: asPlanned(step.planned)!,
      feel: 'right' as const,
      at: new Date(T0 + (i + 1) * 120_000).toISOString(),
    })),
  );
  return (await repo.getOpenSession())!;
}

afterEach(async () => {
  vi.useRealTimers();
  await db.sessionLogs.clear();
});

describe('closing the open session from outside the player', () => {
  it('finishes an idle session at its last set, counting it when half was done', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const log = await openWithSets(2);
    const lastSet = T0 + 2 * 120_000;
    await finishOpenSession(log, lastSet + IDLE_GAP_MS + 3_600_000);
    const stored = await repo.getSessionLog(log.id);
    expect(stored).toMatchObject({
      status: 'completed',
      endedEarly: true,
      countsAsDone: true,
      endedAt: new Date(lastSet).toISOString(),
    });
  });

  it('abandons: kept when something was logged', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const log = await openWithSets(1);
    await abandonOpenSession(log, T0 + 200_000);
    expect(await repo.getSessionLog(log.id)).toMatchObject({ status: 'abandoned' });
  });
});
