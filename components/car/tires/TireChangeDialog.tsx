import { toast } from 'sonner';
import { useLogTireChange, useUpdateTireChangeLog } from '@/hooks';
import type { TireChangeLogDto, TireSetDto } from '@/queries/tires';
import { TireEditorDialog, readTireField, tireFieldClass } from './TireEditorDialog';
import { tireDateInput, tireTypeLabels } from './tireDisplay';

export type TireChangeEditor =
  | { kind: 'mount'; setId?: string }
  | { kind: 'change'; log: TireChangeLogDto };

export function TireChangeDialog({
  vehicleId,
  editor,
  stored,
  mountedName,
  onMounted,
  onClose,
  onCloseAutoFocus,
}: {
  vehicleId: string;
  editor: TireChangeEditor;
  stored: readonly TireSetDto[];
  mountedName?: string;
  onMounted: () => void;
  onClose: () => void;
  onCloseAutoFocus: (_event: Event) => void;
}) {
  const mountSet = useLogTireChange(vehicleId);
  const updateChange = useUpdateTireChangeLog(vehicleId);
  const log = editor.kind === 'change' ? editor.log : undefined;
  const initialReading = log?.odometerConfirmed ? log.odometerKm : null;
  const mountLabel = mountedName ? 'Change tires' : 'Mount tire set';

  async function saveChange(fields: FormData) {
    const date = readTireField(fields, 'date');
    const odometer = readTireField(fields, 'odometer');
    const notes = readTireField(fields, 'notes');
    const odometerKm = odometer ? Number(odometer) : null;
    if (
      !date ||
      (odometerKm !== null &&
        (!Number.isInteger(odometerKm) || odometerKm < 0 || odometerKm > 2_147_483_647))
    ) {
      throw new Error('Enter a date and, if known, a valid whole-number odometer reading.');
    }
    if (log) {
      await updateChange.mutateAsync({
        logId: log.id,
        ...(date !== tireDateInput(log.date) ? { date } : {}),
        ...(odometerKm !== initialReading ? { odometerKm } : {}),
        notes: notes || null,
      });
      toast.success('Tire change updated');
      return;
    }
    const tireSetId = readTireField(fields, 'setId');
    if (!stored.some(set => set.id === tireSetId))
      throw new Error('Choose a stored tire set to mount.');
    await mountSet.mutateAsync({ tireSetId, date, odometerKm, ...(notes ? { notes } : {}) });
    onMounted();
    toast.success(mountedName ? 'Tire change logged' : 'Tire set mounted');
  }

  return (
    <TireEditorDialog
      title={log ? 'Edit tire change' : mountLabel}
      description={
        log
          ? 'Update the recorded date, odometer, or notes.'
          : mountedName
            ? `If this is the latest change, ${mountedName} will move to storage.`
            : 'Record when this set was installed.'
      }
      submitLabel={log ? 'Save changes' : mountedName ? 'Confirm change' : mountLabel}
      onSave={saveChange}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {editor.kind === 'mount' && (
        <label className="block text-sm font-medium">
          Set to mount
          <select
            className={tireFieldClass}
            name="setId"
            required
            defaultValue={editor.setId ?? ''}
          >
            <option value="">Choose a set</option>
            {stored.map(set => (
              <option key={set.id} value={set.id}>
                {set.name} ({tireTypeLabels[set.type]})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">
        Date
        <input
          className={tireFieldClass}
          type="date"
          name="date"
          required
          defaultValue={tireDateInput(log?.date ?? new Date().toISOString())}
        />
      </label>
      <label className="block text-sm font-medium">
        Car odometer at tire change (km, optional)
        <input
          className={tireFieldClass}
          type="number"
          name="odometer"
          min={0}
          max={2_147_483_647}
          step={1}
          defaultValue={initialReading ?? ''}
        />
        {log && !log.odometerConfirmed && log.odometerKm != null && (
          <span className="mt-1 block font-normal text-muted-foreground">
            Previous reading: {log.odometerKm.toLocaleString()} km (unverified). Enter the exact
            reading to confirm it, or leave blank to keep the old value.
          </span>
        )}
      </label>
      <label className="block text-sm font-medium">
        Notes (optional)
        <textarea
          className={tireFieldClass}
          name="notes"
          maxLength={500}
          rows={3}
          defaultValue={log?.notes ?? ''}
          placeholder="e.g. Switched to winter tires before a trip"
        />
      </label>
    </TireEditorDialog>
  );
}
