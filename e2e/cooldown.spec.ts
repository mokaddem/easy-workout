import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });
test.setTimeout(90_000);

/** Starts the next session, logs one main set, and finishes it early to reach the summary. */
async function finishOneSetSession(page: Page) {
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
  await asPlanned.click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Leave the session' }).click();
  await page.getByRole('button', { name: /^Finish now/ }).click();
  await expect(page.getByRole('heading', { name: 'Session ended early' })).toBeVisible();
}

test('a cooldown follows a session, ends calmly and shows in the history as its own row', async ({
  page,
}) => {
  await finishOneSetSession(page);

  // The offer: quiet, with what it stretches.
  await expect(page.getByRole('heading', { name: /^Cooldown · 5 min/ })).toBeVisible();
  await expect(page.getByText(/^Stretches what you worked:/)).toBeVisible();
  await page.getByRole('button', { name: 'Start the cooldown' }).click();

  // A stretch hold with its figure.
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: 'Cooldown done' })).toHaveCount(0);
  await expect(page.locator('svg').first()).toBeVisible();

  // Through the holds to the end.
  const done = page.getByRole('button', { name: 'Done', exact: true });
  const skip = page.getByRole('button', { name: /^Skip/ });
  const start = page.getByRole('button', { name: /^Start/ });
  const stop = page.getByRole('button', { name: /^(Next stretch|Other side|Finish)/ });
  const feel = page.getByText(/^(Easy|Right|Hard)$/);
  const minus15 = page.getByRole('button', { name: 'Remove 15 seconds' });
  const plus15 = page.getByRole('button', { name: 'Add 15 seconds' });
  const restTimer = page.getByRole('timer', { name: /of rest$/ });
  let checkedRest = false;
  const end = page.getByRole('heading', { name: 'Cooldown done' });
  for (let i = 0; i < 60 && !(await end.isVisible()); i++) {
    if (await done.isVisible()) await done.click();
    else if (await stop.isVisible()) {
      // A stretch: no feel to pick.
      await expect(feel).toHaveCount(0);
      await stop.click();
    } else if (await restTimer.isVisible()) {
      // Between stretches: no time nudges.
      await expect(minus15).toHaveCount(0);
      await expect(plus15).toHaveCount(0);
      if (!checkedRest) {
        // The break moves on by itself when its time is up.
        checkedRest = true;
        await expect(restTimer).toBeHidden({ timeout: 30_000 });
        await expect(end).toHaveCount(0);
      } else await skip.click();
    } else if (await start.isVisible()) await start.click();
    else await page.waitForTimeout(150);
  }
  await expect(end).toBeVisible();
  // Nothing to decide here.
  await expect(page.getByRole('switch')).toHaveCount(0);

  await page.getByRole('button', { name: 'Back to programme' }).click();
  await expect(page).toHaveURL(/\/programme/);

  // History: its own row, linked to the session, not counted as a session.
  await page.goto('/progress/history');
  const row = page.getByRole('link', { name: /Cooldown.*after session A/ });
  await expect(row).toBeVisible();
  await expect(page.getByText(/^1 session, the last one|^1 session/).first()).toBeVisible();
});
