'use client';

import { useMemo, useState } from 'react';
import { useInfiniteFillUps, useUpdateFillUp, useDeleteFillUp } from '@/hooks';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { FillUpListSkeleton } from '@/components/car';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';

export default function FillUpList({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteFillUps(vehicleId, 5);

  const items = useMemo<FillUpWithSegmentDto[]>(
    () => (data?.pages || []).flatMap(p => p.fillUps),
    [data]
  );
  const totalFuelCost = useMemo(() => items.reduce((s, f) => s + f.totalCost, 0), [items]);

  if (isLoading) return <FillUpListSkeleton rows={4} />;
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
    <>
      <div className="space-y-2">
        <div className="text-xs text-gray-500">
          Total fuel cost: {formatCurrency(totalFuelCost)}
        </div>
        <ul className="divide-y">
          {items.map(f => (
            <li key={f.id} className="py-3 grid gap-2 sm:grid-cols-5 sm:items-center">
              <div className="text-sm">{formatDateFi(new Date(f.date))}</div>
              <div className="text-sm text-gray-600">Odo: {f.odometerKm} km</div>
              <div className="text-sm text-gray-600">
                {f.liters} L @ {f.pricePerLiter.toFixed(3)} →{' '}
                <span className="font-medium">{formatCurrency(f.totalCost)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {f.isFull ? 'Full tank' : 'Partial'}
                {f.notes ? ` • ${f.notes}` : ''}
                {f.isFull && f.segment ? (
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    Trip {f.segment.distanceKm.toFixed(0)} km • {f.segment.lPer100.toFixed(2)}{' '}
                    L/100km
                    {typeof f.segment.prevLPer100 === 'number' ? (
                      <>
                        {' '}
                        • <Delta now={f.segment.lPer100} prev={f.segment.prevLPer100} />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="sm:text-right flex gap-2 sm:justify-end">
                <EditFillUpButton
                  vehicleId={vehicleId}
                  item={{
                    id: f.id,
                    date: f.date,
                    odometerKm: f.odometerKm,
                    liters: f.liters,
                    pricePerLiter: f.pricePerLiter,
                    isFull: f.isFull,
                    notes: f.notes,
                  }}
                />
                <DeleteFillUpButton vehicleId={vehicleId} fillUpId={f.id} />
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
    </>
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev;
  const sign = diff === 0 ? '' : diff > 0 ? '+' : '−';
  const abs = Math.abs(diff).toFixed(2);
  const color = diff === 0 ? 'text-gray-600' : diff > 0 ? 'text-red-600' : 'text-green-600';
  return (
    <span className={color}>
      Δ {sign}
      {abs}
    </span>
  );
}

function EditFillUpButton({
  vehicleId,
  item,
}: {
  vehicleId: string;
  item: {
    id: string;
    date: string;
    odometerKm: number;
    liters: number;
    pricePerLiter: number;
    isFull: boolean;
    notes?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    date: item.date.slice(0, 10),
    odometerKm: String(item.odometerKm),
    liters: String(item.liters),
    pricePerLiter: item.pricePerLiter.toFixed(3),
    isFull: item.isFull,
    notes: item.notes || '',
  });
  const update = useUpdateFillUp(vehicleId, item.id);
  const total = (() => {
    const l = parseFloat((state.liters || '0').replace(',', '.'));
    const p = parseFloat((state.pricePerLiter || '0').replace(',', '.'));
    const t = l * p;
    return Number.isFinite(t) ? t.toFixed(2) : '0.00';
  })();
  return (
    <>
      <button
        type="button"
        className="text-xs px-2 py-1 rounded border"
        onClick={() => setOpen(true)}
      >
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-label="Edit fill-up">
          <DialogHeader>
            <DialogTitle>Edit fill-up</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              await update.mutateAsync({
                date: state.date,
                odometerKm: parseInt(state.odometerKm, 10),
                liters: parseFloat(state.liters.replace(',', '.')),
                pricePerLiter: parseFloat(state.pricePerLiter.replace(',', '.')),
                totalCost: parseFloat(total),
                isFull: state.isFull,
                notes: state.notes || undefined,
              });
              setOpen(false);
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm">Date</span>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2"
                  value={state.date}
                  onChange={e => setState(s => ({ ...s, date: e.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Odometer km</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="border rounded-md px-3 py-2"
                  value={state.odometerKm}
                  onChange={e => setState(s => ({ ...s, odometerKm: e.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Liters</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="border rounded-md px-3 py-2"
                  value={state.liters}
                  onChange={e => setState(s => ({ ...s, liters: e.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Price per liter</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  className="border rounded-md px-3 py-2"
                  value={state.pricePerLiter}
                  onChange={e => setState(s => ({ ...s, pricePerLiter: e.target.value }))}
                  required
                />
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`isFull-${item.id}`}
                  type="checkbox"
                  className="h-4 w-4"
                  checked={state.isFull}
                  onChange={e => setState(s => ({ ...s, isFull: e.target.checked }))}
                />
                <label htmlFor={`isFull-${item.id}`} className="text-sm">
                  Full tank?
                </label>
              </div>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-sm">Notes</span>
                <textarea
                  className="border rounded-md px-3 py-2"
                  rows={3}
                  value={state.notes}
                  onChange={e => setState(s => ({ ...s, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-gray-500">Total: {total}</div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteFillUpButton({ vehicleId, fillUpId }: { vehicleId: string; fillUpId: string }) {
  const del = useDeleteFillUp(vehicleId, fillUpId);
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded border"
      onClick={async () => {
        if (!confirm('Delete this fill-up?')) return;
        try {
          await del.mutateAsync();
        } catch {
          // If already deleted (404), ignore
        }
      }}
      disabled={del.isPending}
    >
      {del.isPending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
