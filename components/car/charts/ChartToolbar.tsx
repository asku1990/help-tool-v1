'use client';

import type { ChartOptions } from './ConsumptionChart';

export default function ChartToolbar({
  options,
  onChange,
}: {
  options: ChartOptions;
  onChange: (_next: ChartOptions) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center mb-3">
      <label className="text-xs" htmlFor="chart-range">
        Range
      </label>
      <select
        id="chart-range"
        className="cursor-pointer rounded border px-2 py-1 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={options.rangeDays}
        onChange={e =>
          onChange({ ...options, rangeDays: Number(e.target.value) as ChartOptions['rangeDays'] })
        }
        aria-label="Range"
      >
        <option value={30}>30d</option>
        <option value={90}>90d</option>
        <option value={180}>180d</option>
        <option value={365}>1 year</option>
        <option value={730}>2 years</option>
        <option value={0}>All</option>
      </select>
    </div>
  );
}
