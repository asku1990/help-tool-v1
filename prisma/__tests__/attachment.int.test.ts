// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execa } from 'execa';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { DELETE as deleteVehicle } from '@/app/api/vehicles/[vehicleId]/route';
import { DELETE as clearVehicle } from '@/app/api/vehicles/[vehicleId]/clear/route';
import { DELETE as deleteExpense } from '@/app/api/vehicles/[vehicleId]/expenses/[expenseId]/route';
import { DELETE as deleteFillUp } from '@/app/api/vehicles/[vehicleId]/fillups/[fillUpId]/route';

let db: PrismaClient;
let userId: string;

vi.mock('@/lib/db', () => ({
  get default() {
    return db;
  },
}));
vi.mock('@/auth', () => ({
  auth: async () => ({ user: { id: userId } }),
}));

type TestDatabase = {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
};

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('Attachment persistence', () => {
  let container: TestDatabase | undefined;
  let prisma: PrismaClient | undefined;
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
    await db.attachment.deleteMany();
    await db.user.deleteMany();
    const user = await db.user.create({
      data: { email: 'attachments@example.com', username: 'attachments', passwordHash: '' },
    });
    userId = user.id;
    const vehicle = await db.vehicle.create({ data: { userId: user.id, name: 'Test car' } });
    vehicleId = vehicle.id;
    await db.vehicleAccess.create({ data: { userId, vehicleId, role: 'OWNER' } });
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

  function deleteRequest(path = '') {
    return new NextRequest(`http://localhost/api/vehicles/${vehicleId}${path}`, {
      method: 'DELETE',
    });
  }

  async function expectAttachmentConflict(response: Response, message: string) {
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: { code: 'ATTACHMENTS_EXIST', message },
    });
  }

  it('blocks expense deletion until its attachment is removed', async () => {
    const { id } = await db.attachment.create({ data: { ...metadata(), expenseId } });
    const remove = () =>
      deleteExpense(deleteRequest(`/expenses/${expenseId}`), {
        params: Promise.resolve({ vehicleId, expenseId }),
      });
    await expectAttachmentConflict(
      await remove(),
      'Remove the attached files before deleting this expense.'
    );
    await expect(db.attachment.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
      expenseId,
    });
    await db.attachment.delete({ where: { id } });
    expect((await remove()).status).toBe(200);
    expect(await db.expense.count({ where: { id: expenseId } })).toBe(0);
  });

  it('blocks fill-up deletion until its attachment is removed', async () => {
    const { id } = await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    const remove = () =>
      deleteFillUp(deleteRequest(`/fillups/${fuelFillUpId}`), {
        params: Promise.resolve({ vehicleId, fillUpId: fuelFillUpId }),
      });
    await expectAttachmentConflict(
      await remove(),
      'Remove the attached files before deleting this fill-up.'
    );
    await expect(db.attachment.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
      fuelFillUpId,
    });
    await db.attachment.delete({ where: { id } });
    expect((await remove()).status).toBe(200);
    expect(await db.fuelFillUp.count({ where: { id: fuelFillUpId } })).toBe(0);
  });

  it.each(['vehicleId', 'expenseId', 'fuelFillUpId'] as const)(
    'blocks vehicle deletion when its only attachment belongs to %s',
    async parent => {
      const parents = { vehicleId, expenseId, fuelFillUpId };
      const { id } = await db.attachment.create({
        data: { ...metadata(), [parent]: parents[parent] },
      });
      const remove = () =>
        deleteVehicle(deleteRequest(), { params: Promise.resolve({ vehicleId }) });
      await expectAttachmentConflict(
        await remove(),
        'Remove the attached files from this vehicle and its expenses and fill-ups before deleting it.'
      );
      await expect(db.attachment.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
        [parent]: parents[parent],
      });
      expect(await db.expense.count({ where: { vehicleId } })).toBe(1);
      expect(await db.fuelFillUp.count({ where: { vehicleId } })).toBe(1);
      await db.attachment.delete({ where: { id } });
      expect((await remove()).status).toBe(200);
      expect(await db.vehicle.count({ where: { id: vehicleId } })).toBe(0);
      expect(await db.expense.count({ where: { vehicleId } })).toBe(0);
      expect(await db.fuelFillUp.count({ where: { vehicleId } })).toBe(0);
    }
  );

  it('rolls back clearing vehicle data when a fill-up has a file but allows direct vehicle files', async () => {
    const direct = await db.attachment.create({ data: { ...metadata(), vehicleId } });
    const nested = await db.attachment.create({ data: { ...metadata(), fuelFillUpId } });
    const tireSet = await db.tireSet.create({
      data: { vehicleId, name: 'Winter', type: 'WINTER' },
    });
    const clear = () =>
      clearVehicle(deleteRequest('/clear'), { params: Promise.resolve({ vehicleId }) });
    await expectAttachmentConflict(
      await clear(),
      'Remove the attached files from this vehicle’s expenses and fill-ups before clearing its data.'
    );
    expect(await db.expense.count({ where: { vehicleId } })).toBe(1);
    expect(await db.fuelFillUp.count({ where: { vehicleId } })).toBe(1);
    expect(await db.tireSet.count({ where: { id: tireSet.id } })).toBe(1);
    expect(await db.attachment.count()).toBe(2);

    await db.attachment.delete({ where: { id: nested.id } });
    expect((await clear()).status).toBe(200);
    expect(await db.expense.count({ where: { vehicleId } })).toBe(0);
    expect(await db.fuelFillUp.count({ where: { vehicleId } })).toBe(0);
    expect(await db.tireSet.count({ where: { id: tireSet.id } })).toBe(0);
    expect(await db.attachment.findMany()).toEqual([direct]);
  });
});
