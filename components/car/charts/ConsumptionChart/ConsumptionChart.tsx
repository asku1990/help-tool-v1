'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateFi } from '@/utils';
import { consumptionPer100 } from '@/lib/consumption';

export type ChartOptions = {
  rangeDays: 30 | 90 | 180 | 365 | 730 | 0; // 0 = All
};

export type SegmentPoint = {
  date: string;
  lPer100: number;
  distanceKm: number;
};

export type ConsumptionChartProps = {
  segments: SegmentPoint[];
  options?: ChartOptions;
};

export default function ConsumptionChart({ segments, options }: ConsumptionChartProps) {
  const [compact, setCompact] = useState(false);
  const rangeDays = options?.rangeDays ?? 0;
  const { points, avg } = useMemo(() => {
    const from = rangeDays ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : null;
    const filtered = segments
      .map(segment => ({ ...segment, timestamp: new Date(segment.date).getTime() }))
      .filter(
        segment =>
          Number.isFinite(segment.timestamp) && (from === null || segment.timestamp >= from)
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      points: filtered,
      avg: consumptionPer100(
        filtered.map(segment => ({
          distanceKm: segment.distanceKm,
          litersUsed: (segment.lPer100 * segment.distanceKm) / 100,
        }))
      ),
    };
  }, [segments, rangeDays]);

  if (!points.length) {
    return <div className="text-sm text-gray-500">No consumption data yet.</div>;
  }

  const values = points.map(point => point.lPer100);
  const ticks: number[] = [];
  const firstTimestamp = points[0].timestamp;
  const lastTimestamp = points[points.length - 1].timestamp;
  const firstDate = new Date(firstTimestamp);
  const spanDays = (lastTimestamp - firstTimestamp) / (24 * 60 * 60 * 1000);
  const showDays = spanDays <= 62;

  if (showDays) {
    const stepDays = spanDays <= 7 ? 1 : spanDays <= 21 ? 3 : 7;
    const day = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
    if (day.getTime() < firstTimestamp) day.setDate(day.getDate() + 1);
    while (day.getTime() <= lastTimestamp) {
      ticks.push(day.getTime());
      day.setDate(day.getDate() + stepDays);
    }
  } else {
    const maxTicks = 24;
    const lastDate = new Date(lastTimestamp);
    const monthSpan =
      (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
      lastDate.getMonth() -
      firstDate.getMonth();
    const stepMonths = Math.max(1, Math.ceil((monthSpan + 1) / maxTicks));
    const month = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    if (month.getTime() < firstTimestamp) month.setMonth(month.getMonth() + 1);
    while (month.getTime() <= lastTimestamp && ticks.length < maxTicks) {
      ticks.push(month.getTime());
      month.setMonth(month.getMonth() + stepMonths);
    }
  }
  // A single trip or a same-day history may not cross a calendar boundary.
  if (!ticks.length) ticks.push(firstTimestamp);

  return (
    <div className="min-w-0 bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
      <div className="text-sm font-medium mb-2">Consumption trend (L/100 km)</div>
      <div role="group" aria-label="Fuel consumption trend chart">
        <ResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          onResize={width => setCompact(width < 320)}
        >
          <LineChart
            data={points}
            margin={{ top: 16, right: 20, bottom: 20, left: compact ? 0 : 8 }}
          >
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={value => {
                const date = new Date(value);
                return showDays
                  ? `${date.getDate()}.${date.getMonth() + 1}.`
                  : `${date.getMonth() + 1}.${date.getFullYear()}`;
              }}
              tick={{ fontSize: 11 }}
              minTickGap={32}
              label={{ value: 'Date', position: 'insideBottom', offset: -12 }}
            />
            <YAxis
              width={compact ? 'auto' : 48}
              domain={['auto', 'auto']}
              tick={{ fontSize: 11 }}
              label={
                compact ? undefined : { value: 'L/100 km', angle: -90, position: 'insideLeft' }
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as
                  | (SegmentPoint & { timestamp: number })
                  | undefined;
                if (!active || !point) return null;

                return (
                  <div className="rounded-lg border bg-white p-3 text-sm shadow-sm">
                    <div className="font-medium">{formatDateFi(new Date(point.date))}</div>
                    <div>Consumption: {point.lPer100.toFixed(2)} L/100 km</div>
                    <div>Distance: {point.distanceKm.toLocaleString('fi-FI')} km</div>
                  </div>
                );
              }}
            />
            <ReferenceLine y={avg} stroke="#64748b" strokeDasharray="4 4" />
            <Line
              name="Consumption"
              dataKey="lPer100"
              type="linear"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Avg: {avg.toFixed(2)} L/100km • Min: {Math.min(...values).toFixed(2)} • Max:{' '}
        {Math.max(...values).toFixed(2)}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Dashed line: distance-weighted average. Hover or tap a point for trip details.
      </p>
    </div>
  );
}
