import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';

export type TireType = 'SUMMER' | 'WINTER' | 'ALL_SEASON';
export type TireStatus = 'ACTIVE' | 'STORED' | 'RETIRED';

export type TireChangeLogDto = {
  id: string;
  vehicleId: string;
  tireSetId: string;
  date: string;
  odometerKm: number;
  notes?: string | null;
};

export type TireSetDto = {
  id: string;
  vehicleId: string;
  name: string;
  type: TireType;
  status: TireStatus;
  purchaseDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  changeLogs?: TireChangeLogDto[];
};

export function listTireSets(vehicleId: string) {
  return apiGet<{ tireSets: TireSetDto[] }>(`/api/vehicles/${vehicleId}/tires`);
}

export function createTireSet(
  vehicleId: string,
  payload: {
    name: string;
    type: TireType;
    status?: TireStatus;
    purchaseDate?: string;
    notes?: string;
  }
) {
  return apiPost<{ id: string }>(`/api/vehicles/${vehicleId}/tires`, payload);
}

export function updateTireSet(
  vehicleId: string,
  tireSetId: string,
  payload: Partial<{
    name: string;
    type: TireType;
    status: TireStatus;
    inspectionDueDate: string | null;
    inspectionIntervalMonths: number | null;
    initialOdometer: number | null;
  }>
) {
  return apiPatch<{ id: string }>(`/api/vehicles/${vehicleId}/tires/${tireSetId}`, payload);
}

export function deleteTireSet(vehicleId: string, tireSetId: string) {
  return apiDelete<{ id: string }>(`/api/vehicles/${vehicleId}/tires/${tireSetId}`);
}

export function logTireChange(
  vehicleId: string,
  payload: {
    tireSetId: string;
    date: string;
    odometerKm: number;
    notes?: string;
  }
) {
  return apiPost<{ id: string }>(`/api/vehicles/${vehicleId}/tires/change-log`, payload);
}

export function getTireChangeHistory(vehicleId: string) {
  return apiGet<{ history: TireChangeLogDto[] }>(`/api/vehicles/${vehicleId}/tires/change-log`);
}
