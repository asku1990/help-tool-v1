import { useQuery } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { listVehicles } from '@/queries/vehicles';

export function useVehicles(enabled = true) {
  return useQuery({
    queryKey: vehicleKeys.list(),
    queryFn: listVehicles,
    enabled,
    staleTime: 30_000,
  });
}
