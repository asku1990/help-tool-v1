import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useExpenses, useCreateExpense, useImportExpenses } from '@/hooks/useExpenses';
import * as expensesQueries from '@/queries/expenses';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it('useExpenses fetches data', async () => {
  const { result } = renderHook(() => useExpenses('vid'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.expensesTotal).toBe(85);
});

it('useCreateExpense optimistic update does not throw', async () => {
  // Ensure network call resolves successfully in Node without server
  const mock = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 'ok' } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const { result } = renderHook(() => useCreateExpense('vid'), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      date: new Date().toISOString(),
      category: 'MAINTENANCE',
      amount: 10,
    });
  });
  mock.mockRestore();
});

it('useImportExpenses forwards oil consumption to createExpense', async () => {
  const createMock = vi
    .spyOn(expensesQueries, 'createExpense')
    .mockResolvedValue({ id: 'imported' });
  const { result } = renderHook(() => useImportExpenses('vid'), { wrapper });

  await act(async () => {
    await result.current.mutateAsync([
      {
        date: '2024-01-01',
        amount: 20,
        oilConsumption: 3.5,
      },
    ]);
  });

  expect(createMock).toHaveBeenCalledWith('vid', expect.objectContaining({ oilConsumption: 3.5 }));

  createMock.mockRestore();
});
