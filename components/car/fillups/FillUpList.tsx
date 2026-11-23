'use client';

import { useMemo, type ReactNode } from 'react';
import { useInfiniteFillUps, useDeleteFillUp } from '@/hooks';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { Button } from '@/components/ui';
import FillUpListSkeleton from './FillUpListSkeleton';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import FillUpDialog from './FillUpDialog';
import { useListedRecordDialog } from '../records/useListedRecordDialog';
import {
  destructiveRecordActionClass,
  recordActionClass,
  RecordActions,
  RecordSummaryButton,
} from '../records';

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
    dataUpdatedAt,
  } = useInfiniteFillUps(vehicleId, 5);

  const items = useMemo<FillUpWithSegmentDto[]>(
    () => (data?.pages || []).flatMap(p => p.fillUps),
    [data]
  );
  const canWrite = data?.pages[0]?.canWrite === true;
  const { list, open, dialog } = useListedRecordDialog(items, {
    isError,
    fetchStatus,
    refetch,
    dataUpdatedAt,
  });

  // Keep the active editor mounted even if the refreshed page no longer contains its row.
  function withEditor(content: ReactNode) {
    return (
      <>
        <div ref={list} tabIndex={-1}>
          {content}
        </div>
        {dialog && <FillUpDialog vehicleId={vehicleId} canWrite={canWrite} {...dialog} />}
      </>
    );
  }

  if (isLoading) return withEditor(<FillUpListSkeleton rows={4} />);
  if (isError)
    return withEditor(
      <div className="text-sm text-red-600 flex items-center justify-between">
        <span>{String(error)}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 cursor-pointer"
          disabled={fetchStatus !== 'idle'}
          onClick={() =>
            isFetchNextPageError ? fetchNextPage({ cancelRefetch: false }) : refetch()
          }
        >
          Retry
        </Button>
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
    <div className="@container/fillups space-y-2">
      <table
        role="table"
        aria-label="Fill-up records"
        className="block w-full text-left text-sm @min-[56rem]/fillups:table @min-[56rem]/fillups:table-fixed"
      >
        <thead role="rowgroup" className="hidden @min-[56rem]/fillups:table-header-group">
          <tr
            role="row"
            className="bg-muted text-left text-xs text-muted-foreground [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium"
          >
            <th role="columnheader" scope="col" className="w-28">
              Date
            </th>
            <th role="columnheader" scope="col" className="w-30">
              Odometer
            </th>
            <th role="columnheader" scope="col" className="w-[clamp(12rem,23cqw,17rem)]">
              Fuel purchase
            </th>
            <th role="columnheader" scope="col">
              Tank / notes
            </th>
            <th role="columnheader" scope="col" className="w-[clamp(14rem,28cqw,18rem)]">
              Trip / consumption
            </th>
            {canWrite ? (
              <th role="columnheader" scope="col" className="w-16 text-center">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody
          role="rowgroup"
          className="block space-y-2 @min-[56rem]/fillups:table-row-group @min-[56rem]/fillups:space-y-0"
        >
          {items.map(f => (
            <tr
              role="row"
              key={f.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-200 px-3 py-3 dark:border-border @min-[56rem]/fillups:table-row @min-[56rem]/fillups:rounded-none @min-[56rem]/fillups:border-x-0 @min-[56rem]/fillups:border-b-0 @min-[56rem]/fillups:[&>td]:px-2"
            >
              <td role="cell" className="col-start-1 row-start-1 min-w-0">
                <RecordSummaryButton
                  vehicleId={vehicleId}
                  type="fillup"
                  item={f}
                  onOpen={trigger => open({ item: f, entry: 'view', trigger })}
                />
              </td>
              <td role="cell" className="hidden tabular-nums @min-[56rem]/fillups:table-cell">
                <span className="whitespace-nowrap">{f.odometerKm} km</span>
              </td>
              <td
                role="cell"
                className="col-span-full min-w-0 py-1 text-muted-foreground tabular-nums"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold whitespace-nowrap text-foreground">
                    {formatCurrency(f.totalCost)}
                  </span>
                  <span className="text-xs">
                    {f.liters} L × {formatCurrency(f.pricePerLiter, 3)}/L
                  </span>
                </div>
              </td>
              <td role="cell" className="col-span-full min-w-0 text-xs text-muted-foreground">
                <div className="flex min-w-0 items-start gap-1">
                  <span className="shrink-0 whitespace-nowrap">
                    {f.isFull ? 'Full tank' : 'Partial'}
                  </span>
                  {f.notes ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <p className="min-w-0 line-clamp-2 wrap-anywhere @min-[56rem]/fillups:block @min-[56rem]/fillups:truncate">
                        {f.notes}
                      </p>
                    </>
                  ) : null}
                </div>
              </td>
              <td
                role="cell"
                className={`col-span-full min-w-0 @min-[56rem]/fillups:table-cell ${f.isFull && f.segment ? '' : 'hidden'}`}
              >
                {f.isFull && f.segment ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-xs text-muted-foreground dark:border-border @min-[56rem]/fillups:border-0 @min-[56rem]/fillups:py-1">
                    <span className="font-medium whitespace-nowrap tabular-nums">
                      Trip {f.segment.distanceKm.toFixed(0)} km
                    </span>
                    <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap tabular-nums @max-[56rem]/fillups:ml-auto">
                      <ConsumptionRate value={f.segment.lPer100} previous={f.segment.prevLPer100} />
                      {typeof f.segment.prevLPer100 === 'number' ? (
                        <Delta now={f.segment.lPer100} prev={f.segment.prevLPer100} />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">—</div>
                )}
              </td>
              {canWrite ? (
                <td
                  role="cell"
                  className="col-start-2 row-start-1 @min-[56rem]/fillups:[&>details]:mx-auto @min-[56rem]/fillups:[&>details]:w-11"
                >
                  <RecordActions
                    label={`Fill-up actions for ${formatDateFi(new Date(f.date))}`}
                    placement="card"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className={recordActionClass}
                      disabled={fetchStatus !== 'idle'}
                      onClick={event =>
                        open({
                          entry: 'edit',
                          item: f,
                          trigger:
                            event.currentTarget.closest('details')?.querySelector('summary') ??
                            event.currentTarget,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <hr className="my-1 border-border/40" />
                    <DeleteFillUpButton vehicleId={vehicleId} fillUpId={f.id} />
                  </RecordActions>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {hasNextPage ? (
        <div className="pt-3">
          <Button
            type="button"
            onClick={() => fetchNextPage({ cancelRefetch: false })}
            variant="outline"
            size="sm"
            className="min-h-11 cursor-pointer"
            disabled={fetchStatus !== 'idle'}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
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

function formatCurrency(n: number, fractionDigits = 2) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
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
    <span className={`rounded-md px-2 py-1 text-sm font-semibold ${color}`} title={comparison}>
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

function DeleteFillUpButton({ vehicleId, fillUpId }: { vehicleId: string; fillUpId: string }) {
  const del = useDeleteFillUp(vehicleId, fillUpId);
  return (
    <Button
      type="button"
      variant="ghost"
      className={destructiveRecordActionClass}
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
    </Button>
  );
}
