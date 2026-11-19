import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByRole('columnheader', { name: 'Fuel purchase' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trip / consumption' })).toBeInTheDocument();
    expect(badge).toHaveTextContent(`${consumption.toFixed(2)} L/100km`);
    expect(badge).toHaveClass(color, 'font-semibold');
    expect(screen.getByText('Trip 100 km')).toBeVisible();
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

  it.each([
    { removed: false, scenario: 'refreshes inputs and completed-trip figures together' },
    { removed: true, scenario: 'keeps focus on the list when the saved row disappears' },
  ])('$scenario', async ({ removed }) => {
    const fillUp = {
      id: 'f1',
      date: '2026-11-17',
      odometerKm: 1000,
      liters: 5,
      pricePerLiter: 1.5,
      totalCost: 7.5,
      isFull: true,
      segment: { distanceKm: 100, litersUsed: 5, lPer100: 5, fuelCost: 7.5, costPer100: 7.5 },
    };
    let saved = false;
    const save = vi.fn();
    const refresh = vi.fn();
    let finishRefresh!: () => void;
    const pendingRefresh = new Promise<void>(resolve => {
      finishRefresh = resolve;
    });
    server.use(
      http.get('/api/vehicles/vid/fillups', async () => {
        if (saved) {
          refresh();
          await pendingRefresh;
        }
        return HttpResponse.json({
          data: {
            fillUps:
              saved && removed
                ? []
                : [
                    saved
                      ? {
                          ...fillUp,
                          liters: 8,
                          totalCost: 12,
                          segment: {
                            ...fillUp.segment,
                            litersUsed: 8,
                            lPer100: 8,
                            fuelCost: 12,
                            costPer100: 12,
                          },
                        }
                      : fillUp,
                  ],
            nextCursor: null,
            canWrite: true,
          },
        });
      }),
      http.patch('/api/vehicles/vid/fillups/f1', async ({ request }: { request: Request }) => {
        save(await request.json());
        saved = true;
        return HttpResponse.json({ data: { id: fillUp.id } });
      }),
      http.get('/api/vehicles/vid/fillups/f1/attachments', () =>
        HttpResponse.json({
          data: { attachments: [], maxAttachments: 5, remainingCapacity: 5, canUpload: true },
        })
      )
    );

    renderWithProviders(<FillUpList vehicleId="vid" />);
    const list = (await screen.findByRole('table', { name: 'Fill-up records' })).closest(
      '[tabindex="-1"]'
    )!;
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Price per liter'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Odometer km'), { target: { value: '1e3' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Liters'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Odometer km'), { target: { value: '2147483647' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Odometer km'), { target: { value: '2147483648' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Odometer km'), { target: { value: '1000.5' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Odometer km'), { target: { value: '1e3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    try {
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.getByText(/5 L @/)).toBeInTheDocument();
      expect(screen.getByText('5.00 L/100km')).toBeInTheDocument();
      expect(screen.queryByText(/8 L @/)).not.toBeInTheDocument();
      if (removed) await waitFor(() => expect(list).toHaveFocus());
    } finally {
      finishRefresh();
    }
    if (removed) {
      expect(await screen.findByText(/No fill-ups yet/)).toBeInTheDocument();
      expect(list).toHaveFocus();
    } else {
      expect(await screen.findByText(/8 L @/)).toBeInTheDocument();
      expect(screen.getByText('8.00 L/100km')).toBeInTheDocument();
    }
    expect(save).toHaveBeenCalledExactlyOnceWith({ liters: 8 });
  });
});
