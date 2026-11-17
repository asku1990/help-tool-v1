import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import type { AttachmentParent } from './upload';

export async function renameAttachment(
  req: Request,
  vehicleId: string,
  parent: AttachmentParent,
  attachmentId: string
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const limit = checkRateLimit(rateLimitKey(req));
    if (!limit.allowed) {
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: {
          ...headers,
          ...Object.fromEntries(new Headers(rateLimitHeaders(limit.retryAfterMs))),
        },
      });
    }
    const userId = await getSessionUserId(await auth());
    if (!userId) return unauthorized(undefined, undefined, { headers });
    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write'))
      return notFound(undefined, undefined, { headers });

    const where = {
      id: attachmentId,
      ...(parent.type === 'expense'
        ? { expenseId: parent.id, expense: { vehicleId: access.vehicle.id } }
        : { fuelFillUpId: parent.id, fuelFillUp: { vehicleId: access.vehicle.id } }),
    };
    const attachment = await prisma.attachment.findFirst({
      where,
      select: { filename: true },
    });
    if (!attachment) return notFound(undefined, undefined, { headers });

    // The client sends only the name; the stored extension never changes.
    const dot = attachment.filename.lastIndexOf('.');
    const extension = dot === -1 ? '' : attachment.filename.slice(dot);
    const schema = z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(255 - extension.length)
          .refine(
            name =>
              !/[/\\]/.test(name) &&
              !Array.from(name).some(character => {
                const code = character.charCodeAt(0);
                return code < 32 || (code >= 127 && code <= 159);
              }),
            'Names cannot contain path separators or control characters.'
          ),
      })
      .strict();
    const result = schema.safeParse(await req.json().catch(() => null));
    if (!result.success) {
      return badRequest(
        'INVALID_FILENAME',
        `Provide a non-empty name of at most ${255 - extension.length} characters without path separators or control characters.`,
        result.error.flatten(),
        { headers }
      );
    }
    const filename = `${result.data.name}${extension}`;
    const updated = await prisma.attachment.updateMany({ where, data: { filename } });
    if (!updated.count) return notFound(undefined, undefined, { headers });
    return ok({ id: attachmentId, filename }, { headers });
  } catch (error) {
    logger.error('Attachment rename failed', {
      vehicleId,
      parentType: parent.type,
      parentId: parent.id,
      attachmentId,
      errorName: error instanceof Error ? error.name : 'Unknown error',
    });
    return serverError(
      'Could not rename the attachment. Refresh the list and try again.',
      undefined,
      {
        headers,
      }
    );
  }
}
