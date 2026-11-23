import { useQuery } from '@tanstack/react-query';
import { getTireChangeHistory } from '@/queries/tires';
import { tireKeys } from '@/queries/keys';

export function useTireChangeHistory(vehicleId: string) {
  return useQuery({
    queryKey: tireKeys.history(vehicleId),
    queryFn: () => getTireChangeHistory(vehicleId),
    enabled: !!vehicleId,
  });
}
