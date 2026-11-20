import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@/generated/prisma';
import { logger } from '@/lib/logger';
import { AttachmentError, type ValidatedAttachment } from './validation';
import { MAX_ATTACHMENTS } from './limits';
import type { AttachmentStorage } from './storage';

export type AttachmentParent = { type: 'expense' | 'fillup'; id: string };

const metadataSelect = {
  id: true,
  filename: true,
  contentType: true,
  sizeBytes: true,
  createdAtUtc: true,
  updatedAtUtc: true,
} satisfies Prisma.AttachmentSelect;

type Metadata = Prisma.AttachmentGetPayload<{ select: typeof metadataSelect }>;

function toDto(item: Metadata) {
  return {
    ...item,
    createdAtUtc: item.createdAtUtc.toISOString(),
    updatedAtUtc: item.updatedAtUtc.toISOString(),
  };
}

function parentWhere(parent: AttachmentParent) {
  return parent.type === 'expense' ? { expenseId: parent.id } : { fuelFillUpId: parent.id };
}

export async function hasAttachmentParent(
  db: PrismaClient,
  vehicleId: string,
  parent: AttachmentParent
) {
  const args = { where: { id: parent.id, vehicleId }, select: { id: true } };
  return Boolean(
    parent.type === 'expense'
      ? await db.expense.findFirst(args)
      : await db.fuelFillUp.findFirst(args)
  );
}

export async function listAttachments(db: PrismaClient, parent: AttachmentParent) {
  const items = await db.attachment.findMany({
    where: parentWhere(parent),
    select: metadataSelect,
    orderBy: [{ createdAtUtc: 'asc' }, { id: 'asc' }],
  });
  return {
    attachments: items.map(toDto),
    maxAttachments: MAX_ATTACHMENTS,
    remainingCapacity: Math.max(0, MAX_ATTACHMENTS - items.length),
  };
}

export async function uploadAttachment(
  db: PrismaClient,
  storage: Pick<AttachmentStorage, 'put' | 'delete'>,
  vehicleId: string,
  parent: AttachmentParent,
  file: ValidatedAttachment
) {
  const key = `attachments/${randomUUID()}`;
  let putStarted = false;
  try {
    const item = await db.$transaction(
      async tx => {
        // Row locks serialize only uploads to this parent, including across instances.
        await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
        const rows = await tx.$queryRaw<{ id: string }[]>(
          parent.type === 'expense'
            ? Prisma.sql`SELECT "id" FROM "Expense" WHERE "id" = ${parent.id} AND "vehicleId" = ${vehicleId} FOR UPDATE`
            : Prisma.sql`SELECT "id" FROM "FuelFillUp" WHERE "id" = ${parent.id} AND "vehicleId" = ${vehicleId} FOR UPDATE`
        );
        if (rows.length === 0) {
          throw new AttachmentError('NOT_FOUND', 'Record not found.', 404);
        }
        const count = await tx.attachment.count({ where: parentWhere(parent) });
        if (count >= MAX_ATTACHMENTS) {
          throw new AttachmentError(
            'ATTACHMENT_LIMIT',
            `This record already has ${MAX_ATTACHMENTS} attachments.`,
            409
          );
        }
        putStarted = true;
        await storage.put(key, file.bytes, file.contentType);
        return tx.attachment.create({
          data: {
            ...parentWhere(parent),
            filename: file.filename,
            contentType: file.contentType,
            sizeBytes: file.bytes.byteLength,
            objectKey: key,
          },
          select: metadataSelect,
        });
      },
      // READ COMMITTED gives a fresh count after waiting for the previous uploader.
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 20_000,
      }
    );
    return toDto(item);
  } catch (error) {
    if (putStarted) {
      // Also try cleanup after uncertain PUT failures (e.g. a lost response).
      try {
        await storage.delete(key);
      } catch (cleanupError) {
        logger.error('Attachment object cleanup failed; manual staging cleanup may be needed', {
          key,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown storage error',
        });
      }
    }
    throw error;
  }
}
