import { apiGet } from '@/lib/api/client';
import type { VehicleDto } from './types';

export function getVehicle(vehicleId: string) {
  return apiGet<{ vehicle: VehicleDto & { canEdit: boolean; canWrite: boolean } }>(
    `/api/vehicles/${vehicleId}`
  );
}
