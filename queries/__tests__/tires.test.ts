import { describe, it, expect, vi, type MockInstance, beforeEach, afterEach } from 'vitest';
import {
  listTireSets,
  createTireSet,
  updateTireSet,
  deleteTireSet,
  logTireChange,
  getTireChangeHistory,
} from '../tires';

type FetchSpy = MockInstance<typeof fetch>;
let fetchSpy: FetchSpy;

describe('tires queries', () => {
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tireSets: [] } }),
    } as Response);
  });
  afterEach(() => vi.restoreAllMocks());

  it('listTireSets calls correct endpoint', async () => {
    await listTireSets('v1');
    expect(fetch).toHaveBeenCalledWith('/api/vehicles/v1/tires', expect.anything());
  });

  it('createTireSet posts payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 't1' } }),
    } as Response);

    const res = await createTireSet('v1', { name: 'Winter Tires', type: 'WINTER' });
    expect(res).toEqual({ id: 't1' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/v1/tires',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Winter Tires', type: 'WINTER' }),
      })
    );
  });

  it('updateTireSet patches payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 't1' } }),
    } as Response);

    await updateTireSet('v1', 't1', { status: 'RETIRED' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/v1/tires/t1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'RETIRED' }),
      })
    );
  });

  it('deleteTireSet calls delete endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 't1' } }),
    } as Response);

    await deleteTireSet('v1', 't1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/v1/tires/t1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('logTireChange posts to change-log endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'cl1' } }),
    } as Response);

    const res = await logTireChange('v1', {
      tireSetId: 't1',
      date: '2024-11-01',
      odometerKm: 15000,
    });
    expect(res).toEqual({ id: 'cl1' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/v1/tires/change-log',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('getTireChangeHistory calls correct endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { history: [] } }),
    } as Response);

    await getTireChangeHistory('v1');
    expect(fetch).toHaveBeenCalledWith('/api/vehicles/v1/tires/change-log', expect.anything());
  });
});
