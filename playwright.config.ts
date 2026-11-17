import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
/** A separate build folder lets several runs serve their own build side by side. */
const OUT = process.env.E2E_OUT;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Each worker is a browser: a few at a time keeps memory in check.
  workers: process.env.CI ? undefined : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: OUT
      ? `npx vite build --outDir ${OUT} && npx vite preview --outDir ${OUT} --port ${PORT} --strictPort`
      : `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
