// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    vehicle: { findFirst: vi.fn() },
    tireSet: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@example.com' } })),
}));

type PrismaMock = {
  vehicle: { findFirst: Mock };
  tireSet: { findFirst: Mock; update: Mock; updateMany: Mock; delete: Mock };
};

describe('GET /api/vehicles/[vehicleId]/tires/[tireSetId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await GET(req, context);
    expect(response.status).toBe(401);
  });

  it('returns 404 if vehicle not found', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await GET(req, context);
    expect(response.status).toBe(404);
  });

  it('returns 404 if tire set not found', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await GET(req, context);
    expect(response.status).toBe(404);
  });

  it('returns tire set details', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce({
      id: 't1',
      vehicleId: 'v1',
      name: 'Summer Tires',
      type: 'SUMMER',
      status: 'ACTIVE',
      totalKm: 5000,
      purchaseDate: new Date('2024-01-01'),
      notes: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-01'),
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1');
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tireSet.name).toBe('Summer Tires');
  });
});

describe('PATCH /api/vehicles/[vehicleId]/tires/[tireSetId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await PATCH(req, context);
    expect(response.status).toBe(401);
  });

  it('returns 400 on validation error', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce({ id: 't1' });

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'PATCH',
      body: JSON.stringify({ type: 'INVALID' }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await PATCH(req, context);
    expect(response.status).toBe(400);
  });

  it('updates tire set and sets others to STORED when setting to ACTIVE', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce({ id: 't1', status: 'STORED' });
    prisma.tireSet.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.tireSet.update.mockResolvedValueOnce({ id: 't1' });

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await PATCH(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe('t1');
    expect(prisma.tireSet.updateMany).toHaveBeenCalledWith({
      where: {
        vehicleId: 'v1',
        id: { not: 't1' },
        status: { not: 'RETIRED' },
      },
      data: { status: 'STORED' },
    });
  });

  it('updates tire set name and notes', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce({ id: 't1' });
    prisma.tireSet.update.mockResolvedValueOnce({ id: 't1' });

    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name', notes: 'Some notes' }),
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await PATCH(req, context);
    expect(response.status).toBe(200);
    expect(prisma.tireSet.update).toHaveBeenCalled();
  });
});

describe('DELETE /api/vehicles/[vehicleId]/tires/[tireSetId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await DELETE(req, context);
    expect(response.status).toBe(401);
  });

  it('returns 404 if tire set not found', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce(null);

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await DELETE(req, context);
    expect(response.status).toBe(404);
  });

  it('deletes tire set successfully', async () => {
    const { default: prisma } = (await import('@/lib/db')) as unknown as { default: PrismaMock };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.tireSet.findFirst.mockResolvedValueOnce({ id: 't1' });
    prisma.tireSet.delete.mockResolvedValueOnce({ id: 't1' });

    const { DELETE } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/t1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ vehicleId: 'v1', tireSetId: 't1' }) };

    const response = await DELETE(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe('t1');
    expect(prisma.tireSet.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
});
