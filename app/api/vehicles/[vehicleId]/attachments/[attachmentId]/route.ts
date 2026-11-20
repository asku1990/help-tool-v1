import { deleteAttachment } from '@/lib/attachments/delete';
import { renameAttachment } from '@/lib/attachments/rename';

export const runtime = 'nodejs';

type Context = { params: Promise<{ vehicleId: string; attachmentId: string }> };

export async function DELETE(req: Request, context: Context) {
  const { vehicleId, attachmentId } = await context.params;
  return deleteAttachment(req, vehicleId, { type: 'vehicle' }, attachmentId);
}

export async function PATCH(req: Request, context: Context) {
  const { vehicleId, attachmentId } = await context.params;
  return renameAttachment(req, vehicleId, { type: 'vehicle' }, attachmentId);
}
