// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { auth as authenticate } from '@/auth';
import { checkRateLimit } from '@/lib/api/rate-limit';

vi.mock('@/lib/api/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/rate-limit')>()),
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/lib/db', () => ({
  default: {
    $transaction: vi.fn(),
    vehicle: { findFirst: vi.fn() },
    tireSet: { update: vi.fn(), updateMany: vi.fn() },
    tireChangeLog: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@example.com' } })),
}));

type PrismaMock = {
  $transaction: Mock;
  vehicle: { findFirst: Mock };
  tireSet: { update: Mock; updateMany: Mock };
  tireChangeLog: { findFirst: Mock; findMany: Mock; update: Mock; delete: Mock };
};

beforeEach(async () => {
  const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
  prisma.$transaction.mockImplementation((run: (_tx: PrismaMock) => unknown) => run(prisma));
  prisma.tireChangeLog.findMany.mockResolvedValue([]);
});

it.each(['GET', 'PATCH', 'DELETE'] as const)(
  'rate limits %s before accessing tire change data',
  async method => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterMs: 1500 });
    const handlers = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method,
    });
    const response = await handlers[method](req, {
      params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('2');
    expect(authenticate).not.toHaveBeenCalled();
  }
);

describe('GET /api/vehicles/[vehicleId]/tires/change-log/[logId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await GET(req, context);
    expect(response.status).toBe(401);
  });

  it('returns 404 if vehicle not found', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await GET(req, context);
    expect(response.status).toBe(404);
  });

  it('returns 404 if log not found', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await GET(req, context);
    expect(response.status).toBe(404);
  });

  it('returns change log details', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce({
      id: 'log1',
      vehicleId: 'v1',
      tireSetId: 't1',
      date: new Date('2024-06-01'),
      odometerKm: 10000,
      notes: 'Switched to summer',
      tireSet: { id: 't1', name: 'Summer Tires' },
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.log.odometerKm).toBe(10000);
  });
});

describe('PATCH /api/vehicles/[vehicleId]/tires/change-log/[logId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'PATCH',
      body: JSON.stringify({ odometerKm: 12000 }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await PATCH(req, context);
    expect(response.status).toBe(401);
  });

  it('returns 400 on validation error', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce({ id: 'log1' });

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'PATCH',
      body: JSON.stringify({ odometerKm: -1 }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await PATCH(req, context);
    expect(response.status).toBe(400);
  });

  it('updates change log successfully', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce({ id: 'log1' });
    prisma.tireChangeLog.update.mockResolvedValueOnce({ id: 'log1' });

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'PATCH',
      body: JSON.stringify({ date: '2024-07-01', odometerKm: 12000, notes: 'Updated' }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await PATCH(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe('log1');
    expect(prisma.tireChangeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ odometerKm: 12000, odometerConfirmed: true }),
      })
    );
  });

  it('clears notes when set to null', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce({ id: 'log1', notes: 'Old notes' });
    prisma.tireChangeLog.update.mockResolvedValueOnce({ id: 'log1' });

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'PATCH',
      body: JSON.stringify({ notes: null }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await PATCH(req, context);
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/vehicles/[vehicleId]/tires/change-log/[logId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await DELETE(req, context);
    expect(response.status).toBe(401);
  });

  it('returns 404 if log not found', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce(null);

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await DELETE(req, context);
    expect(response.status).toBe(404);
  });

  it('deletes change log successfully', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce({ id: 'log1' });
    prisma.tireChangeLog.findFirst.mockResolvedValueOnce({ tireSetId: 'current' });
    prisma.tireChangeLog.delete.mockResolvedValueOnce({ id: 'log1' });
    prisma.tireChangeLog.findMany.mockResolvedValueOnce([{ id: 'older', tireSetId: 'previous' }]);

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await DELETE(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe('log1');
    expect(prisma.tireChangeLog.delete).toHaveBeenCalledWith({
      where: { id: 'log1', vehicleId: 'v1' },
    });
    expect(prisma.tireSet.update).toHaveBeenCalledWith({
      where: { id: 'previous', vehicleId: 'v1' },
      data: { status: 'ACTIVE' },
    });
  });
});
