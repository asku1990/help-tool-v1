import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTireChangeLog } from '@/queries/tires';

type UpdateTireChangeLogPayload = {
  logId: string;
  date?: string;
  odometerKm?: number;
  notes?: string | null;
};

export function useUpdateTireChangeLog(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, ...payload }: UpdateTireChangeLogPayload) =>
      updateTireChangeLog(vehicleId, logId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['tireChangeHistory', vehicleId] });
    },
  });
}
