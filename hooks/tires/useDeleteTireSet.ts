import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tireKeys } from '@/queries/keys';
import { deleteTireSet } from '@/queries/tires';

export function useDeleteTireSet(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tireSetId: string) => deleteTireSet(vehicleId, tireSetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tireKeys.sets(vehicleId) });
      queryClient.invalidateQueries({ queryKey: tireKeys.history(vehicleId) });
    },
  });
}
