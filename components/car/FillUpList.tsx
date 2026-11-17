'use client';

import { useMemo, useRef, useState } from 'react';
import { useInfiniteFillUps, useUpdateFillUp, useDeleteFillUp } from '@/hooks';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { FillUpListSkeleton } from '@/components/car';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import RecordAttachments from './attachments/RecordAttachments';
import { RecordActions, RecordDetailsButton } from './records';

export default function FillUpList({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteFillUps(vehicleId, 5);

  const items = useMemo<FillUpWithSegmentDto[]>(
    () => (data?.pages || []).flatMap(p => p.fillUps),
    [data]
  );
  const totalFuelCost = useMemo(() => items.reduce((s, f) => s + f.totalCost, 0), [items]);
  const canWrite = data?.pages[0]?.canWrite === true;

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
        {canWrite ? <EmptyCta /> : null}
      </div>
    );

  return (
    <>
      <div className="space-y-2">
        <div className="text-xs text-gray-500">
          Fuel cost — loaded records: {formatCurrency(totalFuelCost)}
        </div>
        <ul className="divide-y">
          {items.map(f => (
            <li
              key={f.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 sm:grid-cols-5 sm:items-center"
            >
              <RecordDetailsButton vehicleId={vehicleId} type="fillup" item={f} />
              <div className="col-start-1 text-sm text-gray-600 sm:col-start-auto">
                {f.liters} L @ {f.pricePerLiter.toFixed(3)} →{' '}
                <span className="font-medium">{formatCurrency(f.totalCost)}</span>
              </div>
              <div className="col-start-1 text-xs text-gray-500 sm:col-start-auto">
                {f.isFull ? 'Full tank' : 'Partial'}
                {f.notes ? ` • ${f.notes}` : ''}
                {f.isFull && f.segment ? (
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    Trip {f.segment.distanceKm.toFixed(0)} km •{' '}
                    <ConsumptionRate value={f.segment.lPer100} previous={f.segment.prevLPer100} />
                    {typeof f.segment.prevLPer100 === 'number' ? (
                      <>
                        {' '}
                        • <Delta now={f.segment.lPer100} prev={f.segment.prevLPer100} />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <RecordActions label={`Fill-up actions for ${formatDateFi(new Date(f.date))}`}>
                <RecordDetailsButton vehicleId={vehicleId} type="fillup" item={f} variant="menu" />
                {canWrite ? (
                  <>
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
                  </>
                ) : null}
              </RecordActions>
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

function ConsumptionRate({ value, previous }: { value: number; previous?: number }) {
  const diff = previous === undefined ? 0 : value - previous;
  const color =
    diff < 0
      ? 'bg-green-50 text-green-800'
      : diff > 0
        ? 'bg-red-50 text-red-800'
        : 'bg-gray-100 text-gray-700';
  const comparison =
    previous === undefined
      ? 'No previous trip to compare'
      : diff < 0
        ? 'Lower than previous trip'
        : diff > 0
          ? 'Higher than previous trip'
          : 'Same as previous trip';

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${color}`}
      title={comparison}
    >
      {value.toFixed(2)} L/100km
      <span className="sr-only"> — {comparison}</span>
    </span>
  );
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
  const returnFocus = useRef<HTMLElement | null>(null);
  const [uploading, setUploading] = useState(false);
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
        className="block min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
        onClick={event => {
          returnFocus.current =
            event.currentTarget.closest('details')?.querySelector('summary') ?? event.currentTarget;
          setOpen(true);
        }}
      >
        Edit
      </button>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (!uploading) setOpen(next);
        }}
      >
        <DialogContent
          aria-label="Edit fill-up"
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={event => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit fill-up</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              if (uploading) return;
              try {
                await update.mutateAsync({
                  date: state.date,
                  odometerKm: parseInt(state.odometerKm, 10),
                  liters: parseFloat(state.liters.replace(',', '.')),
                  pricePerLiter: parseFloat(state.pricePerLiter.replace(',', '.')),
                  totalCost: parseFloat(total),
                  isFull: state.isFull,
                  notes: state.notes || undefined,
                });
                toast.success('Fill-up updated');
                setOpen(false);
              } catch (error) {
                toast.error(getUiErrorMessage(error, 'Failed to update fill-up'));
              }
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={update.isPending || uploading}>
                  {update.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
          {open ? (
            <RecordAttachments
              key={item.id}
              vehicleId={vehicleId}
              record={{ type: 'fillup', id: item.id }}
              onUploadingChange={setUploading}
              disabled={update.isPending}
            />
          ) : null}
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
      className="block min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
      onClick={async () => {
        if (!confirm('Delete this fill-up?')) return;
        try {
          await del.mutateAsync();
          toast.success('Fill-up deleted');
        } catch (error) {
          toast.error(getUiErrorMessage(error, 'Failed to delete fill-up'));
        }
      }}
      disabled={del.isPending}
    >
      {del.isPending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
