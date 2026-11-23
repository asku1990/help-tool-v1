import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseKeys, fillUpKeys, tireKeys, vehicleKeys } from '@/queries/keys';
import { deleteVehicle } from '@/queries/vehicles';

export function useDeleteVehicle(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteVehicle(vehicleId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: vehicleKeys.detail(vehicleId) });
      qc.removeQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      qc.removeQueries({ queryKey: fillUpKeys.infiniteByVehicle(vehicleId) });
      qc.removeQueries({ queryKey: expenseKeys.byVehicle(vehicleId) });
      qc.removeQueries({ queryKey: expenseKeys.infiniteByVehicle(vehicleId) });
      qc.removeQueries({ queryKey: tireKeys.sets(vehicleId) });
      qc.removeQueries({ queryKey: tireKeys.history(vehicleId) });

      qc.invalidateQueries({ queryKey: vehicleKeys.list() });
    },
  });
}
