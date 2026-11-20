'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { useUiStore } from '@/stores/ui';
import { useCreateFillUp, useLatestOdometer } from '@/hooks';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import CreatedRecordStep from './attachments/CreatedRecordStep';
import { formatDateFi } from '@/utils';

export type FillUpFormProps = {
  vehicleId: string;
  onCreated?: () => void;
};

export default function FillUpForm({ vehicleId, onCreated }: FillUpFormProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { isFillUpDialogOpen: open, setFillUpDialogOpen: setOpen } = useUiStore();
  const createFillUp = useCreateFillUp(vehicleId);
  const lastOdometer = useLatestOdometer(vehicleId);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [odometerEdited, setOdometerEdited] = useState(false);
  const [liters, setLiters] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [isFull, setIsFull] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [savedRecord, setSavedRecord] = useState<{ id: string; addAttachments: boolean } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSavedRecord(null);
      setUploading(false);
      setOdometerKm(lastOdometer !== null ? String(lastOdometer) : '');
      setOdometerEdited(false);
      setDate(new Date().toISOString().slice(0, 10));
      setLiters('');
      setPricePerLiter('');
      setIsFull(true);
      setNotes('');
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
      lastOdometer !== null &&
      odometerKm === ''
    ) {
      setOdometerKm(String(lastOdometer));
    }
  }, [open, savedRecord, submitting, odometerEdited, lastOdometer, odometerKm]);

  const totalCost = useMemo(() => {
    const l = parseFloat((liters || '0').replace(',', '.'));
    const p = parseFloat((pricePerLiter || '0').replace(',', '.'));
    const t = l * p;
    return Number.isFinite(t) ? t.toFixed(2) : '0.00';
  }, [liters, pricePerLiter]);

  const isValid =
    !!vehicleId &&
    !!date &&
    !!odometerKm &&
    parseInt(odometerKm, 10) >= 0 &&
    parseFloat(liters.replace(',', '.')) > 0 &&
    parseFloat(pricePerLiter.replace(',', '.')) > 0;

  async function submit(addAttachments = false) {
    if (!isValid || submitting || createFillUp.isPending || savedRecord) return;
    setSubmitting(true);
    try {
      const created = await createFillUp.mutateAsync({
        date,
        odometerKm: parseInt(odometerKm, 10),
        liters: parseFloat(liters.replace(',', '.')),
        pricePerLiter: parseFloat(pricePerLiter.replace(',', '.')),
        totalCost: parseFloat(totalCost),
        isFull,
        notes: notes || undefined,
      });
      setSavedRecord({ id: created.id, addAttachments });
      toast.success('Fill-up saved');
      onCreated?.();
      if (!addAttachments) setOpen(false);
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Failed to save fill-up'));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || createFillUp.isPending || uploading;
  const fieldsDisabled = busy;
  const title = savedRecord ? 'Fill-up saved' : 'Add fill-up';
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11">Add fill-up</Button>
      </DialogTrigger>
      <DialogContent
        aria-label={`${title} dialog`}
        aria-describedby={undefined}
        closeDisabled={busy}
        onEscapeKeyDown={event => {
          if (
            busy ||
            (event.target instanceof HTMLElement && event.target.hasAttribute('data-file-rename'))
          )
            event.preventDefault();
        }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          heading.current?.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle ref={heading} tabIndex={-1} className="outline-none">
            {title}
          </DialogTitle>
        </DialogHeader>
        {savedRecord ? (
          open && (
            <CreatedRecordStep
              vehicleId={vehicleId}
              record={
                savedRecord.addAttachments ? { type: 'fillup', id: savedRecord.id } : undefined
              }
              summary={`${odometerKm} km · ${formatDateFi(new Date(date))} · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(Number(totalCost))}`}
              busy={busy}
              onBusyChange={setUploading}
              onDone={() => setOpen(false)}
            />
          )
        ) : (
          <form
            aria-label="Fill-up information"
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
                <span className="text-sm">Odometer km</span>
                <input
                  type="number"
                  disabled={fieldsDisabled}
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
                  required
                />
                {lastOdometer !== null && odometerKm && parseInt(odometerKm, 10) < lastOdometer ? (
                  <span className="text-xs text-amber-600">
                    Entered value is lower than last recorded odometer ({lastOdometer} km).
                  </span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Liters</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={liters}
                  disabled={fieldsDisabled}
                  onChange={e => setLiters(e.target.value)}
                  className="border rounded-md px-3 py-2"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Price per liter</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pricePerLiter}
                  disabled={fieldsDisabled}
                  onChange={e => setPricePerLiter(e.target.value)}
                  className="border rounded-md px-3 py-2"
                  required
                />
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="isFull"
                  disabled={fieldsDisabled}
                  type="checkbox"
                  checked={isFull}
                  onChange={e => setIsFull(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isFull" className="text-sm">
                  Full tank?
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Notes (optional)</span>
              <textarea
                disabled={fieldsDisabled}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="border rounded-md px-3 py-2"
                rows={3}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-sm text-gray-500" aria-live="polite">
                Total: {totalCost}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!isValid || busy}>
                  {submitting || createFillUp.isPending ? 'Saving…' : 'Save fill-up'}
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
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
