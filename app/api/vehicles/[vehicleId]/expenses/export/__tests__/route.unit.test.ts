// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  rateLimitHeaders: vi.fn(() => ({})),
  rateLimitKey: vi.fn(() => 'k'),
}));
vi.mock('@/lib/db', () => ({
  default: {
    vehicle: { findFirst: vi.fn() },
    expense: { findMany: vi.fn() },
  },
}));

describe('api/vehicles/[vehicleId]/expenses/export GET (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as { mockResolvedValueOnce: (_v: unknown) => void }).mockResolvedValueOnce(
      null
    );
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/expenses/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(401);
  });

  it('applies rate limit and returns 429', async () => {
    const { checkRateLimit } = await import('@/lib/api/rate-limit');
    (
      checkRateLimit as unknown as { mockReturnValueOnce: (_v: unknown) => void }
    ).mockReturnValueOnce({
      allowed: false,
      retryAfterMs: 1000,
    });
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/expenses/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(429);
  });

  it('returns 404 when vehicle not found', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
    };
    prisma.vehicle.findFirst = vi.fn().mockResolvedValueOnce(null);
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/expenses/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(404);
  });

  it('returns CSV with escaped fields and sanitized filename on success', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
      expense: { findMany: (_args?: unknown) => Promise<unknown[]> };
    };
    (prisma.vehicle.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: 'v1',
      name: 'Car / Name: 42',
    });
    (prisma.expense.findMany as unknown as Mock).mockResolvedValueOnce([
      {
        id: 'e1',
        date: new Date('2024-01-02T00:00:00.000Z'),
        odometerKm: 12345,
        amount: { toNumber: () => 12.3 },
        category: 'OTHER',
        vendor: 'ACME; "Shop"',
        notes: 'Multi\nLine',
      },
    ]);

    const res = await GET(new NextRequest('http://x/api/vehicles/v1/expenses/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });

    expect(res.status).toBe(200);
    const disp = res.headers.get('Content-Disposition');
    expect(disp).toMatch(/expenses_Car_Name_42_\d{8}\.csv/);
    expect(res.headers.get('Content-Type')).toContain('text/csv');

    const body = await res.text();
    expect(body.split('\n')[0]).toBe('Date;Km;Amount;Category;Vendor;Notes');
    // Vendor contains semicolon and quotes, should be escaped and quoted
    expect(body).toContain('"ACME; ""Shop"""');
    // Notes contains newline, should be quoted
    expect(body).toContain('"Multi');
  });
});
