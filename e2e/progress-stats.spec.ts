import { expect, test } from '@playwright/test';
import { seedHistory } from './support/history';
import { seedRecords } from './support/records';

test.describe('progress: exercises, body, max tests', () => {
  test('an exercise detail shows the ladder chart and inspects a session', async ({ page }) => {
    await seedHistory(page, { sessions: 12 });
    await page.goto('/progress/exercises');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const row = page.locator('[data-exercise="dumbbell-floor-press"]');
    await expect(row).toBeVisible();
    await row.click();

    await expect(page).toHaveURL(/\/progress\/exercise\/dumbbell-floor-press$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const plot = page.getByTestId('ladder-plot');
    await expect(plot).toBeVisible();
    await expect(plot.getByTestId('ladder-column').first()).toBeVisible();

    // The latest session reads first; an arrow key moves to the one before it.
    const readout = page.locator('[aria-live="polite"]').first();
    await expect(readout).toContainText(/Last session|Dernière séance/);
    await plot.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(readout).not.toContainText(/Last session|Dernière séance/);
    await page.keyboard.press('Escape');
    await expect(readout).toContainText(/Last session|Dernière séance/);

    // The sessions list under the chart opens a session.
    await expect(page.getByRole('heading', { name: /^(Sessions|Séances)$/ })).toBeVisible();
  });

  test('a check-in is added, then deleted and brought back with Undo', async ({ page }) => {
    await seedHistory(page, { sessions: 3 });
    await page.goto('/progress/body');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: /^(Add a check-in|Noter mes mesures)$/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel(/^(Weight|Poids)/).fill('79.7');
    await sheet.getByRole('button', { name: /^(Save|Enregistrer)$/ }).click();
    await expect(page.getByText(/Check-in saved|Mesures enregistrées/)).toBeVisible();
    const rows = page.locator('[data-checkin]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(/79[.,]7/);

    await rows.first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Delete this check-in|Supprimer ces mesures)$/ })
      .click();
    await expect(page.getByText(/Check-in deleted|Mesures supprimées/)).toBeVisible();
    await expect(rows).toHaveCount(0);

    await page.getByRole('button', { name: /^(Undo|Annuler)$/ }).click();
    await expect(rows).toHaveCount(1);
  });

  test('Test now opens the test flow for the default exercise', async ({ page }) => {
    await seedHistory(page, { sessions: 3 });
    await page.goto('/progress/tests');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: /^(Take a test|Faire un test)$/ }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('radio').first()).toBeChecked();
    await sheet.getByRole('button', { name: /^(Start the test|Commencer le test)$/ }).click();
    await expect(page).toHaveURL(/\/test\/[a-z0-9-]+$/);
  });

  test('tests of both contexts are listed apart, with the limited picker', async ({ page }) => {
    await seedHistory(page, { sessions: 3 });
    await seedRecords(page, {
      maxTests: [
        {
          id: 't1',
          date: '2026-10-01',
          at: '2026-10-01T10:00:00.000Z',
          exerciseId: 'push-up',
          context: 'fresh',
          result: { kind: 'reps', reps: 18 },
        },
        {
          id: 't2',
          date: '2026-11-05',
          at: '2026-11-05T10:00:00.000Z',
          exerciseId: 'push-up',
          context: 'fresh',
          result: { kind: 'reps', reps: 23 },
        },
      ],
    });
    await page.goto('/progress/tests');
    await expect(page.locator('[data-test]')).toHaveCount(2);
    await expect(page.getByTestId('test-plot')).toBeVisible();

    await page.getByRole('button', { name: /^(Take a test|Faire un test)$/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Another exercise|Un autre exercice)/ })
      .click();
    const picked = page.getByRole('dialog').locator('[data-exercise]').last();
    await expect(picked).toBeVisible();
    await picked.click();
    await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('dialog').getByRole('radio').last()).toBeChecked();
  });
});
