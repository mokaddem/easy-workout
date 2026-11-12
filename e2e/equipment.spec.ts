import { expect, test } from '@playwright/test';
import { bodyweightBeginner, reference, seedSetup } from './support/seed';

test.describe('equipment editor', () => {
  test.beforeEach(async ({ page }) => {
    await seedSetup(page, bodyweightBeginner);
    await page.goto('/settings/equipment');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('ticks and configures an item, then saves', async ({ page }) => {
    const save = page.getByRole('button', { name: /Enregistrer|Save/ });
    await expect(save).toBeDisabled();
    const before = Number(await page.getByTestId('live-count').locator('span').first().innerText());

    await page.getByRole('checkbox', { name: /Barre de traction|Pull-up bar/ }).check();
    await page.getByRole('radio', { name: /Mur|Wall/ }).click();
    await expect(save).toBeEnabled();
    // The count rolls to its new value; wait for the final state.
    await expect
      .poll(async () =>
        Number(await page.getByTestId('live-count').locator('span').first().innerText()),
      )
      .toBeGreaterThan(before);
    await expect(page.getByText(/à mettre à jour|out of date/).first()).toBeVisible();

    await save.click();
    await expect(page.getByText(/Matériel enregistré|Equipment saved/)).toBeVisible();
    await expect(save).toBeDisabled();

    await page.reload();
    await expect(
      page.getByRole('checkbox', { name: /Barre de traction|Pull-up bar/ }),
    ).toBeChecked();
  });

  test('unticking an item with specs offers undo', async ({ page }) => {
    const bands = page.getByRole('checkbox', { name: /Élastiques|Resistance bands/ });
    await bands.check();
    await bands.uncheck();
    await page.getByRole('button', { name: /^Annuler$|^Undo$/ }).click();
    await expect(bands).toBeChecked();
  });

  test('fixed dumbbells with no weight block saving', async ({ page }) => {
    await page.getByRole('checkbox', { name: /Haltères fixes|Fixed dumbbells/ }).check();
    await page.getByRole('button', { name: /Enregistrer|Save/ }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('what to buy next lists purchases for a bodyweight beginner', async ({ page }) => {
    await page.getByRole('tab', { name: /Quoi acheter|What to buy/ }).click();
    const cards = page.getByRole('article');
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    expect(await cards.count()).toBeGreaterThan(0);

    await cards
      .first()
      .getByRole('button', { name: /J’ai cet équipement|I own this/ })
      .click();
    await expect(page.getByRole('tab', { name: /Mon matériel|My equipment/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('button', { name: /Enregistrer|Save/ })).toBeEnabled();
    await expect(page.getByText(/ajouté|added/)).toBeVisible();
  });
});

test('unsaved equipment changes are confirmed before leaving, browser back included', async ({
  page,
}) => {
  await seedSetup(page, reference);
  // Move within the app so browser back stays in the app's own history.
  await page.getByRole('navigation').getByRole('link').nth(3).click();
  await page
    .getByRole('button', { name: /Matériel|Equipment/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/equipment$/);
  await page.locator('input[type="checkbox"]:checked').first().click({ force: true });

  await page.goBack();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/equipment$/);

  await dialog.getByRole('button').last().click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/settings\/equipment$/);

  await page
    .getByRole('button', { name: /back|retour/i })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('after saving an added item the editor is clean again', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings/equipment');
  const save = page.getByRole('button', { name: /Enregistrer|Save/ });
  // Kettlebells start with one 12 kg bell, which is valid as is.
  await page.getByRole('checkbox', { name: /Kettlebells/ }).check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
});
