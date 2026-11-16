import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

interface StoredSet {
  section: string;
  set: number;
  flag?: string;
  actual?: { reps?: number };
  exerciseId: string;
}

/** The sets stored for the session in progress, read straight from the database. */
async function storedSets(page: Page): Promise<StoredSet[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const logs = await new Promise<{ status: string; sets: unknown[] }[]>((resolve) => {
      const get = db.transaction('sessionLogs').objectStore('sessionLogs').getAll();
      get.onsuccess = () => resolve(get.result as { status: string; sets: unknown[] }[]);
    });
    db.close();
    return (logs.find((log) => log.status === 'in-progress')?.sets ?? []) as StoredSet[];
  });
}

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

test('Start opens the first warm-up item', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByText(/^Warm-up, 1 of \d+$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip this exercise' })).toBeVisible();
});

test('a set logged as planned starts the rest, which can be skipped', async ({ page }) => {
  await startAndSkipWarmup(page);
  const name = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: /^Done as planned/ }).click();

  const timer = page.getByRole('timer');
  await expect(timer).toBeVisible();
  await expect(page.getByText(/^Set 1 of \d+ logged$/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove 15 seconds' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();

  await expect(timer).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name ?? '');
  await expect(page.getByText('Set', { exact: true })).toBeVisible();
  const sets = await storedSets(page);
  expect(sets.filter((s) => s.section === 'main' && s.actual?.reps !== undefined)).toHaveLength(1);
});

test('a set can be edited with different reps', async ({ page }) => {
  await startAndSkipWarmup(page);
  await page.getByRole('button', { name: 'Edit set' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Adjust set 1' })).toBeVisible();
  const before = await storedSets(page);
  await dialog.getByRole('button', { name: 'More' }).first().click();
  await dialog.getByRole('radio', { name: 'Hard' }).click();
  await dialog.getByRole('button', { name: 'Log set' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  const sets = await storedSets(page);
  const last = sets[sets.length - 1];
  expect(sets.length).toBe(before.length + 1);
  expect(last?.actual?.reps).toBeGreaterThan(0);
});

test('a rest keeps running after the page is reloaded', async ({ page }) => {
  await startAndSkipWarmup(page);
  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect.poll(() => storedSets(page).then((sets) => sets.length)).toBeGreaterThan(0);
  // The pause is stored a moment after the set.
  await page.waitForTimeout(500);
  await page.reload();
  const timer = page.getByRole('timer');
  await expect(timer).toBeVisible();
  const seconds = Number(/\d+/.exec((await timer.getAttribute('aria-label')) ?? '')?.[0]);
  expect(seconds).toBeGreaterThan(0);
  expect(seconds).toBeLessThanOrEqual(90);
});

test('stopping an exercise for pain needs a reason and moves on without a rest', async ({
  page,
}) => {
  await startAndSkipWarmup(page);
  const name = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: 'Edit set' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Stop this exercise' }).click();
  await expect(dialog.getByRole('heading', { name: 'Stop this exercise?' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Stop the exercise' }).click();
  await expect(dialog.getByText('Pick a reason to stop.')).toBeVisible();

  await dialog.getByRole('radio', { name: /^Pain/ }).click();
  await expect(dialog.getByText(/are logged as pain/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Stop the exercise' }).click();

  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(name ?? '');
  const sets = await storedSets(page);
  expect(sets.filter((s) => s.flag === 'pain').length).toBeGreaterThanOrEqual(2);
});

test('a whole session plays through to the end and the rotation moves on', async ({ page }) => {
  test.setTimeout(180_000);
  await seedSetup(page, reference);
  await expect(page.getByRole('heading', { name: 'Session A — Push' })).toBeVisible();
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);

  const finished = page.getByRole('heading', { name: 'Session done' });
  const actions = [
    page.getByRole('button', { name: 'Done', exact: true }),
    page.getByRole('button', { name: /^(Done as planned|(Left|Right) side done)/ }),
    page.getByRole('button', { name: /^Done \d+ min/ }),
    page.getByRole('button', { name: /^Stop here/ }),
    page.getByRole('button', { name: 'Next phase' }),
    page.getByRole('button', { name: /^Log\b/ }),
    page.getByRole('button', { name: 'Skip', exact: true }),
    page.getByRole('button', { name: /^Start the (left|right) side now$/ }),
    page.getByRole('button', { name: 'Start the clock' }),
    page.getByRole('button', { name: 'Start', exact: true }),
    page.getByRole('button', { name: /^Stop the clock/ }),
  ];
  for (let i = 0; i < 600 && !(await finished.isVisible()); i++) {
    let acted = false;
    for (const action of actions) {
      if (await action.isVisible()) {
        await action.click({ timeout: 2000 }).catch(() => undefined);
        acted = true;
        break;
      }
    }
    if (!acted) await page.waitForTimeout(100);
  }
  await expect(finished).toBeVisible();
  await expect(page.getByRole('switch', { name: /Counts as done/ })).toBeChecked();
  await expect(page.getByText('Active time, pauses not counted')).toBeVisible();

  await page.getByRole('button', { name: 'Back to programme' }).click();
  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByRole('heading', { name: 'Session A — Push' })).toHaveCount(0);
  await expect(page.getByText('Next session')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Session B/ })).toBeVisible();
});
