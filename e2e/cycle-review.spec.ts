import { expect, test, type Page } from '@playwright/test';
import { seedFinishedCycle } from './support/cycle';

/** Every programme in the database, read behind the app's back. */
const programmesOf = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<
      { id: string; status: string; generation?: { cycle?: number }; rotation: unknown }[]
    >((resolve, reject) => {
      const request = db.transaction('programmes').objectStore('programmes').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return all.map((p) => ({
      id: p.id,
      status: p.status,
      cycle: p.generation?.cycle ?? 1,
      json: JSON.stringify(p.rotation),
    }));
  });

test.describe('cycle review', () => {
  test('a finished cycle: review, next-cycle sheet with an upgrade off, start, cycle 2', async ({
    page,
  }) => {
    await seedFinishedCycle(page);
    await page.goto('/programme/review/seeded-programme');
    await expect(page.getByRole('heading', { level: 1, name: /Cycle 1 review/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Main lifts' })).toBeVisible();
    // No tab bar on the review.
    await expect(page.getByRole('navigation')).toHaveCount(0);

    await page.getByRole('button', { name: 'Start cycle 2' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: /Harder version/ })).toBeVisible();
    const switches = sheet.getByRole('switch');
    expect(await switches.count()).toBeGreaterThan(0);
    const first = switches.first();
    const count = async () =>
      Number(
        /\d+/.exec(
          ((await sheet.locator('h2').first().textContent()) ?? '').replace(/cycle \d/, ''),
        )?.[0],
      );
    const before = await count();
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await first.click();
    await expect(first).toHaveAttribute('aria-checked', 'false');
    await expect(sheet.getByText('You keep the current exercise.').first()).toBeVisible();
    await expect.poll(count).toBeLessThan(before);

    await sheet.getByRole('button', { name: 'Start cycle 2' }).click();
    await expect(page).toHaveURL(/\/programme$/);

    await expect
      .poll(async () => (await programmesOf(page)).map((p) => `${p.status}:${p.cycle}`).sort())
      .toEqual(['active:2', 'completed:1']);
  });

  test('past programmes: list, review, sessions, one session', async ({ page }) => {
    await seedFinishedCycle(page);
    await page.goto('/progress/programmes');
    await expect(page.getByRole('heading', { level: 1, name: 'Past programmes' })).toBeVisible();
    await expect(page.getByText('No past programmes yet')).toBeVisible();

    // Start cycle 2 so cycle 1 becomes a past programme.
    await page.goto('/programme/review/seeded-programme');
    await page.getByRole('button', { name: 'Start cycle 2' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start cycle 2' }).click();
    await expect(page).toHaveURL(/\/programme$/);

    await page.goto('/progress/programmes');
    const row = page.getByRole('link', { name: /Cycle done, with its review/ });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByRole('heading', { level: 1, name: /cycle 1/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Review' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Main lifts' })).toBeVisible();
    // Read-only: no start button, no profile offers.
    await expect(page.getByRole('button', { name: /Start cycle/ })).toHaveCount(0);

    await page.getByRole('radio', { name: 'Sessions' }).click();
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await page
      .getByRole('link', { name: /Upper body|Haut du corps/ })
      .first()
      .click();
    await expect(page.getByText('Past programme: read-only.')).toBeVisible();
    await expect(page.getByText(/Done: /).first()).toBeVisible();
  });
});
