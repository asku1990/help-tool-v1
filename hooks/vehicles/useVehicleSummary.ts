import { useQuery } from '@tanstack/react-query';
import { getVehicleSummary } from '@/queries/vehicles';
import { vehicleSummaryKeys } from '@/queries/keys';

export function useVehicleSummary(vehicleId: string) {
  return useQuery({
    queryKey: vehicleSummaryKeys.byVehicle(vehicleId),
    queryFn: () => getVehicleSummary(vehicleId),
    enabled: !!vehicleId,
  });
}
