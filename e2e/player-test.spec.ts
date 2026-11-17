import { expect, test, type Page } from '@playwright/test';
import { seedHistory } from './support/history';
import { reference } from './support/seed';

test.use({ locale: 'en-US' });
test.describe.configure({ timeout: 90_000 });

/** Four days a week: the last session of week 8 is a lower day that closes with the max test. */
const fourDays = { ...reference, profile: { ...reference.profile, daysPerWeek: 4 } };
/** Sessions done before week 8's last session (three weeks of seven are 28, then three more). */
const BEFORE_TEST_SESSION = 7 * 4 + 3;

interface StoredTest {
  id: string;
  context: string;
  logId?: string;
  stopped?: string;
  result: { kind: string; reps?: number };
}

async function storedTests(page: Page): Promise<StoredTest[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tests = await new Promise<unknown[]>((resolve) => {
      const get = db.transaction('maxTests').objectStore('maxTests').getAll();
      get.onsuccess = () => resolve(get.result);
    });
    db.close();
    return tests as StoredTest[];
  });
}

/** Plays the session until the max test's intro shows (one tap per set, rests skipped). */
async function playToTest(page: Page) {
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
  const intro = page.getByRole('button', { name: /^Start the rest/ });
  const buttons = {
    asPlanned: page.getByRole('button', { name: /^(Done as planned|(Left|Right) side done)/ }),
    done: page.getByRole('button', { name: 'Done', exact: true }),
    skip: page.getByRole('button', { name: /^Skip/ }),
    startClock: page.getByRole('button', { name: 'Start the clock' }),
    stopClock: page.getByRole('button', { name: /^Stop the clock/ }),
    log: page.getByRole('button', { name: /^Log/ }),
    switchSide: page.getByRole('button', { name: /^Start the (left|right) side now/ }),
  };
  for (let i = 0; i < 200 && !(await intro.isVisible()); i++) {
    if (await buttons.asPlanned.isVisible()) await buttons.asPlanned.click();
    else if (await buttons.log.isVisible()) await buttons.log.click();
    else if (await buttons.switchSide.isVisible()) await buttons.switchSide.click();
    else if (await buttons.stopClock.isVisible()) await buttons.stopClock.click();
    else if (await buttons.startClock.isVisible()) await buttons.startClock.click();
    else if (await buttons.done.isVisible()) await buttons.done.click();
    else if (await buttons.skip.isVisible()) await buttons.skip.click();
    else await page.waitForTimeout(150);
  }
  await expect(intro).toBeVisible();
}

test.describe('max test in a session', () => {
  test('the last session of week 8 closes with the test, which is saved and summarised', async ({
    page,
  }) => {
    await seedHistory(page, { setup: fourDays, sessions: BEFORE_TEST_SESSION });
    await playToTest(page);
    await expect(page.getByText('End-of-cycle max test')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /push-up/i })).toBeVisible();

    await page.getByRole('button', { name: /^Start the rest/ }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page.getByRole('button', { name: /^Skip$/ }).click();

    await expect(page.getByText('Max test, one set')).toBeVisible();
    await page.getByRole('button', { name: /^I'm done/ }).click();
    await expect(page.getByRole('heading', { name: 'How many clean reps?' })).toBeVisible();
    // The entry starts at a number and is bounded at 50.
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByText('Max test saved')).toBeVisible();
    await page.getByRole('button', { name: 'See the summary' }).click();

    await expect(page.getByText('Max test', { exact: true })).toBeVisible();
    const tests = await storedTests(page);
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({ context: 'session', result: { kind: 'reps' } });
    expect(tests[0]!.logId).toBeTruthy();
    expect(tests[0]!.id).toBe(`${tests[0]!.logId}-test`);
  });

  test('skipping the test records nothing and the summary says so', async ({ page }) => {
    await seedHistory(page, { setup: fourDays, sessions: BEFORE_TEST_SESSION });
    await playToTest(page);
    await page.getByRole('button', { name: 'Skip the test' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Skip the test?');
    await dialog.getByRole('button', { name: 'Skip the test' }).click();
    await expect(page.getByText(/Max test skipped/)).toBeVisible();
    expect(await storedTests(page)).toHaveLength(0);
  });

  test('a pain stop keeps what was done but never shows it as a result', async ({ page }) => {
    await seedHistory(page, { setup: fourDays, sessions: BEFORE_TEST_SESSION });
    await playToTest(page);
    await page.getByRole('button', { name: /^Start the rest/ }).click();
    await page.getByRole('button', { name: /^Skip$/ }).click();
    await page.getByRole('button', { name: 'Test options' }).click();
    await page.getByRole('button', { name: 'Stop the test' }).click();
    await expect(page.getByText('Max test', { exact: true })).toHaveCount(0);
    const tests = await storedTests(page);
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({ stopped: 'pain' });
  });
});

test('three days a week: the test comes right after the warm-up, then the session goes on', async ({
  page,
}) => {
  const threeDays = { ...reference, profile: { ...reference.profile, daysPerWeek: 3 } };
  await seedHistory(page, { setup: threeDays, sessions: 7 * 3 });
  await playToTest(page);
  await expect(page.getByText('End-of-cycle max test, before the session')).toBeVisible();
  await expect(page.getByText('Then the session')).toBeVisible();
  await page.getByRole('button', { name: /^Start the rest/ }).click();
  await page.getByRole('button', { name: /^Skip$/ }).click();
  await page.getByRole('button', { name: /^I'm done/ }).click();
  await page.getByRole('button', { name: /^Save/ }).click();
  await page.getByRole('button', { name: /^Continue the session/ }).click();
  await expect(page.getByText(/^Exercise 1 of \d+$/).first()).toBeVisible();
  expect(await storedTests(page)).toHaveLength(1);
});

test.describe('test now', () => {
  test('runs on its own, without a rest, and saves a fresh test', async ({ page }) => {
    await seedHistory(page, { setup: fourDays, sessions: 3 });
    await page.goto('/test/push-up');
    await expect(page.getByRole('heading', { level: 1, name: /push-up/i })).toBeVisible();
    await expect(page.getByText('Fresh test', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^I'm done/ }).click();
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('heading', { name: 'Test done' })).toBeVisible();
    await expect(page.getByText(/Outside your programme/)).toBeVisible();
    const tests = await storedTests(page);
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({ context: 'fresh' });
    expect(tests[0]!.logId).toBeUndefined();
    await page.getByRole('button', { name: 'Back to progress' }).click();
    await expect(page).toHaveURL(/\/progress$/);
  });
});
