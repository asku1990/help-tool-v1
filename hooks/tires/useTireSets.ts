import { useQuery } from '@tanstack/react-query';
import { listTireSets } from '@/queries/tires';

export function useTireSets(vehicleId: string) {
  return useQuery({
    queryKey: ['tireSets', vehicleId],
    queryFn: () => listTireSets(vehicleId),
    enabled: !!vehicleId,
  });
}
