import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { notFound, ok, serverError, unauthorized } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { createAttachmentStorage } from './storage';
import { attachmentParentScope, type AttachmentParent } from './parent';

export async function deleteAttachment(
  req: Request,
  vehicleId: string,
  parent: AttachmentParent,
  attachmentId: string
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const limit = checkRateLimit(rateLimitKey(req));
    if (!limit.allowed) {
      const limitedHeaders = new Headers(rateLimitHeaders(limit.retryAfterMs));
      limitedHeaders.set('Cache-Control', 'private, no-store');
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: Object.fromEntries(limitedHeaders),
      });
    }
    const userId = await getSessionUserId(await auth());
    if (!userId) return unauthorized(undefined, undefined, { headers });
    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write'))
      return notFound(undefined, undefined, { headers });

    const where = {
      id: attachmentId,
      ...attachmentParentScope(access.vehicle.id, parent),
    };
    const attachment = await prisma.attachment.findFirst({
      where,
      select: { objectKey: true },
    });
    if (!attachment) return notFound(undefined, undefined, { headers });

    // DeleteObject also succeeds for missing objects, so a retry can finish a failed DB delete.
    // Keep metadata if storage fails; storage and PostgreSQL cannot commit atomically.
    await createAttachmentStorage().delete(attachment.objectKey);
    await prisma.attachment.deleteMany({ where });
    return ok({ id: attachmentId }, { headers });
  } catch (error) {
    logger.error('Attachment deletion failed', {
      vehicleId,
      parentType: parent.type,
      parentId: parent.type === 'vehicle' ? vehicleId : parent.id,
      attachmentId,
      errorName: error instanceof Error ? error.name : 'Unknown error',
    });
    return serverError(
      'Could not delete the attachment. Refresh the list and try again.',
      undefined,
      {
        headers,
      }
    );
  }
}
