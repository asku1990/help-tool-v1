import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { serverError } from '@/lib/api/response';

export function rateLimitTireRequest(request: Request): Response | undefined {
  const limit = checkRateLimit(rateLimitKey(request));
  if (limit.allowed) return;

  return serverError('Rate limit exceeded', undefined, {
    status: 429,
    headers: rateLimitHeaders(limit.retryAfterMs),
  });
}
