'use client';

import { Button } from '@/components/ui';
import { recordActionClass } from '@/components/car/records';

export default function ExportMenu({ vehicleId }: { vehicleId: string }) {
  return (
    <Button asChild variant="ghost" className={recordActionClass}>
      <a href={`/api/vehicles/${vehicleId}/export`} download>
        Download backup
      </a>
    </Button>
  );
}
