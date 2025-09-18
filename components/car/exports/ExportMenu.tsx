'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';

export default function ExportMenu({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const expensesCsv = useMemo(() => `/api/vehicles/${vehicleId}/expenses/export`, [vehicleId]);
  const fillupsCsv = useMemo(() => `/api/vehicles/${vehicleId}/fillups/export`, [vehicleId]);

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
        Export
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
          <path d="M5.25 7.5L10 12.25L14.75 7.5" fill="currentColor" />
        </svg>
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Export options"
          className="absolute right-0 mt-1 w-56 rounded-md border bg-white shadow-lg z-10"
          onMouseLeave={() => setOpen(false)}
        >
          <a
            role="menuitem"
            href={expensesCsv}
            download
            className="block px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            Expenses CSV
          </a>
          <a
            role="menuitem"
            href={fillupsCsv}
            download
            className="block px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            Fill-ups CSV
          </a>
        </div>
      ) : null}
    </div>
  );
}
