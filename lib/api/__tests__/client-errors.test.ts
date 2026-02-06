import { apiGet, apiPost, ApiClientError } from '@/lib/api/client';
import { getMutationErrorMessage, getUiErrorMessage } from '@/lib/api/client-errors';

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

it('maps forbidden to permission message in non-vehicle context', () => {
  const message = getUiErrorMessage(
    new ApiClientError('Forbidden', 403, 'FORBIDDEN'),
    'Failed to update access'
  );
  expect(message).toBe("You don't have permission to perform this action.");
});

it('maps unauthorized to sign-in message', () => {
  const message = getUiErrorMessage(
    new ApiClientError('Unauthorized', 401, 'UNAUTHORIZED'),
    'Failed to load admin data'
  );
  expect(message).toBe('Please sign in to continue.');
});

it('uses fallback for unknown error payload', () => {
  const message = getUiErrorMessage({ oops: true }, 'fallback');
  expect(message).toBe('fallback');
});
