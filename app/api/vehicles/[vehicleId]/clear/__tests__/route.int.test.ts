// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  attachmentMetadata,
  expectAttachmentConflict,
  setupAttachmentDeletionFixture,
  vehicleDeleteRequest,
} from '@/test/attachment-deletion';
import { DELETE } from '../route';

const fixture = setupAttachmentDeletionFixture();

vi.mock('@/lib/db', () => ({
  get default() {
    return fixture.db;
  },
}));
vi.mock('@/auth', () => ({
  auth: async () => ({ user: { id: fixture.records.userId } }),
}));

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('DELETE vehicle data', () => {
  it.each(['expenseId', 'fuelFillUpId'] as const)(
    'rolls back clearing when a file belongs to %s, but allows direct vehicle files',
    async parent => {
      const { db, records } = fixture;
      const { vehicleId } = records;
      const direct = await db.attachment.create({ data: { ...attachmentMetadata(), vehicleId } });
      const nested = await db.attachment.create({
        data: { ...attachmentMetadata(), [parent]: records[parent] },
      });
      const tireSet = await db.tireSet.create({
        data: { vehicleId, name: 'Winter', type: 'WINTER' },
      });
      const clear = () =>
        DELETE(vehicleDeleteRequest(vehicleId, '/clear'), {
          params: Promise.resolve({ vehicleId }),
        });

      await expectAttachmentConflict(
        await clear(),
        'Remove the attached files from this vehicle’s expenses and fill-ups before clearing its data.'
      );
      expect(await db.expense.count({ where: { vehicleId } })).toBe(1);
      expect(await db.fuelFillUp.count({ where: { vehicleId } })).toBe(1);
      expect(await db.tireSet.count({ where: { id: tireSet.id } })).toBe(1);
      expect(await db.attachment.count({ where: { id: { in: [direct.id, nested.id] } } })).toBe(2);

      await db.attachment.delete({ where: { id: nested.id } });
      expect((await clear()).status).toBe(200);
      expect(await db.expense.count({ where: { vehicleId } })).toBe(0);
      expect(await db.fuelFillUp.count({ where: { vehicleId } })).toBe(0);
      expect(await db.tireSet.count({ where: { id: tireSet.id } })).toBe(0);
      expect(await db.attachment.findMany({ where: { vehicleId } })).toEqual([direct]);
    }
  );
});
