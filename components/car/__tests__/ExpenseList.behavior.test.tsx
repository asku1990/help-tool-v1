import React from 'react';
import { act, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpenseList from '@/components/car/ExpenseList';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { expenseKeys } from '@/queries/keys';

function renderWithProviders(
  ui: React.ReactElement,
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
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

  it.each([
    { outcome: 'success', scenario: 'successful refresh' },
    { outcome: 'error', scenario: 'failed refresh and retry' },
    { outcome: 'offline', scenario: 'refresh paused by a connection drop' },
  ])('reopens with the saved amount after a $scenario', async ({ outcome }) => {
    const expense = { id: 'e1', date: '2026-11-17', category: 'MAINTENANCE', amount: 10 };
    const queryKey = expenseKeys.infiniteByVehicle('vid');
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: outcome === 'offline' ? 1 : false, retryDelay: 0 } },
    });
    let saved = false;
    const patch = vi.fn();
    const refresh = vi.fn();
    let finishRefresh!: () => void;
    const pendingRefresh = new Promise<void>(resolve => {
      finishRefresh = resolve;
    });
    server.use(
      http.get('/api/vehicles/vid/expenses', async () => {
        if (saved) {
          refresh();
          await pendingRefresh;
          if (refresh.mock.calls.length === 1) {
            if (outcome === 'offline') return HttpResponse.error();
            if (outcome === 'error') return HttpResponse.json({}, { status: 500 });
          }
        }
        return HttpResponse.json({
          data: {
            expenses: [{ ...expense, amount: saved ? 12.35 : expense.amount }],
            expensesTotal: saved ? 12.35 : expense.amount,
            nextCursor: 'e1',
            canWrite: true,
          },
        });
      }),
      http.patch('/api/vehicles/vid/expenses/e1', () => {
        patch();
        saved = true;
        return HttpResponse.json({ data: { id: expense.id } });
      }),
      http.get('/api/vehicles/vid/expenses/e1/attachments', () =>
        HttpResponse.json({
          data: { attachments: [], maxAttachments: 5, remainingCapacity: 5, canUpload: true },
        })
      )
    );

    renderWithProviders(<ExpenseList vehicleId="vid" />, qc);
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    try {
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /actions for/ }));
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled();

      if (outcome === 'offline') {
        act(() => onlineManager.setOnline(false));
        finishRefresh();
        await waitFor(() => expect(qc.getQueryState(queryKey)?.fetchStatus).toBe('paused'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
      }
    } finally {
      finishRefresh();
      act(() => onlineManager.setOnline(true));
    }
    if (outcome === 'error') {
      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
      fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Amount')).toHaveValue('12.35');
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('keeps a second draft when a later refresh removes its row', async () => {
    const expense = { id: 'e1', date: '2026-11-17', category: 'MAINTENANCE', amount: 10 };
    const otherExpenses = Array.from({ length: 5 }, (_, index) => ({
      ...expense,
      id: `other-${index}`,
      date: '2026-11-16',
      category: 'FUEL',
    }));
    let loadedExpenses = [expense, ...otherExpenses.slice(0, 4)];
    server.use(
      http.get('/api/vehicles/vid/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: loadedExpenses,
            expensesTotal: 60,
            nextCursor: loadedExpenses[4].id,
            canWrite: true,
          },
        })
      ),
      http.patch('/api/vehicles/vid/expenses/e1', () =>
        HttpResponse.json({ data: { id: expense.id } })
      ),
      http.get('/api/vehicles/vid/expenses/e1/attachments', () =>
        HttpResponse.json({
          data: { attachments: [], maxAttachments: 5, remainingCapacity: 5, canUpload: true },
        })
      )
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderWithProviders(<ExpenseList vehicleId="vid" />, qc);
    const row = (await screen.findByText('MAINTENANCE')).closest('li')!;
    const openEdit = () => {
      fireEvent.click(within(row).getByRole('button', { name: /actions for/ }));
      fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    };
    openEdit();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'First edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(qc.getQueryState(expenseKeys.infiniteByVehicle('vid'))?.fetchStatus).toBe('idle')
    );

    openEdit();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Second unsaved edit' } });
    loadedExpenses = otherExpenses;
    await act(() => qc.invalidateQueries({ queryKey: expenseKeys.infiniteByVehicle('vid') }));
    await waitFor(() => expect(row).not.toBeInTheDocument());
    expect(screen.getByLabelText('Notes')).toHaveValue('Second unsaved edit');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
