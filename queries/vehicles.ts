import { apiGet, apiPost, apiPatch } from '@/lib/api/client';

export type VehicleDto = {
  id: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  licensePlate?: string | null;
  inspectionDueDate?: string | null;
  inspectionIntervalMonths?: number | null;
};

export function listVehicles() {
  return apiGet<{ vehicles: VehicleDto[] }>('/api/vehicles');
}

export function getVehicle(vehicleId: string) {
  return apiGet<{ vehicle: VehicleDto }>(`/api/vehicles/${vehicleId}`);
}

export function createVehicle(payload: {
  name: string;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  inspectionDueDate?: string;
  inspectionIntervalMonths?: number;
}) {
  return apiPost<{ id: string }>('/api/vehicles', payload);
}

export function updateVehicle(
  vehicleId: string,
  payload: Partial<{
    name: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string | null;
    inspectionDueDate: string | null;
    inspectionIntervalMonths: number | null;
  }>
) {
  return apiPatch<{ id: string }>(`/api/vehicles/${vehicleId}`, payload);
}
