'use client';

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useUpdateFillUp } from '@/hooks';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { formatDateFi } from '@/utils';
import { RecordFields } from '../records/DetailsDialogContent';
import { recordFields } from '../records/RecordSummaryButton';
import SavedRecordDialog from '../records/SavedRecordDialog';
import type { ListedRecordDialogProps } from '../records/useListedRecordDialog';
import { getFillUpDraftChanges, toFillUpDraft } from './fillUpDraft';

export default function FillUpDialog({
  vehicleId,
  item,
  entry,
  canWrite,
  canStartEdit,
  onClose,
  restoreFocus,
}: ListedRecordDialogProps<FillUpWithSegmentDto>) {
  const errorId = useId();
  const [baseline, setBaseline] = useState(item);
  const [draft, setDraft] = useState(() => toFillUpDraft(item));
  const { patch, invalidOdometer, hasChanges, total } = getFillUpDraftChanges(baseline, draft);
  const update = useUpdateFillUp(vehicleId, item.id);
  return (
    <SavedRecordDialog
      name="fill-up"
      entry={entry}
      vehicleId={vehicleId}
      record={{ type: 'fillup', id: item.id }}
      identifier={`${item.odometerKm} km · ${formatDateFi(new Date(item.date))}`}
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
          setDraft(toFillUpDraft(item));
        },
        save: async () => {
          await update.mutateAsync(patch);
          toast.success('Fill-up updated');
        },
      }}
      summary={<RecordFields fields={recordFields({ type: 'fillup', item, vehicleId })} />}
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
        <span className="text-sm">Odometer km</span>
        <input
          inputMode="numeric"
          aria-invalid={invalidOdometer}
          aria-describedby={invalidOdometer ? errorId : undefined}
          className="border rounded-md px-3 py-2"
          value={draft.odometerKm}
          onChange={e => setDraft(s => ({ ...s, odometerKm: e.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Liters</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          className="border rounded-md px-3 py-2"
          value={draft.liters}
          onChange={e => setDraft(s => ({ ...s, liters: e.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Price per liter</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          className="border rounded-md px-3 py-2"
          value={draft.pricePerLiter}
          onChange={e => setDraft(s => ({ ...s, pricePerLiter: e.target.value }))}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={draft.isFull}
          onChange={e => setDraft(s => ({ ...s, isFull: e.target.checked }))}
        />{' '}
        Full tank?
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm">Notes</span>
        <textarea
          rows={3}
          className="border rounded-md px-3 py-2"
          value={draft.notes}
          onChange={e => setDraft(s => ({ ...s, notes: e.target.value }))}
        />
      </label>
      {invalidOdometer && (
        <p id={errorId} className="sm:col-span-2 text-sm text-red-600">
          Enter a whole number from −2,147,483,648 to 2,147,483,647.
        </p>
      )}
      <p className="sm:col-span-2 text-sm text-gray-500">
        Total: {Number.isFinite(total) ? total.toFixed(2) : '0.00'}
      </p>
    </SavedRecordDialog>
  );
}
