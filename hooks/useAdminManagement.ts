import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminKeys } from '@/queries/keys';
import {
  getAdminVehicleAccess,
  listAdminUsers,
  listAdminVehicles,
  revokeAdminVehicleAccess,
  upsertAdminVehicleAccess,
  type VehicleAccessItem,
} from '@/queries/admin';

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: listAdminUsers,
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminVehicles(enabled = true) {
  return useQuery({
    queryKey: adminKeys.vehicles(),
    queryFn: listAdminVehicles,
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminVehicleAccess(vehicleId: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.vehicleAccess(vehicleId),
    queryFn: () => getAdminVehicleAccess(vehicleId),
    enabled: enabled && !!vehicleId,
    staleTime: 15_000,
  });
}

export function useUpsertAdminVehicleAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { vehicleId: string; userId: string; role: VehicleAccessItem['role'] }) =>
      upsertAdminVehicleAccess(payload.vehicleId, { userId: payload.userId, role: payload.role }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: adminKeys.vehicleAccess(variables.vehicleId) });
      qc.invalidateQueries({ queryKey: adminKeys.vehicles() });
    },
  });
}

export function useRevokeAdminVehicleAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { vehicleId: string; userId: string }) =>
      revokeAdminVehicleAccess(payload.vehicleId, payload.userId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: adminKeys.vehicleAccess(variables.vehicleId) });
      qc.invalidateQueries({ queryKey: adminKeys.vehicles() });
    },
  });
}
