'use client';

import { Button } from '@/components/ui';
import { recordActionClass } from '@/components/car/records';

export default function ExportMenu({ vehicleId }: { vehicleId: string }) {
  const href = `/api/vehicles/${vehicleId}/export`;
  return (
    <>
      <Button asChild variant="ghost" className={recordActionClass}>
        <a href={href} download>
          Download backup
        </a>
      </Button>
      <Button asChild variant="ghost" className={recordActionClass}>
        <a href={`${href}?format=spreadsheet`} download>
          Download for spreadsheet
        </a>
      </Button>
    </>
  );
}
