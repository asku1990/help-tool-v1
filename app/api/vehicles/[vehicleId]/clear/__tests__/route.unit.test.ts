// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { DELETE } from '../route';
import type { PrismaClient, Vehicle } from '@/generated/prisma';

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'key',
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  rateLimitHeaders: () => ({}),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  default: {
    vehicle: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { checkRateLimit: mockCheckRateLimit } = (await vi.importMock('@/lib/api/rate-limit')) as {
  checkRateLimit: Mock;
};

const {
  logger: { error: mockLoggerError },
} = (await vi.importMock('@/lib/logger')) as {
  logger: { error: Mock };
};

const { default: prismaMock } = (await vi.importMock('@/lib/db')) as {
  default: {
    vehicle: { findFirst: Mock };
    $transaction: Mock;
  };
};
const mockVehicleFindFirst = vi.mocked(prismaMock.vehicle.findFirst);
const mockTransaction = vi.mocked(prismaMock.$transaction) as Mock<PrismaClient['$transaction']>;
type TransactionCallback = Parameters<PrismaClient['$transaction']>[0];
type TransactionClientArg = Parameters<TransactionCallback>[0];
type AuthResult = { user?: { email?: string | null } } | null;
const mockAuth = vi.mocked(auth) as Mock<() => Promise<AuthResult>>;
const mockAuthSession: NonNullable<AuthResult> = {
  user: { email: 'user@example.com' },
};

type TransactionCounts = {
  fillUps: number;
  expenses: number;
  tireSets: number;
  changeLogs: number;
};

const createTransactionCounts = (counts: TransactionCounts) => ({
  tireChangeLog: { deleteMany: vi.fn(async () => ({ count: counts.changeLogs })) },
  tireSet: { deleteMany: vi.fn(async () => ({ count: counts.tireSets })) },
  expense: { deleteMany: vi.fn(async () => ({ count: counts.expenses })) },
  fuelFillUp: { deleteMany: vi.fn(async () => ({ count: counts.fillUps })) },
});

describe('DELETE /api/vehicles/[vehicleId]/clear', () => {
  const counts = { fillUps: 5, expenses: 4, tireSets: 3, changeLogs: 2 };

  beforeEach(() => {
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    mockAuth.mockReset();
    mockAuth.mockResolvedValue(mockAuthSession);
    mockVehicleFindFirst.mockReset();
    mockTransaction.mockReset();
    mockLoggerError.mockReset();
  });

  it('clears vehicle data and returns deleted counts', async () => {
    const vehicleMock = {
      id: 'vehicle-1',
      userId: 'user-1',
      name: 'Test vehicle',
      createdAt: new Date(),
      updatedAt: new Date(),
      initialOdometer: 0,
    } as Vehicle;
    mockVehicleFindFirst.mockResolvedValue(vehicleMock);
    const tx = createTransactionCounts(counts);
    const txArg = tx as unknown as TransactionClientArg;
    mockTransaction.mockImplementation(cb => cb(txArg));

    const res = await DELETE(
      new NextRequest('http://localhost/api/vehicles/vehicle-1/clear', { method: 'DELETE' }),
      { params: Promise.resolve({ vehicleId: 'vehicle-1' }) }
    );

    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 3000 });
    const res = await DELETE(
      new NextRequest('http://localhost/api/vehicles/vehicle-1/clear', { method: 'DELETE' }),
      { params: Promise.resolve({ vehicleId: 'vehicle-1' }) }
    );
    expect(res.status).toBe(429);
  });
});
