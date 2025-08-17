'use client';

type BreakdownItem = { label: 'Fuel' | 'Maintenance' | 'Other'; amount: number };

export type CostSummaryProps = {
  costPerKmLifetime: number; // EUR per km
  costPerKm90d: number; // EUR per km
  spendMTD: number; // EUR
  spend30d: number; // EUR
  breakdown90d: BreakdownItem[];
};

export default function CostSummary({
  costPerKmLifetime,
  costPerKm90d,
  spendMTD,
  spend30d,
  breakdown90d,
}: CostSummaryProps) {
  const total = Math.max(
    0,
    breakdown90d.reduce((s, b) => s + (b.amount || 0), 0)
  );
  const parts = breakdown90d.map(b => ({ ...b, pct: total > 0 ? (b.amount / total) * 100 : 0 }));

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Lifetime cost per km"
          tooltip="(Fuel + non-fuel expenses) divided by total distance"
          value={formatCurrencyPerKm(costPerKmLifetime)}
        />
        <KpiCard
          label="Last 90 days cost per km"
          tooltip="Costs in the past 90 days divided by distance in the same period"
          value={formatCurrencyPerKm(costPerKm90d)}
        />
        <KpiCard label="Month-to-date spend" value={formatCurrency(spendMTD)} />
        <KpiCard label="Last 30 days spend" value={formatCurrency(spend30d)} />
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Cost breakdown (90d)</div>
        <div className="w-full h-3 rounded bg-gray-100 overflow-hidden flex">
          {parts.map(p => (
            <div
              key={p.label}
              className={barColor(p.label)}
              style={{ width: `${p.pct}%` }}
              aria-label={`${p.label} ${p.pct.toFixed(0)}%`}
              title={`${p.label}: ${formatCurrency(p.amount)} (${p.pct.toFixed(0)}%)`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
          {parts.map(p => (
            <div key={p.label} className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded ${dotColor(p.label)}`} />
              <span>{p.label}</span>
              <span className="text-gray-400">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1">
        <span title={tooltip}>{label}</span>
        {tooltip ? (
          <span
            aria-hidden
            title={tooltip}
            className="inline-block w-3 h-3 rounded-full bg-gray-300"
          />
        ) : null}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function barColor(label: BreakdownItem['label']): string {
  switch (label) {
    case 'Fuel':
      return 'bg-blue-500';
    case 'Maintenance':
      return 'bg-emerald-500';
    default:
      return 'bg-gray-400';
  }
}

function dotColor(label: BreakdownItem['label']): string {
  switch (label) {
    case 'Fuel':
      return 'bg-blue-500';
    case 'Maintenance':
      return 'bg-emerald-500';
    default:
      return 'bg-gray-400';
  }
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}

function formatCurrencyPerKm(n: number): string {
  if (!Number.isFinite(n)) return '—';
  // e.g. €0.123/km
  const eur = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
  return `${eur}/km`;
}
