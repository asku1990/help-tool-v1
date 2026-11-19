'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteFillUps, useUpdateFillUp, useDeleteFillUp } from '@/hooks';
import type { FillUpDto, FillUpWithSegmentDto } from '@/queries/fillups';
import { Button } from '@/components/ui';
import { FillUpListSkeleton } from '@/components/car';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import RecordAttachments from './attachments/RecordAttachments';
import { RecordActions, RecordDetailsButton } from './records';
import { getFillUpDraftChanges, toFillUpDraft } from './fillups/fillUpDraft';
import RecordEditDialog from './records/RecordEditDialog';

export default function FillUpList({ vehicleId }: { vehicleId: string }) {
  return <VehicleFillUpList key={vehicleId} vehicleId={vehicleId} />;
}

function VehicleFillUpList({ vehicleId }: { vehicleId: string }) {
  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    fetchStatus,
    refetch,
  } = useInfiniteFillUps(vehicleId, 5);
  const [edit, setEdit] = useState<{ item: FillUpDto; trigger: HTMLElement } | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const items = useMemo<FillUpWithSegmentDto[]>(
    () => (data?.pages || []).flatMap(p => p.fillUps),
    [data]
  );
  const totalFuelCost = useMemo(() => items.reduce((s, f) => s + f.totalCost, 0), [items]);
  const canWrite = data?.pages[0]?.canWrite === true;

  // Keep the active editor mounted even if the refreshed page no longer contains its row.
  function withEditor(content: ReactNode) {
    return (
      <>
        <div ref={list} tabIndex={-1}>
          {content}
        </div>
        {edit ? (
          <FillUpEditor
            vehicleId={vehicleId}
            item={edit.item}
            onClose={() => setEdit(null)}
            restoreFocus={saved =>
              (!saved && edit.trigger.isConnected ? edit.trigger : list.current)?.focus()
            }
          />
        ) : null}
      </>
    );
  }

  if (isLoading) return withEditor(<FillUpListSkeleton rows={4} />);
  if (isError)
    return withEditor(
      <div className="text-sm text-red-600 flex items-center justify-between">
        <span>{String(error)}</span>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded border"
          disabled={fetchStatus !== 'idle'}
          onClick={() =>
            isFetchNextPageError ? fetchNextPage({ cancelRefetch: false }) : refetch()
          }
        >
          Retry
        </button>
      </div>
    );
  if (!items.length)
    return withEditor(
      <div className="text-sm text-gray-600 flex items-center justify-between">
        <span>No fill-ups yet. Add your first to see real consumption and cost/km.</span>
        {canWrite ? <EmptyCta /> : null}
      </div>
    );

  return withEditor(
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Fuel cost — loaded records: {formatCurrency(totalFuelCost)}
      </div>
      <ul className="space-y-2 sm:space-y-0 sm:divide-y">
        {items.map(f => (
          <li
            key={f.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 max-sm:rounded-lg max-sm:border max-sm:border-border/60 max-sm:px-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-center"
          >
            <RecordDetailsButton vehicleId={vehicleId} type="fillup" item={f} />
            <div className="col-span-full min-w-0 wrap-anywhere text-sm text-gray-600 sm:col-span-1 sm:col-start-3">
              {f.liters} L @ {f.pricePerLiter.toFixed(3)} →{' '}
              <span className="font-medium max-sm:font-semibold max-sm:text-foreground">
                {formatCurrency(f.totalCost)}
              </span>
            </div>
            <div className="col-span-full min-w-0 text-xs text-gray-500 sm:col-span-1 sm:col-start-4">
              <div className="flex items-start gap-1">
                <span className="shrink-0">{f.isFull ? 'Full tank' : 'Partial'}</span>
                {f.notes ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <p className="min-w-0 line-clamp-2 break-words sm:line-clamp-1">{f.notes}</p>
                  </>
                ) : null}
              </div>
              {f.isFull && f.segment ? (
                <div className="mt-0.5 wrap-anywhere text-[11px] text-gray-600">
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
                  <button
                    type="button"
                    className="block min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                    disabled={fetchStatus !== 'idle'}
                    onClick={event =>
                      setEdit({
                        item: f,
                        trigger:
                          event.currentTarget.closest('details')?.querySelector('summary') ??
                          event.currentTarget,
                      })
                    }
                  >
                    Edit
                  </button>
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
            onClick={() => fetchNextPage({ cancelRefetch: false })}
            className="text-sm px-3 py-2 rounded border"
            disabled={fetchStatus !== 'idle'}
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
      className={`inline-block max-w-full rounded-md px-2 py-1 align-middle text-sm font-semibold tabular-nums ${color}`}
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

function FillUpEditor({
  vehicleId,
  item,
  onClose,
  restoreFocus,
}: {
  vehicleId: string;
  item: FillUpDto;
  onClose: () => void;
  restoreFocus: (_saved: boolean) => void;
}) {
  const formId = useId();
  const saved = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState(() => toFillUpDraft(item));
  const { patch, invalidOdometer, hasChanges, total } = getFillUpDraftChanges(item, state);
  const update = useUpdateFillUp(vehicleId, item.id);
  return (
    <RecordEditDialog
      title="Edit fill-up"
      open
      onClose={onClose}
      restoreFocus={() => restoreFocus(saved.current)}
      formId={formId}
      hasChanges={hasChanges}
      invalid={invalidOdometer}
      saving={update.isPending}
      attachmentBusy={uploading}
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={async e => {
          e.preventDefault();
          if (uploading || update.isPending || !hasChanges || invalidOdometer) return;
          try {
            await update.mutateAsync(patch);
            saved.current = true;
            toast.success('Fill-up updated');
            onClose();
          } catch (error) {
            toast.error(getUiErrorMessage(error, 'Failed to update fill-up'));
          }
        }}
      >
        <fieldset disabled={update.isPending} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              inputMode="numeric"
              aria-invalid={invalidOdometer}
              aria-describedby={invalidOdometer ? `${formId}-odometer-error` : undefined}
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
        </fieldset>
        {invalidOdometer ? (
          <p id={`${formId}-odometer-error`} className="text-sm text-red-600">
            Enter a whole number from −2,147,483,648 to 2,147,483,647.
          </p>
        ) : null}
        <p className="text-sm text-gray-500">
          Total: {Number.isFinite(total) ? total.toFixed(2) : '0.00'}
        </p>
      </form>
      <RecordAttachments
        key={item.id}
        vehicleId={vehicleId}
        record={{ type: 'fillup', id: item.id }}
        uploadFirst
        onUploadingChange={setUploading}
        disabled={update.isPending}
      />
    </RecordEditDialog>
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
