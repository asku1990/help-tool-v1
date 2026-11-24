import { useQuery } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { listVehicles, type VehicleStatus } from '@/queries/vehicles';

export function useVehicles(enabled = true, status: VehicleStatus = 'active') {
  return useQuery({
    queryKey: vehicleKeys.byStatus(status),
    queryFn: () => listVehicles(status),
    enabled,
  });
}
