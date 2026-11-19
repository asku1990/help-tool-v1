'use client';

import { DetailsDialogContent } from '@/components/car/records';
import { Dialog } from '@/components/ui';
import type { VehicleDto } from '@/queries/vehicles';

const inspectionDateFormat = new Intl.DateTimeFormat('fi-FI', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function VehicleDetailsDialog({
  vehicle,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  vehicle: VehicleDto;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onCloseAutoFocus: (_event: Event) => void;
}) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DetailsDialogContent
        title="Vehicle details"
        fields={fields}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </Dialog>
  );
}
