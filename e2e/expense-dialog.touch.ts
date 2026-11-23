import { expect, test } from '@playwright/test';
import { computeVehicleSummary } from '../lib/consumption';

for (const width of [320, 402, 1280]) {
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
      '/api/vehicles/v1': {
        data: { vehicle: { id: 'v1', name: 'Car A', canWrite: true, canEdit: true } },
      },
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
    const checkTaskLayout = async () => {
      if (width < 640) {
        await expect(dialog).toHaveCSS('width', `${width}px`);
        await expect(dialog).toHaveCSS('height', '760px');
        await expect(dialog).toHaveCSS('box-shadow', 'none');
      } else {
        await expect(dialog).toHaveCSS('border-top-left-radius', '10px');
      }
    };
    await checkTaskLayout();
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

    await page.getByRole('button', { name: 'Add fill-up', exact: true }).first().tap();
    await checkTaskLayout();
    await dialog.getByLabel('Liters').tap();
    await expect(dialog.getByLabel('Liters')).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).tap();

    const more = page.getByRole('button', { name: 'More vehicle actions' });
    await more.tap();
    await page.getByRole('button', { name: 'Import backup', exact: true }).tap();
    await checkTaskLayout();
    const tireRows = Array.from({ length: 30 }, (_, i) => `ts${i};Tire ${i};SUMMER;STORED`);
    await dialog
      .getByLabel('Or paste CSV content')
      .fill(['[TIRE_SETS]', 'Id;Name;Type;Status', ...tireRows].join('\n'));
    await dialog.getByRole('button', { name: 'Parse', exact: true }).tap();
    await expect(dialog.getByRole('row', { name: /Tire 29/ })).toBeAttached();
    await dialog.getByRole('row', { name: /Tire 29/ }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('row', { name: /Tire 29/ })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Cancel' }).tap();

    await more.tap();
    await page.getByRole('button', { name: 'Delete vehicle', exact: true }).tap();
    await expect(dialog).toHaveCSS('border-top-left-radius', '10px');
    expect((await dialog.boundingBox())?.width).toBeLessThan(width);
  });
}
