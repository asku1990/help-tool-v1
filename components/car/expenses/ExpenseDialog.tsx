'use client';

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useUpdateExpense } from '@/hooks';
import type { ExpenseDto } from '@/queries/expenses';
import { expenseCategories, isValidExpenseCategory } from '@/utils/expenses';
import { formatDateFi } from '@/utils';
import RecordFields from '../records/RecordFields';
import { recordFields } from '../records/RecordSummaryButton';
import SavedRecordDialog from '../records/SavedRecordDialog';
import type { ListedRecordDialogProps } from '../records/useListedRecordDialog';
import { getExpenseDraftChanges, toExpenseDraft } from './expenseDraft';

export default function ExpenseDialog({
  vehicleId,
  item,
  entry,
  canWrite,
  canStartEdit,
  listRefresh,
  onClose,
  restoreFocus,
}: ListedRecordDialogProps<ExpenseDto>) {
  const formId = useId();
  const [baseline, setBaseline] = useState(item);
  const [draft, setDraft] = useState(() => toExpenseDraft(item));
  const { patch, invalidOdometer, hasChanges } = getExpenseDraftChanges(baseline, draft);
  const update = useUpdateExpense(vehicleId, item.id);

  return (
    <SavedRecordDialog
      name="expense"
      listRefresh={listRefresh}
      entry={entry}
      vehicleId={vehicleId}
      record={{ type: 'expense', id: item.id }}
      identifier={`${item.vendor?.trim() || item.category.replace(/_/g, ' ')} · ${formatDateFi(new Date(item.date))}`}
      onClose={onClose}
      restoreFocus={restoreFocus}
      edit={{
        writable: canWrite,
        available: canStartEdit,
        dirty: hasChanges,
        invalid: invalidOdometer,
        saving: update.isPending,
        saved: update.isSuccess,
        reset: () => {
          setBaseline(item);
          setDraft(toExpenseDraft(item));
        },
        save: async () => {
          await update.mutateAsync(patch);
          toast.success('Expense updated');
        },
      }}
      summary={<RecordFields fields={recordFields({ type: 'expense', item, vehicleId })} />}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input
          type="date"
          className="border rounded-md px-3 py-2"
          value={draft.date}
          onChange={e => setDraft(s => ({ ...s, date: e.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Category</span>
        <select
          className="border rounded-md px-3 py-2"
          value={draft.category}
          onChange={e => {
            const category = e.target.value;
            if (isValidExpenseCategory(category)) setDraft(s => ({ ...s, category }));
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
          value={draft.amount}
          onChange={e => setDraft(s => ({ ...s, amount: e.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Vendor</span>
        <input
          className="border rounded-md px-3 py-2"
          value={draft.vendor}
          onChange={e => setDraft(s => ({ ...s, vendor: e.target.value }))}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Odometer km</span>
        <input
          inputMode="numeric"
          aria-invalid={invalidOdometer}
          aria-describedby={invalidOdometer ? `${formId}-odometer-error` : undefined}
          className="border rounded-md px-3 py-2"
          value={draft.odometerKm}
          onChange={e => setDraft(s => ({ ...s, odometerKm: e.target.value }))}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Liters</span>
        <input
          type="text"
          inputMode="decimal"
          className="border rounded-md px-3 py-2"
          value={draft.liters}
          onChange={e => setDraft(s => ({ ...s, liters: e.target.value }))}
          placeholder="For oil/fluid"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm">Notes</span>
        <textarea
          className="border rounded-md px-3 py-2"
          rows={3}
          value={draft.notes}
          onChange={e => setDraft(s => ({ ...s, notes: e.target.value }))}
        />
      </label>
      {invalidOdometer && (
        <p id={`${formId}-odometer-error`} className="sm:col-span-2 text-sm text-red-600">
          Enter a whole number from −2,147,483,648 to 2,147,483,647, or leave it blank.
        </p>
      )}
    </SavedRecordDialog>
  );
}
