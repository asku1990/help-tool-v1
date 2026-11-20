import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.touch.ts',
  webServer: {
    command: 'pnpm dev --hostname 127.0.0.1 --port 3100',
    url: baseURL,
    env: { TEST_BYPASS_AUTH: '1', LOCAL_AUTO_SIGN_IN: '0' },
    timeout: 120000,
  },
  use: { ...devices['iPhone 13'], baseURL },
});
