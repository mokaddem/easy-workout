import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

async function changeProfile(page: Page, change: Record<string, unknown>) {
  await page.evaluate(async (patch) => {
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
    store.put({ ...current, ...patch });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, change);
}

test('the overview shows week 1, the next session and the rotation grid', async ({ page }) => {
  await seedSetup(page, reference);
  await expect(page.getByRole('heading', { name: /re-adaptation phase/i })).toBeVisible();
  await expect(page.getByText('Next session')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Session A — Push' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
  const grid = page.getByRole('table', { name: 'Sessions by week' });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('cell')).toHaveCount(48);
  await expect(page.getByText(/8 weeks, 5 sessions \(\+ 1 cardio day\) a week/)).toBeVisible();
});

test('Start leads to the player and a phase opens its sheet', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('button', { name: 'Re-adaptation' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Weeks 1 to 2 of 8')).toBeVisible();
  await expect(dialog.getByText('3 reps in the tank').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
});

test('a session opens, switches week, and explains an exercise', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: /^B\s*Pull/ }).click();
  await expect(page).toHaveURL(/\/programme\/session\/b-pull$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pull' })).toBeVisible();
  await expect(page.getByText(/not the next session/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start session' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Programme', exact: true }).first().click();
  await page.getByRole('link', { name: /^A\s*Push/ }).click();
  await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
  await page.getByRole('radio', { name: 'Week 3' }).click();
  await expect(page).toHaveURL(/week=3/);
  await expect(page.getByRole('heading', { name: /Week 3, volume/ })).toBeVisible();
  await expect(page.getByText('+1 set').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start session' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to week 1' }).click();
  await expect(page).toHaveURL(/session\/a-push$/);
  await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();

  await page.getByRole('button', { name: /^Why Floor press/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Why this exercise')).toBeVisible();
  await expect(dialog.getByText(/no bench/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
});

test('another variation is previewed, then confirmed', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('button', { name: 'Programme options' }).click();
  await page.getByRole('menuitem', { name: /Try another variation/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Another variation')).toBeVisible();
  await expect(dialog.getByText(/exercises? changes?/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep the current one' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Programme options' }).click();
  await page.getByRole('menuitem', { name: /Try another variation/ }).click();
  await page.getByRole('button', { name: 'Use this variation' }).click();
  await expect(page.getByText('Variation in place')).toBeVisible();
});

test('after a profile change, the new-programme preview opens from the URL', async ({ page }) => {
  await seedSetup(page, reference);
  await changeProfile(page, { daysPerWeek: 4 });
  await page.goto('/programme?preview=new');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('New programme', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/sessions instead of 6/)).toBeVisible();
  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByText('Programme out of date')).toBeVisible();
  await dialog.getByRole('button', { name: 'Use this programme' }).click();
  await expect(page.getByText('New programme in place')).toBeVisible();
});

test('the one-time "why" card shows until dismissed', async ({ page }) => {
  await seedSetup(page, { ...reference, whySeen: false });
  await expect(page.getByRole('heading', { name: 'Why this programme?' })).toBeVisible();
  await page.getByRole('button', { name: 'All the reasons' }).click();
  await expect(page.getByRole('dialog').getByText('Your schedule')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'Why this programme?' })).toHaveCount(0);
});

test('a long session detail scrolls inside the screen, never the whole page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSetup(page, reference);
  for (const id of ['a-push', 'c-lower-core']) {
    await page.goto(`/programme/session/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(844);
  }
});
