import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExpenses, useCreateExpense } from '@/hooks/useExpenses';

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
    } as any);
  });
  mock.mockRestore();
});
