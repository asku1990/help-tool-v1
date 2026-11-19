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
import { RecordActions, RecordDetailsButton } from './records';
import { parseRecordDecimal } from './records/parseRecordDecimal';
import { parseRecordOdometer } from './records/parseRecordOdometer';
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
        <span>No expenses yet. Log one to track maintenance and total cost.</span>
        {canWrite ? <EmptyCta /> : null}
      </div>
    );

  return withEditor(
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total: {formatCurrency(total)}</div>
      <ul className="divide-y">
        {items.map(e => (
          <li
            key={e.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 sm:grid-cols-5 sm:items-center"
          >
            <RecordDetailsButton vehicleId={vehicleId} type="expense" item={e} />
            {e.odometerKm != null || e.oilConsumption != null ? (
              <div className="col-start-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-600 sm:col-start-3">
                {e.odometerKm != null ? `Odo: ${e.odometerKm} km` : null}
                {e.oilConsumption != null ? (
                  <span className="text-xs text-amber-600">
                    {e.oilConsumption.toFixed(1)} L/10k
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="col-start-1 text-sm font-medium sm:col-start-4 sm:text-right">
              {formatCurrency(e.amount)}
            </div>
            {e.notes ? (
              <div className="col-start-1 min-w-0 line-clamp-2 break-words text-xs text-gray-500 sm:col-span-4 sm:line-clamp-1">
                {e.notes}
              </div>
            ) : null}
            <RecordActions label={`Expense actions for ${formatDateFi(new Date(e.date))}`}>
              <RecordDetailsButton vehicleId={vehicleId} type="expense" item={e} variant="menu" />
              {canWrite ? (
                <>
                  <button
                    type="button"
                    className="block min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
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
                  </button>
                  <DeleteExpenseButton vehicleId={vehicleId} expenseId={e.id} />
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
  const openingState = {
    date: item.date.slice(0, 10),
    category: item.category,
    amount: String(item.amount),
    vendor: item.vendor || '',
    odometerKm: item.odometerKm != null ? String(item.odometerKm) : '',
    liters: item.liters != null ? String(item.liters) : '',
    notes: item.notes || '',
  };
  const [state, setState] = useState(openingState);
  const changed = (field: keyof typeof state) => state[field] !== openingState[field];
  const amount = parseRecordDecimal(state.amount);
  const odometerKm = parseRecordOdometer(state.odometerKm);
  const invalidOdometer = odometerKm === undefined;
  const liters = state.liters ? parseRecordDecimal(state.liters) : null;
  const patch = {
    date: changed('date') ? state.date : undefined,
    category: changed('category') ? state.category : undefined,
    amount: amount !== item.amount ? amount : undefined,
    vendor: changed('vendor') ? state.vendor || null : undefined,
    odometerKm: odometerKm !== (item.odometerKm ?? null) ? odometerKm : undefined,
    liters: liters !== (item.liters ?? null) ? liters : undefined,
    notes: changed('notes') ? state.notes || null : undefined,
  };
  const hasChanges = invalidOdometer || Object.values(patch).some(value => value !== undefined);
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
              onChange={e =>
                setState(s => ({ ...s, category: e.target.value as ExpenseDto['category'] }))
              }
            >
              {[
                'FUEL',
                'MAINTENANCE',
                'INSURANCE',
                'TAX',
                'PARKING',
                'TOLL',
                'OIL_CHANGE',
                'OIL_TOP_UP',
                'INSPECTION',
                'TIRES',
                'OTHER',
              ].map(c => (
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
            Enter a whole number for the odometer, or leave it blank.
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
    <button
      type="button"
      className="block min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
    </button>
  );
}
