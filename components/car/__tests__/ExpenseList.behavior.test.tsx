import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpenseList from '@/components/car/ExpenseList';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ExpenseList behavior', () => {
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
          },
        })
      ),
      http.delete('/api/vehicles/:vehicleId/expenses/:expenseId', () =>
        HttpResponse.json({ data: { id: 'e1' } }, { status: 200 })
      )
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<ExpenseList vehicleId="vid" />);
    const delBtn = await screen.findByRole('button', { name: /delete/i });
    fireEvent.click(delBtn);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });
});
