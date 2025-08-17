import { test, expect } from '@playwright/test';

test('landing page renders', async ({ page }: { page: any }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /personal helper tools/i })).toBeVisible();
});

test('protected routes redirect', async ({ page }: { page: any }) => {
  const resp = await page.goto('/dashboard');
  expect(resp?.status()).toBeGreaterThanOrEqual(300);
});
