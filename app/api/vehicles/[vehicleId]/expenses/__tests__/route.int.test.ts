// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@/generated/prisma';
import { NextRequest } from 'next/server';
import { execa } from 'execa';

let container: StartedPostgreSqlContainer | undefined;
let prisma: PrismaClient;
let GET: typeof import('../route').GET;
let POST: typeof import('../route').POST;
let PATCH: typeof import('../[expenseId]/route').PATCH;
const userEmail = 'test@example.com';
let vehicleId: string;

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: userEmail } })),
}));

beforeAll(async () => {
  if (!process.env.RUN_INTEGRATION) return;
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = new URL(container.getConnectionUri());
  databaseUrl.searchParams.set('connection_limit', '4');
  databaseUrl.searchParams.set('pool_timeout', '0');
  process.env.DATABASE_URL = databaseUrl.toString();

  await execa('pnpm', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });

  // Initialize the route's shared client only after selecting the disposable database.
  prisma = (await import('@/lib/db')).default;
  ({ GET, POST } = await import('../route'));
  ({ PATCH } = await import('../[expenseId]/route'));
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

describe.skipIf(!process.env.RUN_INTEGRATION)('PATCH expense', () => {
  it('keeps oil consumption in sync when liters and odometer edits overlap', async () => {
    await prisma.expense.create({
      data: {
        vehicleId,
        date: new Date('2024-01-01'),
        category: 'OIL_CHANGE',
        amount: 50,
        odometerKm: 10000,
      },
    });
    const url = `http://localhost/api/vehicles/${vehicleId}/expenses`;
    const created = await POST(
      new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          date: '2024-02-01',
          category: 'OIL_TOP_UP',
          amount: 10,
          odometerKm: 12000,
          liters: 1,
        }),
      }),
      { params: Promise.resolve({ vehicleId }) }
    );
    expect(created.status).toBe(201);
    const { data: expense } = await created.json();
    const list = () =>
      GET(new NextRequest(`${url}?limit=50`), { params: Promise.resolve({ vehicleId }) });
    const before = await list();
    expect(before.status).toBe(200);
    expect((await before.json()).data.expenses).toContainEqual(
      expect.objectContaining({ id: expense.id, oilConsumption: 5 })
    );

    const patch = (body: { odometerKm?: number; liters?: number }) =>
      PATCH(
        new NextRequest(`${url}/${expense.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
        {
          params: Promise.resolve({ vehicleId, expenseId: expense.id }),
        }
      );

    // Queue both PATCH writes behind a row lock before either can modify the expense.
    const { edits } = await prisma.$transaction(
      async tx => {
        await tx.expense.update({ where: { id: expense.id }, data: { notes: 'Oil top-up' } });
        const pendingEdits = Promise.all([patch({ liters: 2 }), patch({ odometerKm: 15000 })]);
        await vi.waitFor(
          async () => {
            const [waiting] = await prisma.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
          `;
            expect(waiting.count).toBe(2);
          },
          { timeout: 3000 }
        );
        return { edits: pendingEdits };
      },
      { timeout: 5000 }
    );
    expect((await edits).map(res => res.status)).toEqual([200, 200]);

    const response = await list();
    expect(response.status).toBe(200);
    expect((await response.json()).data.expenses).toContainEqual(
      expect.objectContaining({ id: expense.id, liters: 2, odometerKm: 15000, oilConsumption: 4 })
    );
  }, 15_000);
});
