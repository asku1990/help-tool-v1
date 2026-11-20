'use client';

import { useState } from 'react';
import RecordAttachments from '@/components/car/attachments/RecordAttachments';
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
  const [attachmentBusy, setAttachmentBusy] = useState(false);
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
    <Dialog
      open={open}
      onOpenChange={next => {
        if (next || !attachmentBusy) onOpenChange(next);
      }}
    >
      <DetailsDialogContent
        title="Vehicle details"
        fields={fields}
        onCloseAutoFocus={onCloseAutoFocus}
        closeDisabled={attachmentBusy}
      >
        {open ? (
          <RecordAttachments
            key={vehicle.id}
            vehicleId={vehicle.id}
            record={{ type: 'vehicle' }}
            onUploadingChange={setAttachmentBusy}
          />
        ) : null}
      </DetailsDialogContent>
    </Dialog>
  );
}
