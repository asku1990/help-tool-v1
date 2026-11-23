import type { QueryClient } from '@tanstack/react-query';
import { vehicleSummaryKeys } from '@/queries/keys';

export async function refreshVehicleSummary(client: QueryClient, vehicleId: string) {
  const query = { queryKey: vehicleSummaryKeys.byVehicle(vehicleId) };
  // Invalidation alone reuses an in-flight request if the cache has no summary yet.
  await client.cancelQueries(query);
  void client.invalidateQueries(query);
}
