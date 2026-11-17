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
  it('returns same-day trip segments consistent with the summary calculator across a page boundary', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: Mock };
      fuelFillUp: { findMany: Mock };
    };
    const rows = [
      {
        id: '5',
        date: new Date('2026-11-17'),
        odometerKm: 199468,
        liters: 8.55,
        totalCost: 11.54,
      },
      {
        id: '4',
        date: new Date('2026-11-15'),
        odometerKm: 199219,
        liters: 17.43,
        totalCost: 32.59,
      },
      {
        id: '3',
        date: new Date('2026-11-13'),
        odometerKm: 198736,
        liters: 13.9,
        totalCost: 32.66,
      },
      {
        id: '2',
        date: new Date('2026-11-13'),
        odometerKm: 198395,
        liters: 8.92,
        totalCost: 12.04,
      },
      {
        id: '1',
        date: new Date('2026-11-10'),
        odometerKm: 198209,
        liters: 10.46,
        totalCost: 14.12,
      },
    ].map(row => ({ ...row, pricePerLiter: 1.35, isFull: true }));
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.findMany
      .mockResolvedValueOnce(rows.slice(0, 4))
      .mockResolvedValueOnce(rows.slice(2));
    const response = await GET(
      new NextRequest('http://localhost/api/vehicles/v/fillups?limit=3&withSegments=1'),
      { params: Promise.resolve({ vehicleId: 'v' }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.fillUps).toHaveLength(3);
    expect(body.data.fillUps[0].segment.lPer100).toBeCloseTo(3.4337, 3);
    expect(body.data.fillUps[2].segment.distanceKm).toBe(341);
    expect(body.data.fillUps[2].segment.prevLPer100).toBeCloseTo((8.92 / 186) * 100);
  });

  it('does not truncate the baseline when more than 200 partial fills precede a full tank', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: Mock };
      fuelFillUp: { findMany: Mock };
    };
    const baseline = {
      id: 'baseline',
      date: new Date('2026-01-01'),
      odometerKm: 0,
      liters: 5,
      totalCost: 10,
      pricePerLiter: 2,
      isFull: true,
    };
    const partials = Array.from({ length: 205 }, (_, i) => ({
      ...baseline,
      id: `partial-${i}`,
      date: new Date('2026-01-02'),
      odometerKm: i + 1,
      liters: 1,
      totalCost: 2,
      isFull: false,
    }));
    const end = {
      ...baseline,
      id: 'end',
      date: new Date('2026-01-03'),
      odometerKm: 1000,
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.findMany
      .mockResolvedValueOnce([end, partials[204]])
      .mockResolvedValueOnce([end, ...partials.slice().reverse(), baseline]);
    const response = await GET(
      new NextRequest('http://localhost/api/vehicles/v/fillups?limit=1&withSegments=1'),
      { params: Promise.resolve({ vehicleId: 'v' }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.fillUps[0].segment.litersUsed).toBe(210);
    expect(body.data.fillUps[0].segment.lPer100).toBe(21);
    expect(prisma.fuelFillUp.findMany).toHaveBeenLastCalledWith({
      where: { vehicleId: 'v', date: { lte: end.date } },
      orderBy: [{ date: 'desc' }, { odometerKm: 'desc' }],
    });
  });

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
