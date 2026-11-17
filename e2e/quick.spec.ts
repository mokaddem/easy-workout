import { expect, test } from '@playwright/test';
import { bodyweightBeginner, reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

test('compose a 20-minute push session, shuffle it and start it', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: 'Quick session' }).click();
  await expect(page).toHaveURL(/\/quick$/);

  await page.getByRole('radio', { name: '20 minutes' }).click();
  await page.getByRole('radio', { name: 'Push' }).click();
  await expect(page.getByText('Push: chest, shoulders and triceps.')).toBeVisible();
  await page.getByRole('button', { name: 'Build my session' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Push' })).toBeVisible();
  await expect(page.getByText(/Not saved until you start it/)).toBeVisible();

  // Push has a single template: nothing else to shuffle to.
  await expect(page.getByText('No other combination with this equipment.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shuffle' })).toBeDisabled();

  // Back keeps the choices.
  await page.getByRole('button', { name: 'Back to choices' }).click();
  await expect(page.getByRole('radio', { name: '20 minutes' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Build my session' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).toHaveURL(/\/play\?source=quick$/);
});

test('shuffling a full-body session shows a toast and undo restores it', async ({ page }) => {
  await seedSetup(page, bodyweightBeginner);
  await page.getByRole('link', { name: 'Quick session' }).click();
  await page.getByRole('radio', { name: '30 minutes' }).click();
  await page.getByRole('button', { name: 'Build my session' }).click();
  const names = () => page.getByRole('heading', { level: 3 }).allTextContents();
  const before = await names();

  await page.getByRole('button', { name: 'Shuffle' }).click();
  await expect(page.getByRole('status')).toContainText(/Session shuffled: \d+ exercises? changed/);
  expect(await names()).not.toEqual(before);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await names()).toEqual(before);
});

test('a cardio session shows its cardio block', async ({ page }) => {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: 'Quick session' }).click();
  await page.getByRole('radio', { name: '20 minutes' }).click();
  await page.getByRole('radio', { name: 'Cardio' }).click();
  await page.getByRole('radio', { name: 'Bodyweight' }).click();
  await page.getByRole('button', { name: 'Build my session' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cardio' })).toBeVisible();
  await expect(page.getByText(/\b20\s*min/).first()).toBeVisible();
});

test('browser back from a composed session returns to the launcher with its choices', async ({
  page,
}) => {
  await seedSetup(page, reference);
  await page.getByRole('navigation').getByRole('link').nth(1).click();
  await expect(page).toHaveURL(/\/quick$/);
  await page.getByRole('radio', { name: /20/ }).first().click();
  await page.getByRole('button', { name: /Composer la séance|Build my session/ }).click();
  await expect(page).toHaveURL(/\/quick\?view=session$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/quick$/);
  await expect(page.getByRole('radio', { name: /20/ }).first()).toBeChecked();
});
