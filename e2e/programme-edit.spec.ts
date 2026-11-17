import { expect, test, type Page } from '@playwright/test';
import { exerciseById } from '../src/catalogue';
import type { ProgrammeRecord } from '../src/db';
import type { Session } from '../src/domain';
import {
  defaultBlock,
  generateProgramme,
  insertBlock,
  newSlot,
  placeSession,
  saveSessionEdit,
  setBlockDose,
  type EditContext,
} from '../src/engine';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

const ctx: EditContext = {
  profile: reference.profile,
  inventory: reference.equipment,
  exercises: exerciseById,
};

const base = (): ProgrammeRecord => ({
  ...generateProgramme({ profile: reference.profile, equipment: reference.equipment, seed: 0 }),
  id: 'seeded-programme',
  status: 'active',
  createdAt: '2026-11-12T10:00:00.000Z',
  whySeen: true,
});

/** Session A with fewer sets on its second block and an added lateral raise. */
function edited(): ProgrammeRecord {
  const programme = base();
  const push = programme.rotation.find((s) => s.id === 'a-push')!;
  const fewer = setBlockDose(push, 'main', 1, { sets: 2 });
  const added = insertBlock(
    fewer,
    { section: 'main', index: fewer.main.length },
    defaultBlock(exerciseById.get('dumbbell-lateral-raise')!, 'main', newSlot(fewer), ctx, false),
  );
  return saveSessionEdit(programme, added);
}

/** Session D replaced by one of the user's own. */
function placed(): { programme: ProgrammeRecord; custom: Session & { updatedAt: string } } {
  const programme = base();
  const source = programme.rotation.find((s) => s.id === 'd-upper-density')!;
  const custom = {
    ...source,
    id: 'own-1',
    name: { fr: 'Haut express', en: 'Upper express' },
    updatedAt: '2026-11-13T10:00:00.000Z',
  };
  const { updatedAt: _, ...own } = custom;
  return { programme: placeSession(programme, 'd-upper-density', own), custom };
}

async function seed(page: Page, programme: ProgrammeRecord, custom?: object) {
  await seedSetup(page, reference);
  await page.evaluate(
    async ({ programme, custom }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('easy-workout');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['programmes', 'customSessions'], 'readwrite');
      tx.objectStore('programmes').put(programme);
      if (custom) tx.objectStore('customSessions').put(custom);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { programme, custom },
  );
  await page.goto('/programme');
}

test('Edit opens the editor for the session', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: /^A\s*Push/ }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/edit\/programme\/a-push$/);
});

test('an edited session shows its notice and edit lines, and restores', async ({ page }) => {
  await seed(page, edited());
  const grid = page.locator('a', { hasText: /edited by you/ });
  await expect(grid).toHaveCount(1);
  await grid.click();
  await expect(page.getByText(/Edited by you: 2 changes, for the whole cycle/)).toBeVisible();
  await expect(page.getByText(/Edited by you: 2 sets instead of/)).toBeVisible();
  await expect(page.getByText(/Added by you\./)).toBeVisible();

  await page
    .getByRole('button', { name: "Restore the programme's session".replace("'", '’') })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Your 2 changes to session A are erased/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Restore the session' }).click();
  await expect(page.getByText(/Edited by you/)).toHaveCount(0);
  await expect(page.getByText(/Added by you/)).toHaveCount(0);
});

test('a placed session shows the placed state and can be removed', async ({ page }) => {
  const { programme, custom } = placed();
  await seed(page, programme, custom);
  const table = page.getByRole('table', { name: 'Sessions by week' });
  await expect(table.getByRole('columnheader', { name: 'D, my session' })).toBeVisible();
  await page.getByRole('link', { name: /Upper express/ }).click();
  await expect(page.getByText('My session', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Upper express' })).toBeVisible();
  await expect(page.getByText(/Your session, in place of session D/)).toBeVisible();

  await page.getByRole('button', { name: 'Remove from programme' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove from programme' }).click();
  await expect(page.getByText(/Your session, in place of session D/)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Upper express' })).toHaveCount(0);
});

test('regenerating keeps an edit and lists one that no longer applies', async ({ page }) => {
  await seed(page, edited());
  // Same inputs: the edits carry over.
  await page.goto('/programme?preview=new');
  let sheet = page.getByRole('dialog');
  let ledger = sheet.getByRole('region', { name: 'Your changes' });
  await expect(ledger).toBeVisible();
  await expect(ledger.getByText('kept', { exact: true })).toBeVisible();
  await expect(ledger.getByText('All of them carry over to the new programme.')).toBeVisible();
  await ledger.getByRole('button', { name: /^See the 2 kept/ }).click();
  await expect(ledger.getByText('Session A, Push: your addition')).toBeVisible();

  // Three days a week: session A no longer exists.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('profile', 'readwrite');
    const store = tx.objectStore('profile');
    const current = await new Promise<Record<string, unknown>>((resolve) => {
      const get = store.get('me');
      get.onsuccess = () => resolve(get.result as Record<string, unknown>);
    });
    store.put({ ...current, daysPerWeek: 3 });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.goto('/programme?preview=new');
  sheet = page.getByRole('dialog');
  ledger = sheet.getByRole('region', { name: 'Your changes' });
  await expect(ledger.getByText(/The split changes: your change no longer applies/)).toBeVisible();
  await ledger.getByRole('button', { name: 'See the list' }).click();
  await expect(ledger.getByText(/no longer exists with 3 days a week/).first()).toBeVisible();
});

test('a programme session can be copied to my sessions', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: /^A\s*Push/ }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: /Copy to my sessions/ }).click();
  await expect(page.getByText('Session copied to My sessions')).toBeVisible();
});
