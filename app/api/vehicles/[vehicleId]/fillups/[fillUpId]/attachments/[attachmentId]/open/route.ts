import { openAttachment } from '@/lib/attachments/open';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ vehicleId: string; fillUpId: string; attachmentId: string }>;
};

export async function GET(req: Request, context: Context) {
  const { vehicleId, fillUpId, attachmentId } = await context.params;
  return openAttachment(req, vehicleId, { type: 'fillup', id: fillUpId }, attachmentId);
}
