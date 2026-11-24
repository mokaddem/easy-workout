import { expect, test } from '@playwright/test';

test('onboarding with defaults and no equipment lands on the programme', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole('radio', { name: /General fitness/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/step=2/);

  await page.getByRole('radio', { name: /Beginner/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/step=3/);
  await expect(page.getByRole('heading', { name: 'Your week' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/step=4/);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/step=5/);
  await page.getByRole('button', { name: /Generate my programme/ }).click();
  await expect(page).toHaveURL(/\/programme$/);
});

test('Continue says what is missing instead of being disabled', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose your goal');
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('back from the schedule returns to the level with the answer kept', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('radio', { name: /Muscle gain/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Advanced/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/step=3/);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/step=2/);
  await expect(page.getByRole('radio', { name: /Advanced/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('answers and step survive a reload', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('radio', { name: /Muscle gain/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('radio', { name: /Muscle gain/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('a bodyweight typo is caught and a comma decimal is accepted', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('radio', { name: /Muscle gain/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Advanced/ }).click();
  await page.goto('/onboarding?step=5');
  const field = page.getByLabel('Bodyweight in kilograms');
  await field.fill('740');
  await page.getByRole('button', { name: /Generate my programme/ }).click();
  await expect(page.getByRole('alert')).toContainText('between 30 and 250');
  await field.fill('74,5');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the first screen says the app is not medical advice', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('General training guidance, not medical advice.')).toBeVisible();
});
