import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTireChangeLog } from '@/queries/tires';

export function useDeleteTireChangeLog(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => deleteTireChangeLog(vehicleId, logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['tireChangeHistory', vehicleId] });
    },
  });
}
