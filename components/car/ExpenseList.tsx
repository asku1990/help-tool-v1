'use client';

import { useEffect, useMemo, useState } from 'react';

type Expense = {
  id: string;
  date: string;
  category: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
  amount: number;
  vendor?: string;
  odometerKm?: number;
  notes?: string;
};

export default function ExpenseList({
  vehicleId,
  refreshKey = 0,
}: {
  vehicleId: string;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/vehicles/${vehicleId}/expenses`);
        const json = await res.json();
        if (mounted) setItems(json.expenses || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [vehicleId, refreshKey]);

  const total = useMemo(() => items.reduce((s, e) => s + e.amount, 0), [items]);

  if (loading) return <div className="text-sm text-gray-500">Loading expenses…</div>;
  if (!items.length) return <div className="text-sm text-gray-500">No expenses yet.</div>;

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total: {formatCurrency(total)}</div>
      <ul className="divide-y">
        {items.map(e => (
          <li key={e.id} className="py-3 grid gap-2 sm:grid-cols-4 sm:items-center">
            <div className="text-sm">{formatDate(e.date)}</div>
            <div className="text-sm">
              <span className="inline-block rounded px-2 py-0.5 bg-gray-100 text-gray-700 text-xs">
                {e.category}
              </span>
              {e.vendor ? <span className="text-gray-600 text-xs ml-2">{e.vendor}</span> : null}
            </div>
            <div className="text-sm text-gray-600">
              {e.odometerKm ? `Odo: ${e.odometerKm} km` : ''}
            </div>
            <div className="text-sm font-medium sm:text-right">{formatCurrency(e.amount)}</div>
            {e.notes ? <div className="text-xs text-gray-500 sm:col-span-4">{e.notes}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}
