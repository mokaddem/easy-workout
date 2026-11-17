import type { Page } from '@playwright/test';
import type { Profile } from '../../src/domain';
import { generateProgramme } from '../../src/engine';
import { oneTap, simulate, type Policy } from '../../tests/support/simulate';

export const profile: Profile = {
  goal: 'muscle',
  level: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 50,
  bodyweightKg: 78,
};

/** Reps well past the top of every range, felt easy: every lift ends its ladder with a harder version waiting. */
const strong: Policy = (s) => {
  const t = s.step.planned.target;
  if (s.step.section === 'warmup' || t.kind !== 'reps') return oneTap(s);
  const reps = (s.step.planned.goal ?? t.min) + 6;
  return {
    actual: { reps, ...(s.step.planned.load && { load: s.step.planned.load }) },
    feel: 'easy',
    feelChosen: true,
    edited: true,
  };
};

/** A bodyweight cycle of 8 weeks, every session logged, the last one yesterday; the programme is still active. */
export async function seedFinishedCycle(page: Page): Promise<void> {
  const programme = {
    ...generateProgramme({ profile, equipment: [], seed: 0 }),
    id: 'seeded-programme',
  };
  const start = new Date(Date.now() - 34 * 86_400_000);
  const sim = simulate(programme, [], strong, {
    profile,
    sessions: programme.sessionsPerWeek * programme.weeks,
    start,
  });
  await page.goto('/onboarding');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.evaluate(
    async ({ profile, programme, logs }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('easy-workout');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['profile', 'programmes', 'sessionLogs'], 'readwrite');
      tx.objectStore('profile').put({ ...profile, id: 'me' });
      tx.objectStore('programmes').put(programme);
      for (const log of logs) tx.objectStore('sessionLogs').put(log);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    {
      profile,
      programme: {
        ...programme,
        status: 'active',
        createdAt: start.toISOString(),
        startedAt: start.toISOString(),
        whySeen: true,
      },
      logs: sim.logs,
    },
  );
}
