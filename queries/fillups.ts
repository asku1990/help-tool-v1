import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';

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

export type SegmentDto = {
  distanceKm: number;
  litersUsed: number;
  lPer100: number;
  fuelCost: number;
  costPer100: number;
  prevLPer100?: number;
};

export type FillUpWithSegmentDto = FillUpDto & { segment?: SegmentDto };

export function listFillUps(
  vehicleId: string,
  params?: { cursor?: string; limit?: number; withSegments?: boolean }
) {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  if (params?.withSegments) search.set('withSegments', '1');
  const qs = search.toString();
  const url = qs
    ? `/api/vehicles/${vehicleId}/fillups?${qs}`
    : `/api/vehicles/${vehicleId}/fillups`;
  return apiGet<{ fillUps: FillUpWithSegmentDto[]; nextCursor: string | null }>(url);
}

export function createFillUp(
  vehicleId: string,
  payload: Omit<FillUpDto, 'id' | 'date'> & { date: string }
) {
  return apiPost<{ id: string }>(`/api/vehicles/${vehicleId}/fillups`, payload);
}

export function updateFillUp(
  vehicleId: string,
  fillUpId: string,
  payload: Partial<{
    date: string;
    odometerKm: number;
    liters: number;
    pricePerLiter: number;
    totalCost: number;
    isFull: boolean;
    notes: string | null;
  }>
) {
  return apiPatch<{ id: string }>(`/api/vehicles/${vehicleId}/fillups/${fillUpId}`, payload);
}

export function deleteFillUp(vehicleId: string, fillUpId: string) {
  return apiDelete<{ id: string }>(`/api/vehicles/${vehicleId}/fillups/${fillUpId}`);
}
