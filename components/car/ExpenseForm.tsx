'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';

import { expenseCategories, type ExpenseCategory, addMonths } from '@/utils';

export type ExpenseFormProps = {
  vehicleId: string;
  onCreated?: () => void;
};

import { useUiStore } from '@/stores/ui';
import { useCreateExpense, useUpdateVehicle, useVehicle, useLatestOdometer } from '@/hooks';

export default function ExpenseForm({ vehicleId, onCreated }: ExpenseFormProps) {
  const { isExpenseDialogOpen: open, setExpenseDialogOpen: setOpen } = useUiStore();
  const createExpense = useCreateExpense(vehicleId);
  const updateVehicle = useUpdateVehicle(vehicleId);
  const vehicleQuery = useVehicle(vehicleId);
  const latestOdometer = useLatestOdometer(vehicleId);

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>('MAINTENANCE');
  const [amount, setAmount] = useState<string>('');
  const [vendor, setVendor] = useState<string>('');
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [odometerEdited, setOdometerEdited] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [nextInspectionDue, setNextInspectionDue] = useState<string>('');
  const [inspectionDueEdited, setInspectionDueEdited] = useState(false);
  const [intervalMonthsInput, setIntervalMonthsInput] = useState<string>('');
  const [liters, setLiters] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setCategory('MAINTENANCE');
      setAmount('');
      setVendor('');
      setOdometerKm(latestOdometer != null ? String(latestOdometer) : '');
      setOdometerEdited(false);
      setNotes('');
      setNextInspectionDue('');
      setInspectionDueEdited(false);
      setIntervalMonthsInput('');
      setLiters('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only reset on dialog open/close

  // Pre-fill odometer when data arrives (if dialog is open and user hasn't edited)
  useEffect(() => {
    if (open && !odometerEdited && latestOdometer != null && odometerKm === '') {
      setOdometerKm(String(latestOdometer));
    }
  }, [open, odometerEdited, latestOdometer, odometerKm]);

  // Auto-populate inspection fields when category changes to INSPECTION or date changes
  useEffect(() => {
    if (category === 'INSPECTION') {
      const existing = vehicleQuery.data?.vehicle?.inspectionIntervalMonths;
      if (existing && !intervalMonthsInput) {
        setIntervalMonthsInput(String(existing));
      }
      // Only auto-calculate if user hasn't manually edited the date
      if (existing && !inspectionDueEdited) {
        const computed = addMonths(new Date(date), existing);
        const iso = new Date(computed.getTime() - computed.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10);
        setNextInspectionDue(iso);
      }
    }
  }, [
    category,
    date,
    vehicleQuery.data?.vehicle?.inspectionIntervalMonths,
    intervalMonthsInput,
    inspectionDueEdited,
  ]);

  const parsedAmount = parseFloat((amount ?? '').replace(',', '.'));
  const amountIsOk = amount === '' || (Number.isFinite(parsedAmount) && parsedAmount >= 0);
  const isValid = !!vehicleId && !!category && amountIsOk;

  async function submit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const normalizedAmount = amount === '' ? 0 : parseFloat(amount.replace(',', '.'));
      await createExpense.mutateAsync({
        date,
        category,
        amount: normalizedAmount,
        vendor: vendor || undefined,
        odometerKm: odometerKm ? parseInt(odometerKm, 10) : undefined,
        liters: liters ? parseFloat(liters.replace(',', '.')) : undefined,
        notes: notes || undefined,
      });
      // Update vehicle inspection dates when category is INSPECTION
      if (category === 'INSPECTION') {
        const due =
          nextInspectionDue ||
          (() => {
            const interval = vehicleQuery.data?.vehicle?.inspectionIntervalMonths;
            if (typeof interval === 'number' && interval > 0) {
              const computed = addMonths(new Date(date), interval);
              return new Date(computed.getTime() - computed.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 10);
            }
            return '';
          })();
        const intervalToSave = intervalMonthsInput
          ? parseInt(intervalMonthsInput, 10)
          : (vehicleQuery.data?.vehicle?.inspectionIntervalMonths ?? null);
        await updateVehicle.mutateAsync({
          inspectionDueDate: due || null,
          inspectionIntervalMonths:
            typeof intervalToSave === 'number' && Number.isFinite(intervalToSave)
              ? intervalToSave
              : null,
        });
      }
      toast.success('Expense saved');
      onCreated?.();
      setOpen(false);
      setAmount('');
      setVendor('');
      setNotes('');
      setOdometerKm('');
      setLiters('');
      setNextInspectionDue('');
      setInspectionDueEdited(false);
      setIntervalMonthsInput('');
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Failed to save expense'));
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
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="border rounded-md px-3 py-2"
                required={false}
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
                onChange={e => {
                  setOdometerKm(e.target.value);
                  setOdometerEdited(true);
                }}
                className={`border rounded-md px-3 py-2 ${
                  !odometerEdited && odometerKm ? 'bg-gray-100 text-gray-500' : ''
                }`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Liters (optional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={liters}
                onChange={e => setLiters(e.target.value)}
                className="border rounded-md px-3 py-2"
                placeholder="For oil/fluid"
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
          {/* Show inspection date fields when category is INSPECTION */}
          {category === 'INSPECTION' ? (
            <div className="space-y-2 pt-2">
              <p className="text-sm text-gray-600">Set next inspection due date:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Next inspection due</span>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2"
                    value={nextInspectionDue}
                    onChange={e => {
                      setNextInspectionDue(e.target.value);
                      setInspectionDueEdited(true);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Interval (months)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="60"
                    className="border rounded-md px-3 py-2"
                    value={intervalMonthsInput}
                    onChange={e => setIntervalMonthsInput(e.target.value)}
                    placeholder={
                      vehicleQuery.data?.vehicle?.inspectionIntervalMonths
                        ? String(vehicleQuery.data.vehicle.inspectionIntervalMonths)
                        : '12'
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}
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
