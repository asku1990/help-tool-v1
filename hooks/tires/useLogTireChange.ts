import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tireKeys } from '@/queries/keys';
import { logTireChange } from '@/queries/tires';

type LogTireChangePayload = {
  tireSetId: string;
  date: string;
  odometerKm?: number | null;
  notes?: string;
};

export function useLogTireChange(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LogTireChangePayload) => logTireChange(vehicleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tireKeys.sets(vehicleId) });
      queryClient.invalidateQueries({ queryKey: tireKeys.history(vehicleId) });
    },
  });
}
