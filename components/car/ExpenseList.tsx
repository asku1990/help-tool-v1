'use client';

import { useMemo } from 'react';
import { useInfiniteExpenses } from '@/hooks';

export default function ExpenseList({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteExpenses(vehicleId, 5);

  const items = useMemo(() => (data?.pages || []).flatMap(p => p.expenses), [data]);
  const total = useMemo(() => items.reduce((s, e) => s + e.amount, 0), [items]);

  if (isLoading) return <div className="text-sm text-gray-500">Loading expenses…</div>;
  if (isError) return <div className="text-sm text-red-600">{String(error)}</div>;
  if (!items.length) return <div className="text-sm text-gray-500">No expenses yet.</div>;

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total: {formatCurrency(total)}</div>
      <ul className="divide-y">
        {items.map(e => (
          <li key={e.id} className="py-3 grid gap-2 sm:grid-cols-4 sm:items-center">
            <div className="text-sm">{formatDate(e.date)}</div>
            <div className="text-sm">
              <span className="inline-block rounded px-2 py-0.5 bg-gray-100 text-gray-700 text-xs">
                {e.category}
              </span>
              {e.vendor ? <span className="text-gray-600 text-xs ml-2">{e.vendor}</span> : null}
            </div>
            <div className="text-sm text-gray-600">
              {e.odometerKm ? `Odo: ${e.odometerKm} km` : ''}
            </div>
            <div className="text-sm font-medium sm:text-right">{formatCurrency(e.amount)}</div>
            {e.notes ? <div className="text-xs text-gray-500 sm:col-span-4">{e.notes}</div> : null}
          </li>
        ))}
      </ul>
      {hasNextPage ? (
        <div className="pt-3">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="text-sm px-3 py-2 rounded border"
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}
