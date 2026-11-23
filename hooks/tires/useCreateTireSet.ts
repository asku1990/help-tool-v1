import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tireKeys } from '@/queries/keys';
import { createTireSet, type TireType } from '@/queries/tires';

type CreateTireSetPayload = {
  name: string;
  type: TireType;
  purchaseDate?: string;
  notes?: string;
};

export function useCreateTireSet(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTireSetPayload) => createTireSet(vehicleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tireKeys.sets(vehicleId) });
    },
  });
}
