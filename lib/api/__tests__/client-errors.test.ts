import { apiGet, apiPost, ApiClientError } from '@/lib/api/client';
import { getMutationErrorMessage } from '@/lib/api/client-errors';

it('throws on non-ok status with JSON body', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Nope' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  try {
    await apiGet('/x');
    throw new Error('Expected apiGet to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      message: 'Nope',
      status: 400,
      code: 'NOT_FOUND',
    } satisfies Partial<ApiClientError>);
  }
  vi.restoreAllMocks();
});

it('throws on network error', async () => {
  vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
  await expect(apiPost('/x', {})).rejects.toThrow('network down');
  vi.restoreAllMocks();
});

it('maps not-found/forbidden errors to view-only message', () => {
  const message = getMutationErrorMessage(
    new ApiClientError('Not found', 404, 'NOT_FOUND'),
    'fallback'
  );
  expect(message).toBe('You have view-only access for this vehicle.');
});
