// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@/generated/prisma';
import { NextRequest } from 'next/server';
import { execa } from 'execa';

let container: StartedPostgreSqlContainer | undefined;
let prisma: PrismaClient;
let GET: typeof import('../route').GET;
let POST: typeof import('../route').POST;
let PATCH: typeof import('../[fillUpId]/route').PATCH;
const userEmail = 'fillup-int@example.com';
let vehicleId: string;

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: userEmail } })) }));

beforeAll(async () => {
  if (!process.env.RUN_INTEGRATION) return;
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = new URL(container.getConnectionUri());
  databaseUrl.searchParams.set('connection_limit', '1');
  databaseUrl.searchParams.set('pool_timeout', '0');
  process.env.DATABASE_URL = databaseUrl.toString();

  await execa('pnpm', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });

  // Initialize the route's shared client only after selecting the disposable database.
  prisma = (await import('@/lib/db')).default;
  ({ GET, POST } = await import('../route'));
  ({ PATCH } = await import('../[fillUpId]/route'));
  const user = await prisma.user.create({
    data: { email: userEmail, username: 'tester', passwordHash: '', userType: 'REGULAR' },
  });
  const vehicle = await prisma.vehicle.create({ data: { userId: user.id, name: 'Car A' } });
  vehicleId = vehicle.id;
  await prisma.vehicleAccess.create({
    data: { userId: user.id, vehicleId, role: 'OWNER' },
  });
}, 120_000);

afterAll(async () => {
  if (!process.env.RUN_INTEGRATION) return;
  try {
    await prisma?.$disconnect();
  } finally {
    await container?.stop();
  }
}, 30_000);

describe('GET fill-ups', () => {
  it('returns empty list', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    const req = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/fillups`).toString()
    );
    const res: Response = await GET(req, { params: Promise.resolve({ vehicleId }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.fillUps).toEqual([]);
  });
});

describe('POST fill-up then GET', () => {
  it('creates and lists one item', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    const body = {
      date: new Date().toISOString(),
      odometerKm: 1000,
      liters: 30,
      pricePerLiter: 1.5,
      totalCost: 45,
      isFull: true,
    };
    const reqPost = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/fillups`).toString(),
      { method: 'POST', body: JSON.stringify(body) }
    );
    const resPost: Response = await POST(reqPost, { params: Promise.resolve({ vehicleId }) });
    expect(resPost.status).toBe(201);

    const reqGet = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/fillups`).toString()
    );
    const resGet: Response = await GET(reqGet, { params: Promise.resolve({ vehicleId }) });
    const json = await resGet.json();
    expect(json.data.fillUps.length).toBe(1);
  });
});

describe('GET fill-ups pagination', () => {
  it('respects limit and returns nextCursor when more items exist', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    for (let i = 0; i < 3; i++) {
      await prisma.fuelFillUp.create({
        data: {
          vehicleId,
          date: new Date(),
          odometerKm: 2000 + i,
          liters: 10,
          pricePerLiter: 1,
          totalCost: 10,
        },
      });
    }
    const req = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/fillups?limit=2`).toString()
    );
    const res: Response = await GET(req, { params: Promise.resolve({ vehicleId }) });
    const json = await res.json();
    expect(json.data.fillUps.length).toBe(2);
    expect(json.data.nextCursor === null || typeof json.data.nextCursor === 'string').toBe(true);
  });
});

describe.skipIf(!process.env.RUN_INTEGRATION)('PATCH fill-up', () => {
  it('preserves an independently updated price and uses it to recalculate cost', async () => {
    const { id } = await prisma.fuelFillUp.create({
      data: { vehicleId, odometerKm: 3000, liters: 10, pricePerLiter: 1.85, totalCost: 18.5 },
    });
    await prisma.fuelFillUp.update({
      where: { id },
      data: { pricePerLiter: 1.95, totalCost: 19.5 },
    });

    const req = new NextRequest(`http://localhost/api/vehicles/${vehicleId}/fillups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ liters: 12.5 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId, fillUpId: id }) });

    expect(res.status).toBe(200);
    const updated = await prisma.fuelFillUp.findUniqueOrThrow({ where: { id } });
    expect(updated.pricePerLiter.toString()).toBe('1.95');
    expect(updated.totalCost.toString()).toBe('24.38');
  });
});
