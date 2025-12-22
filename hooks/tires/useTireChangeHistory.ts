import { useQuery } from '@tanstack/react-query';
import { getTireChangeHistory } from '@/queries/tires';

export function useTireChangeHistory(vehicleId: string) {
  return useQuery({
    queryKey: ['tireChangeHistory', vehicleId],
    queryFn: () => getTireChangeHistory(vehicleId),
    enabled: !!vehicleId,
  });
}
