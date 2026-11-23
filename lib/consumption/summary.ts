import {
  buildConsumptionSegments,
  type ConsumptionFillUp,
  type ConsumptionSegment,
} from './segments';

type SummaryExpense = { date: string; category: string; amount: number };
type BreakdownItem = { label: 'Fuel' | 'Maintenance' | 'Other'; amount: number };

const reportingMonth = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Helsinki',
  year: 'numeric',
  month: '2-digit',
});

export type VehicleSummary = {
  segments: ConsumptionSegment[];
  fuelCostLifetime: number;
  expenseTotalLifetime: number;
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
  const currentMonth = reportingMonth.format(now);
  const isCurrentMonth = (date: string) => reportingMonth.format(new Date(date)) === currentMonth;
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
  const spend = (matches: (_date: string) => boolean) =>
    fillUps.filter(f => matches(f.date)).reduce((sum, f) => sum + f.totalCost, 0) +
    expenses.filter(e => matches(e.date)).reduce((sum, e) => sum + e.amount, 0);
  const recentExpenses = expenses.filter(e => since(e.date, d90));

  return {
    segments,
    fuelCostLifetime: fillUps.reduce((sum, fillUp) => sum + fillUp.totalCost, 0),
    expenseTotalLifetime: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    costPerKmLifetime: costPerKm(),
    costPerKm90d: costPerKm(d90),
    spendMTD: spend(isCurrentMonth),
    spend30d: spend(date => since(date, d30)),
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
