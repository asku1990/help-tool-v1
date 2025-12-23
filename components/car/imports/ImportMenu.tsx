'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import RestoreBackupDialog from './RestoreBackupDialog';

export default function ImportMenu({
  vehicleId,
  onImported,
}: {
  vehicleId: string;
  onImported?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Import Backup
      </Button>
      <RestoreBackupDialog
        forVehicleId={vehicleId}
        open={open}
        onOpenChange={setOpen}
        hideTrigger
        onRestored={onImported}
      />
    </>
  );
}
