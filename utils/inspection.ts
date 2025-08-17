export type InspectionState = 'overdue' | 'dueSoon' | 'ok' | 'unknown';

// Normalize a month number to the 0–11 range, handling negative values.
function normalizeMonth(month: number): number {
  return ((month % 12) + 12) % 12;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // Handle month overflow (e.g., adding to Jan 31 → Mar 03). Clamp to last day of the month.
  // If the resulting month is not the normalized target month, the day overflowed (e.g., Feb 31 → Mar 03).
  if (d.getMonth() !== normalizeMonth(targetMonth)) {
    d.setDate(0); // Set to last day of previous month (i.e., the intended month)
  }
  return d;
}

export function diffDays(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((end - start) / msPerDay);
}

export function computeInspectionDueDate(options: {
  inspectionDueDate?: Date | null;
  lastInspectionDate?: Date | null;
  inspectionIntervalMonths?: number | null;
}): Date | null {
  const { inspectionDueDate, lastInspectionDate, inspectionIntervalMonths } = options;
  if (inspectionDueDate) return inspectionDueDate;
  if (lastInspectionDate) {
    const interval =
      typeof inspectionIntervalMonths === 'number' && inspectionIntervalMonths > 0
        ? inspectionIntervalMonths
        : 12;
    return addMonths(lastInspectionDate, interval);
  }
  return null;
}

export function computeInspectionStatus(options: {
  inspectionDueDate?: Date | null;
  lastInspectionDate?: Date | null;
  inspectionIntervalMonths?: number | null;
  today?: Date;
}): { state: InspectionState; daysRemaining: number | null; dueDate: Date | null } {
  const { today = new Date(), ...rest } = options;
  const due = computeInspectionDueDate(rest);
  if (!due) return { state: 'unknown', daysRemaining: null, dueDate: null };
  const days = diffDays(today, due);
  if (days < 0) return { state: 'overdue', daysRemaining: days, dueDate: due };
  if (days <= 30) return { state: 'dueSoon', daysRemaining: days, dueDate: due };
  return { state: 'ok', daysRemaining: days, dueDate: due };
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function pickLastInspectionDateFromExpenses(
  expenses: Array<{ date: string; category: string; vendor?: string | null; notes?: string | null }>
): Date | null {
  const isInspectionLike = (s?: string | null) =>
    !!s && /inspection|itv|mot|tuv|controle technique/i.test(s);
  const candidates = expenses
    .filter(
      e => e.category === 'MAINTENANCE' || isInspectionLike(e.vendor) || isInspectionLike(e.notes)
    )
    .filter(e => isInspectionLike(e.vendor) || isInspectionLike(e.notes))
    .map(e => new Date(e.date))
    .filter(d => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return candidates[0] || null;
}
