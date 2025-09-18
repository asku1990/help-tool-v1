import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ImportFillUpsDialog from '@/components/car/fillups/ImportFillUpsDialog';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ImportFillUpsDialog', () => {
  it('parses headerless CSV and imports', async () => {
    server.use(
      http.post('/api/vehicles/:vehicleId/fillups', () =>
        HttpResponse.json({ data: { id: 'f1' } }, { status: 201 })
      )
    );

    renderWithProviders(<ImportFillUpsDialog vehicleId="vid" />);
    fireEvent.click(screen.getByRole('button', { name: /import csv/i }));

    const textarea = await screen.findByPlaceholderText(/Paste semicolon-delimited CSV/i);
    fireEvent.change(textarea, {
      target: { value: '01.01.2024;12500;40,5;1,999;80,97;1;Note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse/i }));
    await screen.findByText(/Ready to import: 1/);

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/Import fill-ups CSV/i)).not.toBeInTheDocument()
    );
  });

  it('parses headered CSV and allows editing before import', async () => {
    server.use(
      http.post('/api/vehicles/:vehicleId/fillups', () =>
        HttpResponse.json({ data: { id: 'f1' } }, { status: 201 })
      )
    );

    renderWithProviders(<ImportFillUpsDialog vehicleId="vid" />);
    fireEvent.click(screen.getByRole('button', { name: /import csv/i }));

    const textarea = await screen.findByPlaceholderText(/Paste semicolon-delimited CSV/i);
    fireEvent.change(textarea, {
      target: {
        value: [
          'Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes',
          '2024-02-01;15000;40,5;1,999;80,97;yes;First',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse/i }));
    await screen.findByText(/Ready to import: 1/);

    const litersInput = screen
      .getAllByRole('textbox')
      .find(el => el.getAttribute('class')?.includes('w-24'))!;
    fireEvent.change(litersInput, { target: { value: '41.0' } });
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/Import fill-ups CSV/i)).not.toBeInTheDocument()
    );
  });
});
