import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseKeys } from '@/queries/keys';
import {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
  type ExpenseDto,
} from '@/queries/expenses';

export function useExpenses(vehicleId: string) {
  return useQuery({
    queryKey: [...expenseKeys.byVehicle(vehicleId)],
    queryFn: () => listExpenses(vehicleId),
    staleTime: 30_000,
    enabled: !!vehicleId,
  });
}

export function useInfiniteExpenses(vehicleId: string, pageSize = 5) {
  return useInfiniteQuery({
    queryKey: expenseKeys.infiniteByVehicle(vehicleId),
    queryFn: ({ pageParam }) =>
      listExpenses(vehicleId, { cursor: pageParam as string | undefined, limit: pageSize }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !!vehicleId,
    staleTime: 30_000,
  });
}

export function useCreateExpense(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ExpenseDto, 'id' | 'date'> & { date: string }) =>
      createExpense(vehicleId, payload),
    onMutate: async payload => {
      await qc.cancelQueries({ queryKey: expenseKeys.byVehicle(vehicleId) });
      const previous = qc.getQueryData<{
        expenses: ExpenseDto[];
        expensesTotal: number;
        nextCursor: string | null;
      }>(expenseKeys.byVehicle(vehicleId));

      const optimisticItem: ExpenseDto = {
        id: `temp-${Date.now()}`,
        date: payload.date,
        category: payload.category,
        amount: payload.amount,
        vendor: payload.vendor,
        odometerKm: payload.odometerKm,
        notes: payload.notes,
      };

      qc.setQueryData(
        expenseKeys.byVehicle(vehicleId),
        (
          old:
            | { expenses: ExpenseDto[]; expensesTotal?: number; nextCursor?: string | null }
            | undefined
        ) => ({
          expenses: [optimisticItem, ...(old?.expenses || [])],
          expensesTotal: (old?.expensesTotal || 0) + optimisticItem.amount,
          nextCursor: old?.nextCursor ?? null,
        })
      );

      return { previous } as const;
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(expenseKeys.byVehicle(vehicleId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: expenseKeys.infiniteByVehicle(vehicleId) });
    },
  });
}

export type { ExpenseDto };

export function useUpdateExpense(vehicleId: string, expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<ExpenseDto, 'id'>>) =>
      updateExpense(vehicleId, expenseId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: expenseKeys.infiniteByVehicle(vehicleId) });
    },
  });
}

export function useDeleteExpense(vehicleId: string, expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteExpense(vehicleId, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.byVehicle(vehicleId) });
      qc.invalidateQueries({ queryKey: expenseKeys.infiniteByVehicle(vehicleId) });
    },
  });
}
