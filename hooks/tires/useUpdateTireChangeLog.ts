import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tireKeys } from '@/queries/keys';
import { updateTireChangeLog } from '@/queries/tires';

type UpdateTireChangeLogPayload = {
  logId: string;
  date?: string;
  odometerKm?: number | null;
  notes?: string | null;
};

export function useUpdateTireChangeLog(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, ...payload }: UpdateTireChangeLogPayload) =>
      updateTireChangeLog(vehicleId, logId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tireKeys.sets(vehicleId) });
      queryClient.invalidateQueries({ queryKey: tireKeys.history(vehicleId) });
    },
  });
}
