import { defineConfig } from '@playwright/test';

/**
 * Browser tests. They need the local Supabase stack (`npm run db:start` and a
 * fresh `npm run db:reset`) and .env pointing at it. The tests create their own
 * temporary owner and second user, and delete them afterwards.
 *
 * Locally this drives the Microsoft Edge that Windows already has, so no
 * browser download is needed. In CI set CI=1 and run
 * `npx playwright install --with-deps chromium`.
 */
const channel = process.env.CI ? undefined : (process.env.PW_CHANNEL ?? 'msedge');

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // one shared owner account: keep tests in order
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4183',
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
