import { handleAttachments } from '@/lib/attachments/handler';

export const runtime = 'nodejs';

type Context = { params: Promise<{ vehicleId: string; fillUpId: string }> };

export async function GET(req: Request, context: Context) {
  const { vehicleId, fillUpId } = await context.params;
  return handleAttachments(req, vehicleId, { type: 'fillup', id: fillUpId });
}

export async function POST(req: Request, context: Context) {
  const { vehicleId, fillUpId } = await context.params;
  return handleAttachments(req, vehicleId, { type: 'fillup', id: fillUpId });
}
