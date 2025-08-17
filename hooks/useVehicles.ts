import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from '@/queries/keys';
import {
  createVehicle,
  getVehicle,
  listVehicles,
  updateVehicle,
  type VehicleDto,
} from '@/queries/vehicles';

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
      }>
    ) => updateVehicle(vehicleId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vehicleKeys.detail(vehicleId) });
      qc.invalidateQueries({ queryKey: vehicleKeys.list() });
    },
  });
}

export type { VehicleDto };
