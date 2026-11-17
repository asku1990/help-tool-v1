// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createAttachmentStorage } from '../storage';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('generates a real expiring R2 signature locally, without an object request', async () => {
  vi.stubEnv('ATTACHMENTS_R2_ACCOUNT_ID', 'test-account');
  vi.stubEnv('ATTACHMENTS_R2_BUCKET', 'test-attachments');
  vi.stubEnv('ATTACHMENTS_R2_ACCESS_KEY_ID', 'test-key');
  vi.stubEnv('ATTACHMENTS_R2_SECRET_ACCESS_KEY', 'test-secret');
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network expected'));
  const signed = new URL(
    await createAttachmentStorage().getOpenUrl(
      'attachments/random',
      'receipt.pdf',
      'application/pdf'
    )
  );
  expect(signed.origin).toBe('https://test-attachments.test-account.r2.cloudflarestorage.com');
  expect(signed.pathname).toBe('/attachments/random');
  expect(signed.searchParams.get('X-Amz-Expires')).toBe('120');
  expect(signed.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
  expect(signed.searchParams.get('response-content-type')).toBe('application/pdf');
  expect(signed.searchParams.get('response-content-disposition')).toBe(
    'inline; filename="receipt.pdf"; filename*=UTF-8\'\'receipt.pdf'
  );
  expect(signed.searchParams.get('response-cache-control')).toBe('private, no-store');
  expect(fetch).not.toHaveBeenCalled();
});
