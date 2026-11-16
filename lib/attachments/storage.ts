import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type AttachmentStorage = {
  put(_key: string, _bytes: Uint8Array, _contentType: string): Promise<void>;
  delete(_key: string): Promise<void>;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('pass://')) {
    throw new Error(`Missing or unresolved attachment storage setting: ${name}`);
  }
  return value;
}

export function createAttachmentStorage(): AttachmentStorage {
  // Deliberately separate from the database-backup bucket and its credentials.
  const accountId = required('ATTACHMENTS_R2_ACCOUNT_ID');
  const bucket = required('ATTACHMENTS_R2_BUCKET');
  const client = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId: required('ATTACHMENTS_R2_ACCESS_KEY_ID'),
      secretAccessKey: required('ATTACHMENTS_R2_SECRET_ACCESS_KEY'),
    },
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return {
    async put(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentLength: bytes.byteLength,
          ContentType: contentType,
        }),
        { abortSignal: AbortSignal.timeout(10_000) }
      );
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(5_000),
      });
    },
  };
}
