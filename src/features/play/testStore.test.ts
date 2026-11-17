import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { MaxTest, Session } from '@/domain';
import { db } from '@/db';
import { repo } from '@/db/repo';
import { attachTest, closeSessionTest } from './testStore';
import { startQuickSession } from './start';

const plan: Session = {
  id: 'q',
  name: { fr: 'Séance', en: 'Session' },
  estimatedMinutes: 10,
  warmup: [],
  main: [
    {
      type: 'straight',
      item: { exerciseId: 'push-up', target: { kind: 'reps', min: 8, max: 12 } },
      sets: 1,
      restSec: 60,
    },
  ],
  finisher: [],
};

const record = (logId: string): MaxTest => ({
  id: `${logId}-test`,
  date: '2026-11-17',
  at: '2026-11-17T10:00:00.000Z',
  exerciseId: 'push-up',
  context: 'session',
  logId,
  result: { kind: 'reps', reps: 24 },
});

afterEach(async () => {
  await db.sessionLogs.clear();
  await db.maxTests.clear();
});

describe('a session test', () => {
  it('is attached to the open session as still to come', async () => {
    const log = await startQuickSession(plan);
    const next = await attachTest(log, { exerciseId: 'push-up', kind: 'reps', placement: 'end' });
    expect(next.test).toEqual({ exerciseId: 'push-up', kind: 'reps', placement: 'end' });
    expect((await repo.getOpenSession())?.test?.outcome).toBeUndefined();
  });

  it('stores its result and its outcome together', async () => {
    const log = await startQuickSession(plan);
    await attachTest(log, { exerciseId: 'push-up', kind: 'reps', placement: 'end' });
    await closeSessionTest(log.id, 'done', record(log.id));
    expect((await repo.getOpenSession())?.test?.outcome).toBe('done');
    expect(await repo.listMaxTests()).toHaveLength(1);
  });

  it('skipped stores no result', async () => {
    const log = await startQuickSession(plan);
    await attachTest(log, { exerciseId: 'push-up', kind: 'reps', placement: 'after-warmup' });
    await closeSessionTest(log.id, 'skipped');
    expect((await repo.getOpenSession())?.test?.outcome).toBe('skipped');
    expect(await repo.listMaxTests()).toHaveLength(0);
  });
});
