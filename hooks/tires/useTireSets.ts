import { useQuery } from '@tanstack/react-query';
import { listTireSets } from '@/queries/tires';
import { tireKeys } from '@/queries/keys';

export function useTireSets(vehicleId: string) {
  return useQuery({
    queryKey: tireKeys.sets(vehicleId),
    queryFn: () => listTireSets(vehicleId),
    enabled: !!vehicleId,
  });
}
