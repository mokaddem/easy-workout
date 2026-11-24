import { expect, test } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test('switching language changes the UI and survives a reload', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Français' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
});

test('changing the minutes saves with a toast and returns to settings', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  await page.getByRole('button', { name: /^Profile/ }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();

  await page.getByRole('button', { name: '5 minutes less' }).click();
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('status').filter({ hasText: 'out of date' })).toBeVisible();
});

test('changing the number of sessions asks for a new programme', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings/profile');
  await page.getByRole('button', { name: 'One session fewer' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toContainText('This needs a new programme');
  await page.getByRole('button', { name: 'See the new programme' }).click();
  // The programme screen opens its change preview, then drops the query from the URL.
  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByRole('dialog')).toContainText('New programme');
});

test('New programme asks for confirmation first', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  await page.getByRole('button', { name: /^New programme/ }).click();
  await page.getByRole('button', { name: 'See the new programme' }).click();
  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByRole('dialog')).toContainText('New programme');
});

test('About carries the health disclaimer and the license', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  await expect(page.getByText(/not medical advice\. Check with a doctor/)).toBeVisible();
  await expect(page.getByText('Open source, MIT license.')).toBeVisible();
});
