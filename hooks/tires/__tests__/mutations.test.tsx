import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock the query functions
vi.mock('@/queries/tires', () => ({
  createTireSet: vi.fn(),
  deleteTireSet: vi.fn(),
  updateTireSet: vi.fn(),
  logTireChange: vi.fn(),
  updateTireChangeLog: vi.fn(),
  deleteTireChangeLog: vi.fn(),
}));

import { useCreateTireSet } from '../useCreateTireSet';
import { useDeleteTireSet } from '../useDeleteTireSet';
import { useUpdateTireSet } from '../useUpdateTireSet';
import { useLogTireChange } from '../useLogTireChange';
import { useUpdateTireChangeLog } from '../useUpdateTireChangeLog';
import { useDeleteTireChangeLog } from '../useDeleteTireChangeLog';
import { useImportTires, useImportTiresToVehicle } from '../useImportTires';
import * as tiresQueries from '@/queries/tires';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('tire mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useCreateTireSet calls createTireSet and invalidates queries', async () => {
    vi.mocked(tiresQueries.createTireSet).mockResolvedValue({ id: 't1' });

    const { result } = renderHook(() => useCreateTireSet('v1'), { wrapper: createWrapper() });

    result.current.mutate({ name: 'Test', type: 'SUMMER' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tiresQueries.createTireSet).toHaveBeenCalledWith('v1', { name: 'Test', type: 'SUMMER' });
  });

  it('useDeleteTireSet calls deleteTireSet and invalidates queries', async () => {
    vi.mocked(tiresQueries.deleteTireSet).mockResolvedValue({ id: 't1' });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteTireSet('v1'), { wrapper });

    result.current.mutate('t1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tiresQueries.deleteTireSet).toHaveBeenCalledWith('v1', 't1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tireSets', 'v1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tireChangeHistory', 'v1'] });
  });

  it('useUpdateTireSet calls updateTireSet and invalidates queries', async () => {
    vi.mocked(tiresQueries.updateTireSet).mockResolvedValue({ id: 't1' });

    const { result } = renderHook(() => useUpdateTireSet('v1'), { wrapper: createWrapper() });

    result.current.mutate({ tireSetId: 't1', status: 'STORED' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tiresQueries.updateTireSet).toHaveBeenCalledWith('v1', 't1', { status: 'STORED' });
  });

  it('useLogTireChange calls logTireChange and invalidates queries', async () => {
    vi.mocked(tiresQueries.logTireChange).mockResolvedValue({ id: 'log1' });

    const { result } = renderHook(() => useLogTireChange('v1'), { wrapper: createWrapper() });

    result.current.mutate({ tireSetId: 't1', date: '2024-06-01', odometerKm: 10000 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tiresQueries.logTireChange).toHaveBeenCalledWith('v1', {
      tireSetId: 't1',
      date: '2024-06-01',
      odometerKm: 10000,
    });
  });

  it('useUpdateTireChangeLog calls updateTireChangeLog and invalidates queries', async () => {
    vi.mocked(tiresQueries.updateTireChangeLog).mockResolvedValue({ id: 'log1' });

    const { result } = renderHook(() => useUpdateTireChangeLog('v1'), { wrapper: createWrapper() });

    result.current.mutate({ logId: 'log1', odometerKm: 12000 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tiresQueries.updateTireChangeLog).toHaveBeenCalledWith('v1', 'log1', {
      odometerKm: 12000,
    });
  });

  it('useDeleteTireChangeLog calls deleteTireChangeLog and invalidates queries', async () => {
    vi.mocked(tiresQueries.deleteTireChangeLog).mockResolvedValue({ id: 'log1' });

    const { result } = renderHook(() => useDeleteTireChangeLog('v1'), { wrapper: createWrapper() });

    result.current.mutate('log1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tiresQueries.deleteTireChangeLog).toHaveBeenCalledWith('v1', 'log1');
  });

  describe('useImportTires', () => {
    it('imports tire sets and change logs successfully', async () => {
      vi.mocked(tiresQueries.createTireSet).mockResolvedValue({ id: 'new-ts1' });
      vi.mocked(tiresQueries.logTireChange).mockResolvedValue({ id: 'new-log1' });

      const { result } = renderHook(() => useImportTires('v1'), { wrapper: createWrapper() });

      result.current.mutate({
        tireSets: [{ name: 'Summer Set', type: 'SUMMER', status: 'STORED' }],
        changeLogs: [{ tireSetId: 'Summer Set', date: '2024-06-01', odometerKm: 10000 }],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(tiresQueries.createTireSet).toHaveBeenCalledWith('v1', {
        name: 'Summer Set',
        type: 'SUMMER',
        status: 'STORED',
        purchaseDate: undefined,
        notes: undefined,
      });
      expect(tiresQueries.logTireChange).toHaveBeenCalledWith('v1', {
        tireSetId: 'new-ts1',
        date: '2024-06-01',
        odometerKm: 10000,
        notes: undefined,
      });
    });

    it('uses exportId mapping for change logs', async () => {
      vi.mocked(tiresQueries.createTireSet).mockResolvedValue({ id: 'new-ts1' });
      vi.mocked(tiresQueries.logTireChange).mockResolvedValue({ id: 'new-log1' });

      const tireSetIdMap = new Map([['old-export-id', 'Summer Set']]);

      const { result } = renderHook(() => useImportTires('v1'), { wrapper: createWrapper() });

      result.current.mutate({
        tireSets: [{ name: 'Summer Set', type: 'SUMMER' }],
        changeLogs: [{ tireSetId: 'old-export-id', date: '2024-06-01', odometerKm: 10000 }],
        tireSetIdMap,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(tiresQueries.logTireChange).toHaveBeenCalledWith('v1', {
        tireSetId: 'new-ts1',
        date: '2024-06-01',
        odometerKm: 10000,
        notes: undefined,
      });
    });

    it('throws error when tire set creation fails', async () => {
      vi.mocked(tiresQueries.createTireSet).mockRejectedValue(new Error('creation failed'));

      const { result } = renderHook(() => useImportTires('v1'), { wrapper: createWrapper() });

      result.current.mutate({
        tireSets: [{ name: 'Summer Set', type: 'SUMMER' }],
        changeLogs: [],
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toMatch(/0\/1 tire sets/);
    });

    it('throws error when change log creation fails', async () => {
      vi.mocked(tiresQueries.createTireSet).mockResolvedValue({ id: 'new-ts1' });
      vi.mocked(tiresQueries.logTireChange).mockRejectedValue(new Error('log failed'));

      const { result } = renderHook(() => useImportTires('v1'), { wrapper: createWrapper() });

      result.current.mutate({
        tireSets: [{ name: 'Summer Set', type: 'SUMMER' }],
        changeLogs: [{ tireSetId: 'Summer Set', date: '2024-06-01', odometerKm: 10000 }],
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toMatch(/0\/1 change logs/);
    });
  });

  describe('useImportTiresToVehicle', () => {
    it('imports using the provided vehicleId', async () => {
      vi.mocked(tiresQueries.createTireSet).mockResolvedValue({ id: 'new-ts1' });
      vi.mocked(tiresQueries.logTireChange).mockResolvedValue({ id: 'new-log1' });

      const { result } = renderHook(() => useImportTiresToVehicle(), { wrapper: createWrapper() });

      result.current.mutate({
        vehicleId: 'v1',
        tireSets: [{ name: 'Summer Set', type: 'SUMMER' }],
        changeLogs: [{ tireSetId: 'Summer Set', date: '2024-06-01', odometerKm: 10000 }],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(tiresQueries.createTireSet).toHaveBeenCalledWith('v1', {
        name: 'Summer Set',
        type: 'SUMMER',
        status: undefined,
        purchaseDate: undefined,
        notes: undefined,
      });
    });

    it('errors when vehicleId is missing', async () => {
      const { result } = renderHook(() => useImportTiresToVehicle(), { wrapper: createWrapper() });

      result.current.mutate({
        vehicleId: '',
        tireSets: [],
        changeLogs: [],
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toMatch(/Vehicle ID is required/);
    });
  });
});
