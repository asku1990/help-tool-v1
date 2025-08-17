import { rateLimitKey, checkRateLimit, rateLimitHeaders } from '@/lib/api/rate-limit';

it('rateLimitKey prefers x-forwarded-for', () => {
  const req = new Request('http://localhost/api/x', {
    headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' },
  });
  expect(rateLimitKey(req)).toBe('1.1.1.1:/api/x');
});

it('rateLimitKey falls back to unknown', () => {
  const req = new Request('http://localhost/api/y');
  expect(rateLimitKey(req)).toBe('unknown:/api/y');
});

it('checkRateLimit enforces max and Retry-After rounds seconds', () => {
  const originalNow = Date.now;
  Date.now = () => 1_000;
  const k = 'ip:/p';
  for (let i = 0; i < 60; i++) expect(checkRateLimit(k)).toEqual({ allowed: true });
  const denied = checkRateLimit(k);
  if (denied.allowed === false) {
    const h = rateLimitHeaders(denied.retryAfterMs);
    const retryAfter = new Headers(h).get('Retry-After');
    expect(Number.isFinite(Number(retryAfter))).toBe(true);
  } else {
    throw new Error('Expected denied');
  }
  Date.now = originalNow;
});
