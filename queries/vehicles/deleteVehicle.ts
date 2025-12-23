import { apiDelete } from '@/lib/api/client';

export function deleteVehicle(vehicleId: string) {
  return apiDelete<{ id: string }>(`/api/vehicles/${vehicleId}`);
}
