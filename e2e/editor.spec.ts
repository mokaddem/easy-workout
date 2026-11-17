import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

/** Opens the editor on session A of the programme. */
async function openEditor(page: Page, sessionId = 'a-push') {
  await seedSetup(page, reference);
  await page.getByRole('link', { name: /^A\s*Push/ }).click();
  await expect(page).toHaveURL(new RegExp(`/programme/session/${sessionId}$`));
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page).toHaveURL(new RegExp(`/edit/programme/${sessionId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Edit session' })).toBeVisible();
}

test('edit a programme session: sets, an added exercise, a removal put back, saved and kept', async ({
  page,
}) => {
  await openEditor(page);
  const first = page.locator('[data-block="main:0"]');
  const before = await first.innerText();

  // More sets on the first block.
  await first.click();
  const dose = page.getByRole('dialog', { name: /Main work, exercise 1/ });
  await dose.getByRole('button', { name: 'One set more' }).click();
  await dose.getByRole('button', { name: 'Done' }).click();
  await expect(first).not.toHaveText(before);
  await expect(page.getByText('Edited').first()).toBeVisible();

  // Remove the second block, then put it back.
  const second = page.locator('[data-block="main:1"]');
  const secondName = (await second.getAttribute('aria-label'))!.replace('Edit ', '');
  await page.getByRole('button', { name: `Actions: ${secondName}` }).click();
  await page.getByRole('button', { name: /Remove from the session/ }).click();
  const tomb = page.getByText(`Removed:`).locator('..');
  await expect(tomb).toContainText(secondName);
  await page.getByRole('button', { name: `Put back ${secondName}` }).click();
  await expect(page.getByText('Removed:')).toHaveCount(0);
  await expect(page.locator('[data-block="main:1"]')).toHaveAttribute(
    'aria-label',
    `Edit ${secondName}`,
  );

  // Remove another, keep it removed.
  const third = page.locator('[data-block="main:2"]');
  const thirdName = (await third.getAttribute('aria-label'))!.replace('Edit ', '');
  await page.getByRole('button', { name: `Actions: ${thirdName}` }).click();
  await page.getByRole('button', { name: /Remove from the session/ }).click();
  await expect(page.getByText('Removed:')).toBeVisible();

  // Add an exercise through the picker.
  await page.getByRole('button', { name: 'Add an exercise: Finisher' }).click();
  const picker = page.getByRole('dialog').filter({ has: page.getByRole('searchbox') });
  await picker.getByRole('searchbox').fill('plank');
  await picker.locator('[data-exercise]').first().click();
  await expect(page.getByText('Added', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Session A saved/ })).toBeVisible();
  await expect(page).toHaveURL(/\/programme\/session\/a-push$/);

  // Reopen: the changes are still there.
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Edited').first()).toBeVisible();
  await expect(page.getByText('Added', { exact: true })).toBeVisible();
  await expect(page.getByText(`Removed:`)).toBeVisible();
});

test("restore the programme's version of a session", async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-block="main:0"]').click();
  await page
    .getByRole('dialog', { name: /Main work, exercise 1/ })
    .getByRole('button', { name: 'One set more' })
    .click();
  await page
    .getByRole('dialog', { name: /Main work, exercise 1/ })
    .getByRole('button', { name: 'Done' })
    .click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/programme\/session\/a-push$/);

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Edited').first()).toBeVisible();
  await page.getByRole('button', { name: 'Restore the whole session' }).click();
  await page.getByRole('button', { name: 'Restore the session' }).click();
  await expect(page.getByText('Edited')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/programme\/session\/a-push$/);
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Edited')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore the whole session' })).toHaveCount(0);
});

test('create a new session of your own: the name is required', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/edit/mine/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New session' })).toBeVisible();
  // Nothing to save yet.
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Add an exercise: Main work' }).click();
  const picker = page.getByRole('dialog').filter({ has: page.getByRole('searchbox') });
  await picker.locator('[data-exercise]').first().click();
  await expect(page.locator('[data-block="main:0"]')).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Give your session a name.')).toBeVisible();
  await page.getByLabel('Name').fill('Upper express');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/quick\/mine\/own-/);
  await expect(page.getByRole('heading', { level: 1, name: 'Upper express' })).toBeVisible();
});

test('a blocking issue keeps the session from saving and points at it', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/edit/mine/new');
  await page.getByLabel('Name').fill('Empty');
  // An empty main part blocks, but the first change makes Save available.
  await page.getByRole('button', { name: 'Add an exercise: Warm-up' }).click();
  const picker = page.getByRole('dialog').filter({ has: page.getByRole('searchbox') });
  await picker.locator('[data-exercise]').first().click();
  await expect(page.getByText('Add at least one exercise to the main work.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('1 thing to fix', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/edit\/mine\/new$/);
  await expect(page.getByRole('button', { name: 'Add an exercise: Main work' })).toBeFocused();
});

test('leaving with changes asks first, and a draft survives a reload', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-block="main:0"]').click();
  const dose = page.getByRole('dialog', { name: /Main work, exercise 1/ });
  await dose.getByRole('button', { name: 'One set more' }).click();
  await dose.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Draft restored' })).toBeVisible();
  await expect(page.getByText('Edited').first()).toBeVisible();

  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.getByRole('heading', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page
    .getByRole('button', { name: /Leave without saving/ })
    .last()
    .click();
  await expect(page).toHaveURL(/\/programme\/session\/a-push$/);
});
