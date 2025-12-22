'use client';

import { useMemo } from 'react';
import { useExpenses, useFillUps } from '@/hooks';

type OilConsumptionChartProps = {
  vehicleId: string;
};

export default function OilConsumptionChart({ vehicleId }: OilConsumptionChartProps) {
  const { data: expenseData } = useExpenses(vehicleId);
  const { data: fillUpsData } = useFillUps(vehicleId);

  const oilSummary = useMemo(() => {
    const expenses = expenseData?.expenses || [];
    const fillUps = fillUpsData?.fillUps || [];

    // Get oil-related expenses sorted by date (newest first)
    const oilExpenses = expenses
      .filter(
        e =>
          e.category === 'OIL_CHANGE' || e.category === 'OIL_TOP_UP' || (e.liters && e.liters > 0)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Find last oil change
    const lastOilChange = oilExpenses.find(e => e.category === 'OIL_CHANGE');

    if (!lastOilChange) {
      return {
        lastOilChange: null,
        topUps: [],
        kmSinceChange: null,
        daysSinceChange: 0,
        totalTopUps: 0,
        consumption: null,
      };
    }

    // Get current odometer from the most recent reading (fill-up or expense) by date
    const latestFillUp = fillUps[0] as { odometerKm?: number; date: string } | undefined;
    const latestExpenseWithOdo = expenses.find(e => e.odometerKm && e.odometerKm > 0);

    // Use the more recent one by date; if same date, use higher odometer
    let currentOdometer: number | undefined;
    if (latestFillUp?.odometerKm && latestExpenseWithOdo?.odometerKm) {
      const fillUpDate = new Date(latestFillUp.date).getTime();
      const expenseDate = new Date(latestExpenseWithOdo.date).getTime();
      if (fillUpDate !== expenseDate) {
        currentOdometer =
          fillUpDate > expenseDate ? latestFillUp.odometerKm : latestExpenseWithOdo.odometerKm;
      } else {
        // Same date - use higher odometer (since odometer only increases)
        currentOdometer = Math.max(latestFillUp.odometerKm, latestExpenseWithOdo.odometerKm);
      }
    } else {
      currentOdometer = latestFillUp?.odometerKm || latestExpenseWithOdo?.odometerKm;
    }

    const lastChangeOdometer = lastOilChange.odometerKm;
    const kmSinceChange =
      currentOdometer !== undefined &&
      lastChangeOdometer !== undefined &&
      lastChangeOdometer !== null
        ? currentOdometer - lastChangeOdometer
        : null;

    // Get all top-ups since last oil change
    const topUps = oilExpenses.filter(
      e => e.category === 'OIL_TOP_UP' && new Date(e.date) > new Date(lastOilChange.date)
    );

    const totalTopUps = topUps.reduce((sum, e) => sum + (e.liters || 0), 0);

    // Calculate consumption rate
    const consumption =
      kmSinceChange && kmSinceChange > 0 && totalTopUps > 0
        ? (totalTopUps / kmSinceChange) * 10000
        : null;

    // Calculate days since last oil change
    const daysSinceChange = Math.floor(
      (Date.now() - new Date(lastOilChange.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      lastOilChange,
      topUps,
      kmSinceChange,
      daysSinceChange,
      totalTopUps,
      consumption,
    };
  }, [expenseData, fillUpsData]);

  if (!oilSummary.lastOilChange) {
    return (
      <div className="text-center text-gray-500 py-4">
        <p>No oil changes recorded yet.</p>
        <p className="text-xs mt-1">Add an expense with category OIL_CHANGE to start tracking.</p>
      </div>
    );
  }

  const { lastOilChange, topUps, kmSinceChange, daysSinceChange, totalTopUps, consumption } =
    oilSummary;

  return (
    <div className="space-y-4">
      {/* Last Oil Change */}
      <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/10">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Last Oil Change</p>
            <p className="font-semibold">{new Date(lastOilChange.date).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">at</p>
            <p className="font-semibold">{lastOilChange.odometerKm?.toLocaleString() ?? '—'} km</p>
          </div>
        </div>
      </div>

      {/* Since Last Change */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 border rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Days</p>
          <p className="text-xl font-semibold">{daysSinceChange}</p>
        </div>
        <div className="p-3 border rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Km</p>
          <p className="text-xl font-semibold">
            {kmSinceChange !== null ? kmSinceChange.toLocaleString() : '—'}
          </p>
        </div>
        <div className="p-3 border rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Topped up</p>
          <p className="text-xl font-semibold">
            {totalTopUps > 0 ? `${totalTopUps.toFixed(1)} L` : 'None'}
          </p>
        </div>
      </div>

      {/* Consumption Rate */}
      {consumption !== null && (
        <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-900/10">
          <p className="text-sm text-gray-600 dark:text-gray-400">Consumption Rate</p>
          <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
            {consumption.toFixed(2)} L / 10,000 km
          </p>
        </div>
      )}

      {/* Top-up History */}
      {topUps.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Top-ups since last change
          </p>
          <div className="space-y-1">
            {topUps.map(t => (
              <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                <span>{new Date(t.date).toLocaleDateString()}</span>
                <span className="font-medium">+{t.liters?.toFixed(1) ?? 0} L</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
