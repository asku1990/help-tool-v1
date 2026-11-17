import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '@/lib/api/client';
import { computeVehicleSummary } from '@/lib/consumption';
import { getVehicleSummary } from '../getVehicleSummary';

vi.mock('@/lib/api/client', () => ({ apiGet: vi.fn() }));

describe('getVehicleSummary', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  it('requests the dedicated summary endpoint through the API client', async () => {
    const summary = computeVehicleSummary([], []);
    vi.mocked(apiGet).mockResolvedValue(summary);
    await expect(getVehicleSummary('v')).resolves.toEqual(summary);
    expect(apiGet).toHaveBeenCalledWith('/api/vehicles/v/summary');
  });

  it('propagates request failures to the query hook', async () => {
    const error = new Error('Could not load summary');
    vi.mocked(apiGet).mockRejectedValue(error);
    await expect(getVehicleSummary('v')).rejects.toBe(error);
  });
});
