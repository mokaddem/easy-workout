import type { Page } from '@playwright/test';
import type { Answer, EquipmentInventory, Profile } from '../../src/domain';
import { generateProgramme } from '../../src/engine';
import { compliant, oneTap, simulate, type Policy } from '../../tests/support/simulate';
import { reference } from './seed';

export interface HistoryOptions {
  setup?: { profile: Profile; equipment: EquipmentInventory; seed?: number };
  /** Finished programme sessions to log, one a day, the last one yesterday. */
  sessions?: number;
  policy?: 'compliant' | 'one-tap';
  /** Exercises stopped for pain or for missing equipment in a given session (0-based). */
  stops?: { session: number; exerciseId: string; flag: 'pain' | 'no-equipment' }[];
  answers?: Answer[];
}

/**
 * Starts the app set up with a programme and a few weeks of logged sessions, so progression,
 * proposals and the "next time" lines have history to show. Lands on the programme tab.
 */
export async function seedHistory(page: Page, options: HistoryOptions = {}): Promise<void> {
  const setup: NonNullable<HistoryOptions['setup']> = options.setup ?? reference;
  const sessions = options.sessions ?? 12;
  const programme = {
    ...generateProgramme({ ...setup, seed: setup.seed ?? 0 }),
    id: 'seeded-programme',
  };
  const base: Policy = options.policy === 'one-tap' ? oneTap : compliant({ headroom: 1 });
  const policy: Policy = (s) => {
    const stop = options.stops?.find(
      (x) => x.session === s.session && x.exerciseId === s.step.item.exerciseId,
    );
    if (stop && s.step.section !== 'warmup' && (stop.flag === 'no-equipment' || s.step.set > 1))
      return { flag: stop.flag };
    return base(s);
  };
  const start = new Date(Date.now() - (sessions + 1) * 86_400_000);
  const sim = simulate(programme, setup.equipment, policy, {
    sessions,
    start,
    profile: setup.profile,
    answers: options.answers ?? [],
  });

  await page.goto('/onboarding');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.evaluate(
    async ({ profile, equipment, programme, logs, answers }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('easy-workout');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const stores = ['profile', 'equipment', 'programmes', 'sessionLogs', 'answers'];
      const tx = db.transaction(stores, 'readwrite');
      tx.objectStore('profile').put({ ...profile, id: 'me' });
      for (const item of equipment) tx.objectStore('equipment').put(item);
      tx.objectStore('programmes').put(programme);
      for (const log of logs) tx.objectStore('sessionLogs').put(log);
      for (const answer of answers) tx.objectStore('answers').put(answer);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    {
      profile: setup.profile,
      equipment: setup.equipment,
      programme: {
        ...programme,
        status: 'active',
        createdAt: start.toISOString(),
        startedAt: start.toISOString(),
        whySeen: true,
      },
      logs: sim.logs,
      answers: options.answers ?? [],
    },
  );
  await page.goto('/programme');
}
