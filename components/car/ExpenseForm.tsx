'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const expenseCategories = [
  'FUEL',
  'MAINTENANCE',
  'INSURANCE',
  'TAX',
  'PARKING',
  'TOLL',
  'OTHER',
] as const;
type ExpenseCategory = (typeof expenseCategories)[number];

export type ExpenseFormProps = {
  vehicleId: string;
  onCreated?: () => void;
};

import { useUiStore } from '@/stores/ui';
import { useCreateExpense } from '@/hooks';

export default function ExpenseForm({ vehicleId, onCreated }: ExpenseFormProps) {
  const { isExpenseDialogOpen: open, setExpenseDialogOpen: setOpen } = useUiStore();
  const createExpense = useCreateExpense(vehicleId);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>('MAINTENANCE');
  const [amount, setAmount] = useState<string>('');
  const [vendor, setVendor] = useState<string>('');
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = !!vehicleId && !!category && !!amount && parseFloat(amount) > 0;

  async function submit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await createExpense.mutateAsync({
        date,
        category,
        amount: parseFloat(amount),
        vendor: vendor || undefined,
        odometerKm: odometerKm ? parseInt(odometerKm, 10) : undefined,
        notes: notes || undefined,
      });
      onCreated?.();
      setOpen(false);
      setAmount('');
      setVendor('');
      setNotes('');
      setOdometerKm('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add expense</Button>
      </DialogTrigger>
      <DialogContent aria-label="Add expense dialog">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Category</span>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as ExpenseCategory)}
                className="border rounded-md px-3 py-2"
                aria-label="Expense category"
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
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Vendor (optional)</span>
              <input
                type="text"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                className="border rounded-md px-3 py-2"
                placeholder="Shop/Mechanic"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Odometer km (optional)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={odometerKm}
                onChange={e => setOdometerKm(e.target.value)}
                className="border rounded-md px-3 py-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="border rounded-md px-3 py-2"
              rows={3}
              placeholder="Describe parts/repair details"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || submitting || createExpense.isPending}>
              {submitting || createExpense.isPending ? 'Saving…' : 'Save expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
