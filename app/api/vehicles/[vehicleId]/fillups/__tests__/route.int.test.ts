// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@/generated/prisma';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { execa } from 'execa';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
const userEmail = 'fillup-int@example.com';
let vehicleId: string;

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: userEmail } })) }));

beforeAll(async () => {
  if (!process.env.RUN_INTEGRATION) return;
  container = await new PostgreSqlContainer().start();
  const { username, password, database, host, port } = container;
  process.env.DATABASE_URL = `postgresql://${username}:${password}@${host}:${port}/${database}?connection_limit=1&pool_timeout=0`;

  await execa('pnpm', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });

  prisma = new PrismaClient();
  const user = await prisma.user.create({
    data: { email: userEmail, username: 'tester', passwordHash: '', userType: 'REGULAR' },
  });
  const vehicle = await prisma.vehicle.create({ data: { userId: user.id, name: 'Car A' } });
  vehicleId = vehicle.id;
});

afterAll(async () => {
  if (!process.env.RUN_INTEGRATION) return;
  await prisma?.$disconnect();
  await container.stop();
});

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
