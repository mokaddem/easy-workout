import { expect, test } from '@playwright/test';

test('page loads and renders the title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Easy Workout');
});
