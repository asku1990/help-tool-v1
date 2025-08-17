// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicle: { findFirst: vi.fn() },
    fuelFillUp: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'k',
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  rateLimitHeaders: (ms: number) => ({ 'Retry-After': String(Math.ceil(ms / 1000)) }),
}));

describe('api/vehicles/[vehicleId]/fillups route (unit)', () => {
  it('GET paginates and returns empty', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: Mock };
      fuelFillUp: { findMany: Mock; create: Mock };
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.findMany.mockResolvedValueOnce([]);
    const req = new NextRequest('http://localhost/api/vehicles/v/fillups?limit=1');
    const res = await GET(req, {
      params: Promise.resolve({ vehicleId: 'v' }),
    });
    expect(res.status).toBe(200);
  });

  it('GET returns 429 when rate limited', async () => {
    const rl = await import('@/lib/api/rate-limit');
    (rl.checkRateLimit as unknown as Mock).mockReturnValueOnce({
      allowed: false,
      retryAfterMs: 10,
    });
    const res = await GET(new NextRequest('http://localhost/api/vehicles/v/fillups'), {
      params: Promise.resolve({ vehicleId: 'v' }),
    });
    expect(res.status).toBe(429);
  });

  it('POST returns 201 on create', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: Mock };
      fuelFillUp: { create: Mock };
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.create.mockResolvedValueOnce({ id: 'f' });
    const req = new NextRequest('http://localhost/api/vehicles/v/fillups', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-01-01',
        odometerKm: 1,
        liters: 1,
        pricePerLiter: 1,
        totalCost: 1,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ vehicleId: 'v' }) });
    expect(res.status).toBe(201);
  });
});
