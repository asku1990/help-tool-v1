'use client';

import { useEffect, useMemo, useState } from 'react';

type FillUp = {
  id: string;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  isFull: boolean;
  notes?: string;
};

export default function FillUpList({
  vehicleId,
  refreshKey = 0,
}: {
  vehicleId: string;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<FillUp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/vehicles/${vehicleId}/fillups`);
        const json = await res.json();
        if (mounted) setItems(json.fillUps || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [vehicleId, refreshKey]);

  const totalFuelCost = useMemo(() => items.reduce((s, f) => s + f.totalCost, 0), [items]);

  if (loading) return <div className="text-sm text-gray-500">Loading fill-ups…</div>;
  if (!items.length) return <div className="text-sm text-gray-500">No fill-ups yet.</div>;

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Total fuel cost: {formatCurrency(totalFuelCost)}</div>
      <ul className="divide-y">
        {items.map(f => (
          <li key={f.id} className="py-3 grid gap-2 sm:grid-cols-4 sm:items-center">
            <div className="text-sm">{formatDate(f.date)}</div>
            <div className="text-sm text-gray-600">Odo: {f.odometerKm} km</div>
            <div className="text-sm text-gray-600">
              {f.liters} L @ {f.pricePerLiter.toFixed(3)} →{' '}
              <span className="font-medium">{formatCurrency(f.totalCost)}</span>
            </div>
            <div className="text-xs text-gray-500 sm:text-right">
              {f.isFull ? 'Full tank' : 'Partial'}
              {f.notes ? ` • ${f.notes}` : ''}
            </div>
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
