import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tireKeys } from '@/queries/keys';
import { deleteTireChangeLog } from '@/queries/tires';

export function useDeleteTireChangeLog(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => deleteTireChangeLog(vehicleId, logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tireKeys.sets(vehicleId) });
      queryClient.invalidateQueries({ queryKey: tireKeys.history(vehicleId) });
    },
  });
}
