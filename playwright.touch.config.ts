import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.touch.ts',
  // The first test also pays for Next.js to compile the vehicle page on CI.
  timeout: process.env.CI ? 60_000 : 30_000,
  webServer: {
    command: 'pnpm dev --hostname 127.0.0.1 --port 3100',
    url: baseURL,
    env: { TEST_BYPASS_AUTH: '1', LOCAL_AUTO_SIGN_IN: '0' },
    timeout: 120000,
  },
  use: { ...devices['iPhone 13'], baseURL },
});
