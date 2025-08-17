import { listFillUps, createFillUp, updateFillUp, deleteFillUp } from '@/queries/fillups';

describe('fillups queries', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { fillUps: [], nextCursor: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('listFillUps builds URL with params', async () => {
    await listFillUps('vid1', { cursor: 'c1', limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/vid1/fillups?cursor=c1&limit=10',
      expect.anything()
    );
  });

  it('create/update/delete hit their endpoints', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'f1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await createFillUp('v', {
      date: '2024-01-01',
      odometerKm: 1,
      liters: 1,
      pricePerLiter: 1,
      totalCost: 1,
      isFull: true,
    });

    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'f1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await updateFillUp('v', 'f1', { liters: 2 });

    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'f1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await deleteFillUp('v', 'f1');
  });
});
