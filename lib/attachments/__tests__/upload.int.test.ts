// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execa } from 'execa';
import { PrismaClient } from '@/generated/prisma';
import { listAttachments, uploadAttachment } from '../upload';
import { attachmentParentScope, type AttachmentParent } from '../parent';
import type { AttachmentStorage } from '../storage';

type TestDatabase = { getConnectionUri(): string; stop(): Promise<unknown> };
const file = {
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  bytes: new TextEncoder().encode('%PDF-1.4\n%%EOF'),
};

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('Attachment upload concurrency', () => {
  let container: TestDatabase | undefined;
  let prisma: PrismaClient | undefined;
  let db: PrismaClient;
  let expenseId: string;
  let fuelFillUpId: string;
  let vehicleId: string;

  beforeAll(async () => {
    container = (await new PostgreSqlContainer('postgres:16-alpine').start()) as TestDatabase;
    // Multiple pool connections are essential: a one-connection pool would hide races.
    const url = new URL(container.getConnectionUri());
    url.searchParams.set('connection_limit', '10');
    const databaseUrl = url.toString();
    await execa('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    db = prisma;
  }, 120_000);

  beforeEach(async () => {
    await db.user.deleteMany();
    const user = await db.user.create({
      data: { email: 'uploads@example.com', username: 'uploads', passwordHash: '' },
    });
    const vehicle = await db.vehicle.create({ data: { userId: user.id, name: 'Upload test car' } });
    vehicleId = vehicle.id;
    expenseId = (await db.expense.create({ data: { vehicleId, category: 'OTHER', amount: 10 } }))
      .id;
    fuelFillUpId = (
      await db.fuelFillUp.create({
        data: { vehicleId, odometerKm: 100, liters: 10, pricePerLiter: 2, totalCost: 20 },
      })
    ).id;
  });

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      await container?.stop();
    }
  }, 30_000);

  function parent(type: AttachmentParent['type']): AttachmentParent {
    if (type === 'vehicle') return { type };
    return { type, id: type === 'expense' ? expenseId : fuelFillUpId };
  }

  function storage() {
    return {
      put: vi.fn<AttachmentStorage['put']>().mockResolvedValue(undefined),
      delete: vi.fn<AttachmentStorage['delete']>().mockResolvedValue(undefined),
    };
  }

  it.each(['vehicle', 'expense', 'fillup'] as const)(
    'allows only one of two concurrent uploads into the last %s slot',
    async type => {
      const target = parent(type);
      const where =
        type === 'vehicle' ? { vehicleId } : type === 'expense' ? { expenseId } : { fuelFillUpId };
      await db.attachment.createMany({
        data: Array.from({ length: 9 }, () => ({
          ...where,
          filename: file.filename,
          contentType: file.contentType,
          sizeBytes: file.bytes.byteLength,
          objectKey: randomUUID(),
        })),
      });
      const store = storage();
      let releasePut: () => void = () => {};
      const putGate = new Promise<void>(resolve => {
        releasePut = resolve;
      });
      let started: () => void = () => {};
      const putStarted = new Promise<void>(resolve => {
        started = resolve;
      });
      store.put.mockImplementationOnce(async () => {
        started();
        await putGate;
      });
      const first = uploadAttachment(db, store, vehicleId, target, file);
      await putStarted;
      const second = uploadAttachment(db, store, vehicleId, target, file);
      // Confirm the second database session really waits for the parent's row lock.
      // This distinguishes database serialization from accidental sequential execution.
      let contentionError: unknown;
      try {
        await expect
          .poll(
            async () => {
              const rows = await db.$queryRaw<{ count: bigint }[]>`
            SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database()
              AND wait_event_type = 'Lock'
              AND query LIKE '%FOR UPDATE%'
          `;
              return Number(rows[0]?.count ?? 0);
            },
            { timeout: 3000 }
          )
          .toBeGreaterThan(0);
      } catch (error) {
        contentionError = error;
      } finally {
        releasePut();
      }
      const results = await Promise.allSettled([first, second]);
      if (contentionError) throw contentionError;
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(result => result.status === 'rejected');
      expect(rejected).toMatchObject({ reason: { code: 'ATTACHMENT_LIMIT', status: 409 } });
      expect(await db.attachment.count({ where })).toBe(10);
      expect(store.put).toHaveBeenCalledOnce();
    },
    15_000
  );

  it('lists only direct vehicle attachments and excludes nested IDs from the shared item scope', async () => {
    const store = storage();
    const direct = await uploadAttachment(db, store, vehicleId, parent('vehicle'), file);
    const expense = await uploadAttachment(db, store, vehicleId, parent('expense'), file);
    const fillup = await uploadAttachment(db, store, vehicleId, parent('fillup'), file);

    await expect(listAttachments(db, vehicleId, parent('vehicle'))).resolves.toMatchObject({
      attachments: [direct],
      maxAttachments: 10,
      remainingCapacity: 9,
    });
    for (const { id } of [expense, fillup]) {
      await expect(
        db.attachment.findFirst({
          where: { id, ...attachmentParentScope(vehicleId, parent('vehicle')) },
        })
      ).resolves.toBeNull();
    }
  });

  it.each(['expense', 'fillup'] as const)(
    'does not consume a %s slot when storage fails',
    async type => {
      const store = storage();
      store.put.mockRejectedValueOnce(new Error('R2 unavailable'));
      await expect(uploadAttachment(db, store, vehicleId, parent(type), file)).rejects.toThrow(
        'R2 unavailable'
      );
      expect(await db.attachment.count()).toBe(0);
      await uploadAttachment(db, store, vehicleId, parent(type), file);
      expect(await db.attachment.count()).toBe(1);
      expect(store.delete).toHaveBeenCalledOnce();
    }
  );

  it('rolls back metadata and attempts object deletion on a database failure', async () => {
    const store = storage();
    const invalidMetadata = { ...file, filename: null } as unknown as typeof file;
    await expect(
      uploadAttachment(db, store, vehicleId, parent('expense'), invalidMetadata)
    ).rejects.toThrow();
    expect(store.put).toHaveBeenCalledOnce();
    expect(store.delete).toHaveBeenCalledWith(store.put.mock.calls[0]?.[0]);
    expect(await db.attachment.count()).toBe(0);
  });

  it.each(['vehicle', 'expense', 'fillup'] as const)(
    'cannot upload to a missing or unauthorized %s parent',
    async type => {
      const store = storage();
      await expect(
        uploadAttachment(db, store, randomUUID(), parent(type), file)
      ).rejects.toMatchObject({ status: 404 });
      expect(store.put).not.toHaveBeenCalled();
      expect(await db.attachment.count()).toBe(0);
    }
  );
});
