import { deleteAttachment } from '@/lib/attachments/delete';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ vehicleId: string; fillUpId: string; attachmentId: string }>;
};

export async function DELETE(req: Request, context: Context) {
  const { vehicleId, fillUpId, attachmentId } = await context.params;
  return deleteAttachment(req, vehicleId, { type: 'fillup', id: fillUpId }, attachmentId);
}
