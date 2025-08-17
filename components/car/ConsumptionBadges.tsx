'use client';

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
  const avg3 = average(segments.slice(-3).map(s => s.lPer100));
  const avg6 = average(segments.slice(-6).map(s => s.lPer100));
  const lifetime = average(segments.map(s => s.lPer100));
  const costPer100 = average(segments.slice(-3).map(s => s.costPer100));

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Badge label="Latest" value={formatNumber(latest, 2)} suffix=" L/100km" />
        <Badge label="Avg (3)" value={formatNumber(avg3, 2)} suffix=" L/100km" />
        <Badge label="Avg (6)" value={formatNumber(avg6, 2)} suffix=" L/100km" />
        <Badge label="Lifetime" value={formatNumber(lifetime, 2)} suffix=" L/100km" />
        <Badge label="Cost/100" value={formatCurrency(costPer100)} />
      </div>
    </div>
  );
}

function Badge({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold">
        {value}
        {suffix ? <span className="text-gray-600 font-normal">{suffix}</span> : null}
      </div>
    </div>
  );
}

function average(values: number[]): number {
  const arr = values.filter(v => Number.isFinite(v));
  if (arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatNumber(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}
