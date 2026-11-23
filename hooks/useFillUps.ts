import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fillUpKeys, vehicleSummaryKeys } from '@/queries/keys';
import type { CreateFillUpInput, UpdateFillUpInput } from '@/lib/fillups';
import {
  createFillUp,
  listFillUps,
  updateFillUp,
  deleteFillUp,
  type FillUpDto,
} from '@/queries/fillups';

export function useFillUps(vehicleId: string) {
  return useQuery({
    queryKey: [...fillUpKeys.byVehicle(vehicleId)],
    queryFn: () => listFillUps(vehicleId, { withSegments: true }),
    staleTime: 30_000,
    enabled: !!vehicleId,
  });
}

export function useInfiniteFillUps(vehicleId: string, pageSize = 5) {
  return useInfiniteQuery({
    queryKey: fillUpKeys.infiniteByVehicle(vehicleId),
    queryFn: ({ pageParam }) =>
      listFillUps(vehicleId, {
        cursor: pageParam as string | undefined,
        limit: pageSize,
        withSegments: true,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !!vehicleId,
    staleTime: 30_000,
  });
}

export function useCreateFillUp(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFillUpInput) => createFillUp(vehicleId, payload),
    onMutate: async payload => {
      await qc.cancelQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      const previous = qc.getQueryData<{
        fillUps: FillUpDto[];
        nextCursor: string | null;
      }>(fillUpKeys.byVehicle(vehicleId));

      const optimisticItem: FillUpDto = {
        id: `temp-${Date.now()}`,
        date: payload.date,
        odometerKm: payload.odometerKm,
        liters: payload.liters,
        pricePerLiter: payload.pricePerLiter,
        totalCost: payload.totalCost,
        isFull: payload.isFull ?? false,
        notes: payload.notes,
      };

      qc.setQueryData(
        fillUpKeys.byVehicle(vehicleId),
        (old: { fillUps: FillUpDto[]; nextCursor?: string | null } | undefined) => ({
          fillUps: [optimisticItem, ...(old?.fillUps || [])],
          nextCursor: old?.nextCursor ?? null,
        })
      );

      return { previous } as const;
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(fillUpKeys.byVehicle(vehicleId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: fillUpKeys.infiniteByVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: vehicleSummaryKeys.byVehicle(vehicleId) });
    },
  });
}

export function useUpdateFillUp(vehicleId: string, fillUpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFillUpInput) => updateFillUp(vehicleId, fillUpId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: vehicleSummaryKeys.byVehicle(vehicleId) });
      // Only the refreshed list has both the saved fields and their corresponding trip figures.
      void qc.invalidateQueries({ queryKey: fillUpKeys.infiniteByVehicle(vehicleId) });
    },
  });
}

export function useDeleteFillUp(vehicleId: string, fillUpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteFillUp(vehicleId, fillUpId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: fillUpKeys.infiniteByVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: vehicleSummaryKeys.byVehicle(vehicleId) });
    },
  });
}

export type { FillUpDto };
