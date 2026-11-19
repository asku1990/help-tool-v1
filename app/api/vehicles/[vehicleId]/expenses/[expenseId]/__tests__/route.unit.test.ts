// @vitest-environment node
import { describe, it, expect, vi, type Mock, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

vi.mock('@/lib/db', () => {
  const expense = { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() };
  const mock = {
    vehicle: { findFirst: vi.fn() },
    expense,
    $transaction: vi.fn((run: (_tx: { expense: typeof expense }) => unknown) => run({ expense })),
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));

type PrismaMock = {
  vehicle: { findFirst: Mock };
  expense: { findFirst: Mock; findMany: Mock; update: Mock; deleteMany: Mock };
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
    prisma.expense.update.mockRejectedValueOnce(Object.assign(new Error(), { code: 'P2025' }));
    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ liters: 2 }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(404);
    expect(prisma.expense.update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: { id: 'e', vehicleId: 'v' } })
    );
  });

  it('DELETE returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }),
    });
    expect(res.status).toBe(404);
  });

  it('PATCH leaves oil consumption untouched when updating only the amount and notes', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.update.mockResolvedValueOnce({ id: 'e' });
    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 5, notes: 'Receipt checked' }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(200);
    expect(prisma.expense.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'e', vehicleId: 'v' },
      data: expect.objectContaining({ amount: 5, notes: 'Receipt checked' }),
      select: { id: true },
    });
    expect(prisma.expense.update.mock.calls[0]?.[0].data).not.toHaveProperty('oilConsumption');
    expect(prisma.expense.findFirst).not.toHaveBeenCalled();
  });

  it('PATCH recalculates oilConsumption for OIL_TOP_UP when edited', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.update
      .mockResolvedValueOnce({
        date: new Date('2024-02-01'),
        category: 'OIL_TOP_UP',
        odometerKm: 13000,
        liters: 1.5,
      })
      .mockResolvedValueOnce({ id: 'e' });
    prisma.expense.findFirst.mockResolvedValueOnce({
      date: new Date('2024-01-15'),
      odometerKm: 10000,
    });
    prisma.expense.findMany.mockResolvedValueOnce([
      { date: new Date('2024-01-20'), odometerKm: 11000, liters: 0.5 },
    ]);

    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'OIL_TOP_UP', odometerKm: 13000, liters: 1.5 }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(200);

    const updateArgs = prisma.expense.update.mock.calls[1]?.[0] as unknown as {
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
    prisma.expense.update
      .mockResolvedValueOnce({ category: 'OTHER' })
      .mockResolvedValueOnce({ id: 'e' });

    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'OTHER' }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }) });
    expect(res.status).toBe(200);

    const updateArgs = prisma.expense.update.mock.calls[1]?.[0] as unknown as {
      data: { oilConsumption: number | null };
    };
    expect(updateArgs.data.oilConsumption).toBeNull();
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(prisma.expense.findFirst).not.toHaveBeenCalled();
  });

  it('DELETE removes and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.deleteMany.mockResolvedValueOnce({ count: 1 });
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', expenseId: 'e' }),
    });
    expect(res.status).toBe(200);
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: { id: 'e', vehicleId: 'v' },
    });
  });

  it('DELETE cannot delete an expense belonging to another car', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'authorized-car' });
    prisma.expense.deleteMany.mockResolvedValueOnce({ count: 0 });
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'authorized-car', expenseId: 'other-car-expense' }),
    });
    expect(res.status).toBe(404);
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: { id: 'other-car-expense', vehicleId: 'authorized-car' },
    });
  });
});
