// @vitest-environment node
import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, PUT } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    user: { findUnique: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    vehicleAccess: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { default: mock };
});

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'admin-1', email: 'a@e' } })) }));

type PrismaMock = {
  user: { findUnique: Mock };
  vehicle: { findUnique: Mock };
  vehicleAccess: { findMany: Mock; findUnique: Mock; count: Mock; upsert: Mock; deleteMany: Mock };
};

describe('/api/admin/vehicles/[vehicleId]/access', () => {
  beforeEach(async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockReset();
    prisma.vehicle.findUnique.mockReset();
    prisma.vehicleAccess.findMany.mockReset();
    prisma.vehicleAccess.findUnique.mockReset();
    prisma.vehicleAccess.count.mockReset();
    prisma.vehicleAccess.upsert.mockReset();
    prisma.vehicleAccess.deleteMany.mockReset();
  });

  it('GET returns 404 when vehicle does not exist', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });
    prisma.vehicle.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access');
    const res = await GET(req, { params: Promise.resolve({ vehicleId: 'v1' }) });

    expect(res.status).toBe(404);
  });

  it('GET returns access rows', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });
    prisma.vehicle.findUnique.mockResolvedValueOnce({ id: 'v1', name: 'Car A' });
    prisma.vehicleAccess.findMany.mockResolvedValueOnce([
      {
        id: 'a1',
        userId: 'u2',
        role: 'EDITOR',
        createdAt: new Date(),
        user: { email: 'u2@example.com', username: 'u2' },
      },
    ]);

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access');
    const res = await GET(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.access).toHaveLength(1);
    expect(body.data.access[0].userEmail).toBe('u2@example.com');
  });

  it('PUT creates or updates vehicle access', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'u2' });
    prisma.vehicle.findUnique.mockResolvedValueOnce({ id: 'v1' });
    prisma.vehicleAccess.upsert.mockResolvedValueOnce({
      id: 'a1',
      vehicleId: 'v1',
      userId: 'u2',
      role: 'OWNER',
    });

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access', {
      method: 'PUT',
      body: JSON.stringify({ userEmail: 'User@Example.com', role: 'OWNER' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.access.role).toBe('OWNER');
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: 'user@example.com' },
      select: { id: true },
    });
  });

  it('PUT supports userId selection', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'u3' });
    prisma.vehicle.findUnique.mockResolvedValueOnce({ id: 'v1' });
    prisma.vehicleAccess.upsert.mockResolvedValueOnce({
      id: 'a2',
      vehicleId: 'v1',
      userId: 'u3',
      role: 'EDITOR',
    });

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access', {
      method: 'PUT',
      body: JSON.stringify({ userId: 'u3', role: 'EDITOR' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.access.userId).toBe('u3');
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'u3' },
      select: { id: true },
    });
  });

  it('PUT returns 400 when demoting the final owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'u2' });
    prisma.vehicle.findUnique.mockResolvedValueOnce({ id: 'v1' });
    prisma.vehicleAccess.findUnique.mockResolvedValueOnce({ role: 'OWNER' });
    prisma.vehicleAccess.count.mockResolvedValueOnce(1);

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access', {
      method: 'PUT',
      body: JSON.stringify({ userId: 'u2', role: 'EDITOR' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('LAST_OWNER');
    expect(prisma.vehicleAccess.upsert).not.toHaveBeenCalled();
  });

  it('DELETE returns 400 when revoking the final owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });
    prisma.vehicleAccess.findUnique.mockResolvedValueOnce({ role: 'OWNER' });
    prisma.vehicleAccess.count.mockResolvedValueOnce(1);

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access', {
      method: 'DELETE',
      body: JSON.stringify({ userId: 'u2' }),
    });
    const res = await DELETE(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('LAST_OWNER');
    expect(prisma.vehicleAccess.deleteMany).not.toHaveBeenCalled();
  });

  it('DELETE is idempotent', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });
    prisma.vehicleAccess.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/admin/vehicles/v1/access', {
      method: 'DELETE',
      body: JSON.stringify({ userId: 'u2' }),
    });
    const res = await DELETE(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.ok).toBe(true);
  });
});
