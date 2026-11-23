// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock modules before importing the route
vi.mock('@/lib/db', () => ({
  default: {
    $transaction: vi.fn(),
    vehicle: { findFirst: vi.fn() },
    tireSet: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    tireChangeLog: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@example.com' } })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  rateLimitHeaders: vi.fn(() => ({})),
  rateLimitKey: vi.fn(() => 'test-key'),
}));

type PrismaMock = {
  $transaction: Mock;
  vehicle: { findFirst: Mock };
  tireSet: { findFirst: Mock; updateMany: Mock; update: Mock };
  tireChangeLog: { findFirst: Mock; findMany: Mock; create: Mock };
};

type MockVehicle = {
  id: string;
  userId: string;
  name: string;
};

type MockTireSet = {
  id: string;
  vehicleId: string;
  name: string;
};

type MockChangeLog = {
  id: string;
  vehicleId: string;
  tireSetId: string;
  date: Date;
  odometerKm: number;
  notes: string;
  tireSet: MockTireSet;
};

describe('GET /api/vehicles/[vehicleId]/tires/change-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns tire change history', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);

    const mockHistory: MockChangeLog[] = [
      {
        id: 'cl1',
        vehicleId: 'v1',
        tireSetId: 't1',
        date: new Date('2024-06-01'),
        odometerKm: 10000,
        notes: 'Switched to summer tires',
        tireSet: {
          id: 't1',
          vehicleId: 'v1',
          name: 'Summer Tires',
        },
      },
    ];

    prisma.tireChangeLog.findMany.mockResolvedValueOnce(mockHistory);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.history).toHaveLength(1);
    expect(data.data.history[0].odometerKm).toBe(10000);
  });

  it('returns 429 when rate limit blocks the request', async () => {
    const rateLimit = await import('@/lib/api/rate-limit');
    (rateLimit.checkRateLimit as unknown as Mock).mockReturnValueOnce({
      allowed: false,
      retryAfterMs: 5000,
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('returns 500 when fetching history throws', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
    prisma.tireChangeLog.findMany.mockRejectedValueOnce(new Error('db down'));

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);

    expect(response.status).toBe(500);
  });
});

describe('POST /api/vehicles/[vehicleId]/tires/change-log', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.$transaction.mockImplementation((run: (_tx: PrismaMock) => unknown) => run(prisma));
    prisma.tireChangeLog.findMany.mockResolvedValue([]);
  });

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires/change-log', {
      method: 'POST',
      body: JSON.stringify({
        tireSetId: 't1',
        date: '2024-06-01',
        odometerKm: 10000,
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 if tire set does not belong to vehicle', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
    prisma.tireSet.findFirst.mockResolvedValueOnce(null);

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires/change-log', {
      method: 'POST',
      body: JSON.stringify({
        tireSetId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-06-01',
        odometerKm: 10000,
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_TIRE_SET');
  });

  it.each([15000, null])(
    'logs a tire change with odometer %s and updates statuses',
    async odometerKm => {
      const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
      const vehicle: MockVehicle = {
        id: 'v1',
        userId: 'u1',
        name: 'Test Car',
      };
      prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
      const tireSet: MockTireSet = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        vehicleId: 'v1',
        name: 'Winter Tires',
      };
      prisma.tireSet.findFirst.mockResolvedValueOnce(tireSet);
      prisma.tireChangeLog.create.mockResolvedValueOnce({ id: 'cl1' });
      prisma.tireChangeLog.findMany.mockResolvedValueOnce([
        { id: 'cl1', tireSetId: tireSet.id, odometerKm, odometerConfirmed: odometerKm !== null },
      ]);
      prisma.tireSet.updateMany.mockResolvedValueOnce({ count: 2 });
      prisma.tireSet.update.mockResolvedValueOnce({ id: 't1' });

      const { POST } = await import('../route');
      const base = new Request('http://localhost/api/vehicles/v1/tires/change-log', {
        method: 'POST',
        body: JSON.stringify({
          tireSetId: '550e8400-e29b-41d4-a716-446655440000',
          date: '2024-11-01',
          odometerKm,
          notes: 'Switched to winter tires',
        }),
      });
      const req = new NextRequest(base);
      const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

      const response = await POST(req, context);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.id).toBe('cl1');

      // Verify that all non-retired tire sets (except the one being mounted) were set to STORED
      expect(prisma.tireSet.updateMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'v1',
          id: { not: '550e8400-e29b-41d4-a716-446655440000' },
          status: 'ACTIVE',
        },
        data: { status: 'STORED' },
      });

      // Verify that the mounted tire set was set to ACTIVE
      expect(prisma.tireSet.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000', vehicleId: 'v1' },
        data: { status: 'ACTIVE' },
      });
      expect(prisma.tireChangeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ odometerKm, odometerConfirmed: odometerKm !== null }),
        })
      );
    }
  );

  it('returns 400 if validation fails', async () => {
    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires/change-log', {
      method: 'POST',
      body: JSON.stringify({
        tireSetId: 'invalid-uuid',
        date: '',
        odometerKm: 'not-a-number',
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    [4500, 400],
    [6000, 201],
  ])(
    'validates a backdated reading of %d without replacing the current mount',
    async (odometerKm, status) => {
      const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
      const tireSetId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
      prisma.tireSet.findFirst.mockResolvedValueOnce({ id: tireSetId });
      prisma.tireChangeLog.findFirst.mockResolvedValueOnce({ tireSetId: 'current' });
      prisma.tireChangeLog.create.mockResolvedValueOnce({ id: 'backdated' });
      prisma.tireChangeLog.findMany.mockResolvedValueOnce([
        { id: 'newest', tireSetId: 'current', odometerKm: 7000, odometerConfirmed: true },
        { id: 'backdated', tireSetId, odometerKm, odometerConfirmed: true },
        { id: 'older', tireSetId: 'older', odometerKm: 5000, odometerConfirmed: true },
      ]);

      const { POST } = await import('../route');
      const req = new NextRequest('http://localhost/api/vehicles/v1/tires/change-log', {
        method: 'POST',
        body: JSON.stringify({ tireSetId, date: '2024-07-01', odometerKm }),
      });
      const response = await POST(req, { params: Promise.resolve({ vehicleId: 'v1' }) });

      expect(response.status).toBe(status);
      expect(prisma.tireSet.update).not.toHaveBeenCalled();
      expect(prisma.tireSet.updateMany).not.toHaveBeenCalled();
    }
  );

  it('returns 429 when rate limit blocks POST', async () => {
    const rateLimit = await import('@/lib/api/rate-limit');
    (rateLimit.checkRateLimit as unknown as Mock).mockReturnValueOnce({
      allowed: false,
      retryAfterMs: 5000,
    });

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires/change-log', {
      method: 'POST',
      body: JSON.stringify({
        tireSetId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-11-01',
        odometerKm: 15000,
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('returns 500 when creating change log fails', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
    prisma.tireSet.findFirst.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440000',
      vehicleId: 'v1',
      name: 'Winter Tires',
    });
    prisma.tireChangeLog.create.mockRejectedValueOnce(new Error('insert failed'));

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires/change-log', {
      method: 'POST',
      body: JSON.stringify({
        tireSetId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-11-01',
        odometerKm: 15000,
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);

    expect(response.status).toBe(500);
  });
});
