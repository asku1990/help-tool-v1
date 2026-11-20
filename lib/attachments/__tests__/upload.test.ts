// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@/generated/prisma';
import { logger } from '@/lib/logger';
import { listAttachments, uploadAttachment } from '../upload';
import type { AttachmentStorage } from '../storage';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const file = {
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  bytes: new TextEncoder().encode('%PDF-1.4\n%%EOF'),
};
const saved = {
  id: 'attachment',
  filename: file.filename,
  contentType: file.contentType,
  sizeBytes: file.bytes.byteLength,
  createdAtUtc: new Date('2026-11-16T00:00:00Z'),
  updatedAtUtc: new Date('2026-11-16T00:00:00Z'),
};

function setup() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'parent' }]),
    attachment: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(saved),
    },
  };
  const transaction = vi.fn(
    async <T>(callback: (_client: Prisma.TransactionClient) => Promise<T>) =>
      callback(tx as unknown as Prisma.TransactionClient)
  );
  const findMany = vi.fn().mockResolvedValue([saved]);
  const db = {
    $transaction: transaction,
    attachment: { findMany },
  } as unknown as PrismaClient;
  const storage = {
    put: vi.fn<AttachmentStorage['put']>().mockResolvedValue(undefined),
    delete: vi.fn<AttachmentStorage['delete']>().mockResolvedValue(undefined),
  };
  return { db, tx, transaction, findMany, storage };
}

describe('Attachment upload coordination', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['expense', 'fillup'] as const)(
    'locks the authorized %s and saves safe metadata',
    async type => {
      const { db, tx, storage, transaction } = setup();
      const result = await uploadAttachment(db, storage, 'car', { type, id: 'parent' }, file);
      expect(tx.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          values: ['parent', 'car'],
          sql: expect.stringContaining(type === 'expense' ? '"Expense"' : '"FuelFillUp"'),
        })
      );
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.attachment.count.mock.invocationCallOrder[0]
      );
      expect(tx.attachment.count.mock.invocationCallOrder[0]).toBeLessThan(
        storage.put.mock.invocationCallOrder[0]
      );
      expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(
        tx.attachment.create.mock.invocationCallOrder[0]
      );
      expect(storage.put).toHaveBeenCalledWith(
        expect.stringMatching(/^attachments\/[0-9a-f-]{36}$/),
        file.bytes,
        'application/pdf'
      );
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 20_000,
      });
      expect(tx.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            [type === 'expense' ? 'expenseId' : 'fuelFillUpId']: 'parent',
            filename: file.filename,
            sizeBytes: file.bytes.byteLength,
          }),
          select: expect.not.objectContaining({ objectKey: true }),
        })
      );
      expect(result.createdAtUtc).toBe('2026-11-16T00:00:00.000Z');
      expect(result).not.toHaveProperty('objectKey');
      expect(storage.delete).not.toHaveBeenCalled();
    }
  );

  it('rejects missing or cross-car parents before storing an object', async () => {
    const { db, tx, storage } = setup();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      uploadAttachment(db, storage, 'car', { type: 'expense', id: 'other-car-record' }, file)
    ).rejects.toMatchObject({ status: 404 });
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it.each(['expense', 'fillup'] as const)('accepts the tenth %s attachment', async type => {
    const { db, tx, storage } = setup();
    tx.attachment.count.mockResolvedValue(9);
    await expect(
      uploadAttachment(db, storage, 'car', { type, id: 'parent' }, file)
    ).resolves.toMatchObject({ id: saved.id });
    expect(storage.put).toHaveBeenCalledOnce();
  });

  it.each(['expense', 'fillup'] as const)('rejects an eleventh %s attachment', async type => {
    const { db, tx, storage } = setup();
    tx.attachment.count.mockResolvedValue(10);
    await expect(
      uploadAttachment(db, storage, 'car', { type, id: 'parent' }, file)
    ).rejects.toMatchObject({ code: 'ATTACHMENT_LIMIT', status: 409 });
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('does not save metadata when storage fails and tries cleanup for an uncertain PUT', async () => {
    const { db, tx, storage } = setup();
    storage.put.mockRejectedValue(new Error('Storage timeout'));
    await expect(
      uploadAttachment(db, storage, 'car', { type: 'expense', id: 'parent' }, file)
    ).rejects.toThrow('Storage timeout');
    expect(tx.attachment.create).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0]?.[0]);
  });

  it('deletes the object when metadata insertion fails', async () => {
    const { db, tx, storage } = setup();
    tx.attachment.create.mockRejectedValue(new Error('Database write failed'));
    await expect(
      uploadAttachment(db, storage, 'car', { type: 'expense', id: 'parent' }, file)
    ).rejects.toThrow('Database write failed');
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0]?.[0]);
  });

  it('deletes the object when the transaction fails after metadata insertion', async () => {
    const { db, tx, transaction, storage } = setup();
    transaction.mockImplementationOnce(async callback => {
      await callback(tx as unknown as Prisma.TransactionClient);
      throw new Error('Commit failed');
    });
    await expect(
      uploadAttachment(db, storage, 'car', { type: 'expense', id: 'parent' }, file)
    ).rejects.toThrow('Commit failed');
    expect(tx.attachment.create).toHaveBeenCalledOnce();
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0]?.[0]);
  });

  it('logs cleanup failure without hiding the original failure', async () => {
    const { db, tx, storage } = setup();
    tx.attachment.create.mockRejectedValue(new Error('Database write failed'));
    storage.delete.mockRejectedValue(new Error('Cleanup failed'));
    await expect(
      uploadAttachment(db, storage, 'car', { type: 'expense', id: 'parent' }, file)
    ).rejects.toThrow('Database write failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('cleanup failed'),
      expect.objectContaining({ error: 'Cleanup failed' })
    );
  });

  it('lists only safe metadata with remaining capacity', async () => {
    const { db, findMany } = setup();
    const result = await listAttachments(db, { type: 'fillup', id: 'parent' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fuelFillUpId: 'parent' },
        select: expect.not.objectContaining({ objectKey: true }),
      })
    );
    expect(result).toMatchObject({ maxAttachments: 10, remainingCapacity: 9 });
    expect(result.attachments[0]).not.toHaveProperty('objectKey');
    expect(result.attachments[0]?.createdAtUtc).toBe('2026-11-16T00:00:00.000Z');
  });
});
