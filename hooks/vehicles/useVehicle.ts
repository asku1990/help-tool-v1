import { useQuery } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { getVehicle } from '@/queries/vehicles';

export function useVehicle(vehicleId: string | undefined) {
  return useQuery({
    queryKey: vehicleId ? vehicleKeys.detail(vehicleId) : ['vehicles', 'detail', 'none'],
    enabled: !!vehicleId,
    queryFn: () => getVehicle(vehicleId ?? ''),
    staleTime: 30_000,
  });
}
