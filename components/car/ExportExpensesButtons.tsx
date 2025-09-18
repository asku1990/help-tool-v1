'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui';

export default function ExportExpensesButtons({ vehicleId }: { vehicleId: string }) {
  const csvHref = useMemo(
    () => `/api/vehicles/${vehicleId}/expenses/export?format=csv`,
    [vehicleId]
  );

  return (
    <div className="inline-flex items-center gap-2">
      <Button asChild variant="outline" size="sm" title="Export expenses as CSV">
        <a href={csvHref} download>
          Export CSV
        </a>
      </Button>
    </div>
  );
}
