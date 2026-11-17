import { expect, test } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test('progress is empty until a session is logged and leads to the programme', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/progress');
  await expect(
    page.getByRole('heading', { level: 2, name: 'No finished session yet' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'See the next session' }).click();
  await expect(page).toHaveURL(/\/programme$/);
});
