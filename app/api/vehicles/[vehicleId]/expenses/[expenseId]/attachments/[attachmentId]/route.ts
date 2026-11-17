import { deleteAttachment } from '@/lib/attachments/delete';
import { renameAttachment } from '@/lib/attachments/rename';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ vehicleId: string; expenseId: string; attachmentId: string }>;
};

export async function DELETE(req: Request, context: Context) {
  const { vehicleId, expenseId, attachmentId } = await context.params;
  return deleteAttachment(req, vehicleId, { type: 'expense', id: expenseId }, attachmentId);
}

export async function PATCH(req: Request, context: Context) {
  const { vehicleId, expenseId, attachmentId } = await context.params;
  return renameAttachment(req, vehicleId, { type: 'expense', id: expenseId }, attachmentId);
}
