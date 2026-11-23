import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tireKeys } from '@/queries/keys';
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from '@/hooks/useVehicles';

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

it('useDeleteVehicle removes only the deleted vehicle’s cached tire data', async () => {
  const request = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 'v1' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const client = new QueryClient();
  for (const id of ['v1', 'v2']) {
    client.setQueryData(tireKeys.sets(id), { tireSets: [] });
    client.setQueryData(tireKeys.history(id), { history: [] });
  }
  const { result } = renderHook(() => useDeleteVehicle('v1'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await result.current.mutateAsync();
  expect(request).toHaveBeenCalledWith(
    '/api/vehicles/v1',
    expect.objectContaining({ method: 'DELETE' })
  );
  expect(client.getQueryData(tireKeys.sets('v1'))).toBeUndefined();
  expect(client.getQueryData(tireKeys.history('v1'))).toBeUndefined();
  expect(client.getQueryData(tireKeys.sets('v2'))).toEqual({ tireSets: [] });
  expect(client.getQueryData(tireKeys.history('v2'))).toEqual({ history: [] });
  vi.restoreAllMocks();
});
