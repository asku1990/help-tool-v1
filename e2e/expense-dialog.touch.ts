import { expect, test } from '@playwright/test';
import { computeVehicleSummary } from '../lib/consumption';

for (const width of [390, 1280]) {
  test(`expense tasks stay in a single scrollable dialog at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    const expense = { id: 'e1', category: 'OTHER', date: '2026-11-17', amount: 84 };
    const filename = `${'service-receipt-'.repeat(12)}.pdf`;
    const responses: Record<string, unknown> = {
      '/api/auth/session': {
        user: { name: 'Browser Test', email: 'test@example.test' },
        expires: '2099-01-01',
      },
      '/api/admin/me': { data: { isAdmin: false } },
      '/api/vehicles/v1': { data: { vehicle: { id: 'v1', name: 'Car A', canWrite: true } } },
      '/api/vehicles/v1/summary': { data: computeVehicleSummary([], []) },
      '/api/vehicles/v1/fillups': { data: { fillUps: [], nextCursor: null } },
      '/api/vehicles/v1/expenses': {
        data: { expenses: [expense], expensesTotal: 84, nextCursor: null, canWrite: true },
      },
      '/api/vehicles/v1/expenses/e1/attachments': {
        data: {
          attachments: [{ id: 'a1', filename }],
          maxAttachments: 10,
          remainingCapacity: 9,
          canUpload: true,
        },
      },
      '/api/vehicles/v1/tires': { data: { tireSets: [] } },
      '/api/vehicles/v1/tires/change-log': { data: { history: [] } },
    };
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      return Object.hasOwn(responses, path)
        ? route.fulfill({ json: responses[path] })
        : route.abort();
    });
    await page.goto('/car/v1');
    const trigger = page.getByRole('button', { name: /View expense details/ });
    await trigger.tap();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Manage files' }).tap();
    await expect(dialog.getByRole('button', { name: 'Upload file' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: `Open ${filename} in a new tab` })).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Done' }).tap();
    await dialog.getByRole('button', { name: 'Edit details' }).tap();
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByLabel('Amount')).toHaveValue('84');
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog.getByRole('button', { name: 'Edit details' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().tap();
    await expect(trigger).toBeFocused();
  });
}
