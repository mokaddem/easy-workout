import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

/** Starts the next session and gets past the warm-up, to the first main set. */
async function startAndSkipWarmup(page: Page) {
  await seedSetup(page, reference);
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
  const done = page.getByRole('button', { name: 'Done', exact: true });
  const asPlanned = page.getByRole('button', { name: /^Done as planned/ });
  const skip = page.getByRole('button', { name: /^Skip/ });
  for (let i = 0; i < 12 && !(await asPlanned.isVisible()); i++) {
    if (await done.isVisible()) await done.click();
    else if (await skip.isVisible()) await skip.click();
    else await page.waitForTimeout(150);
  }
  await expect(asPlanned).toBeVisible();
}

/** Logs one main set and skips its rest. */
async function logOneSet(page: Page) {
  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Done as planned/ })).toBeVisible();
}

async function openLeaveSheet(page: Page) {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave the session' }).click();
  await expect(page.getByRole('heading', { name: 'Leave the session?' })).toBeVisible();
}

/** An open quick session written straight into the database. */
async function seedOpenQuick(page: Page, ageHours: number) {
  const startedAt = new Date(Date.now() - ageHours * 3_600_000).toISOString();
  await page.evaluate(
    async ({ startedAt }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('easy-workout');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction('sessionLogs', 'readwrite');
      tx.objectStore('sessionLogs').put({
        id: 'seeded-quick',
        source: { kind: 'quick' },
        plan: {
          id: 'quick-push',
          name: { fr: 'Séance express — Push', en: 'Quick session — Push' },
          estimatedMinutes: 20,
          warmup: [],
          main: [
            {
              type: 'straight',
              item: { exerciseId: 'push-up', target: { kind: 'reps', min: 5, max: 5 } },
              sets: 3,
              restSec: 30,
            },
          ],
          finisher: [],
        },
        status: 'in-progress',
        startedAt,
        sets: [
          {
            section: 'main',
            blockIndex: 0,
            itemIndex: 0,
            set: 1,
            exerciseId: 'push-up',
            planned: { target: { kind: 'reps', min: 5, max: 5 } },
            actual: { reps: 5 },
            at: startedAt,
          },
        ],
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { startedAt },
  );
  await page.goto('/programme');
}

test('pause freezes the session and Resume goes back to the set', async ({ page }) => {
  await startAndSkipWarmup(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await expect(page.getByText('You’ll pick up at')).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /^Done as planned/ })).toBeVisible();
});

test('Pause and leave keeps the session: a banner on Programme resumes it', async ({ page }) => {
  await startAndSkipWarmup(page);
  await logOneSet(page);
  await openLeaveSheet(page);
  await page.getByRole('button', { name: /^Pause and leave/ }).click();
  await expect(page).toHaveURL(/\/programme$/);

  const banner = page.getByRole('region', { name: /is paused$/ });
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/^Picks up at/)).toBeVisible();
  // The banner holds the only primary action: the next-session card turns secondary.
  await expect(page.getByRole('button', { name: 'Resume session' })).toBeVisible();
  await page.goto('/quick');
  await expect(page.getByRole('region', { name: /is paused$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
});

test('finishing early shows a summary whose switch decides if the rotation moves on', async ({
  page,
}) => {
  await startAndSkipWarmup(page);
  await logOneSet(page);
  await openLeaveSheet(page);
  await page.getByRole('button', { name: /^Finish now/ }).click();

  await expect(page.getByRole('heading', { name: 'Session ended early' })).toBeVisible();
  await expect(page.getByText('Active time, pauses not counted')).toBeVisible();
  const counts = page.getByRole('switch', { name: /Counts as done/ });
  // One set of many: under half, so it does not count by default.
  await expect(counts).not.toBeChecked();
  await counts.click();
  await expect(counts).toBeChecked();
  await expect(page.getByText(/^Your rotation moves on to/)).toBeVisible();
  await counts.click();
  await expect(counts).not.toBeChecked();
  await expect(page.getByText('This session will be offered again next time.')).toBeVisible();

  await page.getByRole('button', { name: 'Back to programme' }).click();
  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByRole('heading', { name: 'Session A — Push' })).toBeVisible();
  await expect(page.getByRole('region', { name: /is paused$/ })).toHaveCount(0);

  // Counting it moves the rotation on.
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
});

test('a session counted as done moves the rotation on', async ({ page }) => {
  await startAndSkipWarmup(page);
  await logOneSet(page);
  await openLeaveSheet(page);
  await page.getByRole('button', { name: /^Finish now/ }).click();
  await page.getByRole('switch', { name: /Counts as done/ }).click();
  await expect(page.getByRole('switch', { name: /Counts as done/ })).toBeChecked();
  await page.getByRole('button', { name: 'Back to programme' }).click();
  await expect(page.getByRole('heading', { name: /^Session B/ })).toBeVisible();
});

test('Abandon asks first, and never moves the rotation', async ({ page }) => {
  await startAndSkipWarmup(page);
  await logOneSet(page);
  await openLeaveSheet(page);
  await page.getByRole('button', { name: /^Abandon Sets done/ }).click();
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /Abandon/ }));
  await expect(confirm.getByText(/stays? in your history/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  // Back on the sheet.
  await expect(page.getByRole('heading', { name: 'Leave the session?' })).toBeVisible();
  await page.getByRole('button', { name: /^Abandon Sets done/ }).click();
  await page.getByRole('button', { name: 'Abandon the session' }).click();

  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByRole('heading', { name: 'Session A — Push' })).toBeVisible();
  await expect(page.getByRole('region', { name: /is paused$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
});

test('the banner can finish a session now, straight to its summary', async ({ page }) => {
  await seedSetup(page, reference);
  await seedOpenQuick(page, 1);
  const banner = page.getByRole('region', { name: /is paused$/ });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Finish now' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: 'Session ended early' })).toBeVisible();
  // A quick session has no rotation to move.
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByText(/Outside your programme/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to quick sessions' }).click();
  await expect(page).toHaveURL(/\/quick$/);
});

test('the banner abandons only after a confirmation', async ({ page }) => {
  await seedSetup(page, reference);
  await seedOpenQuick(page, 1);
  const banner = page.getByRole('region', { name: /is paused$/ });
  await banner.getByRole('button', { name: 'Abandon' }).click();
  await expect(page.getByText('Abandon the session?')).toBeVisible();
  await page.getByRole('button', { name: 'Abandon the session' }).click();
  await expect(banner).toHaveCount(0);
});

test('Start while a session is open asks what to do with it', async ({ page }) => {
  await seedSetup(page, reference);
  await seedOpenQuick(page, 1);
  await page.getByRole('button', { name: 'Start session' }).click();
  const dialog = page.getByRole('dialog', { name: 'A session is already open' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/programme$/);

  await page.getByRole('button', { name: 'Start session' }).click();
  await dialog.getByRole('button', { name: 'Resume the open session' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByText('Trial')).toHaveCount(0);

  await page.goto('/programme');
  await page.getByRole('button', { name: 'Start session' }).click();
  await dialog.getByRole('button', { name: 'Abandon it and start' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByText(/^Warm-up, 1 of \d+$/)).toBeVisible();
});

test('a session open for more than 12 hours leads with finishing it', async ({ page }) => {
  await seedSetup(page, reference);
  await seedOpenQuick(page, 14);
  const banner = page.getByRole('region', { name: /was left open$/ });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Finish (keep the sets)' })).toBeVisible();
  // Active time stops at the last activity, not at now.
  await expect(banner.getByText('0 min active')).toBeVisible();

  await page.getByRole('button', { name: 'Start session' }).click();
  const dialog = page.getByRole('dialog', { name: 'A session was left open' });
  await expect(dialog.getByRole('button', { name: 'Finish it and start' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await banner.getByRole('button', { name: 'Finish (keep the sets)' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: 'Session ended early' })).toBeVisible();
});
