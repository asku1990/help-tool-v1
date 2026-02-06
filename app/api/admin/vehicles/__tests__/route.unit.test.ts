// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    user: { findUnique: vi.fn() },
    vehicle: { findMany: vi.fn() },
  };
  return { default: mock };
});

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'admin-1', email: 'a@e' } })) }));

type PrismaMock = {
  user: { findUnique: Mock };
  vehicle: { findMany: Mock };
};

describe('GET /api/admin/vehicles', () => {
  it('returns 403 when user is not admin', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'REGULAR' });

    const req = new NextRequest('http://localhost/api/admin/vehicles');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns vehicles for admin', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });
    prisma.vehicle.findMany.mockResolvedValueOnce([
      {
        id: 'v1',
        name: 'Car',
        make: 'Tesla',
        model: 'Model 3',
        year: 2023,
        userId: 'u1',
        createdAt: new Date('2025-01-01'),
        user: { email: 'owner@example.com' },
        _count: { access: 2 },
      },
    ]);

    const req = new NextRequest('http://localhost/api/admin/vehicles');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.vehicles[0]).toMatchObject({
      id: 'v1',
      ownerEmail: 'owner@example.com',
      accessCount: 2,
    });
  });
});
