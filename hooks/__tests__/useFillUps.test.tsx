import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFillUps,
  useInfiniteFillUps,
  useCreateFillUp,
  useUpdateFillUp,
  useDeleteFillUp,
} from '@/hooks/useFillUps';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it('useFillUps loads data', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { fillUps: [], nextCursor: null } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const { result } = renderHook(() => useFillUps('vid'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  vi.restoreAllMocks();
});

it('useInfiniteFillUps paginates', async () => {
  const mock = vi.spyOn(global, 'fetch');
  mock
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { fillUps: [{ id: '1' }], nextCursor: '2' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { fillUps: [{ id: '2' }], nextCursor: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  const { result } = renderHook(() => useInfiniteFillUps('vid', 1), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  mock.mockRestore();
});

it('mutations: create, update, delete resolve without error', async () => {
  const mock = vi.spyOn(global, 'fetch');
  mock
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'f1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'f1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'f1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

  const create = renderHook(() => useCreateFillUp('v'), { wrapper }).result;
  const update = renderHook(() => useUpdateFillUp('v', 'f1'), { wrapper }).result;
  const del = renderHook(() => useDeleteFillUp('v', 'f1'), { wrapper }).result;

  await act(async () => {
    await create.current.mutateAsync({
      date: '2024-01-01',
      odometerKm: 1,
      liters: 1,
      pricePerLiter: 1,
      totalCost: 1,
      isFull: true,
    } as any);
    await update.current.mutateAsync({ liters: 2 });
    await del.current.mutateAsync();
  });
  mock.mockRestore();
});
