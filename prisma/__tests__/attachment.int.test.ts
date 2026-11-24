// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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
  let databaseUrl: string;
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
    databaseUrl = container.getConnectionUri();
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

  it('preserves existing expense and fill-up attachments when upgrading', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'attachment-upgrade-'));
    const url = new URL(databaseUrl);
    url.searchParams.set('schema', 'attachment_upgrade');
    const upgradeUrl = url.toString();
    const upgradeDb = new PrismaClient({ datasourceUrl: upgradeUrl });
    const env = { ...process.env, DATABASE_URL: upgradeUrl };
    try {
      await cp('prisma/schema.prisma', join(directory, 'schema.prisma'));
      await cp('prisma/migrations', join(directory, 'migrations'), {
        recursive: true,
        // Include the lock file and the complete migration history through the two-parent schema.
        filter: path =>
          !/^\d/.test(basename(path)) ||
          basename(path) <= '20261116113611_add_expense_and_fillup_attachments',
      });
      await execa(
        'pnpm',
        ['exec', 'prisma', 'migrate', 'deploy', '--schema', join(directory, 'schema.prisma')],
        { env }
      );

      const user = await upgradeDb.user.create({
        data: { email: 'upgrade@example.com', username: 'upgrade', passwordHash: '' },
      });
      const car = await upgradeDb.vehicle.create({
        data: { userId: user.id, name: 'Upgrade car' },
        // The pre-upgrade schema lacks fields in the current vehicle model.
        select: { id: true },
      });
      const expense = await upgradeDb.expense.create({
        data: { vehicleId: car.id, category: 'MAINTENANCE', amount: 10 },
      });
      const fillUp = await upgradeDb.fuelFillUp.create({
        data: { vehicleId: car.id, odometerKm: 100, liters: 10, pricePerLiter: 2, totalCost: 20 },
      });
      const existing = [
        { ...metadata(), id: randomUUID(), expenseId: expense.id, fuelFillUpId: null },
        { ...metadata(), id: randomUUID(), expenseId: null, fuelFillUpId: fillUp.id },
      ];
      const timestamp = new Date('2026-11-16T12:00:00Z');
      for (const file of existing) {
        // The old table has no vehicleId column, so seed only columns it knows about.
        await upgradeDb.$executeRaw`
          INSERT INTO "attachment_upgrade"."Attachment"
            ("id", "expenseId", "fuelFillUpId", "filename", "objectKey", "contentType",
             "sizeBytes", "createdAtUtc", "updatedAtUtc")
          VALUES (${file.id}, ${file.expenseId}, ${file.fuelFillUpId}, ${file.filename},
                  ${file.objectKey}, ${file.contentType}, ${file.sizeBytes}, ${timestamp}, ${timestamp})
        `;
      }

      await execa('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env });
      for (const file of existing) {
        await expect(
          upgradeDb.attachment.findUniqueOrThrow({ where: { id: file.id } })
        ).resolves.toEqual({
          ...file,
          vehicleId: null,
          createdAtUtc: timestamp,
          updatedAtUtc: timestamp,
        });
      }
    } finally {
      try {
        await upgradeDb.$disconnect();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  }, 60_000);

  it('persists metadata and UTC timestamps for all three parent types', async () => {
    for (const parent of [{ vehicleId }, { expenseId }, { fuelFillUpId }]) {
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

  it('rejects every combination of multiple parents', async () => {
    for (const parents of [
      { expenseId, fuelFillUpId },
      { vehicleId, expenseId },
      { vehicleId, fuelFillUpId },
      { vehicleId, expenseId, fuelFillUpId },
    ]) {
      await expect(
        db.attachment.create({ data: { ...metadata(), ...parents } })
      ).rejects.toMatchObject({
        message: expect.stringMatching(/23514[\s\S]*Attachment_exactly_one_parent/),
      });
    }
  });

  it('rejects missing parents of all three types', async () => {
    for (const parent of [
      { vehicleId: randomUUID() },
      { expenseId: randomUUID() },
      { fuelFillUpId: randomUUID() },
    ]) {
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
    const direct = await db.attachment.create({ data: { ...metadata(), vehicleId } });
    await db.expense.delete({ where: { id: expenseId } });
    expect(await db.attachment.findMany()).toEqual(expect.arrayContaining([retained, direct]));
    expect(await db.attachment.count()).toBe(2);
  });

  it('deletes only the fill-up attachment metadata when its fill-up is deleted', async () => {
    const retained = await db.attachment.create({ data: { ...metadata(), expenseId } });
    await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    await db.fuelFillUp.delete({ where: { id: fuelFillUpId } });
    expect(await db.attachment.findMany()).toEqual([retained]);
  });

  it('cascades vehicle deletion to direct and nested attachment metadata', async () => {
    await db.attachment.create({ data: { ...metadata(), vehicleId } });
    await db.attachment.create({ data: { ...metadata(), expenseId } });
    await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    await db.vehicle.delete({ where: { id: vehicleId } });
    expect(await db.attachment.count()).toBe(0);
  });
});
