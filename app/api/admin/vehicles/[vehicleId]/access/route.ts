import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { badRequest, notFound, ok, serverError } from '@/lib/api/response';
import { requireAdmin } from '@/lib/api/admin-access';

const PutSchema = z
  .object({
    userId: z.string().trim().min(1, 'User ID is required').optional(),
    userEmail: z.string().trim().email().optional(),
    role: z.enum(['VIEWER', 'EDITOR', 'OWNER']),
  })
  .refine(data => Boolean(data.userId || data.userEmail), {
    message: 'Either userId or userEmail is required',
    path: ['userId'],
  });

const DeleteSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
});

type RouteContext = { params: Promise<{ vehicleId: string }> };

async function parseJsonBody(
  req: NextRequest
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false, response: badRequest('INVALID_JSON', 'Invalid JSON body') };
  }
}

export async function GET(req: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });

    const session = await auth();
    const admin = await requireAdmin(session);
    if (!admin.ok) return admin.response;

    const { vehicleId } = await context.params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, name: true },
    });
    if (!vehicle) return notFound('Vehicle not found');

    const access = await prisma.vehicleAccess.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { email: true, username: true } },
      },
    });

    return ok({
      vehicle,
      access: access.map(item => ({
        id: item.id,
        userId: item.userId,
        userEmail: item.user.email,
        username: item.user.username,
        role: item.role,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    logger.error('GET /api/admin/vehicles/[vehicleId]/access failed', { error });
    return serverError();
  }
}

export async function PUT(req: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });

    const session = await auth();
    const admin = await requireAdmin(session);
    if (!admin.ok) return admin.response;

    const jsonBody = await parseJsonBody(req);
    if (!jsonBody.ok) return jsonBody.response;

    const parsed = PutSchema.safeParse(jsonBody.data);
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const { vehicleId } = await context.params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle) return notFound('Vehicle not found');

    const user = parsed.data.userId
      ? await prisma.user.findUnique({
          where: { id: parsed.data.userId },
          select: { id: true },
        })
      : await prisma.user.findUnique({
          where: { email: parsed.data.userEmail!.trim().toLowerCase() },
          select: { id: true },
        });
    if (!user) return notFound('User not found');

    const access = await prisma.vehicleAccess.upsert({
      where: {
        vehicleId_userId: {
          vehicleId,
          userId: user.id,
        },
      },
      update: { role: parsed.data.role },
      create: {
        vehicleId,
        userId: user.id,
        role: parsed.data.role,
      },
      select: { id: true, vehicleId: true, userId: true, role: true },
    });

    return ok({ access });
  } catch (error) {
    logger.error('PUT /api/admin/vehicles/[vehicleId]/access failed', { error });
    return serverError();
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });

    const session = await auth();
    const admin = await requireAdmin(session);
    if (!admin.ok) return admin.response;

    const jsonBody = await parseJsonBody(req);
    if (!jsonBody.ok) return jsonBody.response;

    const parsed = DeleteSchema.safeParse(jsonBody.data);
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const { vehicleId } = await context.params;
    const targetAccess = await prisma.vehicleAccess.findUnique({
      where: {
        vehicleId_userId: {
          vehicleId,
          userId: parsed.data.userId,
        },
      },
      select: { role: true },
    });
    if (!targetAccess) return ok({ ok: true });

    if (targetAccess.role === 'OWNER') {
      const ownerCount = await prisma.vehicleAccess.count({
        where: {
          vehicleId,
          role: 'OWNER',
        },
      });
      if (ownerCount <= 1) {
        return badRequest(
          'LAST_OWNER',
          'Cannot remove the final owner. Add another owner before revoking this access.'
        );
      }
    }

    await prisma.vehicleAccess.deleteMany({
      where: {
        vehicleId,
        userId: parsed.data.userId,
      },
    });

    return ok({ ok: true });
  } catch (error) {
    logger.error('DELETE /api/admin/vehicles/[vehicleId]/access failed', { error });
    return serverError();
  }
}
