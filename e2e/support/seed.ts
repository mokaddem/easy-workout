import type { Page } from '@playwright/test';
import type { EquipmentInventory, Profile } from '../../src/domain';
import { generateProgramme } from '../../src/engine';
import { referenceEquipment } from '../../tests/fixtures/reference-equipment';

export const reference = {
  profile: {
    goal: 'recomposition',
    level: 'intermediate',
    daysPerWeek: 6,
    sessionMinutes: 45,
  } satisfies Profile,
  equipment: referenceEquipment,
};

export const bodyweightBeginner = {
  profile: {
    goal: 'general-fitness',
    level: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
  } satisfies Profile,
  equipment: [] as EquipmentInventory,
};

/**
 * Starts the app already set up: profile, equipment and an active programme generated
 * from them, written straight into the app's database. Lands on the programme tab.
 */
export async function seedSetup(
  page: Page,
  setup: { profile: Profile; equipment: EquipmentInventory; seed?: number; whySeen?: boolean },
): Promise<void> {
  // The first visit creates the database.
  await page.goto('/onboarding');
  await page.getByRole('heading', { level: 1 }).first().waitFor();

  const programme = {
    ...generateProgramme({
      profile: setup.profile,
      equipment: setup.equipment,
      seed: setup.seed ?? 0,
    }),
    id: 'seeded-programme',
    status: 'active',
    createdAt: '2026-11-12T10:00:00.000Z',
    ...(setup.whySeen === false ? {} : { whySeen: true }),
  };
  await page.evaluate(
    async ({ profile, equipment, programme }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('easy-workout');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['profile', 'equipment', 'programmes'], 'readwrite');
      tx.objectStore('profile').put({ ...profile, id: 'me' });
      for (const item of equipment) tx.objectStore('equipment').put(item);
      tx.objectStore('programmes').put(programme);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { profile: setup.profile, equipment: setup.equipment, programme },
  );
  // Written behind the app's back, so reload to read it.
  await page.goto('/programme');
}
