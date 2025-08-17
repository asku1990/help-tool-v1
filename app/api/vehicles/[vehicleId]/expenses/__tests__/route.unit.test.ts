// @vitest-environment node
import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'k',
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  rateLimitHeaders: (ms: number) => ({ 'Retry-After': String(Math.ceil(ms / 1000)) }),
}));

describe('api/vehicles/[vehicleId]/expenses route (unit)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 401 when unauthorized', async () => {
    const req = new NextRequest('http://localhost/api/vehicles/v/expenses');
    const res = await GET(req, { params: Promise.resolve({ vehicleId: 'v' }) });
    expect(res.status).toBe(401);
  });

  it('GET returns 429 when rate limited', async () => {
    const rl = await import('@/lib/api/rate-limit');
    (rl.checkRateLimit as unknown as Mock).mockReturnValueOnce({
      allowed: false,
      retryAfterMs: 10,
    });

    const req = new NextRequest('http://localhost/api/vehicles/v/expenses');
    const res = await GET(req, { params: Promise.resolve({ vehicleId: 'v' }) });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
