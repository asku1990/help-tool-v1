import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { createVehicle } from '@/queries/vehicles';

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      make?: string;
      model?: string;
      year?: number;
      licensePlate?: string;
      inspectionDueDate?: string;
      inspectionIntervalMonths?: number;
    }) => createVehicle(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vehicleKeys.list() });
    },
  });
}
