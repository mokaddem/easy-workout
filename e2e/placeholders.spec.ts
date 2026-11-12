import { expect, test } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test('progress is empty until a session is logged and leads to the programme', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/progress');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await page.getByRole('button').last().click();
  await expect(page).toHaveURL(/\/programme$/);
});

test('the start target shows the first exercise and goes back', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/programme');
  await page.goto('/play');
  await expect(page.getByRole('img')).toBeVisible();
  await page.getByRole('button').last().click();
  await expect(page).toHaveURL(/\/programme$/);
});
