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
    fuelFillUp: { findMany: vi.fn() },
  },
}));

describe('api/vehicles/[vehicleId]/fillups/export GET (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as { mockResolvedValueOnce: (_v: unknown) => void }).mockResolvedValueOnce(
      null
    );
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/fillups/export'), {
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
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/fillups/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(429);
  });

  it('returns 404 when vehicle not found', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
    };
    prisma.vehicle.findFirst = vi.fn().mockResolvedValueOnce(null);
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/fillups/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(404);
  });

  it('returns CSV with correct formatting and filename on success', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
      fuelFillUp: { findMany: (_args?: unknown) => Promise<unknown[]> };
    };
    (prisma.vehicle.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: 'v1',
      name: 'My Car*? name',
    });
    (prisma.fuelFillUp.findMany as unknown as Mock).mockResolvedValueOnce([
      {
        date: new Date('2024-02-01T00:00:00.000Z'),
        odometerKm: 15000,
        liters: { toNumber: () => 40.5 },
        pricePerLiter: { toNumber: () => 1.999 },
        totalCost: { toNumber: () => 80.97 },
        isFull: true,
        notes: 'n',
      },
    ]);

    const res = await GET(new NextRequest('http://x/api/vehicles/v1/fillups/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });

    expect(res.status).toBe(200);
    const disp = res.headers.get('Content-Disposition');
    expect(disp).toMatch(/fillups_My_Car_name_\d{8}\.csv/);
    const body = await res.text();
    const [header, line] = body.split('\n');
    expect(header).toBe('Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes');
    const cols = line.split(';');
    expect(cols[0]).toBe('2024-02-01');
    expect(cols[1]).toBe('15000');
    expect(cols[2]).toBe('40.50');
    expect(cols[3]).toBe('1.999');
    expect(cols[4]).toBe('80.97');
    expect(cols[5]).toBe('1');
  });
});
