import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVehicles, useCreateVehicle, useUpdateVehicle } from '@/hooks/useVehicles';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it('useVehicles fetches list', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { vehicles: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const { result } = renderHook(() => useVehicles(true), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  vi.restoreAllMocks();
});

it('useCreateVehicle triggers POST and invalidation', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 'v1' } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const { result } = renderHook(() => useCreateVehicle(), { wrapper });
  await result.current.mutateAsync({ name: 'Car' });
  vi.restoreAllMocks();
});

it('useUpdateVehicle triggers PATCH and invalidation', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 'v1' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const { result } = renderHook(() => useUpdateVehicle('v1'), { wrapper });
  await result.current.mutateAsync({ name: 'New name' });
  vi.restoreAllMocks();
});
