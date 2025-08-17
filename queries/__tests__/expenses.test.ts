import { listExpenses, createExpense } from '@/queries/expenses';

describe('expenses queries', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { expenses: [], expensesTotal: 0, nextCursor: null } }),
    } as unknown as Response);
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
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'e1' } }) });
    const res = await createExpense('vid1', { date: '2024-01-01', category: 'FUEL', amount: 10 });
    expect(res).toEqual({ id: 'e1' });
  });
});
