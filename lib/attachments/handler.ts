import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { AttachmentError, readAttachment } from './validation';
import { createAttachmentStorage } from './storage';
import { hasAttachmentParent, listAttachments, uploadAttachment } from './upload';
import type { AttachmentParent } from './parent';

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
    if (uploading) {
      // A browser can send a cross-origin multipart form without a preflight.
      const site = req.headers.get('sec-fetch-site');
      const origin = req.headers.get('origin');
      // Browser-controlled fetch metadata describes the public origin even when
      // a proxy rewrites req.url. Without it, retain the exact Origin check.
      if (
        site === 'cross-site' ||
        site === 'same-site' ||
        origin === 'null' ||
        (site !== 'same-origin' && origin !== null && origin !== new URL(req.url).origin)
      ) {
        return forbidden('Cross-origin uploads are not allowed.');
      }
    }
    if (!(await hasAttachmentParent(prisma, access.vehicle.id, parent))) return notFound();

    if (!uploading) {
      return ok(
        {
          ...(await listAttachments(prisma, access.vehicle.id, parent)),
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
