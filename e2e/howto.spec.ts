import { expect, test, type Page } from '@playwright/test';
import { seedHistory } from './support/history';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

const sheet = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('list') });

/** Starts the next session and gets past the warm-up, to the first main set. */
async function toFirstSet(page: Page) {
  await seedSetup(page, reference);
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
  const done = page.getByRole('button', { name: 'Done', exact: true });
  const asPlanned = page.getByRole('button', { name: /^Done as planned/ });
  const skip = page.getByRole('button', { name: /^Skip/ });
  for (let i = 0; i < 12 && !(await asPlanned.isVisible()); i++) {
    if (await done.isVisible()) await done.click();
    else if (await skip.isVisible()) await skip.click();
    else await page.waitForTimeout(150);
  }
  await expect(asPlanned).toBeVisible();
}

test('session detail: the picture and name open the how-to with its steps', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/programme/session/a-push');
  const open = page.locator('button[data-howto]').first();
  await expect(open).toBeVisible();
  const box = await open.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
  await open.click();
  const dialog = sheet(page);
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^(Pause|Play the animation)$/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
});

test('the how-to can be paused and slowed', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/programme/session/a-push');
  await page.locator('button[data-howto]').first().click();
  const dialog = sheet(page);
  const pause = dialog.getByRole('button', { name: 'Pause' });
  await pause.click();
  await expect(dialog.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Slow' }).click();
  await expect(dialog.getByRole('radio', { name: 'Slow' })).toBeChecked();
});

test('the longest steps scroll under the pinned figure', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/programme/session/a-push');
  await page.locator('button[data-howto]').first().click();
  const dialog = sheet(page);
  const stage = dialog.getByTestId('howto-stage');
  await expect(stage).toBeVisible();
  // Let the sheet finish rising before measuring.
  await page.waitForTimeout(600);
  const before = await stage.boundingBox();
  await dialog.getByRole('listitem').last().scrollIntoViewIfNeeded();
  const after = await stage.boundingBox();
  // The title, the stage and the controls stay put; only the steps scroll.
  expect(after?.y).toBe(before?.y);
  await expect(stage).toBeInViewport();
  await expect(dialog.getByRole('heading')).toBeInViewport();
  // The dialog is named by the title alone, not by the close button beside it.
  await expect(page.getByRole('dialog', { name: 'Floor press', exact: true })).toBeVisible();
});

test('exercise progress has a How to do it row', async ({ page }) => {
  await seedHistory(page, { sessions: 3 });
  await page.goto('/progress/exercise/dumbbell-floor-press');
  await page.locator('button[data-howto]').click();
  const dialog = sheet(page);
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
});

test('the picker opens the how-to from the picture and repeats the pick', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/edit/mine/new');
  await page.getByRole('button', { name: 'Add an exercise: Main work' }).click();
  const picker = page.getByRole('dialog').filter({ has: page.getByRole('searchbox') });
  await expect(picker.getByText('Tap a picture to see the movement.')).toBeVisible();
  await picker.locator('button[data-howto]').first().click();
  const dialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('list') })
    .last();
  await dialog.getByRole('button', { name: 'Add to the main work' }).click();
  await expect(page.locator('[data-block="main:0"]')).toBeVisible();
});

test('Test now opens the how-to inside the sheet and picks from it', async ({ page }) => {
  await seedHistory(page, { sessions: 3 });
  await page.goto('/progress/tests');
  await page.getByRole('button', { name: /^Take a test$/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^Another exercise/ }).click();
  await dialog.locator('button[data-howto]').first().click();
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Pick this exercise' }).click();
  await expect(dialog.getByRole('radio').nth(1)).toBeChecked();
});

test('player: the figure opens the how-to during a set, which Close dismisses', async ({
  page,
}) => {
  await toFirstSet(page);
  await page.getByRole('button', { name: /^How to do it: / }).click();
  const dialog = sheet(page);
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await expect(dialog.getByRole('timer')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Done as planned/ })).toBeVisible();
});

test('player: during a rest the band counts down and the sheet closes when it ends', async ({
  page,
}) => {
  await page.clock.install();
  await toFirstSet(page);
  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: /^How to do it: / }).click();
  const dialog = sheet(page);
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await expect(dialog.getByRole('timer', { name: 'Rest' })).toBeVisible();
  await page.clock.fastForward(10 * 60 * 1000);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Done as planned/ })).toBeVisible();
});

test('player: the Next card of a rest opens the how-to of the next exercise', async ({ page }) => {
  await toFirstSet(page);
  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: /^How to do it: / }).click();
  const dialog = sheet(page);
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await expect(dialog.getByRole('timer', { name: 'Rest' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
});

test('under reduced motion the how-to shows a still until asked to play', async ({ browser }) => {
  const context = await browser.newContext({
    locale: 'en-US',
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await seedSetup(page, reference);
  await page.goto('/programme/session/a-push');
  await page.locator('button[data-howto]').first().click();
  const dialog = sheet(page);
  const paths = dialog.getByTestId('howto-stage').locator('svg path');
  const shape = () => paths.evaluateAll((els) => els.map((e) => e.getAttribute('d')).join('|'));
  await expect(dialog.getByRole('button', { name: 'Pause' })).toHaveCount(0);
  await page.waitForTimeout(500);
  const still = await shape();
  await page.waitForTimeout(500);
  expect(await shape()).toBe(still);
  await dialog.getByRole('button', { name: 'Play the animation' }).click();
  await expect(dialog.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.waitForTimeout(400);
  const first = await shape();
  await page.waitForTimeout(400);
  expect(await shape()).not.toBe(first);
  await context.close();
});
