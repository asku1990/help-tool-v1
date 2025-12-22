import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTireSet, type TireStatus } from '@/queries/tires';

type UpdateTireSetPayload = {
  tireSetId: string;
  name?: string;
  type?: 'SUMMER' | 'WINTER' | 'ALL_SEASON';
  status?: TireStatus;
  purchaseDate?: string | null;
  notes?: string | null;
};

export function useUpdateTireSet(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tireSetId, ...payload }: UpdateTireSetPayload) =>
      updateTireSet(vehicleId, tireSetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
    },
  });
}
