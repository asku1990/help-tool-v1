'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import ImportExpensesDialog from '@/components/car/expenses/ImportExpensesDialog';
import ImportFillUpsDialog from '@/components/car/fillups/ImportFillUpsDialog';

export default function ImportMenu({
  vehicleId,
  onExpensesImported,
  onFillUpsImported,
}: {
  vehicleId: string;
  onExpensesImported?: () => void;
  onFillUpsImported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [openExpenses, setOpenExpenses] = useState(false);
  const [openFillUps, setOpenFillUps] = useState(false);

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Import
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
          <path d="M5.25 7.5L10 12.25L14.75 7.5" fill="currentColor" />
        </svg>
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Import options"
          className="absolute right-0 mt-1 w-56 rounded-md border bg-white shadow-lg z-10"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            role="menuitem"
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              setOpen(false);
              setOpenExpenses(true);
            }}
          >
            Import Expenses CSV
          </button>
          <button
            role="menuitem"
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              setOpen(false);
              setOpenFillUps(true);
            }}
          >
            Import Fill-ups CSV
          </button>
        </div>
      ) : null}

      <ImportExpensesDialog
        vehicleId={vehicleId}
        open={openExpenses}
        onOpenChange={setOpenExpenses}
        hideTrigger
        onImported={onExpensesImported}
      />
      <ImportFillUpsDialog
        vehicleId={vehicleId}
        open={openFillUps}
        onOpenChange={setOpenFillUps}
        hideTrigger
        onImported={onFillUpsImported}
      />
    </div>
  );
}
