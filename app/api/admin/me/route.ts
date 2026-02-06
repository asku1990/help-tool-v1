import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { ok, serverError, unauthorized } from '@/lib/api/response';
import { getCurrentUser } from '@/lib/api/admin-access';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });

    const session = await auth();
    const user = await getCurrentUser(session);
    if (!user) return unauthorized();

    return ok({ isAdmin: user.userType === 'ADMIN' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('GET /api/admin/me failed', { error });
    return serverError();
  }
}
