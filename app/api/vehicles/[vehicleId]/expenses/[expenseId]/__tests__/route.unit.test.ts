// @vitest-environment node
import { describe, it, expect, vi, type Mock, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicle: { findFirst: vi.fn() },
    expense: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));

type PrismaMock = {
  vehicle: { findFirst: Mock };
  expense: { findFirst: Mock; findMany: Mock; update: Mock; delete: Mock };
};

describe('api/vehicles/[vehicleId]/expenses/[expenseId] route (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCH returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const base = new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify({}) });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH returns 404 when expense is not found for vehicle', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.findFirst.mockResolvedValueOnce(null);
    const base = new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify({}) });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }),
    });
    expect(res.status).toBe(404);
  });

  it('PATCH updates and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.findFirst.mockResolvedValueOnce({
      id: 'e',
      date: new Date('2024-01-01'),
      category: 'OTHER',
      vendor: null,
      odometerKm: null,
      liters: null,
    });
    prisma.expense.update.mockResolvedValueOnce({ id: 'e' });
    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 5 }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(200);
  });

  it('PATCH recalculates oilConsumption for OIL_TOP_UP when edited', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.findFirst
      .mockResolvedValueOnce({
        id: 'e',
        date: new Date('2024-02-01'),
        category: 'OIL_TOP_UP',
        vendor: null,
        odometerKm: 12000,
        liters: 1,
      })
      .mockResolvedValueOnce({
        date: new Date('2024-01-15'),
        odometerKm: 10000,
      });
    prisma.expense.findMany.mockResolvedValueOnce([{ liters: 0.5 }]);
    prisma.expense.update.mockResolvedValueOnce({ id: 'e' });

    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'OIL_TOP_UP', odometerKm: 13000, liters: 1.5 }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(200);

    const updateArgs = prisma.expense.update.mock.calls[0]?.[0] as unknown as {
      data: { oilConsumption: number | null };
    };
    expect(updateArgs.data.oilConsumption).not.toBeNull();
    expect(updateArgs.data.oilConsumption).toBeCloseTo((2 / 3000) * 10000, 5);

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { id: 'e' },
        }),
      })
    );
  });

  it('PATCH clears oilConsumption when category changes away from OIL_TOP_UP', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.findFirst.mockResolvedValueOnce({
      id: 'e',
      date: new Date('2024-02-01'),
      category: 'OIL_TOP_UP',
      vendor: null,
      odometerKm: 12000,
      liters: 1,
    });
    prisma.expense.update.mockResolvedValueOnce({ id: 'e' });

    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'OTHER' }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(200);

    const updateArgs = prisma.expense.update.mock.calls[0]?.[0] as unknown as {
      data: { oilConsumption: number | null };
    };
    expect(updateArgs.data.oilConsumption).toBeNull();
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(prisma.expense.findFirst).toHaveBeenCalledTimes(1);
  });

  it('DELETE removes and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.delete.mockResolvedValueOnce({ id: 'e' });
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }),
    });
    expect(res.status).toBe(200);
  });
});
