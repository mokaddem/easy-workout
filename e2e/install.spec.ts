import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

test.describe('iPhone Safari', () => {
  test.use({
    userAgent: IPHONE_SAFARI,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('the first visit shows the gate without a yellow button; continuing is remembered', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/install$/);
    await expect(heading(page)).toHaveText('Install Easy Workout');
    await expect(page.getByRole('tab', { name: 'iPhone / iPad' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'In Safari' })).toBeVisible();
    await expect(page.getByRole('list').first().getByRole('listitem')).toHaveCount(4);
    // Nothing to install from here: the only button leads on, and it is not the accent one.
    await expect(page.getByRole('button', { name: 'Install', exact: true })).toHaveCount(0);
    await expect(page.getByText('Install first, then set up')).toBeVisible();
    const cont = page.getByRole('button', { name: 'Continue in Safari' });
    expect(await cont.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );

    await cont.click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.reload();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test('the platform switch swaps the steps', async ({ page }) => {
    await page.goto('/install');
    await page.getByRole('tab', { name: 'Computer' }).click();
    await expect(page.getByRole('heading', { name: 'In Chrome or Edge' })).toBeVisible();
    await expect(page.getByText('in the address bar', { exact: false }).first()).toBeVisible();
  });
});

test.describe('Android Chrome', () => {
  test.use({
    userAgent: ANDROID_CHROME,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('Install opens the browser prompt, then the installed state shows', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/install$/);
    // Without the prompt: the menu path and a plain way out.
    await expect(page.getByRole('button', { name: 'Install', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue in Chrome' })).toBeVisible();

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(event);
    });
    const install = page.getByRole('button', { name: 'Install', exact: true });
    await expect(install).toBeVisible();
    await expect(page.getByText('Nothing opens?')).toBeVisible();
    await install.click();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));

    await expect(page.getByRole('status').filter({ hasText: 'installed' })).toContainText(
      'App installed',
    );
    await expect(page.getByRole('status').filter({ hasText: 'installed' })).toContainText(
      'Open it from your home screen.',
    );
    await expect(page.getByRole('button', { name: 'Continue in Chrome' })).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });
});

test.describe('computer', () => {
  test('never meets the gate', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test('Settings shows the row, opens the Settings variant and goes back', async ({ page }) => {
    await seedSetup(page, reference);
    await page.goto('/settings');
    const row = page.getByRole('button', { name: /Install the app/ });
    await expect(row).toContainText('In its own window, like an app');
    await row.click();
    await expect(page).toHaveURL(/\/settings\/install$/);
    await expect(heading(page)).toHaveText('Install Easy Workout');
    await expect(page.getByRole('tab', { name: 'Computer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'In Chrome or Edge' })).toBeVisible();
    // No gate actions in Settings.
    await expect(page.getByRole('button', { name: /^Continue in/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('the Data screen links to the guide when storage is not granted', async ({ page }) => {
    await seedSetup(page, reference);
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'persisted', { value: async () => false });
    });
    await page.goto('/settings/data');
    await page.getByRole('button', { name: 'See how to install it' }).click();
    await expect(page).toHaveURL(/\/settings\/install$/);
  });
});
