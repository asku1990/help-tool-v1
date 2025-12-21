'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Cell,
} from 'recharts';
import { listTireSets, getTireChangeHistory } from '@/queries/tires';

type TireUsageChartProps = {
  vehicleId: string;
};

export default function TireUsageChart({ vehicleId }: TireUsageChartProps) {
  const { data: tireSetsData } = useQuery({
    queryKey: ['tireSets', vehicleId],
    queryFn: () => listTireSets(vehicleId),
  });

  const { data: historyData } = useQuery({
    queryKey: ['tireChangeHistory', vehicleId],
    queryFn: () => getTireChangeHistory(vehicleId),
  });

  const chartData = useMemo(() => {
    const tireSets = tireSetsData?.tireSets || [];
    const history = historyData?.history || [];

    if (tireSets.length === 0) return [];

    // Sort history by date
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate km driven per tire set
    const tireKmMap = new Map<string, number>();

    for (let i = 0; i < sortedHistory.length; i++) {
      const curr = sortedHistory[i];
      const next = sortedHistory[i + 1];

      if (next) {
        // This tire set was active from curr.odometerKm to next.odometerKm
        const kmDriven = next.odometerKm - curr.odometerKm;
        if (kmDriven > 0) {
          const existing = tireKmMap.get(curr.tireSetId) || 0;
          tireKmMap.set(curr.tireSetId, existing + kmDriven);
        }
      }
    }

    // Build chart data
    return tireSets.map(set => ({
      name: set.name,
      type: set.type,
      status: set.status,
      km: tireKmMap.get(set.id) || 0,
      isActive: set.status === 'ACTIVE',
    }));
  }, [tireSetsData, historyData]);

  if (chartData.length === 0) {
    return <div className="text-center text-gray-500 py-8">No tire sets to display.</div>;
  }

  const hasUsageData = chartData.some(d => d.km > 0);

  if (!hasUsageData) {
    return (
      <div className="text-center text-gray-500 py-8">
        No tire usage data yet. Swap tires with odometer readings to track usage.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" tickFormatter={v => `${v.toLocaleString()} km`} />
            <YAxis type="category" dataKey="name" width={120} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} km`, 'Distance']}
              labelFormatter={label => `Tire: ${label}`}
            />
            <Legend />
            <Bar dataKey="km" name="Distance Driven" barSize={20}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.isActive ? '#22c55e' : '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6b7280' }} />
          <span>Stored/Retired</span>
        </div>
      </div>
    </div>
  );
}
