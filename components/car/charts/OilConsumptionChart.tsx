'use client';

import { useMemo } from 'react';
import { useExpenses } from '@/hooks';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';

type OilConsumptionChartProps = {
  vehicleId: string;
};

export default function OilConsumptionChart({ vehicleId }: OilConsumptionChartProps) {
  const { data: expenseData } = useExpenses(vehicleId);

  const chartData = useMemo(() => {
    const expenses = expenseData?.expenses || [];
    // Filter for oil related expenses (those with liters)
    const oilExpenses = expenses
      .filter(e => (e.liters && e.liters > 0) || e.isOilChange)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (oilExpenses.length < 2) return [];

    const dataPoints = [];

    // Try to find a starting point. If the first record is an oil change, great.
    // If not, we might just track top-ups relative to each other?

    for (let i = 0; i < oilExpenses.length; i++) {
      const curr = oilExpenses[i];
      const prev = i > 0 ? oilExpenses[i - 1] : null;

      // If it's an oil change, it resets the consumption cycle usually?
      // Or we just plot the amount added.

      // Let's calculate consumption if we have a previous reading
      let consumption = 0;
      if (prev && curr.odometerKm && prev.odometerKm) {
        const dist = curr.odometerKm - prev.odometerKm;
        if (dist > 0 && curr.liters) {
          // Liters added * 10000 / distance
          consumption = (curr.liters / dist) * 10000;
        }
      }

      dataPoints.push({
        date: new Date(curr.date).toLocaleDateString(),
        liters: curr.liters || 0,
        odometer: curr.odometerKm,
        type: curr.isOilChange ? 'Change' : 'Top-up',
        consumption: consumption > 0 ? consumption : null, // L/10,000km
      });
    }

    return dataPoints;
  }, [expenseData]);

  const averageConsumption = useMemo(() => {
    const validPoints = chartData.filter(d => d.consumption !== null && d.consumption > 0);
    if (validPoints.length === 0) return 0;
    const sum = validPoints.reduce((acc, curr) => acc + (curr.consumption || 0), 0);
    return sum / validPoints.length;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Not enough data to calculate consumption.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis
              yAxisId="left"
              orientation="left"
              stroke="#8884d8"
              label={{ value: 'Liters', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#82ca9d"
              label={{ value: 'L/10k km', angle: 90, position: 'insideRight' }}
            />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="liters" name="Oil Added (L)" fill="#8884d8" barSize={20} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="consumption"
              name="Consumption (L/10k km)"
              stroke="#82ca9d"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-sm">
        <span className="font-medium">Average Consumption:</span> {averageConsumption.toFixed(2)}{' '}
        L/10,000km
      </div>
    </div>
  );
}
