import { apiGet, apiPost } from '@/lib/api/client';

export type ExpenseDto = {
  id: string;
  date: string;
  category: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
  amount: number;
  vendor?: string;
  odometerKm?: number;
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
  return apiGet<{ expenses: ExpenseDto[]; expensesTotal: number; nextCursor: string | null }>(url);
}

export function createExpense(
  vehicleId: string,
  payload: Omit<ExpenseDto, 'id' | 'date'> & { date: string }
) {
  return apiPost<{ id: string }>(`/api/vehicles/${vehicleId}/expenses`, payload);
}
