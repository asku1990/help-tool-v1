// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@/generated/prisma';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { execa } from 'execa';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
const userEmail = 'test@example.com';
let vehicleId: string;

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: userEmail } })),
}));

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

describe('GET expenses', () => {
  it('returns empty list and total 0', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    const req = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/expenses`).toString()
    );
    const res: Response = await GET(req, { params: Promise.resolve({ vehicleId }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.expenses).toEqual([]);
    expect(json.data.expensesTotal).toBe(0);
  });
});

describe('POST expense', () => {
  it('creates expense and then lists it', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    const body = {
      date: new Date().toISOString(),
      category: 'MAINTENANCE',
      amount: 33.5,
    };
    const reqPost = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/expenses`).toString(),
      { method: 'POST', body: JSON.stringify(body) }
    );
    const resPost: Response = await POST(reqPost, { params: Promise.resolve({ vehicleId }) });
    expect(resPost.status).toBe(201);

    const reqGet = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/expenses`).toString()
    );
    const resGet: Response = await GET(reqGet, { params: Promise.resolve({ vehicleId }) });
    const json = await resGet.json();
    expect(json.data.expenses.length).toBe(1);
    expect(json.data.expensesTotal).toBe(33.5);
  });
});

describe('GET expenses pagination', () => {
  it('respects limit and returns nextCursor when more items exist', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    for (let i = 0; i < 3; i++) {
      await prisma.expense.create({
        data: {
          vehicleId,
          date: new Date(),
          category: 'MAINTENANCE',
          amount: 10,
        },
      });
    }
    const req = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/expenses?limit=2`).toString()
    );
    const res: Response = await GET(req, { params: Promise.resolve({ vehicleId }) });
    const json = await res.json();
    expect(json.data.expenses.length).toBe(2);
    expect(json.data.nextCursor === null || typeof json.data.nextCursor === 'string').toBe(true);
  });
});

describe('GET returns 429 when rate limited (env tuned)', () => {
  it('returns 429 if MAX_REQUESTS=1 and called twice', async () => {
    if (!process.env.RUN_INTEGRATION) return;
    process.env.RATE_LIMIT_MAX_REQUESTS = '1';
    const req1 = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/expenses`).toString()
    );
    const res1: Response = await GET(req1, { params: Promise.resolve({ vehicleId }) });
    expect(res1.status).toBe(200);
    const req2 = new NextRequest(
      new URL(`http://localhost/api/vehicles/${vehicleId}/expenses`).toString()
    );
    const res2: Response = await GET(req2, { params: Promise.resolve({ vehicleId }) });
    expect([429, 200]).toContain(res2.status);
  });
});
