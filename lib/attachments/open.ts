import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { notFound, serverError, unauthorized } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { canOpenAttachmentInline } from './formats';
import { createAttachmentStorage } from './storage';
import { attachmentParentScope, type AttachmentParent } from './parent';

function privateResponse(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function openAttachment(
  req: Request,
  vehicleId: string,
  parent: AttachmentParent,
  attachmentId: string
) {
  try {
    const limit = checkRateLimit(rateLimitKey(req));
    if (!limit.allowed) {
      return privateResponse(
        serverError('Rate limit exceeded', undefined, {
          status: 429,
          headers: rateLimitHeaders(limit.retryAfterMs),
        })
      );
    }
    const userId = await getSessionUserId(await auth());
    if (!userId) return privateResponse(unauthorized());
    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'read')) return privateResponse(notFound());

    // Scope all three IDs together; access to the URL's vehicle alone is insufficient.
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ...attachmentParentScope(access.vehicle.id, parent),
      },
      select: { objectKey: true, filename: true, contentType: true },
    });
    if (!attachment || !canOpenAttachmentInline(attachment.contentType)) {
      return privateResponse(notFound());
    }
    const location = await createAttachmentStorage().getOpenUrl(
      attachment.objectKey,
      attachment.filename,
      attachment.contentType
    );
    return privateResponse(new Response(null, { status: 302, headers: { Location: location } }));
  } catch (error) {
    // Signed URLs are bearer capabilities. Do not log them or raw signing errors.
    logger.error('Attachment open request failed', {
      errorName: error instanceof Error ? error.name : 'Unknown error',
    });
    return privateResponse(serverError('Could not open the attachment. Try Open again.'));
  }
}
