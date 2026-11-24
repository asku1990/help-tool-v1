import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { createVehicle } from '@/queries/vehicles';

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createVehicle,
    // A lost response does not mean the vehicle was not created.
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vehicleKeys.list() });
    },
  });
}
