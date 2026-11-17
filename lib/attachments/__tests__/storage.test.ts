// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createAttachmentStorage } from '../storage';

const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({}) }));
vi.mock('@aws-sdk/client-s3', async importOriginal => ({
  ...(await importOriginal<typeof import('@aws-sdk/client-s3')>()),
  S3Client: vi.fn(function () {
    return { send };
  }),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));

describe('Private R2 attachment storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    send.mockResolvedValue({});
    vi.mocked(getSignedUrl).mockResolvedValue(
      'https://staging-account.r2.cloudflarestorage.com/signed'
    );
    vi.stubEnv('ATTACHMENTS_R2_ACCOUNT_ID', 'staging-account');
    vi.stubEnv('ATTACHMENTS_R2_BUCKET', 'staging-attachments');
    vi.stubEnv('ATTACHMENTS_R2_ACCESS_KEY_ID', 'attachment-key');
    vi.stubEnv('ATTACHMENTS_R2_SECRET_ACCESS_KEY', 'attachment-secret');
    vi.stubEnv('R2_BUCKET', 'database-backups');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('uses the Cloudflare endpoint and separate attachment credentials, without SDK retries', () => {
    createAttachmentStorage();
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://staging-account.r2.cloudflarestorage.com',
        region: 'auto',
        maxAttempts: 1,
        credentials: { accessKeyId: 'attachment-key', secretAccessKey: 'attachment-secret' },
      })
    );
  });

  it('uploads binary content without a public ACL and provides an abort signal', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await createAttachmentStorage().put('attachments/random', bytes, 'application/pdf');
    expect(send).toHaveBeenCalledWith(
      expect.any(PutObjectCommand),
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) })
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'staging-attachments',
          Key: 'attachments/random',
          Body: bytes,
          ContentLength: 3,
          ContentType: 'application/pdf',
        },
      }),
      expect.any(Object)
    );
  });

  it('deletes from the attachment bucket with an abort signal', async () => {
    await createAttachmentStorage().delete('attachments/random');
    expect(send).toHaveBeenCalledWith(
      expect.any(DeleteObjectCommand),
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) })
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { Bucket: 'staging-attachments', Key: 'attachments/random' },
      }),
      expect.any(Object)
    );
  });

  it('signs a two-minute inline GET without fetching the object or making it public', async () => {
    const filename = 'café "receipt".pdf';
    await expect(
      createAttachmentStorage().getOpenUrl('attachments/random', filename, 'application/pdf')
    ).resolves.toBe('https://staging-account.r2.cloudflarestorage.com/signed');
    expect(getSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(GetObjectCommand), {
      expiresIn: 120,
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        input: {
          Bucket: 'staging-attachments',
          Key: 'attachments/random',
          ResponseContentType: 'application/pdf',
          ResponseContentDisposition:
            'inline; filename="caf_ _receipt_.pdf"; filename*=UTF-8\'\'caf%C3%A9%20%22receipt%22.pdf',
          ResponseCacheControl: 'private, no-store',
        },
      }),
      { expiresIn: 120 }
    );
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    'ATTACHMENTS_R2_ACCOUNT_ID',
    'ATTACHMENTS_R2_BUCKET',
    'ATTACHMENTS_R2_ACCESS_KEY_ID',
    'ATTACHMENTS_R2_SECRET_ACCESS_KEY',
  ])('fails closed when %s is missing or unresolved', name => {
    for (const value of ['', 'pass://unresolved/secret']) {
      vi.stubEnv(name, value);
      expect(() => createAttachmentStorage()).toThrow(name);
    }
    expect(S3Client).not.toHaveBeenCalled();
  });

  it('propagates storage failures without retrying', async () => {
    send.mockRejectedValueOnce(new Error('R2 unavailable'));
    await expect(
      createAttachmentStorage().put('key', new Uint8Array([1]), 'application/pdf')
    ).rejects.toThrow('R2 unavailable');
    expect(send).toHaveBeenCalledOnce();
  });
});
