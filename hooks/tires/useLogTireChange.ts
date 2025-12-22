import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logTireChange } from '@/queries/tires';

type LogTireChangePayload = {
  tireSetId: string;
  date: string;
  odometerKm: number;
  notes?: string;
};

export function useLogTireChange(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LogTireChangePayload) => logTireChange(vehicleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['tireChangeHistory', vehicleId] });
    },
  });
}
