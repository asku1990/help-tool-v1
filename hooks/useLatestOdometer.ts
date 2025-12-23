'use client';

import { useExpenses } from './useExpenses';
import { useFillUps } from './useFillUps';
import { useVehicle } from './useVehicles';

/**
 * Returns the latest known odometer reading from fill-ups, expenses, or vehicle initial odometer.
 * Compares by date (most recent) rather than by odometer value.
 */
export function useLatestOdometer(vehicleId: string): number | null {
  const { data: fillUpsData } = useFillUps(vehicleId);
  const { data: expensesData } = useExpenses(vehicleId);
  const { data: vehicleData } = useVehicle(vehicleId);

  const fillUps = (fillUpsData?.fillUps || []) as Array<{ odometerKm: number; date: string }>;
  const expenses = expensesData?.expenses || [];
  const initialOdometer = vehicleData?.vehicle?.initialOdometer ?? null;

  // Get latest fill-up (already sorted by date desc)
  const latestFillUp = fillUps[0];
  // Get latest expense with odometer
  const latestExpenseWithOdo = expenses.find(e => e.odometerKm != null && e.odometerKm >= 0);

  // Compare by date to find the most recent reading
  // If same date, use higher odometer (since odometer only increases)
  if (latestFillUp?.odometerKm != null && latestExpenseWithOdo?.odometerKm != null) {
    const fillUpDate = new Date(latestFillUp.date).getTime();
    const expenseDate = new Date(latestExpenseWithOdo.date).getTime();
    if (fillUpDate !== expenseDate) {
      return fillUpDate > expenseDate ? latestFillUp.odometerKm : latestExpenseWithOdo.odometerKm;
    }
    // Same date - use higher odometer
    return Math.max(latestFillUp.odometerKm, latestExpenseWithOdo.odometerKm);
  }
  if (latestFillUp?.odometerKm != null) return latestFillUp.odometerKm;
  if (latestExpenseWithOdo?.odometerKm != null) return latestExpenseWithOdo.odometerKm;
  return initialOdometer;
}
