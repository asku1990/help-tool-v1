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

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        userType: true,
        createdAt: true,
      },
    });

    return ok({ users }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('GET /api/admin/users failed', { error });
    return serverError();
  }
}
