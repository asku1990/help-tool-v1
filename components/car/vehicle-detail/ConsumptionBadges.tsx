'use client';

import { consumptionPer100, fuelCostPer100 } from '@/lib/consumption';
import { Card } from '@/components/ui';

type Segment = {
  date: string;
  distanceKm: number;
  litersUsed: number;
  lPer100: number;
  fuelCost: number;
  costPer100: number;
};

export default function ConsumptionBadges({ segments }: { segments: Segment[] }) {
  const latest = segments[segments.length - 1]?.lPer100;
  const avg3 = consumptionPer100(segments.slice(-3));
  const avg6 = consumptionPer100(segments.slice(-6));
  const lifetime = consumptionPer100(segments);
  const costPer100 = fuelCostPer100(segments.slice(-3));

  return (
    <Card variant="subtle" className="p-4">
      <h2 className="mb-3 text-lg font-semibold">Fuel consumption</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Badge label="Latest" value={formatNumber(latest, 2)} suffix=" L/100km" />
        <Badge label="Avg (3)" value={formatNumber(avg3, 2)} suffix=" L/100km" />
        <Badge label="Avg (6)" value={formatNumber(avg6, 2)} suffix=" L/100km" />
        <Badge label="Lifetime" value={formatNumber(lifetime, 2)} suffix=" L/100km" />
        <Badge label="Cost/100" value={formatCurrency(costPer100)} />
      </div>
    </Card>
  );
}

function Badge({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">
        {value}
        {suffix ? <span className="font-normal text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function formatNumber(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}
