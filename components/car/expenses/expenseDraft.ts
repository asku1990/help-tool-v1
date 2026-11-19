import type { UpdateExpenseInput } from '@/lib/expenses';
import type { ExpenseDto } from '@/queries/expenses';
import { parseRecordDecimal } from '../records/parseRecordDecimal';
import { parseRecordOdometer } from '../records/parseRecordOdometer';

export function toExpenseDraft(item: ExpenseDto) {
  return {
    date: item.date.slice(0, 10),
    category: item.category,
    amount: String(item.amount),
    vendor: item.vendor || '',
    odometerKm: item.odometerKm != null ? String(item.odometerKm) : '',
    liters: item.liters != null ? String(item.liters) : '',
    notes: item.notes || '',
  };
}

export function getExpenseDraftChanges(item: ExpenseDto, draft: ReturnType<typeof toExpenseDraft>) {
  const amount = parseRecordDecimal(draft.amount);
  const odometerKm = parseRecordOdometer(draft.odometerKm);
  const invalidOdometer = odometerKm === undefined;
  const liters = draft.liters ? parseRecordDecimal(draft.liters) : null;
  const patch: UpdateExpenseInput = {
    date: draft.date !== item.date.slice(0, 10) ? draft.date : undefined,
    category: draft.category !== item.category ? draft.category : undefined,
    amount: amount !== item.amount ? amount : undefined,
    vendor: draft.vendor !== (item.vendor || '') ? draft.vendor || null : undefined,
    odometerKm: odometerKm !== (item.odometerKm ?? null) ? odometerKm : undefined,
    liters: liters !== (item.liters ?? null) ? liters : undefined,
    notes: draft.notes !== (item.notes || '') ? draft.notes || null : undefined,
  };

  return {
    patch,
    invalidOdometer,
    hasChanges: invalidOdometer || Object.values(patch).some(value => value !== undefined),
  };
}
