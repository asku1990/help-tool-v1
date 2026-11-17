// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execa } from 'execa';
import { PrismaClient } from '@/generated/prisma';

type TestDatabase = {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
};

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('Attachment persistence', () => {
  let container: TestDatabase | undefined;
  let prisma: PrismaClient | undefined;
  let db: PrismaClient;
  let expenseId: string;
  let fuelFillUpId: string;
  let vehicleId: string;

  const metadata = () => ({
    filename: 'receipt.pdf',
    objectKey: randomUUID(),
    contentType: 'application/pdf',
    sizeBytes: 128,
  });

  beforeAll(async () => {
    container = (await new PostgreSqlContainer('postgres:16-alpine').start()) as TestDatabase;
    const databaseUrl = container.getConnectionUri();
    // Only the disposable container URL reaches the migration process.
    await execa('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    db = prisma;
  }, 120_000);

  beforeEach(async () => {
    await db.user.deleteMany();
    const user = await db.user.create({
      data: { email: 'attachments@example.com', username: 'attachments', passwordHash: '' },
    });
    const vehicle = await db.vehicle.create({ data: { userId: user.id, name: 'Test car' } });
    vehicleId = vehicle.id;
    const expense = await db.expense.create({
      data: { vehicleId, category: 'MAINTENANCE', amount: 10 },
    });
    const fillUp = await db.fuelFillUp.create({
      data: { vehicleId, odometerKm: 100, liters: 10, pricePerLiter: 2, totalCost: 20 },
    });
    expenseId = expense.id;
    fuelFillUpId = fillUp.id;
  });

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      await container?.stop();
    }
  }, 30_000);

  it('persists metadata and UTC timestamps for either parent type', async () => {
    for (const parent of [{ expenseId }, { fuelFillUpId }]) {
      const data = { ...metadata(), ...parent };
      const attachment = await db.attachment.create({ data });
      const saved = await db.attachment.findUniqueOrThrow({ where: { id: attachment.id } });
      expect(saved).toMatchObject(data);
      expect(saved.createdAtUtc).toBeInstanceOf(Date);
      expect(saved.updatedAtUtc).toBeInstanceOf(Date);
    }
  });

  it('rejects metadata without a parent', async () => {
    // Prisma 6 exposes PostgreSQL CHECK violations through an unknown request error.
    await expect(db.attachment.create({ data: metadata() })).rejects.toMatchObject({
      message: expect.stringMatching(/23514[\s\S]*Attachment_exactly_one_parent/),
    });
  });

  it('rejects metadata referencing both parent types', async () => {
    await expect(
      db.attachment.create({ data: { ...metadata(), expenseId, fuelFillUpId } })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/23514[\s\S]*Attachment_exactly_one_parent/),
    });
  });

  it('rejects missing parents of either type', async () => {
    for (const parent of [{ expenseId: randomUUID() }, { fuelFillUpId: randomUUID() }]) {
      await expect(
        db.attachment.create({ data: { ...metadata(), ...parent } })
      ).rejects.toMatchObject({ code: 'P2003' });
    }
  });

  it('rejects duplicate object keys across parent types', async () => {
    const data = metadata();
    await db.attachment.create({ data: { ...data, expenseId } });
    await expect(db.attachment.create({ data: { ...data, fuelFillUpId } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('deletes only the expense attachment metadata when its expense is deleted', async () => {
    await db.attachment.create({ data: { ...metadata(), expenseId } });
    const retained = await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    await db.expense.delete({ where: { id: expenseId } });
    expect(await db.attachment.findMany()).toEqual([retained]);
  });

  it('deletes only the fill-up attachment metadata when its fill-up is deleted', async () => {
    const retained = await db.attachment.create({ data: { ...metadata(), expenseId } });
    await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    await db.fuelFillUp.delete({ where: { id: fuelFillUpId } });
    expect(await db.attachment.findMany()).toEqual([retained]);
  });

  it('cascades vehicle deletion through both parents to attachment metadata', async () => {
    await db.attachment.create({ data: { ...metadata(), expenseId } });
    await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    await db.vehicle.delete({ where: { id: vehicleId } });
    expect(await db.attachment.count()).toBe(0);
  });
});
