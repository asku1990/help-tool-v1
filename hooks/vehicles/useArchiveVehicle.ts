import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { setVehicleArchived } from '@/queries/vehicles';

export function useArchiveVehicle(vehicleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => setVehicleArchived(vehicleId, archived),
    onSuccess: () =>
      Promise.all([
        // Returning to either list should not render its pre-mutation membership.
        client.resetQueries({ queryKey: vehicleKeys.list() }),
        client.invalidateQueries({ queryKey: vehicleKeys.detail(vehicleId) }),
      ]),
  });
}
