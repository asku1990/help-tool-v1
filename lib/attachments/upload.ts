import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@/generated/prisma';
import { logger } from '@/lib/logger';
import { AttachmentError, type ValidatedAttachment } from './validation';
import { MAX_ATTACHMENTS } from './limits';
import { attachmentParentKey, attachmentParentScope, type AttachmentParent } from './parent';
import type { AttachmentStorage } from './storage';

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

export async function hasAttachmentParent(
  db: PrismaClient,
  vehicleId: string,
  parent: AttachmentParent
) {
  // The direct parent is the vehicle already returned by getVehicleAccess.
  if (parent.type === 'vehicle') return true;
  const args = { where: { id: parent.id, vehicleId }, select: { id: true } };
  return Boolean(
    parent.type === 'expense'
      ? await db.expense.findFirst(args)
      : await db.fuelFillUp.findFirst(args)
  );
}

export async function listAttachments(
  db: PrismaClient,
  vehicleId: string,
  parent: AttachmentParent
) {
  const items = await db.attachment.findMany({
    where: attachmentParentScope(vehicleId, parent),
    select: metadataSelect,
    orderBy: [{ createdAtUtc: 'asc' }, { id: 'asc' }],
  });
  return {
    attachments: items.map(toDto),
    maxAttachments: MAX_ATTACHMENTS,
    remainingCapacity: Math.max(0, MAX_ATTACHMENTS - items.length),
  };
}

function lockAttachmentParent(vehicleId: string, parent: AttachmentParent) {
  switch (parent.type) {
    case 'vehicle':
      return Prisma.sql`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
    case 'expense':
      return Prisma.sql`SELECT "id" FROM "Expense" WHERE "id" = ${parent.id} AND "vehicleId" = ${vehicleId} FOR UPDATE`;
    case 'fillup':
      return Prisma.sql`SELECT "id" FROM "FuelFillUp" WHERE "id" = ${parent.id} AND "vehicleId" = ${vehicleId} FOR UPDATE`;
  }
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
        const rows = await tx.$queryRaw<{ id: string }[]>(lockAttachmentParent(vehicleId, parent));
        if (rows.length === 0) {
          throw new AttachmentError('NOT_FOUND', 'Record not found.', 404);
        }
        const parentKey = attachmentParentKey(vehicleId, parent);
        const count = await tx.attachment.count({ where: parentKey });
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
            ...parentKey,
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
