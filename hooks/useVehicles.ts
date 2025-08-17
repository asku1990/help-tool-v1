import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import { createVehicle, getVehicle, listVehicles, type VehicleDto } from '@/queries/vehicles';

export function useVehicles(enabled = true) {
  return useQuery({
    queryKey: vehicleKeys.list(),
    queryFn: listVehicles,
    enabled,
    staleTime: 30_000,
  });
}

export function useVehicle(vehicleId: string | undefined) {
  return useQuery({
    queryKey: vehicleId ? vehicleKeys.detail(vehicleId) : ['vehicles', 'detail', 'none'],
    enabled: !!vehicleId,
    queryFn: () => getVehicle(vehicleId as string),
    staleTime: 30_000,
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; make?: string; model?: string; year?: number }) =>
      createVehicle(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vehicleKeys.list() });
    },
  });
}

export type { VehicleDto };
