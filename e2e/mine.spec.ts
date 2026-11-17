import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

/** Builds a 20-minute push session and keeps it as "My push". */
async function saveQuickPush(page: Page) {
  await page.getByRole('link', { name: 'Quick session' }).click();
  await page.getByRole('radio', { name: '20 minutes' }).click();
  await page.getByRole('radio', { name: 'Push' }).click();
  await page.getByRole('button', { name: 'Build my session' }).click();
  await page.getByRole('button', { name: 'Save to my sessions' }).click();
  const name = page.getByLabel('Name');
  await expect(name).toHaveValue('Push, 20 min');
  await name.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Name your session.')).toBeVisible();
  await name.fill('My push');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved to my sessions');
  await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
}

test('save a quick session, place it in the programme, remove it, duplicate it and delete it', async ({
  page,
}) => {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: 'Quick session' }).click();
  await expect(page.getByText('No sessions of your own yet')).toBeVisible();

  await saveQuickPush(page);
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/quick\/mine\/own-/);
  await expect(page.getByRole('heading', { level: 1, name: 'My push' })).toBeVisible();
  await expect(page.getByText(/Started from here/)).toBeVisible();

  // Place it as session B.
  await page.getByRole('button', { name: /^Put in your programme/ }).click();
  await page.getByRole('button', { name: 'Replace the session' }).click();
  await expect(page.getByText('Pick the session to replace.')).toBeVisible();
  await page.getByRole('radio', { name: /^Session B/ }).click();
  await expect(page.getByText(/comes back as soon as you remove yours/)).toBeVisible();
  await page.getByRole('button', { name: 'Replace session B' }).click();
  await expect(page.getByRole('status')).toContainText('My push is now session B');
  await expect(page.getByText(/Your session, in place of session B/)).toBeVisible();

  // It shows on the programme session, and in the list with where it runs.
  await page.getByRole('link', { name: 'Programme' }).click();
  await page
    .getByRole('link', { name: /My push/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'My push' })).toBeVisible();
  await page.getByRole('link', { name: 'Quick session' }).click();
  await expect(page.getByRole('link', { name: /My push.*In your programme/ })).toBeVisible();

  // Remove it from the programme.
  await page.getByRole('link', { name: /My push/ }).click();
  await page.getByRole('button', { name: 'Session options' }).click();
  await page.getByRole('button', { name: /^Remove from programme The session/ }).click();
  await page
    .getByRole('dialog', { name: /Remove from your programme/ })
    .getByRole('button', { name: 'Remove from programme' })
    .click();
  await expect(page.getByRole('status')).toContainText('is back as session B');
  await expect(page.getByRole('button', { name: /^Put in your programme/ })).toBeVisible();

  // Duplicate it.
  await page.getByRole('button', { name: 'Session options' }).click();
  await page.getByRole('button', { name: /^Duplicate/ }).click();
  await expect(page.getByRole('status')).toContainText('Session duplicated');
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My push (copy)' })).toBeVisible();

  // Delete the copy.
  await page.getByRole('button', { name: 'Session options' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText("Sessions you've done stay in your history.")).toBeVisible();
  await page.getByRole('button', { name: 'Delete session' }).click();
  await expect(page).toHaveURL(/\/quick$/);
  await expect(page.getByRole('status')).toContainText('Session deleted');
  await expect(page.getByRole('link', { name: /My push \(copy\)/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^My push/ })).toBeVisible();

  // Undo brings it back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /My push \(copy\)/ })).toBeVisible();
});

test('a session of the user starts in the player', async ({ page }) => {
  await seedSetup(page, reference);
  await saveQuickPush(page);
  await page.getByRole('button', { name: 'View' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
});
