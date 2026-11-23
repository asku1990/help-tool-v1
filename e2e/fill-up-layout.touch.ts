import { expect, test } from '@playwright/test';
import { computeVehicleSummary } from '../lib/consumption';

test.use({ isMobile: false, locale: 'en-US', viewport: { width: 1600, height: 900 } });

test('keeps fill-up and expense figures readable as the lists narrow', async ({ page }) => {
  const vehicle = { id: 'v1', name: 'Car A', canEdit: true, canWrite: true };
  const fillUp = {
    id: 'f1',
    date: '2026-11-23',
    odometerKm: 200017,
    liters: 16.14,
    pricePerLiter: 1.35,
    totalCost: 21.79,
    isFull: true,
    notes: 'Long station note '.repeat(35),
    segment: {
      distanceKm: 549,
      litersUsed: 22.07,
      lPer100: 4.02,
      fuelCost: 29.8,
      costPer100: 5.43,
      prevLPer100: 3.43,
    },
  };
  const expense = {
    id: 'e1',
    date: fillUp.date,
    category: 'OIL_TOP_UP',
    odometerKm: 2147483647,
    oilConsumption: 123.4,
    vendor: 'Long workshop name that needs more room than one line',
    notes: 'Long repair note '.repeat(35),
    amount: 99999999.99,
  };
  const responses: Record<string, unknown> = {
    '/api/auth/session': {
      user: { name: 'Browser Test', email: 'browser-test@example.test' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    '/api/admin/me': { data: { isAdmin: false } },
    '/api/vehicles/v1': { data: { vehicle } },
    '/api/vehicles/v1/summary': { data: computeVehicleSummary([], []) },
    '/api/vehicles/v1/fillups': {
      data: {
        fillUps: [fillUp, { ...fillUp, id: 'f2', totalCost: 1234.56, odometerKm: 199468 }],
        nextCursor: null,
        canWrite: true,
      },
    },
    '/api/vehicles/v1/expenses': {
      data: {
        expenses: [expense],
        expensesTotal: expense.amount,
        nextCursor: null,
        canWrite: true,
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
  const table = page.getByRole('table', { name: 'Fill-up records' });
  const headers = table.getByRole('columnheader', { name: 'Fuel purchase' });
  const expenseTable = page.getByRole('table', { name: 'Expense records' });
  const expenseHeader = expenseTable.getByRole('columnheader', { name: 'Amount' });

  await expect(table).toBeVisible({ timeout: 20_000 });
  await expect(expenseTable).toBeVisible({ timeout: 20_000 });

  for (const { width, desktop } of [
    { width: undefined, desktop: true },
    { width: 900, desktop: true },
    { width: 890, desktop: false },
    { width: 320, desktop: false },
  ]) {
    await test.step(`reads key values at ${width ?? 'full'} list width`, async () => {
      if (width !== undefined) {
        await table.evaluate((element, listWidth) => {
          element.parentElement!.style.width = `${listWidth}px`;
        }, width);
      }
      if (desktop) await expect(headers).toBeVisible();
      else await expect(headers).toBeHidden();

      for (const text of ['200017 km', 'Trip 549 km', 'Δ +0.59']) {
        await expect(
          table.getByText(text, { exact: true }).filter({ visible: true }).first()
        ).toBeVisible();
      }
      const badge = table.getByTitle('Higher than previous trip').first();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('4.02 L/100km');
      for (const text of ['€21.79', '€1,234.56']) {
        const total = table.getByText(text, { exact: true });
        await expect(total).toBeVisible();
        expect(
          await total.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const textBounds = range.getBoundingClientRect();
            let ancestor = element.parentElement;
            while (ancestor && ancestor.tagName !== 'TABLE') {
              if (getComputedStyle(ancestor).overflowX !== 'visible') {
                const bounds = ancestor.getBoundingClientRect();
                if (textBounds.left < bounds.left || textBounds.right > bounds.right) return false;
              }
              ancestor = ancestor.parentElement;
            }
            return !!ancestor && textBounds.right <= ancestor.getBoundingClientRect().right;
          })
        ).toBe(true);
      }
      expect(await table.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(
        await table.evaluate(element => element.parentElement!.clientWidth)
      );

      if (width !== undefined) {
        await expenseTable.evaluate((element, listWidth) => {
          element.parentElement!.style.width = `${listWidth}px`;
        }, width);
      }
      if (desktop) await expect(expenseHeader).toBeVisible();
      else await expect(expenseHeader).toBeHidden();

      for (const text of ['2147483647 km', '123.4 L/10k', expense.vendor]) {
        await expect(
          expenseTable.getByText(text, { exact: true }).filter({ visible: true })
        ).toBeVisible();
      }
      await expect(expenseTable.getByText(/OIL TOP UP$/)).toBeVisible();
      const amount = expenseTable.getByRole('cell', { name: '€99,999,999.99', exact: true });
      await expect(amount).toBeVisible();
      if (desktop) await expect(amount).toHaveCSS('text-align', 'right');
      expect(
        await amount.evaluate(cell => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const text = range.getBoundingClientRect();
          const bounds = cell.getBoundingClientRect();
          return text.left >= bounds.left && text.right <= bounds.right;
        })
      ).toBe(true);
      expect(await expenseTable.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(
        await expenseTable.evaluate(element => element.parentElement!.clientWidth)
      );
    });
  }
});
