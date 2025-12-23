// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    vehicle: { findFirst: vi.fn() },
    tireChangeLog: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@example.com' } })),
}));

type PrismaMock = {
  vehicle: { findFirst: Mock };
  tireChangeLog: { findFirst: Mock; update: Mock; delete: Mock };
};

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
    expect(prisma.tireChangeLog.update).toHaveBeenCalled();
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
    prisma.tireChangeLog.delete.mockResolvedValueOnce({ id: 'log1' });

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log/log1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', logId: 'log1' }) };

    const response = await DELETE(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe('log1');
    expect(prisma.tireChangeLog.delete).toHaveBeenCalledWith({ where: { id: 'log1' } });
  });
});
