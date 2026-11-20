'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import SavedRecordDialog from '@/components/car/records/SavedRecordDialog';
import RecordFields from '../records/RecordFields';
import { useUpdateVehicle } from '@/hooks';
import type { VehicleDto } from '@/queries/vehicles';

const inspectionDateFormat = new Intl.DateTimeFormat('fi-FI', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function VehicleDialog({
  vehicle,
  entry,
  canEdit,
  available,
  onClose,
  restoreFocus,
}: {
  vehicle: VehicleDto;
  entry: 'view' | 'edit';
  canEdit: boolean;
  available: boolean;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [baseline, setBaseline] = useState(() => vehicleDraft(vehicle));
  const [draft, setDraft] = useState(baseline);
  const update = useUpdateVehicle(vehicle.id);
  const patch = {
    name: draft.name !== baseline.name ? draft.name.trim() : undefined,
    make: draft.make !== baseline.make ? draft.make.trim() : undefined,
    model: draft.model !== baseline.model ? draft.model.trim() : undefined,
    year: draft.year !== baseline.year && draft.year ? Number(draft.year) : undefined,
    licensePlate:
      draft.licensePlate !== baseline.licensePlate ? draft.licensePlate.trim() || null : undefined,
    inspectionDueDate:
      draft.inspectionDueDate !== baseline.inspectionDueDate
        ? draft.inspectionDueDate || null
        : undefined,
    inspectionIntervalMonths: changedNumber(
      draft.inspectionIntervalMonths,
      baseline.inspectionIntervalMonths
    ),
    initialOdometer: changedNumber(draft.initialOdometer, baseline.initialOdometer),
  };
  const fields = [
    ['Name', vehicle.name],
    ['Make', vehicle.make],
    ['Model', vehicle.model],
    ['Model year', vehicle.year],
    ['Registration plate', vehicle.licensePlate],
    [
      'Saved inspection due date',
      vehicle.inspectionDueDate
        ? inspectionDateFormat.format(new Date(vehicle.inspectionDueDate))
        : null,
    ],
    [
      'Inspection interval',
      vehicle.inspectionIntervalMonths != null
        ? `${vehicle.inspectionIntervalMonths} months`
        : null,
    ],
    ['Initial odometer', vehicle.initialOdometer != null ? `${vehicle.initialOdometer} km` : null],
  ] as const;

  return (
    <SavedRecordDialog
      name="vehicle"
      vehicleId={vehicle.id}
      record={{ type: 'vehicle' }}
      entry={entry}
      identifier={[vehicle.name, vehicle.licensePlate].filter(Boolean).join(' · ')}
      summary={<RecordFields fields={fields} />}
      onClose={onClose}
      restoreFocus={restoreFocus}
      edit={{
        writable: canEdit,
        available,
        dirty: inputs.some(({ key }) => draft[key] !== baseline[key]),
        invalid: !draft.name.trim() || (Boolean(baseline.year) && !draft.year),
        saving: update.isPending,
        saved: update.isSuccess,
        reset: () => {
          const next = vehicleDraft(vehicle);
          setBaseline(next);
          setDraft(next);
        },
        save: async () => {
          await update.mutateAsync(patch);
          toast.success('Vehicle updated');
        },
      }}
    >
      {inputs.map(({ key, label, type, ...attributes }) => (
        <label key={key} className={`flex flex-col gap-1 ${key === 'name' ? 'sm:col-span-2' : ''}`}>
          <span className="text-sm">{label}</span>
          <input
            {...attributes}
            type={type}
            required={key === 'name' || (key === 'year' && Boolean(baseline.year))}
            inputMode={type === 'number' ? 'numeric' : undefined}
            className={`border rounded-md px-3 py-2 ${key === 'licensePlate' ? 'uppercase' : ''}`}
            value={draft[key]}
            onChange={event => setDraft({ ...draft, [key]: event.target.value })}
          />
        </label>
      ))}
    </SavedRecordDialog>
  );
}

function changedNumber(value: string, previous: string) {
  return value === previous ? undefined : value === '' ? null : Number(value);
}

function vehicleDraft(vehicle: VehicleDto) {
  return {
    name: vehicle.name,
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    year: vehicle.year?.toString() ?? '',
    licensePlate: vehicle.licensePlate ?? '',
    inspectionDueDate: vehicle.inspectionDueDate?.slice(0, 10) ?? '',
    inspectionIntervalMonths: vehicle.inspectionIntervalMonths?.toString() ?? '',
    initialOdometer: vehicle.initialOdometer?.toString() ?? '',
  };
}

const inputs = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'make', label: 'Make', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'year', label: 'Year', type: 'number', min: 1900 },
  {
    key: 'licensePlate',
    label: 'License plate',
    type: 'text',
    maxLength: 16,
    placeholder: 'ABC-123',
  },
  { key: 'inspectionDueDate', label: 'Inspection due date', type: 'date' },
  {
    key: 'inspectionIntervalMonths',
    label: 'Inspection interval (months)',
    type: 'number',
    min: 1,
    max: 60,
    placeholder: '12',
  },
  { key: 'initialOdometer', label: 'Initial Odometer', type: 'number', min: 0, placeholder: '0' },
] as const;
