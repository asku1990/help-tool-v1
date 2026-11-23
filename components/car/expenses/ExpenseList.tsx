'use client';

import { useMemo, type ReactNode } from 'react';
import { useInfiniteExpenses, useDeleteExpense } from '@/hooks';
import { useListedRecordDialog } from '../records/useListedRecordDialog';
import { Button } from '@/components/ui';
import ExpenseListSkeleton from './ExpenseListSkeleton';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import ExpenseDialog from './ExpenseDialog';
import {
  destructiveRecordActionClass,
  recordActionClass,
  RecordActions,
  RecordSummaryButton,
} from '../records';

export default function ExpenseList({ vehicleId }: { vehicleId: string }) {
  return <VehicleExpenseList key={vehicleId} vehicleId={vehicleId} />;
}

function VehicleExpenseList({ vehicleId }: { vehicleId: string }) {
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
  } = useInfiniteExpenses(vehicleId, 5);

  const items = useMemo(() => (data?.pages || []).flatMap(p => p.expenses), [data]);
  const canWrite = data?.pages[0]?.canWrite === true;
  const {
    list,
    open: setActive,
    dialog,
  } = useListedRecordDialog(items, { isError, fetchStatus, refetch, dataUpdatedAt });

  // Keep the active editor mounted even if the refreshed page no longer contains its row.
  function withEditor(content: ReactNode) {
    return (
      <>
        <div ref={list} tabIndex={-1}>
          {content}
        </div>
        {dialog && <ExpenseDialog vehicleId={vehicleId} canWrite={canWrite} {...dialog} />}
      </>
    );
  }

  if (isLoading) return withEditor(<ExpenseListSkeleton rows={3} />);
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
        <span>No expenses yet. Log one to track maintenance and total cost.</span>
        {canWrite ? <EmptyCta /> : null}
      </div>
    );

  return withEditor(
    <div className="@container/expenses space-y-2">
      <table
        role="table"
        aria-label="Expense records"
        className="block w-full text-left text-sm @min-[56rem]/expenses:table @min-[56rem]/expenses:table-fixed"
      >
        <thead role="rowgroup" className="hidden @min-[56rem]/expenses:table-header-group">
          <tr
            role="row"
            className="bg-muted text-left text-xs text-muted-foreground [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium"
          >
            <th role="columnheader" scope="col" className="w-28">
              Date
            </th>
            <th role="columnheader" scope="col" className="w-32">
              Odometer / oil
            </th>
            <th role="columnheader" scope="col" className="w-[clamp(12rem,25cqw,22rem)]">
              Vendor / category
            </th>
            <th role="columnheader" scope="col">
              Notes
            </th>
            <th role="columnheader" scope="col" className="w-40 text-right">
              Amount
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
          className="block space-y-2 @min-[56rem]/expenses:table-row-group @min-[56rem]/expenses:space-y-0"
        >
          {items.map(e => (
            <tr
              role="row"
              key={e.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-200 px-3 py-3 dark:border-border @min-[56rem]/expenses:table-row @min-[56rem]/expenses:rounded-none @min-[56rem]/expenses:border-x-0 @min-[56rem]/expenses:border-b-0 @min-[56rem]/expenses:[&>td]:px-2"
            >
              <td role="cell" className="col-start-1 row-start-1 min-w-0">
                <RecordSummaryButton
                  vehicleId={vehicleId}
                  type="expense"
                  item={e}
                  onOpen={trigger => setActive({ item: e, trigger, entry: 'view' })}
                />
              </td>
              <td
                role="cell"
                className={`col-span-full min-w-0 py-1 text-muted-foreground tabular-nums @min-[56rem]/expenses:table-cell ${e.oilConsumption == null ? 'hidden' : ''}`}
              >
                {e.odometerKm != null ? (
                  <span className="hidden whitespace-nowrap @min-[56rem]/expenses:block">
                    {e.odometerKm} km
                  </span>
                ) : null}
                {e.oilConsumption != null ? (
                  <span className="block text-xs whitespace-nowrap text-amber-600">
                    {e.oilConsumption.toFixed(1)} L/10k
                  </span>
                ) : null}
                {e.odometerKm == null && e.oilConsumption == null ? '—' : null}
              </td>
              <td role="cell" className="col-span-full min-w-0 py-1 wrap-anywhere">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {e.vendor ? <span>{e.vendor}</span> : null}
                  <span className={e.vendor ? 'text-xs text-muted-foreground' : undefined}>
                    {e.vendor ? <span aria-hidden="true">· </span> : null}
                    {e.category.replace(/_/g, ' ')}
                  </span>
                </div>
              </td>
              <td
                role="cell"
                className={`order-last col-span-full min-w-0 @min-[56rem]/expenses:table-cell ${e.notes ? '' : 'hidden'}`}
              >
                {e.notes ? (
                  <span className="line-clamp-2 wrap-anywhere text-xs text-muted-foreground @min-[56rem]/expenses:block @min-[56rem]/expenses:truncate">
                    {e.notes}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td
                role="cell"
                className="col-span-full min-w-0 font-semibold whitespace-nowrap tabular-nums @min-[56rem]/expenses:text-right"
              >
                {formatCurrency(e.amount)}
              </td>
              {canWrite ? (
                <td
                  role="cell"
                  className="col-start-2 row-start-1 @min-[56rem]/expenses:[&>details]:mx-auto @min-[56rem]/expenses:[&>details]:w-11"
                >
                  <RecordActions
                    label={`Expense actions for ${formatDateFi(new Date(e.date))}`}
                    placement="card"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className={recordActionClass}
                      disabled={fetchStatus !== 'idle'}
                      onClick={event =>
                        setActive({
                          entry: 'edit',
                          item: e,
                          trigger:
                            event.currentTarget.closest('details')?.querySelector('summary') ??
                            event.currentTarget,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <hr className="my-1 border-border/40" />
                    <DeleteExpenseButton vehicleId={vehicleId} expenseId={e.id} />
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
  const { setExpenseDialogOpen } = useUiStore();
  return (
    <Button size="sm" variant="outline" onClick={() => setExpenseDialogOpen(true)}>
      Add expense
    </Button>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}

function DeleteExpenseButton({ vehicleId, expenseId }: { vehicleId: string; expenseId: string }) {
  const del = useDeleteExpense(vehicleId, expenseId);
  return (
    <Button
      type="button"
      variant="ghost"
      className={destructiveRecordActionClass}
      onClick={async () => {
        if (!confirm('Delete this expense?')) return;
        try {
          await del.mutateAsync();
          toast.success('Expense deleted');
        } catch (error) {
          toast.error(getUiErrorMessage(error, 'Failed to delete expense'));
        }
      }}
      disabled={del.isPending}
    >
      {del.isPending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
