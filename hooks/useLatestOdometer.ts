'use client';

import { useExpenses, useFillUps } from '@/hooks';

/**
 * Returns the latest known odometer reading from fill-ups or expenses
 */
export function useLatestOdometer(vehicleId: string): number | null {
  const { data: fillUpsData } = useFillUps(vehicleId);
  const { data: expensesData } = useExpenses(vehicleId);

  const fillUps = (fillUpsData?.fillUps || []) as Array<{ odometerKm: number }>;
  const expenses = expensesData?.expenses || [];

  const latestFillUpOdo = fillUps[0]?.odometerKm;
  const latestExpenseOdo = expenses.find(e => e.odometerKm && e.odometerKm > 0)?.odometerKm;

  if (latestFillUpOdo && latestExpenseOdo) {
    return Math.max(latestFillUpOdo, latestExpenseOdo);
  }
  return latestFillUpOdo || latestExpenseOdo || null;
}
