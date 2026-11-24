import { apiPut } from '@/lib/api/client';

export function setVehicleArchived(vehicleId: string, archived: boolean) {
  return apiPut<{ id: string }>(`/api/vehicles/${vehicleId}/archive`, { archived });
}
