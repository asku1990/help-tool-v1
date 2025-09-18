import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fillUpKeys } from '@/queries/keys';
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

export function useUpdateFillUp(vehicleId: string, fillUpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<FillUpDto, 'id'>>) =>
      updateFillUp(vehicleId, fillUpId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: fillUpKeys.infiniteByVehicle(vehicleId) });
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
    },
  });
}

export type { FillUpDto };

export function useImportFillUps(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: Array<{
        date: string;
        odometerKm: number;
        liters: number;
        pricePerLiter: number;
        totalCost: number;
        isFull?: boolean;
        notes?: string;
      }>
    ) => {
      const results = await Promise.allSettled(
        rows.map(r =>
          createFillUp(vehicleId, {
            date: r.date,
            odometerKm: r.odometerKm,
            liters: r.liters,
            pricePerLiter: r.pricePerLiter,
            totalCost: r.totalCost,
            isFull: !!r.isFull,
            notes: r.notes,
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) {
        throw new Error(
          `Imported ${rows.length - failed}/${rows.length} fill-ups; ${failed} failed`
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fillUpKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: fillUpKeys.infiniteByVehicle(vehicleId) });
    },
  });
}
