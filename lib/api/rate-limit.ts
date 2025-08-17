type Key = string;

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000); // 1 minute
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 60);

const buckets = new Map<Key, { count: number; resetAt: number }>();

export function rateLimitKey(req: Request): string {
  // Prefer standard proxy headers; do not rely on non-standard properties
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  const ip = forwarded || realIp || cfIp || 'unknown';
  const path = new URL(req.url).pathname;
  return `${ip}:${path}`;
}

export function checkRateLimit(
  key: Key
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count < MAX_REQUESTS) {
    entry.count += 1;
    return { allowed: true };
  }
  return { allowed: false, retryAfterMs: entry.resetAt - now };
}

export function rateLimitHeaders(retryAfterMs: number): HeadersInit {
  return { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) };
}
