'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui';

export default function ExportMenu({ vehicleId }: { vehicleId: string }) {
  const backupUrl = useMemo(() => `/api/vehicles/${vehicleId}/export`, [vehicleId]);

  return (
    <a href={backupUrl} download>
      <Button type="button" variant="outline" size="sm">
        Download Backup
      </Button>
    </a>
  );
}
