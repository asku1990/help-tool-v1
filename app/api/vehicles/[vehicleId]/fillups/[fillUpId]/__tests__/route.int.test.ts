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

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('DELETE fill-up', () => {
  it('blocks deletion until the attachment is removed', async () => {
    const { db, records } = fixture;
    const { vehicleId, fuelFillUpId } = records;
    const { id } = await db.attachment.create({
      data: { ...attachmentMetadata(), fuelFillUpId },
    });
    const remove = () =>
      DELETE(vehicleDeleteRequest(vehicleId, `/fillups/${fuelFillUpId}`), {
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
});
