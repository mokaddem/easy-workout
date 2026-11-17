import { expect, test } from '@playwright/test';
import { bodyweightBeginner } from './support/seed';
import { seedHistory } from './support/history';

test.use({ locale: 'en-US' });

// 3 sessions a week, 8 weeks: 21 done leaves the first session of week 8.
test('the test shows on the session that runs it, in week 8', async ({ page }) => {
  await seedHistory(page, { setup: bodyweightBeginner, sessions: 21 });
  await expect(page.getByText(/max test:/i)).toBeVisible();
  await page.getByRole('button', { name: 'View session' }).click();
  await expect(page.getByRole('heading', { name: 'Max test', level: 2 })).toBeVisible();
  await expect(page.getByText(/Max test right after the warm-up/)).toBeVisible();
  await expect(page.getByText(/After a 3 min rest/)).toBeVisible();
});

test('the next session of an earlier week carries no test', async ({ page }) => {
  await seedHistory(page, { setup: bodyweightBeginner, sessions: 6 });
  await expect(page.getByText(/max test:/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'View session' }).click();
  await expect(page.getByRole('heading', { name: 'Max test', level: 2 })).toHaveCount(0);
});

test('after the last session the cycle-end card leads to the review', async ({ page }) => {
  await seedHistory(page, { setup: bodyweightBeginner, sessions: 24 });
  await expect(page.getByRole('heading', { name: 'Cycle done' })).toBeVisible();
  await expect(page.getByText('End of cycle 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start session' })).toHaveCount(0);
  await page.getByRole('button', { name: 'See the review' }).click();
  await expect(page).toHaveURL(/\/programme\/review\/seeded-programme$/);
});

test('the check-in card hides with a toast, and Settings turns it off', async ({ page }) => {
  await seedHistory(page, { setup: bodyweightBeginner, sessions: 3 });
  const card = page.getByRole('heading', { name: 'Your weekly check-in' });
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Not this week' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Reminder hidden until');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(card).toBeVisible();

  await page.goto('/settings');
  const row = page.getByRole('switch', { name: /Weekly check-in reminder/ });
  await expect(row).toBeChecked();
  await row.click();
  await expect(row).not.toBeChecked();
  await page
    .getByRole('link', { name: /Programme/ })
    .first()
    .click();
  await expect(card).toHaveCount(0);
});

test('Add a check-in opens the check-in sheet', async ({ page }) => {
  await seedHistory(page, { setup: bodyweightBeginner, sessions: 3 });
  await page.getByRole('button', { name: 'Add a check-in' }).click();
  await expect(page.getByRole('dialog')).toContainText('New check-in');
});
