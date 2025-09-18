'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui';

export default function ExportFillUpsButton({ vehicleId }: { vehicleId: string }) {
  const href = useMemo(() => `/api/vehicles/${vehicleId}/fillups/export`, [vehicleId]);
  return (
    <Button asChild variant="outline" size="sm" title="Export fill-ups as CSV">
      <a href={href} download>
        Export fill-ups CSV
      </a>
    </Button>
  );
}
