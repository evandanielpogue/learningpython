import { defineConfig, devices } from '@playwright/test';

/* Runs against a production build. Uses the preinstalled Chromium when the
   bundled one is absent (as in CI sandboxes). */
const PORT = 3200;
const chromium = process.env.PLAYWRIGHT_CHROMIUM ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/ai/status`,
    reuseExistingServer: true,
    timeout: 60_000,
    /* the suite tests the no-key path; never send a real key from tests */
    env: { ANTHROPIC_API_KEY: '' },
  },
});
