import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fillUpKeys } from '@/queries/keys';
import { createFillUp, listFillUps, type FillUpDto } from '@/queries/fillups';

export function useFillUps(vehicleId: string) {
  return useQuery({
    queryKey: [...fillUpKeys.byVehicle(vehicleId)],
    queryFn: () => listFillUps(vehicleId),
    staleTime: 30_000,
    enabled: !!vehicleId,
  });
}

export function useInfiniteFillUps(vehicleId: string, pageSize = 5) {
  return useInfiniteQuery({
    queryKey: fillUpKeys.infiniteByVehicle(vehicleId),
    queryFn: ({ pageParam }) =>
      listFillUps(vehicleId, { cursor: pageParam as string | undefined, limit: pageSize }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !!vehicleId,
    staleTime: 30_000,
  });
}

export function useCreateFillUp(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<FillUpDto, 'id' | 'date'> & { date: string }) =>
      createFillUp(vehicleId, payload),
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
        isFull: payload.isFull,
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
    },
  });
}

export type { FillUpDto };
