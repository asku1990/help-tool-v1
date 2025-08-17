import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FillUpForm from '@/components/car/FillUpForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('FillUpForm', () => {
  it('opens dialog and submits successfully', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/fillups', () =>
        HttpResponse.json({ data: { fillUps: [], nextCursor: null } })
      ),
      http.post('/api/vehicles/:vehicleId/fillups', () =>
        HttpResponse.json({ data: { id: 'f1' } }, { status: 201 })
      )
    );

    renderWithProviders(<FillUpForm vehicleId="vid" />);
    fireEvent.click(screen.getByRole('button', { name: /add fill-up/i }));
    const dialog = await screen.findByLabelText(/Add fill-up dialog/i);
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Odometer km/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/Liters/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Price per liter/i), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /save fill-up/i }));

    await waitFor(() =>
      expect(screen.queryByLabelText(/Add fill-up dialog/i)).not.toBeInTheDocument()
    );
  });
});
