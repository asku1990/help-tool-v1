// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicle: { findFirst: vi.fn() },
    fuelFillUp: { update: vi.fn(), delete: vi.fn() },
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));

type PrismaMock = {
  vehicle: { findFirst: Mock };
  fuelFillUp: { update: Mock; delete: Mock };
};

describe('api/vehicles/[vehicleId]/fillups/[fillUpId] route (unit)', () => {
  it('PATCH returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const base = new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify({}) });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }),
    });
    expect(res.status).toBe(404);
  });

  it('PATCH updates and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.update.mockResolvedValueOnce({ id: 'f' });
    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ liters: 2 }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });
    expect(res.status).toBe(200);
  });

  it('DELETE removes and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.delete.mockResolvedValueOnce({ id: 'f' });
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }),
    });
    expect(res.status).toBe(200);
  });
});
