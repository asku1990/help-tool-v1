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
    tireSet: { findMany: vi.fn() },
    tireChangeLog: { findMany: vi.fn() },
  },
}));

describe('api/vehicles/[vehicleId]/tires/export GET (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as { mockResolvedValueOnce: (_v: unknown) => void }).mockResolvedValueOnce(
      null
    );
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/tires/export'), {
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
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/tires/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(429);
  });

  it('returns 404 when vehicle not found', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
    };
    prisma.vehicle.findFirst = vi.fn().mockResolvedValueOnce(null);
    const res = await GET(new NextRequest('http://x/api/vehicles/v1/tires/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });
    expect(res.status).toBe(404);
  });

  it('returns CSV with tire sets and change logs sections on success', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
      tireSet: { findMany: (_args?: unknown) => Promise<unknown[]> };
      tireChangeLog: { findMany: (_args?: unknown) => Promise<unknown[]> };
    };
    (prisma.vehicle.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: 'v1',
      name: 'Test Car',
    });
    (prisma.tireSet.findMany as unknown as Mock).mockResolvedValueOnce([
      {
        id: 'ts1',
        name: 'Summer Tires',
        type: 'SUMMER',
        status: 'ACTIVE',
        totalKm: 5000,
        purchaseDate: new Date('2023-04-01T00:00:00.000Z'),
        notes: 'Good condition',
        createdAt: new Date('2023-04-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-01T10:00:00.000Z'),
      },
      {
        id: 'ts2',
        name: 'Winter; "Studs"',
        type: 'WINTER',
        status: 'STORED',
        totalKm: 3000,
        purchaseDate: null,
        notes: null,
        createdAt: new Date('2023-10-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-01T10:00:00.000Z'),
      },
    ]);
    (prisma.tireChangeLog.findMany as unknown as Mock).mockResolvedValueOnce([
      {
        id: 'cl1',
        tireSetId: 'ts1',
        date: new Date('2024-04-01T00:00:00.000Z'),
        odometerKm: 15000,
        notes: 'Spring swap',
        createdAt: new Date('2024-04-01T10:00:00.000Z'),
      },
      {
        id: 'cl2',
        tireSetId: 'ts2',
        date: new Date('2023-11-01T00:00:00.000Z'),
        odometerKm: 12000,
        notes: null,
        createdAt: new Date('2023-11-01T10:00:00.000Z'),
      },
    ]);

    const res = await GET(new NextRequest('http://x/api/vehicles/v1/tires/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });

    expect(res.status).toBe(200);
    const disp = res.headers.get('Content-Disposition');
    expect(disp).toMatch(/tires_Test_Car_\d{8}\.csv/);
    expect(res.headers.get('Content-Type')).toContain('text/csv');

    const body = await res.text();
    const lines = body.split('\n');

    // Check section headers
    expect(lines[0]).toBe('[TIRE_SETS]');
    expect(lines[1]).toBe('Id;Name;Type;Status;TotalKm;PurchaseDate;Notes;CreatedAt;UpdatedAt');

    // Check tire set data
    expect(lines[2]).toContain('ts1;Summer Tires;SUMMER;ACTIVE;5000;2023-04-01;Good condition;');

    // Check that special characters are escaped
    expect(lines[3]).toContain('"Winter; ""Studs"""');

    // Check change logs section
    const changeLogSectionIndex = lines.findIndex(l => l === '[CHANGE_LOGS]');
    expect(changeLogSectionIndex).toBeGreaterThan(0);
    expect(lines[changeLogSectionIndex + 1]).toBe('Id;TireSetId;Date;OdometerKm;Notes;CreatedAt');
    expect(lines[changeLogSectionIndex + 2]).toContain('cl1;ts1;2024-04-01;15000;Spring swap;');
  });

  it('handles empty tire sets and change logs', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: (_args?: unknown) => Promise<unknown> };
      tireSet: { findMany: (_args?: unknown) => Promise<unknown[]> };
      tireChangeLog: { findMany: (_args?: unknown) => Promise<unknown[]> };
    };
    (prisma.vehicle.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: 'v1',
      name: 'Empty Car',
    });
    (prisma.tireSet.findMany as unknown as Mock).mockResolvedValueOnce([]);
    (prisma.tireChangeLog.findMany as unknown as Mock).mockResolvedValueOnce([]);

    const res = await GET(new NextRequest('http://x/api/vehicles/v1/tires/export'), {
      params: Promise.resolve({ vehicleId: 'v1' }),
    } as unknown as { params: Promise<{ vehicleId: string }> });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('[TIRE_SETS]');
    expect(body).toContain('[CHANGE_LOGS]');
  });
});
