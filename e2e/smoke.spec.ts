import { expect, test } from '@playwright/test';

test('first run opens the set-up', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('fonts are served by the app itself', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://localhost')) external.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('700 16px "Archivo Variable"'))).toBe(true);
  expect(external).toEqual([]);
});
