import { apiGet } from '@/lib/api/client';
import type { VehicleSummary } from '@/lib/consumption';

export function getVehicleSummary(vehicleId: string) {
  return apiGet<VehicleSummary>(`/api/vehicles/${vehicleId}/summary`);
}
