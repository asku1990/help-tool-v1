import { expect, test } from '@playwright/test';
import { computeVehicleSummary } from '../lib/consumption';

const vehicle = { id: 'v1', name: 'Car A', canEdit: false, canWrite: false };

test('a touch outside either vehicle header menu dismisses it', async ({ page }) => {
  const responses: Record<string, unknown> = {
    '/api/auth/session': {
      user: { name: 'Browser Test', email: 'browser-test@example.test' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    '/api/admin/me': { data: { isAdmin: false } },
    '/api/vehicles': { data: { vehicles: [vehicle] } },
    '/api/vehicles/v1': { data: { vehicle } },
    '/api/vehicles/v1/summary': { data: computeVehicleSummary([], []) },
    '/api/vehicles/v1/fillups': { data: { fillUps: [], nextCursor: null } },
    '/api/vehicles/v1/expenses': { data: { expenses: [], expensesTotal: 0, nextCursor: null } },
    '/api/vehicles/v1/tires': { data: { tireSets: [] } },
    '/api/vehicles/v1/tires/change-log': { data: { history: [] } },
  };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return Object.hasOwn(responses, path)
      ? route.fulfill({ json: responses[path] })
      : route.abort();
  });

  for (const { path, menuName, heading, action } of [
    {
      path: '/car',
      menuName: 'Vehicle list actions',
      heading: 'Vehicles',
      action: 'Restore Backup',
    },
    {
      path: '/car/v1',
      menuName: 'More vehicle actions',
      heading: 'Fill-ups',
      action: 'Download backup',
    },
  ]) {
    await test.step(menuName, async () => {
      await page.goto(path);
      const originalUrl = page.url();
      const menu = page.getByRole('button', { name: menuName });
      const outside = page.getByRole('heading', { name: heading, exact: true });
      await menu.tap();
      const menuAction = page.getByText(action, { exact: true });
      await expect(menuAction).toBeVisible();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await outside.tap({ position: { x: 8, y: 8 } });
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(menuAction).not.toBeAttached();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).toHaveURL(originalUrl);
    });
  }
});
