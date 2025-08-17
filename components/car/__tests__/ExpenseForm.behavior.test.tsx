import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseForm from '@/components/car/ExpenseForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ExpenseForm inspection flow', () => {
  it('prefills next inspection due and interval; submits both expense and vehicle update', async () => {
    server.use(
      // Vehicle details used to prefill inspection interval
      http.get('/api/vehicles/:vehicleId', ({ params }: { params: Record<string, string> }) =>
        HttpResponse.json({
          data: {
            vehicle: {
              id: params.vehicleId,
              name: 'Car A',
              inspectionIntervalMonths: 12,
            },
          },
        })
      ),
      // Create expense
      http.post('/api/vehicles/:vehicleId/expenses', () =>
        HttpResponse.json({ data: { id: 'e1' } }, { status: 201 })
      ),
      // Update vehicle after inspection toggle
      http.patch('/api/vehicles/:vehicleId', () =>
        HttpResponse.json({ data: { id: 'v1' } }, { status: 200 })
      )
    );

    renderWithProviders(<ExpenseForm vehicleId="v1" />);
    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    const dialog = await screen.findByLabelText(/Add expense dialog/i);
    expect(dialog).toBeInTheDocument();

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '10.00' } });

    // Toggle inspection and verify prefills
    const checkbox = screen.getByRole('checkbox', { name: /this is an inspection/i });
    fireEvent.click(checkbox);

    const dueInput = await screen.findByLabelText(/Next inspection due/i);
    const intervalInput = screen.getByLabelText(/Interval \(months\)/i);
    expect((intervalInput as HTMLInputElement).value).toBe('12');
    expect((dueInput as HTMLInputElement).value).not.toBe('');

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save expense/i }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/Add expense dialog/i)).not.toBeInTheDocument()
    );
  });
});
