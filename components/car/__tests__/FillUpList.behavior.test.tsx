import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FillUpList from '@/components/car/FillUpList';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('FillUpList behavior', () => {
  it('renders non-empty list and total fuel cost', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/fillups', () =>
        HttpResponse.json({
          data: {
            fillUps: [
              {
                id: 'f1',
                date: new Date().toISOString(),
                odometerKm: 1000,
                liters: 20,
                pricePerLiter: 1.5,
                totalCost: 30,
                isFull: true,
              },
            ],
            nextCursor: null,
          },
        })
      )
    );
    renderWithProviders(<FillUpList vehicleId="vid" />);
    expect(await screen.findByText(/Total fuel cost/i)).toBeInTheDocument();
  });

  it('handles error and retry', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/fillups', () => HttpResponse.json({}, { status: 500 }))
    );
    renderWithProviders(<FillUpList vehicleId="vid" />);
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
  });
});
