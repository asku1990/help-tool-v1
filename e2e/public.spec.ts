import { test, expect } from '@playwright/test';

type PageFixture = {
  page: {
    goto(_url: string): Promise<unknown>;
    getByRole(_role: 'heading', _options: { name: string }): unknown;
  };
};

test('landing page renders', async ({ page }: PageFixture) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Car Management' })).toBeVisible();
});

for (const route of ['/car', '/dashboard']) {
  test(`${route} requires sign-in`, async ({ page }: PageFixture) => {
    await page.goto(route);
    await expect(page).toHaveURL(/callbackUrl=/);
  });
}
