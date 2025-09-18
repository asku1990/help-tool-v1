'use client';

import { useMemo, useState } from 'react';
import { useInfiniteExpenses, useUpdateExpense, useDeleteExpense } from '@/hooks';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { ExpenseListSkeleton } from '@/components/car';
import { useUiStore } from '@/stores/ui';
import { formatDateFi } from '@/utils';

export default function ExpenseList({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteExpenses(vehicleId, 5);

  const items = useMemo(() => (data?.pages || []).flatMap(p => p.expenses), [data]);
  const total = useMemo(() => items.reduce((s, e) => s + e.amount, 0), [items]);

  if (isLoading) return <ExpenseListSkeleton rows={3} />;
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
        <span>No expenses yet. Log one to track maintenance and total cost.</span>
        <EmptyCta />
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total: {formatCurrency(total)}</div>
      <ul className="divide-y">
        {items.map(e => (
          <li key={e.id} className="py-3 grid gap-2 sm:grid-cols-5 sm:items-center">
            <div className="text-sm">{formatDateFi(new Date(e.date))}</div>
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
            <div className="sm:text-right flex gap-2 sm:justify-end">
              <EditExpenseButton vehicleId={vehicleId} item={e} />
              <DeleteExpenseButton vehicleId={vehicleId} expenseId={e.id} />
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

function EditExpenseButton({
  vehicleId,
  item,
}: {
  vehicleId: string;
  item: {
    id: string;
    date: string;
    category: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
    amount: number;
    vendor?: string;
    odometerKm?: number;
    notes?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    date: item.date.slice(0, 10),
    category: item.category as string,
    amount: String(item.amount),
    vendor: item.vendor || '',
    odometerKm: item.odometerKm ? String(item.odometerKm) : '',
    notes: item.notes || '',
  });
  const update = useUpdateExpense(vehicleId, item.id);
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
        <DialogContent aria-label="Edit expense">
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              await update.mutateAsync({
                date: state.date,
                category: state.category as
                  | 'FUEL'
                  | 'MAINTENANCE'
                  | 'INSURANCE'
                  | 'TAX'
                  | 'PARKING'
                  | 'TOLL'
                  | 'OTHER',
                amount: parseFloat(state.amount.replace(',', '.')),
                vendor: state.vendor || undefined,
                odometerKm: state.odometerKm ? parseInt(state.odometerKm, 10) : undefined,
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
                <span className="text-sm">Category</span>
                <select
                  className="border rounded-md px-3 py-2"
                  value={state.category}
                  onChange={e => setState(s => ({ ...s, category: e.target.value }))}
                >
                  {['FUEL', 'MAINTENANCE', 'INSURANCE', 'TAX', 'PARKING', 'TOLL', 'OTHER'].map(
                    c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
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
                  type="number"
                  inputMode="numeric"
                  className="border rounded-md px-3 py-2"
                  value={state.odometerKm}
                  onChange={e => setState(s => ({ ...s, odometerKm: e.target.value }))}
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
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteExpenseButton({ vehicleId, expenseId }: { vehicleId: string; expenseId: string }) {
  const del = useDeleteExpense(vehicleId, expenseId);
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded border"
      onClick={async () => {
        if (!confirm('Delete this expense?')) return;
        await del.mutateAsync();
      }}
      disabled={del.isPending}
    >
      {del.isPending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
