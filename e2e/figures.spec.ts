import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

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

test('the set screen has one figure slot that names the exercise', async ({ page }) => {
  await toFirstSet(page);
  const slot = page.getByRole('button', { name: /^How to do it: / });
  await expect(slot).toBeVisible();
  const box = await slot.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(96);
});

test('the Settings switch is on by default and keeps its value', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  const figures = page.getByRole('switch', { name: /Animated figures/ });
  await expect(figures).toBeChecked();
  await figures.click();
  await expect(figures).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('switch', { name: /Animated figures/ })).not.toBeChecked();
});

test('with figures off the set screen draws no moving figure', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  await page.getByRole('switch', { name: /Animated figures/ }).click();
  // Wait until the setting is stored, not just shown, before leaving the page.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('switch', { name: /Animated figures/ })).not.toBeChecked({
      timeout: 1000,
    });
  }).toPass();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('button', { name: /^How to do it: / })).toBeVisible();
  const slot = page.locator('button[aria-label^="How to do it"]').locator('xpath=..');
  await expect(slot).toHaveAttribute('data-state', 'ready');
  const paths = slot.locator('svg path');
  await page.waitForTimeout(600);
  const first = await paths.evaluateAll((els) => els.map((e) => e.getAttribute('d')).join('|'));
  await page.waitForTimeout(500);
  const second = await paths.evaluateAll((els) => els.map((e) => e.getAttribute('d')).join('|'));
  expect(second).toBe(first);
});

test('the figure follows the tempo strip through its phases', async ({ page }) => {
  await seedSetup(page, reference);
  const log = {
    id: 'seeded-log',
    source: { kind: 'quick' },
    plan: {
      id: 'seeded-plan',
      name: { fr: 'Essai', en: 'Trial' },
      estimatedMinutes: 30,
      warmup: [],
      main: [
        {
          type: 'straight',
          item: {
            exerciseId: 'push-up',
            target: { kind: 'reps', min: 8, max: 8 },
            tempo: { down: 1, pause: 1, up: 1 },
          },
          sets: 1,
          restSec: 30,
        },
      ],
      finisher: [],
    },
    status: 'in-progress',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    sets: [],
  };
  await page.evaluate(async (seeded) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('sessionLogs', 'readwrite');
    tx.objectStore('sessionLogs').put(seeded);
    await new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
    db.close();
  }, log);
  await page.goto('/play');
  await expect(page.getByRole('button', { name: /^How to do it: / })).toBeVisible();
  await page.getByRole('button', { name: /^Start tempo pacing/ }).click();
  const seen = new Set<string>();
  const host = page.locator('div:has(> button[aria-label^="How to do it"])');
  for (let i = 0; i < 30 && seen.size < 2; i++) {
    const phase = await host.getAttribute('data-phase');
    if (phase) seen.add(phase);
    await page.waitForTimeout(100);
  }
  expect(seen.size).toBeGreaterThanOrEqual(2);
});
