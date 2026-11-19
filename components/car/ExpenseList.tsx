'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteExpenses, useUpdateExpense, useDeleteExpense } from '@/hooks';
import type { ExpenseDto } from '@/queries/expenses';
import { Button } from '@/components/ui';
import { ExpenseListSkeleton } from '@/components/car';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import RecordAttachments from './attachments/RecordAttachments';
import {
  destructiveRecordActionClass,
  recordActionClass,
  RecordActions,
  RecordDetailsButton,
} from './records';
import { expenseCategories, isValidExpenseCategory } from '@/utils/expenses';
import { getExpenseDraftChanges, toExpenseDraft } from './expenses/expenseDraft';
import RecordEditDialog from './records/RecordEditDialog';

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
  } = useInfiniteExpenses(vehicleId, 5);
  const [edit, setEdit] = useState<{ item: ExpenseDto; trigger: HTMLElement } | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const items = useMemo(() => (data?.pages || []).flatMap(p => p.expenses), [data]);
  const total = useMemo(() => items.reduce((s, e) => s + e.amount, 0), [items]);
  const canWrite = data?.pages[0]?.canWrite === true;

  // Keep the active editor mounted even if the refreshed page no longer contains its row.
  function withEditor(content: ReactNode) {
    return (
      <>
        <div ref={list} tabIndex={-1}>
          {content}
        </div>
        {edit ? (
          <ExpenseEditor
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
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total: {formatCurrency(total)}</div>
      <table
        role="table"
        aria-label="Expense records"
        className="block w-full text-left text-sm lg:table lg:table-fixed"
      >
        <thead role="rowgroup" className="hidden lg:table-header-group">
          <tr
            role="row"
            className="bg-muted text-left text-xs text-muted-foreground [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium"
          >
            <th role="columnheader" scope="col" className="w-28">
              Date
            </th>
            <th role="columnheader" scope="col" className="w-40">
              Odometer / oil
            </th>
            <th role="columnheader" scope="col" className="w-1/4">
              Category / vendor
            </th>
            <th role="columnheader" scope="col">
              Notes
            </th>
            <th role="columnheader" scope="col" className="w-28">
              Amount
            </th>
            {canWrite ? (
              <th role="columnheader" scope="col" className="w-16 text-center">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block space-y-2 lg:table-row-group lg:space-y-0">
          {items.map(e => (
            <tr
              role="row"
              key={e.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-200 px-3 py-3 dark:border-border lg:table-row lg:rounded-none lg:border-x-0 lg:border-b-0 lg:whitespace-nowrap lg:[&>td]:px-2"
            >
              <td role="cell" className="col-start-1 row-start-1 min-w-0">
                <RecordDetailsButton vehicleId={vehicleId} type="expense" item={e} />
              </td>
              <td
                role="cell"
                className={`col-span-full min-w-0 text-muted-foreground lg:table-cell lg:tabular-nums ${e.odometerKm == null && e.oilConsumption == null ? 'hidden' : ''}`}
              >
                <span className="lg:block lg:truncate">
                  {e.odometerKm != null ? <span>{`Odo: ${e.odometerKm} km`}</span> : null}
                  {e.oilConsumption != null ? (
                    <span className="ml-2 text-xs text-amber-600">
                      {e.oilConsumption.toFixed(1)} L/10k
                    </span>
                  ) : null}
                  {e.odometerKm == null && e.oilConsumption == null ? '—' : null}
                </span>
              </td>
              <td role="cell" className="hidden lg:table-cell">
                <span className="block truncate">
                  {e.category.replace(/_/g, ' ')}
                  {e.vendor ? ` · ${e.vendor}` : ''}
                </span>
              </td>
              <td
                role="cell"
                className={`order-last col-span-full min-w-0 lg:table-cell ${e.notes ? '' : 'hidden'}`}
              >
                {e.notes ? (
                  <span className="line-clamp-2 break-words text-xs text-muted-foreground sm:line-clamp-1 lg:block lg:truncate">
                    {e.notes}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td role="cell" className="col-span-full min-w-0 font-semibold lg:tabular-nums">
                {formatCurrency(e.amount)}
              </td>
              {canWrite ? (
                <td
                  role="cell"
                  className="col-start-2 row-start-1 lg:[&>details]:mx-auto lg:[&>details]:w-11"
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
                        setEdit({
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

function ExpenseEditor({
  vehicleId,
  item,
  onClose,
  restoreFocus,
}: {
  vehicleId: string;
  item: ExpenseDto;
  onClose: () => void;
  restoreFocus: (_saved: boolean) => void;
}) {
  const formId = useId();
  const saved = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState(() => toExpenseDraft(item));
  const { patch, invalidOdometer, hasChanges } = getExpenseDraftChanges(item, state);
  const update = useUpdateExpense(vehicleId, item.id);
  return (
    <RecordEditDialog
      title="Edit expense"
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
            toast.success('Expense updated');
            onClose();
          } catch (error) {
            toast.error(getUiErrorMessage(error, 'Failed to update expense'));
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
            <span className="text-sm">Category</span>
            <select
              className="border rounded-md px-3 py-2"
              value={state.category}
              onChange={e => {
                const category = e.target.value;
                if (isValidExpenseCategory(category)) setState(s => ({ ...s, category }));
              }}
            >
              {expenseCategories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Amount</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="^[0-9]*[.,]?[0-9]*$"
              className="border rounded-md px-3 py-2"
              value={state.amount}
              onChange={e => setState(s => ({ ...s, amount: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Vendor</span>
            <input
              className="border rounded-md px-3 py-2"
              value={state.vendor}
              onChange={e => setState(s => ({ ...s, vendor: e.target.value }))}
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
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Liters</span>
            <input
              type="text"
              inputMode="decimal"
              className="border rounded-md px-3 py-2"
              value={state.liters}
              onChange={e => setState(s => ({ ...s, liters: e.target.value }))}
              placeholder="For oil/fluid"
            />
          </label>
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
            Enter a whole number from −2,147,483,648 to 2,147,483,647, or leave it blank.
          </p>
        ) : null}
      </form>
      <RecordAttachments
        key={item.id}
        vehicleId={vehicleId}
        record={{ type: 'expense', id: item.id }}
        uploadFirst
        onUploadingChange={setUploading}
        disabled={update.isPending}
      />
    </RecordEditDialog>
  );
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
