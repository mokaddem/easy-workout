import { expect, test } from '@playwright/test';
import { seedHistory } from './support/history';

const rows = (page: import('@playwright/test').Page) =>
  page.locator('a[href^="/progress/session/"]');

test.describe('progress home and session history', () => {
  test.beforeEach(async ({ page }) => {
    await seedHistory(page, { sessions: 6 });
  });

  test('the home shows the week, the cycle and the way into each part', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'This week' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Your programme' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /^Working sets in week/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sessions\b/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Exercises\b/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Body\b/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Max tests\b/ })).toBeVisible();
    await page.getByRole('button', { name: /^Exercises\b/ }).click();
    await expect(page).toHaveURL(/\/progress\/exercises$/);
  });

  test('a session opens from the history with its sets', async ({ page }) => {
    await page.goto('/progress');
    await page.getByRole('button', { name: /^Sessions\b/ }).click();
    await expect(page).toHaveURL(/\/progress\/history$/);
    await expect(rows(page)).toHaveCount(6);
    await rows(page).first().click();
    await expect(page).toHaveURL(/\/progress\/session\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Exercise by exercise' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete this session' })).toBeVisible();
  });

  test('deleting a session removes it, and Undo brings it back', async ({ page }) => {
    await page.goto('/progress/history');
    await expect(rows(page)).toHaveCount(6);
    await rows(page).first().click();
    await page.getByRole('button', { name: 'Delete this session' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Delete this session?' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete the session' }).click();
    await expect(page).toHaveURL(/\/progress\/history$/);
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByText('Session deleted. Loads worked out again.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(rows(page)).toHaveCount(6);
  });
});
