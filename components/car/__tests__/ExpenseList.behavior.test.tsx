import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpenseList from '@/components/car/ExpenseList';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ExpenseList behavior', () => {
  it.each([
    { label: 'missing metrics', metrics: {}, expected: [] },
    { label: 'zero odometer', metrics: { odometerKm: 0 }, expected: ['Odo: 0 km'] },
    { label: 'oil consumption only', metrics: { oilConsumption: 0 }, expected: ['0.0 L/10k'] },
  ])('avoids empty metric cells while preserving $label', async ({ metrics, expected }) => {
    server.use(
      http.get('/api/vehicles/:vehicleId/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: [
              {
                id: 'e1',
                date: '2026-11-17',
                category: 'MAINTENANCE',
                amount: 10,
                ...metrics,
              },
            ],
            expensesTotal: 10,
            nextCursor: null,
            canWrite: true,
          },
        })
      )
    );
    renderWithProviders(<ExpenseList vehicleId="vid" />);
    const row = await screen.findByRole('listitem');
    for (const cell of Array.from(row.children)) {
      if (cell.tagName === 'DIV') expect(cell).not.toBeEmptyDOMElement();
    }
    for (const value of expected) expect(within(row).getByText(value)).toBeInTheDocument();
    expect(within(row).getByText(/10[.,]00/)).toHaveClass('sm:col-start-4');
  });

  it('renders non-empty list and total', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: [
              { id: 'e1', date: new Date().toISOString(), category: 'MAINTENANCE', amount: 10 },
              { id: 'e2', date: new Date().toISOString(), category: 'FUEL', amount: 5.5 },
            ],
            expensesTotal: 15.5,
            nextCursor: null,
            canWrite: true,
          },
        })
      )
    );
    renderWithProviders(<ExpenseList vehicleId="vid" />);
    expect(await screen.findByText(/Total:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/MAINTENANCE|FUEL/).length).toBeGreaterThan(0);
  });

  it('shows error state and allows retry', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/expenses', () => HttpResponse.json({}, { status: 500 }))
    );
    renderWithProviders(<ExpenseList vehicleId="vid" />);
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
  });

  it('deletes an expense when confirmed', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: [
              { id: 'e1', date: new Date().toISOString(), category: 'MAINTENANCE', amount: 10 },
            ],
            expensesTotal: 10,
            nextCursor: null,
            canWrite: true,
          },
        })
      ),
      http.delete('/api/vehicles/:vehicleId/expenses/:expenseId', () =>
        HttpResponse.json({ data: { id: 'e1' } }, { status: 200 })
      )
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<ExpenseList vehicleId="vid" />);
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    const delBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(delBtn);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  it('opens the edit expense dialog', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: [
              { id: 'e1', date: new Date().toISOString(), category: 'MAINTENANCE', amount: 10 },
            ],
            expensesTotal: 10,
            nextCursor: null,
            canWrite: true,
          },
        })
      )
    );

    renderWithProviders(<ExpenseList vehicleId="vid" />);
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);
    expect(await screen.findByLabelText(/edit expense/i)).toBeInTheDocument();
  });
});
