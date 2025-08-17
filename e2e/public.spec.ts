import { test, expect } from '@playwright/test';

test('landing page renders', async ({ page }: { page: any }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /personal helper tools/i })).toBeVisible();
});

test('protected routes redirect', async ({ page }: { page: any }) => {
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/callbackUrl=/);
});
