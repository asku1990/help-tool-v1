import { apiGet, apiPost } from '@/lib/api/client';

it('throws on non-ok status with JSON body', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { message: 'Nope' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  await expect(apiGet('/x')).rejects.toThrow('Nope');
  vi.restoreAllMocks();
});

it('throws on network error', async () => {
  vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
  await expect(apiPost('/x', {})).rejects.toThrow('network down');
  vi.restoreAllMocks();
});
