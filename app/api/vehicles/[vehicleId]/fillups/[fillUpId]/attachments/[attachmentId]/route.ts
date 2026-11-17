import { deleteAttachment } from '@/lib/attachments/delete';
import { renameAttachment } from '@/lib/attachments/rename';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ vehicleId: string; fillUpId: string; attachmentId: string }>;
};

export async function DELETE(req: Request, context: Context) {
  const { vehicleId, fillUpId, attachmentId } = await context.params;
  return deleteAttachment(req, vehicleId, { type: 'fillup', id: fillUpId }, attachmentId);
}

export async function PATCH(req: Request, context: Context) {
  const { vehicleId, fillUpId, attachmentId } = await context.params;
  return renameAttachment(req, vehicleId, { type: 'fillup', id: fillUpId }, attachmentId);
}
