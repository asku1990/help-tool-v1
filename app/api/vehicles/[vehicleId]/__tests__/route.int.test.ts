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

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('DELETE vehicle', () => {
  it.each(['vehicleId', 'expenseId', 'fuelFillUpId'] as const)(
    'blocks deletion when its only attachment belongs to %s',
    async parent => {
      const { db, records } = fixture;
      const { vehicleId } = records;
      const { id } = await db.attachment.create({
        data: { ...attachmentMetadata(), [parent]: records[parent] },
      });
      const remove = () =>
        DELETE(vehicleDeleteRequest(vehicleId), { params: Promise.resolve({ vehicleId }) });
      await expectAttachmentConflict(
        await remove(),
        'Remove the attached files from this vehicle and its expenses and fill-ups before deleting it.'
      );
      await expect(db.attachment.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
        [parent]: records[parent],
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
});
