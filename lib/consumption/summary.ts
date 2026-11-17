import {
  buildConsumptionSegments,
  type ConsumptionFillUp,
  type ConsumptionSegment,
} from './segments';

type SummaryExpense = { date: string; category: string; amount: number };
type BreakdownItem = { label: 'Fuel' | 'Maintenance' | 'Other'; amount: number };

export type VehicleSummary = {
  segments: ConsumptionSegment[];
  costPerKmLifetime: number | null;
  costPerKm90d: number | null;
  spendMTD: number;
  spend30d: number;
  breakdown90d: BreakdownItem[];
};

export function computeVehicleSummary(
  fillUps: ConsumptionFillUp[],
  expenses: SummaryExpense[],
  now = new Date()
): VehicleSummary {
  const segments = buildConsumptionSegments(fillUps);
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = (date: string, from: Date) => new Date(date) >= from;
  const costPerKm = (from?: Date) => {
    const trips = segments.filter(s => !from || since(s.date, from));
    const distance = trips.reduce((sum, s) => sum + s.distanceKm, 0);
    if (distance <= 0) return null;
    const fuel = trips.reduce((sum, s) => sum + s.fuelCost, 0);
    const other = expenses
      .filter(e => e.category !== 'FUEL' && (!from || since(e.date, from)))
      .reduce((sum, e) => sum + e.amount, 0);
    return (fuel + other) / distance;
  };
  const spend = (from: Date) =>
    fillUps.filter(f => since(f.date, from)).reduce((sum, f) => sum + f.totalCost, 0) +
    expenses.filter(e => since(e.date, from)).reduce((sum, e) => sum + e.amount, 0);
  const recentExpenses = expenses.filter(e => since(e.date, d90));

  return {
    segments,
    costPerKmLifetime: costPerKm(),
    costPerKm90d: costPerKm(d90),
    spendMTD: spend(monthStart),
    spend30d: spend(d30),
    breakdown90d: [
      {
        label: 'Fuel',
        amount: fillUps.filter(f => since(f.date, d90)).reduce((sum, f) => sum + f.totalCost, 0),
      },
      {
        label: 'Maintenance',
        amount: recentExpenses
          .filter(e => e.category === 'MAINTENANCE')
          .reduce((sum, e) => sum + e.amount, 0),
      },
      {
        label: 'Other',
        amount: recentExpenses
          .filter(e => e.category !== 'MAINTENANCE' && e.category !== 'FUEL')
          .reduce((sum, e) => sum + e.amount, 0),
      },
    ],
  };
}
