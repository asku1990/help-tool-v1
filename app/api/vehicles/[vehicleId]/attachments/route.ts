import { handleAttachments } from '@/lib/attachments/handler';

export const runtime = 'nodejs';

type Context = { params: Promise<{ vehicleId: string }> };

export async function GET(req: Request, context: Context) {
  const { vehicleId } = await context.params;
  return handleAttachments(req, vehicleId, { type: 'vehicle' });
}

export async function POST(req: Request, context: Context) {
  const { vehicleId } = await context.params;
  return handleAttachments(req, vehicleId, { type: 'vehicle' });
}
