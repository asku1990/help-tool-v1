import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { setVehicleArchived } from '@/queries/vehicles';

export function useArchiveVehicle(vehicleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => setVehicleArchived(vehicleId, archived),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: vehicleKeys.list() }),
        client.invalidateQueries({ queryKey: vehicleKeys.detail(vehicleId) }),
      ]),
  });
}
