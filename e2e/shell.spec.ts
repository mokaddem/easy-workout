import { expect, test } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test('a set-up app opens on the programme tab and moves between tabs', async ({ page }) => {
  await seedSetup(page, reference);
  await expect(page).toHaveURL(/\/programme$/);
  const nav = page.getByRole('navigation');
  await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', '/programme');
  await nav.getByRole('link').nth(3).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/programme$/);
});

test('onboarding is skipped once set up', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/programme$/);
});
