import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExpensesDialog from '@/components/car/ImportExpensesDialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ImportExpensesDialog', () => {
  it('parses pasted CSV and imports', async () => {
    server.use(
      http.post('/api/vehicles/:vehicleId/expenses', () =>
        HttpResponse.json({ data: { id: 'x' } }, { status: 201 })
      )
    );
    renderWithProviders(<ImportExpensesDialog vehicleId="vid" />);
    fireEvent.click(screen.getByRole('button', { name: /import csv/i }));
    const dialog = await screen.findByLabelText(/Import expenses CSV/i);
    expect(dialog).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Paste semicolon-delimited CSV/i);
    fireEvent.change(textarea, {
      target: {
        value: '01.01.2024;1200;12,34;Oil change\n02.01.2024;1300;8,00;Car wash',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse/i }));
    await screen.findByText(/Ready to import: 2/);
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/Import expenses CSV/i)).not.toBeInTheDocument()
    );
  });
});
