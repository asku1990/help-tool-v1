import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@/lib/expenses';
import type { ExpenseCategory } from '@/utils/expenses';

export type ExpenseDto = {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  vendor?: string;
  odometerKm?: number;
  liters?: number;
  oilConsumption?: number; // L/10,000km at time of top-up
  notes?: string;
};

export function listExpenses(vehicleId: string, params?: { cursor?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  const qs = search.toString();
  const url = qs
    ? `/api/vehicles/${vehicleId}/expenses?${qs}`
    : `/api/vehicles/${vehicleId}/expenses`;
  return apiGet<{
    expenses: ExpenseDto[];
    expensesTotal: number;
    nextCursor: string | null;
    canWrite: boolean;
  }>(url);
}

export function createExpense(
  vehicleId: string,
  // Legacy imports still send this field; the server derives the figure independently.
  payload: CreateExpenseInput & { oilConsumption?: number }
) {
  return apiPost<{ id: string }>(`/api/vehicles/${vehicleId}/expenses`, payload);
}

export function updateExpense(vehicleId: string, expenseId: string, payload: UpdateExpenseInput) {
  return apiPatch<{ id: string }>(`/api/vehicles/${vehicleId}/expenses/${expenseId}`, payload);
}

export function deleteExpense(vehicleId: string, expenseId: string) {
  return apiDelete<{ id: string }>(`/api/vehicles/${vehicleId}/expenses/${expenseId}`);
}
