import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInfiniteExpenses, useCreateExpense } from '@/hooks/useExpenses';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it('useInfiniteExpenses paginates with nextCursor', async () => {
  server.use(
    http.get('/api/vehicles/:vehicleId/expenses', ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      if (!cursor) {
        return HttpResponse.json({
          data: {
            expenses: [{ id: 'a', date: new Date().toISOString(), category: 'FUEL', amount: 1 }],
            expensesTotal: 1,
            nextCursor: 'a',
          },
        });
      }
      return HttpResponse.json({
        data: {
          expenses: [{ id: 'b', date: new Date().toISOString(), category: 'FUEL', amount: 2 }],
          expensesTotal: 3,
          nextCursor: null,
        },
      });
    })
  );
  const { result } = renderHook(() => useInfiniteExpenses('vid', 1), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.pages[0].expenses[0].id).toBe('a');
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data?.pages.length).toBe(2));
});

it('useCreateExpense optimistic update rolls back on error', async () => {
  server.use(
    http.post('/api/vehicles/:vehicleId/expenses', () => HttpResponse.json({}, { status: 500 }))
  );
  const { result } = renderHook(() => useCreateExpense('vid'), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({
        date: new Date().toISOString(),
        category: 'MAINTENANCE',
        amount: 10,
      })
    ).rejects.toBeTruthy();
  });
});
