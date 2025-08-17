import { apiGet, apiPost } from '@/lib/api/client';

export type FillUpDto = {
  id: string;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  isFull: boolean;
  notes?: string;
};

export function listFillUps(vehicleId: string, params?: { cursor?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  const qs = search.toString();
  const url = qs
    ? `/api/vehicles/${vehicleId}/fillups?${qs}`
    : `/api/vehicles/${vehicleId}/fillups`;
  return apiGet<{ fillUps: FillUpDto[]; nextCursor: string | null }>(url);
}

export function createFillUp(
  vehicleId: string,
  payload: Omit<FillUpDto, 'id' | 'date'> & { date: string }
) {
  return apiPost<{ id: string }>(`/api/vehicles/${vehicleId}/fillups`, payload);
}
