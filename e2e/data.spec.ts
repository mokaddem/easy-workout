import { expect, test, type Page } from '@playwright/test';
import { bodyweightBeginner, reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

const DAY_MS = 86_400_000;

/** Writes the settings record straight into the app's database. */
async function seedSettings(page: Page, change: Record<string, unknown>) {
  await page.evaluate(async (change) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({
      id: 'settings',
      language: 'en',
      theme: 'system',
      voice: true,
      sounds: true,
      vibration: true,
      restDisplay: 'takeover',
      ...change,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, change);
}

test('exporting a backup downloads a file and updates the last backup', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings/data');
  await expect(page.getByTestId('last-backup')).toHaveText('Never');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export a backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^easy-workout-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByTestId('last-backup')).toHaveText('Today');
  await expect(page.getByRole('status').filter({ hasText: 'Backup exported' })).toBeVisible();
});

test('cancelling the share sheet says so and records no backup', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = () => Promise.reject(new DOMException('cancelled', 'AbortError'));
  });
  await seedSetup(page, reference);
  await page.goto('/settings/data');
  await page.getByRole('button', { name: 'Export a backup' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Export cancelled: no file saved.' }),
  ).toBeVisible();
  await expect(page.getByTestId('last-backup')).toHaveText('Never');
});

test('exporting the sets as CSV downloads a file and is not a backup', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings/data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sets as CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^easy-workout-sets-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  await expect(page.getByTestId('last-backup')).toHaveText('Never');
});

test('importing a backup shows a preview, asks, downloads a copy, then replaces everything', async ({
  page,
}) => {
  await seedSetup(page, reference);
  await page.goto('/settings/data');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export a backup' }).click();
  const file = await (await exported).path();

  // The phone now holds something else.
  await seedSetup(page, bodyweightBeginner);
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /^Profile/ })).toContainText('3 × 45 min');
  await page.goto('/settings/data');

  await page.getByTestId('import-file').setInputFiles(file);
  const preview = page.getByRole('dialog', { name: 'Import a backup' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('table')).toContainText('Programmes');
  await preview.getByRole('button', { name: 'Replace with this backup' }).click();

  const confirm = page.getByRole('dialog', { name: 'Replace all your data?' });
  await expect(confirm).toBeVisible();
  const copy = page.waitForEvent('download');
  await confirm.getByRole('button', { name: 'Replace everything' }).click();
  expect((await copy).suggestedFilename()).toMatch(/^easy-workout-before-import-/);

  await expect(page.getByRole('status').filter({ hasText: 'imported' })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/data$/);

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /^Profile/ })).toContainText('6 × 45 min');
});

test('importing a file that is not a backup shows an error and changes nothing', async ({
  page,
}) => {
  await seedSetup(page, reference);
  await page.goto('/settings/data');
  await page.getByTestId('import-file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  const error = page.getByRole('dialog', { name: /^This file isn.t a backup/ });
  await expect(error).toBeVisible();
  await expect(error).toContainText('Nothing was changed');
  await expect(error).toContainText('notes.json');
  await error.getByRole('button', { name: 'Close' }).click();
  await expect(error).toBeHidden();
});

test('a fresh install restores a backup from the first set-up step', async ({ page, browser }) => {
  await seedSetup(page, reference);
  await page.goto('/settings/data');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export a backup' }).click();
  const file = await (await exported).path();

  // Another phone, nothing set up.
  const fresh = await browser.newPage({ locale: 'en-US' });
  await fresh.goto('/onboarding');
  await expect(fresh.getByRole('heading', { level: 1 })).toHaveText('Your goal');

  await fresh.getByTestId('restore-file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  const error = fresh.getByRole('dialog', { name: /^This file isn.t a backup/ });
  await expect(error).toBeVisible();
  await error.getByRole('button', { name: 'Close' }).click();
  await expect(error).toBeHidden();

  let downloaded = false;
  fresh.on('download', () => (downloaded = true));
  await fresh.getByTestId('restore-file').setInputFiles(file);
  const sheet = fresh.getByRole('dialog', { name: 'Restore this backup?' });
  await expect(sheet).toContainText('It holds 1 programme.');
  await sheet.getByRole('button', { name: 'Restore', exact: true }).click();

  await expect(fresh).toHaveURL(/\/programme$/);
  await expect(fresh.getByRole('button', { name: 'Start session' })).toBeVisible();
  // Nothing on the new phone, so no copy to download first.
  expect(downloaded).toBe(false);
  await fresh.goto('/settings');
  await expect(fresh.getByRole('button', { name: /^Profile/ })).toContainText('6 × 45 min');
  await fresh.close();
});

test('player settings persist across a reload', async ({ page }) => {
  await seedSetup(page, reference);
  await page.goto('/settings');
  const beeps = page.getByRole('switch', { name: /^Beeps/ });
  await expect(beeps).toHaveAttribute('aria-checked', 'true');
  await beeps.click();
  await page.getByRole('radio', { name: /^Ring timer/ }).click();
  await page.reload();
  await expect(page.getByRole('switch', { name: /^Beeps/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.getByRole('radio', { name: /^Ring timer/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('the backup reminder shows after 30 days and Later hides it', async ({ page }) => {
  await seedSetup(page, reference);
  await seedSettings(page, { lastBackupAt: new Date(Date.now() - 40 * DAY_MS).toISOString() });
  await page.goto('/programme');
  const banner = page.getByRole('region', {
    name: /^(Back up your data|Your data could be erased)/,
  });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('40 days');
  await banner.getByRole('button', { name: 'Later' }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner).toBeHidden();
});

test('a recent backup shows no reminder', async ({ page }) => {
  await seedSetup(page, reference);
  await seedSettings(page, { lastBackupAt: new Date(Date.now() - 2 * DAY_MS).toISOString() });
  await page.goto('/programme');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: /Back up your data|could be erased/ })).toHaveCount(
    0,
  );
});
