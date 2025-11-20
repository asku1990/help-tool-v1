// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock modules before importing the route
vi.mock('@/lib/db', () => ({
  default: {
    vehicle: { findFirst: vi.fn() },
    tireSet: { findMany: vi.fn(), create: vi.fn() },
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
  vehicle: { findFirst: Mock };
  tireSet: { findMany: Mock; create: Mock };
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
  type: 'SUMMER' | 'WINTER' | 'ALL_SEASON';
  status: 'ACTIVE' | 'STORED' | 'RETIRED';
  purchaseDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  changeLogs: Array<{
    id: string;
    date: Date;
    odometerKm: number;
  }>;
};

describe('GET /api/vehicles/[vehicleId]/tires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 if vehicle not found', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns tire sets for the vehicle', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);

    const mockTireSets: MockTireSet[] = [
      {
        id: 't1',
        vehicleId: 'v1',
        name: 'Summer Tires',
        type: 'SUMMER',
        status: 'ACTIVE',
        purchaseDate: new Date('2024-01-01'),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        changeLogs: [
          {
            id: 'cl1',
            date: new Date('2024-06-01'),
            odometerKm: 10000,
          },
        ],
      },
    ];

    prisma.tireSet.findMany.mockResolvedValueOnce(mockTireSets);

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tireSets).toHaveLength(1);
    expect(data.data.tireSets[0].name).toBe('Summer Tires');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/api/rate-limit');
    (checkRateLimit as unknown as Mock).mockReturnValueOnce({ allowed: false, retryAfterMs: 1000 });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(data.error.message).toContain('Rate limit exceeded');
  });

  it('returns 500 when the database query fails', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
    prisma.tireSet.findMany.mockRejectedValueOnce(new Error('DB offline'));

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/vehicles/v1/tires');
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await GET(req, context);

    expect(response.status).toBe(500);
  });
});

describe('POST /api/vehicles/[vehicleId]/tires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if not authenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires', {
      method: 'POST',
      body: JSON.stringify({ name: 'Winter Tires', type: 'WINTER' }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 if validation fails', async () => {
    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires', {
      method: 'POST',
      body: JSON.stringify({ name: '', type: 'INVALID' }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a tire set with STORED status by default', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
    prisma.tireSet.create.mockResolvedValueOnce({ id: 't1' });

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Winter Tires',
        type: 'WINTER',
        purchaseDate: '2024-01-01',
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe('t1');
    expect(prisma.tireSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'STORED',
          name: 'Winter Tires',
          type: 'WINTER',
        }),
      })
    );
  });

  it('returns 500 when tire creation throws an error', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    const vehicle: MockVehicle = {
      id: 'v1',
      userId: 'u1',
      name: 'Test Car',
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce(vehicle);
    prisma.tireSet.create.mockRejectedValueOnce(new Error('write failed'));

    const { POST } = await import('../route');
    const base = new Request('http://localhost/api/vehicles/v1/tires', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Winter Tires',
        type: 'WINTER',
        purchaseDate: '2024-01-01',
      }),
    });
    const req = new NextRequest(base);
    const context = { params: Promise.resolve({ vehicleId: 'v1' }) };

    const response = await POST(req, context);

    expect(response.status).toBe(500);
  });
});
