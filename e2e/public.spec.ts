import { test, expect } from '@playwright/test';

test('landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Car Management' })).toBeVisible();
});

for (const route of ['/car', '/dashboard']) {
  test(`${route} requires sign-in`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/callbackUrl=/);
  });
}
