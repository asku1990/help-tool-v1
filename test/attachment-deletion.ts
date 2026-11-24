import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execa } from 'execa';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, expect } from 'vitest';
import { PrismaClient } from '@/generated/prisma';

async function createVehicleRecords(db: PrismaClient) {
  const username = randomUUID();
  const { id: userId } = await db.user.create({
    data: { email: `${username}@example.com`, username, passwordHash: '' },
  });
  const { id: vehicleId } = await db.vehicle.create({ data: { userId, name: 'Test car' } });
  await db.vehicleAccess.create({ data: { userId, vehicleId, role: 'OWNER' } });
  const { id: expenseId } = await db.expense.create({
    data: { vehicleId, category: 'MAINTENANCE', amount: 10 },
  });
  const { id: fuelFillUpId } = await db.fuelFillUp.create({
    data: { vehicleId, odometerKm: 100, liters: 10, pricePerLiter: 2, totalCost: 20 },
  });
  return { userId, vehicleId, expenseId, fuelFillUpId };
}

export function setupAttachmentDeletionFixture() {
  let container: StartedPostgreSqlContainer | undefined;
  let db: PrismaClient;
  let records: Awaited<ReturnType<typeof createVehicleRecords>>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const databaseUrl = container.getConnectionUri();
    await execa('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 120_000);

  beforeEach(async () => {
    records = await createVehicleRecords(db);
  });

  afterAll(async () => {
    try {
      await db?.$disconnect();
    } finally {
      await container?.stop();
    }
  }, 30_000);

  return {
    get db() {
      return db;
    },
    get records() {
      return records;
    },
  };
}

export function attachmentMetadata() {
  return {
    filename: 'receipt.pdf',
    objectKey: randomUUID(),
    contentType: 'application/pdf',
    sizeBytes: 128,
  };
}

export function vehicleDeleteRequest(vehicleId: string, path = '') {
  return new NextRequest(`http://localhost/api/vehicles/${vehicleId}${path}`, {
    method: 'DELETE',
  });
}

export async function expectAttachmentConflict(response: Response, message: string) {
  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    data: null,
    error: { code: 'ATTACHMENTS_EXIST', message },
  });
}
