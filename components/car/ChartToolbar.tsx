'use client';

import type { ChartOptions } from '@/components/car/charts/ConsumptionChart';

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
        className="border rounded px-2 py-1 text-sm"
        value={options.rangeDays}
        onChange={e =>
          onChange({ ...options, rangeDays: Number(e.target.value) as 30 | 90 | 180 | 0 })
        }
        aria-label="Range"
      >
        <option value={30}>30d</option>
        <option value={90}>90d</option>
        <option value={180}>180d</option>
        <option value={0}>All</option>
      </select>
    </div>
  );
}
