import { expect, test, type Page } from '@playwright/test';
import { reference, seedSetup } from './support/seed';

test.use({ locale: 'en-US' });

type Item = Record<string, unknown>;
type Block = Record<string, unknown>;

const reps = (min: number, max = min) => ({ kind: 'reps', min, max });
const straight = (item: Item, sets = 1, restSec = 30): Block => ({
  type: 'straight',
  item,
  sets,
  restSec,
});
const group = (items: Item[], rounds: number, between = 0, after = 30): Block => ({
  type: 'group',
  style: 'superset',
  items,
  rounds,
  restBetweenItemsSec: between,
  restAfterRoundSec: after,
});

interface Seed {
  warmup?: Block[];
  main: Block[];
  finisher?: Block[];
  live?: { kind: 'timing'; startedAt: string };
  settings?: Record<string, unknown>;
}

/** Writes an open session straight into the app's database and opens the player on it. */
async function openPlayer(page: Page, seed: Seed) {
  await seedSetup(page, reference);
  const log = {
    id: 'seeded-log',
    source: { kind: 'quick' },
    plan: {
      id: 'seeded-plan',
      name: { fr: 'Essai', en: 'Trial' },
      estimatedMinutes: 30,
      warmup: seed.warmup ?? [],
      main: seed.main,
      finisher: seed.finisher ?? [],
    },
    status: 'in-progress',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    sets: [],
    ...(seed.live && { live: seed.live }),
  };
  await page.evaluate(
    async ({ log, settings }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('easy-workout');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['sessionLogs', 'settings'], 'readwrite');
      tx.objectStore('sessionLogs').put(log);
      if (settings)
        tx.objectStore('settings').put({
          id: 'settings',
          language: 'en',
          theme: 'system',
          voice: true,
          sounds: false,
          vibration: false,
          restDisplay: 'takeover',
          ...settings,
        });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { log, settings: seed.settings },
  );
  await page.goto('/play');
}

const ago = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();

test('a superset shows its round, item tiles and what comes next, with no rest between items', async ({
  page,
}) => {
  await openPlayer(page, {
    main: [
      group(
        [
          { exerciseId: 'dumbbell-lateral-raise', target: reps(12), load: { kind: 'kg', kg: 6 } },
          { exerciseId: 'push-up', target: reps(10), load: { kind: 'bodyweight' } },
        ],
        2,
      ),
    ],
  });
  await expect(page.getByText('Round', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Exercise a of 2' })).toBeVisible();
  await expect(page.getByText('Then', { exact: true })).toBeVisible();
  await expect(page.getByText(/10\sreps.*no rest/)).toBeVisible();

  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push-up' })).toBeVisible();
  await expect(page.getByText(/Then rest 30 s, round 2/)).toBeVisible();

  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await expect(page.getByText('Round 1 of 2 done')).toBeVisible();
  await expect(page.getByText('Round 2 of 2, starts with')).toBeVisible();
});

test('a per-side set is logged side by side, with a dark switch pause between', async ({
  page,
}) => {
  await openPlayer(page, {
    main: [
      straight(
        {
          exerciseId: 'one-arm-dumbbell-row',
          target: reps(10),
          perSide: true,
          load: { kind: 'kg', kg: 16 },
        },
        1,
      ),
    ],
  });
  await expect(page.getByText('reps, left side')).toBeVisible();
  await page.getByRole('button', { name: /^Left side done/ }).click();
  await expect(page.getByText('Switch sides', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Starts in')).toBeVisible();
  await page.getByRole('button', { name: 'Start the right side now' }).click();
  await expect(page.getByText('reps, right side')).toBeVisible();
  await page.getByRole('button', { name: /^Right side done/ }).click();
  await expect(page.getByText('Session done')).toBeVisible();
});

test('a hold: ready, lead-in, cancel, then it logs itself at its goal', async ({ page }) => {
  await openPlayer(page, {
    main: [
      straight({
        exerciseId: 'plank',
        target: { kind: 'time', minSec: 2, maxSec: 4 },
        goal: 3,
      }),
    ],
  });
  await expect(page.getByText('Get into position, then tap. You get 3 s.')).toBeVisible();
  await page.getByRole('button', { name: 'Start the clock' }).click();
  await expect(page.getByText('Get set')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Start the clock' })).toBeVisible();

  await page.getByRole('button', { name: 'Start the clock' }).click();
  await expect(page.getByRole('button', { name: /^Stop the clock/ })).toBeVisible({
    timeout: 6000,
  });
  await expect(page.getByText('2 s minimum')).toBeVisible();
  await expect(page.getByText('Session done')).toBeVisible({ timeout: 8000 });
});

test('stopping a hold early logs the seconds held', async ({ page }) => {
  await openPlayer(page, {
    main: [straight({ exerciseId: 'plank', target: { kind: 'time', minSec: 20, maxSec: 30 } })],
  });
  await page.getByRole('button', { name: 'Start the clock' }).click();
  const stop = page.getByRole('button', { name: /^Stop the clock/ });
  await expect(stop).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1200);
  await stop.click();
  await expect(page.getByText('Session done')).toBeVisible();
});

test('intervals: work on the base colour, recovery on yellow, with this phase settings', async ({
  page,
}) => {
  await openPlayer(page, {
    main: [straight({ exerciseId: 'push-up', target: reps(5) })],
    finisher: [
      straight({
        exerciseId: 'treadmill-run',
        target: {
          kind: 'interval',
          rounds: 3,
          workSec: 20,
          recoverySec: 60,
          workSpeedKmh: 10,
          workInclinePct: 1,
          recoverySpeedKmh: 5,
          recoveryInclinePct: 1,
        },
      }),
    ],
  });
  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Work', { exact: true })).toBeVisible({ timeout: 6000 });
  await expect(page.getByText('10', { exact: true })).toBeVisible();
  await expect(page.getByText('Recovery 60 s at 5 km/h, 1%')).toBeVisible();
  await expect(page.getByText('Finisher, intervals')).toBeVisible();

  // Next phase ends the work part now.
  await page.getByRole('button', { name: 'Next phase' }).click();
  await expect(page.getByText('Recovery', { exact: true })).toBeVisible();
});

test('intervals in recovery show the recovery speed and the next round', async ({ page }) => {
  await openPlayer(page, {
    main: [
      straight({
        exerciseId: 'treadmill-run',
        target: {
          kind: 'interval',
          rounds: 3,
          workSec: 20,
          recoverySec: 60,
          workSpeedKmh: 10,
          recoverySpeedKmh: 5,
        },
      }),
    ],
    live: { kind: 'timing', startedAt: ago(30) },
  });
  await expect(page.getByText('Recovery', { exact: true })).toBeVisible();
  await expect(page.getByText('Round 2: work 20 s at 10 km/h')).toBeVisible();
  await expect(page.getByText('5', { exact: true })).toBeVisible();
});

test('steady cardio: Done turns primary once the goal is reached, and the clock keeps going', async ({
  page,
}) => {
  const cardio = {
    exerciseId: 'treadmill-incline-walk',
    target: { kind: 'cardio', minMinutes: 10, maxMinutes: 10, speedKmh: 5, inclinePct: 12 },
  };
  await openPlayer(page, {
    main: [straight(cardio)],
    live: { kind: 'timing', startedAt: ago(300) },
  });
  await expect(page.getByText(/to go/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Stop here/ })).toBeVisible();

  await openPlayer(page, {
    main: [straight(cardio)],
    live: { kind: 'timing', startedAt: ago(660) },
  });
  await expect(page.getByText('10 min goal reached')).toBeVisible();
  await page.getByRole('button', { name: /^Done 11 min at 5 km\/h, 12%/ }).click();
  await expect(page.getByText('Session done')).toBeVisible();
});

test('a warm-up item has no feel selector, one tap to finish and a skip', async ({ page }) => {
  await openPlayer(page, {
    warmup: [straight({ exerciseId: 'cat-cow', target: reps(8) }, 1, 0)],
    main: [straight({ exerciseId: 'push-up', target: reps(5) })],
  });
  await expect(page.getByText(/^Warm-up, 1 of 1$/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Easy' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip this exercise' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push-up' })).toBeVisible();
});

test('ring rest replaces the yellow takeover when chosen in settings', async ({ page }) => {
  await openPlayer(page, {
    main: [straight({ exerciseId: 'push-up', target: reps(5) }, 2, 60)],
    settings: { restDisplay: 'ring' },
  });
  await page.getByRole('button', { name: /^Done as planned/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.locator('[data-tone="rest"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
});

test('the voice button mutes the announcements only', async ({ page }) => {
  await openPlayer(page, { main: [straight({ exerciseId: 'push-up', target: reps(5) })] });
  const voice = page.getByRole('button', { name: 'Voice cues' });
  await expect(voice).toHaveAttribute('aria-pressed', 'true');
  await voice.click();
  await expect(voice).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Voice cues off. Beeps stay on.')).toBeVisible();
});

test('the tempo strip toggles the pacing', async ({ page }) => {
  await openPlayer(page, {
    main: [
      straight({ exerciseId: 'push-up', target: reps(8), tempo: { down: 3, pause: 1, up: 1 } }),
    ],
  });
  const strip = page.getByRole('button', { name: /^Start tempo pacing/ });
  await strip.click();
  await expect(page.getByRole('button', { name: /^Stop tempo pacing/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
