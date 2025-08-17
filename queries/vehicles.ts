import { apiGet, apiPost } from '@/lib/api/client';

export type VehicleDto = {
  id: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
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
}) {
  return apiPost<{ id: string }>('/api/vehicles', payload);
}
