import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVehicleSummary } from '../useVehicleSummary';
import { useCreateFillUp } from '@/hooks/useFillUps';
import { useDeleteExpense } from '@/hooks/useExpenses';
import { vehicleSummaryKeys } from '@/queries/keys';
import { computeVehicleSummary } from '@/lib/consumption';
import { getVehicleSummary } from '@/queries/vehicles';

vi.mock('@/queries/vehicles', () => ({ getVehicleSummary: vi.fn() }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.mocked(getVehicleSummary).mockReset();
});

describe('useVehicleSummary', () => {
  it('loads the complete summary through the vehicles query module', async () => {
    const summary = computeVehicleSummary([], []);
    vi.mocked(getVehicleSummary).mockResolvedValue(summary);
    const { wrapper } = setup();
    const { result } = renderHook(() => useVehicleSummary('v'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
    expect(getVehicleSummary).toHaveBeenCalledWith('v');
  });

  it('does not request a summary without a vehicle ID', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useVehicleSummary(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getVehicleSummary).not.toHaveBeenCalled();
  });

  it('invalidates the summary after adding fuel', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'f' } }), { status: 201 })
    );
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateFillUp('v'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        date: '2026-11-17',
        odometerKm: 100,
        liters: 5,
        pricePerLiter: 2,
        totalCost: 10,
        isFull: true,
      });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: vehicleSummaryKeys.byVehicle('v') });
  });

  it('invalidates the summary after deleting an expense', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteExpense('v', 'e'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: vehicleSummaryKeys.byVehicle('v') });
  });
});
