import { expect, test } from '@playwright/test';
import { seedHistory } from './support/history';

test.describe('progression', () => {
  test('a pain stop raises a decision on the programme tab', async ({ page }) => {
    await seedHistory(page, {
      sessions: 7,
      stops: [{ session: 0, exerciseId: 'dumbbell-floor-press', flag: 'pain' }],
    });
    const nudge = page.getByRole('button', { name: /choix|choice|decision/i }).first();
    await expect(nudge).toBeVisible();
  });
});
