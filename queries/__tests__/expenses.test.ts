import { listExpenses, createExpense, updateExpense, deleteExpense } from '@/queries/expenses';

let fetchSpy: vi.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

describe('expenses queries', () => {
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { expenses: [], expensesTotal: 0, nextCursor: null } }),
    } as Response);
  });
  afterEach(() => vi.restoreAllMocks());

  it('listExpenses builds URL with params', async () => {
    await listExpenses('vid1', { cursor: 'c1', limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/vid1/expenses?cursor=c1&limit=10',
      expect.anything()
    );
  });

  it('createExpense posts payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'e1' } }),
    } as Response);
    const res = await createExpense('vid1', { date: '2024-01-01', category: 'FUEL', amount: 10 });
    expect(res).toEqual({ id: 'e1' });
  });

  it('updateExpense patches payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'e1' } }),
    } as Response);
    await updateExpense('vid1', 'exp1', { amount: 25, vendor: 'Shop' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/vid1/expenses/exp1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ amount: 25, vendor: 'Shop' }),
      })
    );
  });

  it('deleteExpense calls delete endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'exp1' } }),
    } as Response);
    await deleteExpense('vid2', 'exp9');
    expect(fetch).toHaveBeenCalledWith(
      '/api/vehicles/vid2/expenses/exp9',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
