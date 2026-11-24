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

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('DELETE expense', () => {
  it('blocks deletion until the attachment is removed', async () => {
    const { db, records } = fixture;
    const { vehicleId, expenseId } = records;
    const { id } = await db.attachment.create({ data: { ...attachmentMetadata(), expenseId } });
    const remove = () =>
      DELETE(vehicleDeleteRequest(vehicleId, `/expenses/${expenseId}`), {
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
});
