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
import RecordAttachments from './attachments/RecordAttachments';

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
  const [savedRecord, setSavedRecord] = useState<{ id: string; addAttachments: boolean } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [inspectionError, setInspectionError] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSavedRecord(null);
      setUploading(false);
      setInspectionError('');
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
    if (
      open &&
      !savedRecord &&
      !submitting &&
      !odometerEdited &&
      latestOdometer != null &&
      odometerKm === ''
    ) {
      setOdometerKm(String(latestOdometer));
    }
  }, [open, savedRecord, submitting, odometerEdited, latestOdometer, odometerKm]);

  // Auto-populate inspection fields when category changes to INSPECTION or date changes
  useEffect(() => {
    if (category === 'INSPECTION' && !savedRecord && !submitting) {
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
    savedRecord,
    submitting,
  ]);

  const parsedAmount = parseFloat((amount ?? '').replace(',', '.'));
  const amountIsOk = amount === '' || (Number.isFinite(parsedAmount) && parsedAmount >= 0);
  const isValid = !!vehicleId && !!category && amountIsOk;

  async function submit(addAttachments = false) {
    if (!isValid || submitting || createExpense.isPending || savedRecord) return;
    setSubmitting(true);
    try {
      const normalizedAmount = amount === '' ? 0 : parseFloat(amount.replace(',', '.'));
      const created = await createExpense.mutateAsync({
        date,
        category,
        amount: normalizedAmount,
        vendor: vendor || undefined,
        odometerKm: odometerKm ? parseInt(odometerKm, 10) : undefined,
        liters: liters ? parseFloat(liters.replace(',', '.')) : undefined,
        notes: notes || undefined,
      });
      setSavedRecord({ id: created.id, addAttachments });
      setAmount(String(normalizedAmount));
      toast.success('Expense saved');
      onCreated?.();
      let inspectionFailed = false;
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
        try {
          await updateVehicle.mutateAsync({
            inspectionDueDate: due || null,
            inspectionIntervalMonths:
              typeof intervalToSave === 'number' && Number.isFinite(intervalToSave)
                ? intervalToSave
                : null,
          });
        } catch {
          inspectionFailed = true;
          setInspectionError(
            'Expense saved, but the vehicle inspection dates could not be updated. Check the vehicle inspection settings.'
          );
        }
      }
      if (!addAttachments && !inspectionFailed) setOpen(false);
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Failed to save expense'));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || createExpense.isPending || uploading;
  const fieldsDisabled = busy || Boolean(savedRecord);
  const title = savedRecord ? 'Expense saved' : 'Add expense';
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          Add expense
        </Button>
      </DialogTrigger>
      <DialogContent aria-label={`${title} dialog`} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          aria-label={savedRecord ? 'Saved expense' : 'Expense information'}
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            const submitter = (e.nativeEvent as SubmitEvent).submitter;
            void submit(
              submitter instanceof HTMLButtonElement && submitter.value === 'attachments'
            );
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Date</span>
              <input
                type="date"
                disabled={fieldsDisabled}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Category</span>
              <select
                disabled={fieldsDisabled}
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
                disabled={fieldsDisabled}
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
                disabled={fieldsDisabled}
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
                disabled={fieldsDisabled}
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
                disabled={fieldsDisabled}
                onChange={e => setLiters(e.target.value)}
                className="border rounded-md px-3 py-2"
                placeholder="For oil/fluid"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Notes (optional)</span>
            <textarea
              disabled={fieldsDisabled}
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
                    disabled={fieldsDisabled}
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
                    disabled={fieldsDisabled}
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
          {!savedRecord ? (
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || busy}>
                {submitting || createExpense.isPending ? 'Saving…' : 'Save expense'}
              </Button>
              <Button
                type="submit"
                value="attachments"
                variant="outline"
                disabled={!isValid || busy}
              >
                Save &amp; add attachments
              </Button>
            </div>
          ) : null}
        </form>
        {savedRecord ? (
          <>
            <p role="status" className="text-sm">
              Expense saved.{' '}
              {savedRecord.addAttachments
                ? 'Add attachments below, or choose Done.'
                : 'Choose Done to close.'}
            </p>
            {inspectionError ? (
              <p role="alert" className="text-sm text-red-600">
                {inspectionError}
              </p>
            ) : null}
            {open && savedRecord.addAttachments ? (
              <RecordAttachments
                vehicleId={vehicleId}
                record={{ type: 'expense', id: savedRecord.id }}
                onUploadingChange={setUploading}
                disabled={submitting}
              />
            ) : null}
            <div className="flex justify-end">
              <Button type="button" disabled={busy} onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
