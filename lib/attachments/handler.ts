import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { badRequest, created, notFound, ok, serverError, unauthorized } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { AttachmentError, readAttachment } from './validation';
import { createAttachmentStorage } from './storage';
import {
  hasAttachmentParent,
  listAttachments,
  uploadAttachment,
  type AttachmentParent,
} from './upload';

export async function handleAttachments(req: Request, vehicleId: string, parent: AttachmentParent) {
  try {
    const limit = checkRateLimit(rateLimitKey(req));
    if (!limit.allowed) {
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(limit.retryAfterMs),
      });
    }
    const userId = await getSessionUserId(await auth());
    if (!userId) return unauthorized();

    const access = await getVehicleAccess(vehicleId, userId);
    const uploading = req.method === 'POST';
    if (!access || !hasPermission(access.role, uploading ? 'write' : 'read')) return notFound();
    if (!(await hasAttachmentParent(prisma, access.vehicle.id, parent))) return notFound();

    if (!uploading) {
      return ok(
        {
          ...(await listAttachments(prisma, parent)),
          canUpload: hasPermission(access.role, 'write'),
        },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
    // Authenticate and authorize before parsing or buffering the upload.
    const file = await readAttachment(req);
    const item = await uploadAttachment(
      prisma,
      createAttachmentStorage(),
      access.vehicle.id,
      parent,
      file
    );
    return created(item, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return badRequest(error.code, error.message, undefined, { status: error.status });
    }
    logger.error('Attachment request failed', {
      error: error instanceof Error ? error.message : 'Unknown attachment error',
    });
    return serverError(
      'Attachments are temporarily unavailable. Refresh the list before retrying.'
    );
  }
}
