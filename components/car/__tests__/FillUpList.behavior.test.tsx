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
  it.each([
    { consumption: 4, previous: 5, comparison: 'Lower than previous trip', color: 'bg-green-50' },
    { consumption: 6, previous: 5, comparison: 'Higher than previous trip', color: 'bg-red-50' },
    { consumption: 5, previous: 5, comparison: 'Same as previous trip', color: 'bg-gray-100' },
    {
      consumption: 5,
      previous: undefined,
      comparison: 'No previous trip to compare',
      color: 'bg-gray-100',
    },
  ])('colors consumption: $comparison', async ({ consumption, previous, comparison, color }) => {
    server.use(
      http.get('/api/vehicles/:vehicleId/fillups', () =>
        HttpResponse.json({
          data: {
            fillUps: [
              {
                id: 'f1',
                date: '2026-11-17',
                odometerKm: 1000,
                liters: consumption,
                pricePerLiter: 1.5,
                totalCost: consumption * 1.5,
                isFull: true,
                segment: {
                  distanceKm: 100,
                  litersUsed: consumption,
                  lPer100: consumption,
                  fuelCost: consumption * 1.5,
                  costPer100: consumption * 1.5,
                  prevLPer100: previous,
                },
              },
            ],
            nextCursor: null,
            canWrite: true,
          },
        })
      )
    );
    renderWithProviders(<FillUpList vehicleId="vid" />);
    const badge = await screen.findByTitle(comparison);
    expect(badge).toHaveTextContent(`${consumption.toFixed(2)} L/100km`);
    expect(badge).toHaveClass(color, 'font-semibold');
    if (previous !== undefined && consumption !== previous) {
      const expectedDelta = consumption < previous ? /Δ −1.00/ : /Δ \+1.00/;
      expect(screen.getByText(expectedDelta)).toBeInTheDocument();
    }
  });

  it('labels the fuel subtotal as loaded records rather than a lifetime total', async () => {
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
            canWrite: true,
          },
        })
      )
    );
    renderWithProviders(<FillUpList vehicleId="vid" />);
    expect(await screen.findByText(/Fuel cost — loaded records/i)).toHaveTextContent(/30[.,]00/);
  });

  it('handles error and retry', async () => {
    server.use(
      http.get('/api/vehicles/:vehicleId/fillups', () => HttpResponse.json({}, { status: 500 }))
    );
    renderWithProviders(<FillUpList vehicleId="vid" />);
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
  });

  it('opens the edit fill-up dialog', async () => {
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
            canWrite: true,
          },
        })
      )
    );

    renderWithProviders(<FillUpList vehicleId="vid" />);
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);
    expect(await screen.findByLabelText(/edit fill-up/i)).toBeInTheDocument();
  });
});
