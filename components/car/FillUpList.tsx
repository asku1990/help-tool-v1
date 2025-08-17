'use client';

import { useMemo } from 'react';
import { useInfiniteFillUps } from '@/hooks';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui';

export default function FillUpList({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteFillUps(vehicleId, 5);

  const items = useMemo(() => (data?.pages || []).flatMap(p => p.fillUps), [data]);
  const totalFuelCost = useMemo(() => items.reduce((s, f) => s + f.totalCost, 0), [items]);

  if (isLoading)
    return (
      <div className="space-y-2">
        <div className="h-4 bg-gray-100 rounded animate-pulse w-40" />
        <div className="h-4 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
      </div>
    );
  if (isError)
    return (
      <div className="text-sm text-red-600 flex items-center justify-between">
        <span>{String(error)}</span>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded border"
          onClick={() => fetchNextPage()}
        >
          Retry
        </button>
      </div>
    );
  if (!items.length)
    return (
      <div className="text-sm text-gray-600 flex items-center justify-between">
        <span>No fill-ups yet. Add your first to see real consumption and cost/km.</span>
        <EmptyCta />
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total fuel cost: {formatCurrency(totalFuelCost)}</div>
      <ul className="divide-y">
        {items.map(f => (
          <li key={f.id} className="py-3 grid gap-2 sm:grid-cols-4 sm:items-center">
            <div className="text-sm">{formatDate(f.date)}</div>
            <div className="text-sm text-gray-600">Odo: {f.odometerKm} km</div>
            <div className="text-sm text-gray-600">
              {f.liters} L @ {f.pricePerLiter.toFixed(3)} →{' '}
              <span className="font-medium">{formatCurrency(f.totalCost)}</span>
            </div>
            <div className="text-xs text-gray-500 sm:text-right">
              {f.isFull ? 'Full tank' : 'Partial'}
              {f.notes ? ` • ${f.notes}` : ''}
            </div>
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

function EmptyCta() {
  const { setFillUpDialogOpen } = useUiStore();
  return (
    <Button size="sm" onClick={() => setFillUpDialogOpen(true)}>
      Add fill-up
    </Button>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}
