import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { updateVehicle } from '@/queries/vehicles';

export function useUpdateVehicle(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Partial<{
        name: string;
        make: string;
        model: string;
        year: number;
        licensePlate: string | null;
        inspectionDueDate: string | null;
        inspectionIntervalMonths: number | null;
        initialOdometer: number | null;
      }>
    ) => updateVehicle(vehicleId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vehicleKeys.detail(vehicleId) });
      qc.invalidateQueries({ queryKey: vehicleKeys.list() });
    },
  });
}
