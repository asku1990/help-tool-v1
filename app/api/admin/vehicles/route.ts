import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { ok, serverError } from '@/lib/api/response';
import { requireAdmin } from '@/lib/api/admin-access';

export async function GET(req: NextRequest): Promise<Response> {
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

    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        make: true,
        model: true,
        year: true,
        userId: true,
        createdAt: true,
        user: { select: { email: true } },
        _count: { select: { access: true } },
      },
    });

    return ok({
      vehicles: vehicles.map(vehicle => ({
        id: vehicle.id,
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        userId: vehicle.userId,
        ownerEmail: vehicle.user.email,
        createdAt: vehicle.createdAt,
        accessCount: vehicle._count.access,
      })),
    });
  } catch (error) {
    logger.error('GET /api/admin/vehicles failed', { error });
    return serverError();
  }
}
